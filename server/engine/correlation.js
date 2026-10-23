// correlation.js — Signal correlation engine
// Deduplicates, merges corroborating sources, and groups signals into candidate events.

import { agentTypeToCategory } from './scoring.js';
import * as refLoader from '../data/reference-loader.js';

// ── Hazard family mapping ───────────────────────────────────────────
// Maps specific hazard types to logical families so that the same physical
// phenomenon (e.g., fog at 451m vs fog at 547m vs low_visibility at 1593m)
// gets the same event ID across pipeline runs.
// Phase 5: uses DB-backed hazard family map, falls back to hardcoded const.
const HAZARD_FAMILY = {
  fog: 'visibility',
  low_visibility: 'visibility',
  low_ceiling: 'ceiling',
  thunderstorm: 'thunderstorm',
  snow_ice: 'winter',
  snow: 'winter',
  winter_precip: 'winter',
  strong_wind: 'wind',
  high_wind: 'wind',
  heavy_rain: 'rain',
  extreme_heat: 'heat',
  extreme_cold: 'cold',
  // Flight schedule disruptions
  cancellation: 'cancellation',
  cancelled: 'cancellation',
  massdelay: 'massdelay',
  delay: 'massdelay',
  groundstop: 'groundstop',
  grounddelay: 'groundstop',
  diversion: 'diversion',
  diverted: 'diversion',
  socialreport: 'socialreport',
};

export function hazardFamily(hazardType) {
  if (!hazardType) return null;
  // Phase 5: try DB-backed family first
  const fromDb = refLoader.getHazardFamily(hazardType);
  if (fromDb) return fromDb;
  return HAZARD_FAMILY[hazardType] || hazardType;
}

// ── Geo distance (haversine, km) ─────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Time distance (minutes) ──────────────────────────────────────────

function timeDeltaMin(t1, t2) {
  const d1 = new Date(t1).getTime();
  const d2 = new Date(t2).getTime();
  if (isNaN(d1) || isNaN(d2)) return 9999;
  return Math.abs(d1 - d2) / 60000;
}

// ── Dedup + group signals into candidate events ─────────────────────
// Two signals are "the same event" if:
//   - Same category (agent type maps to category)
//   - Geo centers within 200km
//   - Detected times within 60 minutes
//   - OR they share at least one airport AND times within 120 min

export function correlate(signals) {
  if (!signals || signals.length === 0) return [];

  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < signals.length; i++) {
    if (assigned.has(i)) continue;
    const group = [signals[i]];
    assigned.add(i);

    for (let j = i + 1; j < signals.length; j++) {
      if (assigned.has(j)) continue;
      if (_isCorrelated(signals[i], signals[j])) {
        group.push(signals[j]);
        assigned.add(j);
      }
    }
    groups.push(group);
  }

  // Merge each group into a candidate event
  return groups.map(mergeGroup);
}

function _isCorrelated(s1, s2) {
  const cat1 = agentTypeToCategory(s1.agentType);
  const cat2 = agentTypeToCategory(s2.agentType);
  if (cat1 !== cat2) return false;

  const geo1 = s1.geo || { lat: 0, lon: 0 };
  const geo2 = s2.geo || { lat: 0, lon: 0 };
  const geoDist = haversineKm(geo1.lat, geo1.lon, geo2.lat, geo2.lon);
  const timeDist = timeDeltaMin(s1.detected, s2.detected);

  // Same geo + time window
  if (geoDist <= 200 && timeDist <= 60) return true;

  // Shared airport + wider time window
  const sharedAirport = (s1.airports || []).some((a) => (s2.airports || []).includes(a));
  if (sharedAirport && timeDist <= 120) return true;

  return false;
}

// ── Merge a group of signals into a candidate event ──────────────────

export function mergeGroup(signals) {
  if (signals.length === 1) return _singleToCandidate(signals[0]);

  // Pick the signal with the highest average factor hints as the "primary"
  const primary = signals.reduce((best, s) => {
    const sScore = _avgFactorHints(s);
    const bestScore = _avgFactorHints(best);
    return sScore > bestScore ? s : best;
  });

  // Merge evidence from all signals
  const allEvidence = signals.flatMap((s) => s.evidence || []);

  // Merge airports (deduplicated)
  const airports = [...new Set(signals.flatMap((s) => s.airports || []))];

  // Merge airspace (deduplicated)
  const airspace = [...new Set(signals.flatMap((s) => s.airspace || []))];

  // Average the factor hints across all signals
  const mergedHints = _averageFactorHints(signals);
  mergedHints._airportCount = airports.length;

  // Merge preliminary effects (deduplicated by title)
  const seenTitles = new Set();
  const preliminaryEffects = [];
  for (const s of signals) {
    for (const eff of s.preliminaryEffects || []) {
      if (!seenTitles.has(eff.title)) {
        seenTitles.add(eff.title);
        preliminaryEffects.push(eff);
      }
    }
  }

  // Merge domains (union)
  const domains = [...new Set(signals.flatMap((s) => s.domains || []))];

  // Use the largest geo radius
  const geo = primary.geo || { lat: 0, lon: 0, radiusKm: 100 };
  const maxRadius = Math.max(...signals.map((s) => s.geo?.radiusKm || 0), geo.radiusKm);

  return {
    candidateId: `cand-${primary.signalId}`,
    name: primary.name,
    category: agentTypeToCategory(primary.agentType),
    agentType: primary.agentType,
    hazardType: primary.hazardType,
    hazardFamily: hazardFamily(primary.hazardType),
    detected: primary.detected,
    geo: { ...geo, radiusKm: maxRadius },
    airports,
    airspace,
    summary: primary.summary,
    factorHints: mergedHints,
    domains,
    preliminaryEffects,
    evidence: allEvidence,
    rawRefs: signals.flatMap((s) => s.rawRefs || []),
    sourceSignals: signals.map((s) => s.signalId),
    signalCount: signals.length,
    corroborateOnly: signals.some((s) => s.corroborateOnly),
  };
}

function _singleToCandidate(signal) {
  return {
    candidateId: `cand-${signal.signalId}`,
    name: signal.name,
    category: agentTypeToCategory(signal.agentType),
    agentType: signal.agentType,
    hazardType: signal.hazardType,
    hazardFamily: hazardFamily(signal.hazardType),
    detected: signal.detected,
    geo: signal.geo || { lat: 0, lon: 0, radiusKm: 100 },
    airports: signal.airports || [],
    airspace: signal.airspace || [],
    summary: signal.summary,
    factorHints: { ...signal.factorHints, _airportCount: (signal.airports || []).length },
    domains: signal.domains || [],
    preliminaryEffects: signal.preliminaryEffects || [],
    evidence: signal.evidence || [],
    rawRefs: signal.rawRefs || [],
    sourceSignals: [signal.signalId],
    signalCount: 1,
    corroborateOnly: signal.corroborateOnly || false,
  };
}

function _avgFactorHints(signal) {
  const h = signal.factorHints || {};
  const vals = Object.values(h).filter((v) => typeof v === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function _averageFactorHints(signals) {
  const keys = [
    'probability', 'severity', 'geographicReach', 'expectedDuration',
    'timeToImpact', 'escalationRate', 'sourceCredibility', 'predictionConfidence',
  ];
  const result = {};
  for (const key of keys) {
    const vals = signals
      .map((s) => s.factorHints?.[key])
      .filter((v) => typeof v === 'number');
    result[key] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 50;
  }
  return result;
}

export default { correlate, mergeGroup, hazardFamily };
