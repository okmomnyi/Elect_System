const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const env = require('./config/env');
const { redis, redisSub, redisPub, KEYS, CHANNELS } = require('./config/redis');
const { query } = require('./config/database');
const { uuidSchema } = require('./utils/validators');

/**
 * Socket.io Server Setup
 * Handles real-time communication for live vote tallies
 */

function setupSocket(httpServer) {
  // Create Socket.io server
  const io = new Server(httpServer, {
    cors: {
      // Normalize trailing slash so a configured "https://app.edu/" still matches
      // the browser-sent Origin "https://app.edu".
      origin: typeof env.FRONTEND_URL === 'string' ? env.FRONTEND_URL.replace(/\/+$/, '') : env.FRONTEND_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  
  // Use Redis adapter for multi-server support
  io.adapter(createAdapter(redisPub, redisSub));
  
  console.log('🔌 Socket.io: Server initialized with Redis adapter');
  
  // ==================
  // Authentication Middleware
  // ==================
  
  io.use(async (socket, next) => {
    try {
      // Get token from cookie or auth header
      const token = socket.handshake.auth?.token || 
                    socket.handshake.headers?.cookie?.match(/voting_token=([^;]+)/)?.[1];
      
      if (!token) {
        // Allow anonymous connections for public data
        socket.user = null;
        return next();
      }
      
      // Verify JWT
      const decoded = jwt.verify(token, env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
      
      // Check session in Redis
      const sessionData = await redis.get(KEYS.session(decoded.userId));
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        socket.user = {
          id: decoded.userId,
          email: decoded.email,
          role: session.role,
        };
      } else {
        socket.user = null;
      }
      
      next();
    } catch (error) {
      console.error('🔌 Socket auth error:', error.message);
      socket.user = null;
      next(); // Allow connection but without auth
    }
  });
  
  // ==================
  // Connection Handler
  // ==================
  
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.user?.email || 'anonymous'})`);
    
    // ==================
    // Join Election Room
    // ==================
    
    socket.on('join_election', async ({ electionId }) => {
      if (!electionId || !uuidSchema.safeParse(electionId).success) {
        socket.emit('error', { message: 'Valid election ID required' });
        return;
      }

      // Authentication required — the live tally must not leak to anonymous
      // clients. (The same gating exists on the REST results endpoint.)
      if (!socket.user) {
        socket.emit('error', { code: 'UNAUTHENTICATED', message: 'Authentication required' });
        return;
      }

      // Eligibility check: results are only viewable when the election is closed,
      // results have been made visible, or this user has already voted. Otherwise
      // the running tally stays hidden during active voting.
      try {
        const electionRes = await query(
          'SELECT status, results_visible FROM elections WHERE id = $1',
          [electionId]
        );
        if (electionRes.rows.length === 0) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Election not found' });
          return;
        }
        const { status, results_visible } = electionRes.rows[0];

        let allowed = status === 'closed' || results_visible === true;
        if (!allowed) {
          const votedRes = await query(
            'SELECT 1 FROM vote_receipts WHERE user_id = $1 AND election_id = $2',
            [socket.user.id, electionId]
          );
          allowed = votedRes.rows.length > 0;
        }

        if (!allowed) {
          socket.emit('error', { code: 'RESULTS_NOT_AVAILABLE', message: 'Results are not yet available' });
          return;
        }
      } catch (error) {
        console.error('Error checking election access:', error.message);
        socket.emit('error', { message: 'Unable to join election' });
        return;
      }

      // Join the election room
      socket.join(`election:${electionId}`);
      console.log(`🔌 Socket ${socket.id} joined election:${electionId}`);

      // Send current tally to the new joiner
      try {
        const currentTally = await getCurrentTally(electionId);
        socket.emit('current_tally', currentTally);
      } catch (error) {
        console.error('Error fetching current tally:', error.message);
      }
    });
    
    // ==================
    // Leave Election Room
    // ==================
    
    socket.on('leave_election', ({ electionId }) => {
      if (electionId) {
        socket.leave(`election:${electionId}`);
        console.log(`🔌 Socket ${socket.id} left election:${electionId}`);
      }
    });
    
    // ==================
    // Admin Room (for admins only)
    // ==================
    
    socket.on('join_admin', () => {
      if (socket.user && ['admin', 'super_admin'].includes(socket.user.role)) {
        socket.join('admin');
        console.log(`🔌 Admin ${socket.user.email} joined admin room`);
      } else {
        socket.emit('error', { message: 'Unauthorized' });
      }
    });
    
    // ==================
    // Disconnect Handler
    // ==================
    
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
    
    // ==================
    // Error Handler
    // ==================
    
    socket.on('error', (error) => {
      console.error(`🔌 Socket error for ${socket.id}:`, error);
    });
  });
  
  // ==================
  // Redis Pub/Sub for Vote Updates
  // ==================
  
  // Subscribe to all election update channels
  redisSub.psubscribe('election:*:updates', (err, count) => {
    if (err) {
      console.error('❌ Redis psubscribe error:', err);
    } else {
      console.log(`🔌 Socket.io: Subscribed to ${count} channel pattern(s)`);
    }
  });
  
  // Handle incoming messages
  redisSub.on('pmessage', (pattern, channel, message) => {
    try {
      // Extract election ID from channel (election:{id}:updates)
      const parts = channel.split(':');
      if (parts.length >= 2) {
        const electionId = parts[1];
        const data = JSON.parse(message);
        
        // Broadcast to all clients in the election room
        io.to(`election:${electionId}`).emit('vote_update', data);
        
        console.log(`📊 Broadcasted vote update for election ${electionId}`);
      }
    } catch (error) {
      console.error('❌ Error processing Redis message:', error.message);
    }
  });
  
  return io;
}

/**
 * Get current tally for an election
 * @param {string} electionId - Election ID
 * @returns {Promise<object>} Current tally data
 */
async function getCurrentTally(electionId) {
  // Look up candidates from the index Set maintained by tally.service.js.
  // Replaces the previous redis.keys() scan which is O(N) over the entire
  // keyspace and blocks Redis for the duration.
  const candidateIds = await redis.smembers(KEYS.tallyCandidates(electionId));

  if (candidateIds.length === 0) {
    return { electionId, results: [], totalVotes: 0 };
  }

  const tallyKeys = candidateIds.map(id => KEYS.tally(electionId, id));
  const values = await redis.mget(tallyKeys);

  const results = candidateIds.map((id, index) => ({
    candidateId: id,
    votes: parseInt(values[index] || '0', 10),
  }));

  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  return {
    electionId,
    results,
    totalVotes,
    timestamp: new Date().toISOString(),
  };
}

module.exports = setupSocket;
