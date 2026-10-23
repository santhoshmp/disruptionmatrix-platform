// airlabs.js — AirLabs flight data connector.
// Provides scheduled vs actual flight times, cancellations, delays.
// Free tier: ~1,000 requests/month. Requires AIRLABS_KEY env var.
//
// Source: https://airlabs.co/
// API: https://airlabs.co/api/v9/schedules
//
// When AIRLABS_KEY is not set, all functions return empty arrays
// (no-op). The FlightAgent falls back to AviationStack/OpenSky/mock data.

import { fetchWithTimeout } from './http-utils.js';
import { configureRateLimit, waitForToken } from '../data/rate-limiter.js';
import * as refLoader from '../data/reference-loader.js';

const BASE = 'https://airlabs.co/api/v9';
const _timeout = () => refLoader.getConnectorConfig('airlabs', 'timeout_ms', 12000);
const _cacheTtl = () => refLoader.getConnectorConfig('airlabs', 'cache_ttl_ms', 900000); // 15 min

// ~1,000 req/month ≈ 33/day. Refill slowly, allow small burst.
configureRateLimit('airlabs', { capacity: 5, refillPerSec: 0.0004 });

const cache = new Map(); // key: endpoint + query → { data, time }

function isConfigured() {
  return !!process.env.AIRLABS_KEY;
}

async function fetchEndpoint(endpoint, params) {
  if (!isConfigured()) return [];
  await waitForToken('airlabs');
  const query = new URLSearchParams({
    api_key: process.env.AIRLABS_KEY,
    ...params,
  }).toString();
  const cacheKey = `${endpoint}?${query}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < _cacheTtl()) return cached.data;
  try {
    const res = await fetchWithTimeout(`${BASE}/${endpoint}?${query}`, {}, _timeout());
    if (!res.ok) throw new Error(`AirLabs ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`AirLabs: ${data.error.message || 'API error'}`);
    const flights = (data.response || []).map(normalizeFlight);
    cache.set(cacheKey, { data: flights, time: Date.now() });
    return flights;
  } catch (err) {
    console.error(`[airlabs] ${endpoint} fetch failed:`, err.message);
    return cached?.data || [];
  }
}

function tsToIso(ts) {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function normalizeFlight(f) {
  return {
    type: 'flight_schedule',
    flightNumber: f.flight_iata || f.flight_icao || 'UNKNOWN',
    airline: f.airline_iata || f.airline_icao,
    airlineCode: f.airline_iata,
    departureAirport: f.dep_iata,
    arrivalAirport: f.arr_iata,
    scheduledDeparture: tsToIso(f.dep_time_ts),
    estimatedDeparture: tsToIso(f.dep_estimated_ts),
    actualDeparture: tsToIso(f.dep_actual_ts),
    scheduledArrival: tsToIso(f.arr_time_ts),
    estimatedArrival: tsToIso(f.arr_estimated_ts),
    actualArrival: tsToIso(f.arr_actual_ts),
    delayMin: f.delayed || f.dep_delayed || 0,
    status: normalizeStatus(f.status),
    cancelled: f.status === 'cancelled',
    diverted: f.status === 'diverted',
    airports: [f.dep_iata].filter(Boolean),
  };
}

// AirLabs statuses → AviationStack-compatible statuses
function normalizeStatus(status) {
  const map = {
    'en-route': 'active',
    'scheduled': 'scheduled',
    'landed': 'landed',
    'cancelled': 'cancelled',
    'diverted': 'diverted',
  };
  return map[status] || status;
}

// ── Public API ─────────────────────────────────────────────────────

// Get scheduled departures from an airport (IATA code).
export async function fetchDepartures(iataCode, limit = 100) {
  const flights = await fetchEndpoint('schedules', { dep_iata: iataCode, limit });
  return flights.slice(0, limit);
}

// Get scheduled arrivals at an airport (IATA code).
export async function fetchArrivals(iataCode, limit = 100) {
  const flights = await fetchEndpoint('schedules', { arr_iata: iataCode, limit });
  return flights.slice(0, limit);
}

// Get cancelled flights for an airport (high-signal for disruption).
export async function fetchCancellations(iataCode, limit = 50) {
  const flights = await fetchEndpoint('schedules', { dep_iata: iataCode, limit: 200 });
  return flights.filter(f => f.cancelled).slice(0, limit);
}

// Get currently delayed flights (>30 min) departing an airport.
export async function fetchDelays(iataCode, limit = 50) {
  const flights = await fetchEndpoint('delays', { dep_iata: iataCode, type: 'departures', delay: 30, limit });
  return flights.slice(0, limit);
}

export default {
  isConfigured,
  fetchDepartures,
  fetchArrivals,
  fetchCancellations,
  fetchDelays,
};
