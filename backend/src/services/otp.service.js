const crypto = require('crypto');
const { redis, KEYS, TTL } = require('../config/redis');

/**
 * Atomically GET the value at KEYS[1] and DELETE it in the same round-trip.
 * Prevents two concurrent verify requests from both reading the same OTP before
 * either deletes it (race condition that would allow one OTP to open two sessions).
 * Compatible with Redis 2.6+.
 */
const GET_AND_DELETE_SCRIPT = `
  local v = redis.call('GET', KEYS[1])
  if v ~= false then redis.call('DEL', KEYS[1]) end
  return v
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

  // Atomically read AND delete the OTP in a single Lua round-trip.
  // If two requests race here, only one will receive the value; the second
  // gets null and is rejected — preventing the same OTP from opening two sessions.
  const raw = await redis.eval(GET_AND_DELETE_SCRIPT, 1, KEYS.verify(email));

  if (!raw) {
    return { valid: false, error: 'OTP expired or not requested' };
  }

  const otpData = JSON.parse(raw);

  // Check expiry (belt-and-suspenders; Redis TTL already handles this)
  if (Date.now() > otpData.expires) {
    return { valid: false, error: 'OTP has expired' };
  }

  // Constant-time comparison to prevent timing attacks
  const storedBuffer = Buffer.from(otpData.otp);
  const submittedBuffer = Buffer.from(submittedOtp);

  if (storedBuffer.length !== submittedBuffer.length) {
    await incrementAttempts(email);
    return { valid: false, error: 'Invalid OTP' };
  }

  const match = crypto.timingSafeEqual(storedBuffer, submittedBuffer);

  if (!match) {
    await incrementAttempts(email);
    return { valid: false, error: 'Invalid OTP' };
  }

  // Success
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
