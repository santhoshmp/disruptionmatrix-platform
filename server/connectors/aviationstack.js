// aviationstack.js — AviationStack flight data connector.
// Provides scheduled vs actual flight times, cancellations, diversions.
// Free tier: 100 requests/month. Requires AVIATIONSTACK_KEY env var.
//
// Source: https://aviationstack.com/
// API: http://api.aviationstack.com/v1/flights
//
// When AVIATIONSTACK_KEY is not set, all functions return empty arrays
// (no-op). The FlightAgent falls back to OpenSky actuals + mock data.

import { fetchWithTimeout } from './http-utils.js';
import { configureRateLimit, waitForToken } from '../data/rate-limiter.js';
import * as refLoader from '../data/reference-loader.js';

const BASE = 'http://api.aviationstack.com/v1';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('aviationstack', 'timeout_ms', 12000);
const _cacheTtl = () => refLoader.getConnectorConfig('aviationstack', 'cache_ttl_ms', 900000); // 15 min — aggressive cache (100 req/month budget)

// 100 req/month ≈ 3.3/day. Refill slowly, allow small burst.
configureRateLimit('aviationstack', { capacity: 5, refillPerSec: 0.00004 });

const cache = new Map(); // key: query string → { data, time }

function isConfigured() {
  return !!process.env.AVIATIONSTACK_KEY;
}

async function fetchFlights(params) {
  if (!isConfigured()) return [];
  await waitForToken('aviationstack');
  const query = new URLSearchParams({
    access_key: process.env.AVIATIONSTACK_KEY,
    ...params,
  }).toString();
  const cacheKey = query;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < _cacheTtl()) return cached.data;
  try {
    const res = await fetchWithTimeout(`${BASE}/flights?${query}`, {}, _timeout());
    if (!res.ok) throw new Error(`AviationStack ${res.status}`);
    const data = await res.json();
    const flights = (data.data || []).map(normalizeFlight);
    cache.set(cacheKey, { data: flights, time: Date.now() });
    return flights;
  } catch (err) {
    console.error('[aviationstack] fetch failed:', err.message);
    return cached?.data || [];
  }
}

function normalizeFlight(f) {
  return {
    type: 'flight_schedule',
    flightNumber: f.flight?.iata || f.flight?.icao || 'UNKNOWN',
    airline: f.airline?.name,
    airlineCode: f.airline?.iata,
    departureAirport: f.departure?.iata,
    arrivalAirport: f.arrival?.iata,
    scheduledDeparture: f.departure?.scheduled,
    estimatedDeparture: f.departure?.estimated,
    actualDeparture: f.departure?.actual,
    scheduledArrival: f.arrival?.scheduled,
    estimatedArrival: f.arrival?.estimated,
    actualArrival: f.arrival?.actual,
    delayMin: parseDelay(f.departure?.estimated, f.departure?.scheduled),
    status: f.flight_status, // scheduled, active, landed, cancelled, incident, diverted
    cancelled: f.flight_status === 'cancelled',
    diverted: f.flight_status === 'diverted',
    airports: [f.departure?.iata].filter(Boolean),
  };
}

function parseDelay(estimated, scheduled) {
  if (!estimated || !scheduled) return 0;
  const diff = new Date(estimated) - new Date(scheduled);
  return Math.max(0, Math.round(diff / 60000));
}

// ── Public API ─────────────────────────────────────────────────────

// Get live flights departing from an airport (IATA code).
export async function fetchDepartures(iataCode, limit = 100) {
  return fetchFlights({ dep_iata: iataCode, limit });
}

// Get live flights arriving at an airport (IATA code).
export async function fetchArrivals(iataCode, limit = 100) {
  return fetchFlights({ arr_iata: iataCode, limit });
}

// Get cancelled flights for an airport (high-signal for disruption).
export async function fetchCancellations(iataCode, limit = 50) {
  return fetchFlights({ dep_iata: iataCode, flight_status: 'cancelled', limit });
}

// Get delayed flights for an airport.
export async function fetchDelays(iataCode, limit = 50) {
  return fetchFlights({ dep_iata: iataCode, flight_status: 'active', limit });
}

export default {
  isConfigured,
  fetchDepartures,
  fetchArrivals,
  fetchCancellations,
  fetchDelays,
};
