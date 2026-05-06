const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../middleware/requireRole');
const { rateLimitApi } = require('../middleware/rateLimiter');

/**
 * Admin Routes
 * All routes require admin authentication
 */

// Apply authentication and admin role check to all routes
router.use(authenticate);
router.use(requireAdmin);
router.use(rateLimitApi);

// ==================
// Election Management
// ==================

// List all elections
router.get('/elections', adminController.listElections);

// Create new election
router.post('/elections', adminController.createElection);

// Get single election
router.get('/elections/:id', adminController.getElection);

// Update election
router.put('/elections/:id', adminController.updateElection);

// Open election (start voting)
router.post('/elections/:id/open', adminController.openElection);

// Close election (end voting)
router.post('/elections/:id/close', adminController.closeElection);

// Delete election (super_admin only)
router.delete('/elections/:id', requireSuperAdmin, adminController.deleteElection);

// Get election analytics
router.get('/elections/:id/analytics', adminController.getAnalytics);

// ==================
// Candidate Management
// ==================

// Add candidate to election
router.post('/elections/:id/candidates', adminController.addCandidate);

// Update candidate
router.put('/candidates/:id', adminController.updateCandidate);

// Delete candidate
router.delete('/candidates/:id', adminController.deleteCandidate);

// ==================
// Audit & Users (super_admin only)
// ==================

// Get audit log
router.get('/audit-log', requireSuperAdmin, adminController.getAuditLog);

// List users
router.get('/users', requireSuperAdmin, adminController.listUsers);

module.exports = router;
