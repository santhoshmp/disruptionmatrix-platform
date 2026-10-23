# DisruptionMatrix — Product Summary
*Prepared for senior management briefing · [date]*

---

## 1. The Problem

Aviation operations are disrupted by events that are **easy to see coming but hard to see together.**

Today, the signals that predict disruption are scattered across dozens of disconnected feeds:

- Weather advisories live in NOAA and meteorological APIs
- Airspace closures and conflict-zone risk live in advisory sites like SafeAirspace and FAA TFRs
- Strikes and geopolitical flashpoints surface first in news streams and social media
- Airport congestion and aircraft emergencies are visible only in live flight-tracking data
- Earthquakes and natural events sit in separate scientific feeds

Operations teams must monitor each of these manually, judge severity by feel, and translate "a storm over the Gulf" into "what does this do to *our* flights, crews, and passengers" — under time pressure, with no shared system of record.

**The result:** late awareness, inconsistent prioritisation, duplicated effort, and no audit trail explaining *why* a threat was rated critical. Recent real-world examples detected by the system — a Saudi airspace "Do Not Fly" advisory, Gulf airport fog, Central Asian thunderstorms — would each have required watching a different source by hand.

---

## 2. The Vision

> **One screen that watches the world, scores every threat the same way, and tells you what it will cost your operation — before it happens.**

Three principles drive the product:

1. **Global coverage, continuously.** Every major aviation region is watched 24/7 by autonomous agents — no manual polling, no blind spots.
2. **Explainable scoring, not black boxes.** Every threat score decomposes into named factors with visible weights, so a Level 4 means the same thing to every user and can be defended to an auditor.
3. **Operational truth, not headlines.** A threat isn't "news" — it's a quantified impact on flights, crew, cargo, and passengers at specific airports for specific airlines.

---

## 3. The Product

**DisruptionMatrix** is a real-time aviation threat-intelligence platform. Autonomous monitoring agents collect signals from global data sources, a processing pipeline correlates them into threat events, scores each on a transparent weighted model, and quantifies the operational impact — presented on a prioritised threat board, a world map, and deep-dive profiling views.

### What the user sees

| Screen | Purpose |
|---|---|
| **Threat Board** | Prioritised list of active threats with score, escalation level, affected airports/regions |
| **World Map** | Global geographic distribution of live events |
| **Threat Profiling** | Deep analysis of an event — evidence, causal chain, progress + logs, cancellable runs |
| **Sources** | Provenance of every data object + live source health + pipeline activity |
| **Agent Engine** | The agent fleet: status, poll intervals, stalled-agent alerts, signal feed |
| **Regions** | Regional threat profiles, coverage, on-demand airspace risk checks |
| **Admin** | Tunable scoring weights, bands, lifecycle rules, LLM setup |
| **Master Data** | The single governed source for airports, airlines, regions, hazards, scoring tables |
| **How It Works** | Built-in user guide — sources, scoring, impact model — readable by non-technical staff |

---

## 4. The Solution — How It Works

### 4.1 Agent fleet (the sensors)

- **156 polling agents** organised across **9 regions and 26 sub-regions** covering **117 airports, 72 airlines, 74 countries** — from North America and Europe through the Middle East, Russia/CIS, China, South and Southeast Asia to Oceania.
- Each agent polls its assigned sources on its own interval (2–60 minutes depending on data volatility).
- Stalled-agent detection is interval-aware — the fleet self-monitors and surfaces problems on the Agent Engine dashboard.

### 4.2 Data sources (the inputs)

**13 integrated sources** across four trust tiers:

| Tier | Sources | Role |
|---|---|---|
| Official APIs | NOAA weather, USGS earthquakes, FAA status & airspace, NASA EONET, Open-Meteo | Highest-credibility signals |
| Aviation providers | adsb.lol, OpenSky, AirLabs, AviationStack | Live positions, ground activity, emergency squawks, schedules |
| News & advisories | GDELT, SafeAirspace | Geopolitical, industrial action, airspace risk |
| Social | Reddit | Corroboration only — never creates threats alone |

Every source has a **documented provenance chain** (visible in Sources → Provenance), live health checks, and clearly labelled fallback/mock modes — the system never silently invents data.

### 4.3 The pipeline (the reasoning)

Runs automatically every ~10 seconds on new signals:

1. **Correlate** — group signals about the same real-world condition; merge duplicates across runs
2. **Score** — compute the EDPS score (below)
3. **Impact** — assess exposure across 9 operational domains
4. **Enrich** — attach evidence, measurements, causal chain (cause → effect → consequence)
5. **Publish** — update the board, map, and subscribers in real time

### 4.4 The scoring model (the judgment) — EDPS

Every event gets a transparent **0–100 score** from eight weighted factors:

```
score = Σ (factor value × factor weight) ÷ Σ active weights
```

| Factor | Weight | What it captures |
|---|---|---|
| Probability of occurrence | 18% | Corroboration + forecast confidence |
| Severity if realised | 18% | Hazard defaults adjusted by observed magnitude |
| Time to impact | 14% | How soon operations feel it |
| Geographic reach | 12% | Airports/area affected |
| Expected duration | 12% | How long it lasts |
| Escalation rate | 10% | Worsening vs improving |
| Source credibility | 10% | Trust tier of the reporting source |
| Prediction confidence | 6% | Agreement between sources |

Scores map to bands: **L4 Critical (80+), L3 High (65–79), L2 Moderate (45–64), L1 Low (<45)**.

**Why this matters for management:** the score is auditable and tunable — every factor's weight is editable in Admin, factors can be disabled (score auto-renormalises), and every event's breakdown shows *why* it scored what it did. No hidden algorithm.

### 4.5 Operational impact (the answer to "so what")

Beyond severity, each event is assessed across **9 operational domains** — flight schedule, crew, aircraft rotations, airport ops, passengers, cargo, catering, maintenance, regulatory — using category-specific domain profiles, plus airport/airline exposure counts from master data. This is what turns "thunderstorm, level 57" into "expect delays at ALA, ~40 scheduled movements affected."

### 4.6 Lifecycle and trust

- Events **auto-archive** when stale (configurable: default 72h no-fresh-signals, 10-day hard cap) — the board always reflects *now*
- **Threat profiling** runs as a supervised job: queued → running → complete, with visible progress/logs and user cancellation
- **The How It Works guide** explains the entire system in plain language inside the app

---

## 5. Scale achieved (as built today)

| Metric | Value |
|---|---|
| Monitoring agents | 156 |
| Integrated sources | 13 |
| Regions / sub-regions | 9 / 26 |
| Airports covered | 117 |
| Airlines | 72 |
| Countries under watch | 74 |
| Hazard types recognised | 36 |
| Signals processed | ~390,000 |
| Pipeline latency | ~100 ms per run, every 10 s |

**Real detections already proven:** Saudi Arabia / Russia / Sudan / Lebanon airspace "Do Not Fly" advisories (SafeAirspace), Gulf fog events (live METAR), Central Asian thunderstorm forecasts, aircraft emergency squawks near monitored airports (7700 alerts via adsb.lol).

---

## 6. What makes it different

| Conventional approach | DisruptionMatrix |
|---|---|
| Analysts check feeds manually | Agents watch continuously, globally |
| Gut-feel severity | Transparent 8-factor weighted score, auditable per event |
| "There's weather in the Gulf" | Quantified impact across 9 ops domains at named airports |
| Alerts without provenance | Every value traces to a source tier; mock/fallback is labelled |
| Static configuration | Admin-tunable weights, bands, lifecycle — no redeploy |

---

## 7. Roadmap candidates

- **NOTAM integration** — timestamped closure notices (the one gap vs. advisory-level airspace data today)
- **Schedule provider key** — AirLabs key activates real delay/cancellation data vs. fallback
- **LLM-assisted profiling** — deeper narrative analysis of events (provider-agnostic, already configurable)
- **Alerting channels** — push notifications / webhooks on escalation-level transitions

---

*Numbers verified live against the running system. Internal architecture, factor definitions, and user guide are available in-app under "How It Works".*
