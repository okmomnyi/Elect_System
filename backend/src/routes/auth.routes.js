const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { rateLimitAuth, rateLimitApi, rateLimitOtp } = require('../middleware/rateLimiter');

/**
 * Authentication Routes
 */

// Register (password + OTP) - step 1: create account & send OTP
router.post('/register', rateLimitAuth, rateLimitOtp, authController.register);

// Login (password + OTP) - step 1: verify password & send OTP
router.post('/login', rateLimitAuth, authController.login);

// Request OTP - legacy / OTP-only flow
router.post('/request-otp', rateLimitAuth, rateLimitOtp, authController.requestOtp);

// Verify OTP - step 2 for 2FA (and legacy OTP-only)
router.post('/verify-otp', rateLimitAuth, authController.verifyOtp);

// Logout - Requires authentication + rate limited
router.post('/logout', rateLimitApi, authenticate, authController.logout);

// Get current user - Requires authentication + rate limited
router.get('/me', rateLimitApi, authenticate, authController.getCurrentUser);

module.exports = router;
