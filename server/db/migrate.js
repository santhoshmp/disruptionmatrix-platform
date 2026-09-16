// migrate.js — Runs SQL migrations in order, tracks applied migrations
// Works both on startup (local dev) and as a CLI script (Vercel: `npm run migrate`)

import pool from './pool.js';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get applied migrations
    const applied = await client.query('SELECT id FROM schema_migrations');
    const appliedIds = new Set(applied.rows.map((r) => r.id));

    // Get migration files in order
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let run = 0;
    for (const file of files) {
      const id = file.replace('.sql', '');
      if (appliedIds.has(id)) continue;

      console.log(`[DB] Running migration: ${file}`);
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
        await client.query('COMMIT');
        console.log(`[DB] ✓ Migration ${file} applied`);
        run++;
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[DB] ✗ Migration ${file} failed:`, e.message);
        throw e;
      }
    }

    if (run === 0) {
      console.log('[DB] All migrations already applied');
    } else {
      console.log(`[DB] ${run} migration(s) applied`);
    }
    return run;
  } finally {
    client.release();
  }
}

// Allow running directly: `node db/migrate.js`
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
