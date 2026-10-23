# Deploy: Database → Supabase, Application → Railway

Architecture after migration: **one Railway service** runs `server/index.js` (Express API + agent engine + WebSocket) and also serves the built React frontend from `dist/` — everything on one origin, no CORS or proxy config needed. **Supabase Postgres** replaces the local database.

```
Browser → https://<app>.up.railway.app
             ├─ /            → React SPA (static, dist/)
             ├─ /api/*       → Express API
             └─ /api/stream  → WebSocket (Railway supports WS)
Railway service ──DATABASE_URL──> Supabase Postgres
```

## Step 0 — Local prep (already done in code)

- `server/index.js` serves `../dist` + SPA fallback for non-`/api` routes
- `package.json` has `railway:build` (installs both deps + builds frontend) and `start`
- `server/db/pool.js` already uses `DATABASE_URL` and auto-enables SSL when the URL contains `sslmode=require`
- Migrations + seeding run automatically on server start (`store.init()` → `runMigrations()`)

You only need: a Supabase project, a Railway project, and this repo pushed to GitHub.

---

## Step 1 — Create the Supabase database

1. https://supabase.com → New project → pick org, region (choose one **close to your Railway region**, e.g. both `us-east` / both `ap-south`), set a DB password (save it).
2. Wait ~2 min for provisioning.
3. Project → **Connect** (top bar) → copy the **Session pooler** string:
   ```
   postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres
   ```
   Use **Session mode (port 5432)**, not Transaction mode — Transaction pooling (pgbouncer) breaks prepared statements/long-lived pools that `pg` uses. Session pooler is IPv4-reachable from Railway and safe for a persistent server.
4. Append `?sslmode=require`:
   ```
   postgresql://postgres.<ref>:<pw>@aws-<n>-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```

## Step 2 — Copy your local data to Supabase

Your local DB is `disruption_matrix` (user `dm_app`). Two options:

### Option A — full dump (keeps events/signals/history)

```bash
cd /Users/santhoshmannil/myprojects/DisruptionMatrix

pg_dump "postgresql://dm_app:disrupt2026@localhost:5432/disruption_matrix" \
  --no-owner --no-privileges --clean --if-exists \
  -f /tmp/dm_dump.sql

psql "postgresql://postgres.<ref>:<pw>@aws-<n>-<region>.pooler.supabase.com:5432/postgres?sslmode=require" \
  -f /tmp/dm_dump.sql
```

`--no-owner --no-privileges` is important — Supabase role names differ; without it the restore fails on `ALTER ... OWNER` lines. `--clean` drops objects first, so re-running is safe. Expect harmless notices about `schema_migrations` or extension ownership.

### Option B — fresh start (schema + seed only, no history)

Skip the dump — on first boot the server runs all migrations and seeds reference data itself. Fastest path, but loses event/signal history and any hand-edited master data.

> Recommended: **Option A** — you've already tuned master data (EDPS factors, regions R10/R11, archiver params).

## Step 3 — Smoke-test the backend against Supabase locally

```bash
DATABASE_URL="postgresql://postgres.<ref>:<pw>@aws-<n>-<region>.pooler.supabase.com:5432/postgres?sslmode=require" \
AGENTS=off node server/index.js
```

Check the log for `[EventStore] Connected to PostgreSQL` and `[EventStore] Ready: … events … (DB: ON)`, then `curl localhost:3001/api/master/summary`. Ctrl-C to stop.

## Step 4 — Deploy to Railway

1. Push the repo to GitHub (include the code changes above).
2. https://railway.app → New Project → **Deploy from GitHub repo** → pick DisruptionMatrix.
3. In the service → **Settings**:
   - Build command: `npm run railway:build`
   - Start command: `npm start`
   - (Railway auto-detects Node/Nixpacks; it runs `npm install` first — our build script also installs `server/` deps and builds `dist/`.)
4. **Variables** tab — add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase session-pooler URL with `?sslmode=require` |
   | `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` | your existing values from `.env` |
   | `AIRLABS_KEY`, `AVIATIONSTACK_KEY`, `REDDIT_*` | same, if/when you have them |
   | `VITE_MAPBOX_TOKEN` | needed at **build time** (Vite bakes it into the bundle) |
   | `VITE_AUTH_USER` / `VITE_AUTH_PASS` | login credentials baked into the build |
   | `AGENTS` | `on` (or `off` to run without polling) |
   | `NODE_ENV` | `production` |
   | `PORT` | *not needed* — Railway injects it automatically |

   Any `VITE_*` change later requires a redeploy (they're compile-time constants).
5. **Networking** → Generate Domain → you get `https://<name>.up.railway.app`.
6. Deploy. Watch logs for `Server running on …`, `Started 156 polling agents`, `[EventStore] Ready`.

## Step 5 — Verify

- `https://<app>.up.railway.app/` → SPA loads
- `/api/health` → `{ stats: { agents: 157, ... } }`
- Agent Engine → LIVE indicator green (WS works on Railway's proxy)
- Sources → CHECK ALL → sources hit the internet from Railway
- Agents actually polling → confirms DATABASE_URL + egress both work

## Notes & gotchas

- **WebSockets**: Railway proxies WS on the same domain — no extra config. The client connects to same-origin `/api/stream`, which is exactly how it works in the single-service layout.
- **Supabase free tier** pauses the DB after ~7 days of inactivity — the app's continuous queries keep it active anyway.
- **Keep polling modest**: 156 agents generate real egress. Supabase free tier DB is fine (app reads/writes modestly); outbound API quotas (OpenSky, adsb.lol fair-use ~1 req/s) matter more — the rate limiters already handle it.
- **`.env` is not deployed** — never commit it; all secrets go in Railway Variables.
- **Cold start**: first boot runs migrations + seeds + spawns agents (~15–30s before traffic serves).
- **Cost**: Railway usage-based (~$5/mo hobby typical for this footprint); Supabase free tier sufficient to start.
- **Rollback**: keep local DB untouched for a few days; to roll back, repoint `DATABASE_URL` — migrations are additive and idempotent.
