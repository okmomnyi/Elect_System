/**
 * Migration runner — executes all SQL files in src/db/migrations in order.
 * Run with: npm run migrate
 * Or directly: node scripts/migrate.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    console.log(`\n📦 Running ${files.length} migration(s)...\n`);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  ▶ ${file}`);
      await client.query(sql);
      console.log(`  ✅ ${file} — done`);
    }

    console.log('\n✅ All migrations applied successfully.\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
