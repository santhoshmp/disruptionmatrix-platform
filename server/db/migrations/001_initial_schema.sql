-- 001_initial_schema.sql — Initial schema for DisruptionMatrix
-- All nested objects (factors, domains, chain, evidence, etc.) stored as JSONB
-- because they're always read/written as a unit, never queried by inner field.

-- ── Events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  ref             TEXT UNIQUE,
  name            TEXT NOT NULL,
  cat             TEXT NOT NULL,
  "where"         TEXT,
  detected        TEXT,
  score           INTEGER,
  conf            INTEGER,
  traj            TEXT,
  tti             TEXT,
  tti_min         INTEGER,
  esc             INTEGER,
  summary         TEXT,
  sop_key         TEXT,
  factors         JSONB,
  domains         JSONB,
  chain           JSONB,
  evidence        JSONB,
  assumptions     JSONB,
  gaps            JSONB,
  source          TEXT DEFAULT 'seeded',
  signal_count    INTEGER,
  source_signals  JSONB,
  geo             JSONB,
  airports        JSONB,
  airspace        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_score ON events(score DESC);
CREATE INDEX IF NOT EXISTS idx_events_cat ON events(cat);
CREATE INDEX IF NOT EXISTS idx_events_esc ON events(esc);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);

-- ── Signals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signals (
  signal_id        TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  agent_type       TEXT NOT NULL,
  region           TEXT,
  sub_region       TEXT,
  detected         TEXT,
  name             TEXT,
  hazard_type      TEXT,
  geo              JSONB,
  airports         JSONB,
  airspace         JSONB,
  summary          TEXT,
  factor_hints     JSONB,
  domains          JSONB,
  preliminary_effects JSONB,
  evidence         JSONB,
  raw_refs         JSONB,
  event_id         TEXT REFERENCES events(id) ON DELETE SET NULL,
  data_source_mode TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_agent ON signals(agent_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(agent_type);
CREATE INDEX IF NOT EXISTS idx_signals_region ON signals(region);
CREATE INDEX IF NOT EXISTS idx_signals_event ON signals(event_id);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);

-- ── OPS (Impact Assessments) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ops (
  event_id          TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  basis            TEXT,
  airports          JSONB,
  airlines          JSONB,
  overflight_exposure JSONB,
  computed_at       TIMESTAMPTZ DEFAULT NOW(),
  edps              INTEGER,
  impact_mode       TEXT DEFAULT 'mock'
);

-- ── Agents (Runtime State) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id               TEXT PRIMARY KEY,
  type             TEXT NOT NULL,
  region           TEXT,
  sub_region       TEXT,
  priority         TEXT,
  status           TEXT DEFAULT 'idle',
  last_poll        TIMESTAMPTZ,
  last_signal_at   TIMESTAMPTZ,
  signal_count     INTEGER DEFAULT 0,
  data_source_mode TEXT DEFAULT 'mock',
  error_count      INTEGER DEFAULT 0,
  last_error       TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);

-- ── Regions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS regions (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  priority         TEXT,
  enabled          BOOLEAN DEFAULT true,
  sub_regions      JSONB,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings (key-value) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key              TEXT PRIMARY KEY,
  value            TEXT,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Schema Migrations Tracking ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  id               TEXT PRIMARY KEY,
  applied_at       TIMESTAMPTZ DEFAULT NOW()
);
