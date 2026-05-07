/**
 * Set or reset a user's password.
 *
 * Usage:
 *   node scripts/set-password.js <email> [password]
 *
 *   - If <password> is omitted, a 16-char random one is generated and printed.
 *   - If the user does not exist, the row is inserted (email_verified=true, role=student).
 *     Use --role=admin or --role=super_admin to override role on insert.
 *
 * Examples:
 *   node scripts/set-password.js you@uni.edu MySecret123
 *   node scripts/set-password.js you@uni.edu                 # auto-generate
 *   node scripts/set-password.js you@uni.edu --role=admin    # auto-generate, role=admin
 */

require('dotenv').config();
const { Pool } = require('pg');
const { randomBytes } = require('crypto');
const { hashPassword } = require('../src/utils/password');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=');
      flags[k] = v ?? true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function generatePassword(len = 16) {
  // URL-safe-ish, no ambiguous chars
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function main() {
  const { positional, flags } = parseArgs(process.argv);
  const email    = positional[0];
  const supplied = positional[1];
  const role     = flags.role || 'student';

  if (!email) {
    console.error('Usage: node scripts/set-password.js <email> [password] [--role=student|admin|super_admin]');
    process.exit(1);
  }

  const password = supplied || generatePassword(16);
  const generated = !supplied;

  const validRoles = new Set(['student', 'admin', 'super_admin']);
  if (!validRoles.has(role)) {
    console.error(`❌ Invalid role: ${role}. Must be one of: ${[...validRoles].join(', ')}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (email, full_name, role, email_verified, password_hash, is_active)
       VALUES ($1, $2, $3, TRUE, $4, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         password_hash  = EXCLUDED.password_hash,
         email_verified = TRUE,
         is_active      = TRUE,
         updated_at     = NOW()
       RETURNING id, email, full_name, role, (xmax = 0) AS inserted`,
      [email, email.split('@')[0], role, passwordHash]
    );

    const row = result.rows[0];
    const action = row.inserted ? 'CREATED' : 'UPDATED';

    console.log('');
    console.log(`✅ ${action} user`);
    console.log(`   id:       ${row.id}`);
    console.log(`   email:    ${row.email}`);
    console.log(`   role:     ${row.role}`);
    if (generated) {
      console.log(`   password: ${password}    ← generated, save this now`);
    } else {
      console.log(`   password: <set from argument>`);
    }
    console.log('');
  } catch (err) {
    console.error('❌ Failed:', err.message || err.code || err);
    if (err.errors) {
      for (const e of err.errors) console.error('   →', e.message || e.code);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
