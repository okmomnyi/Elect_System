-- Migration 002: Add password authentication support for 2FA
-- Run AFTER 001_initial_schema.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

COMMENT ON COLUMN users.password_hash IS
  'scrypt-hashed password (format: hash.salt). NULL for OTP-only legacy accounts.';
