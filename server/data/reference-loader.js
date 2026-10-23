// reference-loader.js — Bridge between ref_* master data tables and existing code.
//
// Loads all ref_* tables into in-memory maps on startup, refreshes every 60s,
// and exposes getter functions with the SAME names and return shapes as the
// existing hardcoded data modules. Every getter falls back to the existing
// hardcoded values if the DB is empty or unavailable.
//
// Usage:
//   import * as ref from './data/reference-loader.js';
//   await ref.loadAll();          // call once on startup
//   ref.getAirport('BLR');        // { iata, icao, name, city, country, lat, lon, scheduled, ... }
//   ref.getAllAirports();         // [{ iata, icao, name, ... }]
//
// The loader never throws — if the DB is down, it silently uses fallbacks.

import pool from '../db/pool.js';

// Existing hardcoded modules (used as fallbacks)
// We import the raw consts directly (not the functions) to avoid circular
// dependency — airport-airline-data.js now delegates its functions to this
// loader, so calling its functions would create infinite recursion.
// NOTE: We do NOT import from airport-lookup.js or agent-base.js because
// they trigger module-level code execution that creates circular dependencies.
// We build all fallbacks from AIRPORTS/AIRLINES/REGION_COUNTRIES below.
import {
  AIRPORTS as _FB_AIRPORTS,
  AIRLINES as _FB_AIRLINES,
  REGION_COUNTRIES as _FB_REGION_COUNTRIES,
} from './airport-airline-data.js';
import agentConfig from '../../src/data/agent-config.json' with { type: 'json' };

// Build coords fallback lazily from AIRPORTS array (same shape as airport-lookup.js AIRPORTS)
// Must be lazy because AIRPORTS may not be initialized at module load time
// due to circular dependency.
let _fbAirportCoordsCache = null;
function _fbAirportCoords() {
  if (_fbAirportCoordsCache) return _fbAirportCoordsCache;
  _fbAirportCoordsCache = {};
  for (const a of _FB_AIRPORTS) {
    _fbAirportCoordsCache[a.iata] = { lat: a.lat, lon: a.lon, name: a.city || a.name };
  }
  return _fbAirportCoordsCache;
}

// Build IATA↔ICAO fallback lazily from AIRPORTS array
let _fbIataToIcaoCache = null;
function _fbIataToIcao() {
  if (_fbIataToIcaoCache) return _fbIataToIcaoCache;
  _fbIataToIcaoCache = {};
  for (const a of _FB_AIRPORTS) {
    if (a.iata && a.icao) _fbIataToIcaoCache[a.iata] = a.icao;
  }
  return _fbIataToIcaoCache;
}

let _fbIcaoToIataCache = null;
function _fbIcaoToIata() {
  if (_fbIcaoToIataCache) return _fbIcaoToIataCache;
  _fbIcaoToIataCache = {};
  for (const a of _FB_AIRPORTS) {
    if (a.iata && a.icao) _fbIcaoToIataCache[a.icao] = a.iata;
  }
  return _fbIcaoToIataCache;
}

// ── In-memory cache ──────────────────────────────────────────────────
// Each map is keyed by the table's primary key. Refreshed every 60s.

const _cache = {
  airports: new Map(),          // iata → row
  airportsByRegion: new Map(),  // region_id → [iata, ...]
  airportsByCountry: new Map(),  // country → [iata, ...]
  airportCoords: new Map(),     // iata → { lat, lon, name } (lookup format)
  airportRegion: new Map(),     // iata → region_id
  iataToIcao: new Map(),        // iata → icao
  icaoToIata: new Map(),        // icao → iata
  airlines: new Map(),          // iata → row
  airlineHubs: new Map(),       // iata → { primary, secondary }
  airlineFleetCaps: new Map(),  // iata → bool (CAT III)
  regions: new Map(),           // id → row
  regionCountries: new Map(),   // region_id → [country, ...]
  subRegions: new Map(),        // id → row
  subRegionsByRegion: new Map(),// region_id → [row, ...]
  categories: new Map(),        // id → row
  categoriesBySop: new Map(),   // sop_key → row
  categoriesByName: new Map(), // name → row
  agentTypes: new Map(),        // type → row
  agentTypeByCategory: new Map(),// category_id → [row, ...]
  hazardTypes: new Map(),       // hazard_type → row
  hazardFamily: new Map(),      // hazard_type → family
  hazardRequiresCat3: new Map(),// hazard_type → bool
  hazardKeywords: new Map(),    // hazard_type → [keyword, ...]
  keywordToHazard: new Map(),   // keyword → hazard_type
  domains: new Map(),           // name → row
  domainProfiles: new Map(),   // category_id → [{ domain_name, weight }]
  scoringBands: new Map(),      // id → row
  scoringBandsSorted: [],       // sorted array
  edpsFactors: new Map(),       // key → row
  edpsFactorsSorted: [],        // sorted array
  bandValues: new Map(),        // band_type → Map(band → numeric_value)
  wmoCodes: new Map(),          // wmo_code → hazard_type
  wmoSevereCodes: new Set(),    // set of severe wmo codes
  llmProviders: new Map(),      // key → row
  connectors: new Map(),        // connector → Map(config_key → config_value)
  gdeltQueries: new Map(),     // category → query_text
  subreddits: [],               // array of names
  flightRoutes: [],             // array of rows
  mockScenarios: [],            // array of rows
  summary: {},                  // table → count
};

let _loaded = false;
let _loading = false;
let _refreshTimer = null;
const REFRESH_INTERVAL_MS = 60_000;

// ── Load all tables ──────────────────────────────────────────────────

export async function loadAll() {
  if (_loading) return;
  _loading = true;
  try {
    await Promise.all([
      _loadAirports(),
      _loadAirlines(),
      _loadRegions(),
      _loadRegionCountries(),
      _loadSubRegions(),
      _loadCategories(),
      _loadAgentTypes(),
      _loadHazardTypes(),
      _loadHazardKeywords(),
      _loadDomains(),
      _loadDomainProfiles(),
      _loadScoringBands(),
      _loadEdpsFactors(),
      _loadBandValues(),
      _loadWmoCodes(),
      _loadLlmProviders(),
      _loadConnectors(),
      _loadGdeltQueries(),
      _loadSubreddits(),
      _loadFlightRoutes(),
      _loadMockScenarios(),
      _loadSummary(),
    ]);
    _loaded = true;
  } catch (e) {
    // Silent — fallbacks will be used
    console.warn('[reference-loader] DB load failed, using fallbacks:', e.message);
  } finally {
    _loading = false;
  }
  _scheduleRefresh();
}

function _scheduleRefresh() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(() => { loadAll().catch(() => {}); }, REFRESH_INTERVAL_MS);
}

export function isLoaded() { return _loaded; }

// ── Individual loaders ──────────────────────────────────────────────

async function _loadAirports() {
  const { rows } = await pool.query('SELECT * FROM ref_airports WHERE active = true ORDER BY iata');
  _cache.airports.clear();
  _cache.airportsByRegion.clear();
  _cache.airportsByCountry.clear();
  _cache.airportCoords.clear();
  _cache.airportRegion.clear();
  _cache.iataToIcao.clear();
  _cache.icaoToIata.clear();

  for (const r of rows) {
    // Main airports array shape (matches airport-airline-data.js AIRPORTS)
    _cache.airports.set(r.iata, {
      iata: r.iata,
      icao: r.icao,
      name: r.name,
      city: r.city,
      country: r.country,
      lat: r.lat,
      lon: r.lon,
      scheduled: r.scheduled,
      region_id: r.region_id,
      daily_movements: r.daily_movements,
      cat3_capable: r.cat3_capable,
      active: r.active,
    });

    // Airport-lookup shape (matches airport-lookup.js AIRPORTS)
    _cache.airportCoords.set(r.iata, { lat: r.lat, lon: r.lon, name: r.city || r.name });

    // Region index
    if (r.region_id) {
      if (!_cache.airportsByRegion.has(r.region_id)) _cache.airportsByRegion.set(r.region_id, []);
      _cache.airportsByRegion.get(r.region_id).push(r.iata);
      _cache.airportRegion.set(r.iata, r.region_id);
    }

    // Country index
    if (!_cache.airportsByCountry.has(r.country)) _cache.airportsByCountry.set(r.country, []);
    _cache.airportsByCountry.get(r.country).push(r.iata);

    // IATA ↔ ICAO
    if (r.icao) {
      _cache.iataToIcao.set(r.iata, r.icao);
      _cache.icaoToIata.set(r.icao, r.iata);
    }
  }
}

async function _loadAirlines() {
  const { rows } = await pool.query('SELECT * FROM ref_airlines WHERE active = true ORDER BY iata');
  _cache.airlines.clear();
  _cache.airlineHubs.clear();
  _cache.airlineFleetCaps.clear();

  for (const r of rows) {
    const secondary = Array.isArray(r.hub_secondary) ? r.hub_secondary : [];

    // Full airline record (superset of the hardcoded AIRLINES shape)
    _cache.airlines.set(r.iata, {
      iata: r.iata,
      icao: r.icao,
      name: r.name,
      country: r.country,
      active: r.active,
      // DB-only fields (used by real-airline-registry and flight-estimator)
      hub_primary: r.hub_primary,
      hub_secondary: secondary,
      cat3_capable: !!r.cat3_capable,
      narrowbody_type: r.narrowbody_type,
      widebody_type: r.widebody_type,
    });

    _cache.airlineHubs.set(r.iata, {
      primary: r.hub_primary,
      secondary,
    });

    _cache.airlineFleetCaps.set(r.iata, !!r.cat3_capable);
  }
}

async function _loadRegions() {
  const { rows } = await pool.query('SELECT * FROM ref_regions WHERE active = true ORDER BY sort_order, id');
  _cache.regions.clear();
  for (const r of rows) {
    _cache.regions.set(r.id, { id: r.id, name: r.name, sort_order: r.sort_order, active: r.active });
  }
}

async function _loadRegionCountries() {
  const { rows } = await pool.query('SELECT region_id, country FROM ref_region_countries ORDER BY region_id, country');
  _cache.regionCountries.clear();
  for (const r of rows) {
    if (!_cache.regionCountries.has(r.region_id)) _cache.regionCountries.set(r.region_id, []);
    _cache.regionCountries.get(r.region_id).push(r.country);
  }
}

async function _loadSubRegions() {
  const { rows } = await pool.query('SELECT * FROM ref_sub_regions WHERE active = true ORDER BY region_id, id');
  _cache.subRegions.clear();
  _cache.subRegionsByRegion.clear();
  for (const r of rows) {
    const row = {
      id: r.id,
      region_id: r.region_id,
      name: r.name,
      bbox: r.bbox,
      active: r.active,
    };
    _cache.subRegions.set(r.id, row);
    if (!_cache.subRegionsByRegion.has(r.region_id)) _cache.subRegionsByRegion.set(r.region_id, []);
    _cache.subRegionsByRegion.get(r.region_id).push(row);
  }
}

async function _loadCategories() {
  const { rows } = await pool.query('SELECT * FROM ref_categories WHERE active = true ORDER BY sort_order, id');
  _cache.categories.clear();
  _cache.categoriesBySop.clear();
  _cache.categoriesByName.clear();
  for (const r of rows) {
    const row = {
      id: r.id,
      name: r.name,
      sop_key: r.sop_key,
      color: r.color,
      icon: r.icon,
      sort_order: r.sort_order,
      active: r.active,
    };
    _cache.categories.set(r.id, row);
    if (r.sop_key) _cache.categoriesBySop.set(r.sop_key, row);
    if (r.name) _cache.categoriesByName.set(r.name, row);
  }
}

async function _loadAgentTypes() {
  const { rows } = await pool.query('SELECT * FROM ref_agent_types WHERE active = true ORDER BY type');
  _cache.agentTypes.clear();
  _cache.agentTypeByCategory.clear();
  for (const r of rows) {
    const row = {
      type: r.type,
      category_id: r.category_id,
      label: r.label,
      icon: r.icon,
      color: r.color,
      poll_interval_min: r.poll_interval_min,
      active: r.active,
    };
    _cache.agentTypes.set(r.type, row);
    if (!_cache.agentTypeByCategory.has(r.category_id)) _cache.agentTypeByCategory.set(r.category_id, []);
    _cache.agentTypeByCategory.get(r.category_id).push(row);
  }
}

async function _loadHazardTypes() {
  const { rows } = await pool.query('SELECT * FROM ref_hazard_types WHERE active = true ORDER BY hazard_type');
  _cache.hazardTypes.clear();
  _cache.hazardFamily.clear();
  _cache.hazardRequiresCat3.clear();
  for (const r of rows) {
    _cache.hazardTypes.set(r.hazard_type, {
      hazard_type: r.hazard_type,
      family: r.family,
      requires_cat3: r.requires_cat3,
      default_severity: r.default_severity,
      default_sev_val: r.default_sev_val,
      active: r.active,
    });
    _cache.hazardFamily.set(r.hazard_type, r.family);
    _cache.hazardRequiresCat3.set(r.hazard_type, !!r.requires_cat3);
  }
}

async function _loadHazardKeywords() {
  const { rows } = await pool.query('SELECT hazard_type, keyword FROM ref_hazard_keywords ORDER BY hazard_type, keyword');
  _cache.hazardKeywords.clear();
  _cache.keywordToHazard.clear();
  for (const r of rows) {
    if (!_cache.hazardKeywords.has(r.hazard_type)) _cache.hazardKeywords.set(r.hazard_type, []);
    _cache.hazardKeywords.get(r.hazard_type).push(r.keyword);
    _cache.keywordToHazard.set(r.keyword.toLowerCase(), r.hazard_type);
  }
}

async function _loadDomains() {
  const { rows } = await pool.query('SELECT * FROM ref_domains ORDER BY sort_order, name');
  _cache.domains.clear();
  for (const r of rows) {
    _cache.domains.set(r.name, { id: r.id, name: r.name, sort_order: r.sort_order });
  }
}

async function _loadDomainProfiles() {
  const { rows } = await pool.query('SELECT category_id, domain_name, weight FROM ref_domain_profiles ORDER BY category_id, domain_name');
  _cache.domainProfiles.clear();
  for (const r of rows) {
    if (!_cache.domainProfiles.has(r.category_id)) _cache.domainProfiles.set(r.category_id, []);
    _cache.domainProfiles.get(r.category_id).push({ domain_name: r.domain_name, weight: parseFloat(r.weight) });
  }
}

async function _loadScoringBands() {
  const { rows } = await pool.query('SELECT * FROM ref_scoring_bands ORDER BY sort_order, min_score');
  _cache.scoringBands.clear();
  _cache.scoringBandsSorted = rows.map(r => ({
    id: r.id,
    min_score: r.min_score,
    max_score: r.max_score,
    band: r.band,
    color: r.color,
    escalation: r.escalation,
    sort_order: r.sort_order,
  }));
  for (const r of _cache.scoringBandsSorted) {
    _cache.scoringBands.set(r.id, r);
  }
}

async function _loadEdpsFactors() {
  const { rows } = await pool.query('SELECT * FROM ref_edps_factors ORDER BY sort_order, id');
  _cache.edpsFactors.clear();
  _cache.edpsFactorsSorted = rows.map(r => ({
    id: r.id,
    label: r.label,
    key: r.key,
    weight: parseFloat(r.weight),
    active: r.active !== false,
    description: r.description || null,
    sort_order: r.sort_order,
  }));
  for (const r of _cache.edpsFactorsSorted) {
    _cache.edpsFactors.set(r.key, r);
  }
}

async function _loadBandValues() {
  const { rows } = await pool.query('SELECT band_type, band, numeric_value FROM ref_band_values ORDER BY band_type, sort_order');
  _cache.bandValues.clear();
  for (const r of rows) {
    if (!_cache.bandValues.has(r.band_type)) _cache.bandValues.set(r.band_type, new Map());
    _cache.bandValues.get(r.band_type).set(r.band, r.numeric_value);
  }
}

async function _loadWmoCodes() {
  const { rows } = await pool.query('SELECT wmo_code, hazard_type FROM ref_wmo_codes ORDER BY wmo_code');
  _cache.wmoCodes.clear();
  _cache.wmoSevereCodes.clear();
  for (const r of rows) {
    _cache.wmoCodes.set(r.wmo_code, r.hazard_type);
    // Severe codes are those mapping to thunderstorm, snow, heavy_rain, fog
    if (['thunderstorm', 'snow', 'heavy_rain', 'fog'].includes(r.hazard_type)) {
      _cache.wmoSevereCodes.add(r.wmo_code);
    }
  }
}

async function _loadLlmProviders() {
  const { rows } = await pool.query('SELECT * FROM ref_llm_providers WHERE active = true ORDER BY sort_order, key');
  _cache.llmProviders.clear();
  for (const r of rows) {
    _cache.llmProviders.set(r.key, {
      key: r.key,
      name: r.name,
      default_model: r.default_model,
      models: Array.isArray(r.models) ? r.models : [],
      key_prefix: r.key_prefix,
      key_url: r.key_url,
      docs: r.docs,
      color: r.color,
      needs_base: r.needs_base,
      key_required: r.key_required,
      is_custom: r.is_custom,
      description: r.description,
      sort_order: r.sort_order,
      active: r.active,
    });
  }
}

async function _loadConnectors() {
  const { rows } = await pool.query('SELECT connector, config_key, config_value, config_type FROM ref_connectors ORDER BY connector, config_key');
  _cache.connectors.clear();
  for (const r of rows) {
    if (!_cache.connectors.has(r.connector)) _cache.connectors.set(r.connector, new Map());
    let val = r.config_value;
    if (r.config_type === 'int') val = parseInt(val, 10);
    else if (r.config_type === 'float') val = parseFloat(val);
    else if (r.config_type === 'bool') val = val === 'true' || val === '1';
    _cache.connectors.get(r.connector).set(r.config_key, val);
  }
}

async function _loadGdeltQueries() {
  const { rows } = await pool.query('SELECT category, query_text FROM ref_gdelt_queries WHERE active = true ORDER BY category');
  _cache.gdeltQueries.clear();
  for (const r of rows) {
    _cache.gdeltQueries.set(r.category, r.query_text);
  }
}

async function _loadSubreddits() {
  const { rows } = await pool.query('SELECT name FROM ref_subreddits WHERE active = true ORDER BY sort_order, name');
  _cache.subreddits = rows.map(r => r.name);
}

async function _loadFlightRoutes() {
  const { rows } = await pool.query('SELECT origin, dest, airline_code, route_type, active FROM ref_flight_routes WHERE active = true ORDER BY origin, dest');
  _cache.flightRoutes = rows.map(r => ({
    origin: r.origin,
    dest: r.dest,
    airline_code: r.airline_code,
    route_type: r.route_type,
    active: r.active,
  }));
}

async function _loadMockScenarios() {
  const { rows } = await pool.query('SELECT * FROM ref_mock_scenarios WHERE active = true ORDER BY sort_order, id');
  _cache.mockScenarios = rows.map(r => ({
    id: r.id,
    agent_type: r.agent_type,
    region: r.region,
    sub_region: r.sub_region,
    name: r.name,
    hazard_type: r.hazard_type,
    airports: Array.isArray(r.airports) ? r.airports : [],
    lat: r.lat,
    lon: r.lon,
    radius_km: r.radius_km,
    summary: r.summary,
    factor_hints: r.factor_hints || {},
    active: r.active,
    sort_order: r.sort_order,
  }));
}

async function _loadSummary() {
  const { rows } = await pool.query(`
    SELECT 'ref_airports' AS t, COUNT(*) AS c FROM ref_airports
    UNION ALL SELECT 'ref_airlines', COUNT(*) FROM ref_airlines
    UNION ALL SELECT 'ref_regions', COUNT(*) FROM ref_regions
    UNION ALL SELECT 'ref_sub_regions', COUNT(*) FROM ref_sub_regions
    UNION ALL SELECT 'ref_region_countries', COUNT(*) FROM ref_region_countries
    UNION ALL SELECT 'ref_categories', COUNT(*) FROM ref_categories
    UNION ALL SELECT 'ref_agent_types', COUNT(*) FROM ref_agent_types
    UNION ALL SELECT 'ref_hazard_types', COUNT(*) FROM ref_hazard_types
    UNION ALL SELECT 'ref_hazard_keywords', COUNT(*) FROM ref_hazard_keywords
    UNION ALL SELECT 'ref_domains', COUNT(*) FROM ref_domains
    UNION ALL SELECT 'ref_domain_profiles', COUNT(*) FROM ref_domain_profiles
    UNION ALL SELECT 'ref_scoring_bands', COUNT(*) FROM ref_scoring_bands
    UNION ALL SELECT 'ref_edps_factors', COUNT(*) FROM ref_edps_factors
    UNION ALL SELECT 'ref_band_values', COUNT(*) FROM ref_band_values
    UNION ALL SELECT 'ref_wmo_codes', COUNT(*) FROM ref_wmo_codes
    UNION ALL SELECT 'ref_llm_providers', COUNT(*) FROM ref_llm_providers
    UNION ALL SELECT 'ref_connectors', COUNT(*) FROM ref_connectors
    UNION ALL SELECT 'ref_gdelt_queries', COUNT(*) FROM ref_gdelt_queries
    UNION ALL SELECT 'ref_subreddits', COUNT(*) FROM ref_subreddits
    UNION ALL SELECT 'ref_flight_routes', COUNT(*) FROM ref_flight_routes
    UNION ALL SELECT 'ref_mock_scenarios', COUNT(*) FROM ref_mock_scenarios
  `);
  _cache.summary = {};
  for (const r of rows) _cache.summary[r.t] = parseInt(r.c, 10);
}

// ── Public getters (with fallbacks) ─────────────────────────────────
// Each getter tries the DB cache first, then falls back to the existing
// hardcoded values. The return shapes match the existing functions exactly.

// ── Airports ────────────────────────────────────────────────────────

export function getAllAirports() {
  if (_cache.airports.size > 0) return Array.from(_cache.airports.values());
  return _FB_AIRPORTS;
}

export function getAirport(iata) {
  const fromDb = _cache.airports.get(iata);
  if (fromDb) return fromDb;
  return _FB_AIRPORTS.find(a => a.iata === iata) || null;
}

export function getAirportsByRegion(regionId) {
  if (_cache.airportsByRegion.has(regionId)) {
    return _cache.airportsByRegion.get(regionId)
      .map(iata => _cache.airports.get(iata))
      .filter(Boolean);
  }
  // Fallback: filter by country
  const countries = _FB_REGION_COUNTRIES[regionId] || [];
  return _FB_AIRPORTS.filter(a => countries.includes(a.country));
}

export function getAirportsByCountry(country) {
  if (_cache.airportsByCountry.has(country)) {
    return _cache.airportsByCountry.get(country)
      .map(iata => _cache.airports.get(iata))
      .filter(Boolean);
  }
  return _FB_AIRPORTS.filter(a => a.country === country);
}

// Airport-lookup.js shape: { iata: { lat, lon, name } }
export function getAirportCoords() {
  if (_cache.airportCoords.size > 0) {
    const obj = {};
    for (const [k, v] of _cache.airportCoords) obj[k] = v;
    return obj;
  }
  return _fbAirportCoords();
}

export function getAirportName(iata) {
  const coords = _cache.airportCoords.get(iata);
  if (coords) return coords.name || iata;
  return _fbAirportCoords()[iata]?.name || iata;
}

export function getAirportRegion(iata) {
  if (_cache.airportRegion.has(iata)) return _cache.airportRegion.get(iata);
  // Fallback: derive from hardcoded data
  for (const rid of (agentConfig.regions || []).map(r => r.id)) {
    const countries = _FB_REGION_COUNTRIES[rid] || [];
    const ap = _FB_AIRPORTS.find(a => a.iata === iata);
    if (ap && countries.includes(ap.country)) return rid;
  }
  return null;
}

export function getAirportRegionMap() {
  if (_cache.airportRegion.size > 0) {
    const obj = {};
    for (const [k, v] of _cache.airportRegion) obj[k] = v;
    return obj;
  }
  // Fallback: build from hardcoded data
  const obj = {};
  for (const rid of (agentConfig.regions || []).map(r => r.id)) {
    const countries = _FB_REGION_COUNTRIES[rid] || [];
    for (const a of _FB_AIRPORTS) {
      if (countries.includes(a.country)) obj[a.iata] = rid;
    }
  }
  return obj;
}

// IATA ↔ ICAO
export function getIataToIcao() {
  if (_cache.iataToIcao.size > 0) {
    const obj = {};
    for (const [k, v] of _cache.iataToIcao) obj[k] = v;
    return obj;
  }
  return _fbIataToIcao();
}

export function getIcaoToIata() {
  if (_cache.icaoToIata.size > 0) {
    const obj = {};
    for (const [k, v] of _cache.icaoToIata) obj[k] = v;
    return obj;
  }
  return _fbIcaoToIata();
}

// ── Airlines ─────────────────────────────────────────────────────────

export function getAllAirlines() {
  if (_cache.airlines.size > 0) return Array.from(_cache.airlines.values());
  return _FB_AIRLINES.filter(a => a.active);
}

export function getAirline(iata) {
  const fromDb = _cache.airlines.get(iata);
  if (fromDb) return fromDb;
  return _FB_AIRLINES.find(a => a.iata === iata) || null;
}

export function getAirlineHubs(iata) {
  if (_cache.airlineHubs.has(iata)) return _cache.airlineHubs.get(iata);
  return null; // Fallback: real-airline-registry handles this
}

export function getAirlineCat3(iata) {
  if (_cache.airlineFleetCaps.has(iata)) return _cache.airlineFleetCaps.get(iata);
  return null; // Fallback: real-airline-registry handles this
}

// Narrowbody aircraft type for an airline (DB-backed, fallback to default)
export function getAirlineNarrowbody(iata) {
  const a = _cache.airlines.get(iata);
  if (a && a.narrowbody_type) return a.narrowbody_type;
  return 'A320neo';
}

// Widebody aircraft type for an airline (DB-backed, fallback to default)
export function getAirlineWidebody(iata) {
  const a = _cache.airlines.get(iata);
  if (a && a.widebody_type) return a.widebody_type;
  return 'A350-900';
}

// ── Regions ──────────────────────────────────────────────────────────

export function getAllRegions() {
  if (_cache.regions.size > 0) return Array.from(_cache.regions.values());
  return (agentConfig.regions || []).map((r, i) => ({ id: r.id, name: r.name, sort_order: i, active: true }));
}

export function getRegion(id) {
  if (_cache.regions.has(id)) return _cache.regions.get(id);
  const r = (agentConfig.regions || []).find(r => r.id === id);
  return r ? { id: r.id, name: r.name, sort_order: 0, active: true } : null;
}

export function getRegionCountries(regionId) {
  if (_cache.regionCountries.has(regionId)) return _cache.regionCountries.get(regionId);
  return _FB_REGION_COUNTRIES[regionId] || [];
}

// ── Sub-Regions ──────────────────────────────────────────────────────

export function getSubRegions(regionId) {
  if (regionId && _cache.subRegionsByRegion.has(regionId)) {
    return _cache.subRegionsByRegion.get(regionId);
  }
  if (!regionId && _cache.subRegions.size > 0) {
    return Array.from(_cache.subRegions.values());
  }
  // Fallback: from agent-config
  if (regionId) {
    const r = (agentConfig.regions || []).find(r => r.id === regionId);
    return (r?.subRegions || []).map((s, i) => ({
      id: `${regionId}:${s.id || s.name || i}`,
      region_id: regionId,
      name: s.name || s.id || `Sub ${i}`,
      bbox: s.bbox || null,
      active: true,
    }));
  }
  return [];
}

// ── Categories ───────────────────────────────────────────────────────

export function getAllCategories() {
  if (_cache.categories.size > 0) return Array.from(_cache.categories.values());
  // Fallback: derive from agent-config
  return [
    { id: 'weather', name: 'Weather', sop_key: 'storm', color: '#22D3EE', icon: 'Wx', sort_order: 0, active: true },
    { id: 'atc_airspace', name: 'ATC / Airspace', sop_key: 'atc', color: '#4CC2CE', icon: 'ATC', sort_order: 1, active: true },
    { id: 'industrial', name: 'Industrial action', sop_key: 'ground', color: '#F5A623', icon: 'IA', sort_order: 2, active: true },
    { id: 'geopolitical', name: 'Geopolitical', sop_key: 'airspace', color: '#F0495A', icon: 'Geo', sort_order: 3, active: true },
    { id: 'infrastructure', name: 'Infrastructure', sop_key: 'runway', color: '#E8C34A', icon: 'Inf', sort_order: 4, active: true },
    { id: 'regulatory', name: 'Regulatory', sop_key: 'regulatory', color: '#5B92C9', icon: 'Reg', sort_order: 5, active: true },
  ];
}

export function getCategory(id) {
  if (_cache.categories.has(id)) return _cache.categories.get(id);
  return getAllCategories().find(c => c.id === id) || null;
}

export function getCategoryBySopKey(sopKey) {
  if (_cache.categoriesBySop.has(sopKey)) return _cache.categoriesBySop.get(sopKey);
  return getAllCategories().find(c => c.sop_key === sopKey) || null;
}

export function getCategoryByName(name) {
  if (_cache.categoriesByName.has(name)) return _cache.categoriesByName.get(name);
  return getAllCategories().find(c => c.name === name) || null;
}

// Category name → id map (e.g., 'Weather' → 'weather')
export function getCategoryNameToId() {
  const map = {};
  for (const c of getAllCategories()) {
    if (c.name) map[c.name] = c.id;
  }
  return map;
}

// Category name → sop_key map (e.g., 'Weather' → 'storm')
export function getCategoryNameToSop() {
  const map = {};
  for (const c of getAllCategories()) {
    if (c.name && c.sop_key) map[c.name] = c.sop_key;
  }
  return map;
}

// ── Agent Types ──────────────────────────────────────────────────────

export function getAllAgentTypes() {
  if (_cache.agentTypes.size > 0) return Array.from(_cache.agentTypes.values());
  return [];
}

export function getAgentType(type) {
  if (_cache.agentTypes.has(type)) return _cache.agentTypes.get(type);
  return null;
}

export function getAgentTypesByCategory(categoryId) {
  if (_cache.agentTypeByCategory.has(categoryId)) return _cache.agentTypeByCategory.get(categoryId);
  return [];
}

// ── Hazard Types ─────────────────────────────────────────────────────

export function getAllHazardTypes() {
  if (_cache.hazardTypes.size > 0) return Array.from(_cache.hazardTypes.values());
  return [];
}

export function getHazardType(hazardType) {
  if (_cache.hazardTypes.has(hazardType)) return _cache.hazardTypes.get(hazardType);
  return null;
}

export function getHazardFamily(hazardType) {
  if (_cache.hazardFamily.has(hazardType)) return _cache.hazardFamily.get(hazardType);
  return null;
}

export function getHazardRequiresCat3(hazardType) {
  if (_cache.hazardRequiresCat3.has(hazardType)) return _cache.hazardRequiresCat3.get(hazardType);
  return false;
}

export function getHazardKeywords(hazardType) {
  if (_cache.hazardKeywords.has(hazardType)) return _cache.hazardKeywords.get(hazardType);
  return [];
}

export function getHazardTypeByKeyword(keyword) {
  const lower = keyword.toLowerCase();
  if (_cache.keywordToHazard.has(lower)) return _cache.keywordToHazard.get(lower);
  return null;
}

// ── Domains ──────────────────────────────────────────────────────────

export function getAllDomains() {
  if (_cache.domains.size > 0) return Array.from(_cache.domains.values());
  return [];
}

export function getDomain(name) {
  if (_cache.domains.has(name)) return _cache.domains.get(name);
  return null;
}

export function getDomainProfile(categoryId) {
  if (_cache.domainProfiles.has(categoryId)) return _cache.domainProfiles.get(categoryId);
  return [];
}

// Get domain profile by category name (e.g., 'Weather' → 'weather' → profile)
// Returns { domain_name: weight } map matching the existing CATEGORY_PROFILES shape.
export function getDomainProfileByName(categoryName) {
  const cat = getCategoryByName(categoryName);
  if (!cat) return null;
  const profile = getDomainProfile(cat.id);
  if (profile.length === 0) return null;
  const map = {};
  for (const p of profile) map[p.domain_name] = p.weight;
  return map;
}

// ── Scoring Bands ────────────────────────────────────────────────────

export function getScoringBands() {
  if (_cache.scoringBandsSorted.length > 0) return _cache.scoringBandsSorted;
  return agentConfig.scoreBands || [];
}

export function getScoreBandLabel(score) {
  const bands = getScoringBands();
  for (const b of bands) {
    const min = b.min_score ?? b.min;
    const max = b.max_score ?? b.max;
    if (score >= min && score <= max) return b.band;
  }
  return bands[bands.length - 1]?.band || 'Unknown';
}

export function getScoreBandEscalation(score) {
  const bands = getScoringBands();
  for (const b of bands) {
    const min = b.min_score ?? b.min;
    const max = b.max_score ?? b.max;
    if (score >= min && score <= max) return b.escalation;
  }
  return bands[bands.length - 1]?.escalation || 'L1';
}

// ── EDPS Factors ─────────────────────────────────────────────────────

export function getEdpsFactors() {
  if (_cache.edpsFactorsSorted.length > 0) return _cache.edpsFactorsSorted;
  return agentConfig.edpsFactors || [];
}

export function getEdpsFactor(key) {
  if (_cache.edpsFactors.has(key)) return _cache.edpsFactors.get(key);
  return (agentConfig.edpsFactors || []).find(f => f.key === key) || null;
}

// ── Band Values ──────────────────────────────────────────────────────

export function getBandValue(bandType, band) {
  if (_cache.bandValues.has(bandType)) {
    const m = _cache.bandValues.get(bandType);
    if (m.has(band)) return m.get(band);
  }
  return null;
}

export function getBandValues(bandType) {
  if (_cache.bandValues.has(bandType)) {
    const m = _cache.bandValues.get(bandType);
    return Array.from(m.entries()).map(([band, numeric_value]) => ({ band, numeric_value }));
  }
  return [];
}

// ── WMO Codes ────────────────────────────────────────────────────────

export function getWmoHazardType(code) {
  if (_cache.wmoCodes.has(code)) return _cache.wmoCodes.get(code);
  return null;
}

export function isSevereWmoCode(code) {
  return _cache.wmoSevereCodes.has(code);
}

export function getAllWmoCodes() {
  if (_cache.wmoCodes.size > 0) {
    const arr = [];
    for (const [code, hazard] of _cache.wmoCodes) arr.push({ wmo_code: code, hazard_type: hazard });
    return arr;
  }
  return [];
}

// ── LLM Providers ────────────────────────────────────────────────────

export function getLlmProviders() {
  if (_cache.llmProviders.size > 0) return Array.from(_cache.llmProviders.values());
  return [];
}

export function getLlmProvider(key) {
  if (_cache.llmProviders.has(key)) return _cache.llmProviders.get(key);
  return null;
}

// ── Connector Configs ────────────────────────────────────────────────

export function getConnectorConfig(connector, key, fallback = undefined) {
  if (_cache.connectors.has(connector)) {
    const m = _cache.connectors.get(connector);
    if (m.has(key)) return m.get(key);
  }
  return fallback;
}

export function getConnectorConfigs(connector) {
  if (_cache.connectors.has(connector)) {
    const m = _cache.connectors.get(connector);
    return Array.from(m.entries()).map(([k, v]) => ({ config_key: k, config_value: v }));
  }
  return [];
}

// ── GDELT Queries ────────────────────────────────────────────────────

export function getGdeltQuery(category) {
  if (_cache.gdeltQueries.has(category)) return _cache.gdeltQueries.get(category);
  return null;
}

export function getAllGdeltQueries() {
  if (_cache.gdeltQueries.size > 0) {
    const arr = [];
    for (const [cat, q] of _cache.gdeltQueries) arr.push({ category: cat, query_text: q });
    return arr;
  }
  return [];
}

// ── Subreddits ───────────────────────────────────────────────────────

export function getSubreddits() {
  if (_cache.subreddits.length > 0) return _cache.subreddits;
  return ['aviation', 'flightdelay', 'airline', 'ATC', 'flying'];
}

// ── Flight Routes ────────────────────────────────────────────────────

export function getFlightRoutes(routeType) {
  if (_cache.flightRoutes.length === 0) return [];
  if (routeType) return _cache.flightRoutes.filter(r => r.route_type === routeType);
  return _cache.flightRoutes;
}

// ── Mock Scenarios ───────────────────────────────────────────────────

export function getMockScenarios(filter = {}) {
  if (_cache.mockScenarios.length === 0) return [];
  let result = _cache.mockScenarios;
  if (filter.agent_type) result = result.filter(s => s.agent_type === filter.agent_type);
  if (filter.region) result = result.filter(s => s.region === filter.region);
  if (filter.sub_region) result = result.filter(s => s.sub_region === filter.sub_region);
  return result;
}

/**
 * Returns mock scenarios for a specific agent_type + region + sub_region key.
 * Normalizes DB field names (snake_case) to connector format (camelCase).
 * Returns null if DB has no scenarios for this key (caller should use fallback).
 */
export function getMockScenario(region, subRegion, agentType) {
  const rows = getMockScenarios({ agent_type: agentType, region, sub_region: subRegion });
  if (rows.length === 0) return null;
  return rows
    .filter(s => s.active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(s => ({
      name: s.name,
      hazardType: s.hazard_type,
      airports: s.airports || [],
      lat: s.lat,
      lon: s.lon,
      radiusKm: s.radius_km,
      summary: s.summary,
      factorHints: s.factor_hints || {},
    }));
}

// ── Summary ──────────────────────────────────────────────────────────

export function getSummary() {
  return _cache.summary;
}

// ── Default export ───────────────────────────────────────────────────

export default {
  loadAll,
  isLoaded,
  // Airports
  getAllAirports, getAirport, getAirportsByRegion, getAirportsByCountry,
  getAirportCoords, getAirportName, getAirportRegion, getAirportRegionMap,
  getIataToIcao, getIcaoToIata,
  // Airlines
  getAllAirlines, getAirline, getAirlineHubs, getAirlineCat3,
  getAirlineNarrowbody, getAirlineWidebody,
  // Regions
  getAllRegions, getRegion, getRegionCountries,
  // Sub-Regions
  getSubRegions,
  // Categories
  getAllCategories, getCategory, getCategoryBySopKey, getCategoryByName,
  getCategoryNameToId, getCategoryNameToSop,
  // Agent Types
  getAllAgentTypes, getAgentType, getAgentTypesByCategory,
  // Hazards
  getAllHazardTypes, getHazardType, getHazardFamily, getHazardRequiresCat3,
  getHazardKeywords, getHazardTypeByKeyword,
  // Domains
  getAllDomains, getDomain, getDomainProfile, getDomainProfileByName,
  // Scoring
  getScoringBands, getScoreBandLabel, getScoreBandEscalation,
  getEdpsFactors, getEdpsFactor,
  getBandValue, getBandValues,
  // WMO
  getWmoHazardType, isSevereWmoCode, getAllWmoCodes,
  // LLM
  getLlmProviders, getLlmProvider,
  // Connectors
  getConnectorConfig, getConnectorConfigs,
  // GDELT
  getGdeltQuery, getAllGdeltQueries,
  // Reddit
  getSubreddits,
  // Routes & Scenarios
  getFlightRoutes, getMockScenarios, getMockScenario,
  // Summary
  getSummary,
};
