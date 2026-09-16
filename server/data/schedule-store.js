// schedule-store.js — Mock published flight schedules derived from PoC airline data.
// In production this would be backed by OAG / airline timetable APIs.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Load airline data files
const nammaData = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'namma-data.json'), 'utf-8'));
const evaData = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'eurovista-data.json'), 'utf-8'));
const icaData = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'indiconnect-data.json'), 'utf-8'));

// Build a unified schedule from all three airlines
// Each flight record: { flt, origin, dest, airline, airlineCode, bank, type, tail, pax, cargo }
const ALL_FLIGHTS = [];

function parseRoute(route) {
  // Routes like "BLR–DEL" or "BLR–JFK (via)" → { origin, dest }
  const parts = route.split('–').map(s => s.trim());
  if (parts.length < 2) return { origin: parts[0], dest: parts[0] };
  return { origin: parts[0], dest: parts[1] };
}

for (const [airline, code, data] of [
  ['namma', 'N7', nammaData],
  ['eva', 'EV', evaData],
  ['ica', 'IC', icaData],
]) {
  for (const f of data.FLIGHTS) {
    const { origin, dest } = parseRoute(f.route);
    ALL_FLIGHTS.push({
      flt: f.flt,
      origin,
      dest,
      airline,
      airlineCode: code,
      bank: f.bank,
      type: f.type,
      tail: f.tail,
      pax: f.pax || 0,
      cargo: f.cargo || 0,
    });
  }
}

// ── API ─────────────────────────────────────────────────────────────

// Get all flights that arrive at or depart from a given airport
export function getMovements(airportIATA) {
  return ALL_FLIGHTS.filter(
    (f) => f.origin === airportIATA || f.dest === airportIATA
  );
}

// Get arrivals at an airport
export function getArrivals(airportIATA) {
  return ALL_FLIGHTS.filter((f) => f.dest === airportIATA);
}

// Get departures from an airport
export function getDepartures(airportIATA) {
  return ALL_FLIGHTS.filter((f) => f.origin === airportIATA);
}

// Get all flights for a specific airline
export function getAirlineFlights(airlineKey) {
  return ALL_FLIGHTS.filter((f) => f.airline === airlineKey);
}

// Get all flights for an airline at a specific airport
export function getAirlineMovementsAtAirport(airlineKey, airportIATA) {
  return ALL_FLIGHTS.filter(
    (f) => f.airline === airlineKey && (f.origin === airportIATA || f.dest === airportIATA)
  );
}

// Get all airlines operating at a given airport
export function getAirlinesAtAirport(airportIATA) {
  const flights = getMovements(airportIATA);
  const airlineMap = new Map();
  for (const f of flights) {
    if (!airlineMap.has(f.airline)) {
      airlineMap.set(f.airline, { airline: f.airline, code: f.airlineCode, movements: 0 });
    }
    airlineMap.get(f.airline).movements++;
  }
  return Array.from(airlineMap.values());
}

// Get total movements at an airport (all airlines)
export function getTotalMovements(airportIATA) {
  return getMovements(airportIATA).length;
}

// Get routes that cross a given airspace (for overflight detection)
// In the mock, we check if any route has origin or dest far from the affected area
// but the route would logically cross the affected airspace
export function getRoutesCrossingAirspace(airspaceNames, airportCodes) {
  // For the mock, we return routes where neither origin nor dest is in the affected airports
  // but the route would cross the affected region (simplified heuristic)
  const affectedSet = new Set(airportCodes);
  return ALL_FLIGHTS.filter((f) => {
    return !affectedSet.has(f.origin) && !affectedSet.has(f.dest);
  });
}

// Get total flight count
export function getTotalFlights() {
  return ALL_FLIGHTS.length;
}

// Get all unique airports
export function getAllAirports() {
  const airports = new Set();
  for (const f of ALL_FLIGHTS) {
    airports.add(f.origin);
    airports.add(f.dest);
  }
  return Array.from(airports).sort();
}

export default {
  getMovements,
  getArrivals,
  getDepartures,
  getAirlineFlights,
  getAirlineMovementsAtAirport,
  getAirlinesAtAirport,
  getTotalMovements,
  getRoutesCrossingAirspace,
  getTotalFlights,
  getAllAirports,
};
