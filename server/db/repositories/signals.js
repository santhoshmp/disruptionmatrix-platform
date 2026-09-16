// signals.js — Repository for signals table

import pool from '../pool.js';

export async function insert(signal) {
  const sql = `
    INSERT INTO signals (
      signal_id, agent_id, agent_type, region, sub_region, detected,
      name, hazard_type, geo, airports, airspace, summary,
      factor_hints, domains, preliminary_effects, evidence, raw_refs,
      event_id, data_source_mode, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18, $19, NOW()
    )
    ON CONFLICT (signal_id) DO NOTHING
  `;
  const params = [
    signal.signalId, signal.agentId, signal.agentType, signal.region,
    signal.subRegion, signal.detected, signal.name, signal.hazardType,
    JSON.stringify(signal.geo || null),
    JSON.stringify(signal.airports || []),
    JSON.stringify(signal.airspace || []),
    signal.summary,
    JSON.stringify(signal.factorHints || {}),
    JSON.stringify(signal.domains || []),
    JSON.stringify(signal.preliminaryEffects || []),
    JSON.stringify(signal.evidence || []),
    JSON.stringify(signal.rawRefs || []),
    signal.eventId || null,
    signal.dataSourceMode || 'mock',
  ];
  await pool.query(sql, params);
}

export async function getById(id) {
  const res = await pool.query('SELECT * FROM signals WHERE signal_id = $1', [id]);
  return res.rows[0] ? _mapRow(res.rows[0]) : null;
}

export async function getAll(filters = {}) {
  let sql = 'SELECT * FROM signals WHERE 1=1';
  const params = [];
  let idx = 1;

  if (filters.agentType) {
    sql += ` AND agent_type = $${idx++}`;
    params.push(filters.agentType);
  }
  if (filters.region) {
    sql += ` AND region = $${idx++}`;
    params.push(filters.region);
  }
  if (filters.agentId) {
    sql += ` AND agent_id = $${idx++}`;
    params.push(filters.agentId);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ` LIMIT $${idx++}`;
    params.push(filters.limit);
  }
  if (filters.offset) {
    sql += ` OFFSET $${idx++}`;
    params.push(filters.offset);
  }

  const res = await pool.query(sql, params);
  return res.rows.map(_mapRow);
}

export async function getCount() {
  const res = await pool.query('SELECT COUNT(*) as count FROM signals');
  return parseInt(res.rows[0].count);
}

// Delete signals older than N days
export async function deleteOlderThan(days) {
  const res = await pool.query(
    'DELETE FROM signals WHERE created_at < NOW() - INTERVAL \'$1 days\' RETURNING signal_id',
    [days]
  );
  return res.rowCount;
}

function _mapRow(r) {
  return {
    signalId: r.signal_id,
    agentId: r.agent_id,
    agentType: r.agent_type,
    region: r.region,
    subRegion: r.sub_region,
    detected: r.detected,
    name: r.name,
    hazardType: r.hazard_type,
    geo: r.geo,
    airports: r.airports || [],
    airspace: r.airspace || [],
    summary: r.summary,
    factorHints: r.factor_hints || {},
    domains: r.domains || [],
    preliminaryEffects: r.preliminary_effects || [],
    evidence: r.evidence || [],
    rawRefs: r.raw_refs || [],
    eventId: r.event_id,
    dataSourceMode: r.data_source_mode,
  };
}

export default { insert, getById, getAll, getCount, deleteOlderThan };
