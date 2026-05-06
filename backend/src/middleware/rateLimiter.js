const { redis, KEYS } = require('../config/redis');
const { getClientIp } = require('../utils/getClientIp');

/**
 * Redis-backed Rate Limiter Middleware
 *
 * Uses a fixed-window algorithm (INCR + EXPIRE per window period).
 *
 * Failure strategy (security-first):
 *  - auth / otp limiters → FAIL CLOSED on Redis error.
 *    A Redis outage must never open a brute-force window on login or OTP endpoints.
 *    Clients receive 503 until Redis recovers.
 *  - api / health / vote limiters → FAIL OPEN on Redis error.
 *    A Redis hiccup must not block authenticated users from the application.
 */

const LIMITS = {
  auth: {
    windowMs: 60 * 1000,
    max: 5,
  },
  otp: {
    windowMs: 10 * 60 * 1000,
    max: 3,
  },
  api: {
    windowMs: 60 * 1000,
    max: 100,
  },
  vote: {
    windowMs: 60 * 1000,
    max: 5,
  },
  health: {
    windowMs: 60 * 1000,
    max: 200,
  },
};

const FAIL_CLOSED_TYPES = new Set(['auth', 'otp']);

/**
 * Create rate limiter middleware keyed on the client IP address.
 * @param {string} type - Key into LIMITS
 */
function createRateLimiter(type = 'api') {
  const config = LIMITS[type] || LIMITS.api;
  const failClosed = FAIL_CLOSED_TYPES.has(type);

  return async (req, res, next) => {
    try {
      const ip       = getClientIp(req);
      const endpoint = req.path.replace(/\/[0-9a-f-]{36}/gi, '/:id');
      const key      = KEYS.rate(ip, endpoint);

      const current = await redis.get(key);
      const count   = parseInt(current || '0', 10);

      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + config.windowMs) / 1000));

      if (count >= config.max) {
        const retryAfter = Math.ceil(config.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          success: false,
          error  : 'Too many requests. Please try again later.',
          retryAfter,
        });
      }

      await redis.multi()
        .incr(key)
        .expire(key, Math.ceil(config.windowMs / 1000))
        .exec();

      next();
    } catch (error) {
      console.error(`❌ Rate limiter error (${type}):`, error.message);

      if (failClosed) {
        return res.status(503).json({
          success: false,
          error  : 'Service temporarily unavailable. Please try again shortly.',
          code   : 'RATE_LIMITER_UNAVAILABLE',
        });
      }

      next();
    }
  };
}

/**
 * Create rate limiter keyed on the email address in the request body.
 * Used for OTP requests to prevent flooding a single email address.
 * Falls back to IP-based limiting if no email is present.
 * @param {string} type - Key into LIMITS (default: 'otp')
 */
function createEmailRateLimiter(type = 'otp') {
  const config    = LIMITS[type] || LIMITS.otp;
  const failClosed = FAIL_CLOSED_TYPES.has(type);

  return async (req, res, next) => {
    try {
      const email   = req.body?.email;
      const ip      = getClientIp(req);
      const subject = email ? `email:${email}` : `ip:${ip}`;
      const key     = `rate:otp:${subject}`;

      const current = await redis.get(key);
      const count   = parseInt(current || '0', 10);

      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + config.windowMs) / 1000));

      if (count >= config.max) {
        const retryAfter = Math.ceil(config.windowMs / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          success: false,
          error  : 'Too many OTP requests for this address. Please try again later.',
          retryAfter,
        });
      }

      await redis.multi()
        .incr(key)
        .expire(key, Math.ceil(config.windowMs / 1000))
        .exec();

      next();
    } catch (error) {
      console.error(`❌ Email rate limiter error (${type}):`, error.message);

      if (failClosed) {
        return res.status(503).json({
          success: false,
          error  : 'Service temporarily unavailable. Please try again shortly.',
          code   : 'RATE_LIMITER_UNAVAILABLE',
        });
      }

      next();
    }
  };
}

const rateLimitAuth   = createRateLimiter('auth');
const rateLimitApi    = createRateLimiter('api');
const rateLimitVote   = createRateLimiter('vote');
const rateLimitHealth = createRateLimiter('health');
const rateLimitOtp    = createEmailRateLimiter('otp');

module.exports = {
  createRateLimiter,
  createEmailRateLimiter,
  rateLimitAuth,
  rateLimitApi,
  rateLimitVote,
  rateLimitHealth,
  rateLimitOtp,
  LIMITS,
};
