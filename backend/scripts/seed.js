/**
 * Seed runner — loads dev seed data for testing.
 * Run with: npm run seed
 * Or directly: node scripts/seed.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING on all inserts.
 */

require('dotenv').config();
const { Pool } = require('pg');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  let redis;
  try {
    const seedFile = path.join(__dirname, '../src/db/seeds/001_dev_seed.sql');

    if (!fs.existsSync(seedFile)) {
      console.error('❌ Seed file not found:', seedFile);
      process.exit(1);
    }

    let sql = fs.readFileSync(seedFile, 'utf8');

    console.log('\n🌱 Seeding development data...\n');
    await client.query(sql);
    console.log('✅ Seed data loaded successfully.\n');

    // Seed Redis election statuses and tallies to match the DB seed data
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);

      // Election statuses
      await redis.set('election:10000000-0000-0000-0000-000000000002:status', 'active');
      await redis.set('election:10000000-0000-0000-0000-000000000003:status', 'closed');

      // Vote tallies — closed election (Homecoming, 3-2 split)
      await redis.set('tally:10000000-0000-0000-0000-000000000003:20000000-0000-0000-0000-000000000021', '3');
      await redis.set('tally:10000000-0000-0000-0000-000000000003:20000000-0000-0000-0000-000000000022', '2');

      console.log('✅ Redis election statuses and tallies seeded.\n');
    }
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    if (redis) redis.disconnect();
  }
}

seed();
