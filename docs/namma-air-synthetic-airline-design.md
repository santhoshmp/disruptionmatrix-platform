# Namma Air — Synthetic Airline Design for the DisruptionMatrix PoC

*All names, codes, routes and figures are fictional and created for demonstration purposes only. Airline codes shown are not allocated references.*

---

## 1. Airline profile

| Attribute | Value |
|---|---|
| Name | Namma Air (synthetic) |
| Codes | IATA **N7** · ICAO **NMA** · Callsign **NAMMA** (fictional) |
| Home base / hub | Bengaluru Kempegowda International (BLR) |
| Secondary station | Delhi (DEL) — crew sub-base and overnight line maintenance |
| Business model | Full-service hub carrier: domestic feed at BLR connecting to international departures |
| Fleet | 30 aircraft — 24 × A320neo family, 6 × A350-900 |
| Daily departures | ~152 (144 narrowbody sectors, ~8 widebody sectors) |
| Employees (ops-relevant) | ~380 pilots, ~940 cabin crew, OCC of 42 staff at BLR |

## 2. Fleet

| Sub-fleet | Count | Seats | Capability notes relevant to threat assessment |
|---|---|---|---|
| A320neo | 20 | 174 (8J/166Y) | 14 aircraft CAT IIIB capable, 6 CAT I only — matters for DEL winter fog |
| A321neo | 4 | 218 (12J/206Y) | Used on trunk domestic + Gulf; gauge-swap reserve for heavy loads |
| A350-900 | 6 | 316 (36J/280Y) | Long-haul; ETOPS 370; all CAT IIIB; 2 crews per ultra-long-haul rotation |

Spare capacity policy: one A320neo held as operational spare at BLR from 06:00–22:00; no widebody spare (A350 recovery depends on schedule padding and crew re-pairing — a deliberate vulnerability that makes demo scenarios interesting).

## 3. Network

**Domestic (18 destinations, A320 family):** DEL, BOM, HYD, MAA, CCU, GOX, COK, TRV, PNQ, AMD, JAI, LKO, IXC, GAU, VTZ, IXE, HBX, VNS.
Trunk frequencies: BLR–DEL 6×/day, BLR–BOM 5×/day, BLR–HYD 4×/day, BLR–MAA 4×/day.

**International narrowbody (8 destinations):** DXB (2×/day), AUH, MCT, SIN (2×/day), KUL, BKK, CMB, DAC.

**International widebody (A350):** LHR (daily), FRA (daily), SFO (3×/week, 2-crew ULR), SIN (daily, widebody on peak rotation).

**BLR bank structure (the airline's disruption-sensitive skeleton):**

| Bank | Local time | Content |
|---|---|---|
| Bank 1 | 05:30–08:30 | Domestic wave out; overnight long-haul arrivals (LHR/FRA) feed morning domestic |
| Bank 2 | 11:00–14:00 | Domestic rotation midday wave; Gulf departures |
| Bank 3 | 18:00–21:30 | Domestic wave in — feeds international departures |
| Bank 4 | 22:30–02:00 | Long-haul departures (LHR, FRA, SFO) + SIN red-eye |

The airline's principal fragility: Bank 3 → Bank 4 connectivity. Evening domestic delays cascade directly into long-haul misconnections, and there is no widebody spare.

**Overflight footprint (why remote events reach Namma Air):** westbound long-haul routes cross the Arabian Sea, Gulf, Iraqi/Turkish or Saudi/Egyptian corridors, and European airspace including French UIRs on LHR routings. Gulf airspace events, European ATC strikes and Middle East security NOTAMs all touch the airline without any Indian event occurring.

## 4. Dependencies (supplier & infrastructure map)

| Dependency | Detail | Threat relevance |
|---|---|---|
| Ground handling | Self-handled at BLR; third-party handlers at all outstations (single-handler exposure at LHR, FRA, DXB) | Handler industrial action maps only to airlines using that handler |
| Fuel | Single fuel farm at BLR (airport infrastructure) | Airport infrastructure incidents |
| Catering | One caterer at BLR for all departures | Local strike/food-safety event grounds long-haul catering |
| Line maintenance | BLR (full) + DEL (overnight A320 only); A350 checks only at BLR | A350 tech issue away from base = long recovery |
| De-icing | Not applicable in network except LHR/FRA winter | European winter storms |
| ATC/weather exposure | DEL winter fog (Dec–Jan), BOM monsoon (Jun–Sep), MAA/CCU cyclone season (Oct–Dec), BLR morning fog (rare) | Seasonal watchlist configuration |

## 5. Escalation & policy parameters (airline risk appetite)

| Parameter | Demo value |
|---|---|
| Escalation to VP NCC | ≥6 projected cancellations, or any hub-bank threat at BLR, or any multi-day event, or est. cost > ₹2.5 crore |
| Recovery priority order | 1. Long-haul departures · 2. Bank connectivity · 3. Trunk domestic OTP · 4. Point-to-point |
| Pre-cancellation doctrine | Thin domestic point-to-point first; protect BLR–DEL/BOM trunk; never pre-cancel long-haul without VP sign-off |
| Curfew constraints | SFO slot pair, LHR night quota, FRA night ban 23:00–05:00 local |
| Cost parameters (synthetic) | Delay ₹75,000/hr narrowbody · ₹2.6 lakh/hr widebody; cancellation ₹18 lakh domestic / ₹1.4 crore long-haul; DGCA + EU261 compensation regimes by route |

---

## 6. Data needed to work with the threat matrix

Organised in tiers by confidentiality. Tier 0 is computable from public data — DisruptionMatrix itself may hold it. Tiers 1–3 stay inside the airline's simulated solver; the solver receives the trigger and answers with intersections.

### Tier 0 — Public / schedule layer (exposure triage)

**T0.1 `flight_schedule`** — one row per scheduled flight
`flight_no, origin, destination, dep_time_utc, arr_time_utc, days_of_week, aircraft_type, bank_id`
→ Used to intersect trigger geography/time-window with operated flights and overflight corridors.

**T0.2 `fleet_capability`** — one row per sub-fleet
`aircraft_type, count, cat3_capable_count, etops, range_nm, seats`
→ Used to qualify weather/reroute severity (e.g. CAT I tails cannot hold DEL fog arrivals).

### Tier 1 — Aircraft & rotations (propagation)

**T1.1 `tail_assignment`** — one row per tail per day
`tail_id, aircraft_type, rotation_id, cat3_flag, maint_due_date`

**T1.2 `rotation_legs`** — one row per leg in tail order
`rotation_id, seq, flight_no, origin, destination, dep_utc, arr_utc, turn_minutes`
→ Used to trace how a delayed/cancelled leg displaces the rest of the day and the overnight position.

**T1.3 `maintenance_plan`** — `tail_id, check_type, location, start_utc, end_utc`
→ Removes tails from recovery options during the event window.

### Tier 2 — Crew (the binding constraint)

**T2.1 `crew_pairing`** — `pairing_id, base, fleet, legs[], report_utc, release_utc, duty_margin_minutes`
→ `duty_margin_minutes` is the key field: how much delay each pairing can absorb before it breaks.

**T2.2 `standby_coverage`** — `base, fleet, date, slots_am, slots_pm, slots_night`
→ Recovery capacity per base; note DEL sub-base has A320 crews only.

### Tier 3 — Passengers, cargo, commercial

**T3.1 `connection_loads`** — `inbound_flight, outbound_flight, pax_count, min_connect_ok_flag`
→ Converts bank disruption into misconnection counts (the Bank 3 → Bank 4 story).

**T3.2 `flight_loads`** — `flight_no, date, pax_booked, load_factor, premium_pax, special_service_count`

**T3.3 `cargo_commitments`** — `awb_group, flight_no, commodity_class (pharma/perishable/general), sla_hours`
→ BLR is a pharma-export hub; pharma cool-chain on LHR/FRA sectors raises severity of long-haul delay.

**T3.4 `rebooking_capacity`** — `market, own_alternatives_per_day, interline_options_flag`

### Tier 4 — Dependencies & policy (threat → response mapping)

**T4.1 `station_dependencies`** — `airport, handler, caterer, fuel_supplier, deice_provider, alternate_airports[]`
→ The join key for supplier-strike triggers: a handler event only matters where `handler` matches.

**T4.2 `escalation_thresholds`** — the Section 5 table in machine-readable form
`metric, threshold_value, escalation_level`

**T4.3 `cost_parameters`** — `cost_type, aircraft_class, value_inr`
→ Lets the solver express projected impact in money, which is what crosses the VP's desk.

### How the demo flow uses these tiers

Trigger arrives (e.g. *DEL dense fog, CAT IIIB conditions forecast 22:00–09:00 IST, score 74, escalating*) → solver intersects T0.1 (12 DEL movements in window) → T1 (3 rotations overnight in DEL, one CAT I tail exposed) → T2 (2 pairings with <45 min duty margin) → T3 (Bank 1 feed carries 480 connecting passengers incl. LHR) → T4 (thresholds: 6+ cancellations projected → VP escalation; cost estimate attached). Output: an airline-specific exposure report generated from a public trigger, with zero confidential data leaving the airline.

## 7. Suggested demo event set for Namma Air

| Event (synthetic) | Category | Why it suits this airline |
|---|---|---|
| DEL winter fog episode | Severe weather | CAT I vs CAT IIIB sub-fleet split makes exposure non-obvious |
| Cyclone approaching MAA/east coast | Severe weather | Multi-airport regional impact + cargo |
| BLR fuel-farm contamination alert | Infrastructure | Hub single-point-of-failure |
| Gulf airspace restriction | Geopolitical | Hits DXB/AUH/MCT flights + all westbound long-haul overflights |
| LHR ground-handler strike ballot | Industrial action | Single-handler dependency at LHR (T4.1 join) |
| French ATC strike | Industrial action | No French destination — yet LHR routings cross French UIRs: the "invisible exposure" story |
| DGCA winter-schedule fog directive | Regulatory | CAT III crew/aircraft compliance requirement on DEL routes |

---

*Next step: generate the actual synthetic tables (CSV/JSON) for a chosen demo date, sized to these specs, plus 2–3 scripted trigger JSONs so the simulated solver walk-through can run live.*
