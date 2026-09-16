// nasa-eonet.js — NASA Earth Observatory Natural Event Tracker connector
// Free, no API key. Global natural disaster events: wildfires, volcanoes, severe storms, floods.
// Source: https://eonet.gsfc.nasa.gov/api/v3/events
//
// Categories: wildfires, severeStorms, volcanoes, seaLakeIce, earthquakes (via USGS), floods, drought, dustHaze, landslides, snow, tempExtremes
// Each event has: id, title, category, geometry (point or polygon), sources, date

import { fetchWithTimeout } from './http-utils.js';

const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min cache

let cache = null;
let cacheTime = 0;

// EONET categories relevant to aviation disruption
const AVIATION_CATEGORIES = [
  'wildfires', 'severeStorms', 'volcanoes', 'floods', 'dustHaze',
  'snow', 'tempExtremes', 'seaLakeIce',
];

export async function fetchEvents(options = {}) {
  const { status = 'open', limit = 50, days = 7, category } = options;

  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return filterEvents(cache, { category });
  }

  let events = [];

  try {
    let url = `${EONET_URL}?status=${status}&limit=${limit}`;
    if (days) url += `&days=${days}`;

    const res = await fetchWithTimeout(url, {}, TIMEOUT_MS);
    if (res.ok) {
      const data = await res.json();
      events = data.events || [];
    }
  } catch (err) {
    console.error('[nasa-eonet] fetch failed:', err.message);
  }

  cache = events;
  cacheTime = Date.now();
  return filterEvents(events, { category });
}

function filterEvents(events, { category }) {
  if (!category) {
    // Filter to aviation-relevant categories
    return events.filter((e) => {
      const cats = (e.categories || []).map((c) => c.id);
      return cats.some((c) => AVIATION_CATEGORIES.includes(c));
    });
  }
  return events.filter((e) => {
    const cats = (e.categories || []).map((c) => c.id);
    return cats.includes(category);
  });
}

// Filter events by bounding box
export function filterByBbox(events, bbox) {
  if (!bbox) return events;
  return events.filter((e) => {
    const geoms = e.geometry || [];
    for (const g of geoms) {
      if (g.type === 'Point' && g.coordinates) {
        const [lon, lat] = g.coordinates;
        if (lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon) {
          return true;
        }
      }
      if (g.type === 'Polygon' && g.coordinates) {
        const ring = g.coordinates[0];
        const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        const lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
        if (lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon) {
          return true;
        }
      }
    }
    return false;
  });
}

// Build observations from EONET events
export function buildEonetObservations(events, region, subRegion) {
  const observations = [];

  for (const event of events) {
    const cats = (event.categories || []).map((c) => c.id);
    const primaryCat = cats[0] || 'unknown';
    const title = event.title || 'Natural event';

    // Get most recent geometry
    const geoms = event.geometry || [];
    const latestGeom = geoms[geoms.length - 1] || geoms[0];
    let lat = 0, lon = 0;

    if (latestGeom?.coordinates) {
      if (latestGeom.type === 'Point') {
        [lon, lat] = latestGeom.coordinates;
      } else if (latestGeom.type === 'Polygon') {
        const ring = latestGeom.coordinates[0];
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      }
    }

    // Map EONET category to hazard type + severity
    const hazardMap = {
      wildfires: { hazard: 'wildfire', severity: 'high', sevVal: 72, domains: ['Airport operations', 'Flight schedule', 'Air quality'] },
      severeStorms: { hazard: 'severe_storm', severity: 'high', sevVal: 75, domains: ['Airport operations', 'Flight schedule'] },
      volcanoes: { hazard: 'volcanic_ash', severity: 'critical', sevVal: 88, domains: ['Airport operations', 'Flight schedule', 'Air quality'] },
      floods: { hazard: 'flooding', severity: 'moderate', sevVal: 55, domains: ['Airport operations', 'Ground access'] },
      dustHaze: { hazard: 'dust_haze', severity: 'moderate', sevVal: 50, domains: ['Airport operations', 'Flight schedule'] },
      snow: { hazard: 'snow', severity: 'moderate', sevVal: 55, domains: ['Airport operations', 'Flight schedule'] },
      tempExtremes: { hazard: 'extreme_temp', severity: 'low', sevVal: 40, domains: ['Airport operations'] },
      seaLakeIce: { hazard: 'ice', severity: 'low', sevVal: 35, domains: ['Airport operations'] },
    };

    const mapping = hazardMap[primaryCat] || { hazard: 'natural_event', severity: 'low', sevVal: 35, domains: ['Airport operations'] };

    // Source URLs for evidence
    const sources = (event.sources || []).map((s) => s.url).filter(Boolean);
    const sourceNames = (event.sources || []).map((s) => s.id).join(', ');

    observations.push({
      signalId: `eonet-${event.id}-${Date.now()}`,
      detected: event.geometry?.[0]?.date || new Date().toISOString(),
      name: title,
      hazardType: mapping.hazard,
      geo: { lat, lon, radiusKm: primaryCat === 'volcanoes' ? 300 : 150 },
      airports: [],
      airspace: [],
      summary: `${title} — NASA EONET ${primaryCat} event${sourceNames ? ' (sources: ' + sourceNames + ')' : ''}`,
      factorHints: {
        probability: 75,
        severity: mapping.sevVal,
        geographicReach: primaryCat === 'volcanoes' ? 70 : 45,
        expectedDuration: primaryCat === 'volcanoes' ? 85 : 50,
        timeToImpact: 70,
        escalationRate: primaryCat === 'severeStorms' ? 65 : 35,
        sourceCredibility: 85, // NASA
        predictionConfidence: 70,
      },
      domains: mapping.domains,
      preliminaryEffects: [
        { ord: 1, title: `${mapping.hazard.replace(/_/g, ' ')} affecting airspace/airport ops`, lead: '0–6h' },
      ],
      evidence: [{
        source: `NASA EONET (${sourceNames || 'Earth Observatory'})`,
        tier: 1,
        role: 'Primary natural event source',
        timestamp: event.geometry?.[0]?.date || new Date().toISOString(),
        excerpt: title,
        url: sources[0] || `https://eonet.gsfc.nasa.gov/api/v3/events/${event.id}`,
      }],
      rawRefs: [`eonet-${event.id}`],
      dataSourceMode: 'real',
    });
  }

  return observations;
}

export default { fetchEvents, filterByBbox, buildEonetObservations, AVIATION_CATEGORIES };
