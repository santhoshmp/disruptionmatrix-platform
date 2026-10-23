// aviationweather.js — Real connector for NOAA/NWS Aviation Weather Center API
// Free, no API key required. Rate limit: 100 requests/minute.
// Base URL: https://aviationweather.gov/api/data
//
// Provides: METAR (observations), TAF (forecasts), SIGMET (weather warnings)

import { ICAO_TO_IATA } from '../engine/agent-base.js';
import * as refLoader from '../data/reference-loader.js';

const BASE_URL = 'https://aviationweather.gov/api/data';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('aviationweather', 'timeout_ms', 8000);

// Simple in-memory rate limiter (100 req/min)
let requestCount = 0;
let windowStart = Date.now();
const RATE_LIMIT = 95; // leave a small buffer

async function rateLimit() {
  const now = Date.now();
  if (now - windowStart > 60000) {
    requestCount = 0;
    windowStart = now;
  }
  if (requestCount >= RATE_LIMIT) {
    const waitMs = 60000 - (now - windowStart);
    console.log(`[aviationweather] Rate limit reached, waiting ${Math.round(waitMs / 1000)}s...`);
    await new Promise(r => setTimeout(r, waitMs));
    requestCount = 0;
    windowStart = Date.now();
  }
  requestCount++;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), _timeout());
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch METAR observations for a list of ICAO codes
export async function fetchMETAR(icaoCodes) {
  if (!icaoCodes || icaoCodes.length === 0) return [];
  await rateLimit();
  const ids = icaoCodes.slice(0, 50).join(',');
  const url = `${BASE_URL}/metar?ids=${ids}&format=json&taf=false`;
  try {
    const data = await fetchWithTimeout(url);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[aviationweather] METAR fetch error:', err.message);
    return [];
  }
}

// Fetch TAF forecasts for a list of ICAO codes
export async function fetchTAF(icaoCodes) {
  if (!icaoCodes || icaoCodes.length === 0) return [];
  await rateLimit();
  const ids = icaoCodes.slice(0, 50).join(',');
  const url = `${BASE_URL}/taf?ids=${ids}&format=json`;
  try {
    const data = await fetchWithTimeout(url);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[aviationweather] TAF fetch error:', err.message);
    return [];
  }
}

// Fetch SIGMETs within a bounding box
export async function fetchSIGMET(bbox) {
  if (!bbox) return [];
  await rateLimit();
  // aviationweather.gov uses minLon,minLat,maxLon,maxLat format
  const bboxStr = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
  const url = `${BASE_URL}/sigmet?format=json&bbox=${bboxStr}`;
  try {
    const data = await fetchWithTimeout(url);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[aviationweather] SIGMET fetch error:', err.message);
    return [];
  }
}

// Fetch METAR + TAF together (combined request)
export async function fetchMETARandTAF(icaoCodes) {
  if (!icaoCodes || icaoCodes.length === 0) return { metars: [], tafs: [] };
  await rateLimit();
  const ids = icaoCodes.slice(0, 50).join(',');
  const url = `${BASE_URL}/metar?ids=${ids}&format=json&taf=true`;
  try {
    const data = await fetchWithTimeout(url);
    return { metars: Array.isArray(data) ? data : [], tafs: [] };
  } catch (err) {
    console.error('[aviationweather] METAR+TAF fetch error:', err.message);
    return { metars: [], tafs: [] };
  }
}

// ── Parsing helpers ─────────────────────────────────────────────────

// Parse a METAR observation into a hazard assessment
export function parseMETAR(metar) {
  const icao = metar.icaoId || metar.stationId || '';
  const iata = ICAO_TO_IATA[icao] || icao;

  // Visibility: API returns `visib` in statute miles — convert to meters
  // (Some stations return `visibility` in meters, so check both)
  let visMeters = 9999;
  if (metar.visibility != null) {
    visMeters = metar.visibility; // already meters
  } else if (metar.visib != null) {
    visMeters = Math.round(metar.visib * 1609.34); // statute miles → meters
  }

  const windSpeed = metar.wspd || metar.windSpeed || 0; // knots
  const windGust = metar.gust || 0;

  // Ceiling: API may return `ceil` (feet) or we parse from raw text
  let ceiling = metar.ceil || 99999;
  if (ceiling == null || ceiling === 0) {
    // Parse from raw text: BKN018 = broken ceiling at 1800ft
    const rawOb = metar.rawOb || metar.raw_text || '';
    const ceilMatch = rawOb.match(/(BKN|OVC)(\d{3})/);
    if (ceilMatch) ceiling = parseInt(ceilMatch[2]) * 100;
  }

  const temp = metar.temp || 0;
  const obsText = metar.obstime || metar.obsTime || '';
  const rawOb = metar.rawOb || metar.raw_text || '';

  // Detect hazards
  const hazards = [];

  // Fog: visibility < 1000m
  if (visMeters < 1000) {
    hazards.push({
      type: 'fog',
      severity: visMeters < 200 ? 'critical' : visMeters < 500 ? 'high' : 'moderate',
      detail: `Visibility ${visMeters}m — ${visMeters < 200 ? 'below CAT IIIB minima' : visMeters < 550 ? 'below CAT I minima' : 'reduced'}`,
    });
  }

  // Low visibility: 1000–5000m
  if (visMeters >= 1000 && visMeters < 5000) {
    hazards.push({
      type: 'low_visibility',
      severity: 'moderate',
      detail: `Visibility ${visMeters}m — reduced operations likely`,
    });
  }

  // Strong winds: gusts > 35 kt
  if (windGust > 35 || windSpeed > 30) {
    hazards.push({
      type: 'strong_wind',
      severity: windGust > 50 ? 'critical' : windGust > 40 ? 'high' : 'moderate',
      detail: `Wind ${windSpeed}kt${windGust ? ` gusting ${windGust}kt` : ''} — crosswind limits may be exceeded`,
    });
  }

  // Low ceiling: < 500ft
  if (ceiling < 500 && ceiling > 0) {
    hazards.push({
      type: 'low_ceiling',
      severity: ceiling < 200 ? 'high' : 'moderate',
      detail: `Ceiling ${ceiling}ft — IFR conditions`,
    });
  }

  // Thunderstorm detection from raw text
  if (rawOb.includes('TS') || rawOb.includes('TSGR') || rawOb.includes('CB')) {
    hazards.push({
      type: 'thunderstorm',
      severity: rawOb.includes('TSGR') ? 'high' : 'moderate',
      detail: 'Thunderstorm activity reported in vicinity',
    });
  }

  // Snow / ice
  if (rawOb.includes('SN') || rawOb.includes('FZRA') || rawOb.includes('IC')) {
    hazards.push({
      type: 'snow_ice',
      severity: rawOb.includes('FZRA') ? 'high' : 'moderate',
      detail: 'Winter precipitation — de-icing required',
    });
  }

  return {
    icao,
    iata,
    vis: visMeters,
    windSpeed,
    windGust,
    ceiling,
    temp,
    obsTime: obsText,
    rawOb,
    hazards,
    lat: metar.lat || null,
    lon: metar.lon || null,
  };
}

// Parse a SIGMET into a hazard assessment
export function parseSIGMET(sigmet) {
  const rawSigmet = sigmet.rawSigmet || sigmet.raw_text || '';
  const icao = sigmet.icaoId || '';
  const iata = ICAO_TO_IATA[icao] || '';

  // Determine hazard type
  let hazardType = 'weather';
  let severity = 'moderate';
  if (rawSigmet.includes('TS') || rawSigmet.includes('THUNDERSTORM')) {
    hazardType = 'thunderstorm';
    severity = rawSigmet.includes('EMBD') || rawSigmet.includes('SEV') ? 'high' : 'moderate';
  } else if (rawSigmet.includes('ICE') || rawSigmet.includes('ICING')) {
    hazardType = 'icing';
    severity = 'moderate';
  } else if (rawSigmet.includes('TURB') || rawSigmet.includes('TURBULENCE')) {
    hazardType = 'turbulence';
    severity = rawSigmet.includes('SEV') ? 'high' : 'moderate';
  } else if (rawSigmet.includes('ASH') || rawSigmet.includes('VOLCANIC')) {
    hazardType = 'volcanic_ash';
    severity = 'critical';
  } else if (rawSigmet.includes('HURRICANE') || rawSigmet.includes('TROPICAL')) {
    hazardType = 'tropical_cyclone';
    severity = 'critical';
  }

  return {
    icao,
    iata,
    hazardType,
    severity,
    rawSigmet,
    lat: sigmet.lat || null,
    lon: sigmet.lon || null,
  };
}

export default {
  fetchMETAR,
  fetchTAF,
  fetchSIGMET,
  fetchMETARandTAF,
  parseMETAR,
  parseSIGMET,
};
