# DisruptionMatrix — Road to Production Plan

This document outlines the engineering, security, data, and operational roadmap required to take **DisruptionMatrix** from a live-data functional platform to a hardened, production-grade enterprise system.

---

## Executive Summary

DisruptionMatrix already operates a full end-to-end threat intelligence pipeline: **156 autonomous agents** across **9 global regions**, **13 integrated data sources**, a **10-second correlation and EDPS scoring pipeline**, **PostgreSQL-backed master data (`ref_*` tables)**, and **LLM-assisted threat profiling**.

To productionize the application for external deployment (Railway + Supabase) and multi-user airline operations teams, work is organized into four priority tiers (**P0–P3**) across a structured **4-Phase Rollout Plan**.

| Tier | Focus Area | Goal | Target Phase |
|---|---|---|---|
| **P0** | Security & Access Control | Protect endpoints, credentials, and external API/LLM budgets before public internet exposure | Phase 1 |
| **P1** | Data Scale & Runtime Resilience | Bounded database storage, durable job/pipeline state across restarts, single source of truth | Phase 1–2 |
| **P2** | Domain Depth & Operational Actionability | Commercial flight schedules, timestamped NOTAMs, severity floors, outbound alerting | Phase 3 |
| **P3** | Engineering Hygiene, CI/CD & Observability | Automated test suite, bundle splitting, error boundaries, structured logging & APM | Phase 2–4 |

---

## P0 — Security & Access Control (Blockers before public internet exposure)

### 1. Server-Side Authentication & Role-Based Access Control (RBAC)
- **Current state:**
  - `src/auth.js` checks `VITE_AUTH_USER` / `VITE_AUTH_PASS` in the browser and sets `sessionStorage['dm-auth-session'] = 'true'`. Because `VITE_*` variables are baked into the client bundle at build time, credentials are visible in browser DevTools.
  - Backend API routes (`/api/master/*`, `/api/llm/*`, `/api/agents/refresh-all`, `/api/profiling/trigger-all`, `DELETE` endpoints) and the WebSocket `/api/stream` endpoint have no authentication middleware (`server/index.js`).
- **Production requirement:**
  - Move authentication to the server (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`) using `HttpOnly`, `Secure`, `SameSite=Strict` signed session cookies or JWTs (or integrate Supabase Auth / Microsoft Entra ID SSO).
  - Add authentication middleware across all `/api/*` routes and WebSocket upgrade handshakes (`server/routes/stream.js`).
  - Enforce three roles:
    - **Viewer:** Read-only access to Threat Board, World Map, Overview, Archive, Sources, Guide.
    - **Operator:** Can trigger agent polls, queue/cancel threat profiling, archive/restore events, use AI Assistant.
    - **Admin:** Full access to Admin Settings (LLM setup, lifecycle parameters, threat profile weights/bands) and Master Data CRUD.
  - Remove `VITE_AUTH_USER` and `VITE_AUTH_PASS` from `.env` and client bundles.

### 2. LLM API Key Encryption at Rest & SSRF Protection
- **Current state:**
  - `server/db/repositories/llm-settings.js` stores `api_key` in plaintext in the `llm_settings` table.
  - `PUT /api/llm/providers/:provider` accepts an arbitrary `apiBase` URL and `POST /api/llm/test` immediately invokes it from the server, creating a Server-Side Request Forgery (SSRF) risk if left unauthenticated.
- **Production requirement:**
  - Encrypt `llm_settings.api_key` at rest using AES-256-GCM keyed by a server-only environment variable (`ENCRYPTION_KEY`), or restrict secret storage to server environment variables.
  - Validate `apiBase` against an allowlist of known HTTPS provider domains (or block private/loopback/link-local IP ranges `127.0.0.0/8`, `10.0.0.0/8`, `169.254.169.254`, `localhost`).

### 3. CORS Lockdown, HTTP Security Headers & Rate Limiting
- **Current state:**
  - `server/index.js` uses `app.use(cors())` (all origins allowed) and `express.json()` without body size limits or rate limiters.
- **Production requirement:**
  - Restrict CORS to the configured `ALLOWED_ORIGINS` list in production.
  - Add `helmet` for HTTP security headers and set `express.json({ limit: '256kb' })`.
  - Add `express-rate-limit` on high-cost endpoints:
    - `/api/agents/refresh-all` and `/api/agents/:id/trigger` (protect external API quotas)
    - `/api/profiling/trigger*` and `/api/chat` (protect LLM token spend)
    - `/api/auth/login` (brute-force protection)

---

## P1 — Data Growth, Memory & Runtime Reliability

### 4. PostgreSQL `signals` Table Retention & Write Batching
- **Current state:**
  - In-memory signals are capped at 5,000 (`server/store/event-store.js`), but every signal is written to PostgreSQL and never pruned (`~390,000+` rows accumulated locally). On cloud databases (e.g., Supabase 500 MB free tier or fixed-disk plans), unbounded signal growth will exhaust disk space.
  - `signalsRepo.deleteOlderThan(days)` in `server/db/repositories/signals.js` is never invoked, and its SQL (`INTERVAL '$1 days'`) places `$1` inside a string literal.
  - `store.addSignal()` fires both `signalsRepo.insert()` and `agentsRepo.updateStatus()` per signal, duplicating the status write already performed at the end of `Agent._poll()`.
- **Production requirement:**
  - Fix `signalsRepo.deleteOlderThan(days)` to use parameterized interval math (`created_at < NOW() - ($1 * INTERVAL '1 day')`) and run it on the archiver schedule (default retention: `7 days`, configurable via `ref_connectors` as `archiver.signal_retention_days`).
  - Add a composite index on `signals(created_at DESC)` and `signals(agent_id, created_at DESC)` for fast pruning and per-agent queries.
  - Remove the redundant per-signal `agentsRepo.updateStatus()` call inside `store.addSignal()` so agent status writes happen once per poll cycle.

### 5. Durable Pipeline & Threat Profiling State Across Restarts
- **Current state:**
  - `processedSignals` in `server/engine/pipeline.js` is an in-memory `Set` that grows without bound and resets on server restart (causing hydrated signals to be re-evaluated on boot).
  - `server/engine/threat-profiler.js` keeps `queue`, `profilingStatus`, and `profilingLogs` in memory; a container restart or deployment drops queued profiling jobs.
  - No `SIGTERM` / `SIGINT` handler exists to stop agent intervals, close WebSocket connections, and drain the PostgreSQL pool cleanly during zero-downtime deploys.
- **Production requirement:**
  - Bound `processedSignals` to match the ring buffer (evict IDs when signals shift out of `store.signals`) and seed `processedSignals` with already-hydrated signal IDs on startup so restarts don't re-run historical signals.
  - Persist profiling status (`queued`, `running`, `completed`, `failed`, `cancelled`) and logs to PostgreSQL so interrupted profiling jobs resume automatically after a deploy.
  - Add a graceful shutdown handler (`SIGTERM` / `SIGINT`) in `server/index.js`: stop `agentManager`, pipeline, and archiver timers, close `wss`, close HTTP server, and call `pool.end()`.

### 6. Complete Cutover from Static `agent-config.json` to Master Data Tables
- **Current state:**
  - Master data (`ref_regions`, `ref_sub_regions`, `ref_airports`, `ref_agent_types`) lives in PostgreSQL, but `agentManager.startAll()` still instantiates agents from `src/data/agent-config.json` and uses a separate `regions` table for enable/disable flags.
- **Production requirement:**
  - Generate the agent fleet dynamically from `ref_regions` × `ref_sub_regions` × `ref_agent_types` in PostgreSQL.
  - Consolidate the runtime `regions` table into `ref_regions.active` so adding or toggling a region in Master Data immediately governs agent spawning without editing JSON files.

---

## P2 — Domain Depth & Operational Actionability

### 7. Commercial Flight Schedule & Live NOTAM Feeds
- **Flight schedules & actuals:** Activate `AIRLABS_KEY` (or Cirium / OAG) in production so flight delay/cancellation signals reflect real airline schedules rather than fallback estimates, and cache airport schedule windows in PostgreSQL to minimize API spend.
- **Timestamped NOTAM feed:** Supplement SafeAirspace country-level conflict advisories with an operational NOTAM feed (FAA SWIM / ICAO / Autorouter) so temporary runway closures, airway restrictions, and导航/GPS outages carry exact effective/expiry timestamps.
- **EDPS compounding-risk floor:** Add an admin-configurable severity floor rule in `server/engine/scoring.js` (e.g., when `severity >= 90` and `probability >= 60`, enforce `score >= 80` / L4 Critical) so low-frequency catastrophic events (such as emergency squawks `7500`/`7700` or sudden airspace closures) are never diluted by linear averaging.

### 8. Outbound Alerting & Notification Channels
- **Current state:** Operators must have the dashboard open to notice new L3/L4 threats.
- **Production requirement:**
  - Add an outbound notification dispatcher triggered when an event is created at or escalates to **L3 High** or **L4 Critical** (or impacts a watched hub airport).
  - Support **Webhook, Slack, Microsoft Teams, and Email (SMTP/Resend)** channels with per-event cooldown/deduplication windows configured in Admin.

---

## P3 — Engineering Hygiene, Testing & Observability

### 9. Automated Testing & CI/CD Pipeline
- **Unit tests (Vitest):**
  - `server/engine/scoring.js` — EDPS calculation, disabled-factor weight renormalization, band mapping, TTI derivation.
  - `server/engine/correlation.js` — cross-run deduplication, airport overlap merging, `corroborateOnly` enrichment.
  - `server/engine/archiver.js` — stale age, max age, low score, and restore hysteresis rules.
  - `server/engine/domain-impact.js` — category-to-domain vector calculation.
- **API & migration integration tests:**
  - Spin up a disposable PostgreSQL schema, run migrations `001`–`007` + `seed-master-data.js`, and verify `/api/health`, `/api/events`, `/api/master/*`, and `/api/pipeline`.
- **GitHub Actions CI (`.github/workflows/ci.yml`):**
  - Trigger on push/PR to `main`: install dependencies, run backend & unit tests, and verify `npm run railway:build` succeeds.

### 10. Frontend Performance, Code Splitting & Error Boundaries
- **Current state:** Vite builds a single main bundle plus both `mapbox-gl` (1.86 MB) and `maplibre-gl` (1.06 MB) chunks, and there is no React Error Boundary.
- **Production requirement:**
  - Route-level lazy loading (`React.lazy` + `Suspense`) for heavy views (`WorldMap`, `AirlineMap`, `MasterData`, `AdminSettings`, `Documentation`) and dynamic import of only the selected map engine.
  - Add a top-level `ErrorBoundary` component in `src/App.jsx` so a rendering failure in one panel displays a recoverable fallback card rather than blanking the app.
  - Remove legacy prototype directories (`data/`, `design/`, and any stale local `app/` copy) to keep the repository clean.

### 11. Structured Logging, Metrics & Error Tracking
- Replace ad-hoc `console.log` / `console.error` calls with a structured JSON logger (`pino`) tagged with `requestId`, `agentId`, `connector`, and `durationMs`.
- Add `/api/health/ready` (verifies active DB query + pipeline recency) for Railway health checks and uptime monitors.
- Integrate Sentry (or OpenTelemetry) on both backend and React frontend to capture unhandled exceptions, connector timeouts, and LLM schema validation failures.

---

## Phased Rollout Schedule

### Phase 1 — Security & Cloud Stability (Week 1 · Pre-External Launch)
- [ ] Server-side session/JWT authentication + route & WebSocket protection (P0.1)
- [ ] Encrypt LLM API keys at rest + `apiBase` SSRF validation (P0.2)
- [ ] Lock down CORS, add `helmet`, payload limits, and `express-rate-limit` (P0.3)
- [ ] Fix & schedule PostgreSQL `signals` retention job + remove duplicate per-signal agent status write (P1.4)
- [ ] Add `SIGTERM`/`SIGINT` graceful shutdown and seed `processedSignals` on startup (P1.5)

### Phase 2 — Resilience, Testing & Frontend Hardening (Week 2)
- [ ] Persist threat-profiling queue & status in PostgreSQL across restarts (P1.5)
- [ ] Add React Error Boundary + route/map dynamic code splitting (P3.10)
- [ ] Add Vitest unit & migration integration tests + GitHub Actions CI workflow (P3.9)
- [ ] Structured logging (`pino`) + readiness health check endpoint (P3.11)

### Phase 3 — Master-Data Unification & Domain Upgrades (Week 3)
- [ ] Spawn agents dynamically from `ref_*` tables and retire static `agent-config.json` (P1.6)
- [ ] Add configurable EDPS severity-floor rule for catastrophic events (P2.7)
- [ ] Outbound alerting webhooks (Slack / Teams / Email) on L3/L4 escalations (P2.8)

### Phase 4 — Enterprise Integrations (Week 4+)
- [ ] Production flight schedule key (`AIRLABS_KEY` / Cirium) with DB schedule caching (P2.7)
- [ ] Timestamped operational NOTAM feed integration (P2.7)
- [ ] SSO integration (Entra ID / OIDC) and audit logging for Admin & Master Data edits (P0.1)
