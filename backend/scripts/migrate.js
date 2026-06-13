/**
 * Migration runner — executes pending SQL files in src/db/migrations in order.
 *
 * Each migration runs exactly once. Applied migrations are recorded in the
 * schema_migrations table (keyed on the full filename), so re-running this
 * script only applies files that have not yet been run. Every file is wrapped
 * in its own transaction: if a migration fails it is rolled back atomically and
 * the runner aborts, leaving the database in a consistent state.
 *
 * Run with: npm run migrate
 * Or directly: node scripts/migrate.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map(r => r.filename));
}

async function migrate() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('\n✅ Database is up to date — no pending migrations.\n');
      return;
    }

    console.log(`\n📦 Applying ${pending.length} pending migration(s) (${applied.size} already applied)...\n`);

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  ▶ ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✅ ${file} — done`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed and was rolled back: ${err.message}`);
      }
    }

    console.log('\n✅ All migrations applied successfully.\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
