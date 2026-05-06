/**
 * sendEmail.job.js — BullMQ email worker
 *
 * Layer 3 of the async email pipeline:
 *   Trigger → BullMQ queue → THIS WORKER → email.service.js → Brevo API
 *
 * Concurrency: 5  (five email jobs processed simultaneously)
 *
 * Supported job types:
 *   'vote-confirmation'  — after a vote is successfully cast
 *   'election-opened'    — bulk per-student notification when an election opens
 *   'election-closed'    — bulk per-admin notification with final results
 *
 * Design: the worker always re-queries the database rather than trusting
 * the enqueued payload.  DB data can change between enqueue and execution
 * (e.g., election title updated, user details corrected).
 */

const { createWorker, QUEUE_NAMES } = require('../config/queue');
const emailService = require('../services/email.service');
const { query }    = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────────────────────

const worker = createWorker(
  QUEUE_NAMES.EMAIL_DISPATCH,

  async (job) => {
    const { type } = job.data;

    switch (type) {
      // ── Vote confirmation ─────────────────────────────────────────────────
      case 'vote-confirmation': {
        const { userId, electionId, receiptToken } = job.data;

        const [userRes, electionRes] = await Promise.all([
          query('SELECT email, full_name FROM users WHERE id = $1', [userId]),
          query('SELECT title FROM elections WHERE id = $1', [electionId]),
        ]);

        if (!userRes.rows.length || !electionRes.rows.length) {
          console.warn(`[EmailWorker] job ${job.id}: user or election not found — skipping`);
          return;
        }

        await emailService.sendVoteConfirmation(
          userRes.rows[0],
          electionRes.rows[0],
          receiptToken
        );

        console.log(`📧 [EmailWorker] vote-confirmation sent to ${userRes.rows[0].email}`);
        break;
      }

      // ── Election opened (per-student) ─────────────────────────────────────
      case 'election-opened': {
        const { userId, electionId } = job.data;

        const [userRes, electionRes] = await Promise.all([
          query('SELECT email, full_name FROM users WHERE id = $1', [userId]),
          query(
            'SELECT title, description, start_time, end_time FROM elections WHERE id = $1',
            [electionId]
          ),
        ]);

        if (!userRes.rows.length || !electionRes.rows.length) {
          console.warn(`[EmailWorker] job ${job.id}: user or election not found — skipping`);
          return;
        }

        await emailService.sendElectionOpenedNotification(
          userRes.rows[0],
          electionRes.rows[0]
        );

        console.log(`📧 [EmailWorker] election-opened sent to ${userRes.rows[0].email}`);
        break;
      }

      // ── Election closed (per-admin, includes results) ─────────────────────
      case 'election-closed': {
        const { userId, electionId } = job.data;

        const [userRes, electionRes, resultsRes] = await Promise.all([
          query('SELECT email, full_name FROM users WHERE id = $1', [userId]),
          query('SELECT title FROM elections WHERE id = $1', [electionId]),
          query(
            `SELECT c.name, c.position, COUNT(b.id)::int AS vote_count
               FROM candidates c
               LEFT JOIN ballots b ON c.id = b.candidate_id
              WHERE c.election_id = $1 AND c.is_active = TRUE
              GROUP BY c.id
              ORDER BY vote_count DESC`,
            [electionId]
          ),
        ]);

        if (!userRes.rows.length || !electionRes.rows.length) {
          console.warn(`[EmailWorker] job ${job.id}: user or election not found — skipping`);
          return;
        }

        const totalVotes = resultsRes.rows.reduce(
          (sum, r) => sum + (r.vote_count || 0), 0
        );

        await emailService.sendElectionClosedNotification(
          userRes.rows[0],
          electionRes.rows[0],
          resultsRes.rows,
          totalVotes
        );

        console.log(`📧 [EmailWorker] election-closed sent to ${userRes.rows[0].email}`);
        break;
      }

      default:
        console.warn(`[EmailWorker] Unknown job type '${type}' (job ${job.id}) — discarding`);
    }
  },

  { concurrency: 5 }
);

// ─────────────────────────────────────────────────────────────────────────────
// Error logging
// ─────────────────────────────────────────────────────────────────────────────

worker.on('failed', (job, err) => {
  console.error(
    `[EmailWorker] Job ${job?.id} (type=${job?.data?.type}) failed after ${job?.attemptsMade} attempt(s): ${err.message}`
  );
});

worker.on('error', (err) => {
  console.error('[EmailWorker] Worker error:', err.message);
});

module.exports = worker;
