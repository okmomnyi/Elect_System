const { z } = require('zod');
const { query, withTransaction } = require('../config/database');
const { redis, KEYS, TTL } = require('../config/redis');
const jwtService = require('../services/jwt.service');
const otpService = require('../services/otp.service');
const auditService = require('../services/audit.service');
const emailService = require('../services/email.service');
const { hashPassword, verifyPassword, generateResetToken, hashResetToken } = require('../utils/password');
const env = require('../config/env');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { getClientIp } = require('../utils/getClientIp');

const requestOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be 6 numeric digits'),
  fullName: z.string().min(2).max(255).optional(),
  studentId: z.string().min(1).max(20).regex(/^[A-Za-z0-9/_-]+$/, 'Invalid student ID format').optional(),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2).max(255, 'Name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  studentId: z.string().min(1).max(20).regex(/^[A-Za-z0-9/_-]+$/, 'Invalid student ID format').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Request OTP - POST /api/auth/request-otp
 * Legacy / OTP-only flow (kept for backward compatibility)
 */
const requestOtp = asyncHandler(async (req, res) => {
  const { email } = requestOtpSchema.parse(req.body);

  if (!email.endsWith(env.ALLOWED_EMAIL_DOMAIN)) {
    throw new AppError(
      `Only ${env.ALLOWED_EMAIL_DOMAIN} email addresses are allowed`,
      400,
      'INVALID_EMAIL_DOMAIN'
    );
  }

  if (await otpService.isLockedOut(email)) {
    throw new AppError('Too many OTP requests. Please wait 15 minutes.', 429, 'OTP_RATE_LIMITED');
  }

  const userResult = await query(
    'SELECT full_name, is_active FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length > 0 && userResult.rows[0].is_active === false) {
    throw new AppError(
      'Unable to process your request. Please contact support if the issue persists.',
      403,
      'REQUEST_REJECTED'
    );
  }

  const fullName = userResult.rows[0]?.full_name;
  const otp = otpService.generateOtp();
  await otpService.storeOtp(email, otp);

  if (env.NODE_ENV === 'development') {
    console.log(`\n🔑 [DEV OTP] ${email} → ${otp}\n`);
  }

  const sent = await emailService.sendOtpEmail(email, otp, fullName);
  if (!sent && env.NODE_ENV !== 'development') {
    throw new AppError('Failed to send OTP email. Please try again in a moment.', 503, 'EMAIL_UNAVAILABLE');
  }

  await query(
    `INSERT INTO verification_log (email, ip_address) VALUES ($1, $2)`,
    [email, getClientIp(req)]
  );

  await auditService.logFromRequest(req, auditService.ACTIONS.OTP_REQUESTED, {
    metadata: { email },
  });

  res.json({ success: true, message: 'OTP sent to your university email' });
});

/**
 * Register - POST /api/auth/register
 * Step 1 of 2FA: create account with password, send OTP for email verification
 */
const register = asyncHandler(async (req, res) => {
  const { email, fullName, password, studentId } = registerSchema.parse(req.body);

  if (!email.endsWith(env.ALLOWED_EMAIL_DOMAIN)) {
    throw new AppError(
      `Only ${env.ALLOWED_EMAIL_DOMAIN} email addresses are allowed`,
      400,
      'INVALID_EMAIL_DOMAIN'
    );
  }

  const existing = await query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0 && existing.rows[0].password_hash) {
    throw new AppError('An account with this email already exists. Please log in.', 409, 'USER_EXISTS');
  }

  if (await otpService.isLockedOut(email)) {
    throw new AppError('Too many attempts. Please wait 15 minutes.', 429, 'OTP_RATE_LIMITED');
  }

  const passwordHash = await hashPassword(password);

  // Store registration data in Redis until OTP verified
  await redis.set(
    `reg:${email}`,
    JSON.stringify({ fullName, studentId: studentId || null, passwordHash }),
    'EX',
    900
  );

  const otp = otpService.generateOtp();
  await otpService.storeOtp(email, otp);

  if (env.NODE_ENV === 'development') {
    console.log(`\n🔑 [DEV REGISTER OTP] ${email} → ${otp}\n`);
  }

  const sent = await emailService.sendOtpEmail(email, otp, fullName);
  if (!sent && env.NODE_ENV !== 'development') {
    throw new AppError('Failed to send verification email. Please try again.', 503, 'EMAIL_UNAVAILABLE');
  }

  await query(
    `INSERT INTO verification_log (email, ip_address) VALUES ($1, $2)`,
    [email, getClientIp(req)]
  );

  res.json({ success: true, message: 'Check your university email for the verification code.' });
});

/**
 * Login - POST /api/auth/login
 * Step 1 of 2FA: verify password, then send OTP as second factor
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  if (!email.endsWith(env.ALLOWED_EMAIL_DOMAIN)) {
    throw new AppError(
      `Only ${env.ALLOWED_EMAIL_DOMAIN} email addresses are allowed`,
      400,
      'INVALID_EMAIL_DOMAIN'
    );
  }

  const userResult = await query(
    'SELECT id, password_hash, full_name, is_active FROM users WHERE email = $1',
    [email]
  );

  // Generic error so we don't leak whether an email exists
  const CRED_ERROR = new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');

  if (userResult.rows.length === 0 || !userResult.rows[0].password_hash) {
    throw CRED_ERROR;
  }

  const user = userResult.rows[0];

  if (!user.is_active) {
    throw new AppError(
      'Unable to process your request. Please contact support.',
      403,
      'REQUEST_REJECTED'
    );
  }

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) throw CRED_ERROR;

  if (await otpService.isLockedOut(email)) {
    throw new AppError('Too many attempts. Please wait 15 minutes.', 429, 'OTP_RATE_LIMITED');
  }

  const otp = otpService.generateOtp();
  await otpService.storeOtp(email, otp);

  if (env.NODE_ENV === 'development') {
    console.log(`\n🔑 [DEV LOGIN OTP] ${email} → ${otp}\n`);
  }

  const sent = await emailService.sendOtpEmail(email, otp, user.full_name);
  if (!sent && env.NODE_ENV !== 'development') {
    throw new AppError('Failed to send verification code. Please try again.', 503, 'EMAIL_UNAVAILABLE');
  }

  await query(
    `INSERT INTO verification_log (email, ip_address) VALUES ($1, $2)`,
    [email, getClientIp(req)]
  );

  await auditService.logFromRequest(req, auditService.ACTIONS.OTP_REQUESTED, {
    metadata: { email, method: '2fa-login' },
  });

  res.json({ success: true, message: 'Verification code sent to your email.' });
});

/**
 * Verify OTP - POST /api/auth/verify-otp
 * Step 2 of 2FA (or final step of register / legacy OTP-only)
 */
const verifyOtp = asyncHandler(async (req, res) => {
  // NOTE: fullName / studentId are intentionally NOT taken from the request body
  // on this path. Profile fields are only ever set from the staged registration
  // record (reg:<email>). Otherwise any user completing the login/2FA step could
  // overwrite their own profile — or, via studentId unique collisions, probe
  // other accounts — through the auth endpoint.
  const { email, otp } = verifyOtpSchema.parse(req.body);

  const verification = await otpService.verifyOtp(email, otp);
  if (!verification.valid) {
    throw new AppError(verification.error, 400, 'OTP_INVALID');
  }

  // Profile fields come exclusively from a pending registration, if one exists.
  const regRaw = await redis.get(`reg:${email}`);
  let passwordHash = null;
  let regFullName = null;
  let regStudentId = null;

  if (regRaw) {
    const reg = JSON.parse(regRaw);
    passwordHash = reg.passwordHash;
    regFullName = reg.fullName || null;
    regStudentId = reg.studentId || null;
    await redis.del(`reg:${email}`);
  }

  // Build upsert: if we have a new password hash, update it; otherwise keep existing
  const upsertResult = await query(
    `INSERT INTO users (email, full_name, student_id, email_verified, last_login_at, password_hash)
     VALUES ($1, COALESCE($2, 'New User'), $3, TRUE, NOW(), $4)
     ON CONFLICT (email) DO UPDATE SET
       email_verified = TRUE,
       last_login_at = NOW(),
       full_name = COALESCE($2, users.full_name),
       student_id = COALESCE($3, users.student_id),
       password_hash = COALESCE($4, users.password_hash),
       updated_at = NOW()
     RETURNING id, email, full_name, role, student_id, created_at`,
    [email, regFullName || null, regStudentId || null, passwordHash]
  );

  const user = upsertResult.rows[0];

  const sessionData = JSON.stringify({
    role: user.role,
    email: user.email,
    loginAt: new Date().toISOString(),
  });
  await redis.set(KEYS.session(user.id), sessionData, 'EX', TTL.SESSION);

  const token = jwtService.signToken(jwtService.createTokenPayload(user));
  jwtService.setTokenCookie(res, token);

  await query(
    `UPDATE verification_log
     SET verified_at = NOW(), user_id = $1
     WHERE id = (
       SELECT id FROM verification_log
       WHERE email = $2 AND verified_at IS NULL
       ORDER BY requested_at DESC
       LIMIT 1
     )`,
    [user.id, email]
  );

  await auditService.logFromRequest(req, auditService.ACTIONS.LOGIN, {
    metadata: { method: regRaw ? 'register+otp' : 'password+otp' },
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      studentId: user.student_id,
    },
  });
});

/**
 * Forgot Password - POST /api/auth/forgot-password
 * Always returns the same generic response so attackers can't enumerate emails.
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);

  const GENERIC_RESPONSE = {
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  };

  if (!email.endsWith(env.ALLOWED_EMAIL_DOMAIN)) {
    return res.json(GENERIC_RESPONSE);
  }

  const userResult = await query(
    'SELECT id, full_name, password_hash, is_active FROM users WHERE email = $1',
    [email]
  );

  // Silent no-op if user doesn't exist, has no password set, or is deactivated.
  if (
    userResult.rows.length === 0 ||
    !userResult.rows[0].password_hash ||
    !userResult.rows[0].is_active
  ) {
    return res.json(GENERIC_RESPONSE);
  }

  const user = userResult.rows[0];

  // Invalidate any prior unused tokens for this user (one outstanding token at a time).
  await query(
    `UPDATE password_reset_tokens
        SET used_at = NOW()
      WHERE user_id = $1 AND used_at IS NULL`,
    [user.id]
  );

  const rawToken  = generateResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, expiresAt, getClientIp(req), req.headers['user-agent'] || null]
  );

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

  if (env.NODE_ENV === 'development') {
    console.log(`\n🔑 [DEV RESET LINK] ${email} → ${resetUrl}\n`);
  }

  const sent = await emailService.sendPasswordResetEmail(email, resetUrl, user.full_name);
  if (!sent && env.NODE_ENV !== 'development') {
    throw new AppError('Failed to send reset email. Please try again in a moment.', 503, 'EMAIL_UNAVAILABLE');
  }

  await auditService.logFromRequest(req, auditService.ACTIONS.PASSWORD_RESET_REQUESTED, {
    userId: user.id,
    metadata: { email },
  });

  res.json(GENERIC_RESPONSE);
});

/**
 * Reset Password - POST /api/auth/reset-password
 * Consumes a one-time token and sets a new password.
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body);

  const tokenHash = hashResetToken(token);

  const result = await query(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, u.email, u.is_active
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid or expired reset link.', 400, 'RESET_TOKEN_INVALID');
  }

  const row = result.rows[0];

  if (row.used_at) {
    throw new AppError('This reset link has already been used.', 400, 'RESET_TOKEN_USED');
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new AppError('This reset link has expired. Please request a new one.', 400, 'RESET_TOKEN_EXPIRED');
  }

  if (!row.is_active) {
    throw new AppError('Account is not active.', 403, 'ACCOUNT_INACTIVE');
  }

  const newHash = await hashPassword(password);

  // Atomically: update password, mark token used, invalidate other outstanding
  // tokens. Must run on a single pooled client — using withTransaction rather
  // than bare query('BEGIN') ensures BEGIN/UPDATE/COMMIT all hit the SAME
  // connection (a raw query('BEGIN') can otherwise leak an open transaction
  // onto an arbitrary pooled client).
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, row.user_id]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id]
    );
    await client.query(
      `UPDATE password_reset_tokens
          SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL AND id <> $2`,
      [row.user_id, row.id]
    );
  });

  // Force re-auth everywhere by dropping the session.
  await redis.del(KEYS.session(row.user_id));

  await auditService.logFromRequest(req, auditService.ACTIONS.PASSWORD_RESET_COMPLETED, {
    userId: row.user_id,
    metadata: { email: row.email },
  });

  res.json({
    success: true,
    message: 'Password updated. You can now sign in with your new password.',
  });
});

/**
 * Change Password - POST /api/auth/change-password (authenticated)
 * Requires current password.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  if (currentPassword === newPassword) {
    throw new AppError('New password must be different from current password.', 400, 'PASSWORD_UNCHANGED');
  }

  const userResult = await query(
    'SELECT id, email, password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].password_hash) {
    throw new AppError('Account not eligible for password change.', 400, 'NO_PASSWORD_SET');
  }

  const user = userResult.rows[0];

  const valid = await verifyPassword(user.password_hash, currentPassword);
  if (!valid) {
    throw new AppError('Current password is incorrect.', 401, 'INVALID_CREDENTIALS');
  }

  const newHash = await hashPassword(newPassword);

  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [newHash, user.id]
  );

  // Invalidate any pending reset tokens — they're moot now.
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW()
      WHERE user_id = $1 AND used_at IS NULL`,
    [user.id]
  );

  await auditService.logFromRequest(req, auditService.ACTIONS.PASSWORD_CHANGED, {
    metadata: { email: user.email },
  });

  res.json({ success: true, message: 'Password updated successfully.' });
});

/**
 * Logout - POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await redis.del(KEYS.session(req.user.id));
    await auditService.logFromRequest(req, auditService.ACTIONS.LOGOUT);
  }
  jwtService.clearTokenCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Get current user - GET /api/auth/me
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, full_name, role, student_id, email_verified, created_at, last_login_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );

  if (result.rows.length === 0) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  const user = result.rows[0];

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      studentId: user.student_id,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    },
  });
});

module.exports = {
  requestOtp,
  register,
  login,
  verifyOtp,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  getCurrentUser,
};
