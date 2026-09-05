# Fictional Airline Profiles — DisruptionMatrix PoC

*All names, codes, routes and figures are fictional and created for demonstration purposes only. Airline codes shown are not allocated references.*

This document profiles the fictional airlines used in the DisruptionMatrix proof-of-concept, their fleet, network, crew, operational parameters, and interconnection model.

---

## Table of Contents

1. [Namma Air](#1-namma-air)
2. [EuroVista Airways](#2-eurovista-airways)
3. [IndiConnect Airways](#3-indiconnect-airways)
4. [Alpine Connect Airways](#4-alpine-connect-airways)
5. [Western India Airways](#5-western-india-airways)
6. [Interconnection Model](#6-interconnection-model)
7. [Fictional Airline Ecosystem](#7-fictional-airline-ecosystem)

---

## 1. Namma Air

### 1.1 Airline Profile

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

### 1.2 Fleet

| Sub-fleet | Count | Seats | Capability notes relevant to threat assessment |
|---|---|---|---|
| A320neo | 20 | 174 (8J/166Y) | 14 aircraft CAT IIIB capable, 6 CAT I only — matters for DEL winter fog |
| A321neo | 4 | 218 (12J/206Y) | Used on trunk domestic + Gulf; gauge-swap reserve for heavy loads |
| A350-900 | 6 | 316 (36J/280Y) | Long-haul; ETOPS 370; all CAT IIIB; 2 crews per ultra-long-haul rotation |

Spare capacity policy: one A320neo held as operational spare at BLR from 06:00–22:00; no widebody spare (A350 recovery depends on schedule padding and crew re-pairing — a deliberate vulnerability that makes demo scenarios interesting).

### 1.3 Network

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

### 1.4 Dependencies (supplier & infrastructure map)

| Dependency | Detail | Threat relevance |
|---|---|---|
| Ground handling | Self-handled at BLR; third-party handlers at all outstations (single-handler exposure at LHR, FRA, DXB) | Handler industrial action maps only to airlines using that handler |
| Fuel | Single fuel farm at BLR (airport infrastructure) | Airport infrastructure incidents |
| Catering | One caterer at BLR for all departures | Local strike/food-safety event grounds long-haul catering |
| Line maintenance | BLR (full) + DEL (overnight A320 only); A350 checks only at BLR | A350 tech issue away from base = long recovery |
| De-icing | Not applicable in network except LHR/FRA winter | European winter storms |
| ATC/weather exposure | DEL winter fog (Dec–Jan), BOM monsoon (Jun–Sep), MAA/CCU cyclone season (Oct–Dec), BLR morning fog (rare) | Seasonal watchlist configuration |

### 1.5 Escalation & policy parameters (airline risk appetite)

| Parameter | Demo value |
|---|---|
| Escalation to VP NCC | ≥6 projected cancellations, or any hub-bank threat at BLR, or any multi-day event, or est. cost > ₹2.5 crore |
| Recovery priority order | 1. Long-haul departures · 2. Bank connectivity · 3. Trunk domestic OTP · 4. Point-to-point |
| Pre-cancellation doctrine | Thin domestic point-to-point first; protect BLR–DEL/BOM trunk; never pre-cancel long-haul without VP sign-off |
| Curfew constraints | SFO slot pair, LHR night quota, FRA night ban 23:00–05:00 local |
| Cost parameters (synthetic) | Delay ₹75,000/hr narrowbody · ₹2.6 lakh/hr widebody; cancellation ₹18 lakh domestic / ₹1.4 crore long-haul; DGCA + EU261 compensation regimes by route |

---

## 2. EuroVista Airways

*"Connecting Europe Intelligently"*

A medium-sized European airline based in Central Europe, operating a hub-and-spoke network with strong intra-European connectivity.

### 2.1 Airline Profile

| Field | Value |
|---|---|
| Airline Name | EuroVista Airways |
| IATA Code | EV (fictional PoC code) |
| ICAO Code | EVA (fictional) |
| Callsign | EUROVISTA |
| Headquarters | Vienna, Austria |
| Primary Hub | Vienna International Airport (VIE) |
| Secondary Bases | Munich (MUC), Zurich (ZRH), Prague (PRG) |
| Business Model | Hybrid full-service / network carrier |

The airline operates: European point-to-point services, hub-and-spoke connectivity, selected medium-haul routes, codeshare/interline services, and limited long-haul connectivity through partner airlines.

### 2.2 Fleet

A realistic fleet of approximately **38 aircraft**.

| Segment | Fleet | Typical Routes / Use |
|---|---|---|
| Narrow-body | 12 × Airbus A320neo | Vienna–Frankfurt, Vienna–Paris, Vienna–Amsterdam, Vienna–Rome, Vienna–Madrid |
| Regional | 18 × Embraer E190/E195 | Prague, Zurich, Geneva, Brussels, Copenhagen, Warsaw, Budapest, Milan |
| Longer-range / medium-haul | 8 × Airbus A321neo / A321LR | Istanbul, Dubai, selected Middle East destinations, high-density European routes |

### 2.3 Network

**Primary European network**

```
                COPENHAGEN
                    │
                    │
AMSTERDAM ─── FRANKFURT ─── WARSAW
    │                           │
    │                           │
  PARIS ─── ZURICH ─── VIENNA ─── BUDAPEST
    │                           │
    │                           │
  GENEVA                      PRAGUE
                    │
                    │
                  ROME
```

**Medium-haul connectivity**

```
                EUROPE
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      DUBAI    ISTANBUL    DELHI
```

*The Delhi connection is important — it creates the interconnection with the Indian airline.*

### 2.4 Operational Profile

| Metric | Value |
|---|---|
| Flights per day | ~160 |
| Passengers annually | ~8 million |
| Average load factor | ~82% |

**Primary operating model**

```
European Feeder Flights
        │
        ▼
    Vienna Hub
        │
        ▼
European / Medium-haul Connections
```

### 2.5 Key Disruption-Sensitive Airports

| Airport | Sensitivity |
|---|---|
| VIE | Hub concentration |
| FRA | ATFM congestion |
| MUC | Weather and capacity |
| AMS | ATFM/network congestion |
| ZRH | Weather |
| GVA | Weather |
| CDG | Network congestion |

*This makes EuroVista well suited to the EUROCONTROL scenario.*

---

## 3. IndiConnect Airways

*"Connecting India to the World"*

A fictional medium-sized Indian hybrid/network carrier — enough complexity to demonstrate disruption propagation while remaining manageable for a PoC.

### 3.1 Airline Profile

| Field | Value |
|---|---|
| Airline Name | IndiConnect Airways |
| IATA Code | IC (fictional PoC code) |
| ICAO Code | INC (fictional) |
| Callsign | INDICONNECT |
| Headquarters | New Delhi |
| Primary Hub | Delhi — Indira Gandhi International Airport (DEL) |
| Secondary Hubs | Mumbai (BOM), Bengaluru (BLR) |
| Focus Cities | Hyderabad (HYD), Chennai (MAA), Kochi (COK) |

### 3.2 Fleet

Approximately **42 aircraft**.

| Segment | Fleet | Typical Use |
|---|---|---|
| Domestic narrow-body | 28 × Airbus A320neo | DEL–BOM, DEL–BLR, DEL–HYD, DEL–MAA, BOM–BLR, BOM–COK |
| Regional | 8 × ATR 72 | Jaipur, Lucknow, Chandigarh, Ahmedabad, Goa, smaller regional airports |
| International | 6 × Airbus A321neo / A321XLR | Dubai, Abu Dhabi, Singapore, Bangkok, Vienna, Istanbul |

### 3.3 Network

**Domestic network**

```
                DELHI
              /   |   \
             /    |    \
       MUMBAI    BLR   LUCKNOW
          │        │
          │        │
         HYD ───── CHENNAI
                     │
                     │
                   KOCHI
```

**International connectivity**

```
                DELHI
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
      DUBAI    VIENNA    SINGAPORE
        │         │
        │         │
   ABU DHABI   EuroVista
```

### 3.4 Operational Profile

| Metric | Value |
|---|---|
| Flights per day | ~210 |
| Passengers annually | ~11 million |

**Primary disruption-sensitive airports**

| Airport | Sensitivity |
|---|---|
| DEL | Fog and severe weather |
| BOM | Monsoon disruption |
| BLR | Thunderstorms |
| HYD | Thunderstorms |
| COK | Monsoon |
| DXB | Network congestion/weather |

*This gives a disruption environment that is completely different from the European carrier.*

---

## 4. Alpine Connect Airways

### 4.1 Company Overview

| Field | Value |
|---|---|
| Airline Name | Alpine Connect Airways |
| ICAO Code | ACA |
| IATA Code | AC (fictional for example purposes) |
| Call Sign | ALPINE CONNECT |
| Headquarters | Geneva, Switzerland |
| Main Hub | Geneva Airport (LSGG) |
| Secondary Base | Zurich Airport (LSZH) |
| Business Model | Regional scheduled carrier |
| Operating Certificate | European AOC (fictional) |
| Ownership | Private |

### 4.2 Fleet

| Aircraft Type | Quantity | Seats |
|---|---|---|
| Airbus A320-200 | 5 | 180 |

**Fleet tail numbers:** HB-ACA, HB-ACB, HB-ACC, HB-ACD, HB-ACE

**Average fleet age:** 8 years

### 4.3 Route Network — Daily Scheduled Destinations

| From | To | Flights per Day |
|---|---|---|
| Geneva | London Gatwick | 3 |
| Geneva | Barcelona | 2 |
| Geneva | Rome Fiumicino | 2 |
| Geneva | Lisbon | 1 |
| Geneva | Athens | 1 |
| Zurich | Madrid | 1 |
| Zurich | Amsterdam | 2 |
| Zurich | Prague | 2 |
| Zurich | Vienna | 2 |

**Daily flight sectors:**
- Approximately 26 sectors/day
- Average flight duration: 2.2 hours
- Aircraft utilization: 10–11 block hours/day

### 4.4 Crew Population

**Flight crew**

| Crew Type | Quantity |
|---|---|
| Captains | 45 |
| First Officers | 45 |
| **Total Pilots** | **90** |

**Cabin crew**

| Crew Type | Quantity |
|---|---|
| Cabin Crew Members | 110 |
| Cabin Managers | 20 |
| **Total Cabin Crew** | **130** |

**Crew per flight** — each A320 flight requires: 1 Captain, 1 First Officer, 4 Cabin Crew

### 4.5 Operations Department

| Role | Headcount |
|---|---|
| Flight Dispatchers | 12 |
| Crew Controllers | 8 |
| OCC Managers | 2 |
| Maintenance Controllers | 5 |
| Crew Schedulers | 6 |
| **Total OCC Staff** | **33** |

### 4.6 Crew Scheduling Rules

**Pilot constraints**
- Maximum duty period: 13 hours
- Minimum rest period: 12 hours
- Maximum flight hours: 100 hours in 28 days / 900 hours per year

**Cabin crew constraints**
- Maximum duty: 12 hours
- Minimum rest: 12 hours
- Maximum 6 consecutive working days

### 4.7 Training Requirements

**Pilots:** A320 Type Rating · Annual Simulator Check · Recurrent Training Every 6 Months · Dangerous Goods Certification · CRM Training

**Cabin crew:** Annual Safety Training · First Aid Certification · Emergency Evacuation Training · CRM Training

### 4.8 Example Monthly Activity

| Metric | Value |
|---|---|
| Flights Operated | 780 |
| Passengers Carried | 130,000 |
| Load Factor | 84% |
| On-Time Performance | 87% |
| Schedule Completion | 99% |

### 4.9 Crew Bases

**Geneva Base:** 60 Pilots, 85 Cabin Crew
**Zurich Base:** 30 Pilots, 45 Cabin Crew

### 4.10 Example Software Landscape

| Function | Software |
|---|---|
| Crew Scheduling | Jeppesen Crew Rostering |
| Crew Tracking | Jeppesen Crew Tracking |
| Flight Planning | Lido Flight |
| Operations Control | Sabre AirCentre Ops |
| Maintenance | AMOS |
| HR/Payroll | SAP SuccessFactors |

### 4.11 Typical Challenges
- Last-minute pilot sickness
- Weather disruptions in winter
- Crew legality management
- Training event scheduling
- Aircraft maintenance impacts
- Reserve crew coverage optimization

> This profile is realistic for a European airline operating 5 Airbus A320 aircraft, ~220 employees, and about 25–30 scheduled flights per day, making it suitable for crew scheduling, disruption management, or airline operations system demonstrations.

---

## 5. Western India Airways

### 5.1 Company Overview

| Field | Value |
|---|---|
| Airline Name | Western India Airways |
| ICAO Code | WIA (fictional) |
| IATA Code | WI (fictional) |
| Call Sign | WESTERN INDIA |
| Headquarters | Mumbai, Maharashtra, India |
| Main Hub | Chhatrapati Shivaji Maharaj International Airport (BOM/VABB) |
| Secondary Hub | Delhi Indira Gandhi International Airport (DEL/VIDP) |
| International Focus Cities | Bengaluru (BLR), Hyderabad (HYD) |
| Business Model | Full-Service International Carrier |
| Ownership | Private |
| Alliance Status | Independent (codeshare partnerships) |
| AOC | Indian Scheduled Air Operator Certificate |

### 5.2 Fleet

**Narrowbody**

| Aircraft Type | Quantity | Seats |
|---|---|---|
| Airbus A320neo | 12 | 186 |

**Widebody**

| Aircraft Type | Quantity | Seats |
|---|---|---|
| Airbus A350-900 | 8 | 315 |

**Total fleet:** 20 aircraft
**Average fleet age:** 4.5 years

**Aircraft registrations**

- A320neo: VT-WIA, VT-WIB, VT-WIC, VT-WID, VT-WIE, VT-WIF, VT-WIG, VT-WIH, VT-WII, VT-WIJ, VT-WIK, VT-WIL
- A350-900: VT-WMA, VT-WMB, VT-WMC, VT-WMD, VT-WME, VT-WMF, VT-WMG, VT-WMH

### 5.3 Route Network

**Domestic network**

| From | To | Daily Flights |
|---|---|---|
| Mumbai | Delhi | 6 |
| Mumbai | Bengaluru | 5 |
| Mumbai | Hyderabad | 4 |
| Mumbai | Chennai | 4 |
| Mumbai | Kolkata | 3 |
| Mumbai | Ahmedabad | 4 |
| Mumbai | Goa | 3 |
| Delhi | Bengaluru | 4 |
| Delhi | Hyderabad | 3 |

**International regional routes — Middle East**

| Route | Frequency |
|---|---|
| Mumbai – Dubai | 3 Daily |
| Mumbai – Abu Dhabi | Daily |
| Mumbai – Doha | Daily |
| Mumbai – Muscat | Daily |
| Delhi – Dubai | 2 Daily |
| Bengaluru – Dubai | Daily |

**International regional routes — Southeast Asia**

| Route | Frequency |
|---|---|
| Mumbai – Singapore | Daily |
| Delhi – Singapore | Daily |
| Mumbai – Bangkok | Daily |
| Mumbai – Kuala Lumpur | Daily |
| Delhi – Jakarta | 4 Weekly |

**International regional routes — East Asia**

| Route | Frequency |
|---|---|
| Mumbai – Hong Kong | Daily |
| Mumbai – Tokyo Narita | Daily |
| Delhi – Seoul Incheon | Daily |

**Intercontinental routes — Europe**

| Route | Frequency | Aircraft |
|---|---|---|
| Mumbai – London Heathrow | 2 Daily | A350 |
| Delhi – London Heathrow | Daily | A350 |
| Mumbai – Paris CDG | Daily | A350 |
| Mumbai – Frankfurt | Daily | A350 |
| Delhi – Amsterdam | Daily | A350 |
| Mumbai – Rome | 5 Weekly | A350 |

**Intercontinental routes — North America**

| Route | Frequency | Aircraft |
|---|---|---|
| Mumbai – New York JFK | Daily | A350 |
| Delhi – New York JFK | Daily | A350 |
| Mumbai – Toronto | Daily | A350 |
| Delhi – Toronto | 5 Weekly | A350 |
| Mumbai – Chicago | 4 Weekly | A350 |

**Intercontinental routes — Australia**

| Route | Frequency | Aircraft |
|---|---|---|
| Mumbai – Sydney | Daily | A350 |
| Delhi – Melbourne | Daily | A350 |
| Mumbai – Perth | 5 Weekly | A350 |

### 5.4 Operations

**Daily activity**

| Metric | Value |
|---|---|
| Aircraft Movements | 90–110 |
| Flights per Day | 50–60 |
| Monthly Flights | ~1,700 |
| Average Daily Passengers | ~22,000 |
| Aircraft Utilization | 13–15 block hours/day |

**Passenger statistics**

| Metric | Value |
|---|---|
| Annual Passengers | 9.5 million |
| Load Factor | 84% |
| On-Time Performance | 87% |
| Schedule Completion | 99.2% |

### 5.5 Flight Crew

**A320 fleet:** 120 Captains, 120 First Officers
**A350 fleet:** 80 Captains, 80 First Officers
**Total pilots:** 400

**Cabin crew:** 650 Cabin Crew, 90 Pursers/Senior Cabin Crew — **Total 740**

### 5.6 Crew Bases

- **Mumbai (Primary):** 250 Pilots, 450 Cabin Crew
- **Delhi:** 110 Pilots, 190 Cabin Crew
- **Bengaluru:** 40 Pilots, 50 Cabin Crew

### 5.7 Operations Control Center (Mumbai HQ)

| Function | Staff |
|---|---|
| Flight Dispatchers | 30 |
| Crew Controllers | 20 |
| Maintenance Controllers | 15 |
| Crew Planners | 15 |
| OCC Managers | 5 |
| **Total OCC Staff** | **85** |

### 5.8 Typical Crew Complement

| Flight Type | Flight Deck | Cabin | Total |
|---|---|---|---|
| Domestic A320 | 1 Captain, 1 First Officer | 5 Cabin Crew | 7 |
| Long-Haul A350 (Europe) | 2 Pilots | 10 Cabin Crew | 12 |
| Ultra Long-Haul (North America) | 4 Pilots (incl. relief crew) | 12 Cabin Crew | 16 |

### 5.9 Maintenance Organization

**Main maintenance base:** Mumbai (BOM) — Line Maintenance, A Checks, C Checks, Engine Change, Landing Gear Change, Composite Repairs, Cabin Modifications

**Secondary maintenance bases:** Delhi (DEL), Bengaluru (BLR)

**Overseas line stations:** London Heathrow, Dubai, Singapore, New York JFK, Toronto, Sydney

### 5.10 Technology Landscape

| Function | System |
|---|---|
| Crew Scheduling | Jeppesen Crew Rostering |
| Crew Tracking | Jeppesen Tracking |
| Flight Planning | Lido Flight Planning |
| OCC | Sabre AirCentre |
| Revenue Management | PROS |
| Maintenance | AMOS |
| Passenger Service System | Amadeus Altéa |
| HR & Payroll | SAP SuccessFactors |

### 5.11 Typical Operational Challenges
- Mumbai monsoon disruptions
- Long-haul crew fatigue management
- ETOPS compliance for transoceanic operations
- North Atlantic weather deviations
- Aircraft-on-Ground (AOG) events overseas
- Heathrow and JFK slot constraints
- Peak demand during Diwali and summer holidays
- Widebody maintenance planning
- International visa and crew documentation requirements

> Western India Airways (WIA) is a fictional Mumbai-based full-service international airline operating 20 aircraft (12 A320neos and 8 A350-900s) serving over 40 destinations across India, the Middle East, Asia, Europe, North America, and Australia. The airline carries approximately 9.5 million passengers annually and employs around 1,140 crew members, making it comparable in scale to a mid-sized international carrier.

---

## 6. Interconnection Model

The PoC airlines should not exist independently — they need realistic operational and commercial interconnections, at three levels.

### 6.1 Interline Agreement

EuroVista and IndiConnect have an interline agreement.

**Example passenger journey**

```
GENEVA
   │
   │  EuroVista EV412
   ▼
VIENNA
   │
   │  EuroVista EV901
   ▼
DELHI
   │
   │  IndiConnect IC234
   ▼
BENGALURU
```

*A disruption in Europe can therefore propagate into India.*

### 6.2 Codeshare Agreement

Selected routes are codeshared:

- EuroVista operates **VIE → DEL**, but IndiConnect sells it as part of its network.
- IndiConnect operates **DEL → BLR**, and EuroVista sells that connection.

This allows the PoC to demonstrate disruption intelligence across airline boundaries.

### 6.3 Reciprocal Disruption Information Sharing

For the PoC, a simulated **Disruption Data Sharing Agreement** is created. Both airlines share selected operational events — without exposing all internal operational data:

- Flight delays
- Cancellations
- Aircraft swaps
- Estimated arrival time changes
- Missed connection risks
- Airport disruptions

### 6.4 The Joint Network

```
EUROPE
AMS ─ FRA ─ MUC ─ VIE ─ ZRH
              │
              │
              │  EuroVista EV901
              ▼
            DELHI
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
   BOM       BLR        HYD
              │          │
              │          │
             COK        MAA

        INDICONNECT NETWORK
```

### 6.5 Why These Two Airlines Work Well for the PoC

**EuroVista provides — European disruption complexity:**
- EUROCONTROL / ATFM regulations
- Network congestion
- Airspace restrictions
- Snow, fog, convective weather
- Dense airport network

**IndiConnect provides — Indian / Asia-Pacific disruption complexity:**
- Monsoon
- Thunderstorms
- Dense hub operations
- Airport congestion
- Fog
- Cyclonic weather
- International connections

---

## 7. Fictional Airline Ecosystem

Rather than standalone airline profiles, the PoC defines a small ecosystem:

- **Namma Air** — Indian full-service hub carrier based at Bengaluru (BLR)
- **EuroVista Airways** — European network carrier based at Vienna (VIE)
- **IndiConnect Airways** — Indian hybrid network carrier based at Delhi (DEL)
- **AeroLink Alliance** — a fictional commercial/interline partnership between EuroVista and IndiConnect

This gives the PoC a richer storyline: a disruption originating in European airspace is detected through weather + ATFM + NOTAM intelligence, correlated to EuroVista's flights, and its downstream impact is propagated across interline connections into the IndiConnect network in India — an end-to-end demonstration.

### Naming Rationale

- **Namma Air** — "Namma" means "our" in Kannada, the language of Bengaluru; immediately communicates local identity.
- **EuroVista Airways** — sounds realistic but clearly fictional.
- **IndiConnect Airways** — immediately communicates its network role and is easy to understand in an international workshop.

### PoC Airline Selection Rationale

For the PoC, the airlines are sized deliberately below a Lufthansa/Air India scale — with enough network complexity to demonstrate:

- Weather disruption
- ATFM / EUROCONTROL flow restrictions
- NOTAM impacts
- Airport capacity constraints
- Flight-level correlation
- Aircraft rotation disruption
- Passenger and connection impacts
- Inter-airline connectivity
- Cross-region disruption propagation

The sweet spot: **a medium-sized European regional/network carrier** (EuroVista), **a small-to-medium Indian full-service carrier** (Namma Air), and **a medium Indian hybrid carrier** (IndiConnect).

---

*This document profiles fictional airlines for demonstration purposes only. All names, codes, routes, and figures are synthetic.*
