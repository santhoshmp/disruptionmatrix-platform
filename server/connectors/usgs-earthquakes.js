// usgs-earthquakes.js — USGS Earthquake Hazards connector
// Free, no API key. Real-time global earthquake data.
// Source: https://earthquake.usgs.gov/fdsnws/event/1/query
//
// Returns: magnitude, location, depth, time, place, alert level (PAGER)
// Aviation relevance: earthquakes near airports can damage runways, terminals, ATC infrastructure.

import { fetchWithTimeout } from './http-utils.js';
import { findAirportsWithin, findNearestAirport } from '../data/airport-lookup.js';
import * as refLoader from '../data/reference-loader.js';

const USGS_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('usgs', 'timeout_ms', 10000);
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache

let cache = null;
let cacheTime = 0;

// Minimum magnitude to consider as a disruption signal
// Phase 5: read from DB-backed ref_connectors via loader
const MIN_MAGNITUDE = 4.5;

function _minMagnitude() {
  return refLoader.getConnectorConfig('usgs', 'min_magnitude', MIN_MAGNITUDE);
}

function _radiusKm(magnitude) {
  // Phase 5: radius from DB-backed ref_connectors via loader
  const large = refLoader.getConnectorConfig('usgs', 'radius_km_large', 500);
  const medium = refLoader.getConnectorConfig('usgs', 'radius_km_medium', 400);
  const small = refLoader.getConnectorConfig('usgs', 'radius_km_small', 350);
  if (magnitude >= 7) return large;
  if (magnitude >= 6) return medium;
  return small;
}

export async function fetchEarthquakes(options = {}) {
  const { minMagnitude = _minMagnitude(), bbox, days = 1 } = options;

  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return filterByBbox(cache, bbox);
  }

  let events = [];

  try {
    const now = new Date();
    const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    let url = `${USGS_URL}?format=geojson`;
    url += `&starttime=${startTime}`;
    url += `&minmagnitude=${minMagnitude}`;
    url += '&orderby=time';

    const res = await fetchWithTimeout(url, {}, _timeout());
    if (res.ok) {
      const data = await res.json();
      events = (data.features || []).map(parseUSGSFeature);
    }
  } catch (err) {
    console.error('[usgs-earthquakes] fetch failed:', err.message);
  }

  cache = events;
  cacheTime = Date.now();
  return filterByBbox(events, bbox);
}

function parseUSGSFeature(feature) {
  const props = feature.properties || {};
  const geom = feature.geometry || {};

  return {
    id: feature.id,
    magnitude: props.mag || 0,
    place: props.place || '',
    time: props.time ? new Date(props.time).toISOString() : new Date().toISOString(),
    updated: props.updated ? new Date(props.updated).toISOString() : null,
    url: props.url || '',
    detail: props.detail || '',
    tsunami: props.tsunami || 0,
    sig: props.sig || 0, // significance (1-1000)
    type: props.type || 'earthquake',
    title: props.title || '',
    alert: props.alert || '', // PAGER alert level: green, yellow, orange, red
    lat: geom.coordinates?.[1] || 0,
    lon: geom.coordinates?.[0] || 0,
    depth: geom.coordinates?.[2] || 0, // depth in km
  };
}

function filterByBbox(events, bbox) {
  if (!bbox) return events;
  return events.filter((e) =>
    e.lat >= bbox.minLat && e.lat <= bbox.maxLat &&
    e.lon >= bbox.minLon && e.lon <= bbox.maxLon
  );
}

// Build observations from earthquake data
export function buildEarthquakeObservations(events, region, subRegion) {
  const observations = [];

  for (const eq of events) {
    // Severity based on magnitude + PAGER alert
    let severity = 'low';
    let sevVal = 35;

    if (eq.magnitude >= 7.0 || eq.alert === 'red') {
      severity = 'critical'; sevVal = 88;
    } else if (eq.magnitude >= 6.0 || eq.alert === 'orange') {
      severity = 'high'; sevVal = 72;
    } else if (eq.magnitude >= 5.0 || eq.alert === 'yellow') {
      severity = 'moderate'; sevVal = 55;
    }

    // Resolve nearby airports from the earthquake's coordinates
    // Use a radius proportional to magnitude (larger quakes affect wider area)
    const radiusKm = _radiusKm(eq.magnitude);
    const nearbyAirports = findAirportsWithin(eq.lat, eq.lon, radiusKm);
    const airports = nearbyAirports.slice(0, 5).map((a) => a.iata);

    // Build a human-readable location description
    let locationDesc = eq.place;
    if (airports.length > 0) {
      const airportList = nearbyAirports
        .slice(0, 3)
        .map((a) => `${a.iata} (${a.name}, ${a.distanceKm}km)`)
        .join(', ');
      locationDesc = `${eq.place} — near ${airportList}`;
    }

    observations.push({
      signalId: `usgs-eq-${eq.id}-${Date.now()}`,
      detected: eq.time,
      name: `M${eq.magnitude.toFixed(1)} Earthquake — ${eq.place}`,
      hazardType: 'earthquake',
      geo: { lat: eq.lat, lon: eq.lon, radiusKm: eq.magnitude >= 6 ? 200 : 100 },
      airports,
      airspace: [],
      summary: `Magnitude ${eq.magnitude.toFixed(1)} earthquake ${eq.place}. Depth ${eq.depth} km.${eq.tsunami ? ' TSUNAMI WARNING ISSUED.' : ''}${eq.alert ? ` PAGER alert: ${eq.alert}.` : ''}${airports.length > 0 ? ` Nearest airport: ${nearbyAirports[0].iata} (${nearbyAirports[0].name}, ${nearbyAirports[0].distanceKm}km).` : ' No airports within the impact radius — no direct aviation impact.'}`,
      factorHints: {
        probability: 90, // earthquake already happened
        // Dampen aviation-relevant factors when no airport is in the impact
        // radius — a remote oceanic quake is a real event but not an
        // aviation disruption.
        severity: airports.length === 0 ? Math.min(sevVal, 25) : sevVal,
        geographicReach: airports.length === 0 ? 10 : (eq.magnitude >= 6 ? 65 : 40),
        expectedDuration: eq.magnitude >= 6 ? 70 : 40, // aftershocks
        timeToImpact: airports.length === 0 ? 35 : 95, // nothing aviation-side to impact
        escalationRate: airports.length === 0 ? 30 : 80, // no aviation path to escalate
        sourceCredibility: 95, // USGS
        predictionConfidence: 90,
        _airportCount: airports.length,
      },
      domains: ['Airport operations', 'Infrastructure', 'Ground access'],
      preliminaryEffects: [
        { ord: 1, title: 'Potential runway/terminal damage assessment required', lead: '0–2h' },
        { ord: 2, title: 'Aftershocks may disrupt operations', lead: '2–24h' },
      ],
      evidence: [{
        source: 'USGS Earthquake Hazards Program',
        tier: 1,
        role: 'Primary seismic source',
        timestamp: eq.time,
        excerpt: eq.title,
        url: eq.url,
      }],
      rawRefs: [`usgs-eq-${eq.id}`],
      dataSourceMode: 'real',
    });
  }

  return observations;
}

export default { fetchEarthquakes, buildEarthquakeObservations, MIN_MAGNITUDE: _minMagnitude() };
