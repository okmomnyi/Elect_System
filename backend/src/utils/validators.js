const { z } = require('zod');

/**
 * Shared Zod schemas used across multiple controllers.
 * Import from here to avoid drift between identical definitions.
 */

const uuidSchema = z.string().uuid('Invalid ID format');

const receiptTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Invalid receipt token format');

module.exports = { uuidSchema, receiptTokenSchema };
