const Redis = require('ioredis');
const env = require('./env');

/**
 * Redis client (singleton)
 * Used for caching, session storage, rate limiting, and pub/sub
 */
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Create separate client for pub/sub subscriber (required for Redis pub/sub)
const redisSub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Create separate client for pub/sub publisher
const redisPub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Event handlers
redis.on('connect', () => {
  console.log('🔴 Redis: Connected to server');
});

redis.on('ready', () => {
  console.log('🔴 Redis: Ready to accept commands');
});

redis.on('error', (err) => {
  console.error('❌ Redis: Connection error', err.message);
});

redis.on('close', () => {
  console.log('🔴 Redis: Connection closed');
});

redisSub.on('error', (err) => {
  console.error('❌ Redis Subscriber: Connection error', err.message);
});

redisPub.on('error', (err) => {
  console.error('❌ Redis Publisher: Connection error', err.message);
});

/**
 * Redis key patterns used throughout the application
 * Centralized here for documentation and consistency
 */
const KEYS = {
  // OTP verification: verify:{email} -> JSON { otp, expires }
  verify: (email) => `verify:${email}`,
  
  // OTP attempt counter: otp_attempts:{email} -> Integer
  otpAttempts: (email) => `otp_attempts:${email}`,
  
  // User session: session:{userId} -> JSON { role, email }
  session: (userId) => `session:${userId}`,
  
  // Vote flag: voted:{userId}:{electionId} -> "1"
  voted: (userId, electionId) => `voted:${userId}:${electionId}`,
  
  // Rate limiter: rate:{ip}:{endpoint} -> Integer
  rate: (ip, endpoint) => `rate:${ip}:${endpoint}`,
  
  // Vote tally: tally:{electionId}:{candidateId} -> Integer
  tally: (electionId, candidateId) => `tally:${electionId}:${candidateId}`,

  // Tally candidate index: tally:{electionId}:candidates -> Set of candidate IDs
  // Maintained alongside tally counters so socket.js can look up all candidates
  // for an election without an O(N) KEYS scan.
  tallyCandidates: (electionId) => `tally:${electionId}:candidates`,

  // Election status cache: election:{id}:status -> String
  electionStatus: (electionId) => `election:${electionId}:status`,
};

/**
 * Pub/Sub channel patterns
 */
const CHANNELS = {
  // Election updates: election:{id}:updates
  electionUpdates: (electionId) => `election:${electionId}:updates`,
};

/**
 * TTL values in seconds
 */
const TTL = {
  OTP: 600,           // 10 minutes
  OTP_ATTEMPTS: 900,  // 15 minutes (lockout window outlasts the OTP itself)
  SESSION: 86400,     // 24 hours
  RATE_LIMIT: 60,     // 1 minute
  VOTED: 90000,       // ~25 hours (election end + buffer)
};

/**
 * Health check for Redis connection
 * @returns {Promise<boolean>} True if healthy
 */
async function healthCheck() {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('❌ Redis health check failed:', error.message);
    return false;
  }
}

/**
 * Gracefully close all Redis connections
 */
async function close() {
  console.log('🔴 Redis: Closing connections...');
  await Promise.all([
    redis.quit(),
    redisSub.quit(),
    redisPub.quit(),
  ]);
  console.log('🔴 Redis: All connections closed');
}

module.exports = {
  redis,
  redisSub,
  redisPub,
  KEYS,
  CHANNELS,
  TTL,
  healthCheck,
  close,
};
