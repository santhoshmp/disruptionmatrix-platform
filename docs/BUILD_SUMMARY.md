# DisruptionMatrix — Complete Build Summary

This document is an end-to-end inventory of everything built in **DisruptionMatrix** to date — covering the frontend screens, autonomous agent fleet, live external data connectors, signal-to-event pipeline, EDPS scoring and operational impact engines, LLM-assisted threat profiling, PostgreSQL master-data module, RAG chat assistant, airline-specific lenses, and deployment configuration.

---

## 1. Platform at a Glance

| Dimension | Built & Operational |
|---|---|
| **Autonomous Agents** | **157 agents** total (**156 polling agents** + 1 event-driven impact-assessment agent) across **8 agent types** |
| **Global Coverage** | **11 regions (R1–R11)** · **26 sub-regions** · **117 airports** · **72 airlines** · **74 countries** |
| **External Data Sources** | **13 connectors** across 4 trust tiers (Official APIs, Aviation Providers, News/Advisories, Social) |
| **Processing Pipeline** | **9-stage automated pipeline** running every **10 seconds** (Collection → Event Store) |
| **Threat Scoring (EDPS)** | **8 weighted factors** (0–100 scale), DB-backed weights, live enable/disable with automatic weight renormalization |
| **Operational Impact (OPS)** | **9 operational domains** + airport & airline exposure calculations |
| **Hazard Taxonomy** | **6 threat categories** · **36 hazard types** · DB-backed keyword & severity rules |
| **Database Layer** | **PostgreSQL** with **7 sequential SQL migrations** (`001`–`007`), hybrid in-memory + write-through store, and auto-seeding |
| **LLM Capabilities** | Provider-agnostic service supporting **3 distinct purposes**: Prediction, Conversation (RAG Chat), and Threat Profiling |
| **Frontend Application** | **14 routes / screens** (11 Global platform screens + 3 multi-airline lenses × 3 carriers + Login/Home) |

---

## 2. User-Facing Screens & Navigation (`src/pages/`)

### Global Intelligence Platform
1. **Executive Overview (`/overview` — `ThreatOverview.jsx`)**
   - High-level KPI cards (active threats, critical L4/L3 counts, regional heat, category distribution, top threats).
2. **Threat Board (`/board` — `ThreatBoard.jsx`)**
   - Ranked list and escalation-lane views of all active threats.
   - Filters by region, category, score band, and data mode; shows EDPS score, escalation level (`L1`–`L4`), trajectory (`Escalating` / `Stable` / `Improving`), time-to-impact (`TTI`), and affected airports.
3. **Event Deep-Dive (`/event/:id` — `EventDetail.jsx`)**
   - **Assessment Tab:** 8-factor EDPS breakdown with weights, readouts, and rationale; 9-domain operational impact vector; 1st/2nd/3rd-order causal chain; corroborated evidence trail with source tiers; airport and airline operational exposure (`OPS`).
   - **Process & SOP Tabs:** Category-mapped Standard Operating Procedures (`storm`, `atc`, `ground`, `airspace`, `runway`, `regulatory`), escalation workflow phases, and retrospective notes.
4. **Threat Profiling (`/profiling` — `ThreatProfiling.jsx`)**
   - Supervised LLM-assisted deep analysis of threat events.
   - Queue management (`queued` → `running` → `completed` / `failed` / `cancelled`), real-time progress steps, per-event and global activity logs tab, one-click cancellation of queued/running jobs, and duplicate-click protection.
5. **World Threat Map (`/map` — `WorldMap.jsx`)**
   - Dual-engine interactive map supporting **Mapbox GL**, **MapLibre GL** (free CARTO dark vector tiles), and **Leaflet** (`src/components/map/`, `src/map/`).
   - Displays geolocated threat radii, affected airports, severity color-coding, and category/region filters.
6. **Event Archive (`/archive` — `Archive.jsx`)**
   - Browse automatically or manually archived events with archive reason badges (`stale`, `max_age`, `low_score`, `passed`, `no_airports`, `manual`), search/filter controls, and one-click restore.
7. **AI Assistant (`/chat` — `Chat.jsx`)**
   - Conversational operations assistant backed by a hybrid **RAG (Retrieval-Augmented Generation)** engine (`rag-indexer.js`, `rag-retriever.js`, `conversation-agent.js`) that indexes live events, signals, airports, SOPs, and airline exposure data.
8. **Agent Engine Dashboard (`/agents` — `AgentDashboard.jsx`)**
   - **Overview Tab (`AgentOverview.jsx`):** Fleet status summary, signal throughput, scrollable **Action Required** panel (interval-aware stall detection, inline `⟳ POLL NOW` repoll, dismissible notifications), agent type breakdown, regional coverage bars, and **Live Activity** stream showing per-poll outcomes (`POLL → N signals in Xms`) and pipeline event updates.
   - **Agents Tab (`AgentGrid.jsx`, `AgentDetailPanel.jsx`, `AgentRegionMap.jsx`):** Filterable grid of all 157 agents with last-signal timestamps, per-agent mission, data source mode badges (`REAL` / `MIXED` / `MOCK` / `PLANNED`), last poll duration/output, latest 20 signals read, and manual poll trigger.
   - **Signals Tab (`SignalFeed.jsx`):** Live WebSocket stream of raw incoming signals with type, region, source-mode, and text filters.
9. **Regional Settings (`/regions` — `RegionSettings.jsx`)**
   - Region and sub-region threat profiles, airport coverage, enable/disable toggle per region (pauses/resumes regional agents), and on-demand **SafeAirspace** conflict-zone check.
10. **Sources & Pipeline (`/sources` — `Sources.jsx`)**
    - **Provenance Tab:** Maps every key data object (Airports/Airlines, Flight Schedules, Live Positions, Weather, Earthquakes, Airspace Risk, Geopolitical/Industrial, Social, Threat Events) through its primary → fallback source chain and downstream consumers.
    - **Source Registry Tab (`SourcesTab.jsx`):** All 13 external connectors with tier ratings, auth requirements, rate limits, and live individual or batch health checks (`CHECK ALL`).
    - **Pipeline Tab (`PipelineFlow.jsx`):** Live 9-stage pipeline visualization polling `/api/pipeline`, showing active-only counts, auto-run interval, last-run metrics, manual trigger, and recent run history.
11. **Admin Settings (`/admin` — `AdminSettings.jsx`)**
    - **Parameters Tab (default):** Event lifecycle tunables (`stale_age_hours`, `max_age_hours`, `stale_score`, `low_score`) persisted to `ref_connectors`, plus staggered `⟳ REFRESH ALL AGENT FEEDS` control.
    - **Threat Profile Tab:** Interactive table of all 8 EDPS factors with derivation descriptions, editable weights, live percentage share, and **ON/OFF toggles**; editable score bands (`L1`–`L4`); and read-only reference for derived band values (`likelihood`, `time_to_impact`, `duration`).
    - **LLM Setup Tab:** Independent provider configuration (OpenAI, Anthropic, Azure OpenAI, Gemini, Mistral, Custom/DeepSeek) and enable/disable toggles for **Prediction**, **Conversation**, and **Profiling** purposes, with live connection test.
12. **Master Data Governance (`/master-data` — `MasterData.jsx`)**
    - Full CRUD UI across 11 reference tables: Airports, Airlines, Regions & Sub-regions, Categories, Agent Types, Hazard Types & Keywords, Scoring Bands, EDPS Factors, Band Values, Operational Domains & Profiles, and Connector Configs.
13. **How It Works Guide (`/guide` — `Documentation.jsx`)**
    - Plain-English user documentation with sticky table of contents, smooth scrolling, and a theme-aware **inline SVG Architecture Diagram** explaining sources, agents, pipeline stages, the EDPS formula, the 8 factors, score bands, 9 OPS domains, archiving, profiling, and admin controls.

### Airline-Specific Lenses (`Radar.jsx`, `AirlineMap.jsx`, `DataExplorer.jsx`)
- Tailored views for **Namma Air** (`/radar`), **EuroVista Airways** (`/eva/radar`), and **IndiConnect Airways** (`/ica/radar`) featuring:
  - 5-tier airline exposure radar
  - Route network map with flagged rotations
  - Schedule Gantt workbench + deterministic recovery solver (delay, cancel, reroute, swap) + passenger disruption cost calculator
- **Global Search (`GlobalSearch.jsx`):** Keyboard-navigable (`⌘K` / `/`) search across active threats, airports, airlines, flights, and aircraft.

---

## 3. Autonomous Agent Fleet & Global Coverage (`server/agents/`, `server/engine/`)

### 8 Agent Types
| Agent Type | Poll Interval | Primary Connectors | What It Detects |
|---|---|---|---|
| **Weather (`weather.js`)** | 5 min | NOAA Aviation Weather (`METAR`/`TAF`/`SIGMET`), Open-Meteo, NASA EONET | Thunderstorms, low visibility/fog, high winds, snow/ice, tropical cyclones, volcanic ash |
| **ATC / Airspace (`atc.js`)** | 2 min | FAA ASWS, FAA TFR, OpenSky | Ground stops, ground delay programs, airspace closures, flow control |
| **Flight Schedules (`flight.js`)** | 2 min | adsb.lol, OpenSky, AirLabs, AviationStack | Live airport ground activity (corroboration), emergency squawks (`7500`/`7600`/`7700`), delays & cancellations |
| **Geopolitical (`geopolitical.js`)** | 10 min | SafeAirspace, GDELT, FAA TFR | Country-level "Do Not Fly" / Level 1–3 conflict-zone advisories, airspace closures, military/sanction events |
| **Industrial Action (`industrial.js`)** | 30 min | GDELT | Airline crew, ATC, and ground-handler strikes, walkouts, labor disputes |
| **Infrastructure (`infrastructure.js`)** | 10 min | USGS Earthquakes, NASA EONET, FAA ASWS | Earthquakes near airports, runway/terminal outages, power/IT failures |
| **Regulatory (`regulatory.js`)** | 60 min | FAA TFR, GDELT | Curfews, slot restrictions, safety directives, bilateral airspace rules |
| **Social (`social.js`)** | 5 min | Reddit OAuth API | Passenger/crew reports from aviation subreddits (`corroborateOnly: true` — enriches existing events without creating false alarms) |

### 11 Regions & 26 Sub-Regions
- **R1 Indian Subcontinent** (South, North, West, East India, Bay of Bengal)
- **R2 Europe** (Central, Western, Northern, Southern Europe)
- **R3 Gulf / Middle East** (Gulf States, Overflight Corridor)
- **R4 Southeast Asia** (Mainland & Maritime SEA)
- **R5 North Atlantic / North America** (British Isles, North America)
- **R6 East Asia** (Hong Kong, Japan, South Korea, Taiwan)
- **R7 Africa** (East Africa, Southern Africa)
- **R8 Oceania** (Australia & New Zealand)
- **R9 South America** (Brazil, Southern Cone, Andean)
- **R10 Russia / CIS** (Western Russia, Caucasus & Central Asia — `SVO`, `DME`, `LED`, `AER`, `SVX`, `MSQ`, `GYD`, `TBS`, `ALA`, `TSE`, `TAS`)
- **R11 China** (North, East & South, West China — `PEK`, `PKX`, `PVG`, `HGH`, `NKG`, `XIY`, `CAN`, `SZX`, `TFU`, `CKG`, `KMG`, `URC`)

### Agent Runtime & Resilience Features
- Staggered startup (`0–3s` random jitter) and staggered batch refresh (`200ms` spacing on `POST /api/agents/refresh-all`) to avoid bursting external APIs.
- Per-connector rate limiting and response caching (`rate-limiter.js`, in-flight request deduplication + 3-way concurrency limiter in `safeairspace.js`, 5-min cache in `adsblol.js`, 90s shared state cache in `opensky.js`).
- Ground-activity signal throttling in `flight.js` (emits only on `±3` aircraft / `±25%` change or 30-min heartbeat) so high-frequency ADS-B pings do not flood the signal buffer.
- Per-poll outcome tracking (`status`, `totalSignals`, `lastSignalsGenerated`, `lastSignalAt`, `lastSignalName`, `lastDurationMs`, `lastError`) broadcast over WebSocket as `agent_poll`.

---

## 4. Signal-to-Event Pipeline, EDPS Scoring & OPS Impact (`server/engine/`)

### 9-Stage Pipeline (`pipeline.js`)
Runs automatically every 10 seconds on unprocessed signals:
1. **Collection** — Raw observations gathered by regional agents.
2. **Normalization** — Standardized into the signal contract (`agent-base.js`).
3. **Correlation (`correlation.js`)** — Groups signals by hazard family, airport overlap, and geographic proximity; merges into existing active events across runs while preserving evidence, measurements, and OPS data. Social/ground-count signals marked `corroborateOnly` enrich matching events without spawning standalone alerts.
4. **Scoring (`scoring.js`)** — Computes the 0–100 **EDPS (Event Disruption Priority Score)**:
   $$\text{EDPS} = \frac{\sum (\text{factor value} \times \text{factor weight})}{\sum \text{active weights}}$$
   - **8 Factors:** Probability (18%), Severity (18%), Time to Impact (14%), Geographic Reach (12%), Expected Duration (12%), Escalation Rate (10%), Source Credibility (10%), Prediction Confidence (6%).
   - Honors `ref_edps_factors.active`: disabled factors contribute `0` and remaining weights automatically renormalize to keep the 0–100 scale intact.
   - Maps score to **L4 Critical (80–100)**, **L3 High (65–79)**, **L2 Moderate (45–64)**, **L1 Low (0–44)**.
5. **Domain Impact (`domain-impact.js`)** — Computes impact across 9 operational domains (`Flight schedule`, `Crew`, `Aircraft rotations`, `Airport operations`, `Passengers`, `Cargo`, `Catering`, `Maintenance`, `Regulatory`) using category-specific weight profiles from `ref_domain_profiles`.
6. **Causal Chain (`causal-chain.js`)** — Builds 1st-, 2nd-, and 3rd-order operational consequences with likelihood and lead times.
7. **Evidence Assembly** — Deduplicates and ranks supporting intelligence by source tier (`T1`–`T3`).
8. **Operational Exposure (`impact-assessment.js`, `flight-estimator.js`)** — Calculates per-airport severity, CAT III requirements, delayed/cancelled flight estimates, and per-airline exposure scores.
9. **Event Store & Broadcast (`event-store.js`)** — Persists to PostgreSQL and broadcasts live updates (`event`, `event_updated`, `ops`) over WebSocket/SSE (`/api/stream`).

---

## 5. Event Lifecycle & Archiver (`server/engine/archiver.js`)

- Runs automatically every 15 minutes (and on demand via `/api/events/archive-sweep`).
- Tunable via **Admin → Parameters** (`ref_connectors` under `connector='archiver'`):
  - `stale_age_hours` (default `72h`) + `stale_score` (default `65`): archives stale non-critical events.
  - `max_age_hours` (default `240h` / 10 days): hard retention cap regardless of score (`0` disables).
  - `low_score` (default `50`): archives low-severity noise immediately.
  - Also archives events whose time window has passed or that have no aviation/airport nexus.
- **Hysteresis-safe auto-restore:** Archived events that receive fresh signals are restored only when `archiveReason()` returns `null` (preventing archive↔restore oscillation).

---

## 6. Database Schema & Master Data Architecture (`server/db/`)

### Migrations (`server/db/migrations/`)
- `001_initial_schema.sql` — Core runtime tables: `events`, `signals`, `ops`, `agents`, `regions`, `settings`.
- `002_llm_settings.sql` — `llm_settings` table for multi-provider LLM configuration.
- `003_rag_layer.sql` — Full-text / vector-ready RAG document store (`rag_documents`) and chat session history (`chat_sessions`, `chat_messages`).
- `004_llm_purposes.sql` — Extends `llm_settings` with per-purpose configurations (`prediction`, `conversation`, `profiling`).
- `005_master_data.sql` — Creates 14 governed reference tables (`ref_regions`, `ref_sub_regions`, `ref_region_countries`, `ref_airports`, `ref_airlines`, `ref_airline_hubs`, `ref_categories`, `ref_agent_types`, `ref_hazard_types`, `ref_hazard_keywords`, `ref_scoring_bands`, `ref_edps_factors`, `ref_band_values`, `ref_domains`, `ref_domain_profiles`, `ref_connectors`).
- `006_event_archive.sql` — Adds `archived`, `archived_at`, and `archive_reason` columns + indexes to `events`.
- `007_edps_factor_flags.sql` — Adds `active` boolean toggle and human-readable `description` to `ref_edps_factors`.

### Reference Loader (`server/data/reference-loader.js`)
- Loads all `ref_*` tables into an in-memory cache on startup and refreshes every 60 seconds, with automatic fallback to `agent-config.json` / hardcoded constants if PostgreSQL is unreachable.

---

## 7. Deployment & Documentation Artifacts (`docs/`)

- **Single-Service Cloud Packaging (`server/index.js`, `package.json`):**
  - Express serves the compiled Vite SPA from `dist/` with client-side route fallback alongside `/api/*` and `/api/stream` (WebSocket + SSE) on a single port (`PORT`).
  - `npm run railway:build` installs root + server dependencies and builds the frontend bundle.
- **Documentation Suite:**
  - <ref_file file="/Users/santhoshmannil/myprojects/DisruptionMatrix/README.md" /> — Architecture, quickstart, routes, and scoring overview.
  - <ref_file file="/Users/santhoshmannil/myprojects/DisruptionMatrix/docs/PRODUCT_SUMMARY.md" /> — Executive problem statement, vision, product capabilities, scale metrics, and differentiators for management presentations.
  - <ref_file file="/Users/santhoshmannil/myprojects/DisruptionMatrix/docs/DEPLOY_RAILWAY_SUPABASE.md" /> — Step-by-step runbook for migrating PostgreSQL to Supabase and deploying the application to Railway.
  - <ref_file file="/Users/santhoshmannil/myprojects/DisruptionMatrix/docs/ROAD_TO_PRODUCTION.md" /> — P0–P3 security, data retention, resilience, testing, and 4-phase productionization plan.
  - <ref_file file="/Users/santhoshmannil/myprojects/DisruptionMatrix/docs/Threat_Profiling_Agent_Design.md" /> — Design specification for the LLM-assisted Threat Profiling agent.
