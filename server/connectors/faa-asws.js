// faa-asws.js — FAA Airport Status Web Service connector
// Free, no API key required. Provides live airport delay info for major US airports.
// Source: https://external-api.faa.gov/asws/api/airport/delays
// Also: https://nasstatus.faa.gov/api/airport-status-information
//
// Returns: ground stops, ground delay programs, arrival/departure delays, closures

import { fetchWithTimeout } from './http-utils.js';

const ASWS_URL = 'https://external-api.faa.gov/asws/api/airport/delays';
const NASSTATUS_URL = 'https://nasstatus.faa.gov/api/airport-status-information';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache

let cache = null;
let cacheTime = 0;

// US airports covered by FAA ASWS
const ASWS_AIRPORTS = new Set([
  'BOS', 'LGA', 'TEB', 'EWR', 'JFK', 'PHL', 'PIT', 'IAD', 'BWI', 'DCA',
  'RDU', 'CLT', 'ATL', 'MCO', 'TPA', 'FLL', 'MIA', 'DTW', 'CLE', 'MDW',
  'ORD', 'IND', 'CVG', 'BNA', 'MEM', 'STL', 'MCI', 'MSP', 'DFW', 'IAH',
  'DEN', 'SLC', 'PHX', 'LAS', 'SAN', 'LAX', 'SJC', 'SFO', 'PDX', 'SEA',
]);

export function isASWSAirport(iata) {
  return ASWS_AIRPORTS.has(iata);
}

export async function fetchAirportDelays() {
  // Check cache
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  let delays = [];

  // Try ASWS endpoint first
  try {
    const res = await fetchWithTimeout(ASWS_URL, {}, TIMEOUT_MS);
    if (res.ok) {
      const data = await res.json();
      delays = parseASWSResponse(data);
    }
  } catch (err) {
    console.error('[faa-asws] ASWS fetch failed:', err.message);
  }

  // Fallback: try NAS Status endpoint
  if (delays.length === 0) {
    try {
      const res = await fetchWithTimeout(NASSTATUS_URL, {}, TIMEOUT_MS);
      if (res.ok) {
        const text = await res.text();
        delays = parseNASStatusXML(text);
      }
    } catch (err) {
      console.error('[faa-asws] NAS Status fetch failed:', err.message);
    }
  }

  cache = delays;
  cacheTime = Date.now();
  return delays;
}

function parseASWSResponse(data) {
  const delays = [];
  const items = Array.isArray(data) ? data : (data.delays || data.items || []);

  for (const item of items) {
    const airport = item.airport || item.code || item.iata;
    if (!airport) continue;

    const delayType = (item.type || item.delayType || '').toLowerCase();
    const reason = item.reason || item.cause || '';
    const trend = item.trend || '';
    const minDelay = parseInt(item.minDelay || item.arrivalDelay || '0', 10) || 0;

    // Only emit if there's an actual delay/ground stop/closure
    if (!delayType && !reason && minDelay === 0) continue;

    delays.push({
      airport: airport.toUpperCase(),
      delayType: delayType || 'delay',
      reason,
      trend,
      minDelay,
      status: item.status || 'delayed',
    });
  }

  return delays;
}

function parseNASStatusXML(text) {
  // NAS Status returns XML — extract airport codes and delay info
  const delays = [];
  const airportMatches = text.match(/<Airport\s+.*?<\/Airport>/g) || [];

  for (const block of airportMatches) {
    const code = block.match(/code="(.*?)"/)?.[1] || block.match(/<Code>(.*?)<\/Code>/)?.[1];
    if (!code) continue;

    const status = block.match(/<Status>(.*?)<\/Status>/)?.[1] || '';
    const reason = block.match(/<Reason>(.*?)<\/Reason>/)?.[1] || '';
    const minDelay = parseInt(block.match(/<MinDelay>(.*?)<\/MinDelay>/)?.[1] || '0', 10) || 0;

    if (status.toLowerCase().includes('delay') || status.toLowerCase().includes('ground stop') || minDelay > 0) {
      delays.push({
        airport: code.toUpperCase(),
        delayType: status.toLowerCase().includes('ground stop') ? 'ground_stop' : 'delay',
        reason,
        trend: '',
        minDelay,
        status: status,
      });
    }
  }

  return delays;
}

// Build observation objects from delay data
export function buildDelayObservations(delays, region, subRegion) {
  const observations = [];

  for (const d of delays) {
    const severity = d.minDelay >= 60 ? 'high' : d.minDelay >= 30 ? 'moderate' : 'low';
    const sevVal = severity === 'high' ? 75 : severity === 'moderate' ? 55 : 35;

    observations.push({
      signalId: `atc-asws-${d.airport}-${Date.now()}`,
      detected: new Date().toISOString(),
      name: `${d.airport} ${d.delayType.replace(/_/g, ' ')} — ${d.reason || 'FAA delay reported'}`,
      hazardType: d.delayType === 'ground_stop' ? 'ground_stop' : 'airport_delay',
      geo: { lat: 0, lon: 0, radiusKm: 100 }, // FAA doesn't provide coords
      airports: [d.airport],
      airspace: [],
      summary: d.reason || `${d.airport}: ${d.delayType}, ${d.minDelay} min delay`,
      factorHints: {
        probability: 85,
        severity: sevVal,
        geographicReach: 30,
        expectedDuration: d.minDelay > 0 ? Math.min(d.minDelay * 2, 90) : 45,
        timeToImpact: 90,
        escalationRate: d.trend === 'increasing' ? 60 : 30,
        sourceCredibility: 90, // FAA official
        predictionConfidence: 80,
      },
      domains: ['Flight schedule', 'Aircraft rotations', 'Airport operations'],
      preliminaryEffects: [
        { ord: 1, title: `${d.minDelay} min delays at ${d.airport}`, lead: '0–1h' },
      ],
      evidence: [{
        source: 'FAA Airport Status Web Service (ASWS)',
        tier: 1,
        role: 'Primary ATFM source',
        timestamp: new Date().toISOString(),
        excerpt: `${d.airport}: ${d.delayType}, ${d.reason}, ${d.minDelay} min`,
      }],
      rawRefs: [`faa-asws-${d.airport}-${Date.now()}`],
      dataSourceMode: 'real',
    });
  }

  return observations;
}

export default { fetchAirportDelays, buildDelayObservations, isASWSAirport };
