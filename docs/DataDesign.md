# DisruptionMatrix — Data Design

*Proof-of-concept data model. All data is synthetic and fictional.*

This document describes the data model, entity structures, JSON schemas, and entity relationships used in the DisruptionMatrix proof-of-concept.

---

## 1. Data Architecture Overview

The PoC uses a **static JSON data layer** — all data is bundled at build time and served client-side. The data is organised into three categories:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYERS                                    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Global Data  │  │ Airline Data │  │ Geographic Data      │   │
│  │ (dm-data.json)│  │ (per airline)│  │ (geo.json)           │   │
│  │              │  │              │  │                      │   │
│  │ EVENTS, OPS, │  │ THREATS,     │  │ STATIONS, AIRPORTS,  │   │
│  │ ESC, PHASES, │  │ EXPOSURE,    │  │ EVENT_GEO            │   │
│  │ SOPS, RETRO  │  │ FLIGHTS,     │  │                      │   │
│  │              │  │ FLEET, CREW, │  │                      │   │
│  │              │  │ PAIRINGS,    │  │                      │   │
│  │              │  │ BANKS, etc.  │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                   │
│  Public-source          Confidential           Reference data    │
│  intelligence           (stays inside          (coordinates,     │
│  (platform product)     airline firewall       airport codes)    │
│                         in production)                           │
└─────────────────────────────────────────────────────────────────┘
```

### Data Files

| File | Scope | Description |
|---|---|---|
| `src/data/dm-data.json` | Global | External intelligence events, operational exposure, SOPs, escalation model |
| `src/data/namma-data.json` | Namma Air | Airline-specific threats, exposure, flights, fleet, crew, pairings, banks |
| `src/data/eurovista-data.json` | EuroVista | EuroVista Airways operational data |
| `src/data/indiconnect-data.json` | IndiConnect | IndiConnect Airways operational data |
| `src/data/geo.json` | Geographic | Airport coordinates, station info, event geo-locations |

---

## 2. Global Data Model (`dm-data.json`)

### 2.1 EVENTS Array

The core entity — each event represents an active disruption threat.

```json
{
  "id": "monsoon",
  "ref": "DM-2026-0410",
  "name": "Bay of Bengal Monsoon Depression",
  "cat": "Weather",
  "where": "Bay of Bengal → South/East India",
  "detected": "11 FEB 06:00Z",
  "score": 84,
  "conf": 4,
  "traj": "Escalating",
  "tti": "10h",
  "esc": 4,
  "ttiMin": 600,
  "summary": "Deepening low-pressure system...",
  "factors": [...],
  "domains": [...],
  "chain": [...],
  "evidence": [...],
  "sop": {...},
  "retro": {...},
  "namma": 87,
  "eva": 82,
  "ica": 79
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique event identifier (slug) |
| `ref` | string | Formal reference number (DM-YYYY-NNNN) |
| `name` | string | Human-readable event name |
| `cat` | string | Category: Weather, ATC / Airspace, Industrial action, Geopolitical, Infrastructure, Regulatory |
| `where` | string | Geographic description |
| `detected` | string | Detection timestamp |
| `score` | number | EDPS score (0–100) |
| `conf` | number | Confidence level (1–5) |
| `traj` | string | Trajectory: "Escalating", "Stable", "Improving" |
| `tti` | string | Time to impact (human-readable) |
| `esc` | number | Escalation level (1–4) |
| `ttiMin` | number | Time to impact in minutes |
| `summary` | string | Plain-language summary |
| `namma` | number | Namma Air exposure score (optional) |
| `eva` | number | EuroVista exposure score (optional) |
| `ica` | number | IndiConnect exposure score (optional) |

### 2.2 EVENTS[].factors Array

The 8-factor EDPS scoring breakdown per event.

```json
{
  "label": "Probability of occurrence",
  "val": 89,
  "weight": 0.18,
  "readout": "89/100",
  "why": "Assessed from source corroboration and forecast confidence."
}
```

| Factor | Weight | Description |
|---|---|---|
| Probability of occurrence | 0.18 | Likelihood the event materialises as forecast |
| Severity if realised | 0.18 | Magnitude of operational disruption |
| Geographic reach | 0.12 | Number of hubs/airports in the area of effect |
| Expected duration | 0.12 | How long the disruption persists |
| Time to impact | 0.14 | How soon the first operational effect is felt |
| Escalation rate | 0.10 | How quickly the score is changing |
| Source credibility | 0.10 | Number and tier of corroborating sources |
| Prediction confidence | 0.06 | Ensemble/model spread agreement |

### 2.3 EVENTS[].domains Array

Domain impact vector — 9 operational domains scored 0–100 per event.

```json
{
  "name": "Flight schedule",
  "v": 82
}
```

| Domain | Description |
|---|---|
| Flight schedule | Impact on scheduled departures/arrivals |
| Crew | Crew duty, legality, positioning |
| Aircraft rotations | Tail displacement, out-of-position aircraft |
| Airport operations | Airport capacity, ground handling |
| Passengers | Misconnections, delays, cancellations |
| Cargo | Cargo commitments, cool-chain, SLA risk |
| Catering | Catering supply, local supplier issues |
| Maintenance | Maintenance scheduling, AOG risk |
| Regulatory | Compliance, reporting requirements |

### 2.4 EVENTS[].chain Array

Cascading impact chain — first, second, and third-order effects.

```json
{
  "ord": 1,
  "title": "Arrival rate reduction at BLR",
  "detail": "Wind shear and heavy rain reduce arrival rate from 24/hr to 12/hr",
  "lik": "High",
  "lead": "0–2h"
}
```

### 2.5 EVENTS[].evidence Array

Source evidence trail with tier ratings.

```json
{
  "source": "IMD Cyclone Warning Bulletin",
  "tier": 1,
  "role": "Primary meteorological source",
  "timestamp": "11 FEB 03:30Z",
  "excerpt": "Deep depression over west-central Bay of Bengal..."
}
```

### 2.6 ESC Array — Escalation Level Definitions

```json
{
  "code": "L4",
  "title": "Critical",
  "trigger": "Score ≥ 80 or VP threshold crossed",
  "badge": "red"
}
```

| Level | Code | Trigger | Action |
|---|---|---|---|
| L1 | Advisory | Score 30–49, stable | Log and monitor |
| L2 | Watch | Score 50–64 or escalating trajectory | Duty manager awareness |
| L3 | Elevated | Score 65–79 or rapid escalation | OCC activation, recovery planning |
| L4 | Critical | Score ≥ 80 or VP threshold crossed | VP NCC escalation, executive briefing |

### 2.7 OPS Object — Operational Exposure Per Event

```json
{
  "basis": "Airline exposure data cross-referenced with published schedules.",
  "airports": [
    {
      "iata": "BLR",
      "name": "Bengaluru",
      "role": "Affected",
      "movements": 200,
      "window": "10h",
      "exposure": 84,
      "note": "..."
    }
  ],
  "airlines": [
    {
      "name": "Namma Air",
      "code": "N7",
      "hub": "BLR",
      "daily": 180,
      "netShare": 50,
      "airports": "BLR · MAA",
      "exposure": "Critical",
      "note": "Direct exposure through BLR operations."
    }
  ]
}
```

### 2.8 SOPS Object — Standard Operating Procedures

Keyed by threat category. Contains phases, actions, and decision points.

### 2.9 RETRO Object — Retrospective Notes

Historical context and lessons learned, keyed by event ID.

---

## 3. Airline Data Model

Each airline has its own JSON file with the same structure. The airline is identified by the `scoreField` in `airlines.js` (e.g., `namma`, `eva`, `ica`).

### 3.1 Entity Overview

| Entity | Type | Description |
|---|---|---|
| `THREATS[]` | array | Airline-specific threat assessments |
| `EXPOSURE{}` | object | Five-tier exposure intersection per threat |
| `FLIGHTS[]` | array | Flight schedule with threat linkage |
| `FLEET[]` | array | Aircraft with status and capability flags |
| `CREW[]` | array | Crew roster with duty status |
| `PAIRINGS[]` | array | Crew duty pairings with margin and threat linkage |
| `BANKS[]` | array | Hub bank structure with sensitivity ratings |
| `SCHEDULE{}` | object | Flight schedule (dep/arr times) |
| `SNAPSHOT{}` | object | Operations snapshot metrics with sparkline data |
| `VULNERABILITIES[]` | array | Standing network vulnerabilities |

### 3.2 THREATS Array

```json
{
  "id": "monsoon",
  "name": "Bay of Bengal Monsoon Depression",
  "code": "DM-2026-0410",
  "edps": 84,
  "namma": 87,
  "traj": "Escalating",
  "tti": "10h",
  "cat": "Weather"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Links to global event ID |
| `edps` | number | External Disruption Potential Score (from global data) |
| `namma` / `eva` / `ica` | number | Airline-specific exposure score |
| `traj` | string | Trajectory: Escalating / Stable / Improving |
| `tti` | string | Time to impact |
| `cat` | string | Threat category |

### 3.3 EXPOSURE Object — Five-Tier Model

The core intellectual property of the airline view — how a public trigger is intersected with airline data to produce exposure.

```json
{
  "monsoon": {
    "tier0": { "label": "Schedule + Fleet", "detail": "...", "count": 12, "severity": "High" },
    "tier1": { "label": "Tails & Rotations", "detail": "...", "count": 3, "severity": "Moderate" },
    "tier2": { "label": "Crew Pairings", "detail": "...", "count": 2, "severity": "Moderate" },
    "tier3": { "label": "Passengers & Cargo", "detail": "...", "count": 480, "severity": "High" },
    "tier4": { "label": "Escalation & Cost", "detail": "...", "count": 1, "severity": "Critical" }
  }
}
```

| Tier | Data | Question Answered | Source |
|---|---|---|---|
| **Tier 0** | Flight schedule + fleet capability | How many operated flights are in the event's time/geography window? | `FLIGHTS`, `SCHEDULE` |
| **Tier 1** | Tail assignment + rotation legs | Which aircraft rotations are displaced? Does the tail finish out of position? | `FLEET`, `FLIGHTS` |
| **Tier 2** | Crew pairings + duty margins | Which crew pairings are within 45 min of FDP limits if the event delays arrivals? | `PAIRINGS` |
| **Tier 3** | Passenger connections + cargo | How many connecting passengers and cargo tonnes are at risk? | `EXPOSURE.tier3` |
| **Tier 4** | Station dependencies + escalation thresholds | Does this cross the VP escalation threshold? What's the projected cost? | `EXPOSURE.tier4` |

### 3.4 FLIGHTS Array

```json
{
  "flt": "N7-201",
  "route": "BLR–DEL",
  "tail": "VT-N05",
  "type": "A320neo",
  "bank": "Bank 2",
  "threat": "chnAtc",
  "pax": 158,
  "connectPax": 42,
  "connectFlight": "N7-410",
  "status": "Scheduled",
  "delayMin": 0
}
```

| Field | Type | Description |
|---|---|---|
| `flt` | string | Flight number |
| `route` | string | Origin–destination (e.g., "BLR–DEL") |
| `tail` | string | Aircraft registration |
| `type` | string | Aircraft type |
| `bank` | string | Bank identifier |
| `threat` | string | Linked threat ID (optional) |
| `pax` | number | Passenger count |
| `connectPax` | number | Connecting passengers |
| `connectFlight` | string | Outbound connection flight (optional) |
| `status` | string | Flight status: Scheduled, Delayed, Cancelled, Rerouted |
| `delayMin` | number | Delay in minutes |

### 3.5 FLEET Array

```json
{
  "tail": "VT-N01",
  "type": "A320neo",
  "base": "BLR",
  "cat3": true,
  "status": "Active"
}
```

| Field | Type | Description |
|---|---|---|
| `tail` | string | Aircraft registration |
| `type` | string | Aircraft type |
| `base` | string | Home base (IATA code) |
| `cat3` | boolean | CAT IIIB capable |
| `status` | string | Active, Scheduled maintenance, AOG, Standby |

### 3.6 CREW Array

```json
{
  "id": "CPT-001",
  "name": "Capt. Rajesh Kumar",
  "rank": "Captain",
  "base": "BLR",
  "fleet": "A320",
  "status": "On duty"
}
```

### 3.7 PAIRINGS Array

```json
{
  "id": "P-201",
  "base": "BLR",
  "fleet": "A320",
  "route": "BLR–DEL–BLR",
  "margin": 35,
  "status": "Legal",
  "threat": "chnAtc"
}
```

| Field | Type | Description |
|---|---|---|
| `margin` | number | Duty margin in minutes — how much delay the pairing can absorb before breaking |

### 3.8 BANKS Array

```json
{
  "id": "bank3",
  "label": "Bank 3",
  "window": "18:00–21:30",
  "kind": "Domestic wave in → international departures",
  "severity": "High"
}
```

### 3.9 SNAPSHOT Object

Operations snapshot metrics with sparkline data for the radar view.

```json
{
  "label": "On-time performance",
  "value": 87,
  "unit": "%",
  "tone": "green",
  "trend": [89, 88, 87, 85, 86, 87, 87]
}
```

---

## 4. Geographic Data (`geo.json`)

### 4.1 STATIONS Object

```json
{
  "BLR": {
    "lat": 13.1986,
    "lon": 77.7066,
    "name": "Bengaluru (BLR)",
    "role": "Primary hub"
  }
}
```

### 4.2 AIRPORTS Object

Global airport coordinates referenced in events.

```json
{
  "AMS": { "lat": 52.3105, "lon": 4.7683 },
  "FRA": { "lat": 50.0379, "lon": 8.5622 }
}
```

### 4.3 EVENT_GEO Object

Geographic data per event for map rendering.

```json
{
  "monsoon": {
    "lat": 13.0,
    "lon": 80.0,
    "radius": 400,
    "label": "Bay of Bengal Monsoon",
    "airports": ["BLR", "MAA"]
  }
}
```

---

## 5. Airline Configuration (`airlines.js`)

The airline registry defines metadata for each carrier:

```javascript
{
  key: 'namma',
  name: 'Namma Air',
  shortName: 'Namma Air',
  code: 'N7',
  icao: 'NMA',
  callsign: 'NAMMA',
  hub: 'BLR',
  hubName: 'Bengaluru',
  secondaryHub: 'DEL',
  hubs: ['BLR', 'DEL'],
  accent: '#22D3EE',
  scoreField: 'namma',
  scoreLabel: 'NAMMA SCORE',
  occLabel: 'OPERATIONS CONTROL CENTRE — BLR',
  routePrefix: '',
  data: NAMMA  // imported JSON
}
```

| Field | Description |
|---|---|
| `key` | Unique airline key |
| `code` | IATA code (fictional) |
| `accent` | Brand color for UI |
| `scoreField` | Field name in EVENTS for airline-specific score |
| `routePrefix` | URL prefix for airline routes (e.g., `/eva`) |
| `data` | Reference to imported airline JSON |

---

## 6. Data Tier Model (Production Design)

In the production design, data is organised in confidentiality tiers. Tier 0 is computable from public data — DisruptionMatrix itself may hold it. Tiers 1–3 stay inside the airline's solver; the solver receives the trigger and answers with intersections.

### Tier 0 — Public / schedule layer (exposure triage)

**T0.1 `flight_schedule`** — one row per scheduled flight
`flight_no, origin, destination, dep_time_utc, arr_time_utc, days_of_week, aircraft_type, bank_id`

**T0.2 `fleet_capability`** — one row per sub-fleet
`aircraft_type, count, cat3_capable_count, etops, range_nm, seats`

### Tier 1 — Aircraft & rotations (propagation)

**T1.1 `tail_assignment`** — one row per tail per day
`tail_id, aircraft_type, rotation_id, cat3_flag, maint_due_date`

**T1.2 `rotation_legs`** — one row per leg in tail order
`rotation_id, seq, flight_no, origin, destination, dep_utc, arr_utc, turn_minutes`

**T1.3 `maintenance_plan`** — `tail_id, check_type, location, start_utc, end_utc`

### Tier 2 — Crew (the binding constraint)

**T2.1 `crew_pairing`** — `pairing_id, base, fleet, legs[], report_utc, release_utc, duty_margin_minutes`

**T2.2 `standby_coverage`** — `base, fleet, date, slots_am, slots_pm, slots_night`

### Tier 3 — Passengers, cargo, commercial

**T3.1 `connection_loads`** — `inbound_flight, outbound_flight, pax_count, min_connect_ok_flag`

**T3.2 `flight_loads`** — `flight_no, date, pax_booked, load_factor, premium_pax, special_service_count`

**T3.3 `cargo_commitments`** — `awb_group, flight_no, commodity_class, sla_hours`

**T3.4 `rebooking_capacity`** — `market, own_alternatives_per_day, interline_options_flag`

### Tier 4 — Dependencies & policy (threat → response mapping)

**T4.1 `station_dependencies`** — `airport, handler, caterer, fuel_supplier, deice_provider, alternate_airports[]`

**T4.2 `escalation_thresholds`** — `metric, threshold_value, escalation_level`

**T4.3 `cost_parameters`** — `cost_type, aircraft_class, value_inr`

---

## 7. Entity Relationships

```
EVENTS (global)
  │
  ├── factors[] ────── 8-factor EDPS breakdown
  ├── domains[] ────── 9-domain impact vector
  ├── chain[] ──────── cascading effects (1st/2nd/3rd order)
  ├── evidence[] ───── source trail
  ├── sop ──────────── linked SOP by category
  ├── retro ────────── retrospective notes
  │
  ├── OPS[eventId] ── airport & airline exposure
  │
  ├── EVENT_GEO[id] ── map coordinates (geo.json)
  │
  └── THREATS[id] ──── airline-specific threat (per airline JSON)
        │
        └── EXPOSURE[id] ── five-tier intersection
              ├── tier0: FLIGHTS + FLEET
              ├── tier1: FLEET + FLIGHTS (rotations)
              ├── tier2: PAIRINGS
              ├── tier3: connection_loads + cargo
              └── tier4: station_dependencies + cost
```

### Key Join Points

| From | To | Join Key | Purpose |
|---|---|---|---|
| `EVENTS[].id` | `THREATS[].id` | Event ID | Link global event to airline threat |
| `EVENTS[].id` | `EVENT_GEO[id]` | Event ID | Map rendering |
| `EVENTS[].id` | `OPS[eventId]` | Event ID | Operational exposure |
| `THREATS[].id` | `EXPOSURE[id]` | Threat ID | Five-tier intersection |
| `FLIGHTS[].threat` | `THREATS[].id` | Threat ID | Flagged flights |
| `PAIRINGS[].threat` | `THREATS[].id` | Threat ID | Affected crew pairings |
| `FLEET[].tail` | `FLIGHTS[].tail` | Tail number | Aircraft assignment |
| `FLIGHTS[].bank` | `BANKS[].id` | Bank ID | Bank structure impact |
| `airlines.scoreField` | `EVENTS[].<scoreField>` | Score field name | Airline-specific score in global events |

---

## 8. Scoring Model — EDPS

### Score Calculation

```
EDPS = Σ(factor.val × factor.weight) for all 8 factors
```

### Score Bands

| Range | Band | Colour | Meaning |
|---|---|---|---|
| ≥ 80 | Critical | `#F0495A` (red) | Severe disruption likely, immediate action |
| 65–79 | High | `#F5A623` (orange) | Significant disruption probable |
| 45–64 | Moderate | `#E8C34A` (yellow) | Disruption possible, monitor closely |
| < 45 | Low | `#5B92C9` (blue) | Minimal disruption expected |

### Airline-Specific Exposure Score

Each airline calculates its own exposure score per threat, reflecting:
- Fleet capability (e.g., CAT IIIB availability for fog events)
- Route overlap with the event's geographic/time window
- Bank structure sensitivity
- Crew positioning and duty margins
- Station dependencies (single-handler exposure, fuel farm, etc.)

---

## 9. Intersection Protocol (Production Design)

In production, the airline solver receives only the trigger and returns the intersection result. No raw operational data crosses the boundary.

**DisruptionMatrix sends:**
```json
{
  "event_id": "monsoon",
  "geo_window": { "lat": 13.0, "lon": 80.0, "radius_km": 400 },
  "time_window": { "start_utc": "...", "end_utc": "..." },
  "severity": 84
}
```

**Airline solver returns:**
```json
{
  "flights_affected": 12,
  "tails_displaced": 3,
  "pairings_at_risk": 2,
  "pax_at_risk": 480,
  "projected_cost_inr": 2100000,
  "escalation_level": "L4"
}
```

The airline's schedule, crew roster, and tail assignments never leave the airline.

---

## 10. Data Volume (PoC)

| Entity | Namma Air | EuroVista | IndiConnect | Global |
|---|---|---|---|---|
| Events/Threats | 6 | 6 | 5 | 17 |
| Flights | 18 | 18 | 18 | — |
| Fleet | 30 | 38 | 42 | — |
| Crew | 24 | 24 | 24 | — |
| Pairings | 12 | 12 | 12 | — |
| Banks | 4 | 4 | 4 | — |
| Airports (geo) | — | — | — | 30+ |

*PoC data is intentionally small for demo purposes. Production would scale to full daily schedules (150–200+ flights per airline).*

---

*This document describes the proof-of-concept data model. All data is synthetic and fictional.*
