# DisruptionMatrix

### Real-Time Aviation Threat Intelligence Platform

DisruptionMatrix is an agent-driven platform that continuously monitors global aviation disruption sources — weather, airspace closures, strikes, geopolitical events, earthquakes, live flight data — and turns raw signals into scored, explainable, operationally-actionable threat events.

Autonomous monitoring agents collect data around the clock; a processing pipeline correlates signals into events, scores them on a transparent weighted model (EDPS), and quantifies operational impact across nine domains — presented on a live threat board, world map, and deep-dive profiling views.

---

## How It Works

```
External sources (NOAA · USGS · FAA · SafeAirspace · GDELT · adsb.lol · OpenSky · Reddit …)
        │
        ▼
   156 polling agents (8 types × regions/sub-regions)
        │  signals
        ▼
   Signal buffer → Pipeline (every ~10s)
        │  correlate → score → impact → enrich
        ▼
   Event store (PostgreSQL)
        │
        ▼
   Threat Board · World Map · Profiling · OPS impact · AI Assistant
```

Master data (PostgreSQL `ref_*` tables) feeds both the agents and the scoring engine — airports, regions, hazard types, factor weights, band values. Admin settings tune the model at runtime; the archiver retires stale events on a schedule.

## Key Capabilities

- **Global coverage** — 9 regions, 26 sub-regions, 117 airports, 72 airlines, 74 countries under continuous watch
- **13 integrated sources** — official APIs (NOAA, USGS, FAA, NASA EONET, Open-Meteo), aviation providers (adsb.lol, OpenSky, AirLabs, AviationStack), news/advisories (GDELT, SafeAirspace), and social corroboration (Reddit)
- **Explainable scoring** — every event's 0–100 EDPS score decomposes into 8 weighted factors with per-factor readouts and rationale; bands L1–L4
- **Operational impact** — category-specific profiles across 9 domains (flights, crew, rotations, airport ops, passengers, cargo, catering, maintenance, regulatory) + airport/airline exposure
- **Threat profiling** — LLM-assisted deep analysis per event, run as supervised jobs (queued → running → done, with progress, logs, cancellation)
- **Live agent dashboard** — fleet status, per-poll outcomes (`N signals in Xms`), stalled-agent detection, dismissible action alerts, force-refresh
- **Provenance & source health** — every data object traces to its source chain; per-source health checks and mode labels (real / mock / planned)
- **Full administrative control** — factor weights and on/off toggles, score bands, event lifecycle thresholds, region enable/disable, LLM provider config
- **Event lifecycle** — configurable stale/max-age archiving with auto-restore on fresh signals

## The EDPS Score

```
score = Σ (factor value × factor weight) ÷ Σ active weights    →  0–100
```

| Factor | Weight | Captures |
|---|---|---|
| Probability of occurrence | 18% | Corroboration + forecast confidence |
| Severity if realised | 18% | Hazard default adjusted by magnitude |
| Time to impact | 14% | How soon operations are affected |
| Geographic reach | 12% | Airports / area affected |
| Expected duration | 12% | How long it lasts |
| Escalation rate | 10% | Worsening vs improving |
| Source credibility | 10% | Source tier trust |
| Prediction confidence | 6% | Cross-source agreement |

Bands: **L4 Critical 80+ · L3 High 65–79 · L2 Moderate 45–64 · L1 Low <45** — thresholds tunable in Admin.

Weights, factor enable/disable, band ranges, and qualitative→numeric mappings all live in master data and take effect within ~60s — no redeploy.

## Screens

| Route | Purpose |
|---|---|
| `/overview` | Executive summary |
| `/board` | Prioritised active threats |
| `/profiling` | Profiling jobs — progress, logs, cancel |
| `/map` | Global event distribution |
| `/archive` | Archived events + restore |
| `/agents` | Agent Engine — fleet, grid, live signal feed |
| `/regions` | Regional profiles, airspace checks, enable/disable |
| `/sources` | Provenance · source registry · live pipeline |
| `/admin` | Parameters · Threat Profile (scoring) · LLM setup |
| `/master-data` | Governed reference data CRUD |
| `/guide` | Built-in "How It Works" user guide |

---

## Tech Stack

- **Frontend** — React 18, Vite, react-router, MapLibre/Mapbox GL + Leaflet
- **Backend** — Node.js, Express, WebSocket live stream (`/api/stream`)
- **Database** — PostgreSQL (local, Supabase, or any `DATABASE_URL`); migrations + auto-seed on startup
- **Agents** — 8 agent types × per-sub-region instances, own poll intervals, rate limiting, mock fallbacks
- **LLM** — provider-agnostic profiling + AI assistant (configured in Admin → LLM Setup)

## Getting Started

```bash
# 1. PostgreSQL — create the database
createdb disruption_matrix        # or any local Postgres

# 2. Environment
cp .env.example .env              # set DATABASE_URL or DB_* creds, API keys, VITE_*

# 3. Install + run
npm install && npm --prefix server install
node server/index.js              # API + agents + WS on :3001  (migrations run automatically)
npm run dev                       # frontend dev server on :5173 (proxies /api → :3001)
```

Production mode: `npm run build` then `node server/index.js` serves the SPA on :3001 too.

## Deployment

See **[docs/DEPLOY_RAILWAY_SUPABASE.md](docs/DEPLOY_RAILWAY_SUPABASE.md)** — database on Supabase, app on Railway (single service: SPA + API + WebSocket).

## Documentation

- [Product summary](docs/PRODUCT_SUMMARY.md) — problem, vision, solution for management decks
- [Threat profiling design](docs/Threat_Profiling_Agent_Design.md)
- In-app **How It Works** (`/guide`) — plain-language explanation of sources, scoring, impact, lifecycle

## Notes

- Airline demo views (Namma Air, EuroVista, IndiConnect) use synthetic airline data — names, routes, fleets are fictional.
- Real threat data comes from live public APIs; sources marked `mock` or `planned` are labelled, never hidden.
- `.env` is never committed — secrets go in environment variables / Railway Variables.
