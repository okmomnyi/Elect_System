/**
 * cleanup.job.js
 *
 * Periodic housekeeping tasks:
 *
 *  1. Auto-close elections whose end_time has passed but are still 'active'.
 *     Redis election-status cache is updated immediately so vote submissions
 *     stop at the API layer without waiting for the next DB query.
 *
 *  2. Purge stale verification_log rows older than 30 days.
 *     Redis OTP keys expire automatically via TTL (600 s) — no Redis cleanup needed.
 *
 * Schedule: runs once 60 seconds after startup, then every 6 hours.
 *
 * NOTE: Socket.io election_closed events are NOT emitted here because the
 * cleanup job does not have access to the io instance. Connected clients will
 * receive the updated status on their next API request, or via the socket
 * event when an admin manually triggers a close in between job runs.
 */

const { query } = require('../config/database');
const { redis, KEYS } = require('../config/redis');

const STARTUP_DELAY_MS    = 60  * 1000;
const CLEANUP_INTERVAL_MS = 6   * 60 * 60 * 1000;
const RETENTION_DAYS      = 30;

/**
 * Auto-close elections that have passed their end_time.
 */
async function autoCloseExpiredElections() {
  let closed = 0;

  try {
    const expiredResult = await query(
      `SELECT id, title
       FROM elections
       WHERE status = 'active'
         AND end_time IS NOT NULL
         AND end_time < NOW()`
    );

    if (expiredResult.rows.length === 0) return;

    for (const election of expiredResult.rows) {
      try {
        await query(
          `UPDATE elections
           SET status = 'closed', results_visible = TRUE, updated_at = NOW()
           WHERE id = $1 AND status = 'active'`,
          [election.id]
        );

        // Immediately reflect the closed status in Redis so the API layer stops
        // accepting votes without waiting for a cache expiry.
        await redis.set(KEYS.electionStatus(election.id), 'closed');

        // Append an audit entry for traceability (no user_id — system action)
        await query(
          `INSERT INTO audit_log (action, entity_type, entity_id, metadata)
           VALUES ('election_auto_closed', 'election', $1, $2)`,
          [election.id, JSON.stringify({ title: election.title, reason: 'end_time_passed' })]
        );

        closed++;
        console.log(`🔒 [Cleanup] Auto-closed election "${election.title}" (${election.id})`);
      } catch (electionErr) {
        console.error(`❌ [Cleanup] Failed to auto-close election ${election.id}:`, electionErr.message);
      }
    }

    if (closed > 0) {
      console.log(`🔒 [Cleanup] Auto-closed ${closed} expired election(s)`);
    }
  } catch (err) {
    console.error('❌ [Cleanup] autoCloseExpiredElections failed:', err.message);
  }
}

/**
 * Delete verification_log rows older than RETENTION_DAYS.
 */
async function cleanupVerificationLog() {
  try {
    const result = await query(
      `DELETE FROM verification_log
       WHERE requested_at < NOW() - ($1 * INTERVAL '1 day')`,
      [RETENTION_DAYS]
    );
    if (result.rowCount > 0) {
      console.log(`🧹 [Cleanup] Removed ${result.rowCount} verification_log row(s) older than ${RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error('❌ [Cleanup] verification_log cleanup failed:', err.message);
  }
}

/**
 * Delete password_reset_tokens that are spent or long expired, so the table
 * does not grow unbounded. Keeps recently-expired rows for a short audit window.
 */
async function cleanupResetTokens() {
  try {
    const result = await query(
      `DELETE FROM password_reset_tokens
       WHERE used_at IS NOT NULL
          OR expires_at < NOW() - ($1 * INTERVAL '1 day')`,
      [RETENTION_DAYS]
    );
    if (result.rowCount > 0) {
      console.log(`🧹 [Cleanup] Removed ${result.rowCount} spent/expired password reset token(s)`);
    }
  } catch (err) {
    console.error('❌ [Cleanup] password_reset_tokens cleanup failed:', err.message);
  }
}

async function runAllTasks() {
  await autoCloseExpiredElections();
  await cleanupVerificationLog();
  await cleanupResetTokens();
}

function start() {
  setTimeout(async () => {
    await runAllTasks();
    setInterval(runAllTasks, CLEANUP_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

module.exports = { start, runAllTasks, autoCloseExpiredElections, cleanupVerificationLog, cleanupResetTokens };
