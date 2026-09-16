// agents.js — Repository for agents table (runtime state)

import pool from '../pool.js';

export async function upsert(agent) {
  // Normalize timestamps — seed data may use non-ISO format like "11 FEB 06:00Z"
  const normalizeTs = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const sql = `
    INSERT INTO agents (
      id, type, region, sub_region, priority, status,
      last_poll, last_signal_at, signal_count, data_source_mode,
      error_count, last_error, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      type = EXCLUDED.type,
      region = EXCLUDED.region,
      sub_region = EXCLUDED.sub_region,
      priority = EXCLUDED.priority,
      status = EXCLUDED.status,
      last_poll = EXCLUDED.last_poll,
      last_signal_at = EXCLUDED.last_signal_at,
      signal_count = EXCLUDED.signal_count,
      data_source_mode = EXCLUDED.data_source_mode,
      error_count = EXCLUDED.error_count,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
  `;
  const params = [
    agent.id, agent.type, agent.region, agent.subRegion, agent.priority,
    agent.status || 'idle',
    normalizeTs(agent.lastPoll),
    normalizeTs(agent.lastSignalAt),
    agent.signalCount || 0,
    agent.dataSourceMode || 'mock',
    agent.errorCount || 0,
    agent.lastError || null,
  ];
  await pool.query(sql, params);
}

export async function updateStatus(id, status, extra = {}) {
  const normalizeTs = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const fields = ['status = $2', 'updated_at = NOW()'];
  const params = [id, status];
  let idx = 3;

  if (extra.lastPoll != null) {
    fields.push(`last_poll = $${idx++}`);
    params.push(normalizeTs(extra.lastPoll));
  }
  if (extra.lastSignalAt != null) {
    fields.push(`last_signal_at = $${idx++}`);
    params.push(normalizeTs(extra.lastSignalAt));
  }
  if (extra.signalCount != null) {
    fields.push(`signal_count = $${idx++}`);
    params.push(extra.signalCount);
  }
  if (extra.errorCount != null) {
    fields.push(`error_count = $${idx++}`);
    params.push(extra.errorCount);
  }
  if (extra.lastError != null) {
    fields.push(`last_error = $${idx++}`);
    params.push(extra.lastError);
  }

  await pool.query(`UPDATE agents SET ${fields.join(', ')} WHERE id = $1`, params);
}

export async function getById(id) {
  const res = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
  return res.rows[0] ? _mapRow(res.rows[0]) : null;
}

export async function getAll(filters = {}) {
  let sql = 'SELECT * FROM agents WHERE 1=1';
  const params = [];
  let idx = 1;

  if (filters.type) {
    sql += ` AND type = $${idx++}`;
    params.push(filters.type);
  }
  if (filters.region) {
    sql += ` AND region = $${idx++}`;
    params.push(filters.region);
  }
  if (filters.priority) {
    sql += ` AND priority = $${idx++}`;
    params.push(filters.priority);
  }

  sql += ' ORDER BY id';
  const res = await pool.query(sql, params);
  return res.rows.map(_mapRow);
}

export async function getCount() {
  const res = await pool.query('SELECT COUNT(*) as count FROM agents');
  return parseInt(res.rows[0].count);
}

function _mapRow(r) {
  return {
    id: r.id,
    type: r.type,
    region: r.region,
    subRegion: r.sub_region,
    priority: r.priority,
    status: r.status,
    lastPoll: r.last_poll,
    lastSignalAt: r.last_signal_at,
    signalCount: r.signal_count,
    dataSourceMode: r.data_source_mode,
    errorCount: r.error_count,
    lastError: r.last_error,
  };
}

export default { upsert, updateStatus, getById, getAll, getCount };
