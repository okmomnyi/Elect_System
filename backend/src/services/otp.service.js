const crypto = require('crypto');
const { redis, KEYS, TTL } = require('../config/redis');

/**
 * Atomically DELETE the OTP key only if its current value still equals ARGV[1].
 * Used to *consume* an OTP after a verified match: this preserves the anti-replay
 * guarantee (an OTP can open at most one session) while ensuring that a wrong
 * guess never deletes the code — so a single mistyped digit doesn't force the
 * user to request a brand-new OTP. Returns 1 if it deleted, 0 otherwise.
 * Compatible with Redis 2.6+.
 */
const COMPARE_AND_DELETE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  else
    return 0
  end
`;

/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 */

/**
 * Generate a cryptographically secure 6-digit OTP
 * @returns {string} 6-digit OTP
 */
function generateOtp() {
  // Generate random bytes and convert to 6-digit number
  const buffer = crypto.randomBytes(4);
  const number = buffer.readUInt32BE(0);
  const otp = (number % 900000 + 100000).toString(); // Ensures 6 digits
  return otp;
}

/**
 * Store OTP in Redis with expiration
 * @param {string} email - User email
 * @param {string} otp - Generated OTP
 * @returns {Promise<boolean>} Success status
 */
async function storeOtp(email, otp) {
  const key = KEYS.verify(email);
  const data = JSON.stringify({
    otp,
    expires: Date.now() + (TTL.OTP * 1000), // Store expiry timestamp
    createdAt: Date.now(),
  });
  
  await redis.set(key, data, 'EX', TTL.OTP);
  return true;
}

/**
 * Get current attempt count for email
 * @param {string} email - User email
 * @returns {Promise<number>} Current attempt count
 */
async function getAttemptCount(email) {
  const key = KEYS.otpAttempts(email);
  const count = await redis.get(key);
  return parseInt(count || '0', 10);
}

/**
 * Increment OTP attempt counter
 * @param {string} email - User email
 * @returns {Promise<number>} New attempt count
 */
async function incrementAttempts(email) {
  const key = KEYS.otpAttempts(email);
  
  const [incrResult] = await redis.multi()
    .incr(key)
    .expire(key, TTL.OTP_ATTEMPTS)
    .exec();
  
  return incrResult[1]; // Return new count
}

/**
 * Check if email is locked out due to too many attempts
 * @param {string} email - User email
 * @returns {Promise<boolean>} True if locked out
 */
async function isLockedOut(email) {
  const count = await getAttemptCount(email);
  return count >= 5;
}

/**
 * Reset attempt counter (called after successful verification)
 * @param {string} email - User email
 */
async function resetAttempts(email) {
  const key = KEYS.otpAttempts(email);
  await redis.del(key);
}

/**
 * Verify submitted OTP against stored OTP
 * @param {string} email - User email
 * @param {string} submittedOtp - OTP submitted by user
 * @returns {Promise<{valid: boolean, error?: string}>} Verification result
 */
async function verifyOtp(email, submittedOtp) {
  // Check lockout before touching the OTP key
  if (await isLockedOut(email)) {
    return { valid: false, error: 'Too many attempts. Please request a new OTP.' };
  }

  // Read the OTP WITHOUT deleting it. A wrong guess must not destroy the code,
  // otherwise a single mistyped digit forces the user to request a new OTP.
  const raw = await redis.get(KEYS.verify(email));

  if (!raw) {
    return { valid: false, error: 'OTP expired or not requested' };
  }

  let otpData;
  try {
    otpData = JSON.parse(raw);
  } catch {
    await redis.del(KEYS.verify(email));
    return { valid: false, error: 'OTP expired or not requested' };
  }

  // Check expiry (belt-and-suspenders; Redis TTL already handles this)
  if (Date.now() > otpData.expires) {
    await redis.del(KEYS.verify(email));
    return { valid: false, error: 'OTP has expired' };
  }

  // Constant-time comparison to prevent timing attacks
  const storedBuffer = Buffer.from(otpData.otp);
  const submittedBuffer = Buffer.from(String(submittedOtp ?? ''));

  const match =
    storedBuffer.length === submittedBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, submittedBuffer);

  if (!match) {
    // Count the failed guess. With the OTP left intact, the user gets up to 5
    // attempts against the SAME code before lockout — and an attacker can't
    // farm fresh codes, since the issued OTP stays put until matched/expired.
    await incrementAttempts(email);
    return { valid: false, error: 'Invalid OTP' };
  }

  // Success — atomically consume the OTP so it can open at most one session.
  // compare-and-delete by value: if two correct submissions race, only the one
  // that still sees this exact value wins; the loser is rejected as consumed.
  const deleted = await redis.eval(
    COMPARE_AND_DELETE_SCRIPT,
    1,
    KEYS.verify(email),
    raw
  );

  if (deleted === 0) {
    return { valid: false, error: 'OTP expired or not requested' };
  }

  await resetAttempts(email);
  return { valid: true };
}

module.exports = {
  generateOtp,
  storeOtp,
  getAttemptCount,
  incrementAttempts,
  isLockedOut,
  resetAttempts,
  verifyOtp,
};
