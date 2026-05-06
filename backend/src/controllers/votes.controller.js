const { z } = require('zod');
const { query } = require('../config/database');
const voteService = require('../services/vote.service');
const tallyService = require('../services/tally.service');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { uuidSchema, receiptTokenSchema } = require('../utils/validators');
const { getClientIp } = require('../utils/getClientIp');

const voteSchema = z.object({
  candidateId: z.string().uuid('Invalid candidate ID'),
});

/**
 * Submit vote - POST /api/elections/:id/vote
 */
const submitVote = asyncHandler(async (req, res) => {
  const { id: electionId } = req.params;
  uuidSchema.parse(electionId);

  const { candidateId } = voteSchema.parse(req.body);

  const userId = req.user.id;

  const result = await voteService.submitVote({
    userId,
    electionId,
    candidateId,
    ipAddress : getClientIp(req),
    userAgent : req.headers['user-agent'],
  });

  res.json(result);
});

/**
 * Get election results - GET /api/elections/:id/results
 */
const getResults = asyncHandler(async (req, res) => {
  const { id: electionId } = req.params;
  uuidSchema.parse(electionId);
  const userId = req.user.id;

  const electionResult = await query(
    `SELECT id, title, status, results_visible, start_time, end_time
     FROM elections WHERE id = $1`,
    [electionId]
  );

  if (electionResult.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }

  const election = electionResult.rows[0];

  // Check if user has voted (required to view results during active election)
  const { voted } = await voteService.hasVotedDb(userId, electionId);

  if (election.status === 'active' && !voted) {
    throw new AppError('You must vote before viewing results', 403, 'MUST_VOTE_FIRST');
  }

  if (!election.results_visible && election.status !== 'closed') {
    throw new AppError('Results are not yet available', 403, 'RESULTS_NOT_AVAILABLE');
  }

  const candidatesResult = await query(
    `SELECT id, name, position FROM candidates
     WHERE election_id = $1 AND is_active = TRUE
     ORDER BY display_order`,
    [electionId]
  );

  const results = await tallyService.getFormattedResults(electionId, candidatesResult.rows);

  const voteCountResult = await query(
    `SELECT COUNT(*) as total FROM vote_receipts WHERE election_id = $1`,
    [electionId]
  );

  res.json({
    success: true,
    election: {
      id       : election.id,
      title    : election.title,
      status   : election.status,
      startTime: election.start_time,
      endTime  : election.end_time,
    },
    totalVoters: parseInt(voteCountResult.rows[0].total, 10),
    results    : results.results,
    timestamp  : results.timestamp,
  });
});

/**
 * Get vote receipt - GET /api/elections/:id/receipt/:token
 */
const getReceipt = asyncHandler(async (req, res) => {
  const { id: electionId, token: receiptToken } = req.params;
  uuidSchema.parse(electionId);
  receiptTokenSchema.parse(receiptToken);
  const userId = req.user.id;

  const receipt = await voteService.verifyReceipt(receiptToken, userId);

  if (!receipt) {
    throw new AppError('Receipt not found', 404, 'RECEIPT_NOT_FOUND');
  }

  if (receipt.electionId !== electionId) {
    throw new AppError('Receipt does not match election', 400, 'RECEIPT_MISMATCH');
  }

  res.json({ success: true, receipt });
});

/**
 * Check voting status - GET /api/elections/:id/status
 */
const getVotingStatus = asyncHandler(async (req, res) => {
  const { id: electionId } = req.params;
  uuidSchema.parse(electionId);
  const userId = req.user.id;

  const electionResult = await query(
    `SELECT id, title, status FROM elections WHERE id = $1`,
    [electionId]
  );

  if (electionResult.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }

  const { voted, receiptToken } = await voteService.hasVotedDb(userId, electionId);

  res.json({
    success     : true,
    electionId,
    status      : electionResult.rows[0].status,
    hasVoted    : voted,
    receiptToken: voted ? receiptToken : null,
  });
});

module.exports = {
  submitVote,
  getResults,
  getReceipt,
  getVotingStatus,
};
