# DisruptionMatrix — Intelligence Agent Design

*Design specification for the data-gathering agent fleet that feeds the DisruptionMatrix threat-intelligence platform. All airline names, codes, and routes are fictional.*

---

## 1. Purpose

DisruptionMatrix scores external disruption events using the 8-factor **External Disruption Potential Score (EDPS)** and correlates them with each airline's network. Today the PoC consumes a static `dm-data.json` with 17 hand-authored events. This document defines the **agent fleet** that would, in production, gather the raw intelligence needed to populate those events continuously.

The agents do **not** score or decide — they collect, normalize, and attach provenance. The downstream **Correlation & Scoring Engine** (Section 7) consumes agent output and produces the `EVENTS[]` entities that the UI renders.

---

## 2. Agent Scope — Derived from the Product

The product defines six event categories, eight EDPS factors, nine operational domains, and three airline networks with specific hubs and overflight corridors. The agent scope is derived directly from these:

| Product element | Agent implication |
|---|---|
| 6 event categories (`cat`) | 6 specialist agent types, one per category |
| 8 EDPS factors | Each agent must emit evidence that lets the scorer populate all 8 factors |
| 9 operational domains | Agents tag affected domains so the domain vector can be computed |
| `where` + `EVENT_GEO` (lat/lon/radius) | Agents must geocode every signal |
| `evidence[]` with tier + role | Agents attach source tier (1–3) and role per source |
| `chain[]` (1st/2nd/3rd order) | Agents emit a `preliminary_effects` hint; the engine expands the chain |
| Airline hubs (BLR, DEL, VIE, MUC, BOM) | Regions are anchored on hub density |
| Overflight corridors (Gulf, French UIR, North Atlantic) | Regions include overflight airspace, not just airports |

### 2.1 The Six Agent Types

| Agent type | Event category | Primary question it answers |
|---|---|---|
| `weather` | Weather | Is there a meteorological hazard developing that will reduce airport capacity or close airspace? |
| `atc` | ATC / Airspace | Is there an ATFM regulation, sector overload, or flow restriction that will delay flights? |
| `industrial` | Industrial action | Is there a strike ballot, go-slow, or industrial action notice affecting an airport, handler, or crew base? |
| `geopolitical` | Geopolitical | Is there an airspace restriction, security NOTAM, or border closure affecting overflight or destination access? |
| `infrastructure` | Infrastructure | Is there an airport infrastructure failure (fuel, runway, ground system, power) reducing throughput? |
| `regulatory` | Regulatory | Is there a regulatory directive (fog directive, ETOPS change, ops spec change) that changes operating rules? |

---

## 3. Region Configuration

Regions are derived from the union of all airline networks (Namma Air, EuroVista, IndiConnect, Western India Airways) plus the overflight corridors that create "invisible exposure". Each region has a priority weight reflecting how many airline operations touch it.

### 3.1 Region Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT REGION COVERAGE                            │
│                                                                          │
│  R1 Indian Subcontinent    R2 Europe         R3 Middle East / Gulf       │
│  ┌──────────────┐         ┌──────────────┐  ┌──────────────┐            │
│  │ South India  │         │ Central Europe│  │ Gulf States  │            │
│  │ North India  │         │ Western Europe│  │ Overflight   │            │
│  │ West India   │         │ Northern Europe│ │  Corridor    │            │
│  │ East India   │         │ Southern Europe│ └──────────────┘            │
│  │ Bay of Bengal│         └──────────────┘                              │
│  │ Arabian Sea  │                                                       │
│  └──────────────┘                                                       │
│                                                                          │
│  R4 Southeast Asia   R5 North Atlantic    R6 East Asia    R7 Africa      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ ┌──────────┐  │
│  │ SIN · BKK    │    │ LHR · JFK    │    │ HKG · NRT    │ │ JNB · NBO│  │
│  │ KUL · CGK    │    │ NAT Tracks   │    │ ICN          │ │          │  │
│  └──────────────┘    └──────────────┘    └──────────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Region Definitions

#### R1 — Indian Subcontinent (priority: critical)

Namma Air and IndiConnect both hub here; the majority of demo events originate in this region.

| Sub-region | Airports | Airspace | Bounding box (lat/lon) |
|---|---|---|---|
| South India | BLR, MAA, COK, HYD, GOI, PNQ, VTZ | Chennai FIR, Bangalore FIR, Mumbai FIR (south) | 8–18°N, 72–85°E |
| North India | DEL, LKO, JAI, AMD, IXC, GAU | Delhi FIR, Kolkata FIR (north) | 23–32°N, 73–90°E |
| West India | BOM, GOI, PNQ | Mumbai FIR (north) | 15–24°N, 70–76°E |
| East India | CCU, GAU | Kolkata FIR (south) | 18–28°N, 85–93°E |
| Bay of Bengal | — | Bay of Bengal airspace, Chennai FIR (maritime) | 5–22°N, 80–92°E |
| Arabian Sea | — | Arabian Sea airspace, Mumbai FIR (maritime) | 5–25°N, 65–75°E |

**Seasonal watchlist:** DEL winter fog (Dec–Jan), BOM monsoon (Jun–Sep), MAA/CCU cyclone season (Oct–Dec), BLR morning fog (rare).

#### R2 — Europe (priority: critical)

EuroVista hubs here; Namma Air and Western India Airways overfly French UIRs and European airspace on LHR/FRA routings.

| Sub-region | Airports | Airspace | Bounding box |
|---|---|---|---|
| Central Europe | VIE, MUC, PRG, BUD | Vienna FIR, Munich FIR, Prague FIR | 45–52°N, 10–20°E |
| Western Europe | FRA, AMS, CDG, BRU, ZRH, GVA | Frankfurt FIR, Amsterdam FIR, Paris FIR, Swiss FIR | 45–53°N, −2–10°E |
| Northern Europe | CPH, OSL, EDI, ABZ, RTM | Copenhagen FIR, Oslo FIR, Scottish FIR | 55–62°N, −5–15°E |
| Southern Europe | FCO, MAD, IST, LIS, ATH | Rome FIR, Madrid FIR, Istanbul FIR | 36–42°N, −10–30°E |

**Overflight note:** French UIR is critical for LHR routings — no French destination is needed for exposure.

#### R3 — Middle East / Gulf (priority: high)

All three PoC airlines serve DXB/AUH/MCT. Westbound long-haul overflights cross the Gulf corridor. The "invisible exposure" scenario (Gulf airspace restriction) originates here.

| Sub-region | Airports | Airspace | Bounding box |
|---|---|---|---|
| Gulf States | DXB, AUH, MCT, DOH, BAH | Dubai FIR, Muscat FIR, Bahrain FIR | 22–28°N, 50–58°E |
| Overflight Corridor | — | Gulf corridor, Iraqi/Turkish UIR, Saudi/Egyptian corridors | 20–35°N, 40–55°E |

#### R4 — Southeast Asia (priority: medium)

Namma Air and IndiConnect serve SIN, BKK, KUL. Western India Airways serves CGK.

| Sub-region | Airports | Airspace | Bounding box |
|---|---|---|---|
| Mainland SEA | BKK, KUL, SIN | Singapore FIR, Bangkok FIR | −2 to 15°N, 95–110°E |

#### R5 — North Atlantic / North America (priority: medium)

Western India Airways serves JFK, LHR, YYZ, ORD. Namma Air serves LHR, SFO. North Atlantic Tracks are relevant for long-haul rerouting.

| Sub-region | Airports | Airspace | Bounding box |
|---|---|---|---|
| British Isles | LHR, LGW, STN | London FIR, Scottish FIR | 50–55°N, −6 to 2°E |
| North America | JFK, YYZ, ORD, SFO | New York FIR, Toronto FIR | 35–50°N, −125 to −70°W |
| North Atlantic | — | NAT Tracks, Shanwick FIR, Gander FIR | 40–65°N, −70 to −10°W |

#### R6 — East Asia (priority: low)

Western India Airways serves HKG, NRT, ICN.

| Sub-region | Airports | Airspace | Bounding box |
|---|---|---|---|
| East Asia | HKG, NRT, ICN | Hong Kong FIR, Tokyo FIR, Seoul FIR | 30–45°N, 115–145°E |

#### R7 — Africa (priority: low)

Limited overflight relevance for westbound long-haul; included for completeness.

| Sub-region | Airports | Airspace | Bounding box |
|---|---|---|---|
| East Africa | NBO | Nairobi FIR | −5 to 5°N, 35–42°E |
| Southern Africa | JNB | Johannesburg FIR | −30 to −20°S, 25–32°E |

---

## 4. Agent Taxonomy

Each of the 6 agent types is instantiated **per region** where that category is relevant. Not every agent type runs in every region — the matrix below shows the active instantiations.

### 4.1 Agent × Region Matrix

| Agent type \ Region | R1 India | R2 Europe | R3 Gulf | R4 SEA | R5 NAT | R6 E.Asia | R7 Africa |
|---|---|---|---|---|---|---|---|
| `weather` | ●●● | ●●● | ●● | ●● | ●● | ●● | ● |
| `atc` | ●●● | ●●● | ●● | ● | ●● | ● | ● |
| `industrial` | ●● | ●●● | ● | ● | ● | ● | — |
| `geopolitical` | ● | ● | ●●● | ● | ● | ● | ● |
| `infrastructure` | ●● | ●● | ● | ● | ● | ● | — |
| `regulatory` | ●● | ●● | ● | ● | ● | ● | — |

(●●● = critical density, ●● = high, ● = standard, — = not deployed)

This yields **28 active agent instances** across 7 regions and 6 categories.

### 4.2 Agent Naming Convention

```
<agentType>-<regionCode>-<subRegion>
```

Examples:
- `weather-R1-southIndia` — monitors BLR/MAA/COK met
- `atc-R2-westernEurope` — monitors FRA/AMS/CDG ATFM
- `geopolitical-R3-overflight` — monitors Gulf corridor NOTAMs
- `industrial-R2-centralEurope` — monitors VIE/MUC strike ballots

---

## 5. Per-Agent Specification

Each agent type has a defined set of data sources, the EDPS factors it contributes evidence for, and an output contract.

### 5.1 WeatherAgent

**Mission:** Detect developing meteorological hazards (storms, fog, monsoon, cyclones, snow, low visibility) that will reduce airport capacity or close airspace.

**Data sources:**

| Source | Type | Tier | Region scope |
|---|---|---|---|
| ICAO METAR / TAF | API / feed | 1 | All airports in region |
| National met service bulletins (IMD, DWD, Met Office, NOAA) | Web / API | 1 | Per country |
| ECMWF / GFS model output | API | 1 | Global, filtered to region bbox |
| Tropical cyclone advisories (JTWC, RSMC) | Web / feed | 1 | Maritime sub-regions |
| SIGMET / AIRMET | Feed | 1 | Region FIRs |
| Lightning detection networks | API | 2 | Region bbox |
| Social media (spotter reports) | API | 3 | Region bbox (corroboration only) |

**EDPS factor contribution:**

| Factor | How the agent informs it |
|---|---|
| Probability of occurrence | Model agreement (ECMWF/GFS spread), number of met services converging |
| Severity if realised | Gust speeds vs. crosswind limits, visibility vs. CAT minima, rainfall intensity |
| Geographic reach | Wind field / fog extent radius, airports within bbox |
| Expected duration | Forecast window + recovery time (e.g., swell recovery, fog burn-off) |
| Time to impact | Forecast onset time − now |
| Escalation rate | Score delta across last 3 model cycles |
| Source credibility | Tier rating of met services corroborating |
| Prediction confidence | Ensemble spread agreement |

**Output contract (per signal):**

```json
{
  "agentId": "weather-R1-southIndia",
  "agentType": "weather",
  "region": "R1",
  "subRegion": "southIndia",
  "signalId": "wx-2026-0410-01",
  "detected": "2026-02-11T06:00:00Z",
  "name": "Bay of Bengal Monsoon Depression",
  "hazardType": "monsoon_depression",
  "geo": { "lat": 12.0, "lon": 80.0, "radiusKm": 400 },
  "airports": ["BLR", "MAA"],
  "airspace": ["Chennai FIR"],
  "summary": "Deepening low-pressure system tracking toward the southeast coast...",
  "factorHints": {
    "probability": 89,
    "severity": 84,
    "geographicReach": 79,
    "expectedDuration": 74,
    "timeToImpact": 90,
    "escalationRate": 75,
    "sourceCredibility": 82,
    "predictionConfidence": 78
  },
  "domains": ["Airport operations", "Flight schedule", "Aircraft rotations"],
  "preliminaryEffects": [
    { "ord": 1, "title": "Arrival rate reduction at BLR", "lead": "0–2h" }
  ],
  "evidence": [
    {
      "source": "IMD Cyclone Warning Bulletin",
      "tier": 1,
      "role": "Primary meteorological source",
      "timestamp": "2026-02-11T03:30:00Z",
      "excerpt": "Deep depression over west-central Bay of Bengal..."
    }
  ],
  "rawRefs": ["imd-bulletin-20260211-0330", "ecmwf-cycle-20260211-00"]
}
```

### 5.2 ATCAgent

**Mission:** Detect ATFM regulations, sector overloads, flow restrictions, and capacity reductions that will delay flights.

**Data sources:**

| Source | Type | Tier | Region scope |
|---|---|---|---|
| EUROCONTROL NM B2B / NOP | API | 1 | R2 Europe |
| FAA SWIM / TFDM | API | 1 | R5 North America |
| AAI ATFM portal | Web / API | 1 | R1 India |
| CAAS / GCC ATFM feeds | API | 1 | R3 Gulf |
| NOTAMs (AUP/UUP) | Feed | 1 | All regions |
| Airport slot coordinator bulletins | Web | 2 | Major hub airports |

**EDPS factor contribution:**

| Factor | How the agent informs it |
|---|---|
| Probability of occurrence | Regulation published status (draft vs. active) |
| Severity if realised | Delay minutes published, sector capacity reduction % |
| Geographic reach | Number of FIRs / airports in the regulation scope |
| Expected duration | Regulation start/end times |
| Time to impact | Regulation start − now |
| Escalation rate | Trend in delay minutes over recent cycles |
| Source credibility | NM/FAA official = tier 1 |
| Prediction confidence | High for published regulations; lower for predicted overload |

**Output contract:** Same shape as WeatherAgent, with `hazardType` values like `atfm_regulation`, `sector_overload`, `flow_restriction`, `capacity_reduction`.

### 5.3 IndustrialActionAgent

**Mission:** Detect strike ballots, go-slow notices, union action announcements, and ground handler industrial action that will reduce airport throughput or crew availability.

**Data sources:**

| Source | Type | Tier | Region scope |
|---|---|---|---|
| Official union notices (employer filings) | Web / API | 1 | Per country |
| Government labor dispute registries | Web | 1 | Per country |
| EUROCONTROL industrial action bulletins | API | 1 | R2 Europe |
| News wires (Reuters, AFP) | API | 2 | All regions |
| Social media (union accounts) | API | 3 | All regions (corroboration) |

**EDPS factor contribution:**

| Factor | How the agent informs it |
|---|---|
| Probability of occurrence | Ballot result vs. announced action date |
| Severity if realised | % of workforce affected, airport closure vs. reduced rate |
| Geographic reach | Airports / bases affected |
| Expected duration | Announced strike window |
| Time to impact | Action start − now |
| Escalation rate | Ballot progression (notice → ballot → result → action) |
| Source credibility | Official notice = tier 1; news = tier 2 |
| Prediction confidence | High if action date announced; medium if ballot pending |

### 5.4 GeopoliticalAgent

**Mission:** Detect airspace restrictions, security NOTAMs, border closures, and overflight corridor changes that affect route access — including the "invisible exposure" case where no destination event occurs.

**Data sources:**

| Source | Type | Tier | Region scope |
|---|---|---|---|
| State NOTAMs (airspace restrictions) | Feed | 1 | All regions |
| ICAO Annex 15 (PIB) | API | 1 | All regions |
| FAA / EASA prohibitions lists | Web | 1 | Global |
| Conflict monitoring (ACLED, OSINT) | API | 2 | R3 Gulf, R7 Africa |
| News wires (geopolitical) | API | 2 | All regions |

**EDPS factor contribution:**

| Factor | How the agent informs it |
|---|---|
| Probability of occurrence | NOTAM published vs. draft; advisory vs. mandatory |
| Severity if realised | Corridor closure vs. narrowing; reroute distance added |
| Geographic reach | Number of FIRs / corridors affected |
| Expected duration | NOTAM validity period |
| Time to impact | NOTAM effective time − now |
| Escalation rate | Progression: advisory → warning → restriction → closure |
| Source credibility | State NOTAM = tier 1; OSINT = tier 2–3 |
| Prediction confidence | High for published NOTAMs; lower for anticipated closures |

### 5.5 InfrastructureAgent

**Mission:** Detect airport infrastructure failures (fuel supply, runway, ILS, power, ground systems, baggage, terminal) that reduce throughput.

**Data sources:**

| Source | Type | Tier | Region scope |
|---|---|---|---|
| Airport NOTAMs (infrastructure) | Feed | 1 | All airports in region |
| Airport operator bulletins | Web | 1 | Major hubs |
| Fuel supplier notices | Direct feed | 1 | Hub airports |
| News wires (local) | API | 2 | All regions |
| Social media (airport accounts) | API | 3 | All regions |

**EDPS factor contribution:**

| Factor | How the agent informs it |
|---|---|
| Probability of occurrence | Confirmed failure vs. reported issue |
| Severity if realised | Capacity reduction % (e.g., fuel uplift halved, one runway closed) |
| Geographic reach | Single airport vs. multi-airport (fuel pipeline) |
| Expected duration | ETR from operator / supplier |
| Time to impact | Immediate for active failures; scheduled for maintenance |
| Escalation rate | Issue → failure → cascade progression |
| Source credibility | Operator = tier 1; news = tier 2 |
| Prediction confidence | High for confirmed failures |

### 5.6 RegulatoryAgent

**Mission:** Detect regulatory directives (fog directives, ETOPS changes, ops spec changes, curfew changes) that alter operating rules.

**Data sources:**

| Source | Type | Tier | Region scope |
|---|---|---|---|
| DGCA / EASA / FAA directives | Web / API | 1 | Per authority |
| ICAO State letters | API | 1 | Global |
| Aeronautical information circulars (AIC) | Web | 1 | Per country |
| Legal/regulatory news | API | 2 | All regions |

**EDPS factor contribution:**

| Factor | How the agent informs it |
|---|---|
| Probability of occurrence | Directive published vs. proposed |
| Severity if realised | Compliance cost (fleet grounding, crew retraining) |
| Geographic reach | Authority jurisdiction scope |
| Expected duration | Directive effective period |
| Time to impact | Compliance deadline − now |
| Escalation rate | Notice → consultation → directive → enforcement |
| Source credibility | Authority = tier 1 |
| Prediction confidence | High for published directives |

---

## 6. Agent Output → EVENTS Mapping

The Correlation & Scoring Engine consumes agent signals and produces the `EVENTS[]` entities that `dm-data.json` holds. The mapping:

```
Agent signal field          → EVENTS entity field
─────────────────────────────────────────────
signalId                    → (used for dedup / ref assignment)
detected                    → detected
name                        → name
agentType                   → cat (Weather, ATC / Airspace, ...)
geo.lat / geo.lon / radius  → EVENT_GEO[id].lat / lon / radiusKm
airports                    → EVENT_GEO[id].airports
summary                     → summary
factorHints.*               → factors[].val (engine applies weights)
domains                     → domains[] (engine assigns v values)
preliminaryEffects          → chain[] (engine expands to 2nd/3rd order)
evidence[]                  → evidence[]
                            → ref (engine assigns DM-YYYY-NNNN)
                            → score (engine computes EDPS = Σ val×weight)
                            → conf (engine derives from source tiers)
                            → traj (engine tracks score over time)
                            → tti / ttiMin (engine computes from timeToImpact)
                            → esc (engine maps score → L1–L4)
                            → namma / eva / ica (airline solver intersection)
```

---

## 7. Orchestration Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. COLLECTION                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ weather  │ │  atc     │ │industrial│ │geopolit. │ │ infra    │  │
│  │ agents   │ │ agents   │ │ agents   │ │ agents   │ │ agents   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └────────────┴────────────┴────────────┴────────────┘         │
│                        │                                            │
│  2. NORMALIZATION      ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Geocode · Timestamp (UTC) · Source-tier · Category tag   │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  3. CORRELATION         ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Dedup (geo+time+category) · Merge corroborating sources  │       │
│  │ Group signals → candidate events                         │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  4. SCORING (EDPS)      ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ For each candidate event:                                │       │
│  │   EDPS = Σ(factor.val × factor.weight) for 8 factors     │       │
│  │   conf = f(source tiers)                                 │       │
│  │   traj = score delta over last N cycles                  │       │
│  │   tti / ttiMin from factorHints.timeToImpact             │       │
│  │   esc = L1–L4 from score band                            │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  5. DOMAIN IMPACT       ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Compute 9-domain vector (0–100 per domain)               │       │
│  │ from agent domain tags + event category heuristics       │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  6. CAUSAL CHAIN        ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Expand preliminaryEffects → 1st/2nd/3rd order chain      │       │
│  │ with likelihood + lead time per order                    │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  7. EVIDENCE ASSEMBLY   ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Attach evidence[] trail with tier + role per source      │       │
│  │ Assign ref (DM-YYYY-NNNN)                                 │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  8. IMPACT ASSESSMENT   ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ ImpactAssessmentAgent (event-driven)                     │       │
│  │ Pull published schedules for affected airports            │       │
│  │ Compute per-airport exposure (movements, window, score)  │       │
│  │ Compute per-airline exposure (hub, share, fleet, banks)  │       │
│  │ Produce OPS[eventId] + preliminary airlineScores          │       │
│  └────────────────────────────┬────────────────────────────┘       │
│                               │                                    │
│  9. EVENT STORE         ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │ Publish to EVENTS[] + OPS[] (time-series)                 │       │
│  │ Trigger airline solver intersection (namma/eva/ica)      │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.1 Polling Cadence

| Agent type | Poll interval | Rationale |
|---|---|---|
| `weather` | 5 min | Model cycles update frequently; storms escalate fast |
| `atc` | 2 min | ATFM regulations change in near-real-time |
| `industrial` | 30 min | Strike notices evolve slowly |
| `geopolitical` | 10 min | NOTAMs can appear with short notice |
| `infrastructure` | 10 min | Failures need fast detection |
| `regulatory` | 1 hr | Directives change slowly |

### 7.2 Source Tier Definitions

| Tier | Definition | Examples |
|---|---|---|
| 1 | Official / authoritative source | Met service, ATC authority, airport operator, regulator |
| 2 | Corroborating professional source | News wire, industry monitoring service |
| 3 | Supplementary / unverified | Social media, spotter reports |

An event must have at least one Tier-1 source to be published. Tier-2/3 sources strengthen `sourceCredibility` and `predictionConfidence` factors.

---

## 7.5 ImpactAssessmentAgent

The intelligence agents in Sections 5.1–5.6 gather raw signals. The ImpactAssessmentAgent is a **different kind of agent** — it is event-driven, not polling. It subscribes to candidate events produced by the Correlation & Scoring Engine, pulls published flight schedules for the affected airports, and computes the **per-airport and per-airline operational exposure** that becomes the `OPS` object in the data model.

### 7.5.1 Mission

Given a scored event with a geographic window, time window, and affected airports, answer:

1. **Per airport:** How many scheduled movements fall inside the event's time window? What is the airport-level exposure score?
2. **Per airline:** Which airlines operate at the affected airports? How many of their flights are in the window? Is this a hub for them? What is their exposure level (Critical / High / Moderate / Low)?

This agent uses **public schedule data only** (Tier 0 in the data tier model). It does not access confidential airline operational data — tail assignments, crew pairings, and passenger loads remain inside each airline's solver. The ImpactAssessmentAgent produces the public exposure view; the airline solver refines it with confidential data.

### 7.5.2 Position in the Pipeline

```
Intelligence agents (6 types, 28 instances)
    │
    ▼ produce signals
Correlation & Scoring Engine (steps 1–4)
    │
    ▼ produces candidate EVENTS with EDPS scores
    │
    ▼ ─────────────────────────────────────────────
    │                                              │
    ▼                                              ▼
ImpactAssessmentAgent                     Event Store (EVENTS[])
    │                                              │
    │ pulls published schedules                     │
    │ for affected airports                         │
    ▼                                              │
Computes OPS[eventId]                               │
    │ airports[] — per-airport exposure             │
    │ airlines[] — per-airline exposure              │
    │ airlineScores — preliminary namma/eva/ica      │
    ▼                                              │
    └──────────────────────────────────────────────►│
                                                   │
                                          EVENTS[] + OPS[] published
                                                   │
                                                   ▼ triggers
                                          Airline solver (per airline)
                                                   │
                                                   ▼ returns
                                          THREATS[] + EXPOSURE{} (confidential)
```

### 7.5.3 Data Sources

| Source | Type | Tier | What it provides |
|---|---|---|---|
| OAG / airline published timetables | API / feed | 1 | Scheduled flights per airport per day (flight no, origin, dest, dep/arr times, aircraft type, airline) |
| Flight tracking APIs (FlightAware, Flightradar24) | API | 1 | Real-time scheduled vs. actual times, cancellations, diversions |
| Airport slot coordinator data | API / web | 1 | Slot allocations per airline per airport |
| Airline registry (internal config) | Config | 1 | Airline metadata: hub, secondary hub, fleet, daily departures, network share per airport |
| IATA/ICAO airport directory | Reference | 1 | Airport coordinates, runway capabilities (CAT IIIB status), capacity |
| Seasonal schedule (SSIM) | Feed | 1 | Seasonal schedule variations, bank structure patterns |

### 7.5.4 Input

The ImpactAssessmentAgent receives a **scored event** from the Correlation & Scoring Engine:

```json
{
  "eventId": "monsoon",
  "name": "Bay of Bengal Monsoon Depression",
  "cat": "Weather",
  "geo": { "lat": 12.0, "lon": 80.0, "radiusKm": 400 },
  "airports": ["BLR", "MAA"],
  "airspace": ["Chennai FIR"],
  "timeWindow": { "startUtc": "2026-02-11T08:00:00Z", "endUtc": "2026-02-11T18:00:00Z" },
  "edps": 84,
  "factorHints": { "severity": 84, "geographicReach": 79, "expectedDuration": 74 },
  "domains": ["Airport operations", "Flight schedule", "Aircraft rotations"],
  "hazardType": "monsoon_depression"
}
```

### 7.5.5 Computation

#### Step 1 — Pull schedules for affected airports

For each airport in the event's `airports[]`, pull all scheduled movements (arrivals + departures) that fall within the event's time window. For overflight events (airspace restrictions), pull schedules for airlines whose routes cross the affected airspace.

#### Step 2 — Compute per-airport exposure

For each affected airport:

| Metric | How it's computed |
|---|---|
| `movements` | Count of scheduled arrivals + departures in the time window |
| `window` | Event time window duration (human-readable) |
| `exposure` | `min(100, round(edps × airportImpactMultiplier))` where `airportImpactMultiplier` accounts for: movement density (movements vs. airport hourly capacity), hub role (hub = 1.0, secondary = 0.85, outstation = 0.7), and runway capability relevance (e.g., if hazardType is fog and airport lacks CAT IIIB, multiplier increases) |
| `role` | "Affected" for airports inside the geo radius; "Overflight" for airports whose routes cross affected airspace |
| `note` | Generated from the event summary + airport-specific impact detail |

#### Step 3 — Compute per-airline exposure

For each airline operating at the affected airports:

| Metric | How it's computed |
|---|---|
| `name`, `code` | From airline registry |
| `hub` | Airline's primary hub from registry |
| `daily` | Airline's daily departures (from registry) |
| `netShare` | Airline's movement share at the affected airport (%) |
| `airports` | Affected airports where this airline operates (joined with " · ") |
| `exposure` | Exposure level (Critical / High / Moderate / Low) computed from the airline exposure score (below) |
| `note` | Generated from exposure drivers (hub role, movement count, fleet capability) |

**Airline exposure score (0–100):**

```
airlineExposure = edps × (
    0.35 × hubFactor +
    0.25 × movementShareFactor +
    0.20 × fleetCapabilityFactor +
    0.10 × bankOverlapFactor +
    0.10 × overflightFactor
)
```

| Factor | Range | How it's computed |
|---|---|---|
| `hubFactor` | 0.5–1.5 | 1.5 if affected airport is the airline's primary hub; 1.2 if secondary hub; 0.8 if focus city; 0.5 if outstation |
| `movementShareFactor` | 0.3–1.2 | Normalized airline's movement share at the affected airport (netShare / 100 × 1.2, capped at 1.2) |
| `fleetCapabilityFactor` | 0.5–1.3 | 1.3 if the airline's fleet lacks capability for the hazard (e.g., no CAT IIIB for fog); 1.0 if neutral; 0.5 if the fleet is specifically equipped |
| `bankOverlapFactor` | 0.5–1.2 | 1.2 if the event time window overlaps the airline's most sensitive bank (e.g., Bank 3 → Bank 4 for Namma Air); 1.0 if any bank; 0.5 if off-peak |
| `overflightFactor` | 0.5–1.3 | 1.3 if the airline overflies the affected airspace but has no destination there (invisible exposure); 1.0 if it serves the affected airport; 0.5 if no route overlap |

**Exposure level mapping:**

| Score range | Level |
|---|---|
| ≥ 80 | Critical |
| 65–79 | High |
| 45–64 | Moderate |
| < 45 | Low |

#### Step 4 — Compute preliminary airline exposure scores

The per-airline exposure scores become the preliminary `namma` / `eva` / `ica` values on the EVENTS entity. These are **public approximations** based on published schedules. In production, the airline solver replaces these with refined scores from the confidential five-tier intersection.

#### Step 5 — Identify overflight exposure

For geopolitical and ATC events that affect airspace (not airports), the agent cross-references the affected airspace with each airline's published route network. If an airline's routes cross the affected airspace but the airline has no destination at the affected airport, this is flagged as **overflight exposure** — the "invisible exposure" scenario.

Example: Gulf airspace restriction affects Namma Air's BLR–LHR route, even though Namma Air has no Gulf destination in the restricted block. The agent detects this by checking if any of the airline's published routes intersect the affected airspace polygon.

### 7.5.6 Output Contract

The ImpactAssessmentAgent produces the `OPS[eventId]` object:

```json
{
  "agentId": "impact-assessment",
  "eventId": "monsoon",
  "computedAt": "2026-02-11T06:15:00Z",
  "basis": "Airline exposure data cross-referenced with published schedules.",
  "airports": [
    {
      "iata": "BLR",
      "name": "Bengaluru",
      "role": "Affected",
      "movements": 200,
      "window": "10h",
      "exposure": 84,
      "note": "Deepening low-pressure system tracking toward the southeast coast. Heavy rain and low-level wind shear forecast over BLR approach corridors through the evening bank."
    },
    {
      "iata": "MAA",
      "name": "Chennai",
      "role": "Affected",
      "movements": 180,
      "window": "10h",
      "exposure": 82,
      "note": "Heavy rain and wind shear forecast over Chennai approach corridors."
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
      "exposureScore": 87,
      "note": "Direct exposure through BLR hub operations. 18 departures in the forecast window, concentrated in Bank 3 evening feed.",
      "drivers": {
        "hubFactor": 1.5,
        "movementShareFactor": 1.2,
        "fleetCapabilityFactor": 1.0,
        "bankOverlapFactor": 1.2,
        "overflightFactor": 1.0
      }
    },
    {
      "name": "IndiConnect Airways",
      "code": "IC",
      "hub": "DEL",
      "daily": 210,
      "netShare": 15,
      "airports": "BLR · MAA",
      "exposure": "Moderate",
      "exposureScore": 52,
      "note": "Secondary exposure through BLR/MAA outstation operations. 6 departures in the forecast window.",
      "drivers": {
        "hubFactor": 0.5,
        "movementShareFactor": 0.3,
        "fleetCapabilityFactor": 1.0,
        "bankOverlapFactor": 0.8,
        "overflightFactor": 1.0
      }
    }
  ],
  "airlineScores": {
    "namma": 87,
    "eva": 22,
    "ica": 52
  },
  "overflightExposure": []
}
```

For an overflight event (e.g., Gulf airspace restriction):

```json
{
  "agentId": "impact-assessment",
  "eventId": "gulf",
  "airports": [
    {
      "iata": "DXB",
      "name": "Dubai",
      "role": "Affected",
      "movements": 200,
      "window": "2d",
      "exposure": 62,
      "note": "Reserved airspace block narrows the standard overflight routing."
    },
    {
      "iata": "LHR",
      "name": "London Heathrow",
      "role": "Affected",
      "movements": 180,
      "window": "2d",
      "exposure": 60,
      "note": "Westbound long-haul sectors rerouted around the restricted block."
    }
  ],
  "airlines": [
    {
      "name": "Namma Air",
      "code": "N7",
      "hub": "BLR",
      "daily": 180,
      "netShare": 0,
      "airports": "DXB · LHR",
      "exposure": "High",
      "exposureScore": 55,
      "note": "No Gulf destination in the restricted block — but BLR–LHR A350 sectors route through the Gulf corridor. Invisible exposure.",
      "drivers": {
        "hubFactor": 0.8,
        "movementShareFactor": 0.3,
        "fleetCapabilityFactor": 1.0,
        "bankOverlapFactor": 1.2,
        "overflightFactor": 1.3
      }
    }
  ],
  "airlineScores": {
    "namma": 55,
    "eva": 18,
    "ica": 12
  },
  "overflightExposure": [
    {
      "airline": "Namma Air",
      "code": "N7",
      "route": "BLR–LHR",
      "airspace": "Gulf corridor",
      "impact": "Extended block time, payload review, crew duty implications"
    }
  ]
}
```

### 7.5.7 Trigger Model

The ImpactAssessmentAgent is **event-driven**, not polling. It is triggered by:

| Trigger | When | Action |
|---|---|---|
| `event.created` | A new candidate event passes scoring (EDPS ≥ 30) | Compute OPS for the new event |
| `event.updated` | An existing event's EDPS changes by ≥ 5 points, or its geo/time window changes | Recompute OPS |
| `event.escalated` | An event crosses a score band boundary (e.g., Moderate → High) | Recompute OPS + flag for airline solver re-intersection |
| `schedule.updated` | Published schedule changes for an airport with an active event | Recompute OPS for affected events |

### 7.5.8 Airline Registry

The agent uses an internal airline registry (derived from `airlines.js` in the PoC) to know each airline's hub, secondary hub, fleet, daily departures, and network share per airport. This is public configuration data, not confidential operational data.

```json
{
  "airlines": [
    {
      "key": "namma",
      "name": "Namma Air",
      "code": "N7",
      "hub": "BLR",
      "secondaryHub": "DEL",
      "hubs": ["BLR", "DEL"],
      "dailyDepartures": 180,
      "fleet": ["A320neo", "A321neo", "A350-900"],
      "networkShare": { "BLR": 50, "DEL": 15, "MAA": 12, "BOM": 8 },
      "bankStructure": [
        { "id": "b1", "window": "05:30–08:30", "sensitivity": "low" },
        { "id": "b2", "window": "11:00–14:00", "sensitivity": "medium" },
        { "id": "b3", "window": "17:00–20:00", "sensitivity": "critical" },
        { "id": "b4", "window": "22:00–01:00", "sensitivity": "high" }
      ],
      "fleetCapabilities": {
        "cat3Count": 14,
        "cat3Total": 20,
        "etops": true
      }
    }
  ]
}
```

### 7.5.9 Relationship to the Airline Solver

The ImpactAssessmentAgent produces the **public exposure view** — what any analyst can see from published schedules. The airline solver produces the **confidential exposure view** — what only the airline's OCC can see from their internal data.

| What | ImpactAssessmentAgent (public) | Airline solver (confidential) |
|---|---|---|
| Movements in window | ✅ From published schedules | ✅ From actual flight plan |
| Tails affected | ❌ Not available | ✅ From tail assignments |
| Crew pairings at risk | ❌ Not available | ✅ From crew roster |
| Connecting passengers | ❌ Not available | ✅ From booking data |
| Projected cost | ❌ Not available | ✅ From cost parameters |
| Exposure score | Preliminary (public approximation) | Refined (confidential intersection) |
| Five-tier breakdown | ❌ Not available | ✅ Tier 0–4 intersection |

The preliminary `airlineScores` from this agent are replaced by the airline solver's refined scores when the airline responds to the intersection trigger. If the airline solver is offline or hasn't responded, the public approximation is shown with a "preliminary" indicator.

---

## 8. Agent Instance Inventory

The full list of 28 active agent instances:

| Agent ID | Type | Region | Sub-region | Priority |
|---|---|---|---|---|
| `weather-R1-southIndia` | weather | R1 | South India | critical |
| `weather-R1-northIndia` | weather | R1 | North India | critical |
| `weather-R1-westIndia` | weather | R1 | West India | critical |
| `weather-R1-eastIndia` | weather | R1 | East India | high |
| `weather-R1-bayOfBengal` | weather | R1 | Bay of Bengal | high |
| `weather-R2-centralEurope` | weather | R2 | Central Europe | critical |
| `weather-R2-westernEurope` | weather | R2 | Western Europe | critical |
| `weather-R2-northernEurope` | weather | R2 | Northern Europe | high |
| `weather-R3-gulfStates` | weather | R3 | Gulf States | high |
| `atc-R1-southIndia` | atc | R1 | South India | critical |
| `atc-R1-northIndia` | atc | R1 | North India | critical |
| `atc-R2-centralEurope` | atc | R2 | Central Europe | critical |
| `atc-R2-westernEurope` | atc | R2 | Western Europe | critical |
| `atc-R3-gulfStates` | atc | R3 | Gulf States | high |
| `atc-R5-britishIsles` | atc | R5 | British Isles | high |
| `industrial-R1-northIndia` | industrial | R1 | North India | high |
| `industrial-R2-centralEurope` | industrial | R2 | Central Europe | critical |
| `industrial-R2-westernEurope` | industrial | R2 | Western Europe | high |
| `geopolitical-R3-overflight` | geopolitical | R3 | Overflight Corridor | critical |
| `geopolitical-R2-westernEurope` | geopolitical | R2 | Western Europe | high |
| `geopolitical-R1-southIndia` | geopolitical | R1 | South India | standard |
| `infrastructure-R1-southIndia` | infrastructure | R1 | South India | critical |
| `infrastructure-R2-centralEurope` | infrastructure | R2 | Central Europe | high |
| `infrastructure-R2-westernEurope` | infrastructure | R2 | Western Europe | high |
| `regulatory-R1-northIndia` | regulatory | R1 | North India | high |
| `regulatory-R2-centralEurope` | regulatory | R2 | Central Europe | high |
| `regulatory-R3-gulfStates` | regulatory | R3 | Gulf States | standard |
| `regulatory-R5-britishIsles` | regulatory | R5 | British Isles | standard |

---

## 9. Relationship to Existing Data Model

The agent fleet produces the **global data layer** (`dm-data.json` equivalent). It does **not** produce airline-specific data — that remains inside each airline's solver (the five-tier intersection model). The boundary is:

```
Intelligence agents (28 instances, 6 types)
    │
    ▼ produce signals
Correlation & Scoring Engine (steps 1–7)
    │
    ▼ produces
EVENTS[] + EVENT_GEO[]  (global, public-source, scored)
    │
    ▼ triggers
ImpactAssessmentAgent (event-driven)
    │
    │ pulls published schedules for affected airports
    │ computes per-airport + per-airline exposure
    ▼ produces
OPS[]  (global, public-source, schedule-based exposure)
    │
    ▼ attaches to EVENTS + triggers
Airline solver (per airline, confidential)
    │
    ▼ returns
THREATS[] + EXPOSURE{}  (airline-specific, five-tier)
```

This preserves the two-lens model from the Technical Design: the global view is fed by intelligence agents + the ImpactAssessmentAgent, the airline view is fed by the airline solver intersecting the trigger with confidential operational data. The ImpactAssessmentAgent bridges the gap — it computes what any analyst can see from public schedules, before the airline solver refines it with confidential data.

---

*This document describes the production agent design for the DisruptionMatrix platform. All airline names, codes, and routes are fictional.*
