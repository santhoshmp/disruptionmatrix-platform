# DisruptionMatrix

### Threat Intelligence Platform for Airline Operations

DisruptionMatrix is a proof-of-concept platform that fuses external threat intelligence with airline-specific exposure models, giving operations teams a single pane of glass to anticipate, assess, and respond to disruptions before they cascade.

> **Advises, does not decide.** All data is synthetic. All airline names, codes, routes, and figures are fictional.

---

## What It Does

DisruptionMatrix monitors global disruption sources — weather, ATC/airspace, industrial action, geopolitical incidents, infrastructure failures, and regulatory changes — and correlates them with each airline's network, fleet, crew, and schedule. The result is a ranked, scored view of threats tailored to each carrier's exposure profile.

### Core Capabilities

- **Global Threat Board** — A ranked list of active threats scored by the External Disruption Potential Score (EDPS), with trajectory tracking (Escalating / Stable / Improving), time-to-impact, and escalation level indicators. Filter by category, sort by score or urgency, and switch between ranked list and escalation lane layouts.
- **Event Deep-Dive** — Each threat opens to a full assessment page with:
  - **8-factor scoring model** — Probability, severity, geographic reach, expected duration, time to impact, escalation rate, source credibility, and prediction confidence, each weighted and explained.
  - **Domain impact map** — Visual indicators showing which operational domains are affected (airport ops, flight schedule, aircraft rotations, crew, passengers, cargo, catering, maintenance, regulatory).
  - **Causal chain** — First, second, and third-order effects with likelihood and lead time.
  - **Evidence trail** — Source-corroborated intelligence with tier ratings and roles.
  - **Published operational exposure** — Affected airports and impacted airlines with exposure levels.
  - **SOP linkage** — Standard operating procedure references keyed by threat category.
  - **Retrospective notes** — Historical context and lessons learned.
- **World Threat Map** — Interactive Leaflet map showing all active threats geolocated with affected airports, radius of influence, and category filtering.
- **Airline-Specific Threat Radar** — A five-tier exposure model that maps each global threat to the airline's own operations, showing exposure scores, impacted flights, fleet availability, crew duty implications, and bank structure disruptions.
- **Airline Network Map** — Interactive map of the airline's route network with flagged rotations, hub connectivity, and threat-overlay visualization.
- **Data Explorer with Recovery Solver** — A schedule-intervention workbench featuring:
  - Flight tables with threat-linked exposure indicators.
  - Schedule Gantt chart showing proposed changes.
  - **Deterministic recovery solver** — Rule-based engine that proposes delay, cancel, reroute, or swap actions for impacted flights.
  - Passenger impact calculator — Delayed passengers, misconnection risk, and total disruption cost estimates.
  - Fleet and crew availability panels.

### Multi-Airline Support

The platform supports multiple airlines, each with their own threat exposure data, fleet, crew, pairings, and bank structures:

| Airline | Code | Hub | Secondary Hub | Fleet | Focus |
|---|---|---|---|---|---|
| **Namma Air** | N7 | Bengaluru (BLR) | Delhi (DEL) | A320neo, A350 | Indian domestic + Gulf |
| **EuroVista Airways** | EV | Vienna (VIE) | Munich (MUC) | E195, A320neo, A321neo | European regional + Middle East |
| **IndiConnect Airways** | IC | Delhi (DEL) | Mumbai (BOM) | A320neo, A321neo, ATR 72 | Indian domestic + regional |

Each airline has its own route prefix (`/radar`, `/eva/radar`, `/ica/radar`), accent color, and tailored threat exposure data. The global view shows the **union of all airline threats** — 17 events consolidated from the three carriers.

### Authentication

Basic session-based authentication with a split-screen login page. Credentials are configured via environment variables.

---

## Views & Routes

| Route | View | Lens |
|---|---|---|
| `/login` | Split-screen login (aircraft hero + credential form) | — |
| `/` | Home — airline selector dashboard | — |
| `/board` | Active threat board (ranked list + escalation lanes) | Global |
| `/event/:id` | Event detail — assessment, process, SOP, retrospective | Global |
| `/map` | World threat map (Leaflet) | Global |
| `/radar` | Namma Air threat radar — five-tier exposure model | Airline |
| `/airline-map` | Namma Air network map with flagged rotations | Airline |
| `/explorer` | Data explorer — tables + schedule Gantt + recovery solver | Airline |
| `/eva/radar` | EuroVista threat radar | Airline |
| `/eva/airline-map` | EuroVista network map | Airline |
| `/eva/explorer` | EuroVista data explorer | Airline |
| `/ica/radar` | IndiConnect threat radar | Airline |
| `/ica/airline-map` | IndiConnect network map | Airline |
| `/ica/explorer` | IndiConnect data explorer | Airline |

---

## Scoring Model

### External Disruption Potential Score (EDPS)

Each threat is scored 0–100 based on 8 weighted factors:

| Factor | Weight | Description |
|---|---|---|
| Probability of occurrence | 18% | Likelihood the event materializes as forecast |
| Severity if realised | 18% | Impact magnitude based on historical comparables |
| Geographic reach | 12% | Number of airports / airspace zones affected |
| Expected duration | 12% | Forecast window plus recovery time |
| Time to impact | 14% | Urgency — when first operational effect is felt |
| Escalation rate | 10% | Trajectory from recent score movement |
| Source credibility | 10% | Tier 1–3 rating of intelligence sources |
| Prediction confidence | 6% | Agreement across sources and forecast spread |

Scores map to severity bands: **Critical** (80+), **High** (65–79), **Moderate** (45–64), **Low** (<45).

### Airline-Specific Exposure Scores

Each airline calculates its own exposure score per threat (e.g., `namma`, `eva`, `ica` fields), reflecting fleet capability, route overlap, bank sensitivity, and crew positioning.

---

## Architecture

```
DisruptionMatrix/
├── README.md                   # This file
├── .gitignore                  # Git ignore rules
├── vercel.json                 # Vercel deployment config
├── index.html                  # Vite entry HTML
├── vite.config.js              # Vite configuration
├── package.json                # Dependencies & scripts
├── package-lock.json           # Lockfile
├── .env.example                # Environment variable template
├── public/
│   └── hero.png                # Login page hero image
├── src/
│   ├── data/
│   │   ├── dm-data.json        # Global events, OPS, SOPs, escalation model
│   │   ├── namma-data.json     # Namma Air threats, exposure, flights, fleet, crew
│   │   ├── eurovista-data.json # EuroVista Airways data
│   │   ├── indiconnect-data.json # IndiConnect Airways data
│   │   └── geo.json            # Airport coordinates, stations, event geo data
│   ├── pages/
│   │   ├── Login.jsx           # Split-screen authentication
│   │   ├── Home.jsx            # Airline selector dashboard
│   │   ├── ThreatBoard.jsx     # Global ranked threat board
│   │   ├── EventDetail.jsx     # Event deep-dive with tabs
│   │   ├── WorldMap.jsx        # Leaflet world threat map
│   │   ├── Radar.jsx           # Airline five-tier exposure radar
│   │   ├── AirlineMap.jsx      # Airline network map
│   │   └── DataExplorer.jsx    # Schedule Gantt + recovery solver
│   ├── airlines.js             # Airline configuration registry
│   ├── auth.js                 # Session-based authentication
│   ├── theme.js                # Color system, score/severity helpers
│   ├── styles.css              # CSS variables for dark/light themes
│   ├── App.jsx                 # Routing, layouts, auth gating
│   └── main.jsx                # Entry point
├── data/                       # Legacy JS data files (pre-JSON)
├── docs/                       # Design docs & airline profiles
└── design/                     # Original HTML mockups
```

### Technology Stack

- **Vite + React 18** — Fast dev server, modern build tooling
- **react-router-dom 6** — Client-side routing with layout composition
- **Leaflet 1.9** — Interactive maps for world threat map and airline network views
- **CSS Variables** — Dark/light theme system with persistent preference
- **Static JSON data** — All data is client-side; designed to be swapped for an API

### Design Principles

- **Threat-first navigation** — The sidebar in the global view lists active threats as the primary navigation element, not menus.
- **Score-driven UI** — Color coding (red/amber/yellow/blue) follows severity bands consistently across all views.
- **Monospace data layer** — Operational data uses IBM Plex Mono for scanability.
- **Minimal chrome** — Dense information display with no wasted screen real estate.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Environment Variables

Copy the example file and set credentials:

```bash
cp .env.example .env
```

```
VITE_AUTH_USER=opsadmin
VITE_AUTH_PASS=disrupt2026
```

### Run

```bash
npm run dev
```

Open http://localhost:5173

### Build

```bash
npm run build
npm run preview
```

---

## Data Model

### Global Data (`dm-data.json`)

- **EVENTS** — 17 active threats with full assessment metadata (factors, domains, causal chain, evidence, SOP keys)
- **OPS** — Per-threat operational exposure: affected airports and impacted airlines
- **ESC** — Escalation level definitions (L1–L4)
- **PHASES** — Response process phases
- **SOPS** — Standard operating procedures by category
- **RETRO** — Retrospective notes

### Airline Data (`namma-data.json`, `eurovista-data.json`, `indiconnect-data.json`)

- **THREATS** — Airline-specific threat entries with exposure scores (EDPS + ICA)
- **EXPOSURE** — Five-tier exposure model per threat
- **FLIGHTS** — Flight schedule with threat linkage, passenger counts, connection data
- **FLEET** — Aircraft with status, capability flags (e.g., CAT IIIB)
- **CREW** — Crew duty status and positioning
- **PAIRINGS** — Crew-trip assignments
- **BANKS** — Hub bank structure with sensitivity ratings
- **SCHEDULE** — Full schedule reference
- **SNAPSHOT** — Operational snapshot timestamp

---

## Threat Categories

| Category | Code | SOP Key | Examples |
|---|---|---|---|
| Weather | WX | storm | Fog, monsoon, thunderstorms, convective activity |
| ATC / Airspace | ATC | atc | Sector capacity reduction, airspace congestion, flow control |
| Industrial action | — | ground | Strikes, walkouts, work stoppages |
| Geopolitical | — | airspace | Airspace closures, sanctions, conflict zones |
| Infrastructure | — | runway | Runway closures, equipment faults, airport access issues |
| Regulatory | — | regulatory | Slot restrictions, new mandates, compliance deadlines |

---

## Disclaimer

This is a **proof-of-concept prototype** using entirely synthetic data. All airline names, ICAO/IATA codes, flight numbers, routes, schedules, fleet compositions, and threat scenarios are fictional and for demonstration purposes only. The platform is designed to be swapped for real data sources and a live API backend.

---

## License

Proprietary — proof-of-concept build.
