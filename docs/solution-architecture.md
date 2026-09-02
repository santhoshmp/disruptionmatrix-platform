# DisruptionMatrix — Solution Architecture

*Proof-of-concept build. All names, codes, routes and figures are fictional and created for demonstration purposes only.*

---

## 1. Overview

DisruptionMatrix is an external threat-intelligence platform that correlates public-source disruption events (weather, industrial action, geopolitical incidents, infrastructure failures, regulatory changes) and scores them by disruption potential. The PoC demos this against **Namma Air**, a synthetic full-service hub carrier based at Bengaluru (BLR), showing how the same external feed — when intersected with the airline's own operational data — produces an airline-specific exposure report with zero confidential data leaving the airline.

### Two-lens model

| Lens | What it shows | Who it's for |
|---|---|---|
| **Global view** (DisruptionMatrix) | Raw external intelligence, correlated and scored. Advisory only — no airline data. | DisruptionMatrix analysts, general consumers |
| **Airline view** (Namma Air) | The same feed fused with the airline's schedule, tails, crew pairings, station dependencies and escalation policy. | Airline OCC, duty managers, VP Network Control Centre |

---

## 2. System architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (single-page app)                     │
│                                                                      │
│  ┌──────────────┐  ┌───────────────────┐  ┌───────────────────────┐ │
│  │  Home page   │  │  Global layout     │  │  Airline layout       │ │
│  │  (view       │  │  (sidebar +        │  │  (N7 header +         │ │
│  │  chooser)    │  │   event list)      │  │   nav links)          │ │
│  └──────┬───────┘  └────────┬──────────┘  └──────────┬────────────┘ │
│         │                   │                        │              │
│         └───────────────────┼────────────────────────┘              │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────────┐ │
│  │                    React Router (HashRouter)                     │ │
│  │   /  ·  /board  ·  /event/:id  ·  /map  ·  /radar  ·            │ │
│  │   /airline-map  ·  /explorer                                   │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────────┐ │
│  │                      Page Components                             │ │
│  │  Home · ThreatBoard · EventDetail · WorldMap · Radar ·          │ │
│  │  AirlineMap · DataExplorer                                      │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────┐  ┌────────▼────────┐  ┌─────────────────────────┐ │
│  │  theme.js    │  │  Static JSON     │  │  Leaflet (OSM tiles)    │ │
│  │  (colours,   │  │  data modules    │  │  (client-side maps)     │ │
│  │   helpers)   │  │                  │  │                         │ │
│  └──────────────┘  └──────────────────┘  └─────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              No backend
                      All state is client-side
```

### Key architectural decisions

- **No backend** — the PoC runs entirely in the browser. All data is static JSON bundled at build time. This is by design: the real system would have a server-side ingestion/correlation engine, but the PoC demonstrates the data flow and UX.
- **HashRouter** — client-side routing via URL hash (`#/board`, `#/event/storm`). No server configuration needed; works on any static host.
- **Three layout modes** — the app switches between three distinct shell layouts based on the current route, matching the original HTML prototype designs.
- **Inline styles + CSS variables** — components use inline style objects for layout and component-specific styling, while global theming (colours, fonts) is handled via CSS custom properties in `styles.css`. This avoids a CSS-in-JS dependency and keeps the prototype lightweight.

---

## 3. Technology stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Build tool | Vite | ^5.4.8 | Dev server, bundling, HMR |
| UI framework | React | ^18.3.1 | Component rendering |
| Router | react-router-dom | ^6.26.2 | Client-side routing (HashRouter) |
| Maps | Leaflet | ^1.9.4 | Interactive world & network maps |
| Map tiles | OpenStreetMap | — | Free tile layer (no API key) |
| Typography | IBM Plex Sans + IBM Plex Mono | — | Via Google Fonts |
| Language | JavaScript (JSX) | ES2022+ | No TypeScript in the PoC |

---

## 4. Project structure

```
DisruptionMatrix/
├── app/                          # React application
│   ├── index.html                # HTML entry point (font imports, root div)
│   ├── package.json              # Dependencies & scripts
│   ├── vite.config.js            # Vite config (React plugin, port 5173)
│   ├── public/
│   │   └── hero.png              # Home page hero image
│   └── src/
│       ├── main.jsx              # App bootstrap (ReactDOM, HashRouter, CSS imports)
│       ├── App.jsx               # Layout switching, routing, header/sidebar shells
│       ├── styles.css            # CSS variables (dark/light theme), global styles
│       ├── theme.js              # Colour constants, scoring helpers, trajectory utils
│       ├── data/
│       │   ├── dm-data.json      # Global events, SOPs, escalation model, airport ops
│       │   ├── namma-data.json   # Airline threats, exposure model, flights, fleet, crew
│       │   └── geo.json          # Station coordinates, event geo-data, airport locations
│       └── pages/
│           ├── Home.jsx          # View chooser (hero + two cards)
│           ├── ThreatBoard.jsx   # Sortable/filterable threat list + escalation lanes
│           ├── EventDetail.jsx   # Multi-tab event assessment (4 tabs)
│           ├── WorldMap.jsx      # Leaflet world map with threat circles
│           ├── Radar.jsx         # Namma Air 3-column ops dashboard
│           ├── AirlineMap.jsx    # Leaflet network map with route lines
│           └── DataExplorer.jsx  # Data tables + schedule Gantt + recovery solver
│
├── data/                         # Raw data source files (pre-JSON conversion)
│   ├── dm-data.js
│   └── namma-data.js
│
├── design/                       # Original HTML prototype designs
│   ├── Home.dc.html
│   ├── DisruptionMatrix.dc.html
│   ├── Namma Air Threat Radar.dc.html
│   ├── Namma Air Data Explorer.dc.html
│   ├── Threat Map.html
│   ├── Namma Air Threat Map.html
│   ├── support.js                # DC runtime (prototype framework)
│   ├── image-slot.js             # Image placeholder component
│   ├── browser-window.jsx
│   ├── UI Flow and Design Doc.pdf
│   └── .thumbnail / .image-slots.state.json
│
├── docs/                         # Documentation
│   ├── solution-architecture.md  # This document
│   └── namma-air-synthetic-airline-design.md
│
└── uploads/                      # Image assets for design prototypes
```

---

## 5. Data model

### 5.1 Global data (`dm-data.json`)

The DisruptionMatrix external intelligence feed. All data is synthetic and represents what would come from public sources.

| Entity | Description | Key fields |
|---|---|---|
| `EVENTS[]` | Active disruption events | `id`, `ref`, `name`, `cat`, `where`, `score` (EDPS), `conf`, `traj`, `tti`, `esc` |
| `EVENTS[].factors[]` | 8 weighted scoring factors per event | `label`, `val`, `weight`, `readout`, `why` |
| `EVENTS[].domains[]` | Domain impact vector (9 domains) | `name`, `v` (0–100) |
| `EVENTS[].chain[]` | Cascading impact chain (first/second/third order) | `ord`, `title`, `detail`, `lik`, `lead` |
| `EVENTS[].evidence[]` | Source evidence trail | source, timestamp, excerpt |
| `EVENTS[].sop` | Event-type standard operating procedure | phases, actions, decision points |
| `EVENTS[].retro` | Retrospective analysis (post-event) | timeline, outcomes, lessons |
| `ESC[]` | Escalation level definitions (L1–L4) | `code`, `title`, `trigger`, `badge` |
| `OPS{}` | Airport operational impact per event | airports, movements, exposure scores |
| `DOMAINS[]` | The 9 operational domains | Flight schedule, Crew, Aircraft rotations, etc. |

### 5.2 Airline data (`namma-data.json`)

Namma Air's confidential operational data. In production, this stays inside the airline's firewall; the PoC bundles it client-side.

| Entity | Description | Key fields |
|---|---|---|
| `THREATS[]` | Airline-specific threat assessments | `id`, `name`, `code`, `edps` (external score), `namma` (airline score), `traj`, `tti` |
| `EXPOSURE{}` | Five-tier exposure intersection per threat | `tier0`–`tier4` objects (see below) |
| `FLIGHTS[]` | Flagged flights/rotations | `flt`, `route`, `type`, `tail`, `bank`, `threat` |
| `FLEET[]` | 30 aircraft | `tail`, `type`, `base`, `cat3`, `status` |
| `CREW[]` | Crew roster | `id`, `name`, `rank`, `base`, `fleet`, `status` |
| `PAIRINGS[]` | Crew duty pairings | `id`, `base`, `fleet`, `route`, `margin`, `status`, `threat` |
| `BANKS[]` | BLR four-bank hub structure | `id`, `label`, `window`, `kind`, `severity` |
| `SCHEDULE{}` | Flight schedule (dep/arr times) | `flt`, `dep`, `arr`, `dur` |
| `SNAPSHOT{}` | Operations snapshot metrics | label, value, unit, tone, trend (sparkline data) |
| `VULNERABILITIES[]` | Standing network vulnerabilities | `title`, `detail` |

### 5.3 Five-tier exposure model

This is the core intellectual property of the airline view — how a public trigger is intersected with airline data to produce exposure.

| Tier | Data | Question answered | PoC source |
|---|---|---|---|
| **Tier 0** | Flight schedule + fleet capability | How many operated flights are in the event's time/geography window? | `namma-data.json` → `FLIGHTS`, `SCHEDULE` |
| **Tier 1** | Tail assignment + rotation legs | Which aircraft rotations are displaced? Does the tail finish out of position? | `namma-data.json` → `FLEET`, `FLIGHTS` |
| **Tier 2** | Crew pairings + duty margins | Which crew pairings are within 45 min of FDP limits if the event delays arrivals? | `namma-data.json` → `PAIRINGS` |
| **Tier 3** | Passenger connections + cargo | How many connecting passengers and cargo tonnes are at risk? | `namma-data.json` → `EXPOSURE.tier3` |
| **Tier 4** | Station dependencies + escalation thresholds | Does this cross the VP escalation threshold? What's the projected cost? | `namma-data.json` → `EXPOSURE.tier4` |

### 5.4 Geographic data (`geo.json`)

| Entity | Description |
|---|---|
| `STATIONS{}` | Lat/lon for all Namma Air stations (BLR, DEL, and outstations) |
| `EVENT_GEO{}` | Lat/lon, radius, and affected airports per event ID |
| `AIRPORTS{}` | Lat/lon for global airports referenced in events |

---

## 6. Scoring model — EDPS

The **External Disruption Potential Score (EDPS)** is an 8-factor weighted model producing a 0–100 score per event.

| Factor | Weight | What it measures |
|---|---|---|
| Probability of occurrence | 0.18 | Likelihood the event materialises as forecast |
| Severity if realised | 0.18 | Magnitude of operational disruption |
| Geographic reach | 0.12 | Number of hubs/airports in the area of effect |
| Expected duration | 0.12 | How long the disruption persists |
| Time to impact | 0.14 | How soon the first operational effect is felt |
| Escalation rate | 0.10 | How quickly the score is changing |
| Source credibility | 0.10 | Number and tier of corroborating sources |
| Prediction confidence | 0.06 | Ensemble/model spread agreement |

**Score bands:**

| Range | Band | Colour | Meaning |
|---|---|---|---|
| ≥ 80 | Critical | `#F0495A` (red) | Severe disruption likely, immediate action |
| 65–79 | High | `#F5A623` (orange) | Significant disruption probable |
| 45–64 | Moderate | `#E8C34A` (yellow) | Disruption possible, monitor closely |
| < 45 | Low | `#5B92C9` (blue) | Minimal disruption expected |

---

## 7. Escalation model

Events are assigned an escalation level (L1–L4) based on the EDPS score and trajectory.

| Level | Code | Trigger | Action |
|---|---|---|---|
| L1 | Advisory | Score 30–49, stable | Log and monitor |
| L2 | Watch | Score 50–64 or escalating trajectory | Duty manager awareness |
| L3 | Elevated | Score 65–79 or rapid escalation | OCC activation, recovery planning |
| L4 | Critical | Score ≥ 80 or VP threshold crossed | VP NCC escalation, executive briefing |

### Airline-specific escalation (Namma Air policy)

- **VP escalation triggers**: ≥6 projected cancellations, OR any hub-bank threat at BLR, OR any multi-day event, OR estimated cost > ₹2.5 crore
- **Recovery priority**: 1. Long-haul departures → 2. Bank connectivity → 3. Trunk domestic OTP → 4. Point-to-point
- **Pre-cancellation doctrine**: Thin domestic point-to-point first; protect BLR–DEL/BOM trunk; never pre-cancel long-haul without VP sign-off

---

## 8. Recovery solver

The Data Explorer includes a **deterministic recovery solver** — a rule-based proposal engine that suggests recovery actions per threat type. It is advisory only; no changes are auto-applied.

### How it works

```
SOLVER_RULES[threatId] → { swapTo, delayMin, action }
```

1. For each flagged flight, look up the rule for its associated threat.
2. If a tail swap is specified, swap the assigned aircraft.
3. Apply the delay (in minutes) to the scheduled departure time.
4. Display the modified Gantt chart alongside the original schedule.

### Current rules

| Threat | Action | Tail swaps | Delay |
|---|---|---|---|
| Monsoon | Delay past squall window | N7-341 → VT-N04, N7-372 → VT-N11 | 75 min |
| Fuel depot | Reduced-uplift delay | N7-505 → VT-N24 | 25 min |
| DEL fog | Hold for visibility / CAT IIIB tail swap | N7-611 → VT-N26 | 40 min |
| Chennai ATC | ATFM delay | — | 20 min |
| Gulf airspace | Reroute — extended block time | — | 25 min |
| Cabin crew go-slow | Monitor buffer | — | 10 min |

---

## 9. Application routing & layouts

### Route map

| Route | Page component | Layout | Lens |
|---|---|---|---|
| `/` | `Home` | Home (simple header + footer) | — |
| `/board` | `ThreatBoard` | Global (sidebar + event list) | Global |
| `/event/:id` | `EventDetail` | Global (sidebar + event list) | Global |
| `/map` | `WorldMap` | Global (sidebar + event list) | Global |
| `/radar` | `Radar` | Airline (N7 header + nav) | Airline |
| `/airline-map` | `AirlineMap` | Airline (N7 header + nav) | Airline |
| `/explorer` | `DataExplorer` | Airline (N7 header + nav) | Airline |

### Layout switching logic

`App.jsx` inspects `useLocation().pathname` and selects one of three layout shells:

- **HomeLayout** — minimal header (logo + title + theme toggle), content area, footer bar
- **GlobalLayout** — 296px left sidebar (logo, nav links, scrollable active events list, source stats) + right content area with sub-header (theme + clock)
- **AirlineLayout** — full-width top header (N7 logo, "Namma Air · OCC — BLR", nav links, theme + clock) + content area below

### Page components

| Component | Key features |
|---|---|
| `Home` | Hero image, "Choose a view" heading, two large cards (DisruptionMatrix + Namma Air) with primary/secondary action buttons |
| `ThreatBoard` | Category filter pills, sort options (EDPS / TTI / trajectory), layout toggle (ranked list / escalation lanes), min-score slider |
| `EventDetail` | 4-tab view: Assessment (8-factor score composition, domain dots, cascading chain, evidence), Escalation & Response, Event-type SOP, Retrospective |
| `WorldMap` | Leaflet map with OSM tiles, category filter overlay, threat circles + score markers + airport dots, right sidebar with event list + detail + airport impact |
| `Radar` | 3-column grid: left (threat list + standing vulnerabilities), centre (exposure detail + 5-tier intersection + flagged rotations + crew pairings + bank structure), right (ops snapshot with sparklines) |
| `AirlineMap` | Leaflet map with hub markers (BLR/DEL), route polylines to affected destinations, threat + hub filter pills, right sidebar with threat detail + exposure summary + route list |
| `DataExplorer` | 7 tabs: Flight schedule, Schedule Gantt (with recovery solver), Fleet, Crew roster, Crew pairings, Bank structure, Threat feed |

---

## 10. Theming

### CSS variable system

All colours are defined as CSS custom properties on `:root` / `[data-theme]` and toggled by setting `data-theme="dark"` or `data-theme="light"` on `<html>`.

| Variable group | Examples | Purpose |
|---|---|---|
| Backgrounds | `--bg`, `--sunken`, `--panel`, `--panel2` | Page, sidebar, card backgrounds |
| Borders | `--line`, `--line2`, `--edge` | Dividers, card borders, button borders |
| Text | `--ink`, `--ink2`, `--ink3`, `--mute`, `--mute2`, `--faint` | Primary → faint text hierarchy |
| Accents | `--teal`, `--cyan` | DisruptionMatrix brand (teal), Namma Air brand (cyan) |
| Interactive | `--hover`, `--hover-border`, `--sel-bg` | Hover states, selection backgrounds |

### Theme persistence

User's theme choice is stored in `localStorage` under key `dm-app-theme` and restored on page load.

### Map tile theming

OpenStreetMap tiles are light by default. In dark mode, a CSS filter is applied to the Leaflet tile pane:

```css
[data-theme='dark'] .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.85);
}
```

---

## 11. Design prototypes → React mapping

The React app was built from six original HTML prototype files (in `design/`). The mapping:

| Prototype file | React route | React component(s) |
|---|---|---|
| `Home.dc.html` | `/` | `Home` (in `HomeLayout`) |
| `DisruptionMatrix.dc.html` | `/board`, `/event/:id` | `ThreatBoard`, `EventDetail` (in `GlobalLayout`) |
| `Threat Map.html` | `/map` | `WorldMap` (in `GlobalLayout`) |
| `Namma Air Threat Radar.dc.html` | `/radar` | `Radar` (in `AirlineLayout`) |
| `Namma Air Threat Map.html` | `/airline-map` | `AirlineMap` (in `AirlineLayout`) |
| `Namma Air Data Explorer.dc.html` | `/explorer` | `DataExplorer` (in `AirlineLayout`) |

---

## 12. Production architecture (target state)

The PoC is entirely client-side. The production system would introduce the following components:

```
┌──────────────────────────────────────────────────────────────────┐
│                     DATA INGESTION LAYER                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ Met      │  │ NOTAM    │  │ News &   │  │ Regulatory   │    │
│  │ feeds    │  │ feeds    │  │ social   │  │ feeds        │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│              ┌───────────────▼──────────────┐                    │
│              │   Ingestion & Normalisation   │                    │
│              │   (deduplicate, geocode,      │                    │
│              │    timestamp, source-tier)     │                    │
│              └───────────────┬──────────────┘                    │
│                              │                                   │
│              ┌───────────────▼──────────────┐                    │
│              │   Correlation & Scoring       │                    │
│              │   (EDPS engine, trajectory    │                    │
│              │    tracking, domain vectors)  │                    │
│              └───────────────┬──────────────┘                    │
│                              │                                   │
│              ┌───────────────▼──────────────┐                    │
│              │   Event Store (time-series)   │                    │
│              └───────────────┬──────────────┘                    │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    REST / WebSocket API
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│                     (this PoC)                                  │
│              ┌───────────────▼──────────────┐                    │
│              │   React SPA                   │                    │
│              │   (global view + airline view)│                    │
│              └──────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                    Airline-side intersection
                    (confidential data stays internal)
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                  AIRLINE SOLVER (Namma Air)                      │
│                                                                  │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │ Tier 0 │  │ Tier 1 │  │ Tier 2 │  │ Tier 3 │  │ Tier 4 │   │
│  │Schedule│  │Tails & │  │  Crew  │  │  Pax & │  │Escalat.│   │
│  │+ fleet │  │rotats. │  │pairings│  │ cargo  │  │+ cost  │   │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘   │
│                                                                  │
│  Output: airline-specific exposure report                        │
│  (trigger ID in, intersection answer out — no data leaves)       │
└─────────────────────────────────────────────────────────────────┘
```

### Key production differences

| Aspect | PoC | Production |
|---|---|---|
| Data source | Static JSON bundled at build | Live ingestion from met feeds, NOTAMs, news APIs, regulatory sources |
| Scoring | Pre-computed in JSON | Real-time EDPS engine with trajectory tracking |
| Airline data | Bundled in `namma-data.json` | Stays inside airline firewall; solver runs on-premise or in trusted enclave |
| Recovery solver | Deterministic rules (`SOLVER_RULES`) | Optimisation engine (cost-minimising, constraint-aware) |
| Maps | OSM tiles (free) | Enterprise tile provider or self-hosted |
| Auth | None | OIDC / SSO with role-based access (analyst vs airline user) |
| Persistence | `localStorage` (theme only) | Server-side user preferences, saved views, alert subscriptions |
| Notifications | None | Push notifications, email/SMS alerts on escalation threshold crossings |

---

## 13. Security & data segregation

The PoC bundles all data client-side, but the production design enforces a strict segregation:

- **DisruptionMatrix (global) data** — public-source intelligence, scored and correlated. This is the platform's product; it can be served to any authenticated consumer.
- **Airline operational data** (Tiers 1–3) — confidential. Stays inside the airline's network. The solver receives only the trigger ID and returns the intersection result (exposure counts, affected rotations, projected cost). No raw operational data crosses the boundary.
- **The intersection protocol** — DisruptionMatrix sends: `{ event_id, geo_window, time_window, severity }`. The airline solver returns: `{ flights_affected, tails_displaced, pairings_at_risk, pax_at_risk, projected_cost, escalation_level }`. The airline's schedule, crew roster, and tail assignments never leave the airline.

---

## 14. Running the application

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173` (Vite will auto-increment the port if occupied).

### Build for production

```bash
npm run build      # outputs to app/dist/
npm run preview    # serves the production build locally
```

The `dist/` folder is a static site that can be deployed to any static host (Netlify, Vercel, S3 + CloudFront, Nginx, etc.).

---

## 15. Demo event set

The PoC includes 7 synthetic global events and 6 airline-specific threat intersections:

| Global event | Category | EDPS | Namma Air score |
|---|---|---|---|
| North Sea winter storm "Ingrid" | Weather | 87 | — |
| Bay of Bengal monsoon depression | Weather | 84 | 87 |
| DEL winter fog — CAT III demand | Weather | 76 | 69 |
| Chennai ACC flow restriction | ATC / Airspace | 71 | 58 |
| BLR fuel depot supply disruption | Infrastructure | 68 | 74 |
| Gulf airspace overflight restriction | Geopolitical | 62 | 55 |
| French ATC strike ballot | Industrial action | 59 | — |
| LHR ground-handler strike ballot | Industrial action | 56 | — |
| UK night-flight quota consultation | Regulatory | 52 | — |
| DEL cabin crew go-slow notice | Industrial action | 45 | 41 |

---

*This document describes a proof-of-concept system. All data is synthetic. The architecture is designed to demonstrate the data flow and user experience of a threat-intelligence platform fused with airline operational data.*
