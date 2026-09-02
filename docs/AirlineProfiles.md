# Fictional Airline Profiles — Disruption Scenarios PoC

*Business document — unrestricted. Intended for business use and distribution to intended recipients only.*

This document profiles four fictional airlines considered for the disruption-management PoC, plus the recommended two-airline scenario (EuroVista Airways and IndiConnect Airways) with their interconnection model and four candidate disruption scenarios.

---

## 1. Alpine Connect Airways (ACA)

### Company Overview

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

### Fleet

| Aircraft Type | Quantity | Seats |
|---|---|---|
| Airbus A320-200 | 5 | 180 |

**Fleet tail numbers:** HB-ACA, HB-ACB, HB-ACC, HB-ACD, HB-ACE

**Average fleet age:** 8 years

### Route Network — Daily Scheduled Destinations

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

### Crew Population

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

### Operations Department

| Role | Headcount |
|---|---|
| Flight Dispatchers | 12 |
| Crew Controllers | 8 |
| OCC Managers | 2 |
| Maintenance Controllers | 5 |
| Crew Schedulers | 6 |
| **Total OCC Staff** | **33** |

### Crew Scheduling Rules

**Pilot constraints**
- Maximum duty period: 13 hours
- Minimum rest period: 12 hours
- Maximum flight hours: 100 hours in 28 days / 900 hours per year

**Cabin crew constraints**
- Maximum duty: 12 hours
- Minimum rest: 12 hours
- Maximum 6 consecutive working days

### Training Requirements

**Pilots:** A320 Type Rating · Annual Simulator Check · Recurrent Training Every 6 Months · Dangerous Goods Certification · CRM Training

**Cabin crew:** Annual Safety Training · First Aid Certification · Emergency Evacuation Training · CRM Training

### Example Monthly Activity

| Metric | Value |
|---|---|
| Flights Operated | 780 |
| Passengers Carried | 130,000 |
| Load Factor | 84% |
| On-Time Performance | 87% |
| Schedule Completion | 99% |

### Crew Bases

**Geneva Base:** 60 Pilots, 85 Cabin Crew
**Zurich Base:** 30 Pilots, 45 Cabin Crew

### Example Software Landscape

| Function | Software |
|---|---|
| Crew Scheduling | Jeppesen Crew Rostering |
| Crew Tracking | Jeppesen Crew Tracking |
| Flight Planning | Lido Flight |
| Operations Control | Sabre AirCentre Ops |
| Maintenance | AMOS |
| HR/Payroll | SAP SuccessFactors |

### Typical Challenges
- Last-minute pilot sickness
- Weather disruptions in winter
- Crew legality management
- Training event scheduling
- Aircraft maintenance impacts
- Reserve crew coverage optimization

> This profile is realistic for a European airline operating 5 Airbus A320 aircraft, ~220 employees, and about 25–30 scheduled flights per day, making it suitable for crew scheduling, disruption management, or airline operations system demonstrations.

---

## 2. Western India Airways (WIA)

### Company Overview

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

### Fleet

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

### Route Network

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

### Operations

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

### Flight Crew

**A320 fleet:** 120 Captains, 120 First Officers
**A350 fleet:** 80 Captains, 80 First Officers
**Total pilots:** 400

**Cabin crew:** 650 Cabin Crew, 90 Pursers/Senior Cabin Crew — **Total 740**

### Crew Bases

- **Mumbai (Primary):** 250 Pilots, 450 Cabin Crew
- **Delhi:** 110 Pilots, 190 Cabin Crew
- **Bengaluru:** 40 Pilots, 50 Cabin Crew

### Operations Control Center (Mumbai HQ)

| Function | Staff |
|---|---|
| Flight Dispatchers | 30 |
| Crew Controllers | 20 |
| Maintenance Controllers | 15 |
| Crew Planners | 15 |
| OCC Managers | 5 |
| **Total OCC Staff** | **85** |

### Typical Crew Complement

| Flight Type | Flight Deck | Cabin | Total |
|---|---|---|---|
| Domestic A320 | 1 Captain, 1 First Officer | 5 Cabin Crew | 7 |
| Long-Haul A350 (Europe) | 2 Pilots | 10 Cabin Crew | 12 |
| Ultra Long-Haul (North America) | 4 Pilots (incl. relief crew) | 12 Cabin Crew | 16 |

### Maintenance Organization

**Main maintenance base:** Mumbai (BOM) — Line Maintenance, A Checks, C Checks, Engine Change, Landing Gear Change, Composite Repairs, Cabin Modifications

**Secondary maintenance bases:** Delhi (DEL), Bengaluru (BLR)

**Overseas line stations:** London Heathrow, Dubai, Singapore, New York JFK, Toronto, Sydney

### Technology Landscape

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

### Typical Operational Challenges
- Mumbai monsoon disruptions
- Long-haul crew fatigue management
- ETOPS compliance for transoceanic operations
- North Atlantic weather deviations
- Aircraft-on-Ground (AOG) events overseas
- Heathrow and JFK slot constraints
- Peak demand during Diwali and summer holidays
- Widebody maintenance planning
- International visa and crew documentation requirements

### Airline Snapshot

> Western India Airways (WIA) is a fictional Mumbai-based full-service international airline operating 20 aircraft (12 A320neos and 8 A350-900s) serving over 40 destinations across India, the Middle East, Asia, Europe, North America, and Australia. The airline carries approximately 9.5 million passengers annually and employs around 1,140 crew members, making it comparable in scale to a mid-sized international carrier.

---

## 3. Recommended PoC Airlines

For the PoC, the recommendation is **two fictional but operationally realistic airlines** — sized deliberately below a Lufthansa/Air India scale — with enough network complexity to demonstrate:

- Weather disruption
- ATFM / EUROCONTROL flow restrictions
- NOTAM impacts
- Airport capacity constraints
- Flight-level correlation
- Aircraft rotation disruption
- Passenger and connection impacts
- Inter-airline connectivity
- Cross-region disruption propagation

The sweet spot: **a medium-sized European regional/network carrier** and **a small-to-medium Indian full-service/hybrid carrier**.

---

## 4. Airline 1 — EuroVista Airways (EVA)

*"Connecting Europe Intelligently"*

A medium-sized European airline based in Central Europe, operating a hub-and-spoke network with strong intra-European connectivity.

### Airline Profile

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

### Fleet

A realistic fleet of approximately **38 aircraft**.

| Segment | Fleet | Typical Routes / Use |
|---|---|---|
| Narrow-body | 12 × Airbus A320neo | Vienna–Frankfurt, Vienna–Paris, Vienna–Amsterdam, Vienna–Rome, Vienna–Madrid |
| Regional | 18 × Embraer E190/E195 | Prague, Zurich, Geneva, Brussels, Copenhagen, Warsaw, Budapest, Milan |
| Longer-range / medium-haul | 8 × Airbus A321neo / A321LR | Istanbul, Dubai, selected Middle East destinations, high-density European routes |

### Network

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

### Operational Profile

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

### Key Disruption-Sensitive Airports

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

## 5. Airline 2 — IndiConnect Airways (ICA)

*"Connecting India to the World"*

A fictional medium-sized Indian hybrid/network carrier — enough complexity to demonstrate disruption propagation while remaining manageable for a PoC.

### Airline Profile

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

### Fleet

Approximately **42 aircraft**.

| Segment | Fleet | Typical Use |
|---|---|---|
| Domestic narrow-body | 28 × Airbus A320neo | DEL–BOM, DEL–BLR, DEL–HYD, DEL–MAA, BOM–BLR, BOM–COK |
| Regional | 8 × ATR 72 | Jaipur, Lucknow, Chandigarh, Ahmedabad, Goa, smaller regional airports |
| International | 6 × Airbus A321neo / A321XLR | Dubai, Abu Dhabi, Singapore, Bangkok, Vienna, Istanbul |

### Network

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

### Operational Profile

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

## 6. Interconnection Between the Two Airlines

The two airlines should not exist independently — they need realistic operational and commercial interconnections, at three levels.

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

### The Joint Network

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

### Why These Two Airlines Work Well for the PoC

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

## 7. Four Candidate PoC Scenarios

### Scenario 1 — European Convective Weather

**Event:** Severe CB (thunderstorm) activity forecast around Frankfurt, Munich, and Vienna.

**Data sources:** Weather Intelligence + EUROCONTROL ATFM + NOTAMs + EuroVista Flight Schedule

**AI determines:** Which EuroVista flights will be affected, then which connecting passengers will miss their onward flights — including Vienna → Delhi → Bengaluru connections.

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

*An excellent cascading disruption scenario.*

### Scenario 3 — Delhi Winter Fog

**Event:** Dense fog predicted at DEL.

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
```

**The impact engine identifies:** incoming aircraft, outbound rotations, European connections, and EuroVista passengers — demonstrating cross-airline disruption propagation.

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

---

## 8. Suggested PoC Data Model

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

## 9. Naming Rationale

- **EuroVista Airways** — sounds realistic but clearly fictional.
- **IndiConnect Airways** — immediately communicates its network role and is easy to understand in an international workshop.

## 10. Further Recommendation — A Fictional Airline Ecosystem

Rather than two standalone airline profiles, define a small ecosystem:

- **EuroVista Airways** — European network carrier
- **IndiConnect Airways** — Indian hybrid network carrier
- **AeroLink Alliance** — a fictional commercial/interline partnership between them

This gives the PoC a richer storyline: a disruption originating in European airspace is detected through weather + ATFM + NOTAM intelligence, correlated to EuroVista's flights, and its downstream impact is propagated across interline connections into the IndiConnect network in India — an end-to-end demonstration for the IATA WDS audience.

**Suggested next step:** build a complete synthetic operational dataset specification for EuroVista and IndiConnect — including fleet registration numbers, 50–100 flights, aircraft rotations, schedules, airport connections, and disruption scenarios — to serve as the data foundation for the PoC.
