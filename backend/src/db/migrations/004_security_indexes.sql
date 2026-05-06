-- Migration 004: Add missing indexes identified during security audit
--
-- Rationale per index:
--
-- 1. idx_users_active_role
--    openElection and closeElection both run:
--      WHERE role = 'student' AND is_active = TRUE AND email_verified = TRUE
--    Without a composite index this is a sequential scan on the full users table.
--
-- 2. idx_elections_status_end_time
--    The auto-close cleanup job queries:
--      WHERE status = 'active' AND end_time IS NOT NULL AND end_time < NOW()
--    The existing idx_elections_status covers status= but not the end_time filter.
--
-- 3. idx_verification_log_email_requested
--    auth.controller inserts and then updates verification_log filtering on
--    (email, verified_at IS NULL ORDER BY requested_at DESC).
--    A composite covering index eliminates the sort step.
--
-- 4. idx_audit_log_entity_created
--    Admin audit-log queries often combine entity_type + entity_id + date range.
--    The existing (entity_type, entity_id) and (created_at DESC) indexes are
--    separate; a composite avoids two index scans + merge.

-- 1. Users: fast bulk-email lookups (openElection / closeElection)
CREATE INDEX IF NOT EXISTS idx_users_active_role
  ON users (role, is_active, email_verified)
  WHERE is_active = TRUE;

-- 2. Elections: fast expired-election lookup for auto-close job
CREATE INDEX IF NOT EXISTS idx_elections_status_end_time
  ON elections (status, end_time)
  WHERE status = 'active' AND end_time IS NOT NULL;

-- 3. Verification log: fast lookup of most recent unverified entry per email
CREATE INDEX IF NOT EXISTS idx_verification_log_email_requested
  ON verification_log (email, requested_at DESC)
  WHERE verified_at IS NULL;

-- 4. Audit log: combined entity + time range queries
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_created
  ON audit_log (entity_type, entity_id, created_at DESC);
