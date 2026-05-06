-- Migration 002: Add missing composite indexes for query performance
-- These were identified during the security/performance audit.

-- Speeds up /api/internal/recipients?role=... and admin user-listing queries
-- that filter by role AND is_active simultaneously.
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users(role, is_active)
  WHERE is_active = TRUE;

-- Speeds up tally queries that aggregate ballots by (election, candidate).
CREATE INDEX IF NOT EXISTS idx_ballots_election_candidate
  ON ballots(election_id, candidate_id);

-- Speeds up admin audit-log queries filtered by user with time ordering
-- (e.g. GET /api/admin/audit-log?userId=...).
CREATE INDEX IF NOT EXISTS idx_audit_user_created
  ON audit_log(user_id, created_at DESC);
