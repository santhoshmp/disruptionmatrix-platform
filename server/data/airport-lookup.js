// airport-lookup.js — Shared airport proximity lookup
// Provides nearest-airport resolution from geo coordinates.
//
// Phase 1 migration: functions now read from the reference loader
// (DB-backed) and fall back to the hardcoded AIRPORTS const above if
// the DB is empty or unavailable.

import { getAirportsByRegion } from './airport-airline-data.js';
import * as refLoader from './reference-loader.js';

// All known airports with coordinates (superset of all region airports)
export const AIRPORTS = {
  // India
  BLR: { lat: 13.2, lon: 77.7, name: 'Bengaluru' },
  DEL: { lat: 28.6, lon: 77.1, name: 'Delhi' },
  BOM: { lat: 19.1, lon: 72.9, name: 'Mumbai' },
  MAA: { lat: 13.0, lon: 80.2, name: 'Chennai' },
  HYD: { lat: 17.2, lon: 78.4, name: 'Hyderabad' },
  COK: { lat: 10.2, lon: 76.4, name: 'Kochi' },
  CCU: { lat: 22.7, lon: 88.3, name: 'Kolkata' },
  GOI: { lat: 15.4, lon: 73.8, name: 'Goa' },
  PNQ: { lat: 18.6, lon: 73.9, name: 'Pune' },
  VTZ: { lat: 17.7, lon: 83.2, name: 'Visakhapatnam' },
  AMD: { lat: 23.1, lon: 72.6, name: 'Ahmedabad' },
  JAI: { lat: 26.8, lon: 75.8, name: 'Jaipur' },
  LKO: { lat: 26.8, lon: 80.9, name: 'Lucknow' },
  IXC: { lat: 30.7, lon: 76.8, name: 'Chandigarh' },
  GAU: { lat: 26.1, lon: 91.6, name: 'Guwahati' },
  // Europe
  VIE: { lat: 48.1, lon: 16.6, name: 'Vienna' },
  MUC: { lat: 48.4, lon: 11.8, name: 'Munich' },
  PRG: { lat: 50.1, lon: 14.3, name: 'Prague' },
  BUD: { lat: 47.4, lon: 19.3, name: 'Budapest' },
  FRA: { lat: 50.0, lon: 8.6, name: 'Frankfurt' },
  AMS: { lat: 52.3, lon: 4.8, name: 'Amsterdam' },
  CDG: { lat: 49.0, lon: 2.5, name: 'Paris' },
  BRU: { lat: 50.9, lon: 4.5, name: 'Brussels' },
  ZRH: { lat: 47.5, lon: 8.5, name: 'Zurich' },
  GVA: { lat: 46.2, lon: 6.1, name: 'Geneva' },
  CPH: { lat: 55.6, lon: 12.7, name: 'Copenhagen' },
  OSL: { lat: 60.2, lon: 11.1, name: 'Oslo' },
  EDI: { lat: 55.9, lon: -3.4, name: 'Edinburgh' },
  FCO: { lat: 41.8, lon: 12.3, name: 'Rome' },
  MAD: { lat: 40.5, lon: -3.6, name: 'Madrid' },
  IST: { lat: 41.0, lon: 28.8, name: 'Istanbul' },
  LIS: { lat: 38.8, lon: -9.1, name: 'Lisbon' },
  ATH: { lat: 37.9, lon: 23.7, name: 'Athens' },
  // Middle East
  DXB: { lat: 25.3, lon: 55.4, name: 'Dubai' },
  AUH: { lat: 24.4, lon: 54.7, name: 'Abu Dhabi' },
  MCT: { lat: 23.6, lon: 58.3, name: 'Muscat' },
  DOH: { lat: 25.3, lon: 51.6, name: 'Doha' },
  BAH: { lat: 26.3, lon: 50.6, name: 'Bahrain' },
  // SE Asia
  BKK: { lat: 13.7, lon: 100.8, name: 'Bangkok' },
  KUL: { lat: 3.1, lon: 101.7, name: 'Kuala Lumpur' },
  SIN: { lat: 1.4, lon: 104.0, name: 'Singapore' },
  CGK: { lat: -6.1, lon: 106.7, name: 'Jakarta' },
  // North America / British Isles
  LHR: { lat: 51.5, lon: -0.5, name: 'London Heathrow' },
  LGW: { lat: 51.2, lon: -0.2, name: 'London Gatwick' },
  STN: { lat: 51.9, lon: 0.2, name: 'London Stansted' },
  JFK: { lat: 40.6, lon: -73.8, name: 'New York JFK' },
  YYZ: { lat: 43.7, lon: -79.4, name: 'Toronto' },
  ORD: { lat: 41.9, lon: -87.9, name: 'Chicago' },
  SFO: { lat: 37.6, lon: -122.4, name: 'San Francisco' },
  // East Asia
  HKG: { lat: 22.3, lon: 113.9, name: 'Hong Kong' },
  NRT: { lat: 35.8, lon: 140.4, name: 'Tokyo Narita' },
  ICN: { lat: 37.5, lon: 126.5, name: 'Seoul Incheon' },
  // Africa
  JNB: { lat: -26.1, lon: 28.2, name: 'Johannesburg' },
  NBO: { lat: -1.3, lon: 36.9, name: 'Nairobi' },
  // Oceania
  SYD: { lat: -33.9, lon: 151.2, name: 'Sydney' },
  MEL: { lat: -37.7, lon: 144.8, name: 'Melbourne' },
  BNE: { lat: -27.4, lon: 153.1, name: 'Brisbane' },
  PER: { lat: -31.9, lon: 115.9, name: 'Perth' },
  AKL: { lat: -37.0, lon: 174.8, name: 'Auckland' },
  // South America
  GRU: { lat: -23.4, lon: -46.5, name: 'Sao Paulo' },
  EZE: { lat: -34.8, lon: -58.5, name: 'Buenos Aires' },
  SCL: { lat: -33.4, lon: -70.8, name: 'Santiago' },
  BOG: { lat: 4.7, lon: -74.1, name: 'Bogota' },
  LIM: { lat: -12.0, lon: -77.1, name: 'Lima' },
  // Russia / CIS
  SVO: { lat: 55.97, lon: 37.41, name: 'Moscow Sheremetyevo' },
  DME: { lat: 55.41, lon: 37.91, name: 'Moscow Domodedovo' },
  LED: { lat: 59.80, lon: 30.26, name: 'St. Petersburg' },
  AER: { lat: 43.45, lon: 39.96, name: 'Sochi' },
  SVX: { lat: 56.74, lon: 60.80, name: 'Yekaterinburg' },
  MSQ: { lat: 53.88, lon: 28.03, name: 'Minsk' },
  GYD: { lat: 40.47, lon: 50.05, name: 'Baku' },
  TBS: { lat: 41.67, lon: 44.95, name: 'Tbilisi' },
  ALA: { lat: 43.35, lon: 77.04, name: 'Almaty' },
  TSE: { lat: 51.02, lon: 71.47, name: 'Astana' },
  TAS: { lat: 41.26, lon: 69.28, name: 'Tashkent' },
  // China
  PKX: { lat: 39.51, lon: 116.41, name: 'Beijing Daxing' },
  SZX: { lat: 22.64, lon: 113.81, name: 'Shenzhen' },
  TFU: { lat: 30.31, lon: 104.44, name: 'Chengdu Tianfu' },
  CKG: { lat: 29.72, lon: 106.64, name: 'Chongqing' },
  XIY: { lat: 34.45, lon: 108.75, name: "Xi'an" },
  HGH: { lat: 30.23, lon: 120.43, name: 'Hangzhou' },
  KMG: { lat: 24.99, lon: 102.74, name: 'Kunming' },
  NKG: { lat: 31.74, lon: 118.86, name: 'Nanjing' },
  URC: { lat: 43.91, lon: 87.47, name: 'Urumqi' },
};

// Haversine distance in km between two lat/lon points
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Resolve the active airport coords map (DB-backed via loader, fallback to hardcoded)
function _airportCoords() {
  return refLoader.getAirportCoords();
}

// Find airports within a given radius (km) of a geo point.
// Returns array of { iata, name, distanceKm } sorted by distance.
export function findAirportsWithin(lat, lon, radiusKm = 300) {
  const coords = _airportCoords();
  const results = [];
  for (const [iata, info] of Object.entries(coords)) {
    const dist = haversineKm(lat, lon, info.lat, info.lon);
    if (dist <= radiusKm) {
      results.push({ iata, name: info.name, distanceKm: Math.round(dist) });
    }
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

// Find the nearest airport to a geo point, regardless of distance.
// Returns { iata, name, distanceKm } or null if no airports.
export function findNearestAirport(lat, lon) {
  const coords = _airportCoords();
  let nearest = null;
  let minDist = Infinity;
  for (const [iata, info] of Object.entries(coords)) {
    const dist = haversineKm(lat, lon, info.lat, info.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = { iata, name: info.name, distanceKm: Math.round(dist) };
    }
  }
  return nearest;
}

// Get airport name by IATA code
export function getAirportName(iata) {
  return refLoader.getAirportName(iata);
}

// ── Region mapping ──────────────────────────────────────────────────
// Airport IATA → region id (R1–R9), built from the region/country registry.
// Phase 1: uses the reference loader's DB-backed region map when available,
// falls back to the hardcoded build below.
export const AIRPORT_REGION = {};
for (const rid of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']) {
  for (const a of getAirportsByRegion(rid)) {
    if (a.iata) AIRPORT_REGION[a.iata] = rid;
  }
}

export function getAirportRegion(iata) {
  return refLoader.getAirportRegion(iata) || AIRPORT_REGION[iata] || null;
}

// Derive an event's region from its affected airports, else from its geo
// position via nearest tracked airport. Returns 'R1'–'R9' or 'remote' for
// oceanic/far-from-registry events (e.g. mid-ocean earthquakes).
export function deriveEventRegion(event, eventGeo) {
  const aps = event._airports || event._geo?.airports || [];
  for (const code of aps) {
    const r = getAirportRegion(code);
    if (r) return r;
  }
  const geo = (event._geo && event._geo.lat != null) ? event._geo : eventGeo;
  if (geo && geo.lat != null) {
    const near = findNearestAirport(geo.lat, geo.lon);
    if (near && near.distanceKm <= 800) return getAirportRegion(near.iata) || 'remote';
  }
  return 'remote';
}

export default { findAirportsWithin, findNearestAirport, getAirportName, getAirportRegion, deriveEventRegion, AIRPORT_REGION };
