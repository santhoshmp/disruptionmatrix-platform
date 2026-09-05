# DisruptionMatrix — PoC Scenarios

*Proof-of-concept disruption scenarios. All data is synthetic and fictional.*

This document defines the disruption scenarios used in the DisruptionMatrix proof-of-concept, including the candidate event set, demo flow, and suggested data model for the PoC.

---

## 1. Scenario Design Principles

The PoC scenarios are designed to demonstrate:

- Weather disruption propagation
- ATFM / EUROCONTROL flow restrictions
- NOTAM impacts
- Airport capacity constraints
- Aircraft rotation disruption
- Passenger and connection impacts
- Inter-airline connectivity
- Cross-region disruption propagation
- The "invisible exposure" story (events that affect an airline without any local event occurring)

---

## 2. Candidate PoC Scenarios

### Scenario 1 — European Convective Weather

**Event:** Severe CB (thunderstorm) activity forecast around Frankfurt, Munich, and Vienna.

**Data sources:** Weather Intelligence + EUROCONTROL ATFM + NOTAMs + EuroVista Flight Schedule

**AI determines:** Which EuroVista flights will be affected, then which connecting passengers will miss their onward flights — including Vienna → Delhi → Bengaluru connections.

**Disruption chain:**

```
Severe CB activity (FRA / MUC / VIE)
        │
        ▼
EuroVista flights delayed / cancelled
        │
        ▼
Vienna hub connection risk
        │
        ▼
VIE → DEL departure delayed
        │
        ▼
IndiConnect connections impacted in Delhi
```

### Scenario 2 — Frankfurt ATFM Regulation

**Event:** EUROCONTROL Network Manager identifies the FRA airspace sector is becoming overloaded.

```
EUROCONTROL
      │
Active ATFM Regulation
      │
      ▼
EuroVista Flights Delayed
      │
      ▼
Vienna Hub Connection Risk
      │
      ▼
Delhi Flight Departs Late
      │
      ▼
IndiConnect Connections Impacted
```

*An excellent cascading disruption scenario — a European airspace management decision propagating into Indian domestic operations.*

### Scenario 3 — Delhi Winter Fog

**Event:** Dense fog predicted at DEL with visibility below 200m. CAT IIIB procedures in effect.

```
TAF / METAR
     +
  Forecast
     +
Airport Capacity
     ↓
Reduced Landing Rate
     ↓
IndiConnect Delays
     ↓
Aircraft out of position
     ↓
EuroVista passengers miss connections
```

**The impact engine identifies:** incoming aircraft, outbound rotations, European connections, and EuroVista passengers — demonstrating cross-airline disruption propagation.

**Namma Air specific angle:** CAT I vs CAT IIIB sub-fleet split makes exposure non-obvious — only 14 of 20 A320neos are CAT IIIB certified, so 6 tails cannot hold DEL fog arrivals.

### Scenario 4 — Indian Monsoon + European Connection

**Event:** Severe monsoon thunderstorms at Mumbai.

```
Weather Hazard
     +
Airport Capacity
     +
   NOTAM
     ↓
Flight Cancellation Risk
```

**The system determines:** IndiConnect IC452 (DEL → BOM) is likely to be cancelled. 34 EuroVista passengers arriving into Delhi have onward bookings to Mumbai.

**The AI recommends:** rebook affected passengers, protect connections, notify partner airline, update downstream systems.

### Scenario 5 — BLR Fuel Depot Supply Disruption

**Event:** Primary into-plane fuel supplier at BLR reports a pipeline valve fault reducing available fuel supply.

**Why it suits Namma Air:** Hub single-point-of-failure — BLR is Namma Air's primary hub with 200+ daily movements. All departures depend on a single fuel farm.

**Impact:** Reduced uplift forces weight restrictions on long-haul departures (LHR, FRA, SFO), potentially requiring tech stops or payload offloads.

### Scenario 6 — Gulf Airspace Overflight Restriction

**Event:** Reserved airspace block over the Gulf corridor narrows the standard BLR–LHR overflight route.

**Why it suits Namma Air:** Westbound long-haul routes cross the Gulf corridor. No Indian event occurs, yet the airline is directly affected — the "invisible exposure" story.

**Impact:** Extended block time on LHR/FRA sectors, crew duty implications, potential payload restrictions.

### Scenario 7 — French ATC Strike

**Event:** French ATC strike ballot threatens French UIR airspace.

**Why it suits Namma Air:** No French destination — yet LHR routings cross French UIRs. The airline has zero presence in France but is exposed through overflight corridors.

**Impact:** Rerouting required for LHR flights, extended block times, potential cancellations if alternate routings exceed crew duty limits.

---

## 3. Demo Event Set

The PoC includes 17 synthetic global events consolidated from all three airlines' threat data:

| Global Event | Category | EDPS | Trajectory | TTI |
|---|---|---|---|---|
| Bay of Bengal Monsoon Depression | Weather | 84 | Escalating | 10h |
| Central European Convective Weather | Weather | 82 | Escalating | 4h |
| Mumbai Monsoon Thunderstorms | Weather | 79 | Escalating | 3h |
| Delhi Winter Fog — CAT III Demand Surge | Weather | 76 | Stable | 14h |
| Frankfurt ATFM Regulation — Sector Overload | ATC / Airspace | 74 | Stable | 2h |
| Chennai ACC Flow Restriction | ATC / Airspace | 71 | Stable | 4h |
| Vienna Winter Storm — Snow Accumulation | Weather | 69 | Stable | 8h |
| BLR Fuel Depot Supply Disruption | Infrastructure | 68 | Escalating | 6h |
| Bengaluru Thunderstorm Activity | Weather | 66 | Stable | 5h |
| Gulf Airspace Overflight Restriction | Geopolitical | 62 | Stable | 2d |
| Dubai Airspace Congestion — Peak Hour | ATC / Airspace | 61 | Stable | 8h |
| Zurich Low-Visibility Procedures | Weather | 58 | Improving | 6h |
| Delhi ATC Sector Capacity Reduction | ATC / Airspace | 57 | Stable | 4h |
| Vienna Ground Handler Industrial Action | Industrial action | 54 | Escalating | 12h |
| Cabin Crew Go-Slow Notice — DEL Base | Industrial action | 45 | Improving | 3d |
| Amsterdam Slot Constraints — Runway Maintenance | Infrastructure | 48 | Stable | 1d |
| Kochi Monsoon Flooding — Airport Access | Weather | 49 | Improving | 12h |

### Namma Air Specific Demo Events

| Event (synthetic) | Category | Why it suits this airline |
|---|---|---|
| DEL winter fog episode | Severe weather | CAT I vs CAT IIIB sub-fleet split makes exposure non-obvious |
| Cyclone approaching MAA/east coast | Severe weather | Multi-airport regional impact + cargo |
| BLR fuel-farm contamination alert | Infrastructure | Hub single-point-of-failure |
| Gulf airspace restriction | Geopolitical | Hits DXB/AUH/MCT flights + all westbound long-haul overflights |
| LHR ground-handler strike ballot | Industrial action | Single-handler dependency at LHR |
| French ATC strike | Industrial action | No French destination — yet LHR routings cross French UIRs: the "invisible exposure" story |
| DGCA winter-schedule fog directive | Regulatory | CAT III crew/aircraft compliance requirement on DEL routes |

---

## 4. Demo Flow — How the PoC Walk-Through Works

### Trigger arrival

A trigger arrives (e.g. *DEL dense fog, CAT IIIB conditions forecast 22:00–09:00 IST, score 74, escalating*) → the solver intersects:

1. **Tier 0** (Schedule + fleet): 12 DEL movements in window
2. **Tier 1** (Tails & rotations): 3 rotations overnight in DEL, one CAT I tail exposed
3. **Tier 2** (Crew pairings): 2 pairings with <45 min duty margin
4. **Tier 3** (Passengers & cargo): Bank 1 feed carries 480 connecting passengers incl. LHR
5. **Tier 4** (Escalation & cost): 6+ cancellations projected → VP escalation; cost estimate attached

**Output:** An airline-specific exposure report generated from a public trigger, with zero confidential data leaving the airline.

### Cross-airline propagation

A European event (e.g. Frankfurt ATFM regulation) → EuroVista flights delayed → Vienna hub connection risk → VIE→DEL flight departs late → IndiConnect connections impacted in Delhi → EuroVista passengers arriving into Delhi miss onward connections.

---

## 5. Suggested PoC Data Model

For each airline, realistic datasets should be created across the following entities.

### Airline Master
- Airline
- IATA / ICAO
- Fleet
- Hubs
- Bases
- Network
- Operating Rules

### Flight Schedule
- Flight Number
- Origin
- Destination
- STD (Scheduled Time of Departure)
- STA (Scheduled Time of Arrival)
- Aircraft
- Rotation
- Codeshare Partner
- Connection Group

### Aircraft Rotation
- Aircraft ID
- Flight Sequence
- Airport
- Scheduled Arrival
- Scheduled Departure
- Turnaround Time

### Passenger Connection Data
*No actual PII — anonymised data only:*
- Passenger Group ID
- Inbound Flight
- Outbound Flight
- Connection Time
- Risk Score
- Partner Airline

### Example Flight Data

**EuroVista**

| Flight | Route | Aircraft | Connection Role |
|---|---|---|---|
| EV412 | GVA → VIE | E195 | European feeder |
| EV901 | VIE → DEL | A321LR | Intercontinental |
| EV234 | FRA → VIE | A320neo | Hub feeder |
| EV567 | ZRH → VIE | E195 | Hub feeder |

**IndiConnect**

| Flight | Route | Aircraft | Connection Role |
|---|---|---|---|
| IC234 | DEL → BLR | A320neo | EuroVista connection |
| IC452 | DEL → BOM | A320neo | Hub feeder |
| IC782 | BOM → COK | A320neo | Domestic connection |
| IC901 | DEL → VIE | A321XLR | Partner route |

---

## 6. Suggested Next Steps

1. Generate complete synthetic operational datasets for Namma Air, EuroVista, and IndiConnect — including fleet registration numbers, 50–100 flights per airline, aircraft rotations, schedules, airport connections, and disruption scenarios.
2. Build 2–3 scripted trigger JSONs so the simulated solver walk-through can run live.
3. Define the intersection protocol between DisruptionMatrix and each airline solver.
4. Create a cross-airline passenger connection dataset to demonstrate inter-airline propagation.

---

*This document describes proof-of-concept scenarios. All data is synthetic and fictional.*
