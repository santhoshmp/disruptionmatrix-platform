// faa-tfr.js — FAA Temporary Flight Restrictions connector
// Free, no API key. Returns active TFRs nationwide (VIP, disasters, special events).
// Source: https://tfr.faa.gov/tfrapi/exportTfrList (JSON)
// Also WFS: https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=TFR:V_TFR_LOC&outputFormat=application/json
//
// TFRs cover: VIP movements (presidential), disaster response, special events,
// airspace closures, wildfire restrictions, stadium/venue restrictions.

import { fetchWithTimeout } from './http-utils.js';
import { findAirportsWithin } from '../data/airport-lookup.js';
import * as refLoader from '../data/reference-loader.js';

const TFR_API_URL = 'https://tfr.faa.gov/tfrapi/exportTfrList';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('faa_tfr', 'timeout_ms', 10000);
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min cache

let cache = null;
let cacheTime = 0;

export async function fetchTFRs() {
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  let tfrs = [];

  try {
    const res = await fetchWithTimeout(TFR_API_URL, {}, _timeout());
    if (res.ok) {
      const data = await res.json();
      tfrs = parseTFRResponse(data);
    }
  } catch (err) {
    console.error('[faa-tfr] fetch failed:', err.message);
  }

  cache = tfrs;
  cacheTime = Date.now();
  return tfrs;
}

function parseTFRResponse(data) {
  const tfrs = [];
  const items = Array.isArray(data) ? data : (data.features || data.items || []);

  for (const item of items) {
    // Handle GeoJSON Feature format
    const props = item.properties || item;
    const geom = item.geometry;

    const id = props.id || props.notamNumber || props.NOTAM || '';
    const name = props.name || props.title || props.type || 'TFR';
    const reason = props.reason || props.purpose || '';
    const type = (props.type || props.category || '').toLowerCase();

    // Coordinates — try GeoJSON, then explicit fields
    let lat = 0, lon = 0;
    if (geom?.coordinates) {
      const coords = geom.coordinates;
      if (geom.type === 'Point' && Array.isArray(coords)) {
        [lon, lat] = coords;
      } else if (Array.isArray(coords[0])) {
        // Polygon — use centroid of first ring
        const ring = coords[0];
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
        lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      }
    } else {
      lat = parseFloat(props.latitude || props.lat || '0') || 0;
      lon = parseFloat(props.longitude || props.lon || '0') || 0;
    }

    const startTime = props.startDate || props.effectiveTime || props.start || '';
    const endTime = props.endDate || props.expireTime || props.end || '';
    const altitudeFloor = parseInt(props.altitudeFloor || props.lowerAltitude || '0', 10) || 0;
    const altitudeCeiling = parseInt(props.altitudeCeiling || props.upperAltitude || '18000', 10) || 18000;

    tfrs.push({
      id,
      name,
      reason,
      type: type || 'tfr',
      lat,
      lon,
      startTime,
      endTime,
      altitudeFloor,
      altitudeCeiling,
      rawText: props.rawText || props.text || '',
    });
  }

  return tfrs;
}

// Filter TFRs by bounding box
export function filterTFRsByBbox(tfrs, bbox) {
  if (!bbox) return tfrs;
  return tfrs.filter((t) =>
    t.lat >= bbox.minLat && t.lat <= bbox.maxLat &&
    t.lon >= bbox.minLon && t.lon <= bbox.maxLon
  );
}

// Build observations from TFRs
export function buildTFRObservations(tfrs, region, subRegion) {
  const observations = [];

  for (const tfr of tfrs) {
    // Determine severity by type
    let severity = 'moderate';
    let sevVal = 55;
    const type = tfr.type.toLowerCase();

    if (type.includes('vip') || type.includes('presidential')) {
      severity = 'high'; sevVal = 70;
    } else if (type.includes('disaster') || type.includes('fire')) {
      severity = 'high'; sevVal = 68;
    } else if (type.includes('security') || type.includes('special')) {
      severity = 'moderate'; sevVal = 50;
    }

    observations.push({
      signalId: `geo-tfr-${tfr.id || tfr.name}-${Date.now()}`,
      detected: new Date().toISOString(),
      name: `TFR: ${tfr.name}${tfr.reason ? ' — ' + tfr.reason : ''}`,
      hazardType: 'airspace_restriction',
      geo: { lat: tfr.lat, lon: tfr.lon, radiusKm: 100 },
      airports: findAirportsWithin(tfr.lat, tfr.lon, 200).slice(0, 5).map((a) => a.iata),
      airspace: [tfr.name],
      summary: tfr.rawText || `${tfr.name}: ${tfr.reason}. Alt ${tfr.altitudeFloor}-${tfr.altitudeCeiling} ft.`,
      factorHints: {
        probability: 80,
        severity: sevVal,
        geographicReach: 40,
        expectedDuration: 60,
        timeToImpact: 85,
        escalationRate: 30,
        sourceCredibility: 90, // FAA official
        predictionConfidence: 85,
      },
      domains: ['Flight schedule', 'Aircraft rotations', 'Regulatory'],
      preliminaryEffects: [
        { ord: 1, title: 'Rerouting required for affected airspace', lead: '0–1h' },
      ],
      evidence: [{
        source: 'FAA TFR Feed (tfr.faa.gov)',
        tier: 1,
        role: 'Primary airspace restriction source',
        timestamp: new Date().toISOString(),
        excerpt: tfr.rawText || tfr.reason,
      }],
      rawRefs: [`faa-tfr-${tfr.id}-${Date.now()}`],
      dataSourceMode: 'real',
    });
  }

  return observations;
}

export default { fetchTFRs, filterTFRsByBbox, buildTFRObservations };
