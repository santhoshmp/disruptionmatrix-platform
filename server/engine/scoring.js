// scoring.js — EDPS scoring engine
// Computes the 8-factor weighted score, confidence, trajectory, TTI, escalation,
// and reference ID for candidate events.

import store from '../store/event-store.js';

const FACTOR_LABELS = [
  'Probability of occurrence',
  'Severity if realised',
  'Geographic reach',
  'Expected duration',
  'Time to impact',
  'Escalation rate',
  'Source credibility',
  'Prediction confidence',
];

const FACTOR_KEYS = [
  'probability',
  'severity',
  'geographicReach',
  'expectedDuration',
  'timeToImpact',
  'escalationRate',
  'sourceCredibility',
  'predictionConfidence',
];

// ── EDPS computation ─────────────────────────────────────────────────
// EDPS = Σ(factor.val × factor.weight) for all 8 factors

export function computeEDPS(factorHints) {
  const weights = store.config.edpsFactors;
  const factors = [];
  let score = 0;

  for (let i = 0; i < 8; i++) {
    const label = FACTOR_LABELS[i];
    const key = FACTOR_KEYS[i];
    const weight = weights[i].weight;
    const val = factorHints[key] ?? 50; // default to 50 if missing

    score += val * weight;

    factors.push({
      label,
      val,
      weight,
      readout: _formatReadout(label, val),
      why: _explainFactor(label, val, factorHints),
    });
  }

  return { score: Math.round(score), factors };
}

function _formatReadout(label, val) {
  switch (label) {
    case 'Geographic reach':
      return val >= 70 ? '3+ airports' : val >= 50 ? '2 airports' : '1 airport';
    case 'Expected duration':
      return _minutesToHuman(_valToMinutes(val, 'duration'));
    case 'Time to impact':
      return _minutesToHuman(_valToMinutes(val, 'tti'));
    case 'Escalation rate':
      return val >= 65 ? 'Escalating' : val >= 40 ? 'Stable' : 'Improving';
    case 'Source credibility':
      return val >= 80 ? 'Tier 1' : val >= 60 ? 'Tier 1-2' : 'Tier 2-3';
    case 'Prediction confidence':
      return val >= 75 ? 'High' : val >= 50 ? 'Moderate' : 'Low';
    default:
      return `${val}/100`;
  }
}

function _explainFactor(label, val, hints) {
  switch (label) {
    case 'Probability of occurrence':
      return 'Assessed from source corroboration and forecast confidence.';
    case 'Severity if realised':
      return 'Based on historical impact of comparable events.';
    case 'Geographic reach':
      return hints._airportCount ? `Affects ${hints._airportCount} airport(s).` : 'Estimated from signal geo radius.';
    case 'Expected duration':
      return 'Estimated from forecast window and recovery time.';
    case 'Time to impact':
      return 'First operational effect expected within the stated window.';
    case 'Escalation rate':
      return 'Trajectory assessed from recent score movement.';
    case 'Source credibility':
      return 'Based on source tier classification.';
    case 'Prediction confidence':
      return 'Based on source agreement and forecast spread.';
    default:
      return '';
  }
}

// ── Confidence derivation ───────────────────────────────────────────
// 1-5 scale from evidence source tiers: tier 1 = 5, tier 2 = 3, tier 3 = 1
// Averages across all evidence items, then rounds.

export function deriveConfidence(evidence) {
  if (!evidence || evidence.length === 0) return 2;
  let total = 0;
  for (const e of evidence) {
    const tier = e.tier || e.cred === 'Tier 1' ? 1 : e.cred === 'Tier 2' ? 2 : 3;
    total += tier === 1 ? 5 : tier === 2 ? 3 : 1;
  }
  const avg = total / evidence.length;
  return Math.max(1, Math.min(5, Math.round(avg)));
}

// ── Trajectory derivation ────────────────────────────────────────────
// Compares current score to previous score for the same event (if it exists).
// New events default to "Escalating" if score >= 65, "Stable" otherwise.

export function deriveTrajectory(eventId, currentScore) {
  const existing = store.getEventById(eventId);
  if (existing && existing.score) {
    const delta = currentScore - existing.score;
    if (delta >= 3) return 'Escalating';
    if (delta <= -3) return 'Improving';
    return 'Stable';
  }
  // New event
  return currentScore >= 65 ? 'Escalating' : 'Stable';
}

// ── Time-to-impact derivation ────────────────────────────────────────
// Converts the timeToImpact factor hint (0-100) into human-readable + minutes.

export function deriveTTI(timeToImpactHint) {
  const minutes = _valToMinutes(timeToImpactHint, 'tti');
  return {
    tti: _minutesToHuman(minutes),
    ttiMin: minutes,
  };
}

function _valToMinutes(val, type) {
  // Map 0-100 to minutes:
  // tti: 100 = imminent (30 min), 0 = 7 days (10080 min)
  // duration: 100 = 24h, 0 = 1h
  if (type === 'tti') {
    // Higher val = sooner impact
    // 100 → 30 min, 80 → 2h, 60 → 6h, 40 → 12h, 20 → 24h, 0 → 48h
    return Math.round(30 + (100 - val) * 28); // 30min to ~48h
  } else {
    // duration: higher val = longer duration
    // 100 → 24h, 50 → 8h, 0 → 1h
    return Math.round(60 + val * 14); // 1h to ~24h
  }
}

function _minutesToHuman(minutes) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = Math.round(minutes / 60);
    return `${h}h`;
  }
  const d = Math.round(minutes / 1440);
  return `${d}d`;
}

// ── Escalation level ─────────────────────────────────────────────────
// Maps score to L1-L4 using the score bands from config.

export function mapEscalation(score) {
  const bands = store.config.scoreBands;
  for (const band of bands) {
    if (score >= band.min && score <= band.max) {
      return band.escalation === 'L4' ? 4 : band.escalation === 'L3' ? 3 : band.escalation === 'L2' ? 2 : 1;
    }
  }
  return 1;
}

// ── Score band label ─────────────────────────────────────────────────

export function scoreBandLabel(score) {
  const bands = store.config.scoreBands;
  for (const band of bands) {
    if (score >= band.min && score <= band.max) return band.band;
  }
  return 'Low';
}

// ── Reference ID assignment ─────────────────────────────────────────
// Format: DM-YYYY-NNNN (sequential per year)

let refCounter = 100; // start above existing refs to avoid collisions

export function assignRef() {
  const year = new Date().getFullYear();
  refCounter++;
  return `DM-${year}-${String(refCounter).padStart(4, '0')}`;
}

// ── Category to SOP key mapping ─────────────────────────────────────

const CAT_TO_SOP = {
  'Weather': 'storm',
  'ATC / Airspace': 'atc',
  'Geopolitical': 'airspace',
  'Infrastructure': 'runway',
  'Industrial action': 'ground',
  'Regulatory': 'regulatory',
};

export function catToSopKey(cat) {
  return CAT_TO_SOP[cat] || 'storm';
}

// ── Agent type to category mapping ──────────────────────────────────

const AGENT_TYPE_TO_CAT = {
  weather: 'Weather',
  atc: 'ATC / Airspace',
  industrial: 'Industrial action',
  geopolitical: 'Geopolitical',
  infrastructure: 'Infrastructure',
  regulatory: 'Regulatory',
};

export function agentTypeToCategory(agentType) {
  return AGENT_TYPE_TO_CAT[agentType] || 'Weather';
}

export default {
  computeEDPS,
  deriveConfidence,
  deriveTrajectory,
  deriveTTI,
  mapEscalation,
  scoreBandLabel,
  assignRef,
  catToSopKey,
  agentTypeToCategory,
};
