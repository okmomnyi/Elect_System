const express = require('express');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Load environment variables first
const env = require('./config/env');

// Import configurations
const database = require('./config/database');
const redis = require('./config/redis');
const rabbitmq = require('./config/rabbitmq');

// Import middleware
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { rateLimitHealth, rateLimitApi } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth.routes');
const electionsRoutes = require('./routes/elections.routes');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');

// Import socket setup
const setupSocket = require('./socket');

// Import email worker (registers the BullMQ consumer on startup)
const emailWorker = require('./jobs/sendEmail.job');

// Import cleanup job (periodic DB housekeeping)
const cleanupJob = require('./jobs/cleanup.job');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Trust proxy (for rate limiting behind nginx)
app.set('trust proxy', 1);

// ==================
// Security Middleware
// ==================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.FRONTEND_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS configuration
const ALLOWED_ORIGINS = new Set([env.FRONTEND_URL].filter(Boolean));

// Reject browser requests from unauthorized origins before cors runs.
// Requests with no Origin header (Vercel SSR / server-to-server) pass through.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({
      success: false,
      error: 'Origin not allowed',
      code: 'CORS_REJECTED',
    });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // No origin (server-to-server) or explicitly allowed origin
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, true);
    } else {
      // Guard above already sent 403; this is belt-and-suspenders
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  maxAge: 86400,
}));

// ==================
// Body Parsing
// ==================

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// ==================
// Request Logging
// ==================

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development' || duration > 1000) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  
  next();
});

// ==================
// API Routes
// ==================

// Global rate limit for all /api routes (100 req/min per IP).
// Auth routes additionally enforce a stricter 5 req/min limit (rateLimitAuth)
// and a per-email 3-OTP/10-min limit (rateLimitOtp) defined in auth.routes.js.
app.use('/api', rateLimitApi);

app.use('/api/auth', authRoutes);
app.use('/api/elections', electionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/health', rateLimitHealth, healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================
// Error Handling
// ==================

app.use(notFoundHandler);
app.use(errorHandler);

// ==================
// Server Startup
// ==================

async function startServer() {
  try {
    console.log('🚀 Starting University Voting System...\n');
    
    // Initialize RabbitMQ connection
    console.log('📡 Connecting to services...');
    await rabbitmq.connect();
    
    // Test database connection
    const dbHealthy = await database.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✅ PostgreSQL connected');
    
    // Test Redis connection
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }
    console.log('✅ Redis connected');
    
    // Setup WebSocket server
    const io = setupSocket(server);
    app.set('io', io);
    console.log('✅ WebSocket server initialized');
    
    // Bootstrap admin user if not exists
    await bootstrapAdmin();
    
    // Email worker is started by requiring the module above.
    // Log confirmation so operators know it's active.
    console.log('✅ Email dispatch worker started (concurrency: 5)');

    // Start periodic DB cleanup (verification_log rows older than 30 days)
    cleanupJob.start();
    console.log('✅ DB cleanup job scheduled (every 6 hours)');

    // Start HTTP server
    server.listen(env.PORT, () => {
      console.log(`\n🎉 Server running on port ${env.PORT}`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Frontend URL: ${env.FRONTEND_URL}`);
      console.log(`   Health check: http://localhost:${env.PORT}/health\n`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

/**
 * Bootstrap admin user on first run
 */
async function bootstrapAdmin() {
  try {
    const result = await database.query(
      'SELECT id FROM users WHERE email = $1',
      [env.BOOTSTRAP_ADMIN_EMAIL]
    );
    
    if (result.rows.length === 0) {
      await database.query(
        `INSERT INTO users (email, full_name, role, email_verified, is_active)
         VALUES ($1, $2, 'super_admin', TRUE, TRUE)`,
        [env.BOOTSTRAP_ADMIN_EMAIL, env.BOOTSTRAP_ADMIN_NAME]
      );
      console.log(`✅ Bootstrap admin created: ${env.BOOTSTRAP_ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error('⚠️ Failed to bootstrap admin:', error.message);
  }
}

// ==================
// Graceful Shutdown
// ==================

async function shutdown(signal) {
  console.log(`\n⚠️ ${signal} received. Shutting down gracefully...`);
  
  server.close(async () => {
    console.log('📡 HTTP server closed');
    
    try {
      await emailWorker.close();
      await database.close();
      await redis.close();
      await rabbitmq.close();
      console.log('✅ All connections closed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  });
  
  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

module.exports = { app, server };
