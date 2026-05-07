const { scrypt, randomBytes, timingSafeEqual, createHash } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function verifyPassword(stored, supplied) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// 32 bytes = 64 hex chars. URL-safe and unguessable.
function generateResetToken() {
  return randomBytes(32).toString('hex');
}

// sha256 hex digest. Raw token never touches the DB.
function hashResetToken(rawToken) {
  return createHash('sha256').update(rawToken).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
};
