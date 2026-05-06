const { z } = require('zod');
const { query, withTransaction } = require('../config/database');
const { redis, KEYS } = require('../config/redis');
const tallyService = require('../services/tally.service');
const auditService = require('../services/audit.service');
const { queues } = require('../config/queue');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { uuidSchema } = require('../utils/validators');

/**
 * Create election schema
 */
const createElectionSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  candidates: z.array(z.object({
    name: z.string().min(1).max(255),
    bio: z.string().max(1000).optional(),
    position: z.string().max(255).optional(),
    photoUrl: z.string().url().max(500).refine(u => u.startsWith('https://'), 'Photo URL must use HTTPS').optional(),
    displayOrder: z.number().int().optional(),
  })).min(2, 'At least 2 candidates required'),
}).refine(data => {
  if (data.startTime && data.endTime) {
    return new Date(data.endTime) > new Date(data.startTime);
  }
  return true;
}, { message: 'End time must be after start time' });

/**
 * Update election schema
 */
const updateElectionSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

/**
 * Candidate schemas
 */
const safePhotoUrl = z.string()
  .url('Invalid photo URL')
  .max(500)
  .refine(
    (url) => url.startsWith('https://'),
    'Photo URL must use HTTPS'
  )
  .optional();

const addCandidateSchema = z.object({
  name: z.string().min(1).max(255),
  bio: z.string().max(1000).optional(),
  position: z.string().max(255).optional(),
  photoUrl: safePhotoUrl,
  displayOrder: z.number().int().nonnegative().optional(),
});

const updateCandidateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  bio: z.string().max(1000).optional(),
  position: z.string().max(255).optional(),
  photoUrl: safePhotoUrl,
  displayOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

// uuidSchema imported from utils/validators — shared across controllers

/**
 * Query param schemas
 */
const listElectionsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'closed']).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const listUsersQuerySchema = z.object({
  role: z.enum(['student', 'admin', 'super_admin']).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

/**
 * List all elections (admin) - GET /api/admin/elections
 */
const listElections = asyncHandler(async (req, res) => {
  const parsed = listElectionsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  const { status, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  const params = [];
  
  if (status) {
    whereClause = 'WHERE e.status = $1';
    params.push(status);
  }
  
  const countResult = await query(
    `SELECT COUNT(*) FROM elections e ${whereClause}`,
    params
  );
  
  const result = await query(
    `SELECT 
      e.id, e.title, e.description, e.status, 
      e.start_time, e.end_time, e.results_visible,
      e.created_at, e.updated_at,
      u.full_name as created_by_name,
      COUNT(DISTINCT c.id) as candidate_count,
      COUNT(DISTINCT vr.id) as vote_count
     FROM elections e
     LEFT JOIN users u ON e.created_by = u.id
     LEFT JOIN candidates c ON e.id = c.election_id AND c.is_active = TRUE
     LEFT JOIN vote_receipts vr ON e.id = vr.election_id
     ${whereClause}
     GROUP BY e.id, u.full_name
     ORDER BY e.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  
  res.json({
    success: true,
    elections: result.rows,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: parseInt(countResult.rows[0].count, 10),
    },
  });
});

/**
 * Create election - POST /api/admin/elections
 */
const createElection = asyncHandler(async (req, res) => {
  const data = createElectionSchema.parse(req.body);
  const userId = req.user.id;
  
  const result = await withTransaction(async (client) => {
    // Create election
    const electionResult = await client.query(
      `INSERT INTO elections (title, description, start_time, end_time, created_by, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING *`,
      [data.title, data.description, data.startTime, data.endTime, userId]
    );
    
    const election = electionResult.rows[0];
    
    // Create candidates
    const candidateValues = data.candidates.map((c, i) =>
      `($1, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5}, $${i * 5 + 6})`
    ).join(', ');

    const candidateParams = [election.id];
    data.candidates.forEach((c, i) => {
      candidateParams.push(c.name, c.bio || null, c.position || null, c.photoUrl || null, c.displayOrder ?? i);
    });

    const candidatesResult = await client.query(
      `INSERT INTO candidates (election_id, name, bio, position, photo_url, display_order)
       VALUES ${candidateValues}
       RETURNING *`,
      candidateParams
    );
    
    return { election, candidates: candidatesResult.rows };
  });
  
  // Set election status in Redis
  await redis.set(KEYS.electionStatus(result.election.id), 'draft');
  
  // Initialize tally counters
  const candidateIds = result.candidates.map(c => c.id);
  await tallyService.initializeTally(result.election.id, candidateIds);
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.ELECTION_CREATED, {
    entityType: 'election',
    entityId: result.election.id,
    metadata: { title: data.title, candidateCount: data.candidates.length },
  });
  
  res.status(201).json({
    success: true,
    election: result.election,
    candidates: result.candidates,
  });
});

/**
 * Get election details (admin) - GET /api/admin/elections/:id
 */
const getElection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);

  const electionResult = await query(
    `SELECT e.*, u.full_name as created_by_name
     FROM elections e
     LEFT JOIN users u ON e.created_by = u.id
     WHERE e.id = $1`,
    [id]
  );
  
  if (electionResult.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  const candidatesResult = await query(
    `SELECT * FROM candidates WHERE election_id = $1 ORDER BY display_order`,
    [id]
  );
  
  const voteCountResult = await query(
    `SELECT COUNT(*) as total FROM vote_receipts WHERE election_id = $1`,
    [id]
  );
  
  res.json({
    success: true,
    election: electionResult.rows[0],
    candidates: candidatesResult.rows,
    voteCount: parseInt(voteCountResult.rows[0].total, 10),
  });
});

/**
 * Update election - PUT /api/admin/elections/:id
 */
const updateElection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);
  const data = updateElectionSchema.parse(req.body);

  // Check election exists and is draft
  const existing = await query(
    'SELECT status FROM elections WHERE id = $1',
    [id]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  if (existing.rows[0].status !== 'draft') {
    throw new AppError('Can only update draft elections', 400, 'ELECTION_NOT_DRAFT');
  }
  
  const updates = [];
  const params = [];
  let paramIndex = 1;
  
  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(data.description);
  }
  if (data.startTime !== undefined) {
    updates.push(`start_time = $${paramIndex++}`);
    params.push(data.startTime);
  }
  if (data.endTime !== undefined) {
    updates.push(`end_time = $${paramIndex++}`);
    params.push(data.endTime);
  }
  
  if (updates.length === 0) {
    throw new AppError('No fields to update', 400, 'NO_UPDATES');
  }
  
  params.push(id);
  
  const result = await query(
    `UPDATE elections SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.ELECTION_UPDATED, {
    entityType: 'election',
    entityId: id,
    metadata: data,
  });
  
  res.json({
    success: true,
    election: result.rows[0],
  });
});

/**
 * Open election - POST /api/admin/elections/:id/open
 */
const openElection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);

  // Check election exists and is draft
  const existing = await query(
    'SELECT * FROM elections WHERE id = $1',
    [id]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  if (existing.rows[0].status !== 'draft') {
    throw new AppError('Can only open draft elections', 400, 'ELECTION_NOT_DRAFT');
  }
  
  // Verify minimum candidates
  const candidateCount = await query(
    'SELECT COUNT(*) FROM candidates WHERE election_id = $1 AND is_active = TRUE',
    [id]
  );
  
  if (parseInt(candidateCount.rows[0].count, 10) < 2) {
    throw new AppError('Election must have at least 2 active candidates', 400, 'INSUFFICIENT_CANDIDATES');
  }
  
  // Update election
  const result = await query(
    `UPDATE elections SET 
      status = 'active', 
      start_time = COALESCE(start_time, NOW()),
      results_visible = FALSE,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  
  const election = result.rows[0];
  
  // Update Redis
  await redis.set(KEYS.electionStatus(id), 'active');
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.ELECTION_OPENED, {
    entityType: 'election',
    entityId: id,
    metadata: { title: election.title },
  });
  
  // Enqueue one email job per active student (addBulk = single Redis pipeline call).
  // jobId deduplication: if the job is retried, the same jobId prevents a duplicate send.
  const studentsResult = await query(
    `SELECT id FROM users
      WHERE role = 'student' AND is_active = TRUE AND email_verified = TRUE`,
    []
  );

  if (studentsResult.rows.length > 0) {
    queues.emailDispatch
      .addBulk(
        studentsResult.rows.map((student) => ({
          name: 'send-election-opened',
          data: { type: 'election-opened', userId: student.id, electionId: id },
          opts: {
            jobId  : `election-opened:${id}:${student.id}`,
            attempts: 3,
            backoff : { type: 'exponential', delay: 2000 },
          },
        }))
      )
      .catch((err) =>
        console.error('Failed to enqueue election-opened emails:', err.message)
      );
  }

  // Emit socket event (if io is available)
  if (req.app.get('io')) {
    req.app.get('io').to('admin').emit('election_opened', {
      electionId: id,
      title: election.title,
    });
  }
  
  res.json({
    success: true,
    election,
  });
});

/**
 * Close election - POST /api/admin/elections/:id/close
 */
const closeElection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);

  // Check election exists and is active
  const existing = await query(
    'SELECT * FROM elections WHERE id = $1',
    [id]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  if (existing.rows[0].status !== 'active') {
    throw new AppError('Can only close active elections', 400, 'ELECTION_NOT_ACTIVE');
  }
  
  // Update election
  const result = await query(
    `UPDATE elections SET 
      status = 'closed', 
      end_time = NOW(),
      results_visible = TRUE,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  
  const election = result.rows[0];
  
  // Update Redis
  await redis.set(KEYS.electionStatus(id), 'closed');
  
  // Get final results from database (authoritative)
  const resultsQuery = await query(
    `SELECT c.id, c.name, c.position, COUNT(b.id) as vote_count
     FROM candidates c
     LEFT JOIN ballots b ON c.id = b.candidate_id
     WHERE c.election_id = $1 AND c.is_active = TRUE
     GROUP BY c.id
     ORDER BY vote_count DESC`,
    [id]
  );
  
  const results = resultsQuery.rows;
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.ELECTION_CLOSED, {
    entityType: 'election',
    entityId: id,
    metadata: { title: election.title, results },
  });
  
  // Enqueue one email job per admin / super_admin (addBulk = single Redis pipeline call).
  const adminsResult = await query(
    `SELECT id FROM users
      WHERE role IN ('admin', 'super_admin') AND is_active = TRUE`,
    []
  );

  if (adminsResult.rows.length > 0) {
    queues.emailDispatch
      .addBulk(
        adminsResult.rows.map((admin) => ({
          name: 'send-election-closed',
          data: { type: 'election-closed', userId: admin.id, electionId: id },
          opts: {
            attempts: 3,
            backoff  : { type: 'exponential', delay: 2000 },
          },
        }))
      )
      .catch((err) =>
        console.error('Failed to enqueue election-closed emails:', err.message)
      );
  }

  // Emit socket event
  if (req.app.get('io')) {
    req.app.get('io').to(`election:${id}`).emit('election_closed', {
      electionId: id,
      title: election.title,
      results,
    });
  }
  
  res.json({
    success: true,
    election,
    results,
  });
});

/**
 * Delete election - DELETE /api/admin/elections/:id
 */
const deleteElection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);

  // Check election exists and is draft
  const existing = await query(
    'SELECT status, title FROM elections WHERE id = $1',
    [id]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  if (existing.rows[0].status !== 'draft') {
    throw new AppError('Can only delete draft elections', 400, 'ELECTION_NOT_DRAFT');
  }
  
  await withTransaction(async (client) => {
    // Delete candidates first
    await client.query('DELETE FROM candidates WHERE election_id = $1', [id]);
    // Delete election
    await client.query('DELETE FROM elections WHERE id = $1', [id]);
  });
  
  // Clean up Redis
  await redis.del(KEYS.electionStatus(id));
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.ELECTION_DELETED, {
    entityType: 'election',
    entityId: id,
    metadata: { title: existing.rows[0].title },
  });
  
  res.json({
    success: true,
    message: 'Election deleted successfully',
  });
});

/**
 * Get election analytics - GET /api/admin/elections/:id/analytics
 */
const getAnalytics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);

  // Get election
  const electionResult = await query(
    'SELECT id, title, status, start_time FROM elections WHERE id = $1',
    [id]
  );
  
  if (electionResult.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }
  
  // Get candidates and their vote counts
  const candidatesResult = await query(
    `SELECT c.id, c.name, c.position, COUNT(b.id) as vote_count
     FROM candidates c
     LEFT JOIN ballots b ON c.id = b.candidate_id
     WHERE c.election_id = $1 AND c.is_active = TRUE
     GROUP BY c.id
     ORDER BY vote_count DESC`,
    [id]
  );
  
  // Get total votes
  const totalVotesResult = await query(
    'SELECT COUNT(*) FROM vote_receipts WHERE election_id = $1',
    [id]
  );
  
  // Get hourly vote distribution (last 24 hours)
  const hourlyResult = await query(
    `SELECT 
      DATE_TRUNC('hour', voted_at) as hour,
      COUNT(*) as count
     FROM vote_receipts 
     WHERE election_id = $1 
       AND voted_at > NOW() - INTERVAL '24 hours'
     GROUP BY DATE_TRUNC('hour', voted_at)
     ORDER BY hour`,
    [id]
  );
  
  res.json({
    success: true,
    election: electionResult.rows[0],
    totalVotes: parseInt(totalVotesResult.rows[0].count, 10),
    candidates: candidatesResult.rows,
    hourlyVotes: hourlyResult.rows,
  });
});

/**
 * Add candidate to election - POST /api/admin/elections/:id/candidates
 */
const addCandidate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);
  const parsed = addCandidateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  const { name, bio, position, photoUrl, displayOrder } = parsed.data;

  // Check election exists and is draft
  const existing = await query(
    'SELECT status FROM elections WHERE id = $1',
    [id]
  );

  if (existing.rows.length === 0) {
    throw new AppError('Election not found', 404, 'ELECTION_NOT_FOUND');
  }

  if (existing.rows[0].status !== 'draft') {
    throw new AppError('Can only add candidates to draft elections', 400, 'ELECTION_NOT_DRAFT');
  }

  const result = await query(
    `INSERT INTO candidates (election_id, name, bio, position, photo_url, display_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, name, bio, position, photoUrl || null, displayOrder || 0]
  );
  
  // Initialize tally for new candidate
  await tallyService.initializeTally(id, [result.rows[0].id]);
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.CANDIDATE_CREATED, {
    entityType: 'candidate',
    entityId: result.rows[0].id,
    metadata: { electionId: id, name },
  });
  
  res.status(201).json({
    success: true,
    candidate: result.rows[0],
  });
});

/**
 * Update candidate - PUT /api/admin/candidates/:id
 */
const updateCandidate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);
  const parsed = updateCandidateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  const { name, bio, position, photoUrl, displayOrder, isActive } = parsed.data;

  // Get candidate and check election status
  const existing = await query(
    `SELECT c.*, e.status as election_status
     FROM candidates c
     JOIN elections e ON c.election_id = e.id
     WHERE c.id = $1`,
    [id]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Candidate not found', 404, 'CANDIDATE_NOT_FOUND');
  }
  
  if (existing.rows[0].election_status !== 'draft') {
    throw new AppError('Can only update candidates in draft elections', 400, 'ELECTION_NOT_DRAFT');
  }
  
  const updates = [];
  const params = [];
  let paramIndex = 1;
  
  if (name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    params.push(name);
  }
  if (bio !== undefined) {
    updates.push(`bio = $${paramIndex++}`);
    params.push(bio);
  }
  if (position !== undefined) {
    updates.push(`position = $${paramIndex++}`);
    params.push(position);
  }
  if (photoUrl !== undefined) {
    updates.push(`photo_url = $${paramIndex++}`);
    params.push(photoUrl);
  }
  if (displayOrder !== undefined) {
    updates.push(`display_order = $${paramIndex++}`);
    params.push(displayOrder);
  }
  if (isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    params.push(isActive);
  }
  
  if (updates.length === 0) {
    throw new AppError('No fields to update', 400, 'NO_UPDATES');
  }
  
  params.push(id);
  
  const result = await query(
    `UPDATE candidates SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    params
  );
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.CANDIDATE_UPDATED, {
    entityType: 'candidate',
    entityId: id,
  });
  
  res.json({
    success: true,
    candidate: result.rows[0],
  });
});

/**
 * Delete candidate - DELETE /api/admin/candidates/:id
 */
const deleteCandidate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  uuidSchema.parse(id);

  // Get candidate and check election status
  const existing = await query(
    `SELECT c.*, e.status as election_status
     FROM candidates c
     JOIN elections e ON c.election_id = e.id
     WHERE c.id = $1`,
    [id]
  );
  
  if (existing.rows.length === 0) {
    throw new AppError('Candidate not found', 404, 'CANDIDATE_NOT_FOUND');
  }
  
  if (existing.rows[0].election_status !== 'draft') {
    throw new AppError('Can only delete candidates from draft elections', 400, 'ELECTION_NOT_DRAFT');
  }
  
  await query('DELETE FROM candidates WHERE id = $1', [id]);
  
  // Audit log
  await auditService.logFromRequest(req, auditService.ACTIONS.CANDIDATE_DELETED, {
    entityType: 'candidate',
    entityId: id,
    metadata: { name: existing.rows[0].name },
  });
  
  res.json({
    success: true,
    message: 'Candidate deleted successfully',
  });
});

/**
 * Get audit logs - GET /api/admin/audit-log
 */
const getAuditLog = asyncHandler(async (req, res) => {
  const parsed = auditLogQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  const { userId, action, startDate, endDate, page, limit } = parsed.data;

  const result = await auditService.queryLogs({
    userId,
    action,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit,
    offset: (page - 1) * limit,
  });
  
  res.json({
    success: true,
    ...result,
    page: parseInt(page, 10),
  });
});

/**
 * List users - GET /api/admin/users
 */
const listUsers = asyncHandler(async (req, res) => {
  const parsed = listUsersQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(parsed.error.errors[0].message, 400, 'VALIDATION_ERROR');
  const { role, page, limit } = parsed.data;
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  const params = [];
  
  if (role) {
    whereClause = 'WHERE role = $1';
    params.push(role);
  }
  
  const countResult = await query(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    params
  );
  
  const result = await query(
    `SELECT id, email, full_name, student_id, role, email_verified, is_active, 
            created_at, last_login_at
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  
  res.json({
    success: true,
    users: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
    },
  });
});

module.exports = {
  listElections,
  createElection,
  getElection,
  updateElection,
  openElection,
  closeElection,
  deleteElection,
  getAnalytics,
  addCandidate,
  updateCandidate,
  deleteCandidate,
  getAuditLog,
  listUsers,
};
