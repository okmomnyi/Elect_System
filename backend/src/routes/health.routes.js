const express = require('express');
const router = express.Router();
const database = require('../config/database');
const redis = require('../config/redis');
const rabbitmq = require('../config/rabbitmq');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/requireRole');

/**
 * Health Check Routes
 *
 * GET /health          — Public. Used by load balancers / uptime monitors.
 *                        Returns only the service name and uptime — no infra detail.
 *
 * GET /health/detailed — Requires super_admin authentication.
 * GET /health/db       — Requires super_admin authentication.
 * GET /health/redis    — Requires super_admin authentication.
 * GET /health/queue    — Requires super_admin authentication.
 *
 * Detailed endpoints are protected because they expose which infrastructure
 * components are up or down — information an attacker could use to time attacks.
 */

// Public — load balancer ping only
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    status : 'ok',
    timestamp: new Date().toISOString(),
    uptime : process.uptime(),
    service: 'university-voting-backend',
  });
}));

// All detailed checks require an authenticated super_admin
router.use(authenticate, requireSuperAdmin);

router.get('/detailed', asyncHandler(async (req, res) => {
  const checks = { database: false, redis: false, queue: false };

  try { checks.database = await database.healthCheck(); } catch (e) {
    console.error('Health check - DB error:', e.message);
  }
  try { checks.redis = await redis.healthCheck(); } catch (e) {
    console.error('Health check - Redis error:', e.message);
  }
  try { checks.queue = await rabbitmq.healthCheck(); } catch (e) {
    console.error('Health check - Queue error:', e.message);
  }

  const allHealthy = Object.values(checks).every((v) => v === true);

  res.status(allHealthy ? 200 : 503).json({
    status   : allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime   : process.uptime(),
    checks,
  });
}));

router.get('/db', asyncHandler(async (req, res) => {
  const healthy = await database.healthCheck();
  res.status(healthy ? 200 : 503).json({
    status : healthy ? 'ok' : 'error',
    service: 'postgresql',
  });
}));

router.get('/redis', asyncHandler(async (req, res) => {
  const healthy = await redis.healthCheck();
  res.status(healthy ? 200 : 503).json({
    status : healthy ? 'ok' : 'error',
    service: 'redis',
  });
}));

router.get('/queue', asyncHandler(async (req, res) => {
  const healthy = await rabbitmq.healthCheck();
  res.status(healthy ? 200 : 503).json({
    status : healthy ? 'ok' : 'error',
    service: 'rabbitmq',
  });
}));

module.exports = router;
