// domain-impact.js — 9-domain impact vector computation
// Each domain gets a 0-100 score based on the event category and EDPS score.

import store from '../store/event-store.js';
import * as refLoader from '../data/reference-loader.js';

// Phase 4: DOMAINS now read from DB-backed reference loader, falls back to hardcoded.
const DOMAINS = [
  'Airport operations',
  'Flight schedule',
  'Aircraft rotations',
  'Passengers',
  'Crew',
  'Cargo',
  'Catering',
  'Maintenance',
  'Regulatory',
];

// Category-specific domain weight profiles (0-1 multiplier on EDPS score)
// Phase 4: now read from DB-backed reference loader, falls back to hardcoded.
const CATEGORY_PROFILES = {
  'Weather': {
    'Airport operations': 1.0,
    'Flight schedule': 0.9,
    'Aircraft rotations': 0.8,
    'Passengers': 0.7,
    'Crew': 0.6,
    'Cargo': 0.5,
    'Catering': 0.4,
    'Maintenance': 0.3,
    'Regulatory': 0.2,
  },
  'ATC / Airspace': {
    'Flight schedule': 1.0,
    'Aircraft rotations': 0.9,
    'Airport operations': 0.8,
    'Crew': 0.7,
    'Passengers': 0.6,
    'Cargo': 0.5,
    'Maintenance': 0.3,
    'Catering': 0.3,
    'Regulatory': 0.4,
  },
  'Industrial action': {
    'Airport operations': 1.0,
    'Crew': 0.9,
    'Passengers': 0.8,
    'Flight schedule': 0.8,
    'Catering': 0.6,
    'Cargo': 0.5,
    'Aircraft rotations': 0.5,
    'Maintenance': 0.3,
    'Regulatory': 0.4,
  },
  'Geopolitical': {
    'Flight schedule': 1.0,
    'Aircraft rotations': 0.9,
    'Regulatory': 0.8,
    'Crew': 0.6,
    'Passengers': 0.5,
    'Airport operations': 0.5,
    'Cargo': 0.4,
    'Catering': 0.2,
    'Maintenance': 0.2,
  },
  'Infrastructure': {
    'Airport operations': 1.0,
    'Flight schedule': 0.9,
    'Maintenance': 0.7,
    'Aircraft rotations': 0.6,
    'Passengers': 0.5,
    'Cargo': 0.4,
    'Crew': 0.3,
    'Catering': 0.3,
    'Regulatory': 0.2,
  },
  'Regulatory': {
    'Regulatory': 1.0,
    'Flight schedule': 0.7,
    'Crew': 0.6,
    'Maintenance': 0.5,
    'Aircraft rotations': 0.4,
    'Airport operations': 0.4,
    'Passengers': 0.3,
    'Cargo': 0.2,
    'Catering': 0.2,
  },
};

// Compute the 9-domain vector for an event
export function computeDomainVector(event) {
  const edps = event.score || 50;

  // Phase 4: try DB-backed domain profile first, fall back to hardcoded
  const profile = refLoader.getDomainProfileByName(event.cat) || CATEGORY_PROFILES[event.cat] || CATEGORY_PROFILES['Weather'];

  // Phase 4: try DB-backed domain list first, fall back to hardcoded
  const dbDomains = refLoader.getAllDomains();
  const domains = dbDomains.length > 0 ? dbDomains.map(d => d.name) : DOMAINS;

  // Also consider agent-tagged domains — boost those
  const taggedDomains = new Set(event.domains || []);

  return domains.map((name) => {
    let v = Math.round(edps * (profile[name] || 0.3));

    // Boost if the agent explicitly tagged this domain
    if (taggedDomains.has(name)) {
      v = Math.min(100, v + 10);
    }

    return { name, v };
  });
}

export default { computeDomainVector, DOMAINS };
