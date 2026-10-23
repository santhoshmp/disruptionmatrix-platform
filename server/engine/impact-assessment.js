// impact-assessment.js — Impact Assessment Agent
// Event-driven agent that receives scored events, resolves affected airports,
// pulls published flight schedules, and computes per-airport + per-airline exposure.
// Produces OPS[eventId] objects compatible with the existing dm-data.json schema.

import store from '../store/event-store.js';
import scheduleStore from '../data/schedule-store.js';
import airlineRegistry from '../data/airline-registry.js';
import realAirlineRegistry from '../data/real-airline-registry.js';
import { scoreBandLabel } from './scoring.js';
import * as refLoader from '../data/reference-loader.js';

// Current impact mode: 'mock' (Namma/EuroVista/IndiConnect) or 'real' (real airlines)
let impactMode = 'mock';

// Load mode from DB on startup (async, non-blocking)
export async function initImpactMode() {
  const dbMode = await store.getSetting('impactMode', 'mock');
  if (dbMode === 'real' || dbMode === 'mock') {
    impactMode = dbMode;
    console.log(`[ImpactAssessment] Mode loaded from DB: ${impactMode}`);
  }
}

export function setImpactMode(mode) {
  impactMode = mode === 'real' ? 'real' : 'mock';
  console.log(`[ImpactAssessment] Mode set to: ${impactMode}`);
  return impactMode;
}

export function getImpactMode() {
  return impactMode;
}

function _getRegistry() {
  return impactMode === 'real' ? realAirlineRegistry : airlineRegistry;
}

// ── Airport name lookup ──────────────────────────────────────────────

// Phase 1: AIRPORT_NAMES kept as fallback; getAirportNameDb() reads from
// the DB-backed reference loader when available.
const AIRPORT_NAMES = {
  BLR: 'Bengaluru', DEL: 'Delhi', BOM: 'Mumbai', MAA: 'Chennai',
  HYD: 'Hyderabad', COK: 'Kochi', CCU: 'Kolkata', GOI: 'Goa',
  PNQ: 'Pune', VTZ: 'Visakhapatnam', AMD: 'Ahmedabad', JAI: 'Jaipur',
  LKO: 'Lucknow', IXC: 'Chandigarh', GAU: 'Guwahati',
  VIE: 'Vienna', MUC: 'Munich', PRG: 'Prague', BUD: 'Budapest',
  FRA: 'Frankfurt', AMS: 'Amsterdam', CDG: 'Paris', BRU: 'Brussels',
  ZRH: 'Zurich', GVA: 'Geneva', CPH: 'Copenhagen', OSL: 'Oslo',
  EDI: 'Edinburgh', FCO: 'Rome', MAD: 'Madrid', IST: 'Istanbul',
  LIS: 'Lisbon', ATH: 'Athens', WAW: 'Warsaw',
  DXB: 'Dubai', AUH: 'Abu Dhabi', MCT: 'Muscat', DOH: 'Doha', BAH: 'Bahrain',
  BKK: 'Bangkok', KUL: 'Kuala Lumpur', SIN: 'Singapore', CGK: 'Jakarta',
  LHR: 'London Heathrow', LGW: 'London Gatwick', STN: 'London Stansted',
  JFK: 'New York JFK', YYZ: 'Toronto', ORD: 'Chicago', SFO: 'San Francisco',
  HKG: 'Hong Kong', NRT: 'Tokyo Narita', ICN: 'Seoul Incheon',
  JNB: 'Johannesburg', NBO: 'Nairobi',
  // Oceania
  SYD: 'Sydney', MEL: 'Melbourne', BNE: 'Brisbane', PER: 'Perth', AKL: 'Auckland',
  // South America
  GRU: 'Sao Paulo', EZE: 'Buenos Aires', SCL: 'Santiago', BOG: 'Bogota', LIM: 'Lima',
};

// ── Hazard → capability mapping ──────────────────────────────────────
// Determines if the airline's fleet can handle the hazard type
// Phase 5: uses DB-backed hazard requires_cat3, falls back to hardcoded const.

const HAZARD_REQUIRES_CAT3 = ['fog', 'low_visibility', 'low_ceiling'];

function _hazardRequiresCat3(hazardType) {
  // Try DB-backed first
  const fromDb = refLoader.getHazardRequiresCat3(hazardType);
  if (fromDb != null) return fromDb;
  return HAZARD_REQUIRES_CAT3.includes(hazardType);
}

// ── Main entry: compute OPS for an event ────────────────────────────

export function computeOPS(event) {
  if (!event) return null;

  const edps = event.score || 50;
  const airports = event._airports || event._geo?.airports || [];
  const airspace = event._airspace || [];
  const category = event.cat;
  const hazardType = event._hazardType || _inferHazardType(event);

  // Resolve affected airports (from event + geo)
  const affectedAirports = _resolveAirports(event, airports);

  // Compute airport-level impact
  const airportResults = affectedAirports.map((iata) =>
    _computeAirportExposure(event, iata, edps)
  );

  // Compute airline-level impact
  const airlineResults = _computeAirlineExposures(event, affectedAirports, edps, hazardType);

  // Detect overflight exposure (airspace events)
  const overflightExposure = _detectOverflightExposure(event, airspace, affectedAirports);

  // Build the OPS object (compatible with existing dm-data.json schema)
  const ops = {
    basis: 'Airline exposure data cross-referenced with published schedules.',
    airports: airportResults.map((a) => ({
      iata: a.iata,
      name: a.name,
      role: a.role,
      movements: a.movements,
      window: a.window,
      exposure: a.exposure,
      note: a.note,
      // Extended machine-readable fields
      arrivals: a.arrivals,
      departures: a.departures,
      totalFlights: a.totalFlights,
      airlineCount: a.airlineCount,
      impactScore: a.impactScore,
      exposureBand: a.exposureBand,
    })),
    airlines: airlineResults.map((a) => ({
      name: a.name,
      code: a.code,
      hub: a.hub,
      daily: a.daily,
      netShare: a.netShare,
      airports: a.airports,
      exposure: a.exposureLevel,
      note: a.note,
      // Extended machine-readable fields
      exposureScore: a.exposureScore,
      drivers: a.drivers,
    })),
    // Extended fields
    overflightExposure,
    _computedAt: new Date().toISOString(),
    _eventId: event.id,
    _edps: edps,
  };

  return ops;
}

// ── Airport exposure ────────────────────────────────────────────────

function _computeAirportExposure(event, iata, edps) {
  const registry = _getRegistry();
  const name = refLoader.getAirportName(iata) || AIRPORT_NAMES[iata] || iata;
  const arrivals = impactMode === 'mock' ? scheduleStore.getArrivals(iata).length : _estimateRealArrivals(iata);
  const departures = impactMode === 'mock' ? scheduleStore.getDepartures(iata).length : _estimateRealDepartures(iata);
  const movements = arrivals + departures;
  const airlinesAtAirport = registry.getAirlinesAtAirport(iata);
  const airlineCount = airlinesAtAirport.length;

  // Airport role: affected if in the event geo, overflight if only airspace
  const role = 'Affected';

  // Airport exposure = EDPS adjusted by movement density
  // Busier airports with more movements get slightly higher exposure
  const movementMultiplier = movements > 20 ? 1.05 : movements > 10 ? 1.0 : 0.9;
  const impactScore = Math.min(100, Math.round(edps * movementMultiplier));
  const exposureBand = scoreBandLabel(impactScore);

  // Window from event TTI
  const window = event.tti || '6h';

  // Note
  const note = event.summary || `${event.name} affecting ${name}`;

  return {
    iata,
    name,
    role,
    movements,
    window,
    exposure: impactScore,
    note,
    arrivals,
    departures,
    totalFlights: movements,
    airlineCount,
    impactScore,
    exposureBand,
  };
}

// ── Airline exposure ────────────────────────────────────────────────

function _computeAirlineExposures(event, affectedAirports, edps, hazardType) {
  const registry = _getRegistry();
  const allAirlines = registry.getAllAirlines();
  const results = [];

  for (const airline of allAirlines) {
    // Check if this airline operates at any affected airport
    const operatingAirports = affectedAirports.filter(
      (iata) => airline.networkShare && airline.networkShare[iata] != null && airline.networkShare[iata] > 0
    );

    // Also check if the airline has flights to/from affected airports in the schedule (mock mode only)
    const scheduleAirports = impactMode === 'mock' ? affectedAirports.filter((iata) => {
      const flights = scheduleStore.getAirlineMovementsAtAirport(airline.key, iata);
      return flights.length > 0;
    }) : [];

    const relevantAirports = [...new Set([...operatingAirports, ...scheduleAirports])];

    if (relevantAirports.length === 0) continue;

    // ── Compute 5-factor model ───────────────────────────────────────

    // 1. Hub factor (0.5-1.5)
    const hubRole = registry.getHubRole(airline.key, relevantAirports[0]);
    const hubFactor = hubRole === 'primary' ? 1.5
      : hubRole === 'secondary' ? 1.2
      : hubRole === 'focus_city' ? 0.8
      : 0.5;

    // 2. Movement share factor (0.3-1.2)
    const netShare = relevantAirports.reduce(
      (sum, iata) => sum + (airline.networkShare?.[iata] || 0),
      0
    );
    const movementShareFactor = Math.min(1.2, (netShare / 100) * 1.2);

    // 3. Fleet capability factor (0.5-1.3)
    let fleetCapabilityFactor = 1.0;
    if (_hazardRequiresCat3(hazardType)) {
      // Fog/low visibility — check CAT III capability
      const hasCat3 = registry.hasCat3Capability(airline.key);
      fleetCapabilityFactor = hasCat3 ? 0.5 : 1.3; // equipped = less exposed
    }

    // 4. Bank overlap factor (0.5-1.2)
    const bankOverlapFactor = _computeBankOverlap(airline.key, event);

    // 5. Overflight factor (0.5-1.3)
    const overflightFactor = 1.0; // default: serves affected airport

    // ── Compute exposure score ──────────────────────────────────────
    // Formula: EDPS × (0.35×hubF + 0.25×moveShareF + 0.20×fleetCapF + 0.10×bankOverlapF + 0.10×overflightF)
    const weightedSum =
      0.35 * hubFactor +
      0.25 * movementShareFactor +
      0.20 * fleetCapabilityFactor +
      0.10 * bankOverlapFactor +
      0.10 * overflightFactor;

    const exposureScore = Math.min(100, Math.round(edps * weightedSum));
    const exposureLevel = scoreBandLabel(exposureScore);

    // ── Build note ──────────────────────────────────────────────────
    const drivers = [];
    if (hubRole === 'primary') drivers.push('primary hub at affected airport');
    if (hubRole === 'secondary') drivers.push('secondary hub at affected airport');
    if (netShare >= 20) drivers.push(`${netShare}% network share`);
    if (fleetCapabilityFactor === 1.3) drivers.push('fleet lacks CAT III capability for this hazard');
    if (fleetCapabilityFactor === 0.5) drivers.push('fleet equipped for this hazard');
    if (bankOverlapFactor === 1.2) drivers.push('event overlaps critical bank');

    const note = drivers.length > 0
      ? drivers.join(', ') + '.'
      : 'Direct exposure through affected airport operations.';

    results.push({
      name: airline.name,
      code: airline.code,
      hub: airline.hub,
      daily: airline.dailyDepartures,
      netShare: Math.round(netShare),
      airports: relevantAirports.join(' · '),
      exposureLevel,
      exposureScore,
      note,
      drivers: {
        hubFactor,
        movementShareFactor,
        fleetCapabilityFactor,
        bankOverlapFactor,
        overflightFactor,
      },
    });
  }

  // Sort by exposure score descending
  results.sort((a, b) => b.exposureScore - a.exposureScore);
  return results;
}

// ── Bank overlap computation ────────────────────────────────────────

function _computeBankOverlap(airlineKey, event) {
  const registry = _getRegistry();
  const banks = registry.getBankStructure(airlineKey);
  if (banks.length === 0) return 1.0;

  // For the mock, we don't have exact event times, so we use the TTI
  // to estimate which bank is most likely affected.
  // If the event TTI is short (< 4h), it likely hits the next bank.
  // If long, it could hit multiple banks.

  const ttiMin = event.ttiMin || 360;

  // Find the most sensitive bank
  const criticalBank = banks.find((b) => b.sensitivity === 'critical');
  const highBank = banks.find((b) => b.sensitivity === 'high');

  // If TTI is short (< 240 min = 4h), assume it hits the most sensitive bank
  if (ttiMin <= 240 && criticalBank) return 1.2;
  if (ttiMin <= 240 && highBank) return 1.1;

  // If TTI is medium (240-720 min = 4-12h), assume any bank
  if (ttiMin > 240 && ttiMin <= 720) return 1.0;

  // If TTI is long (> 12h), likely off-peak
  return 0.5;
}

// ── Overflight exposure detection ──────────────────────────────────

function _detectOverflightExposure(event, airspace, affectedAirports) {
  if (airspace.length === 0 && event.cat !== 'Geopolitical') return [];

  const registry = _getRegistry();
  const allAirlines = registry.getAllAirlines();
  const overflightResults = [];
  const affectedSet = new Set(affectedAirports);

  for (const airline of allAirlines) {
    let overflights = [];
    if (impactMode === 'mock') {
      const airlineFlights = scheduleStore.getAirlineFlights(airline.key);
      overflights = airlineFlights.filter((f) => !affectedSet.has(f.origin) && !affectedSet.has(f.dest));
    } else {
      // Real mode: approximate — airlines with ops at non-affected airports may overfly
      const nonAffected = Object.keys(airline.networkShare || {}).filter(
        (iata) => !affectedSet.has(iata) && airline.networkShare[iata] > 0
      );
      for (const iata of nonAffected.slice(0, 3)) {
        overflights.push({ origin: iata, dest: airline.hub, flt: `${airline.code}***` });
      }
    }

    if (overflights.length > 0) {
      const routeMap = new Map();
      for (const f of overflights) {
        const route = `${f.origin}-${f.dest}`;
        if (!routeMap.has(route)) routeMap.set(route, { route, count: 0, flt: f.flt });
        routeMap.get(route).count++;
      }

      const servesAffected = affectedAirports.some(
        (iata) => airline.networkShare && airline.networkShare[iata] != null && airline.networkShare[iata] > 0
      );

      for (const [route, info] of routeMap) {
        overflightResults.push({
          airline: airline.name,
          code: airline.code,
          route,
          airspace: airspace.length > 0 ? airspace.join(', ') : 'Affected airspace corridor',
          impact: servesAffected
            ? `${info.count} flight(s) may also be affected by airspace rerouting`
            : `${info.count} flight(s) cross affected airspace without destination — invisible exposure`,
        });
      }
    }
  }

  return overflightResults;
}

// ── Real movement estimation (no schedule data) ──────────────────────
// Phase 1: AIRPORT_DAILY_MOVEMENTS kept as fallback; _getDailyMovements()
// reads from the DB-backed reference loader when available.

const AIRPORT_DAILY_MOVEMENTS = {
  DEL: 450, BOM: 400, BLR: 300, MAA: 200, HYD: 180, COK: 150, CCU: 150,
  GOI: 80, PNQ: 100, VTZ: 60, AMD: 120, JAI: 80, LKO: 80, IXC: 60, GAU: 60,
  VIE: 200, MUC: 400, FRA: 500, AMS: 500, CDG: 540, BRU: 200, ZRH: 300,
  GVA: 150, CPH: 250, OSL: 200, EDI: 200, FCO: 400, MAD: 400, IST: 500,
  WAW: 250, ATH: 200, BUD: 150, PRG: 200, LIS: 200,
  DXB: 600, AUH: 300, DOH: 300, MCT: 150, BAH: 200, RUH: 300, JED: 250,
  KWI: 150, AMM: 150, BEY: 150, TLV: 200,
  SIN: 500, BKK: 500, KUL: 400, CGK: 400, MNL: 250, HAN: 200, SGN: 250,
  PNH: 80, RGN: 80,
  LHR: 650, LGW: 300, STN: 150, JFK: 500, EWR: 400, YYZ: 400, ORD: 500, ATL: 600, SFO: 400, LAX: 500,
  IAD: 300, BOS: 400, KEF: 100, SNN: 100,
  HKG: 500, NRT: 400, HND: 500, ICN: 400, PEK: 500, PVG: 500, CAN: 400,
  TPE: 300,
  JNB: 300, CPT: 200, NBO: 150, ADD: 200, CAI: 300, LOS: 150, ACC: 100, DKR: 100,
  // Oceania
  SYD: 400, MEL: 350, BNE: 250, PER: 200, AKL: 200,
  // South America
  GRU: 500, EZE: 300, SCL: 250, BOG: 300, LIM: 250,
};

function _getDailyMovements(iata) {
  const ap = refLoader.getAirport(iata);
  if (ap && ap.daily_movements) return ap.daily_movements;
  return AIRPORT_DAILY_MOVEMENTS[iata] || 100;
}

function _estimateRealArrivals(iata) {
  return Math.round(_getDailyMovements(iata) / 2);
}

function _estimateRealDepartures(iata) {
  return Math.round(_getDailyMovements(iata) / 2);
}

// ── Airport resolution ───────────────────────────────────────────────

function _resolveAirports(event, explicitAirports) {
  if (explicitAirports && explicitAirports.length > 0) {
    return explicitAirports;
  }

  // Fall back to geo data (which may have airports)
  const eventGeo = store.geoData.EVENT_GEO[event.id];
  if (eventGeo && eventGeo.airports && eventGeo.airports.length > 0) {
    return eventGeo.airports;
  }

  // Fall back to the "where" field — only keep tokens that resolve to a
  // known airport. Place names like "34 km WNW of Luwuk, Indonesia" must
  // not be treated as airport codes.
  if (event.where) {
    const tokens = event.where
      .split(/[\/,]/)
      .map((s) => s.replace(/\(.*$/, '').trim()) // strip "(place name)" suffixes
      .filter(Boolean);
    const airports = tokens.filter((t) => /^[A-Z]{3}$/.test(t) && refLoader.getAirport(t));
    return airports;
  }

  return [];
}

// ── Hazard type inference ───────────────────────────────────────────

// Phase 5: _inferHazardType now uses DB-backed keyword lookup (ref_hazard_keywords),
// falls back to the original if/else chain if DB is empty or no keyword matches.
function _inferHazardType(event) {
  const name = (event.name || '').toLowerCase();
  const summary = (event.summary || '').toLowerCase();

  // Try DB-backed keyword lookup first
  // Check name first (more specific), then summary
  const combined = `${name} ${summary}`;
  for (const [keyword, hazardType] of _getKeywordMap()) {
    if (combined.includes(keyword)) {
      // Preserve backward compatibility: 'infrastructure_failure' maps to 'infrastructure'
      // for the original if/else chain return value
      if (hazardType === 'infrastructure_failure') return 'infrastructure';
      return hazardType;
    }
  }

  // Fallback: original if/else chain
  if (name.includes('fog') || summary.includes('fog') || summary.includes('visibility')) return 'fog';
  if (name.includes('storm') || summary.includes('thunderstorm') || summary.includes('convective')) return 'thunderstorm';
  if (name.includes('monsoon') || summary.includes('monsoon')) return 'monsoon';
  if (name.includes('snow') || summary.includes('snow')) return 'snow_ice';
  if (name.includes('atfm') || name.includes('atc') || summary.includes('sector')) return 'atfm_regulation';
  if (name.includes('strike') || name.includes('industrial')) return 'strike';
  if (name.includes('airspace') || name.includes('overflight')) return 'airspace_restriction';
  if (name.includes('fuel')) return 'fuel_supply';
  if (name.includes('runway') || name.includes('ils')) return 'infrastructure';

  return 'general';
}

// Build keyword→hazard_type map from DB, preserving the original check order.
// The original if/else chain has a specific priority (fog > thunderstorm > monsoon > snow > atfm > strike > airspace > fuel > infrastructure).
// We replicate that order so overlapping keywords (e.g., 'storm' vs 'sector') resolve correctly.
const _HAZARD_CHECK_ORDER = [
  'fog', 'thunderstorm', 'monsoon', 'snow_ice', 'atfm_regulation',
  'strike', 'airspace_restriction', 'fuel_supply', 'infrastructure_failure',
];

function _getKeywordMap() {
  const map = new Map();
  if (!refLoader.isLoaded()) return map;
  for (const hazardType of _HAZARD_CHECK_ORDER) {
    const keywords = refLoader.getHazardKeywords(hazardType);
    for (const kw of keywords) {
      map.set(kw, hazardType);
    }
  }
  return map;
}

export default { computeOPS, setImpactMode, getImpactMode, _inferHazardType };
