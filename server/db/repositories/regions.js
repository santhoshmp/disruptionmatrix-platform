// regions.js — Repository for regions table

import pool from '../pool.js';

export async function upsert(region) {
  const sql = `
    INSERT INTO regions (id, name, priority, enabled, sub_regions, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      priority = EXCLUDED.priority,
      enabled = EXCLUDED.enabled,
      sub_regions = EXCLUDED.sub_regions,
      updated_at = NOW()
  `;
  const params = [
    region.id, region.name, region.priority,
    region.enabled !== false, // default true
    JSON.stringify(region.subRegions || []),
  ];
  await pool.query(sql, params);
}

export async function setEnabled(id, enabled) {
  await pool.query(
    'UPDATE regions SET enabled = $2, updated_at = NOW() WHERE id = $1',
    [id, enabled]
  );
}

export async function getById(id) {
  const res = await pool.query('SELECT * FROM regions WHERE id = $1', [id]);
  return res.rows[0] ? _mapRow(res.rows[0]) : null;
}

export async function getAll() {
  const res = await pool.query('SELECT * FROM regions ORDER BY id');
  return res.rows.map(_mapRow);
}

function _mapRow(r) {
  return {
    id: r.id,
    name: r.name,
    priority: r.priority,
    enabled: r.enabled,
    subRegions: r.sub_regions || [],
  };
}

export default { upsert, setEnabled, getById, getAll };
