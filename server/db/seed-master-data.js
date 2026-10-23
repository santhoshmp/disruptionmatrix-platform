// seed-master-data.js — One-time seed script for ref_* master data tables.
// Reads current hardcoded values and inserts them into the database.
// Idempotent: uses ON CONFLICT DO UPDATE, safe to run multiple times.
//
// Usage: node server/db/seed-master-data.js

import pool from './pool.js';
import { runMigrations } from './migrate.js';
import { getAllAirports, getAllAirlines, getCountriesByRegion } from '../data/airport-airline-data.js';
import { AIRPORTS as AIRPORT_COORDS } from '../data/airport-lookup.js';
import { IATA_TO_ICAO } from '../engine/agent-base.js';
import agentConfig from '../../src/data/agent-config.json' with { type: 'json' };
import dmData from '../../src/data/dm-data.json' with { type: 'json' };

// ── Helpers ──────────────────────────────────────────────────────────

function log(section, count) {
  console.log(`  [seed] ${section}: ${count} rows`);
}

// ── Airports ──────────────────────────────────────────────────────────

async function seedAirports() {
  const airports = getAllAirports();
  const movements = await _getDailyMovements();
  let count = 0;
  for (const a of airports) {
    const regionId = _inferRegion(a.country);
    await pool.query(
      `INSERT INTO ref_airports (iata, icao, name, city, country, region_id, lat, lon, scheduled, daily_movements, cat3_capable, active, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())
       ON CONFLICT (iata) DO UPDATE SET
         icao=EXCLUDED.icao, name=EXCLUDED.name, city=EXCLUDED.city, country=EXCLUDED.country,
         region_id=EXCLUDED.region_id, lat=EXCLUDED.lat, lon=EXCLUDED.lon,
         scheduled=EXCLUDED.scheduled, daily_movements=EXCLUDED.daily_movements,
         updated_at=NOW()`,
      [a.iata, a.icao, a.name, a.city, a.country, regionId, a.lat, a.lon,
       a.scheduled !== false, movements[a.iata] || 100, false, a.active !== false]
    );
    count++;
  }
  log('ref_airports', count);
}

// ── Airlines ──────────────────────────────────────────────────────────

async function seedAirlines() {
  const airlines = getAllAirlines();
  const { default: airlineRegistry } = await import('../data/real-airline-registry.js');
  let count = 0;
  for (const a of airlines) {
    if (!a.active) continue;
    const reg = airlineRegistry.getAirline(a.iata);
    const hubPrimary = reg?.hub || null;
    const hubSecondary = reg?.hubs?.filter(h => h !== hubPrimary) || [];
    const cat3 = reg ? airlineRegistry.hasCat3Capability(a.iata) : false;
    await pool.query(
      `INSERT INTO ref_airlines (iata, icao, name, country, hub_primary, hub_secondary, cat3_capable, narrowbody_type, widebody_type, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (iata) DO UPDATE SET
         icao=EXCLUDED.icao, name=EXCLUDED.name, country=EXCLUDED.country,
         hub_primary=EXCLUDED.hub_primary, hub_secondary=EXCLUDED.hub_secondary,
         cat3_capable=EXCLUDED.cat3_capable, narrowbody_type=EXCLUDED.narrowbody_type,
         widebody_type=EXCLUDED.widebody_type, active=EXCLUDED.active`,
      [a.iata, a.icao, a.name, a.country,
       hubPrimary, JSON.stringify(hubSecondary),
       cat3, _getNarrowbody(a.iata), _getWidebody(a.iata), true]
    );
    count++;
  }
  log('ref_airlines', count);
}

// ── Regions ───────────────────────────────────────────────────────────

async function seedRegions() {
  const regions = agentConfig.regions || [];
  let count = 0;
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    await pool.query(
      `INSERT INTO ref_regions (id, name, sort_order, active)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, sort_order=EXCLUDED.sort_order, active=EXCLUDED.active`,
      [r.id, r.name, i, true]
    );
    count++;
  }
  log('ref_regions', count);
}

// ── Region Countries ──────────────────────────────────────────────────

async function seedRegionCountries() {
  const regions = agentConfig.regions || [];
  let count = 0;
  for (const r of regions) {
    const countries = getCountriesByRegion(r.id) || [];
    for (const country of countries) {
      await pool.query(
        `INSERT INTO ref_region_countries (region_id, country) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.id, country]
      );
      count++;
    }
  }
  log('ref_region_countries', count);
}

// ── Sub-Regions ────────────────────────────────────────────────────────

async function seedSubRegions() {
  const regions = agentConfig.regions || [];
  let count = 0;
  for (const r of regions) {
    const subs = r.subRegions || [];
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      const id = `${r.id}:${s.id || s.name || i}`;
      await pool.query(
        `INSERT INTO ref_sub_regions (id, region_id, name, bbox, active)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, bbox=EXCLUDED.bbox, active=EXCLUDED.active`,
        [id, r.id, s.name || s.id || `Sub ${i}`, JSON.stringify(s.bbox || null), true]
      );
      count++;
    }
  }
  log('ref_sub_regions', count);
}

// ── Categories ────────────────────────────────────────────────────────

async function seedCategories() {
  const cats = [
    { id: 'weather', name: 'Weather', sop_key: 'storm', color: '#22D3EE', icon: 'Wx', sort_order: 0 },
    { id: 'atc_airspace', name: 'ATC / Airspace', sop_key: 'atc', color: '#4CC2CE', icon: 'ATC', sort_order: 1 },
    { id: 'industrial', name: 'Industrial action', sop_key: 'ground', color: '#F5A623', icon: 'IA', sort_order: 2 },
    { id: 'geopolitical', name: 'Geopolitical', sop_key: 'airspace', color: '#F0495A', icon: 'Geo', sort_order: 3 },
    { id: 'infrastructure', name: 'Infrastructure', sop_key: 'runway', color: '#E8C34A', icon: 'Inf', sort_order: 4 },
    { id: 'regulatory', name: 'Regulatory', sop_key: 'regulatory', color: '#5B92C9', icon: 'Reg', sort_order: 5 },
  ];
  let count = 0;
  for (const c of cats) {
    await pool.query(
      `INSERT INTO ref_categories (id, name, sop_key, color, icon, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, sop_key=EXCLUDED.sop_key, color=EXCLUDED.color, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order`,
      [c.id, c.name, c.sop_key, c.color, c.icon, c.sort_order, true]
    );
    count++;
  }
  log('ref_categories', count);
}

// ── Agent Types ───────────────────────────────────────────────────────

async function seedAgentTypes() {
  const types = [
    { type: 'weather', category_id: 'weather', label: 'Weather', icon: 'Wx', color: '#22D3EE', poll_interval_min: 5 },
    { type: 'atc', category_id: 'atc_airspace', label: 'ATC / Airspace', icon: 'ATC', color: '#4CC2CE', poll_interval_min: 5 },
    { type: 'industrial', category_id: 'industrial', label: 'Industrial Action', icon: 'IA', color: '#F5A623', poll_interval_min: 10 },
    { type: 'geopolitical', category_id: 'geopolitical', label: 'Geopolitical', icon: 'Geo', color: '#F0495A', poll_interval_min: 10 },
    { type: 'infrastructure', category_id: 'infrastructure', label: 'Infrastructure', icon: 'Inf', color: '#E8C34A', poll_interval_min: 10 },
    { type: 'regulatory', category_id: 'regulatory', label: 'Regulatory', icon: 'Reg', color: '#5B92C9', poll_interval_min: 15 },
    { type: 'flight', category_id: 'atc_airspace', label: 'Flight Schedules', icon: 'FLT', color: '#4CC2CE', poll_interval_min: 2 },
    { type: 'social', category_id: 'atc_airspace', label: 'Social Reports', icon: 'SOC', color: '#4CC2CE', poll_interval_min: 3 },
  ];
  let count = 0;
  for (const t of types) {
    await pool.query(
      `INSERT INTO ref_agent_types (type, category_id, label, icon, color, poll_interval_min, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (type) DO UPDATE SET category_id=EXCLUDED.category_id, label=EXCLUDED.label, icon=EXCLUDED.icon, color=EXCLUDED.color, poll_interval_min=EXCLUDED.poll_interval_min`,
      [t.type, t.category_id, t.label, t.icon, t.color, t.poll_interval_min, true]
    );
    count++;
  }
  log('ref_agent_types', count);
}

// ── Hazard Types ──────────────────────────────────────────────────────

async function seedHazardTypes() {
  const hazards = [
    { hazard_type: 'fog', family: 'visibility', requires_cat3: true, sev: 'high', val: 75 },
    { hazard_type: 'low_visibility', family: 'visibility', requires_cat3: true, sev: 'high', val: 72 },
    { hazard_type: 'low_ceiling', family: 'ceiling', requires_cat3: true, sev: 'moderate', val: 55 },
    { hazard_type: 'thunderstorm', family: 'thunderstorm', requires_cat3: false, sev: 'high', val: 75 },
    { hazard_type: 'monsoon', family: 'rain', requires_cat3: false, sev: 'high', val: 70 },
    { hazard_type: 'snow_ice', family: 'winter', requires_cat3: false, sev: 'high', val: 72 },
    { hazard_type: 'snow', family: 'winter', requires_cat3: false, sev: 'moderate', val: 55 },
    { hazard_type: 'winter_precip', family: 'winter', requires_cat3: false, sev: 'moderate', val: 55 },
    { hazard_type: 'strong_wind', family: 'wind', requires_cat3: false, sev: 'moderate', val: 60 },
    { hazard_type: 'high_wind', family: 'wind', requires_cat3: false, sev: 'high', val: 75 },
    { hazard_type: 'heavy_rain', family: 'rain', requires_cat3: false, sev: 'moderate', val: 55 },
    { hazard_type: 'extreme_heat', family: 'heat', requires_cat3: false, sev: 'moderate', val: 50 },
    { hazard_type: 'extreme_cold', family: 'cold', requires_cat3: false, sev: 'moderate', val: 50 },
    { hazard_type: 'cancellation', family: 'cancellation', requires_cat3: false, sev: 'high', val: 75 },
    { hazard_type: 'cancelled', family: 'cancellation', requires_cat3: false, sev: 'high', val: 75 },
    { hazard_type: 'massdelay', family: 'massdelay', requires_cat3: false, sev: 'high', val: 70 },
    { hazard_type: 'delay', family: 'massdelay', requires_cat3: false, sev: 'moderate', val: 55 },
    { hazard_type: 'groundstop', family: 'groundstop', requires_cat3: false, sev: 'critical', val: 85 },
    { hazard_type: 'grounddelay', family: 'groundstop', requires_cat3: false, sev: 'high', val: 72 },
    { hazard_type: 'diversion', family: 'diversion', requires_cat3: false, sev: 'high', val: 70 },
    { hazard_type: 'diverted', family: 'diversion', requires_cat3: false, sev: 'high', val: 70 },
    { hazard_type: 'socialreport', family: 'socialreport', requires_cat3: false, sev: 'low', val: 35 },
    { hazard_type: 'strike', family: 'strike', requires_cat3: false, sev: 'high', val: 65 },
    { hazard_type: 'airspace_restriction', family: 'airspace', requires_cat3: false, sev: 'high', val: 70 },
    { hazard_type: 'atfm_regulation', family: 'atfm', requires_cat3: false, sev: 'moderate', val: 55 },
    { hazard_type: 'fuel_supply', family: 'infrastructure', requires_cat3: false, sev: 'high', val: 65 },
    { hazard_type: 'infrastructure_failure', family: 'infrastructure', requires_cat3: false, sev: 'high', val: 65 },
    { hazard_type: 'regulatory_change', family: 'regulatory', requires_cat3: false, sev: 'moderate', val: 45 },
    { hazard_type: 'wildfire', family: 'natural', requires_cat3: false, sev: 'high', val: 72 },
    { hazard_type: 'volcanic_ash', family: 'natural', requires_cat3: false, sev: 'critical', val: 88 },
    { hazard_type: 'flooding', family: 'natural', requires_cat3: false, sev: 'moderate', val: 55 },
    { hazard_type: 'dust_haze', family: 'natural', requires_cat3: false, sev: 'moderate', val: 50 },
    { hazard_type: 'extreme_temp', family: 'natural', requires_cat3: false, sev: 'low', val: 40 },
    { hazard_type: 'ice', family: 'natural', requires_cat3: false, sev: 'low', val: 35 },
    { hazard_type: 'severe_storm', family: 'thunderstorm', requires_cat3: false, sev: 'high', val: 75 },
    { hazard_type: 'general', family: 'general', requires_cat3: false, sev: 'moderate', val: 50 },
  ];
  let count = 0;
  for (const h of hazards) {
    await pool.query(
      `INSERT INTO ref_hazard_types (hazard_type, family, requires_cat3, default_severity, default_sev_val, active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (hazard_type) DO UPDATE SET family=EXCLUDED.family, requires_cat3=EXCLUDED.requires_cat3, default_severity=EXCLUDED.default_severity, default_sev_val=EXCLUDED.default_sev_val`,
      [h.hazard_type, h.family, h.requires_cat3, h.sev, h.val, true]
    );
    count++;
  }
  log('ref_hazard_types', count);
}

// ── Hazard Keywords ───────────────────────────────────────────────────

async function seedHazardKeywords() {
  const kws = [
    { hazard_type: 'fog', keyword: 'fog' },
    { hazard_type: 'fog', keyword: 'visibility' },
    { hazard_type: 'thunderstorm', keyword: 'storm' },
    { hazard_type: 'thunderstorm', keyword: 'thunderstorm' },
    { hazard_type: 'thunderstorm', keyword: 'convective' },
    { hazard_type: 'monsoon', keyword: 'monsoon' },
    { hazard_type: 'snow_ice', keyword: 'snow' },
    { hazard_type: 'atfm_regulation', keyword: 'atfm' },
    { hazard_type: 'atfm_regulation', keyword: 'atc' },
    { hazard_type: 'atfm_regulation', keyword: 'sector' },
    { hazard_type: 'strike', keyword: 'strike' },
    { hazard_type: 'strike', keyword: 'industrial' },
    { hazard_type: 'airspace_restriction', keyword: 'airspace' },
    { hazard_type: 'airspace_restriction', keyword: 'overflight' },
    { hazard_type: 'fuel_supply', keyword: 'fuel' },
    { hazard_type: 'infrastructure_failure', keyword: 'runway' },
    { hazard_type: 'infrastructure_failure', keyword: 'ils' },
    { hazard_type: 'infrastructure_failure', keyword: 'infrastructure' },
  ];
  let count = 0;
  for (const k of kws) {
    await pool.query(
      `INSERT INTO ref_hazard_keywords (hazard_type, keyword) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [k.hazard_type, k.keyword]
    );
    count++;
  }
  log('ref_hazard_keywords', count);
}

// ── Domains ───────────────────────────────────────────────────────────

async function seedDomains() {
  const domains = dmData.DOMAINS || [
    'Airport operations', 'Flight schedule', 'Aircraft rotations',
    'Passengers', 'Crew', 'Cargo', 'Catering', 'Maintenance', 'Regulatory',
  ];
  let count = 0;
  for (let i = 0; i < domains.length; i++) {
    await pool.query(
      `INSERT INTO ref_domains (name, sort_order) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
      [domains[i], i]
    );
    count++;
  }
  log('ref_domains', count);
}

// ── Domain Profiles ──────────────────────────────────────────────────

async function seedDomainProfiles() {
  const profiles = {
    'weather': { 'Airport operations': 1.0, 'Flight schedule': 0.9, 'Aircraft rotations': 0.8, 'Passengers': 0.7, 'Crew': 0.6, 'Cargo': 0.5, 'Catering': 0.4, 'Maintenance': 0.3, 'Regulatory': 0.2 },
    'atc_airspace': { 'Flight schedule': 1.0, 'Aircraft rotations': 0.9, 'Airport operations': 0.8, 'Crew': 0.7, 'Passengers': 0.6, 'Cargo': 0.5, 'Maintenance': 0.3, 'Catering': 0.3, 'Regulatory': 0.4 },
    'industrial': { 'Airport operations': 1.0, 'Crew': 0.9, 'Passengers': 0.8, 'Flight schedule': 0.8, 'Catering': 0.6, 'Cargo': 0.5, 'Aircraft rotations': 0.5, 'Maintenance': 0.3, 'Regulatory': 0.4 },
    'geopolitical': { 'Flight schedule': 1.0, 'Aircraft rotations': 0.9, 'Regulatory': 0.8, 'Crew': 0.6, 'Passengers': 0.5, 'Airport operations': 0.5, 'Cargo': 0.4, 'Catering': 0.2, 'Maintenance': 0.2 },
    'infrastructure': { 'Airport operations': 1.0, 'Flight schedule': 0.9, 'Maintenance': 0.7, 'Aircraft rotations': 0.6, 'Passengers': 0.5, 'Cargo': 0.4, 'Crew': 0.3, 'Catering': 0.3, 'Regulatory': 0.2 },
    'regulatory': { 'Regulatory': 1.0, 'Flight schedule': 0.7, 'Crew': 0.6, 'Maintenance': 0.5, 'Aircraft rotations': 0.4, 'Airport operations': 0.4, 'Passengers': 0.3, 'Cargo': 0.2, 'Catering': 0.2 },
  };
  let count = 0;
  for (const [catId, weights] of Object.entries(profiles)) {
    for (const [domain, weight] of Object.entries(weights)) {
      await pool.query(
        `INSERT INTO ref_domain_profiles (category_id, domain_name, weight) VALUES ($1, $2, $3)
         ON CONFLICT (category_id, domain_name) DO UPDATE SET weight = EXCLUDED.weight`,
        [catId, domain, weight]
      );
      count++;
    }
  }
  log('ref_domain_profiles', count);
}

// ── Scoring Bands ─────────────────────────────────────────────────────

async function seedScoringBands() {
  const bands = agentConfig.scoreBands || [
    { min: 80, max: 100, band: 'Critical', color: '#F0495A', escalation: 'L4' },
    { min: 65, max: 79, band: 'High', color: '#F5A623', escalation: 'L3' },
    { min: 45, max: 64, band: 'Moderate', color: '#E8C34A', escalation: 'L2' },
    { min: 0, max: 44, band: 'Low', color: '#5B92C9', escalation: 'L1' },
  ];
  let count = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    await pool.query(
      `INSERT INTO ref_scoring_bands (min_score, max_score, band, color, escalation, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [b.min, b.max, b.band, b.color, b.escalation, i]
    );
    count++;
  }
  log('ref_scoring_bands', count);
}

// ── EDPS Factors ──────────────────────────────────────────────────────

async function seedEdpsFactors() {
  const factors = agentConfig.edpsFactors || [
    { label: 'Probability of occurrence', weight: 0.18 },
    { label: 'Severity if realised', weight: 0.18 },
    { label: 'Geographic reach', weight: 0.12 },
    { label: 'Expected duration', weight: 0.12 },
    { label: 'Time to impact', weight: 0.14 },
    { label: 'Escalation rate', weight: 0.10 },
    { label: 'Source credibility', weight: 0.10 },
    { label: 'Prediction confidence', weight: 0.06 },
  ];
  const keys = ['probability', 'severity', 'geographicReach', 'expectedDuration', 'timeToImpact', 'escalationRate', 'sourceCredibility', 'predictionConfidence'];
  let count = 0;
  for (let i = 0; i < factors.length; i++) {
    await pool.query(
      `INSERT INTO ref_edps_factors (label, key, weight, sort_order) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, weight=EXCLUDED.weight, sort_order=EXCLUDED.sort_order`,
      [factors[i].label, keys[i] || `factor_${i}`, factors[i].weight, i]
    );
    count++;
  }
  log('ref_edps_factors', count);
}

// ── Band Values ───────────────────────────────────────────────────────

async function seedBandValues() {
  const bands = [
    // likelihood bands
    { bt: 'likelihood', b: 'very_low', v: 15, s: 0 },
    { bt: 'likelihood', b: 'low', v: 35, s: 1 },
    { bt: 'likelihood', b: 'moderate', v: 55, s: 2 },
    { bt: 'likelihood', b: 'high', v: 75, s: 3 },
    { bt: 'likelihood', b: 'very_high', v: 92, s: 4 },
    // TTI bands
    { bt: 'tti', b: 'imminent', v: 100, s: 0 },
    { bt: 'tti', b: 'very_short', v: 85, s: 1 },
    { bt: 'tti', b: 'short', v: 65, s: 2 },
    { bt: 'tti', b: 'medium', v: 40, s: 3 },
    { bt: 'tti', b: 'long', v: 20, s: 4 },
    { bt: 'tti', b: 'very_long', v: 10, s: 5 },
    // duration bands
    { bt: 'duration', b: 'very_short', v: 10, s: 0 },
    { bt: 'duration', b: 'short', v: 30, s: 1 },
    { bt: 'duration', b: 'medium', v: 55, s: 2 },
    { bt: 'duration', b: 'long', v: 78, s: 3 },
    { bt: 'duration', b: 'very_long', v: 95, s: 4 },
  ];
  let count = 0;
  for (const bv of bands) {
    await pool.query(
      `INSERT INTO ref_band_values (band_type, band, numeric_value, sort_order) VALUES ($1,$2,$3,$4)
       ON CONFLICT (band_type, band) DO UPDATE SET numeric_value=EXCLUDED.numeric_value, sort_order=EXCLUDED.sort_order`,
      [bv.bt, bv.b, bv.v, bv.s]
    );
    count++;
  }
  log('ref_band_values', count);
}

// ── WMO Codes ─────────────────────────────────────────────────────────

async function seedWmoCodes() {
  const codes = [
    { wmo: 95, hazard: 'thunderstorm' }, { wmo: 96, hazard: 'thunderstorm' }, { wmo: 99, hazard: 'thunderstorm' },
    { wmo: 71, hazard: 'snow' }, { wmo: 73, hazard: 'snow' }, { wmo: 75, hazard: 'snow' }, { wmo: 77, hazard: 'snow' },
    { wmo: 65, hazard: 'heavy_rain' }, { wmo: 66, hazard: 'heavy_rain' }, { wmo: 67, hazard: 'heavy_rain' },
    { wmo: 45, hazard: 'fog' }, { wmo: 48, hazard: 'fog' },
    { wmo: 3, hazard: 'general' }, { wmo: 2, hazard: 'general' },
  ];
  let count = 0;
  for (const c of codes) {
    await pool.query(
      `INSERT INTO ref_wmo_codes (wmo_code, hazard_type) VALUES ($1, $2)
       ON CONFLICT (wmo_code) DO UPDATE SET hazard_type=EXCLUDED.hazard_type`,
      [c.wmo, c.hazard]
    );
    count++;
  }
  log('ref_wmo_codes', count);
}

// ── LLM Providers ────────────────────────────────────────────────────

async function seedLlmProviders() {
  const providers = [
    { key: 'openai', name: 'OpenAI', default_model: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], key_prefix: 'sk-', key_url: 'https://platform.openai.com/api-keys', docs: 'platform.openai.com/docs', color: '#10A37F', needs_base: false, key_required: true, is_custom: false, sort_order: 0 },
    { key: 'anthropic', name: 'Anthropic', default_model: 'claude-sonnet-4-20250514', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], key_prefix: 'sk-ant-', key_url: 'https://console.anthropic.com/settings/keys', docs: 'docs.anthropic.com', color: '#D97757', needs_base: false, key_required: true, is_custom: false, sort_order: 1 },
    { key: 'azure', name: 'Azure OpenAI', default_model: 'gpt-4o', models: ['gpt-4o', 'gpt-4', 'gpt-35-turbo'], key_prefix: '', key_url: 'https://portal.azure.com', docs: 'learn.microsoft.com/azure/ai-services/openai', color: '#0078D4', needs_base: true, key_required: true, is_custom: false, sort_order: 2 },
    { key: 'google', name: 'Google Gemini', default_model: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.6-flash', 'gemini-3.5-flash'], key_prefix: '', key_url: 'https://aistudio.google.com/app/apikey', docs: 'ai.google.dev/gemini-api/docs', color: '#4285F4', needs_base: false, key_required: true, is_custom: false, sort_order: 3 },
    { key: 'mistral', name: 'Mistral AI', default_model: 'mistral-large-latest', models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x7b'], key_prefix: '', key_url: 'https://console.mistral.ai/api-keys', docs: 'docs.mistral.ai', color: '#FF7000', needs_base: false, key_required: true, is_custom: false, sort_order: 4 },
    { key: 'custom', name: 'Custom / Private Cloud', default_model: '', models: [], key_prefix: '', key_url: null, docs: null, color: '#8B5CF6', needs_base: true, key_required: false, is_custom: true, description: 'Any OpenAI-compatible endpoint (vLLM, TGI, Ollama, LM Studio, LocalAI, etc.)', sort_order: 5 },
  ];
  let count = 0;
  for (const p of providers) {
    await pool.query(
      `INSERT INTO ref_llm_providers (key, name, default_model, models, key_prefix, key_url, docs, color, needs_base, key_required, is_custom, description, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, default_model=EXCLUDED.default_model, models=EXCLUDED.models,
         key_prefix=EXCLUDED.key_prefix, key_url=EXCLUDED.key_url, docs=EXCLUDED.docs, color=EXCLUDED.color,
         needs_base=EXCLUDED.needs_base, key_required=EXCLUDED.key_required, is_custom=EXCLUDED.is_custom,
         description=EXCLUDED.description, sort_order=EXCLUDED.sort_order`,
      [p.key, p.name, p.default_model, JSON.stringify(p.models), p.key_prefix, p.key_url, p.docs, p.color, p.needs_base, p.key_required, p.is_custom, p.description, p.sort_order, true]
    );
    count++;
  }
  log('ref_llm_providers', count);
}

// ── Connector Configs ────────────────────────────────────────────────

async function seedConnectors() {
  const configs = [
    { connector: 'usgs', key: 'min_magnitude', value: '4.5', type: 'float', desc: 'Minimum earthquake magnitude to consider as a signal' },
    { connector: 'usgs', key: 'radius_km_large', value: '500', type: 'int', desc: 'Affected radius for magnitude >= 7' },
    { connector: 'usgs', key: 'radius_km_medium', value: '400', type: 'int', desc: 'Affected radius for magnitude >= 6' },
    { connector: 'usgs', key: 'radius_km_small', value: '350', type: 'int', desc: 'Affected radius for magnitude < 6' },
    { connector: 'reddit', key: 'cache_ttl_ms', value: '300000', type: 'int', desc: 'Cache TTL per subreddit (5 min)' },
    { connector: 'reddit', key: 'limit', value: '25', type: 'int', desc: 'Posts per fetch' },
    { connector: 'opensky', key: 'timeout_ms', value: '12000', type: 'int', desc: 'OpenSky API timeout' },
    { connector: 'airlabs', key: 'timeout_ms', value: '12000', type: 'int', desc: 'AirLabs API timeout' },
    { connector: 'airlabs', key: 'cache_ttl_ms', value: '900000', type: 'int', desc: 'AirLabs cache TTL (15 min)' },
    { connector: 'adsblol', key: 'timeout_ms', value: '10000', type: 'int', desc: 'adsb.lol API timeout' },
    { connector: 'archiver', key: 'stale_age_hours', value: '72', type: 'float', desc: 'Events with no fresh signals for this long archive if score < stale_score' },
    { connector: 'archiver', key: 'max_age_hours', value: '240', type: 'float', desc: 'Hard retention cap in hours — archives regardless of score (0 = disabled)' },
    { connector: 'archiver', key: 'stale_score', value: '65', type: 'float', desc: 'Score ceiling below which a stale event archives' },
    { connector: 'archiver', key: 'low_score', value: '50', type: 'float', desc: 'Score below this archives immediately as low_threat' },
    { connector: 'gdelt', key: 'cache_ttl_ms', value: '300000', type: 'int', desc: 'GDELT cache TTL (5 min)' },
    { connector: 'faa_tfr', key: 'timeout_ms', value: '10000', type: 'int', desc: 'FAA TFR API timeout' },
    { connector: 'faa_asws', key: 'timeout_ms', value: '10000', type: 'int', desc: 'FAA ASWS API timeout' },
    { connector: 'open_meteo', key: 'timeout_ms', value: '10000', type: 'int', desc: 'Open-Meteo API timeout' },
    { connector: 'pipeline', key: 'interval_ms', value: '10000', type: 'int', desc: 'Pipeline run interval' },
    { connector: 'store', key: 'max_signals', value: '5000', type: 'int', desc: 'Max signals in memory' },
    { connector: 'rag', key: 'rrf_k', value: '60', type: 'int', desc: 'RRF constant for fusion' },
    { connector: 'rag', key: 'vector_threshold', value: '0.5', type: 'float', desc: 'Vector search score threshold' },
  ];
  let count = 0;
  for (const c of configs) {
    await pool.query(
      `INSERT INTO ref_connectors (connector, config_key, config_value, config_type, description)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (connector, config_key) DO UPDATE SET config_value=EXCLUDED.config_value, config_type=EXCLUDED.config_type, description=EXCLUDED.description`,
      [c.connector, c.key, c.value, c.type, c.desc]
    );
    count++;
  }
  log('ref_connectors', count);
}

// ── GDELT Queries ─────────────────────────────────────────────────────

async function seedGdeltQueries() {
  const queries = [
    { category: 'industrial', query: '(airline strike OR airport strike OR ATC strike OR ground handler strike OR pilot strike OR cabin crew strike OR aviation walkout OR aviation industrial action)' },
    { category: 'geopolitical', query: '(airspace closure OR flight ban OR aviation sanctions OR airspace restriction OR no-fly zone OR conflict zone aviation)' },
    { category: 'infrastructure', query: '(airport runway closure OR airport power outage OR airport fuel shortage OR ILS outage OR airport infrastructure failure)' },
    { category: 'regulatory', query: '(aviation regulation OR airworthiness directive OR DGCA directive OR EASA regulation OR FAA directive OR aviation safety order)' },
    { category: 'flight', query: '(flight cancellations OR mass flight delays OR airport ground stop OR airline grounding OR fleet grounding OR ATC system outage OR mass diversions)' },
  ];
  let count = 0;
  for (const q of queries) {
    await pool.query(
      `INSERT INTO ref_gdelt_queries (category, query_text, active) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [q.category, q.query, true]
    );
    count++;
  }
  log('ref_gdelt_queries', count);
}

// ── Subreddits ────────────────────────────────────────────────────────

async function seedSubreddits() {
  const subs = ['aviation', 'flightdelay', 'airline', 'ATC', 'flying'];
  let count = 0;
  for (let i = 0; i < subs.length; i++) {
    await pool.query(
      `INSERT INTO ref_subreddits (name, active, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET active=EXCLUDED.active, sort_order=EXCLUDED.sort_order`,
      [subs[i], true, i]
    );
    count++;
  }
  log('ref_subreddits', count);
}

// ── Flight Routes ────────────────────────────────────────────────────

async function seedFlightRoutes() {
  const routes = [
    // Domestic connections
    { origin: 'DEL', dest: 'BOM', type: 'domestic' }, { origin: 'DEL', dest: 'BLR', type: 'domestic' },
    { origin: 'DEL', dest: 'MAA', type: 'domestic' }, { origin: 'DEL', dest: 'HYD', type: 'domestic' },
    { origin: 'DEL', dest: 'CCU', type: 'domestic' }, { origin: 'DEL', dest: 'AMD', type: 'domestic' },
    { origin: 'BOM', dest: 'DEL', type: 'domestic' }, { origin: 'BOM', dest: 'BLR', type: 'domestic' },
    { origin: 'BOM', dest: 'MAA', type: 'domestic' }, { origin: 'BOM', dest: 'GOI', type: 'domestic' },
    { origin: 'BOM', dest: 'HYD', type: 'domestic' },
    { origin: 'BLR', dest: 'DEL', type: 'domestic' }, { origin: 'BLR', dest: 'BOM', type: 'domestic' },
    { origin: 'BLR', dest: 'MAA', type: 'domestic' }, { origin: 'BLR', dest: 'HYD', type: 'domestic' },
    { origin: 'BLR', dest: 'COK', type: 'domestic' },
    { origin: 'MAA', dest: 'DEL', type: 'domestic' }, { origin: 'MAA', dest: 'BOM', type: 'domestic' },
    { origin: 'MAA', dest: 'BLR', type: 'domestic' }, { origin: 'MAA', dest: 'HYD', type: 'domestic' },
    { origin: 'AMS', dest: 'CDG', type: 'domestic' }, { origin: 'AMS', dest: 'FRA', type: 'domestic' },
    { origin: 'AMS', dest: 'MUC', type: 'domestic' }, { origin: 'AMS', dest: 'LHR', type: 'domestic' },
    { origin: 'AMS', dest: 'ZRH', type: 'domestic' },
    { origin: 'CDG', dest: 'AMS', type: 'domestic' }, { origin: 'CDG', dest: 'FRA', type: 'domestic' },
    { origin: 'CDG', dest: 'LHR', type: 'domestic' }, { origin: 'CDG', dest: 'FCO', type: 'domestic' },
    { origin: 'FRA', dest: 'AMS', type: 'domestic' }, { origin: 'FRA', dest: 'CDG', type: 'domestic' },
    { origin: 'FRA', dest: 'LHR', type: 'domestic' }, { origin: 'FRA', dest: 'MUC', type: 'domestic' },
    { origin: 'FRA', dest: 'VIE', type: 'domestic' },
    { origin: 'LHR', dest: 'AMS', type: 'domestic' }, { origin: 'LHR', dest: 'CDG', type: 'domestic' },
    { origin: 'LHR', dest: 'FRA', type: 'domestic' }, { origin: 'LHR', dest: 'DUB', type: 'domestic' },
    { origin: 'LHR', dest: 'CPH', type: 'domestic' },
    { origin: 'DXB', dest: 'DOH', type: 'domestic' }, { origin: 'DXB', dest: 'BAH', type: 'domestic' },
    { origin: 'DXB', dest: 'DEL', type: 'domestic' }, { origin: 'DXB', dest: 'BOM', type: 'domestic' },
    { origin: 'DXB', dest: 'BLR', type: 'domestic' },
    { origin: 'DOH', dest: 'DXB', type: 'domestic' }, { origin: 'DOH', dest: 'BAH', type: 'domestic' },
    { origin: 'DOH', dest: 'DEL', type: 'domestic' }, { origin: 'DOH', dest: 'BOM', type: 'domestic' },
    { origin: 'SIN', dest: 'KUL', type: 'domestic' }, { origin: 'SIN', dest: 'BKK', type: 'domestic' },
    { origin: 'SIN', dest: 'DEL', type: 'domestic' }, { origin: 'SIN', dest: 'BLR', type: 'domestic' },
    // Long-haul destinations
    { origin: 'DEL', dest: 'LHR', type: 'long_haul' }, { origin: 'DEL', dest: 'CDG', type: 'long_haul' },
    { origin: 'DEL', dest: 'FRA', type: 'long_haul' }, { origin: 'DEL', dest: 'JFK', type: 'long_haul' },
    { origin: 'BOM', dest: 'LHR', type: 'long_haul' }, { origin: 'BOM', dest: 'SIN', type: 'long_haul' },
    { origin: 'BOM', dest: 'DXB', type: 'long_haul' },
    { origin: 'BLR', dest: 'SIN', type: 'long_haul' }, { origin: 'BLR', dest: 'BKK', type: 'long_haul' },
    { origin: 'BLR', dest: 'DXB', type: 'long_haul' },
    { origin: 'DXB', dest: 'LHR', type: 'long_haul' }, { origin: 'DXB', dest: 'JFK', type: 'long_haul' },
    { origin: 'DXB', dest: 'SIN', type: 'long_haul' },
    { origin: 'DOH', dest: 'LHR', type: 'long_haul' }, { origin: 'DOH', dest: 'JFK', type: 'long_haul' },
    { origin: 'DOH', dest: 'BKK', type: 'long_haul' },
    { origin: 'AMS', dest: 'JFK', type: 'long_haul' }, { origin: 'AMS', dest: 'DXB', type: 'long_haul' },
    { origin: 'AMS', dest: 'SIN', type: 'long_haul' },
    { origin: 'FRA', dest: 'JFK', type: 'long_haul' }, { origin: 'FRA', dest: 'DXB', type: 'long_haul' },
    { origin: 'FRA', dest: 'SIN', type: 'long_haul' },
  ];
  let count = 0;
  for (const r of routes) {
    await pool.query(
      `INSERT INTO ref_flight_routes (origin, dest, airline_code, route_type, active)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (origin, dest, airline_code) DO UPDATE SET route_type=EXCLUDED.route_type`,
      [r.origin, r.dest, null, r.type, true]
    );
    count++;
  }
  log('ref_flight_routes', count);
}

// ── Mock Scenarios ───────────────────────────────────────────────────

async function seedMockScenarios() {
  const scenarios = [
    // Weather
    { agent_type: 'weather', region: 'R1', sub_region: 'southIndia', name: 'Bay of Bengal Monsoon Depression', hazard_type: 'monsoon', airports: ['BLR', 'MAA'], lat: 12, lon: 80, radius_km: 400, summary: 'Deepening low-pressure system tracking toward the southeast coast.', factor_hints: { probability: 89, severity: 84, geographicReach: 79, expectedDuration: 74, timeToImpact: 90, escalationRate: 75, sourceCredibility: 82, predictionConfidence: 78 } },
    { agent_type: 'weather', region: 'R1', sub_region: 'northIndia', name: 'Delhi Winter Fog — CAT III Demand Surge', hazard_type: 'fog', airports: ['DEL'], lat: 28.6, lon: 77.1, radius_km: 100, summary: 'Dense fog advisory for DEL with visibility below 200m.', factor_hints: { probability: 82, severity: 76, geographicReach: 50, expectedDuration: 70, timeToImpact: 85, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 75 } },
    { agent_type: 'weather', region: 'R1', sub_region: 'westIndia', name: 'Mumbai Monsoon Thunderstorms', hazard_type: 'thunderstorm', airports: ['BOM'], lat: 19.1, lon: 72.9, radius_km: 250, summary: 'Severe monsoon thunderstorms at Mumbai.', factor_hints: { probability: 85, severity: 79, geographicReach: 55, expectedDuration: 65, timeToImpact: 92, escalationRate: 78, sourceCredibility: 80, predictionConfidence: 72 } },
    { agent_type: 'weather', region: 'R2', sub_region: 'centralEurope', name: 'Central European Convective Weather', hazard_type: 'thunderstorm', airports: ['FRA', 'MUC', 'VIE'], lat: 49, lon: 10, radius_km: 350, summary: 'Severe CB activity across FRA-MUC-VIE corridor.', factor_hints: { probability: 88, severity: 82, geographicReach: 72, expectedDuration: 68, timeToImpact: 95, escalationRate: 80, sourceCredibility: 85, predictionConfidence: 78 } },
    { agent_type: 'weather', region: 'R2', sub_region: 'westernEurope', name: 'Frankfurt Low Visibility Procedures', hazard_type: 'low_visibility', airports: ['FRA', 'AMS'], lat: 50, lon: 8.5, radius_km: 200, summary: 'Low visibility procedures at FRA and AMS.', factor_hints: { probability: 75, severity: 65, geographicReach: 50, expectedDuration: 60, timeToImpact: 80, escalationRate: 45, sourceCredibility: 85, predictionConfidence: 70 } },
    // ATC
    { agent_type: 'atc', region: 'R1', sub_region: 'southIndia', name: 'BLR Flow Management Regulation', hazard_type: 'atfm_regulation', airports: ['BLR'], lat: 13.2, lon: 77.7, radius_km: 100, summary: 'ATFM regulation for BLR arrivals due to congestion.', factor_hints: { probability: 78, severity: 62, geographicReach: 40, expectedDuration: 55, timeToImpact: 88, escalationRate: 50, sourceCredibility: 90, predictionConfidence: 75 } },
    { agent_type: 'atc', region: 'R2', sub_region: 'centralEurope', name: 'Munich Sector Capacity Regulation', hazard_type: 'atfm_regulation', airports: ['MUC'], lat: 48.4, lon: 11.8, radius_km: 150, summary: 'Sector capacity regulation at MUC.', factor_hints: { probability: 72, severity: 58, geographicReach: 45, expectedDuration: 50, timeToImpact: 85, escalationRate: 45, sourceCredibility: 88, predictionConfidence: 70 } },
    // Industrial
    { agent_type: 'industrial', region: 'R1', sub_region: 'northIndia', name: 'DEL Ground Handler Work Stoppage', hazard_type: 'strike', airports: ['DEL'], lat: 28.6, lon: 77.1, radius_km: 100, summary: 'Ground handler work stoppage at DEL.', factor_hints: { probability: 68, severity: 72, geographicReach: 50, expectedDuration: 80, timeToImpact: 75, escalationRate: 60, sourceCredibility: 75, predictionConfidence: 65 } },
    // Geopolitical
    { agent_type: 'geopolitical', region: 'R3', sub_region: 'gulf', name: 'Gulf Airspace Corridor Restriction', hazard_type: 'airspace_restriction', airports: ['DXB', 'DOH'], lat: 25, lon: 52, radius_km: 300, summary: 'Airspace corridor restriction in Gulf region.', factor_hints: { probability: 65, severity: 78, geographicReach: 85, expectedDuration: 70, timeToImpact: 70, escalationRate: 55, sourceCredibility: 82, predictionConfidence: 68 } },
    // Infrastructure
    { agent_type: 'infrastructure', region: 'R1', sub_region: 'southIndia', name: 'BLR ILS Calibration Outage', hazard_type: 'infrastructure_failure', airports: ['BLR'], lat: 13.2, lon: 77.7, radius_km: 80, summary: 'ILS calibration outage at BLR.', factor_hints: { probability: 72, severity: 68, geographicReach: 35, expectedDuration: 60, timeToImpact: 82, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 70 } },
    // Regulatory
    { agent_type: 'regulatory', region: 'R1', sub_region: 'northIndia', name: 'DGCA Airworthiness Directive', hazard_type: 'regulatory_change', airports: ['DEL', 'BOM'], lat: 28, lon: 77, radius_km: 200, summary: 'DGCA airworthiness directive issued.', factor_hints: { probability: 60, severity: 55, geographicReach: 60, expectedDuration: 90, timeToImpact: 50, escalationRate: 30, sourceCredibility: 90, predictionConfidence: 75 } },
  ];
  let count = 0;
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    await pool.query(
      `INSERT INTO ref_mock_scenarios (agent_type, region, sub_region, name, hazard_type, airports, lat, lon, radius_km, summary, factor_hints, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [s.agent_type, s.region, s.sub_region, s.name, s.hazard_type,
       JSON.stringify(s.airports), s.lat, s.lon, s.radius_km, s.summary,
       JSON.stringify(s.factor_hints), true, i]
    );
    count++;
  }
  log('ref_mock_scenarios', count);
}

// ── Helpers for data extraction ──────────────────────────────────────

function _inferRegion(country) {
  const map = {
    'India': 'R1', 'Pakistan': 'R1', 'Sri Lanka': 'R1', 'Bangladesh': 'R1', 'Nepal': 'R1',
    'Austria': 'R2', 'Germany': 'R2', 'France': 'R2', 'United Kingdom': 'R2', 'Netherlands': 'R2',
    'Belgium': 'R2', 'Switzerland': 'R2', 'Czech Republic': 'R2', 'Hungary': 'R2', 'Denmark': 'R2',
    'Norway': 'R2', 'Italy': 'R2', 'Spain': 'R2', 'Turkey': 'R2', 'Poland': 'R2', 'Greece': 'R2',
    'Ireland': 'R2', 'Iceland': 'R2',
    'United Arab Emirates': 'R3', 'Qatar': 'R3', 'Oman': 'R3', 'Bahrain': 'R3',
    'Saudi Arabia': 'R3', 'Kuwait': 'R3', 'Jordan': 'R3', 'Lebanon': 'R3', 'Israel': 'R3',
    'Singapore': 'R4', 'Thailand': 'R4', 'Malaysia': 'R4', 'Indonesia': 'R4',
    'Philippines': 'R4', 'Vietnam': 'R4', 'Cambodia': 'R4', 'Myanmar': 'R4',
    'United States': 'R5', 'Canada': 'R5',
    'Hong Kong': 'R6', 'Japan': 'R6', 'South Korea': 'R6', 'China': 'R6', 'Taiwan': 'R6',
    'South Africa': 'R7', 'Kenya': 'R7', 'Ethiopia': 'R7', 'Egypt': 'R7',
    'Nigeria': 'R7', 'Ghana': 'R7', 'Senegal': 'R7', 'Sudan': 'R7',
    'Australia': 'R8', 'New Zealand': 'R8',
    'Brazil': 'R9', 'Argentina': 'R9', 'Chile': 'R9', 'Colombia': 'R9', 'Peru': 'R9',
  };
  return map[country] || null;
}

async function _getDailyMovements() {
  return {
    DEL: 450, BOM: 400, BLR: 300, MAA: 200, HYD: 180, COK: 150, CCU: 150,
    GOI: 80, PNQ: 100, VTZ: 60, AMD: 120, JAI: 80, LKO: 80, IXC: 60, GAU: 60,
    VIE: 200, MUC: 400, FRA: 500, AMS: 500, CDG: 540, BRU: 200, ZRH: 300,
    GVA: 150, CPH: 250, OSL: 200, EDI: 200, FCO: 400, MAD: 400, IST: 500,
    WAW: 250, ATH: 200, BUD: 150, PRG: 200, LIS: 200,
    DXB: 600, AUH: 300, DOH: 300, MCT: 150, BAH: 200, RUH: 300, JED: 250,
    KWI: 150, AMM: 150, BEY: 150, TLV: 200,
    SIN: 500, BKK: 500, KUL: 400, CGK: 400, MNL: 250, HAN: 200, SGN: 250,
    PNH: 80, RGN: 80,
    LHR: 650, LGW: 300, STN: 150, JFK: 500, EWR: 400, YYZ: 400, ORD: 500, ATL: 600, SFO: 400, LAX: 500,
    IAD: 300, BOS: 400, KEF: 100, SNN: 100,
    HKG: 500, NRT: 400, HND: 500, ICN: 400, PEK: 500, PVG: 500, CAN: 400, TPE: 300,
    JNB: 300, CPT: 200, NBO: 150, ADD: 200, CAI: 300, LOS: 150, ACC: 100, DKR: 100,
    SYD: 400, MEL: 350, BNE: 250, PER: 200, AKL: 200,
    GRU: 500, EZE: 300, SCL: 250, BOG: 300, LIM: 250,
  };
}

function _getNarrowbody(code) {
  const fleet = {
    '6E': 'A320neo', 'AI': 'A321neo', 'UK': 'A320neo', 'SG': 'B737 MAX',
    'QP': 'B737 MAX', 'IX': 'A320neo', 'LH': 'A320neo', 'EK': 'B777-300ER',
    'QR': 'A350-900', 'SQ': 'A350-900', 'TK': 'A321neo', 'AF': 'A320neo',
    'BA': 'A320neo', 'KL': 'B737-800', 'SK': 'A320neo', 'DY': 'B737 MAX',
  };
  return fleet[code] || 'A320neo';
}

function _getWidebody(code) {
  const widebody = {
    '6E': 'A321neo', 'AI': 'B787-8', 'UK': 'B787-9', 'LH': 'A350-900',
    'EK': 'B777-300ER', 'QR': 'A350-1000', 'SQ': 'A350-900', 'TK': 'B787-9',
    'AF': 'A350-900', 'BA': 'B787-9', 'KL': 'B777-300ER',
  };
  return widebody[code] || 'A350-900';
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  DisruptionMatrix — Master Data Seed');
  console.log('══════════════════════════════════════════════════');

  console.log('\n[1/18] Running migrations...');
  await runMigrations();
  console.log('  [seed] migrations complete');

  console.log('\n[2/18] Seeding airports...');
  await seedAirports();
  console.log('\n[3/18] Seeding airlines...');
  await seedAirlines();
  console.log('\n[4/18] Seeding regions...');
  await seedRegions();
  console.log('\n[5/18] Seeding region countries...');
  await seedRegionCountries();
  console.log('\n[6/18] Seeding sub-regions...');
  await seedSubRegions();
  console.log('\n[7/18] Seeding categories...');
  await seedCategories();
  console.log('\n[8/18] Seeding agent types...');
  await seedAgentTypes();
  console.log('\n[9/18] Seeding hazard types...');
  await seedHazardTypes();
  console.log('\n[10/18] Seeding hazard keywords...');
  await seedHazardKeywords();
  console.log('\n[11/18] Seeding domains...');
  await seedDomains();
  console.log('\n[12/18] Seeding domain profiles...');
  await seedDomainProfiles();
  console.log('\n[13/18] Seeding scoring bands...');
  await seedScoringBands();
  console.log('\n[14/18] Seeding EDPS factors...');
  await seedEdpsFactors();
  console.log('\n[15/18] Seeding band values...');
  await seedBandValues();
  console.log('\n[16/18] Seeding WMO codes...');
  await seedWmoCodes();
  console.log('\n[17/18] Seeding LLM providers...');
  await seedLlmProviders();
  console.log('\n[18/18] Seeding connectors, GDELT queries, subreddits, flight routes, mock scenarios...');
  await seedConnectors();
  await seedGdeltQueries();
  await seedSubreddits();
  await seedFlightRoutes();
  await seedMockScenarios();

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Seed complete!');
  console.log('══════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
