const { redis, KEYS, CHANNELS } = require('../config/redis');
const { query } = require('../config/database');

/**
 * Tally Service
 * Handles real-time vote tallying using Redis
 */

/**
 * Initialize tally counters for an election
 * @param {string} electionId - Election ID
 * @param {Array} candidateIds - Array of candidate IDs
 */
async function initializeTally(electionId, candidateIds) {
  const pipeline = redis.multi();

  for (const candidateId of candidateIds) {
    const key = KEYS.tally(electionId, candidateId);
    pipeline.setnx(key, 0); // Set only if not exists
  }

  // Keep a Set of all candidate IDs for this election so we can retrieve the
  // full tally without an O(N) KEYS scan (see socket.js getCurrentTally).
  if (candidateIds.length > 0) {
    pipeline.sadd(KEYS.tallyCandidates(electionId), ...candidateIds);
  }

  await pipeline.exec();
  console.log(`📊 Tally: Initialized counters for election ${electionId} with ${candidateIds.length} candidates`);
}

/**
 * Increment vote count for a candidate
 * @param {string} electionId - Election ID
 * @param {string} candidateId - Candidate ID
 * @returns {Promise<number>} New vote count
 */
async function incrementVote(electionId, candidateId) {
  const key = KEYS.tally(electionId, candidateId);
  const newCount = await redis.incr(key);
  return newCount;
}

/**
 * Get current tally for a single candidate
 * @param {string} electionId - Election ID
 * @param {string} candidateId - Candidate ID
 * @returns {Promise<number>} Current vote count
 */
async function getCandidateTally(electionId, candidateId) {
  const key = KEYS.tally(electionId, candidateId);
  const count = await redis.get(key);
  return parseInt(count || '0', 10);
}

/**
 * Get tally for all candidates in an election
 * @param {string} electionId - Election ID
 * @param {Array} candidateIds - Array of candidate IDs
 * @returns {Promise<Object>} Map of candidateId -> vote count
 */
async function getElectionTally(electionId, candidateIds) {
  if (!candidateIds || candidateIds.length === 0) {
    return {};
  }
  
  const keys = candidateIds.map(id => KEYS.tally(electionId, id));
  const values = await redis.mget(keys);
  
  const tally = {};
  candidateIds.forEach((id, index) => {
    tally[id] = parseInt(values[index] || '0', 10);
  });
  
  return tally;
}

/**
 * Get formatted results for an election
 * @param {string} electionId - Election ID
 * @param {Array} candidates - Array of candidate objects with id, name
 * @returns {Promise<Array>} Sorted results array
 */
async function getFormattedResults(electionId, candidates) {
  // Source of truth is the `ballots` table, NOT the Redis tally. Redis powers
  // live socket increments but can legitimately be empty (Redis restart/flush,
  // or ballots created outside the live path such as seeds), which would make
  // the official results endpoint report 0. Counting from the DB guarantees the
  // returned totals are always correct.
  const countResult = await query(
    `SELECT candidate_id, COUNT(*)::int AS votes
       FROM ballots
      WHERE election_id = $1
      GROUP BY candidate_id`,
    [electionId]
  );

  const tally = {};
  for (const row of countResult.rows) {
    tally[row.candidate_id] = row.votes;
  }

  const totalVotes = Object.values(tally).reduce((sum, count) => sum + count, 0);

  const results = candidates.map(candidate => ({
    candidateId: candidate.id,
    candidateName: candidate.name,
    position: candidate.position,
    votes: tally[candidate.id] || 0,
    percentage: totalVotes > 0
      ? Math.round(((tally[candidate.id] || 0) / totalVotes) * 10000) / 100
      : 0,
  }));

  // Sort by vote count descending
  results.sort((a, b) => b.votes - a.votes);

  return {
    electionId,
    totalVotes,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Publish tally update to Redis pub/sub channel
 * @param {string} electionId - Election ID
 * @param {string} candidateId - Candidate that received vote
 * @param {string} candidateName - Candidate name
 * @param {number} totalVotes - New total votes for this candidate
 */
async function publishTallyUpdate(electionId, candidateId, candidateName, totalVotes) {
  const channel = CHANNELS.electionUpdates(electionId);
  const message = JSON.stringify({
    type: 'vote_update',
    candidateId,
    candidateName,
    totalVotes,
    timestamp: new Date().toISOString(),
  });
  
  await redis.publish(channel, message);
  console.log(`📊 Tally: Published update for election ${electionId} - ${candidateName}: ${totalVotes}`);
}

/**
 * Delete tally data for an election
 * @param {string} electionId - Election ID
 * @param {Array} candidateIds - Array of candidate IDs
 */
async function deleteTally(electionId, candidateIds) {
  const keys = candidateIds.map(id => KEYS.tally(electionId, id));
  // Also remove the candidate index set
  keys.push(KEYS.tallyCandidates(electionId));

  await redis.del(...keys);
  console.log(`📊 Tally: Deleted counters for election ${electionId}`);
}

/**
 * Sync Redis tally with database (for recovery/verification)
 * @param {string} electionId - Election ID
 * @param {Array} dbResults - Results from database query
 */
async function syncFromDatabase(electionId, dbResults) {
  const pipeline = redis.multi();
  
  for (const result of dbResults) {
    const key = KEYS.tally(electionId, result.candidate_id);
    pipeline.set(key, result.vote_count);
  }
  
  await pipeline.exec();
  console.log(`📊 Tally: Synced ${dbResults.length} candidates from database for election ${electionId}`);
}

module.exports = {
  initializeTally,
  incrementVote,
  getCandidateTally,
  getElectionTally,
  getFormattedResults,
  publishTallyUpdate,
  deleteTally,
  syncFromDatabase,
};
