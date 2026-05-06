/**
 * Vote Processor (backend/src/processors/vote.processor.js)
 * Handles the database write logic for votes consumed from RabbitMQ.
 * This is the critical path — every vote write is atomic and idempotent.
 */

const { withTransaction, query } = require('../config/database');
const { redis, KEYS, CHANNELS, TTL } = require('../config/redis');
const tallyService = require('../services/tally.service');
const { queues } = require('../config/queue');

/**
 * Process a single vote message from the queue.
 * Steps:
 *  1. BEGIN transaction
 *  2. Idempotency check — bail out (ACK) if already recorded
 *  3. INSERT vote_receipts  (identity side)
 *  4. INSERT ballots        (choice side — no user_id)
 *  5. INSERT audit_log
 *  6. COMMIT
 *  7. INCR Redis tally
 *  8. PUBLISH tally update to Redis pub/sub → Socket.io
 *  9. Enqueue vote confirmation email via BullMQ → Brevo
 *
 * @param {object} message - Vote message from RabbitMQ
 * @param {string} message.messageId
 * @param {string} message.userId
 * @param {string} message.electionId
 * @param {string} message.candidateId
 * @param {string} message.candidateName
 * @param {string} message.receiptToken
 * @param {string} message.ipAddress
 * @param {string} message.userAgent
 * @param {string} message.submittedAt  ISO timestamp
 */
async function processVote(message) {
  const {
    messageId,
    userId,
    electionId,
    candidateId,
    candidateName,
    receiptToken,
    ipAddress,
    userAgent,
    submittedAt,
  } = message;

  console.log(
    `🗳️  Processing vote: user=${userId.substring(0, 8)}... election=${electionId.substring(0, 8)}...`
  );

  // ─── Database transaction ────────────────────────────────────────────────
  await withTransaction(async (client) => {
    // Layer 2: Check for existing receipt (idempotency — covers worker restarts
    // and duplicate deliveries). If already recorded, throw a known error so
    // the caller can ACK the message without re-processing.
    const existingResult = await client.query(
      'SELECT 1 FROM vote_receipts WHERE user_id = $1 AND election_id = $2',
      [userId, electionId]
    );

    if (existingResult.rows.length > 0) {
      const err = new Error('Vote already recorded — idempotent success');
      err.code = 'ALREADY_VOTED';
      throw err;
    }

    // Insert vote receipt (identity side — WHO voted)
    await client.query(
      `INSERT INTO vote_receipts (user_id, election_id, receipt_token, ip_address, user_agent, voted_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, electionId, receiptToken, ipAddress, userAgent, submittedAt]
    );

    // Insert ballot (choice side — HOW they voted; NO user_id for ballot secrecy)
    await client.query(
      `INSERT INTO ballots (election_id, candidate_id, receipt_token, cast_at)
       VALUES ($1, $2, $3, $4)`,
      [electionId, candidateId, receiptToken, submittedAt]
    );

    // Insert audit log entry inside the same transaction for atomicity
    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, 'vote_recorded', 'election', $2, $3, $4)`,
      [
        userId,
        electionId,
        ipAddress,
        JSON.stringify({ messageId, candidateId }),
      ]
    );

    console.log(`✅ Vote written to DB: receipt=${receiptToken.substring(0, 16)}...`);
  });

  // ─── Post-commit: mark user as voted in Redis ────────────────────────────
  // Done here (after DB commit) so the flag is only set once the vote is
  // durably recorded. If set before the DB write (in vote.service) and the
  // processor permanently failed, the user would be locked out of voting with
  // no DB record to show for it.
  await redis.set(KEYS.voted(userId, electionId), '1', 'EX', TTL.VOTED);

  // ─── Post-commit: update Redis tally ────────────────────────────────────
  const newCount = await tallyService.incrementVote(electionId, candidateId);
  console.log(`📊 Tally updated: ${candidateName} → ${newCount} votes`);

  // Publish tally update so Socket.io broadcasts to connected clients
  await tallyService.publishTallyUpdate(electionId, candidateId, candidateName, newCount);

  // ─── Fire-and-forget: enqueue vote confirmation email ──────────────────
  // The worker (sendEmail.job.js) re-fetches user + election from the DB.
  // Using jobId for idempotency: if the worker retries this job, it won't
  // enqueue a second confirmation for the same vote.
  queues.emailDispatch
    .add(
      'send-vote-confirmation',
      { type: 'vote-confirmation', userId, electionId, receiptToken },
      { jobId: `vote-confirmation:${userId}:${electionId}` }
    )
    .catch((err) =>
      console.error('⚠️  Failed to enqueue vote confirmation email (non-fatal):', err.message)
    );

  return { success: true, receiptToken };
}

/**
 * Sync Redis tally from the database.
 * Used after a worker restart to ensure Redis tally matches DB truth.
 *
 * @param {string} electionId
 */
async function syncTallyFromDb(electionId) {
  const result = await query(
    `SELECT candidate_id, COUNT(*) AS vote_count
     FROM ballots
     WHERE election_id = $1
     GROUP BY candidate_id`,
    [electionId]
  );

  await tallyService.syncFromDatabase(electionId, result.rows);
  console.log(`📊 Tally synced from DB for election ${electionId}`);
}

module.exports = { processVote, syncTallyFromDb };
