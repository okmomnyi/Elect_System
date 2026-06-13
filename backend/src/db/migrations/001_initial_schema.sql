-- University Electronic Voting System - Initial Database Schema
-- This migration creates all tables, indexes, and constraints

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================
-- USERS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      VARCHAR(20)   UNIQUE,
  email           VARCHAR(255)  UNIQUE NOT NULL,
  email_verified  BOOLEAN       DEFAULT FALSE,
  full_name       VARCHAR(255)  NOT NULL,
  role            VARCHAR(20)   DEFAULT 'student'
                  CHECK (role IN ('student', 'admin', 'super_admin')),
  is_active       BOOLEAN       DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Registered voters and administrators';
COMMENT ON COLUMN users.role IS 'Access level: student (vote only), admin (manage elections), super_admin (full access)';

-- ======================
-- ELECTIONS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS elections (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255)  NOT NULL,
  description     TEXT,
  status          VARCHAR(20)   DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'closed')),
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  created_by      UUID          REFERENCES users(id),
  results_visible BOOLEAN       DEFAULT FALSE,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE elections IS 'Election instances with lifecycle management';
COMMENT ON COLUMN elections.status IS 'draft: not started, active: voting open, closed: voting ended';
COMMENT ON COLUMN elections.results_visible IS 'Whether results are visible to students (set TRUE when closed)';

-- ======================
-- CANDIDATES TABLE
-- ======================
CREATE TABLE IF NOT EXISTS candidates (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   UUID          NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
  name          VARCHAR(255)  NOT NULL,
  bio           TEXT,
  photo_url     VARCHAR(500),
  position      VARCHAR(255),
  display_order INT           DEFAULT 0,
  is_active     BOOLEAN       DEFAULT TRUE,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE candidates IS 'Candidates running in elections';
COMMENT ON COLUMN candidates.display_order IS 'Order in which candidates appear on ballot';
COMMENT ON COLUMN candidates.is_active IS 'Whether candidate is still in the race';

-- ======================
-- VOTE RECEIPTS TABLE (Identity Side)
-- ======================
CREATE TABLE IF NOT EXISTS vote_receipts (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users(id),
  election_id    UUID          NOT NULL REFERENCES elections(id),
  receipt_token  VARCHAR(64)   UNIQUE NOT NULL,
  voted_at       TIMESTAMPTZ   DEFAULT NOW(),
  ip_address     INET,
  user_agent     TEXT,
  UNIQUE (user_id, election_id)
);

COMMENT ON TABLE vote_receipts IS 'Records WHO voted (identity side) - linked by receipt_token to ballots';
COMMENT ON COLUMN vote_receipts.receipt_token IS 'Cryptographic token linking receipt to ballot without revealing identity';

-- ======================
-- BALLOTS TABLE (Choice Side)
-- ======================
CREATE TABLE IF NOT EXISTS ballots (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   UUID          NOT NULL REFERENCES elections(id),
  candidate_id  UUID          NOT NULL REFERENCES candidates(id),
  receipt_token VARCHAR(64)   UNIQUE NOT NULL,
  cast_at       TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE ballots IS 'Records HOW people voted (choice side) - NO user_id for ballot secrecy';
COMMENT ON COLUMN ballots.receipt_token IS 'Links to vote_receipts for verification, but tables are NEVER joined except by token';

-- ======================
-- AUDIT LOG TABLE (Append-Only)
-- ======================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          REFERENCES users(id),
  action      VARCHAR(100)  NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  metadata    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Immutable audit trail of all system actions';
COMMENT ON COLUMN audit_log.action IS 'Examples: otp_requested, login, vote_submitted, vote_recorded, election_created, election_opened, election_closed';

-- ======================
-- VERIFICATION LOG TABLE
-- ======================
CREATE TABLE IF NOT EXISTS verification_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         REFERENCES users(id),
  email        VARCHAR(255) NOT NULL,
  requested_at TIMESTAMPTZ  DEFAULT NOW(),
  verified_at  TIMESTAMPTZ,
  expired      BOOLEAN      DEFAULT FALSE,
  ip_address   INET
);

COMMENT ON TABLE verification_log IS 'Tracks OTP verification attempts and outcomes';

-- ======================
-- INDEXES
-- ======================

-- vote_receipts indexes
-- NOTE: the UNIQUE (user_id, election_id) table constraint already creates an
-- implicit unique index, so a separate idx_vote_receipts_user_election would be
-- redundant on this hot write path and is intentionally omitted.
CREATE INDEX IF NOT EXISTS idx_vote_receipts_election ON vote_receipts(election_id);
CREATE INDEX IF NOT EXISTS idx_vote_receipts_token ON vote_receipts(receipt_token);

-- ballots indexes
CREATE INDEX IF NOT EXISTS idx_ballots_election ON ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_ballots_candidate ON ballots(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ballots_token ON ballots(receipt_token);

-- candidates indexes
CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id);
CREATE INDEX IF NOT EXISTS idx_candidates_active ON candidates(election_id, is_active) WHERE is_active = TRUE;

-- elections indexes
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_created_by ON elections(created_by);

-- audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- verification log indexes
CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_log(email);
CREATE INDEX IF NOT EXISTS idx_verification_requested ON verification_log(requested_at DESC);

-- users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ======================
-- SECURITY: Revoke destructive permissions on audit_log
-- ======================
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

COMMENT ON TABLE audit_log IS 'IMMUTABLE: UPDATE and DELETE permissions revoked - append-only forever';

-- ======================
-- FUNCTIONS AND TRIGGERS
-- ======================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_elections_updated_at ON elections;
CREATE TRIGGER update_elections_updated_at BEFORE UPDATE ON elections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON SCHEMA public IS 'University Electronic Voting System - Production Schema v1.0.0';
