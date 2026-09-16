// llm-settings.js — Repository for LLM provider settings
// Supports per-purpose configs: 'prediction' (event scoring) and 'conversation' (chat)

import pool from '../pool.js';

// Get all LLM provider configs (optionally filtered by purpose)
export async function getAll(purpose = null) {
  const params = [];
  let where = '';
  if (purpose) {
    params.push(purpose);
    where = 'WHERE purpose = $1';
  }
  const res = await pool.query(`SELECT * FROM llm_settings ${where} ORDER BY provider`, params);
  return res.rows.map(_mapRow);
}

// Get a single provider config (for a specific purpose)
export async function getByProvider(provider, purpose = 'prediction') {
  const res = await pool.query(
    'SELECT * FROM llm_settings WHERE provider = $1 AND purpose = $2',
    [provider, purpose]
  );
  return res.rows[0] ? _mapRow(res.rows[0]) : null;
}

// Upsert a provider config (insert or update) for a specific purpose
export async function upsert(config) {
  const purpose = config.purpose || 'prediction';
  const sql = `
    INSERT INTO llm_settings (provider, api_key, api_base, model, enabled, purpose, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (provider, purpose) DO UPDATE SET
      api_key = EXCLUDED.api_key,
      api_base = EXCLUDED.api_base,
      model = EXCLUDED.model,
      enabled = EXCLUDED.enabled,
      updated_at = NOW()
  `;
  const params = [
    config.provider,
    config.apiKey || null,
    config.apiBase || null,
    config.model || null,
    config.enabled || false,
    purpose,
  ];
  await pool.query(sql, params);
}

// Mask the API key for display (show only last 4 chars)
export function maskApiKey(key) {
  if (!key) return null;
  if (key.length <= 8) return '****';
  return '****' + key.slice(-4);
}

function _mapRow(r) {
  return {
    id: r.id,
    provider: r.provider,
    apiKey: r.api_key,
    apiBase: r.api_base,
    model: r.model,
    enabled: r.enabled,
    purpose: r.purpose || 'prediction',
    updatedAt: r.updated_at,
  };
}

export default { getAll, getByProvider, upsert, maskApiKey };
