// opensky.js — OpenSky Network connector for live ADS-B flight data.
// Free, anonymous access (400 credits/day). No API key required.
// Source: https://opensky-network.org/api
//
// Provides:
//   - Live state vectors (position, velocity, altitude, on-ground, callsign)
//   - Departures/arrivals per airport (actual times only — no schedules)
//
// Rate limits (anonymous, bucketed by IP):
//   400 credits/day for /states/*, /flights/*, /tracks/*
//   Min 10s between /states/* polls recommended
//
// Authentication (optional, for higher limits):
//   OAuth2 client credentials — set OPENSKY_CLIENT_ID + OPENSKY_CLIENT_SECRET env vars.

import { fetchWithTimeout } from './http-utils.js';
import { configureRateLimit, waitForToken, updateFromHeaders } from '../data/rate-limiter.js';
import * as refLoader from '../data/reference-loader.js';

const BASE = 'https://opensky-network.org/api';
const AUTH_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('opensky', 'timeout_ms', 12000);
const STATES_CACHE_TTL = 60 * 1000;       // 1 min
const FLIGHTS_CACHE_TTL_OPEN = 10 * 60 * 1000;  // 10 min — window still filling
const FLIGHTS_CACHE_TTL_CLOSED = 24 * 3600 * 1000; // 24h — completed windows are immutable

// Rate limiter: anonymous ~400 credits/day (0.005/s).
// With OAuth credentials the quota is ~4000/day → 0.04/s, sized at fetch time
// since env vars are read after module load.
configureRateLimit('opensky', { capacity: 10, refillPerSec: 0.005 });
let _rlAdjusted = false;

let statesCache = { data: null, time: 0, bbox: null };
const flightsCache = new Map(); // key: `${type}:${icao}:${since}` → { data, time }
let allFlightsCache = { data: null, time: 0 };
let allFlightsFailUntil = 0;            // backoff timestamp on quota exhaustion
const ALL_FLIGHTS_TTL = 10 * 60 * 1000; // 10 min — all agents share one global fetch
const ALL_FLIGHTS_FAIL_BACKOFF = 30 * 60 * 1000; // 30 min retry backoff on failure

let allStatesCache = { data: null, time: 0 };
const ALL_STATES_TTL = 90 * 1000;       // 90s — one global call shared by all agents

let authToken = null;
let tokenExpiry = 0;

async function getAuthToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null; // anonymous
  if (authToken && Date.now() < tokenExpiry) return authToken;
  try {
    const res = await fetchWithTimeout(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    }, _timeout());
    if (res.ok) {
      const data = await res.json();
      authToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return authToken;
    }
  } catch (err) {
    console.error('[opensky] auth failed:', err.message);
  }
  return null;
}

async function openskyFetch(path) {
  if (!_rlAdjusted && process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
    configureRateLimit('opensky', { capacity: 20, refillPerSec: 0.04 });
    _rlAdjusted = true;
  }
  await waitForToken('opensky');
  const token = await getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetchWithTimeout(`${BASE}${path}`, { headers }, _timeout());
  updateFromHeaders('opensky', Object.fromEntries(res.headers.entries()));
  if (!res.ok) throw new Error(`OpenSky ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Live state vectors for a bounding box ───────────────────────────
// bbox = [lonMin, latMin, lonMax, latMax]
export async function fetchStatesByBbox(bbox) {
  const key = bbox.join(',');
  if (statesCache.data && Date.now() - statesCache.time < STATES_CACHE_TTL && statesCache.bbox === key) {
    return statesCache.data;
  }
  try {
    const data = await openskyFetch(`/states/all?bbox=${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);
    const states = (data.states || []).filter(s => s && s[1]); // keep only with callsign
    statesCache = { data: states, time: Date.now(), bbox: key };
    return states;
  } catch (err) {
    console.error('[opensky] states fetch failed:', err.message);
    return statesCache.data || [];
  }
}

// ── Departures/arrivals for an airport (actual times) ────────────────
// ICAO code, time range in Unix epoch seconds.
export async function fetchDepartures(icao, since, until) {
  return fetchFlights('departure', icao, since, until);
}
export async function fetchArrivals(icao, since, until) {
  return fetchFlights('arrival', icao, since, until);
}

// ── All live aircraft states globally ────────────────────────────────
// One call returns every tracked aircraft (~15k). Cached 90s and shared
// across all agents — each filters to its own region bbox client-side.
// ~1 call/90s ≈ 960 credits/day, within the authenticated budget.
export async function fetchAllStates() {
  if (allStatesCache.data && Date.now() - allStatesCache.time < ALL_STATES_TTL) {
    return allStatesCache.data;
  }
  try {
    const data = await openskyFetch('/states/all');
    allStatesCache = { data: (data.states || []).filter(s => s && s[1]), time: Date.now() };
    return allStatesCache.data;
  } catch (err) {
    console.error('[opensky] states/all fetch failed:', err.message);
    return allStatesCache.data || [];
  }
}

// ── All flights globally in a time window (≤2h per OpenSky docs) ─────
// One API call covers every airport — agents filter to their region.
// Cached 10 min so all flight agents share a single request per poll cycle.
export async function fetchAllFlights(since, until) {
  if (allFlightsCache.data && Date.now() - allFlightsCache.time < ALL_FLIGHTS_TTL) {
    return allFlightsCache.data;
  }
  if (Date.now() < allFlightsFailUntil) {
    // Rate-limit backoff — don't hammer an exhausted bucket every poll.
    return allFlightsCache.data || [];
  }
  const span = Math.min(until - since, 2 * 3600 - 60); // API caps interval at 2h
  const end = until;
  const begin = end - span;
  try {
    const data = await openskyFetch(`/flights/all?begin=${begin}&end=${end}`);
    allFlightsCache = { data: data || [], time: Date.now() };
    return allFlightsCache.data;
  } catch (err) {
    console.error('[opensky] flights/all fetch failed:', err.message);
    allFlightsFailUntil = Date.now() + ALL_FLIGHTS_FAIL_BACKOFF;
    return allFlightsCache.data || [];
  }
}

async function fetchFlights(type, icao, since, until) {
  // Quantize window to 1-hour buckets so the cache actually hits across
  // agent poll cycles (raw `since` changes every poll → zero hits).
  // ~60 airports × dep+arr = ~120 API calls/hour ≈ 2,880 credits/day —
  // fits the authenticated ~4k/day budget (anonymous would exhaust fast).
  const qSince = Math.floor(since / 3600) * 3600;
  const qUntil = Math.floor(until / 3600) * 3600;
  const key = `${type}:${icao}:${qSince}:${qUntil}`;
  // A window that fully ended is immutable — cache it long.
  const ttl = qUntil * 1000 <= Date.now() - 60 * 1000 ? FLIGHTS_CACHE_TTL_CLOSED : FLIGHTS_CACHE_TTL_OPEN;
  const cached = flightsCache.get(key);
  if (cached && Date.now() - cached.time < ttl) return cached.data;
  try {
    const data = await openskyFetch(`/flights/${type}?airport=${icao}&begin=${qSince}&end=${qUntil}`);
    flightsCache.set(key, { data, time: Date.now() });
    return data;
  } catch (err) {
    // OpenSky returns 404 when no flights exist for the airport/window — treat as empty, not an error
    if (!/404/.test(err.message)) {
      console.error(`[opensky] ${type} fetch failed for ${icao}:`, err.message);
    }
    const empty = cached?.data || [];
    flightsCache.set(key, { data: empty, time: Date.now() });
    return empty;
  }
}

// ── Normalize a state vector into a flight observation ─────────────
// State vector array indices (per OpenSky API):
// 0: icao24, 1: callsign, 2: origin_country, 3: time_position,
// 4: last_contact, 5: longitude, 6: latitude, 7: baro_altitude,
// 8: on_ground, 9: velocity, 10: true_track, 11: vertical_rate
export function parseStateVector(sv) {
  return {
    icao24: sv[0],
    callsign: (sv[1] || '').trim(),
    originCountry: sv[2],
    longitude: sv[5],
    latitude: sv[6],
    altitudeM: sv[7],
    onGround: sv[8],
    velocityMs: sv[9],
    heading: sv[10],
  };
}

export default {
  fetchStatesByBbox,
  fetchAllStates,
  fetchDepartures,
  fetchArrivals,
  fetchAllFlights,
  parseStateVector,
};
