/**
 * Vote Processor (worker/src/processors/vote.processor.js)
 * Used by the standalone dev worker (worker/src/worker.js).
 * In Docker the canonical processor is backend/src/processors/vote.processor.js.
 * Both files are kept in sync — edits must be applied to both.
 */

// Paths resolve to backend/src/ when run from project root in development
const { withTransaction, query } = require('../../backend/src/config/database');
const { redis, KEYS, CHANNELS } = require('../../backend/src/config/redis');
const tallyService = require('../../backend/src/services/tally.service');
const { queues } = require('../../backend/src/config/queue');

/**
 * Process a vote message from the queue
 * @param {object} message - Vote message from RabbitMQ
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
  
  console.log(`🗳️ Processing vote: user=${userId.substring(0, 8)}... election=${electionId.substring(0, 8)}...`);
  
  // Execute within a transaction for atomicity
  await withTransaction(async (client) => {
    // Layer 2: Check if vote receipt already exists (idempotency check)
    const existingResult = await client.query(
      'SELECT 1 FROM vote_receipts WHERE user_id = $1 AND election_id = $2',
      [userId, electionId]
    );
    
    if (existingResult.rows.length > 0) {
      // Vote already recorded - idempotent success
      const error = new Error('Vote already recorded');
      error.code = 'ALREADY_VOTED';
      throw error;
    }
    
    // Insert vote receipt (identity side)
    await client.query(
      `INSERT INTO vote_receipts (user_id, election_id, receipt_token, ip_address, user_agent, voted_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, electionId, receiptToken, ipAddress, userAgent, submittedAt]
    );
    
    // Insert ballot (choice side - NO user_id for ballot secrecy)
    await client.query(
      `INSERT INTO ballots (election_id, candidate_id, receipt_token, cast_at)
       VALUES ($1, $2, $3, $4)`,
      [electionId, candidateId, receiptToken, submittedAt]
    );
    
    // Insert audit log entry within same transaction
    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'vote_recorded',
        'election',
        electionId,
        ipAddress,
        JSON.stringify({ messageId, candidateId }),
      ]
    );
    
    console.log(`✅ Vote written to database: receipt=${receiptToken.substring(0, 16)}...`);
  });
  
  // After successful commit, update Redis tally
  const newCount = await tallyService.incrementVote(electionId, candidateId);
  console.log(`📊 Tally updated: ${candidateName} now has ${newCount} votes`);
  
  // Publish update to Redis pub/sub for WebSocket broadcast
  await tallyService.publishTallyUpdate(electionId, candidateId, candidateName, newCount);
  
  // Get user email for confirmation
  const userResult = await query(
    'SELECT email, full_name FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length > 0) {
    const { email, full_name } = userResult.rows[0];
    
    // Get election title
    const electionResult = await query(
      'SELECT title FROM elections WHERE id = $1',
      [electionId]
    );
    
    const electionTitle = electionResult.rows[0]?.title || 'Unknown Election';
    
    // Enqueue confirmation email via BullMQ
    await queues.email.add('vote-confirmation', {
      type: 'vote-confirmation',
      userId,
      electionId,
      receiptToken,
    }).catch(() => {});
  }
  
  return { success: true, receiptToken };
}

/**
 * Sync Redis tally from database
 * Used for recovery or verification
 * @param {string} electionId - Election ID
 */
async function syncTallyFromDb(electionId) {
  const result = await query(
    `SELECT candidate_id, COUNT(*) as vote_count
     FROM ballots
     WHERE election_id = $1
     GROUP BY candidate_id`,
    [electionId]
  );
  
  await tallyService.syncFromDatabase(electionId, result.rows);
  console.log(`📊 Tally synced from database for election ${electionId}`);
}

module.exports = {
  processVote,
  syncTallyFromDb,
};
