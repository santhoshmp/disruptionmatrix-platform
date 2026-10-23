-- 005_master_data.sql — Master data tables for DisruptionMatrix
-- Standalone module: no existing tables or code are modified.
-- All reference/master data is stored here so it can be managed via API
-- and later migrated to replace hardcoded constants.

-- ── Airports ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_airports (
  iata            TEXT PRIMARY KEY,
  icao            TEXT,
  name            TEXT NOT NULL,
  city            TEXT,
  country         TEXT NOT NULL,
  region_id       TEXT,
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  scheduled       BOOLEAN DEFAULT true,
  daily_movements INTEGER DEFAULT 100,
  cat3_capable    BOOLEAN DEFAULT false,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ref_airports_region ON ref_airports(region_id);
CREATE INDEX IF NOT EXISTS idx_ref_airports_country ON ref_airports(country);
CREATE INDEX IF NOT EXISTS idx_ref_airports_active ON ref_airports(active);

-- ── Airlines ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_airlines (
  iata            TEXT PRIMARY KEY,
  icao            TEXT,
  name            TEXT NOT NULL,
  country         TEXT,
  hub_primary     TEXT,
  hub_secondary   JSONB,
  cat3_capable    BOOLEAN DEFAULT false,
  narrowbody_type TEXT,
  widebody_type   TEXT,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Regions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_regions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sort_order       INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ref_region_countries (
  id              SERIAL PRIMARY KEY,
  region_id       TEXT NOT NULL,
  country         TEXT NOT NULL,
  UNIQUE(region_id, country)
);
CREATE INDEX IF NOT EXISTS idx_ref_region_countries_region ON ref_region_countries(region_id);

CREATE TABLE IF NOT EXISTS ref_sub_regions (
  id              TEXT PRIMARY KEY,
  region_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  bbox            JSONB,
  active          BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_ref_sub_regions_region ON ref_sub_regions(region_id);

-- ── Categories ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_categories (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  sop_key         TEXT,
  color           TEXT,
  icon            TEXT,
  sort_order      INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT true
);

-- ── Agent Types ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_agent_types (
  type            TEXT PRIMARY KEY,
  category_id     TEXT,
  label           TEXT NOT NULL,
  icon            TEXT,
  color           TEXT,
  poll_interval_min INTEGER DEFAULT 5,
  active          BOOLEAN DEFAULT true
);

-- ── Hazard Types ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_hazard_types (
  hazard_type     TEXT PRIMARY KEY,
  family          TEXT,
  requires_cat3   BOOLEAN DEFAULT false,
  default_severity TEXT DEFAULT 'moderate',
  default_sev_val INTEGER DEFAULT 50,
  active          BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ref_hazard_keywords (
  id              SERIAL PRIMARY KEY,
  hazard_type     TEXT NOT NULL,
  keyword         TEXT NOT NULL,
  UNIQUE(hazard_type, keyword)
);
CREATE INDEX IF NOT EXISTS idx_ref_hazard_keywords_type ON ref_hazard_keywords(hazard_type);

-- ── Operational Domains ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_domains (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  sort_order      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ref_domain_profiles (
  id              SERIAL PRIMARY KEY,
  category_id     TEXT NOT NULL,
  domain_name     TEXT NOT NULL,
  weight          DOUBLE PRECISION NOT NULL,
  UNIQUE(category_id, domain_name)
);
CREATE INDEX IF NOT EXISTS idx_ref_domain_profiles_cat ON ref_domain_profiles(category_id);

-- ── Scoring ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_scoring_bands (
  id              SERIAL PRIMARY KEY,
  min_score       INTEGER NOT NULL,
  max_score       INTEGER NOT NULL,
  band            TEXT NOT NULL,
  color           TEXT,
  escalation      TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ref_edps_factors (
  id              SERIAL PRIMARY KEY,
  label           TEXT NOT NULL,
  key             TEXT NOT NULL UNIQUE,
  weight          DOUBLE PRECISION NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ref_band_values (
  id              SERIAL PRIMARY KEY,
  band_type       TEXT NOT NULL,
  band            TEXT NOT NULL,
  numeric_value   INTEGER NOT NULL,
  sort_order      INTEGER DEFAULT 0,
  UNIQUE(band_type, band)
);

-- ── WMO Weather Codes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_wmo_codes (
  wmo_code        INTEGER PRIMARY KEY,
  hazard_type     TEXT NOT NULL
);

-- ── LLM Providers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_llm_providers (
  key             TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  default_model   TEXT,
  models          JSONB,
  key_prefix      TEXT,
  key_url         TEXT,
  docs            TEXT,
  color           TEXT,
  needs_base      BOOLEAN DEFAULT false,
  key_required    BOOLEAN DEFAULT true,
  is_custom       BOOLEAN DEFAULT false,
  description     TEXT,
  sort_order      INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT true
);

-- ── Connector Configs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_connectors (
  id              SERIAL PRIMARY KEY,
  connector       TEXT NOT NULL,
  config_key      TEXT NOT NULL,
  config_value    TEXT NOT NULL,
  config_type     TEXT DEFAULT 'string',
  description     TEXT,
  UNIQUE(connector, config_key)
);

-- ── GDELT Category Queries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_gdelt_queries (
  id              SERIAL PRIMARY KEY,
  category        TEXT NOT NULL,
  query_text      TEXT NOT NULL,
  active          BOOLEAN DEFAULT true
);

-- ── Subreddits ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_subreddits (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  active          BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0
);

-- ── Flight Routes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_flight_routes (
  id              SERIAL PRIMARY KEY,
  origin          TEXT NOT NULL,
  dest            TEXT NOT NULL,
  airline_code    TEXT,
  route_type      TEXT DEFAULT 'domestic',
  active          BOOLEAN DEFAULT true,
  UNIQUE(origin, dest, airline_code)
);
CREATE INDEX IF NOT EXISTS idx_ref_flight_routes_origin ON ref_flight_routes(origin);

-- ── Mock Scenarios ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_mock_scenarios (
  id              SERIAL PRIMARY KEY,
  agent_type      TEXT NOT NULL,
  region          TEXT NOT NULL,
  sub_region      TEXT,
  name            TEXT NOT NULL,
  hazard_type     TEXT,
  airports        JSONB,
  lat             DOUBLE PRECISION,
  lon             DOUBLE PRECISION,
  radius_km       INTEGER,
  summary         TEXT,
  factor_hints    JSONB,
  active          BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ref_mock_scenarios_type ON ref_mock_scenarios(agent_type);
CREATE INDEX IF NOT EXISTS idx_ref_mock_scenarios_region ON ref_mock_scenarios(region);
