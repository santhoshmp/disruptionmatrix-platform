// adsblol.js — adsb.lol community ADS-B connector.
// Free, no API key. Point-radius queries for live aircraft positions.
// Source: https://api.adsb.lol/
//
// Provides live positions only (no schedules/statuses). Ground aircraft
// are marked alt_baro === 'ground'. Community feeder network — coverage
// often denser than OpenSky in the Gulf/Asia regions.
//
// Fair use: keep under ~1 req/s. We cache per-airport for 5 min.

import { fetchWithTimeout } from './http-utils.js';
import { configureRateLimit, waitForToken } from '../data/rate-limiter.js';
import * as refLoader from '../data/reference-loader.js';

const BASE = 'https://api.adsb.lol';
// adsb.lol returns 403 for default node/undici User-Agent — send an explicit one.
const HEADERS = { 'User-Agent': 'DisruptionMatrix/1.0 (aviation threat-intelligence app)' };
const _timeout = () => refLoader.getConnectorConfig('adsblol', 'timeout_ms', 10000);
const CACHE_TTL = 5 * 60 * 1000; // 5 min per query

// ~0.5 req/s sustained — well under fair-use, allows small bursts.
configureRateLimit('adsblol', { capacity: 10, refillPerSec: 0.5 });

const cache = new Map(); // key: `${lat},${lon},${radius}` → { data, time }

// Aircraft within radiusNm of a point. Returns parsed aircraft objects:
// { hex, flight, lat, lon, altBaro, onGround, groundSpeed, callsign }
export async function fetchAircraftNearPoint(lat, lon, radiusNm = 15) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${radiusNm}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;
  await waitForToken('adsblol');
  try {
    const res = await fetchWithTimeout(`${BASE}/v2/point/${lat}/${lon}/${radiusNm}`, { headers: HEADERS }, _timeout());
    if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
    const data = await res.json();
    const ac = (data.ac || []).map(normalizeAircraft);
    cache.set(key, { data: ac, time: Date.now() });
    return ac;
  } catch (err) {
    console.error(`[adsblol] point fetch failed for ${key}:`, err.message);
    return cached?.data || [];
  }
}

// Aircraft near an airport (IATA). Looks up coords via master data.
export async function fetchAircraftNearAirport(iata, radiusNm = 15) {
  const ap = refLoader.getAirport(iata);
  if (!ap || ap.lat == null) return [];
  return fetchAircraftNearPoint(ap.lat, ap.lon, radiusNm);
}

function normalizeAircraft(a) {
  const onGround = a.alt_baro === 'ground';
  return {
    hex: a.hex,
    callsign: (a.flight || '').trim() || null,
    registration: a.r || null,
    aircraftType: a.t || null,
    lat: a.lat,
    lon: a.lon,
    altBaro: a.alt_baro,
    onGround,
    groundSpeed: a.gs,
    emergency: a.emergency && a.emergency !== 'none' ? a.emergency : null,
    squawk: a.squawk || null,
  };
}

export default {
  fetchAircraftNearPoint,
  fetchAircraftNearAirport,
};
