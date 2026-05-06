const crypto = require('crypto');
const { redis, KEYS, TTL } = require('../config/redis');
const { query } = require('../config/database');
const { publishVote } = require('../config/rabbitmq');
const auditService = require('./audit.service');
const tallyService = require('./tally.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * Vote Service
 * Handles vote submission, validation, and queue publishing
 */

/**
 * Generate a cryptographic receipt token
 * @returns {string} 64-character hex token
 */
function generateReceiptToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Check if user has already voted in election (Redis layer - fast)
 * @param {string} userId - User ID
 * @param {string} electionId - Election ID
 * @returns {Promise<boolean>} True if already voted
 */
async function hasVotedRedis(userId, electionId) {
  const key = KEYS.voted(userId, electionId);
  const result = await redis.get(key);
  return result === '1';
}

/**
 * Mark user as voted in Redis
 * @param {string} userId - User ID
 * @param {string} electionId - Election ID
 */
async function markVotedRedis(userId, electionId) {
  const key = KEYS.voted(userId, electionId);
  await redis.set(key, '1', 'EX', TTL.VOTED);
}

/**
 * Get election status from Redis cache
 * @param {string} electionId - Election ID
 * @returns {Promise<string|null>} Election status or null
 */
async function getElectionStatus(electionId) {
  const key = KEYS.electionStatus(electionId);
  return redis.get(key);
}

/**
 * Validate that candidate belongs to election and is active
 * @param {string} candidateId - Candidate ID
 * @param {string} electionId - Election ID
 * @returns {Promise<object|null>} Candidate object or null
 */
async function validateCandidate(candidateId, electionId) {
  const result = await query(
    `SELECT id, name, election_id 
     FROM candidates 
     WHERE id = $1 AND election_id = $2 AND is_active = TRUE`,
    [candidateId, electionId]
  );
  
  return result.rows[0] || null;
}

/**
 * Submit a vote
 * @param {object} params - Vote parameters
 * @param {string} params.userId - Voter's user ID
 * @param {string} params.electionId - Election ID
 * @param {string} params.candidateId - Candidate ID
 * @param {string} params.ipAddress - Voter's IP address
 * @param {string} params.userAgent - Voter's user agent
 * @returns {Promise<{success: boolean, receiptToken: string}>} Result
 */
async function submitVote({ userId, electionId, candidateId, ipAddress, userAgent }) {
  // Layer 1: Redis check (< 1ms)
  const status = await getElectionStatus(electionId);
  if (status !== 'active') {
    throw new AppError('Election is not currently active', 400, 'ELECTION_NOT_ACTIVE');
  }
  
  // Layer 1b: Redis voted check (< 1ms)
  const alreadyVoted = await hasVotedRedis(userId, electionId);
  if (alreadyVoted) {
    throw new AppError('You have already voted in this election', 409, 'ALREADY_VOTED');
  }
  
  // Validate candidate exists and is active
  const candidate = await validateCandidate(candidateId, electionId);
  if (!candidate) {
    throw new AppError('Invalid candidate for this election', 400, 'INVALID_CANDIDATE');
  }
  
  // Generate receipt token
  const receiptToken = generateReceiptToken();
  const messageId = crypto.randomUUID();
  
  // Publish to RabbitMQ
  const voteMessage = {
    messageId,
    userId,
    electionId,
    candidateId,
    candidateName: candidate.name,
    receiptToken,
    ipAddress,
    userAgent,
    submittedAt: new Date().toISOString(),
    idempotencyKey: `${userId}:${electionId}`,
  };
  
  const published = await publishVote(voteMessage);

  if (!published) {
    throw new AppError('Failed to submit vote. Please try again.', 503, 'QUEUE_ERROR');
  }

  // NOTE: Redis voted flag is set in vote.processor.js *after* the DB transaction
  // commits. Setting it here (before the DB write) would cause the user to appear
  // as "voted" even if the processor permanently fails and the vote is never recorded.

  // Log audit event
  await auditService.log({
    userId,
    action: auditService.ACTIONS.VOTE_SUBMITTED,
    entityType: 'election',
    entityId: electionId,
    metadata: { candidateId },
    ipAddress,
    userAgent,
  });
  
  return {
    success: true,
    receiptToken,
    message: 'Your vote has been submitted successfully',
  };
}

/**
 * Verify a vote receipt
 * @param {string} receiptToken - Receipt token
 * @param {string} userId - User ID for verification
 * @returns {Promise<object|null>} Receipt details or null
 */
async function verifyReceipt(receiptToken, userId) {
  // Verify the receipt belongs to the user
  const receiptResult = await query(
    `SELECT vr.id, vr.election_id, vr.voted_at, e.title as election_title
     FROM vote_receipts vr
     JOIN elections e ON vr.election_id = e.id
     WHERE vr.receipt_token = $1 AND vr.user_id = $2`,
    [receiptToken, userId]
  );
  
  if (receiptResult.rows.length === 0) {
    return null;
  }
  
  const receipt = receiptResult.rows[0];
  
  // Get ballot info (without revealing identity)
  const ballotResult = await query(
    `SELECT b.cast_at, c.name as candidate_name, c.position
     FROM ballots b
     JOIN candidates c ON b.candidate_id = c.id
     WHERE b.receipt_token = $1`,
    [receiptToken]
  );
  
  if (ballotResult.rows.length === 0) {
    return {
      ...receipt,
      status: 'processing',
      message: 'Your vote is being processed',
    };
  }
  
  return {
    electionId: receipt.election_id,
    electionTitle: receipt.election_title,
    votedAt: receipt.voted_at,
    candidateName: ballotResult.rows[0].candidate_name,
    candidatePosition: ballotResult.rows[0].position,
    status: 'confirmed',
    receiptToken,
  };
}

/**
 * Check if user has voted in election (database layer - authoritative)
 * @param {string} userId - User ID
 * @param {string} electionId - Election ID
 * @returns {Promise<{voted: boolean, receiptToken: string|null}>}
 */
async function hasVotedDb(userId, electionId) {
  const result = await query(
    `SELECT receipt_token FROM vote_receipts 
     WHERE user_id = $1 AND election_id = $2`,
    [userId, electionId]
  );
  
  if (result.rows.length > 0) {
    return { voted: true, receiptToken: result.rows[0].receipt_token };
  }
  
  return { voted: false, receiptToken: null };
}

/**
 * Get user's voting status for multiple elections
 * @param {string} userId - User ID
 * @param {Array<string>} electionIds - Array of election IDs
 * @returns {Promise<Object>} Map of electionId -> boolean
 */
async function getVotingStatus(userId, electionIds) {
  if (!electionIds.length) return {};
  
  const result = await query(
    `SELECT election_id FROM vote_receipts 
     WHERE user_id = $1 AND election_id = ANY($2)`,
    [userId, electionIds]
  );
  
  const status = {};
  electionIds.forEach(id => {
    status[id] = result.rows.some(row => row.election_id === id);
  });
  
  return status;
}

module.exports = {
  generateReceiptToken,
  hasVotedRedis,
  markVotedRedis,
  getElectionStatus,
  validateCandidate,
  submitVote,
  verifyReceipt,
  hasVotedDb,
  getVotingStatus,
};
