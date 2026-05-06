const express = require('express');
const router = express.Router();
const electionsController = require('../controllers/elections.controller');
const votesController = require('../controllers/votes.controller');
const { authenticate } = require('../middleware/auth');
const { rateLimitApi, rateLimitVote } = require('../middleware/rateLimiter');

/**
 * Election Routes (Student-facing)
 * All routes require authentication
 */

// Apply authentication to all routes
router.use(authenticate);
router.use(rateLimitApi);

// List all active/closed elections
router.get('/', electionsController.listElections);

// Get single election details
router.get('/:id', electionsController.getElection);

// Submit vote — stricter rate limit on top of the base API limit
router.post('/:id/vote', rateLimitVote, votesController.submitVote);

// Get voting status for an election
router.get('/:id/status', votesController.getVotingStatus);

// Get election results
router.get('/:id/results', votesController.getResults);

// Get vote receipt
router.get('/:id/receipt/:token', votesController.getReceipt);

module.exports = router;
