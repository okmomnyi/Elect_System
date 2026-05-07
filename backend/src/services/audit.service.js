const { query } = require('../config/database');
const { getClientIp } = require('../utils/getClientIp');

/**
 * Audit Service
 * Handles immutable audit log entries
 */

/**
 * Audit action types
 */
const ACTIONS = {
  // Authentication
  OTP_REQUESTED: 'otp_requested',
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  PASSWORD_CHANGED: 'password_changed',
  
  // Voting
  VOTE_SUBMITTED: 'vote_submitted',
  VOTE_RECORDED: 'vote_recorded',
  VOTE_FAILED: 'vote_failed',
  
  // Election management
  ELECTION_CREATED: 'election_created',
  ELECTION_UPDATED: 'election_updated',
  ELECTION_OPENED: 'election_opened',
  ELECTION_CLOSED: 'election_closed',
  ELECTION_DELETED: 'election_deleted',
  
  // Candidate management
  CANDIDATE_CREATED: 'candidate_created',
  CANDIDATE_UPDATED: 'candidate_updated',
  CANDIDATE_DELETED: 'candidate_deleted',
  
  // User management
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  
  // Security
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
};

/**
 * Log an audit entry
 * @param {object} params - Audit entry parameters
 * @param {string} params.userId - User ID (can be null for anonymous actions)
 * @param {string} params.action - Action type (from ACTIONS enum)
 * @param {string} [params.entityType] - Type of entity affected
 * @param {string} [params.entityId] - ID of entity affected
 * @param {object} [params.metadata] - Additional action-specific data
 * @param {string} [params.ipAddress] - Client IP address
 * @param {string} [params.userAgent] - Client user agent
 * @returns {Promise<object>} Created audit log entry
 */
async function log({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = null,
  ipAddress = null,
  userAgent = null,
}) {
  const result = await query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      action,
      entityType,
      entityId,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress,
      userAgent,
    ]
  );
  
  return result.rows[0];
}

/**
 * Convenience function to log from Express request
 * @param {object} req - Express request object
 * @param {string} action - Action type
 * @param {object} [params] - Additional parameters
 */
async function logFromRequest(req, action, params = {}) {
  return log({
    userId   : req.user?.id || null,
    action,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    ...params,
  });
}

/**
 * Query audit logs with filters
 * @param {object} filters - Query filters
 * @param {string} [filters.userId] - Filter by user ID
 * @param {string} [filters.action] - Filter by action type
 * @param {string} [filters.entityType] - Filter by entity type
 * @param {string} [filters.entityId] - Filter by entity ID
 * @param {Date} [filters.startDate] - Filter from date
 * @param {Date} [filters.endDate] - Filter to date
 * @param {number} [filters.limit] - Max results
 * @param {number} [filters.offset] - Offset for pagination
 * @returns {Promise<{logs: Array, total: number}>} Audit logs and total count
 */
async function queryLogs({
  userId,
  action,
  entityType,
  entityId,
  startDate,
  endDate,
  limit = 50,
  offset = 0,
}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;
  
  if (userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(userId);
  }
  
  if (action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(action);
  }
  
  if (entityType) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(entityType);
  }
  
  if (entityId) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(entityId);
  }
  
  if (startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(startDate);
  }
  
  if (endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(endDate);
  }
  
  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(' AND ')}` 
    : '';
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM audit_log ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);
  
  // Get logs with pagination
  const logsResult = await query(
    `SELECT al.*, u.email as user_email, u.full_name as user_name
     FROM audit_log al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );
  
  return {
    logs: logsResult.rows,
    total,
    limit,
    offset,
  };
}

module.exports = {
  ACTIONS,
  log,
  logFromRequest,
  queryLogs,
};
