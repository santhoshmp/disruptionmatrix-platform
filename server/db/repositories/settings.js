// settings.js — Key-value settings store (impact mode, etc.)

import pool from '../pool.js';

export async function get(key, defaultValue = null) {
  const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return res.rows[0]?.value || defaultValue;
}

export async function set(key, value) {
  await pool.query(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [key, String(value)]);
}

export async function getAll() {
  const res = await pool.query('SELECT key, value FROM settings');
  const map = {};
  for (const r of res.rows) {
    map[r.key] = r.value;
  }
  return map;
}

export default { get, set, getAll };
