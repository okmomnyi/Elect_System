const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { redis, KEYS } = require('../config/redis');

/**
 * JWT Authentication Middleware
 * Verifies JWT from HttpOnly cookie and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    // Read JWT from HttpOnly cookie
    const token = req.cookies?.voting_token;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    // Verify JWT with public key (RS256)
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          error: 'Session expired. Please log in again.' 
        });
      }
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid authentication token' 
      });
    }
    
    // Verify session exists in Redis (allows session revocation)
    const sessionKey = KEYS.session(decoded.userId);
    const sessionData = await redis.get(sessionKey);
    
    if (!sessionData) {
      return res.status(401).json({ 
        success: false, 
        error: 'Session revoked or expired. Please log in again.' 
      });
    }
    
    // Parse session data and attach to request
    const session = JSON.parse(sessionData);
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: session.role || decoded.role,
    };
    
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 * Attaches user if valid token exists, otherwise continues
 */
async function optionalAuth(req, res, next) {
  const token = req.cookies?.voting_token;
  
  if (!token) {
    req.user = null;
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
    const sessionKey = KEYS.session(decoded.userId);
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const session = JSON.parse(sessionData);
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: session.role || decoded.role,
      };
    } else {
      req.user = null;
    }
  } catch (err) {
    req.user = null;
  }
  
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
};
