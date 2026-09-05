# DisruptionMatrix — Technical Design

*Proof-of-concept build. All names, codes, routes and figures are fictional and created for demonstration purposes only.*

This document describes the system architecture, technology stack, component design, routing, and production target state for the DisruptionMatrix platform.

---

## 1. Overview

DisruptionMatrix is an external threat-intelligence platform that correlates public-source disruption events (weather, industrial action, geopolitical incidents, infrastructure failures, regulatory changes) and scores them by disruption potential. The PoC demos this against three synthetic airlines — **Namma Air**, **EuroVista Airways**, and **IndiConnect Airways** — showing how the same external feed, when intersected with each airline's own operational data, produces an airline-specific exposure report with zero confidential data leaving the airline.

### Two-lens model

| Lens | What it shows | Who it's for |
|---|---|---|
| **Global view** (DisruptionMatrix) | Raw external intelligence, correlated and scored. Advisory only — no airline data. | DisruptionMatrix analysts, general consumers |
| **Airline view** (per airline) | The same feed fused with the airline's schedule, tails, crew pairings, station dependencies and escalation policy. | Airline OCC, duty managers, VP Network Control Centre |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (single-page app)                     │
│                                                                      │
│  ┌──────────────┐  ┌───────────────────┐  ┌───────────────────────┐ │
│  │  Home page   │  │  Global layout     │  │  Airline layout       │ │
│  │  (airline    │  │  (sidebar +        │  │  (airline header +    │ │
│  │  selector)   │  │   event list +     │  │   nav links +         │ │
│  │              │  │   search bar)      │  │   search bar)         │ │
│  └──────┬───────┘  └────────┬──────────┘  └──────────┬────────────┘ │
│         │                   │                        │              │
│         └───────────────────┼────────────────────────┘              │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────────┐ │
│  │                    React Router (BrowserRouter)                  │ │
│  │   /  ·  /board  ·  /event/:id  ·  /map  ·  /chat                │ │
│  │   /radar  ·  /airline-map  ·  /explorer                         │ │
│  │   /eva/radar  ·  /eva/airline-map  ·  /eva/explorer             │ │
│  │   /ica/radar  ·  /ica/airline-map  ·  /ica/explorer             │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                       │
│  ┌──────────────────────────▼──────────────────────────────────────┐ │
│  │                      Page Components                             │ │
│  │  Home · ThreatBoard · EventDetail · WorldMap · Chat             │ │
│  │  Radar · AirlineMap · DataExplorer                              │ │
│  │  GlobalSearch (component)                                        │ │
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
- **BrowserRouter** — client-side routing via react-router-dom. SPA rewrites handled by `vercel.json` for deployment.
- **Three layout modes** — the app switches between three distinct shell layouts based on the current route.
- **Inline styles + CSS variables** — components use inline style objects for layout and component-specific styling, while global theming (colours, fonts) is handled via CSS custom properties in `styles.css`. This avoids a CSS-in-JS dependency and keeps the prototype lightweight.
- **Airline registry pattern** — `airlines.js` defines a configuration object per airline, enabling easy addition of new carriers without code changes.

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Build tool | Vite | ^5.4.8 | Dev server, bundling, HMR |
| UI framework | React | ^18.3.1 | Component rendering |
| Router | react-router-dom | ^6.26.2 | Client-side routing |
| Maps | Leaflet | ^1.9.4 | Interactive world & network maps |
| Map tiles | OpenStreetMap | — | Free tile layer (no API key) |
| Typography | IBM Plex Sans + IBM Plex Mono | — | Via Google Fonts |
| Language | JavaScript (JSX) | ES2022+ | No TypeScript in the PoC |
| Deployment | Vercel | — | Static site hosting with auto-deploy |

---

## 4. Project Structure

```
DisruptionMatrix/
├── README.md                   # Project documentation
├── .gitignore                  # Git ignore rules
├── vercel.json                 # Vercel deployment config (SPA rewrites)
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
│   │   ├── namma-data.json     # Namma Air operational data
│   │   ├── eurovista-data.json # EuroVista Airways operational data
│   │   ├── indiconnect-data.json # IndiConnect Airways operational data
│   │   └── geo.json            # Airport coordinates, stations, event geo data
│   ├── pages/
│   │   ├── Login.jsx           # Split-screen authentication
│   │   ├── Home.jsx            # Airline selector dashboard
│   │   ├── ThreatBoard.jsx     # Global ranked threat board
│   │   ├── EventDetail.jsx     # Event deep-dive with tabs
│   │   ├── WorldMap.jsx        # Leaflet world threat map
│   │   ├── Chat.jsx            # AI Assistant chat interface
│   │   ├── Radar.jsx           # Airline five-tier exposure radar
│   │   ├── AirlineMap.jsx      # Airline network map
│   │   └── DataExplorer.jsx    # Schedule Gantt + recovery solver
│   ├── components/
│   │   └── GlobalSearch.jsx    # Global search across all data objects
│   ├── airlines.js             # Airline configuration registry
│   ├── auth.js                 # Session-based authentication
│   ├── theme.js                # Colour constants, scoring helpers
│   ├── styles.css              # CSS variables (dark/light theme)
│   ├── App.jsx                 # Routing, layouts, auth gating
│   └── main.jsx                # Entry point
├── data/                       # Legacy JS data files (pre-JSON)
├── docs/                       # Documentation
│   ├── AirlineProfiles.md      # Fictional airline profiles
│   ├── PoCScenario.md          # PoC disruption scenarios
│   ├── DataDesign.md           # Data model & schemas
│   └── TechnicalDesign.md      # This document
└── design/                     # Original HTML prototype designs
```

---

## 5. Application Routing & Layouts

### Route Map

| Route | Page Component | Layout | Lens |
|---|---|---|---|
| `/login` | `Login` | None (standalone) | — |
| `/` | `Home` | HomeLayout | — |
| `/board` | `ThreatBoard` | GlobalLayout | Global |
| `/event/:id` | `EventDetail` | GlobalLayout | Global |
| `/map` | `WorldMap` | GlobalLayout | Global |
| `/chat` | `Chat` | GlobalLayout | Global |
| `/radar` | `Radar` | AirlineLayout (Namma Air) | Airline |
| `/airline-map` | `AirlineMap` | AirlineLayout (Namma Air) | Airline |
| `/explorer` | `DataExplorer` | AirlineLayout (Namma Air) | Airline |
| `/eva/radar` | `Radar` | AirlineLayout (EuroVista) | Airline |
| `/eva/airline-map` | `AirlineMap` | AirlineLayout (EuroVista) | Airline |
| `/eva/explorer` | `DataExplorer` | AirlineLayout (EuroVista) | Airline |
| `/ica/radar` | `Radar` | AirlineLayout (IndiConnect) | Airline |
| `/ica/airline-map` | `AirlineMap` | AirlineLayout (IndiConnect) | Airline |
| `/ica/explorer` | `DataExplorer` | AirlineLayout (IndiConnect) | Airline |

### Layout Switching Logic

`App.jsx` inspects `useLocation().pathname` and selects one of three layout shells:

- **HomeLayout** — minimal header (logo + title + theme toggle + logout), content area, footer bar. No search bar.
- **GlobalLayout** — 320px left sidebar (logo, nav links, scrollable active events list, source stats) + right content area with sub-header (nav buttons + global search + theme + clock + logout).
- **AirlineLayout** — full-width top header (airline logo, name, nav links, global search, theme + clock + logout) + content area below.

### Authentication Gating

All routes except `/login` require authentication. The `App` component checks `isAuthenticated()` on every route change and redirects to `/login` if not authenticated. Session is stored in `sessionStorage`.

---

## 6. Page Components

### 6.1 Login (`Login.jsx`)

Split-screen layout:
- **Left side**: Aircraft hero image with gradient overlay, tagline, and feature list with icons
- **Right side**: Login form with input icons, error display, styled submit button

Authentication uses `sessionStorage` with credentials from environment variables (`VITE_AUTH_USER`, `VITE_AUTH_PASS`).

### 6.2 Home (`Home.jsx`)

Airline selector dashboard:
- Hero image banner
- **Platform card** (full width) — DisruptionMatrix with "Open threat board →" button
- **Airline views** (3-column grid) — Namma Air, EuroVista, IndiConnect cards with "Open dashboard →" links

### 6.3 ThreatBoard (`ThreatBoard.jsx`)

Global ranked threat board:
- Category filter pills (Weather, ATC / Airspace, Industrial action, Geopolitical, Infrastructure, Regulatory)
- Sort options (EDPS / TTI / trajectory)
- Layout toggle (ranked list / escalation lanes)
- Min-score slider

### 6.4 EventDetail (`EventDetail.jsx`)

Multi-tab event assessment:
- **Assessment tab** — 8-factor score composition, domain impact dots, cascading chain, evidence trail
- **Escalation & Response tab** — escalation level, process phases, decision points
- **SOP tab** — event-type standard operating procedure
- **Retrospective tab** — historical context and lessons learned

### 6.5 WorldMap (`WorldMap.jsx`)

Leaflet world threat map:
- OSM tiles with dark-mode filter
- Category filter overlay
- Threat circles with score markers
- Airport dots
- Right sidebar with event list + detail + airport impact

### 6.6 Chat (`Chat.jsx`)

AI Assistant chat interface:
- 8 sample questions displayed on empty state (clickable)
- Mock response engine matching queries against 17 active threats
- Threat cards in responses with score, trajectory, TTI — links to event detail
- Typing indicator with animated dots
- Input bar with chat icon and send button

### 6.7 Radar (`Radar.jsx`)

Airline five-tier exposure radar:
- 3-column grid: left (threat list + standing vulnerabilities), centre (exposure detail + 5-tier intersection + flagged rotations + crew pairings + bank structure), right (ops snapshot with sparklines)

### 6.8 AirlineMap (`AirlineMap.jsx`)

Leaflet airline network map:
- Hub markers with airline accent color
- Route polylines to affected destinations
- Threat + hub filter pills
- Right sidebar with threat detail + exposure summary + route list

### 6.9 DataExplorer (`DataExplorer.jsx`)

Schedule intervention workbench with 7 tabs:
- Flight schedule, Schedule Gantt (with recovery solver), Fleet, Crew roster, Crew pairings, Bank structure, Threat feed

---

## 7. Shared Components

### 7.1 GlobalSearch (`components/GlobalSearch.jsx`)

Search bar in the top nav of GlobalLayout and AirlineLayout (not HomeLayout). Searches across:
- Threats (17 events) → `/event/:id`
- Airports (from `geo.json`) → `/map`
- Stations (from `geo.json`) → `/map`
- Airlines (3 carriers) → airline radar
- Flights (from each airline's data) → airline data explorer
- Aircraft (fleet from each airline) → airline data explorer

Features:
- Live results dropdown with type icons and color-coded type badges
- Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)
- Results ranked by relevance score
- Click any result to navigate to that screen

### 7.2 Theme System

- **ThemeBtn** — Toggle button for dark/light mode
- **Clock** — UTC clock with live update
- **MatrixLogo** — DisruptionMatrix brand logo (2×2 grid with teal/amber cells)
- **LogoutBtn** — Session logout button with icon

---

## 8. Recovery Solver

The Data Explorer includes a **deterministic recovery solver** — a rule-based proposal engine that suggests recovery actions per threat type. It is advisory only; no changes are auto-applied.

### How it works

```
SOLVER_RULES[threatId] → { swapTo, delayMin, action }
```

1. For each flagged flight, look up the rule for its associated threat.
2. If a tail swap is specified, swap the assigned aircraft.
3. Apply the delay (in minutes) to the scheduled departure time.
4. Display the modified Gantt chart alongside the original schedule.

### Current Rules

| Threat | Action | Tail swaps | Delay |
|---|---|---|---|
| Monsoon | Delay past squall window | N7-341 → VT-N04, N7-372 → VT-N11 | 75 min |
| Fuel depot | Reduced-uplift delay | N7-505 → VT-N24 | 25 min |
| DEL fog | Hold for visibility / CAT IIIB tail swap | N7-611 → VT-N26 | 40 min |
| Chennai ATC | ATFM delay | — | 20 min |
| Gulf airspace | Reroute — extended block time | — | 25 min |
| Cabin crew go-slow | Monitor buffer | — | 10 min |

---

## 9. Theming

### CSS Variable System

All colours are defined as CSS custom properties on `:root` / `[data-theme]` and toggled by setting `data-theme="dark"` or `data-theme="light"` on `<html>`.

| Variable group | Examples | Purpose |
|---|---|---|
| Backgrounds | `--bg`, `--sunken`, `--panel`, `--panel2` | Page, sidebar, card backgrounds |
| Borders | `--line`, `--line2`, `--edge` | Dividers, card borders, button borders |
| Text | `--ink`, `--ink2`, `--ink3`, `--mute`, `--mute2`, `--faint` | Primary → faint text hierarchy |
| Accents | `--teal`, `--cyan` | DisruptionMatrix brand (teal), Namma Air brand (cyan) |
| Interactive | `--hover`, `--hover-border`, `--sel-bg` | Hover states, selection backgrounds |

### Theme Persistence

User's theme choice is stored in `localStorage` under key `dm-app-theme` and restored on page load.

### Map Tile Theming

OpenStreetMap tiles are light by default. In dark mode, a CSS filter is applied to the Leaflet tile pane:

```css
[data-theme='dark'] .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.85);
}
```

---

## 10. Authentication

### PoC Implementation

- Credentials stored in environment variables (`VITE_AUTH_USER`, `VITE_AUTH_PASS`)
- Session stored in `sessionStorage` (cleared on browser close)
- `login(user, pass)` — validates and sets session
- `logout()` — clears session
- `isAuthenticated()` — checks session validity
- Auth gating in `App.jsx` — redirects to `/login` if not authenticated

### Production Target

OIDC / SSO with role-based access (analyst vs airline user). See Section 12.

---

## 11. Design Prototypes → React Mapping

The React app was built from six original HTML prototype files (in `design/`). The mapping:

| Prototype file | React route | React component(s) |
|---|---|---|
| `Home.dc.html` | `/` | `Home` (in `HomeLayout`) |
| `DisruptionMatrix.dc.html` | `/board`, `/event/:id` | `ThreatBoard`, `EventDetail` (in `GlobalLayout`) |
| `Threat Map.html` | `/map` | `WorldMap` (in `GlobalLayout`) |
| `Namma Air Threat Radar.dc.html` | `/radar` | `Radar` (in `AirlineLayout`) |
| `Namma Air Threat Map.html` | `/airline-map` | `AirlineMap` (in `AirlineLayout`) |
| `Namma Air Data Explorer.dc.html` | `/explorer` | `DataExplorer` (in `AirlineLayout`) |

New components not in original prototypes: `Login.jsx`, `Chat.jsx`, `GlobalSearch.jsx`.

---

## 12. Production Architecture (Target State)

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
│                  AIRLINE SOLVER (per airline)                    │
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

### Key Production Differences

| Aspect | PoC | Production |
|---|---|---|
| Data source | Static JSON bundled at build | Live ingestion from met feeds, NOTAMs, news APIs, regulatory sources |
| Scoring | Pre-computed in JSON | Real-time EDPS engine with trajectory tracking |
| Airline data | Bundled in JSON files | Stays inside airline firewall; solver runs on-premise or in trusted enclave |
| Recovery solver | Deterministic rules (`SOLVER_RULES`) | Optimisation engine (cost-minimising, constraint-aware) |
| Maps | OSM tiles (free) | Enterprise tile provider or self-hosted |
| Auth | sessionStorage with env vars | OIDC / SSO with role-based access (analyst vs airline user) |
| Persistence | `localStorage` (theme only) | Server-side user preferences, saved views, alert subscriptions |
| Notifications | None | Push notifications, email/SMS alerts on escalation threshold crossings |
| AI Assistant | Mock keyword matching | LLM-powered natural language query with real-time data access |
| Search | Client-side keyword search | Server-side full-text search with indexing |

---

## 13. Security & Data Segregation

The PoC bundles all data client-side, but the production design enforces a strict segregation:

- **DisruptionMatrix (global) data** — public-source intelligence, scored and correlated. This is the platform's product; it can be served to any authenticated consumer.
- **Airline operational data** (Tiers 1–3) — confidential. Stays inside the airline's network. The solver receives only the trigger ID and returns the intersection result (exposure counts, affected rotations, projected cost). No raw operational data crosses the boundary.
- **The intersection protocol** — DisruptionMatrix sends: `{ event_id, geo_window, time_window, severity }`. The airline solver returns: `{ flights_affected, tails_displaced, pairings_at_risk, pax_at_risk, projected_cost, escalation_level }`. The airline's schedule, crew roster, and tail assignments never leave the airline.

---

## 14. Deployment

### Vercel (current)

The app is deployed via Vercel with automatic deploys on push to `main`.

```json
// vercel.json
{
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Environment variables configured in Vercel dashboard:
- `VITE_AUTH_USER`
- `VITE_AUTH_PASS`

### Build

```bash
npm install
npm run build      # outputs to dist/
npm run preview    # serves the production build locally
```

The `dist/` folder is a static site that can be deployed to any static host (Vercel, Netlify, S3 + CloudFront, Nginx, etc.).

---

## 15. Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (Vite will auto-increment the port if occupied).

### Environment Variables

```bash
cp .env.example .env
```

```
VITE_AUTH_USER=opsadmin
VITE_AUTH_PASS=disrupt2026
```

---

*This document describes a proof-of-concept system. All data is synthetic. The architecture is designed to demonstrate the data flow and user experience of a threat-intelligence platform fused with airline operational data.*
