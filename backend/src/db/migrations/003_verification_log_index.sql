-- Migration 003: Add partial composite index on verification_log
-- Identified during security audit.
--
-- The UPDATE in auth.controller.js (verify-otp) uses:
--   WHERE email = $2 AND verified_at IS NULL
--   ORDER BY requested_at DESC
--   LIMIT 1
--
-- idx_verification_email covers the email filter but the planner still does
-- a heap scan to filter verified_at IS NULL and sort by requested_at.
-- This partial index covers the exact WHERE + ORDER BY pattern for unverified rows.

CREATE INDEX IF NOT EXISTS idx_verification_email_unverified
  ON verification_log(email, requested_at DESC)
  WHERE verified_at IS NULL;
