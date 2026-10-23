// master-data.js — Repository for all ref_* master data tables.
// Standalone module: no existing repositories are modified.

import pool from '../pool.js';

// ── Airports ──────────────────────────────────────────────────────────

export async function getAirports(filter = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (filter.region_id) { conditions.push(`region_id = $${idx++}`); params.push(filter.region_id); }
  if (filter.active !== undefined) { conditions.push(`active = $${idx++}`); params.push(filter.active); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await pool.query(`SELECT * FROM ref_airports ${where} ORDER BY iata`, params);
  return res.rows;
}

export async function getAirport(iata) {
  const res = await pool.query('SELECT * FROM ref_airports WHERE iata = $1', [iata]);
  return res.rows[0] || null;
}

export async function upsertAirport(data) {
  const sql = `
    INSERT INTO ref_airports (iata, icao, name, city, country, region_id, lat, lon, scheduled, daily_movements, cat3_capable, active, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())
    ON CONFLICT (iata) DO UPDATE SET
      icao=EXCLUDED.icao, name=EXCLUDED.name, city=EXCLUDED.city, country=EXCLUDED.country,
      region_id=EXCLUDED.region_id, lat=EXCLUDED.lat, lon=EXCLUDED.lon,
      scheduled=EXCLUDED.scheduled, daily_movements=EXCLUDED.daily_movements,
      cat3_capable=EXCLUDED.cat3_capable, active=EXCLUDED.active, updated_at=NOW()
    RETURNING *`;
  const p = [data.iata, data.icao, data.name, data.city, data.country, data.region_id,
    data.lat, data.lon, data.scheduled !== false, data.daily_movements || 100,
    !!data.cat3_capable, data.active !== false];
  const res = await pool.query(sql, p);
  return res.rows[0];
}

export async function deleteAirport(iata) {
  await pool.query('DELETE FROM ref_airports WHERE iata = $1', [iata]);
}

// ── Airlines ──────────────────────────────────────────────────────────

export async function getAirlines(filter = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (filter.active !== undefined) { conditions.push(`active = $${idx++}`); params.push(filter.active); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await pool.query(`SELECT * FROM ref_airlines ${where} ORDER BY iata`, params);
  return res.rows;
}

export async function getAirline(iata) {
  const res = await pool.query('SELECT * FROM ref_airlines WHERE iata = $1', [iata]);
  return res.rows[0] || null;
}

export async function upsertAirline(data) {
  const sql = `
    INSERT INTO ref_airlines (iata, icao, name, country, hub_primary, hub_secondary, cat3_capable, narrowbody_type, widebody_type, active, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW())
    ON CONFLICT (iata) DO UPDATE SET
      icao=EXCLUDED.icao, name=EXCLUDED.name, country=EXCLUDED.country,
      hub_primary=EXCLUDED.hub_primary, hub_secondary=EXCLUDED.hub_secondary,
      cat3_capable=EXCLUDED.cat3_capable, narrowbody_type=EXCLUDED.narrowbody_type,
      widebody_type=EXCLUDED.widebody_type, active=EXCLUDED.active, updated_at=NOW()
    RETURNING *`;
  const p = [data.iata, data.icao, data.name, data.country, data.hub_primary,
    JSON.stringify(data.hub_secondary || []), !!data.cat3_capable,
    data.narrowbody_type, data.widebody_type, data.active !== false];
  const res = await pool.query(sql, p);
  return res.rows[0];
}

export async function deleteAirline(iata) {
  await pool.query('DELETE FROM ref_airlines WHERE iata = $1', [iata]);
}

// ── Regions ───────────────────────────────────────────────────────────

export async function getRegions() {
  const res = await pool.query('SELECT * FROM ref_regions ORDER BY sort_order, id');
  return res.rows;
}

export async function getRegion(id) {
  const res = await pool.query('SELECT * FROM ref_regions WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function upsertRegion(data) {
  const sql = `
    INSERT INTO ref_regions (id, name, sort_order, active, updated_at)
    VALUES ($1,$2,$3,$4, NOW())
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name, sort_order=EXCLUDED.sort_order, active=EXCLUDED.active, updated_at=NOW()
    RETURNING *`;
  const res = await pool.query(sql, [data.id, data.name, data.sort_order || 0, data.active !== false]);
  return res.rows[0];
}

export async function deleteRegion(id) {
  await pool.query('DELETE FROM ref_regions WHERE id = $1', [id]);
}

// ── Region Countries ──────────────────────────────────────────────────

export async function getRegionCountries(regionId) {
  const res = await pool.query('SELECT country FROM ref_region_countries WHERE region_id = $1 ORDER BY country', [regionId]);
  return res.rows.map(r => r.country);
}

export async function setRegionCountries(regionId, countries) {
  await pool.query('DELETE FROM ref_region_countries WHERE region_id = $1', [regionId]);
  for (const country of countries) {
    await pool.query('INSERT INTO ref_region_countries (region_id, country) VALUES ($1, $2) ON CONFLICT DO NOTHING', [regionId, country]);
  }
}

// ── Sub-Regions ────────────────────────────────────────────────────────

export async function getSubRegions(regionId) {
  const params = [];
  let where = '';
  if (regionId) { where = 'WHERE region_id = $1'; params.push(regionId); }
  const res = await pool.query(`SELECT * FROM ref_sub_regions ${where} ORDER BY region_id, id`, params);
  return res.rows;
}

export async function upsertSubRegion(data) {
  const sql = `
    INSERT INTO ref_sub_regions (id, region_id, name, bbox, active)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (id) DO UPDATE SET
      region_id=EXCLUDED.region_id, name=EXCLUDED.name, bbox=EXCLUDED.bbox, active=EXCLUDED.active
    RETURNING *`;
  const res = await pool.query(sql, [data.id, data.region_id, data.name, JSON.stringify(data.bbox || null), data.active !== false]);
  return res.rows[0];
}

export async function deleteSubRegion(id) {
  await pool.query('DELETE FROM ref_sub_regions WHERE id = $1', [id]);
}

// ── Categories ────────────────────────────────────────────────────────

export async function getCategories() {
  const res = await pool.query('SELECT * FROM ref_categories ORDER BY sort_order, id');
  return res.rows;
}

export async function upsertCategory(data) {
  const sql = `
    INSERT INTO ref_categories (id, name, sop_key, color, icon, sort_order, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (id) DO UPDATE SET
      name=EXCLUDED.name, sop_key=EXCLUDED.sop_key, color=EXCLUDED.color,
      icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, active=EXCLUDED.active
    RETURNING *`;
  const res = await pool.query(sql, [data.id, data.name, data.sop_key, data.color, data.icon, data.sort_order || 0, data.active !== false]);
  return res.rows[0];
}

export async function deleteCategory(id) {
  await pool.query('DELETE FROM ref_categories WHERE id = $1', [id]);
}

// ── Agent Types ───────────────────────────────────────────────────────

export async function getAgentTypes() {
  const res = await pool.query('SELECT * FROM ref_agent_types ORDER BY type');
  return res.rows;
}

export async function upsertAgentType(data) {
  const sql = `
    INSERT INTO ref_agent_types (type, category_id, label, icon, color, poll_interval_min, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (type) DO UPDATE SET
      category_id=EXCLUDED.category_id, label=EXCLUDED.label, icon=EXCLUDED.icon,
      color=EXCLUDED.color, poll_interval_min=EXCLUDED.poll_interval_min, active=EXCLUDED.active
    RETURNING *`;
  const res = await pool.query(sql, [data.type, data.category_id, data.label, data.icon, data.color, data.poll_interval_min || 5, data.active !== false]);
  return res.rows[0];
}

export async function deleteAgentType(type) {
  await pool.query('DELETE FROM ref_agent_types WHERE type = $1', [type]);
}

// ── Hazard Types ─────────────────────────────────────────────────────

export async function getHazardTypes() {
  const res = await pool.query('SELECT * FROM ref_hazard_types ORDER BY hazard_type');
  return res.rows;
}

export async function upsertHazardType(data) {
  const sql = `
    INSERT INTO ref_hazard_types (hazard_type, family, requires_cat3, default_severity, default_sev_val, active)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (hazard_type) DO UPDATE SET
      family=EXCLUDED.family, requires_cat3=EXCLUDED.requires_cat3,
      default_severity=EXCLUDED.default_severity, default_sev_val=EXCLUDED.default_sev_val, active=EXCLUDED.active
    RETURNING *`;
  const res = await pool.query(sql, [data.hazard_type, data.family, !!data.requires_cat3, data.default_severity || 'moderate', data.default_sev_val || 50, data.active !== false]);
  return res.rows[0];
}

export async function deleteHazardType(hazardType) {
  await pool.query('DELETE FROM ref_hazard_types WHERE hazard_type = $1', [hazardType]);
}

// ── Hazard Keywords ───────────────────────────────────────────────────

export async function getHazardKeywords(hazardType) {
  const params = [];
  let where = '';
  if (hazardType) { where = 'WHERE hazard_type = $1'; params.push(hazardType); }
  const res = await pool.query(`SELECT * FROM ref_hazard_keywords ${where} ORDER BY hazard_type, keyword`, params);
  return res.rows;
}

export async function upsertHazardKeyword(data) {
  const res = await pool.query(
    `INSERT INTO ref_hazard_keywords (hazard_type, keyword) VALUES ($1, $2)
     ON CONFLICT (hazard_type, keyword) DO NOTHING RETURNING *`,
    [data.hazard_type, data.keyword]
  );
  return res.rows[0] || null;
}

export async function deleteHazardKeyword(id) {
  await pool.query('DELETE FROM ref_hazard_keywords WHERE id = $1', [id]);
}

// ── Domains ───────────────────────────────────────────────────────────

export async function getDomains() {
  const res = await pool.query('SELECT * FROM ref_domains ORDER BY sort_order, id');
  return res.rows;
}

export async function upsertDomain(data) {
  const res = await pool.query(
    `INSERT INTO ref_domains (name, sort_order) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order RETURNING *`,
    [data.name, data.sort_order || 0]
  );
  return res.rows[0];
}

export async function deleteDomain(id) {
  await pool.query('DELETE FROM ref_domains WHERE id = $1', [id]);
}

// ── Domain Profiles ──────────────────────────────────────────────────

export async function getDomainProfiles(categoryId) {
  const params = [];
  let where = '';
  if (categoryId) { where = 'WHERE category_id = $1'; params.push(categoryId); }
  const res = await pool.query(`SELECT * FROM ref_domain_profiles ${where} ORDER BY category_id, domain_name`, params);
  return res.rows;
}

export async function upsertDomainProfile(data) {
  const res = await pool.query(
    `INSERT INTO ref_domain_profiles (category_id, domain_name, weight) VALUES ($1, $2, $3)
     ON CONFLICT (category_id, domain_name) DO UPDATE SET weight = EXCLUDED.weight RETURNING *`,
    [data.category_id, data.domain_name, data.weight]
  );
  return res.rows[0];
}

export async function deleteDomainProfile(id) {
  await pool.query('DELETE FROM ref_domain_profiles WHERE id = $1', [id]);
}

// ── Scoring Bands ─────────────────────────────────────────────────────

export async function getScoringBands() {
  const res = await pool.query('SELECT * FROM ref_scoring_bands ORDER BY min_score DESC');
  return res.rows;
}

export async function upsertScoringBand(data) {
  // Check for existing rows with same band (prevent duplicates)
  const existing = await pool.query('SELECT id FROM ref_scoring_bands WHERE band = $1', [data.band]);

  if (existing.rows.length > 0) {
    // Update the first match
    const res = await pool.query(
      `UPDATE ref_scoring_bands
       SET min_score = $1, max_score = $2, color = $3, escalation = $4, sort_order = $5
       WHERE band = $6
       RETURNING *`,
      [data.min_score, data.max_score, data.color, data.escalation, data.sort_order || 0, data.band]
    );
    return res.rows[0];
  }

  // Insert new row
  const res = await pool.query(
    `INSERT INTO ref_scoring_bands (min_score, max_score, band, color, escalation, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [data.min_score, data.max_score, data.band, data.color, data.escalation, data.sort_order || 0]
  );
  return res.rows[0];
}

export async function deleteScoringBand(id) {
  await pool.query('DELETE FROM ref_scoring_bands WHERE id = $1', [id]);
}

// ── EDPS Factors ─────────────────────────────────────────────────────

export async function getEdpsFactors() {
  const res = await pool.query('SELECT * FROM ref_edps_factors ORDER BY sort_order, id');
  return res.rows;
}

export async function upsertEdpsFactor(data) {
  const res = await pool.query(
    `INSERT INTO ref_edps_factors (label, key, weight, active, description, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (key) DO UPDATE SET
       label=EXCLUDED.label, weight=EXCLUDED.weight,
       active=COALESCE(EXCLUDED.active, ref_edps_factors.active),
       description=COALESCE(EXCLUDED.description, ref_edps_factors.description),
       sort_order=EXCLUDED.sort_order
     RETURNING *`,
    [data.label, data.key, data.weight,
     data.active !== undefined ? data.active : null,
     data.description ?? null,
     data.sort_order || 0]
  );
  return res.rows[0];
}

export async function deleteEdpsFactor(id) {
  await pool.query('DELETE FROM ref_edps_factors WHERE id = $1', [id]);
}

// ── Band Values ──────────────────────────────────────────────────────

export async function getBandValues(bandType) {
  const params = [];
  let where = '';
  if (bandType) { where = 'WHERE band_type = $1'; params.push(bandType); }
  const res = await pool.query(`SELECT * FROM ref_band_values ${where} ORDER BY band_type, sort_order, id`, params);
  return res.rows;
}

export async function upsertBandValue(data) {
  const res = await pool.query(
    `INSERT INTO ref_band_values (band_type, band, numeric_value, sort_order) VALUES ($1,$2,$3,$4)
     ON CONFLICT (band_type, band) DO UPDATE SET numeric_value=EXCLUDED.numeric_value, sort_order=EXCLUDED.sort_order
     RETURNING *`,
    [data.band_type, data.band, data.numeric_value, data.sort_order || 0]
  );
  return res.rows[0];
}

export async function deleteBandValue(id) {
  await pool.query('DELETE FROM ref_band_values WHERE id = $1', [id]);
}

// ── WMO Codes ────────────────────────────────────────────────────────

export async function getWmoCodes() {
  const res = await pool.query('SELECT * FROM ref_wmo_codes ORDER BY wmo_code');
  return res.rows;
}

export async function upsertWmoCode(data) {
  const res = await pool.query(
    `INSERT INTO ref_wmo_codes (wmo_code, hazard_type) VALUES ($1, $2)
     ON CONFLICT (wmo_code) DO UPDATE SET hazard_type=EXCLUDED.hazard_type RETURNING *`,
    [data.wmo_code, data.hazard_type]
  );
  return res.rows[0];
}

export async function deleteWmoCode(wmoCode) {
  await pool.query('DELETE FROM ref_wmo_codes WHERE wmo_code = $1', [wmoCode]);
}

// ── LLM Providers ────────────────────────────────────────────────────

export async function getLlmProviders() {
  const res = await pool.query('SELECT * FROM ref_llm_providers ORDER BY sort_order, key');
  return res.rows;
}

export async function upsertLlmProvider(data) {
  const sql = `
    INSERT INTO ref_llm_providers (key, name, default_model, models, key_prefix, key_url, docs, color, needs_base, key_required, is_custom, description, sort_order, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (key) DO UPDATE SET
      name=EXCLUDED.name, default_model=EXCLUDED.default_model, models=EXCLUDED.models,
      key_prefix=EXCLUDED.key_prefix, key_url=EXCLUDED.key_url, docs=EXCLUDED.docs,
      color=EXCLUDED.color, needs_base=EXCLUDED.needs_base, key_required=EXCLUDED.key_required,
      is_custom=EXCLUDED.is_custom, description=EXCLUDED.description,
      sort_order=EXCLUDED.sort_order, active=EXCLUDED.active
    RETURNING *`;
  const p = [data.key, data.name, data.default_model, JSON.stringify(data.models || []),
    data.key_prefix, data.key_url, data.docs, data.color, !!data.needs_base,
    data.key_required !== false, !!data.is_custom, data.description, data.sort_order || 0, data.active !== false];
  const res = await pool.query(sql, p);
  return res.rows[0];
}

export async function deleteLlmProvider(key) {
  await pool.query('DELETE FROM ref_llm_providers WHERE key = $1', [key]);
}

// ── Connector Configs ────────────────────────────────────────────────

export async function getConnectors(connector) {
  const params = [];
  let where = '';
  if (connector) { where = 'WHERE connector = $1'; params.push(connector); }
  const res = await pool.query(`SELECT * FROM ref_connectors ${where} ORDER BY connector, config_key`, params);
  return res.rows;
}

export async function upsertConnectorConfig(data) {
  const res = await pool.query(
    `INSERT INTO ref_connectors (connector, config_key, config_value, config_type, description)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (connector, config_key) DO UPDATE SET
       config_value=EXCLUDED.config_value, config_type=EXCLUDED.config_type, description=EXCLUDED.description
     RETURNING *`,
    [data.connector, data.config_key, data.config_value, data.config_type || 'string', data.description]
  );
  return res.rows[0];
}

export async function deleteConnectorConfig(id) {
  await pool.query('DELETE FROM ref_connectors WHERE id = $1', [id]);
}

// ── GDELT Queries ─────────────────────────────────────────────────────

export async function getGdeltQueries(category) {
  const params = [];
  let where = '';
  if (category) { where = 'WHERE category = $1'; params.push(category); }
  const res = await pool.query(`SELECT * FROM ref_gdelt_queries ${where} ORDER BY category, id`, params);
  return res.rows;
}

export async function upsertGdeltQuery(data) {
  // Try update first (category is the logical key)
  const updated = await pool.query(
    `UPDATE ref_gdelt_queries SET query_text = $1, active = $2 WHERE category = $3 RETURNING *`,
    [data.query_text, data.active !== false, data.category]
  );
  if (updated.rows.length > 0) return updated.rows[0];

  const res = await pool.query(
    `INSERT INTO ref_gdelt_queries (category, query_text, active) VALUES ($1,$2,$3) RETURNING *`,
    [data.category, data.query_text, data.active !== false]
  );
  return res.rows[0];
}

export async function deleteGdeltQuery(id) {
  await pool.query('DELETE FROM ref_gdelt_queries WHERE id = $1', [id]);
}

// ── Subreddits ───────────────────────────────────────────────────────

export async function getSubreddits() {
  const res = await pool.query('SELECT * FROM ref_subreddits ORDER BY sort_order, id');
  return res.rows;
}

export async function upsertSubreddit(data) {
  const res = await pool.query(
    `INSERT INTO ref_subreddits (name, active, sort_order) VALUES ($1,$2,$3)
     ON CONFLICT (name) DO UPDATE SET active=EXCLUDED.active, sort_order=EXCLUDED.sort_order
     RETURNING *`,
    [data.name, data.active !== false, data.sort_order || 0]
  );
  return res.rows[0];
}

export async function deleteSubreddit(id) {
  await pool.query('DELETE FROM ref_subreddits WHERE id = $1', [id]);
}

// ── Flight Routes ───────────────────────────────────────────────────

export async function getFlightRoutes(routeType) {
  const params = [];
  let where = '';
  if (routeType) { where = 'WHERE route_type = $1'; params.push(routeType); }
  const res = await pool.query(`SELECT * FROM ref_flight_routes ${where} ORDER BY origin, dest`, params);
  return res.rows;
}

export async function upsertFlightRoute(data) {
  const res = await pool.query(
    `INSERT INTO ref_flight_routes (origin, dest, airline_code, route_type, active)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (origin, dest, airline_code) DO UPDATE SET
       route_type=EXCLUDED.route_type, active=EXCLUDED.active
     RETURNING *`,
    [data.origin, data.dest, data.airline_code || null, data.route_type || 'domestic', data.active !== false]
  );
  return res.rows[0];
}

export async function deleteFlightRoute(id) {
  await pool.query('DELETE FROM ref_flight_routes WHERE id = $1', [id]);
}

// ── Mock Scenarios ───────────────────────────────────────────────────

export async function getMockScenarios(filter = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (filter.agent_type) { conditions.push(`agent_type = $${idx++}`); params.push(filter.agent_type); }
  if (filter.region) { conditions.push(`region = $${idx++}`); params.push(filter.region); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const res = await pool.query(`SELECT * FROM ref_mock_scenarios ${where} ORDER BY agent_type, region, sort_order, id`, params);
  return res.rows;
}

export async function upsertMockScenario(data) {
  const res = await pool.query(
    `INSERT INTO ref_mock_scenarios (agent_type, region, sub_region, name, hazard_type, airports, lat, lon, radius_km, summary, factor_hints, active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [data.agent_type, data.region, data.sub_region, data.name, data.hazard_type,
     JSON.stringify(data.airports || []), data.lat, data.lon, data.radius_km, data.summary,
     JSON.stringify(data.factor_hints || {}), data.active !== false, data.sort_order || 0]
  );
  return res.rows[0];
}

export async function deleteMockScenario(id) {
  await pool.query('DELETE FROM ref_mock_scenarios WHERE id = $1', [id]);
}

// ── Summary ──────────────────────────────────────────────────────────

export async function getSummary() {
  const tables = [
    'ref_airports', 'ref_airlines', 'ref_regions', 'ref_sub_regions',
    'ref_region_countries', 'ref_categories', 'ref_agent_types',
    'ref_hazard_types', 'ref_hazard_keywords', 'ref_domains',
    'ref_domain_profiles', 'ref_scoring_bands', 'ref_edps_factors',
    'ref_band_values', 'ref_wmo_codes', 'ref_llm_providers',
    'ref_connectors', 'ref_gdelt_queries', 'ref_subreddits',
    'ref_flight_routes', 'ref_mock_scenarios',
  ];
  const result = {};
  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*) as count FROM ${t}`);
    result[t] = parseInt(res.rows[0].count, 10);
  }
  return result;
}
