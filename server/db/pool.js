// pool.js — PostgreSQL connection pool
// Uses DATABASE_URL env var so it works locally AND on Vercel (Neon, Supabase, etc.)
//
// Local dev:  DATABASE_URL=postgresql://dm_app:disrupt2026@localhost:5432/disruption_matrix
// Vercel:     DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require

import pg from 'pg';

const { Pool } = pg;

// Build connection string: prefer DATABASE_URL, fall back to individual env vars
function _buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.DB_USER || 'dm_app';
  const pass = process.env.DB_PASS || 'disrupt2026';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'disruption_matrix';
  return 'postgresql://' + user + ':' + pass + '@' + host + ':' + port + '/' + name;
}

const connectionString = _buildConnectionString();

// Detect if we're in a serverless environment (Vercel functions are short-lived)
const isServerless = !!process.env.VERCEL;

const pool = new Pool({
  connectionString,
  // Serverless: smaller pool, shorter idle timeout (functions are ephemeral)
  // Long-running: larger pool, longer idle timeout
  max: isServerless ? 3 : 10,
  idleTimeoutMillis: isServerless ? 10000 : 30000,
  connectionTimeoutMillis: 5000,
  // SSL: cloud providers (Neon, Supabase) require SSL
  ssl: connectionString.includes('sslmode=require') || isServerless
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Test connection on startup
export async function testConnection() {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT version()');
    client.release();
    return res.rows[0].version;
  } catch (e) {
    console.error('[DB] Connection test failed:', e.message);
    return null;
  }
}

export default pool;
