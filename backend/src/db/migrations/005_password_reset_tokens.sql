-- Migration 005: Password reset tokens
-- Run AFTER 002_add_password_field.sql

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(128) NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON password_reset_tokens(expires_at)
  WHERE used_at IS NULL;

COMMENT ON TABLE password_reset_tokens IS
  'One-time tokens for password reset. token_hash is sha256 of the raw token sent in email.';
COMMENT ON COLUMN password_reset_tokens.token_hash IS
  'sha256 hex digest of the raw token. Raw token is never stored.';
COMMENT ON COLUMN password_reset_tokens.used_at IS
  'Timestamp when the token was redeemed. NULL = unused.';
