const crypto = require('crypto');
const env = require('../config/env');

/**
 * Global Error Handler Middleware
 * Catches all unhandled errors and formats consistent responses
 */

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper to catch errors in async routes
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Error handler middleware
 * Must be registered after all routes
 */
function errorHandler(err, req, res, next) {
  // CORS rejection — return 403 without logging; these are expected from bots/crawlers
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Origin not allowed',
      code: 'CORS_REJECTED',
    });
  }

  // Generate unique request ID for tracking
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  // Default error properties
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  
  // Log error details (always log on server side)
  console.error('❌ Error:', {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: req.user?.id || 'anonymous',
    statusCode,
    code,
    message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Authentication required';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    code = 'INVALID_REFERENCE';
    message = 'Referenced resource not found';
  }
  
  // Never leak internal error details in production
  if (!err.isOperational && env.NODE_ENV === 'production') {
    message = 'An unexpected error occurred';
    code = 'INTERNAL_ERROR';
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    requestId,
    ...(env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details 
    }),
  });
}

/**
 * 404 handler for unmatched routes
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    code: 'NOT_FOUND',
    // Only expose the path in development — prevents route enumeration in production
    ...(env.NODE_ENV === 'development' && { path: req.path }),
  });
}

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
};
