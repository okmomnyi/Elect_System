const { z } = require('zod');
const { query } = require('../config/database');
const { redis, KEYS } = require('../config/redis');
const voteService = require('../services/vote.service');
const tallyService = require('../services/tally.service');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

/**
 * UUID validation schema
 */
const uuidSchema = z.string().uuid();

/**
 * List elections for students - GET /api/elections
 */
const listElections = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // Get elections that are active or closed (students can't see drafts)
  const result = await query(
    `SELECT 
      e.id, e.title, e.description, e.status, 
      e.start_time, e.end_time, e.results_visible,
      COUNT(DISTINCT c.id) as candidate_count
     FROM elections e
     LEFT JOIN candidates c ON e.id = c.election_id AND c.is_active = TRUE
     WHERE e.status IN ('active', 'closed')
     GROUP BY e.id
     ORDER BY 
       CASE e.status 
         WHEN 'active' THEN 1 
         WHEN 'closed' THEN 2 
       END,
       e.start_time DESC`
  );
  
  const elections = result.rows;
  const electionIds = elections.map(e => e.id);
  
  // Get voting status for all elections
  const votingStatus = await voteService.getVotingStatus(userId, electionIds);
  
  // Combine data
  const electionsWithStatus = elections.map(election => ({
    id: election.id,
    title: election.title,
    description: election.description,
    status: election.status,
    startTime: election.start_time,
    endTime: election.end_time,
    resultsVisible: election.results_visible,
    candidateCount: parseInt(election.candidate_count, 10),
    hasVoted: votingStatus[election.id] || false,
  }));
  
  res.json({
    success: true,
    elections: electionsWithStatus,
  });
});

/**
 * Get single election details - GET /api/elections/:id
 */
const getElection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Validate UUID
  if (!uuidSchema.safeParse(id).success) {
    throw new AppError('Invalid election ID', 400, 'INVALID_ID');
  }
  
  // Get election
  const electionResult = await query(
    `SELECT 
      e.id, e.title, e.description, e.status, 
      e.start_time, e.end_time, e.results_visible
     FROM elections e
     WHERE e.id = $1 AND e.status IN ('active', 'closed')`,
    [id]
  );
  
  if (electionResult.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  const election = electionResult.rows[0];
  
  // Get candidates
  const candidatesResult = await query(
    `SELECT id, name, bio, photo_url, position, display_order
     FROM candidates
     WHERE election_id = $1 AND is_active = TRUE
     ORDER BY display_order`,
    [id]
  );
  
  // Check if user has voted
  const { voted, receiptToken } = await voteService.hasVotedDb(userId, id);
  
  // Get total vote count
  const voteCountResult = await query(
    `SELECT COUNT(*) as total FROM vote_receipts WHERE election_id = $1`,
    [id]
  );
  
  res.json({
    success: true,
    election: {
      id: election.id,
      title: election.title,
      description: election.description,
      status: election.status,
      startTime: election.start_time,
      endTime: election.end_time,
      resultsVisible: election.results_visible,
      totalVotes: parseInt(voteCountResult.rows[0].total, 10),
    },
    candidates: candidatesResult.rows.map(c => ({
      id: c.id,
      name: c.name,
      bio: c.bio,
      photoUrl: c.photo_url,
      position: c.position,
      displayOrder: c.display_order,
    })),
    userStatus: {
      hasVoted: voted,
      receiptToken,
    },
  });
});

module.exports = {
  listElections,
  getElection,
};
