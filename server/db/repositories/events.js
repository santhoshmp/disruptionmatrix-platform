// events.js — Repository for events table

import pool from '../pool.js';

// Upsert (insert or update) an event
export async function upsert(event) {
  const sql = `
    INSERT INTO events (
      id, ref, name, cat, "where", detected, score, conf, traj, tti, tti_min,
      esc, summary, sop_key, factors, domains, chain, evidence, assumptions, gaps,
      source, signal_count, source_signals, geo, airports, airspace, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      ref = EXCLUDED.ref,
      name = EXCLUDED.name,
      cat = EXCLUDED.cat,
      "where" = EXCLUDED."where",
      detected = EXCLUDED.detected,
      score = EXCLUDED.score,
      conf = EXCLUDED.conf,
      traj = EXCLUDED.traj,
      tti = EXCLUDED.tti,
      tti_min = EXCLUDED.tti_min,
      esc = EXCLUDED.esc,
      summary = EXCLUDED.summary,
      sop_key = EXCLUDED.sop_key,
      factors = EXCLUDED.factors,
      domains = EXCLUDED.domains,
      chain = EXCLUDED.chain,
      evidence = EXCLUDED.evidence,
      assumptions = EXCLUDED.assumptions,
      gaps = EXCLUDED.gaps,
      source = EXCLUDED.source,
      signal_count = EXCLUDED.signal_count,
      source_signals = EXCLUDED.source_signals,
      geo = EXCLUDED.geo,
      airports = EXCLUDED.airports,
      airspace = EXCLUDED.airspace,
      updated_at = NOW()
  `;
  const params = [
    event.id, event.ref, event.name, event.cat, event.where, event.detected,
    event.score, event.conf, event.traj, event.tti, event.ttiMin,
    event.esc, event.summary, event.sopKey,
    JSON.stringify(event.factors || []),
    JSON.stringify(event.domains || []),
    JSON.stringify(event.chain || []),
    JSON.stringify(event.evidence || []),
    JSON.stringify(event.assumptions || []),
    JSON.stringify(event.gaps || []),
    event._source || 'seeded',
    event._signalCount || null,
    JSON.stringify(event._sourceSignals || []),
    JSON.stringify(event._geo || null),
    JSON.stringify(event._airports || []),
    JSON.stringify(event._airspace || []),
  ];
  await pool.query(sql, params);
}

// Update specific fields of an event
export async function update(id, updates) {
  const allowed = ['ref', 'name', 'cat', 'where', 'detected', 'score', 'conf',
    'traj', 'tti', 'ttiMin', 'esc', 'summary', 'sopKey', 'factors', 'domains',
    'chain', 'evidence', 'assumptions', 'gaps', 'source', 'signalCount',
    'sourceSignals', 'geo', 'airports', 'airspace'];

  const fields = [];
  const params = [id];
  let paramIdx = 2;

  for (const [key, val] of Object.entries(updates)) {
    const dbKey = key === 'ttiMin' ? 'tti_min'
      : key === 'sopKey' ? 'sop_key'
      : key === '_source' ? 'source'
      : key === '_signalCount' ? 'signal_count'
      : key === '_sourceSignals' ? 'source_signals'
      : key === '_geo' ? 'geo'
      : key === '_airports' ? 'airports'
      : key === '_airspace' ? 'airspace'
      : key;

    if (!allowed.includes(key) && !['tti_min', 'sop_key', 'source', 'signal_count', 'source_signals', 'geo', 'airports', 'airspace'].includes(dbKey)) continue;

    const isJson = ['factors', 'domains', 'chain', 'evidence', 'assumptions', 'gaps',
      'source_signals', 'geo', 'airports', 'airspace'].includes(dbKey);

    fields.push(`${dbKey} = $${paramIdx}${isJson ? '::jsonb' : ''}`);
    params.push(isJson ? JSON.stringify(val) : val);
    paramIdx++;
  }

  if (fields.length === 0) return;
  fields.push(`updated_at = NOW()`);

  await pool.query(`UPDATE events SET ${fields.join(', ')} WHERE id = $1`, params);
}

// Get event by ID
export async function getById(id) {
  const res = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  return res.rows[0] ? _mapRow(res.rows[0]) : null;
}

// Get all events with optional filters
export async function getAll(filters = {}) {
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  let idx = 1;

  if (filters.cat) {
    sql += ` AND cat = $${idx++}`;
    params.push(filters.cat);
  }
  if (filters.minScore != null) {
    sql += ` AND score >= $${idx++}`;
    params.push(filters.minScore);
  }
  if (filters.source) {
    sql += ` AND source = $${idx++}`;
    params.push(filters.source);
  }

  sql += ' ORDER BY score DESC';

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

// Get count
export async function getCount() {
  const res = await pool.query('SELECT COUNT(*) as count FROM events');
  return parseInt(res.rows[0].count);
}

// Delete event by ID
export async function deleteById(id) {
  await pool.query('DELETE FROM events WHERE id = $1', [id]);
}

// Map DB row to event shape (camelCase + _prefix fields)
function _mapRow(r) {
  return {
    id: r.id,
    ref: r.ref,
    name: r.name,
    cat: r.cat,
    where: r.where,
    detected: r.detected,
    score: r.score,
    conf: r.conf,
    traj: r.traj,
    tti: r.tti,
    ttiMin: r.tti_min,
    esc: r.esc,
    summary: r.summary,
    sopKey: r.sop_key,
    factors: r.factors || [],
    domains: r.domains || [],
    chain: r.chain || [],
    evidence: r.evidence || [],
    assumptions: r.assumptions || [],
    gaps: r.gaps || [],
    _source: r.source,
    _signalCount: r.signal_count,
    _sourceSignals: r.source_signals || [],
    _geo: r.geo,
    _airports: r.airports || [],
    _airspace: r.airspace || [],
  };
}

export default { upsert, update, getById, getAll, getCount, deleteById };
