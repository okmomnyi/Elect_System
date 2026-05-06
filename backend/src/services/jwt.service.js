const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * JWT Service
 * Handles RS256 token signing and verification
 */

/**
 * Sign a JWT token with the private key
 * @param {object} payload - Token payload
 * @param {object} options - Additional options
 * @returns {string} Signed JWT token
 */
function signToken(payload, options = {}) {
  const defaultOptions = {
    algorithm: 'RS256',
    expiresIn: env.JWT_EXPIRY,
    issuer: 'university-voting-system',
  };
  
  return jwt.sign(payload, env.JWT_PRIVATE_KEY, {
    ...defaultOptions,
    ...options,
  });
}

/**
 * Verify a JWT token with the public key
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_PUBLIC_KEY, {
    algorithms: ['RS256'],
    issuer: 'university-voting-system',
  });
}

/**
 * Generate cookie options for JWT token
 * @returns {object} Cookie configuration
 */
function getCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: env.JWT_EXPIRY * 1000, // Convert to milliseconds
  };
}

/**
 * Create JWT payload for a user
 * @param {object} user - User object
 * @returns {object} JWT payload
 */
function createTokenPayload(user) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
  };
}

/**
 * Set JWT cookie on response
 * @param {object} res - Express response object
 * @param {string} token - JWT token
 */
function setTokenCookie(res, token) {
  res.cookie('voting_token', token, getCookieOptions());
}

/**
 * Clear JWT cookie from response
 * @param {object} res - Express response object
 */
function clearTokenCookie(res) {
  res.clearCookie('voting_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

module.exports = {
  signToken,
  verifyToken,
  getCookieOptions,
  createTokenPayload,
  setTokenCookie,
  clearTokenCookie,
};
