// ops.js — Repository for ops (impact assessments) table

import pool from '../pool.js';

export async function upsert(eventId, ops, impactMode = 'mock') {
  const sql = `
    INSERT INTO ops (
      event_id, basis, airports, airlines, overflight_exposure,
      computed_at, edps, impact_mode
    ) VALUES (
      $1, $2, $3, $4, $5, NOW(), $6, $7
    )
    ON CONFLICT (event_id) DO UPDATE SET
      basis = EXCLUDED.basis,
      airports = EXCLUDED.airports,
      airlines = EXCLUDED.airlines,
      overflight_exposure = EXCLUDED.overflight_exposure,
      computed_at = NOW(),
      edps = EXCLUDED.edps,
      impact_mode = EXCLUDED.impact_mode
  `;
  const params = [
    eventId,
    ops.basis || null,
    JSON.stringify(ops.airports || []),
    JSON.stringify(ops.airlines || []),
    JSON.stringify(ops.overflightExposure || []),
    ops._edps || null,
    impactMode,
  ];
  await pool.query(sql, params);
}

export async function getByEventId(eventId) {
  const res = await pool.query('SELECT * FROM ops WHERE event_id = $1', [eventId]);
  return res.rows[0] ? _mapRow(res.rows[0]) : null;
}

export async function getAll() {
  const res = await pool.query('SELECT * FROM ops');
  const rows = res.rows;
  // Return as a map { eventId: ops }
  const map = {};
  for (const r of rows) {
    map[r.event_id] = _mapRow(r);
  }
  return map;
}

export async function getCount() {
  const res = await pool.query('SELECT COUNT(*) as count FROM ops');
  return parseInt(res.rows[0].count);
}

export async function deleteByEventId(eventId) {
  await pool.query('DELETE FROM ops WHERE event_id = $1', [eventId]);
}

function _mapRow(r) {
  return {
    basis: r.basis,
    airports: r.airports || [],
    airlines: r.airlines || [],
    overflightExposure: r.overflight_exposure || [],
    _computedAt: r.computed_at,
    _eventId: r.event_id,
    _edps: r.edps,
    _impactMode: r.impact_mode,
  };
}

export default { upsert, getByEventId, getAll, getCount, deleteByEventId };
