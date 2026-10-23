// pipeline.js — Orchestrates the full signal-to-event pipeline
// Steps: Collection → Normalization → Correlation → Scoring → Domain Impact →
//        Causal Chain → Evidence Assembly → Impact Assessment → Event Store

import store from '../store/event-store.js';
import { correlate, hazardFamily } from './correlation.js';
import ragIndexer from './rag-indexer.js';
import * as refLoader from '../data/reference-loader.js';
import {
  computeEDPS,
  deriveConfidence,
  deriveTrajectory,
  deriveTTI,
  mapEscalation,
  scoreBandLabel,
  assignRef,
  catToSopKey,
  agentTypeToCategory,
} from './scoring.js';
import { computeDomainVector } from './domain-impact.js';
import { expandChain } from './causal-chain.js';
import { computeOPS, getImpactMode } from './impact-assessment.js';

// Track which signals have already been processed
const processedSignals = new Set();

// Process new unprocessed signals through the full pipeline
export function processNewSignals() {
  const startTime = Date.now();

  // Get all signals that haven't been processed yet
  let newSignals = store.signals.filter((s) => !processedSignals.has(s.signalId));

  // In realOnlyMode, skip mock signals entirely
  if (store.realOnlyMode) {
    newSignals = newSignals.filter((s) => s.dataSourceMode !== 'mock');
  }

  if (newSignals.length === 0) {
    return {
      processed: 0,
      candidates: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      opsComputed: 0,
      durationMs: 0,
      steps: _stepStats(0, 0, 0, 0, 0, 0, 0, 0, 0),
      message: 'No new signals to process',
    };
  }

  // Mark as processed
  for (const s of newSignals) {
    processedSignals.add(s.signalId);
  }

  // Step 1-2: Collection + Normalization (already done by agent-base normalize())
  const step1Count = newSignals.length;
  const step2Count = newSignals.length; // normalized in agent-base

  // Step 3: Correlation — group signals into candidate events
  const candidates = correlate(newSignals);
  const step3Count = candidates.length;

  let eventsCreated = 0;
  let eventsUpdated = 0;
  let opsComputed = 0;
  let step4Count = 0;
  let step5Count = 0;
  let step6Count = 0;
  let step7Count = 0;
  let step8Count = 0;
  let step9Count = 0;

  for (const candidate of candidates) {
    // ── Social/corroborating signals: enrich existing events, don't create new ones
    if (candidate.corroborateOnly) {
      const candAps = new Set(candidate.airports || []);
      const catKey = (candidate.category || '').toLowerCase().replace(/[^a-z]/g, '');
      // Find existing events with overlapping airports (any category)
      const matched = store.events.filter(e => {
        const evAps = e._airports || [];
        if (evAps.length === 0) return false;
        for (const ap of evAps) if (candAps.has(ap)) return true;
        return false;
      });
      if (matched.length > 0) {
        for (const m of matched) {
          const unionEvidence = [...(m.evidence || []), ...(candidate.evidence || [])].slice(-50);
          const unionSignals = [...new Set([...(m._sourceSignals || []), ...(candidate.sourceSignals || [])])].slice(-500);
          store.updateEvent(m.id, {
            evidence: unionEvidence,
            _signalCount: unionSignals.length,
            _sourceSignals: unionSignals,
          });
          eventsUpdated++;
        }
        continue; // don't create a new event for corroborating signals
      }
      // No matching event — skip social signals that have no event to enrich
      continue;
    }

    // Step 4: Scoring (EDPS)
    const { score, factors } = computeEDPS(candidate.factorHints);
    step4Count++;

    // Derive metadata
    const category = candidate.category;
    const conf = deriveConfidence(candidate.evidence);
    const traj = deriveTrajectory(candidate.candidateId, score);
    const { tti, ttiMin } = deriveTTI(candidate.factorHints.timeToImpact || 50);
    const esc = mapEscalation(score);
    const ref = assignRef();
    const sopKey = catToSopKey(category);

    // Step 5: Domain Impact
    const eventForDomains = { score, cat: category, domains: candidate.domains };
    const domains = computeDomainVector(eventForDomains);
    step5Count++;

    // Step 6: Causal Chain
    const eventForChain = { score, cat: category, summary: candidate.summary };
    const chain = expandChain(eventForChain);
    step6Count++;

    // Step 7: Evidence Assembly
    const evidence = (candidate.evidence || []).map((e) => ({
      time: e.timestamp || e.time || new Date().toISOString(),
      source: e.source || 'Unknown',
      cred: e.tier === 1 ? 'Tier 1' : e.tier === 2 ? 'Tier 2' : e.tier === 3 ? 'Tier 3' : e.cred || 'Tier 2',
      role: e.role || 'Corroborates',
      text: e.excerpt || e.text || candidate.summary,
    }));
    step7Count++;

    // Build the full event entity
    const eventId = _generateEventId(candidate);

    const event = {
      id: eventId,
      ref,
      name: candidate.name,
      cat: category,
      where: _formatWhere(candidate),
      detected: candidate.detected,
      score,
      conf,
      traj,
      tti,
      esc,
      ttiMin,
      summary: candidate.summary,
      factors,
      domains,
      chain,
      evidence,
      assumptions: [
        'Event develops as forecast without significant deviation.',
        'Standard operating procedures apply without additional local restrictions.',
      ],
      gaps: [
        'Exact timing and intensity may vary from forecast.',
        'Recovery timeline depends on local conditions.',
      ],
      sopKey,
      // Extended fields for the agent system
      _source: 'agent-pipeline',
      _signalCount: candidate.signalCount,
      _sourceSignals: candidate.sourceSignals,
      _geo: candidate.geo,
      _airports: candidate.airports,
      _airspace: candidate.airspace,
      // Data provenance: track whether signals came from real APIs or mock fallbacks
      _dataModes: _computeDataModes(candidate),
    };

    // Step 9: Publish to event store — check ALL plausible IDs (primary +
    // alternate scheme) so events created under a different key derivation
    // are updated instead of duplicated
    const candidateIds = _candidateIds(candidate);
    let matchedId = candidateIds.find(id => store.getEventById(id));
    if (!matchedId) {
      // Fallback: same cat + normalized name with exact or overlapping
      // airports (e.g., "Dubai Sandstorm Advisory" under -wind vs
      // -visibility; a 3-airport subset of a 6-airport storm event)
      const nn = _normName(candidate.name);
      const candAps = new Set(candidate.airports || []);
      const catKey = candidate.category.toLowerCase().replace(/[^a-z]/g, '');
      const nameMatch = store.events.find(e => {
        if ((e.cat || '').toLowerCase().replace(/[^a-z]/g, '') !== catKey) return false;
        if (_normName(e.name) !== nn) return false;
        const evAps = e._airports || [];
        // Exact set, or either empty (seed events), or ≥1 shared airport
        if (evAps.length === 0 || candAps.size === 0) return true;
        for (const ap of evAps) if (candAps.has(ap)) return true;
        return false;
      });
      if (nameMatch) matchedId = nameMatch.id;
    }
    const existing = matchedId ? store.getEventById(matchedId) : null;
    const effectiveId = existing ? matchedId : eventId;
    if (existing) {
      // Union airports — a subset signal (3 airports) must not shrink the
      // coverage of a superset event (6 airports) matched via name
      const unionAirports = [...new Set([
        ...(existing._airports || []),
        ...(candidate.airports || []),
      ])].sort();
      const unionSignals = [...new Set([
        ...(existing._sourceSignals || []),
        ...(candidate.sourceSignals || []),
      ])].slice(-500);
      // Update existing event — include name/summary/detected so the latest
      // reading is shown (e.g., "Visibility 547m" replaces "Visibility 451m")
      store.updateEvent(matchedId, {
        name: candidate.name,
        summary: candidate.summary,
        detected: candidate.detected,
        where: _formatWhere({ ...candidate, airports: unionAirports }),
        score,
        conf,
        traj,
        tti,
        esc,
        ttiMin,
        factors,
        domains,
        chain,
        evidence,
        _signalCount: unionSignals.length,
        _sourceSignals: unionSignals,
        _geo: candidate.geo,
        _airports: unionAirports,
        _airspace: candidate.airspace,
        _dataModes: _computeDataModes({ ...candidate, sourceSignals: unionSignals }),
      });
      eventsUpdated++;
    } else {
      store.addEvent(event);
      eventsCreated++;
    }
    step9Count++;

    // Step 8: Impact Assessment — compute OPS for this event
    const ops = computeOPS(existing ? { ...event, id: effectiveId } : event);
    if (ops) {
      store.setOPS(effectiveId, ops, getImpactMode());
      opsComputed++;
    }
    step8Count++;

    // ── RAG: Index the new/updated event + OPS for the conversation agent ──
    // Fire-and-forget — don't block the pipeline on RAG indexing
    ragIndexer.indexEvent(effectiveId).catch(() => {});
  }

  const durationMs = Date.now() - startTime;

  return {
    processed: newSignals.length,
    candidates: candidates.length,
    eventsCreated,
    eventsUpdated,
    opsComputed,
    durationMs,
    steps: _stepStats(step1Count, step2Count, step3Count, step4Count, step5Count, step6Count, step7Count, step8Count, step9Count),
    message: `Processed ${newSignals.length} signals → ${candidates.length} candidates → ${eventsCreated} new + ${eventsUpdated} updated events, ${opsComputed} OPS computed (${durationMs}ms)`,
  };
}

function _stepStats(s1, s2, s3, s4, s5, s6, s7, s8, s9) {
  return [
    { step: 1, name: 'Collection', items: s1 },
    { step: 2, name: 'Normalization', items: s2 },
    { step: 3, name: 'Correlation', items: s3 },
    { step: 4, name: 'Scoring (EDPS)', items: s4 },
    { step: 5, name: 'Domain Impact', items: s5 },
    { step: 6, name: 'Causal Chain', items: s6 },
    { step: 7, name: 'Evidence Assembly', items: s7 },
    { step: 8, name: 'Impact Assessment', items: s8 },
    { step: 9, name: 'Event Store', items: s9 },
  ];
}

// Generate a stable event ID from candidate.
// Uses a logical topic/family key + airports (not specific measurement values
// or volatile name wording) so that the same physical event gets the same ID
// across pipeline runs → pipeline updates the event instead of creating
// duplicates.
function _generateEventId(candidate) {
  const airports = [...(candidate.airports || [])].sort().join('-');
  const catKey = candidate.category.toLowerCase().replace(/[^a-z]/g, '');
  const isWeather = candidate.category === 'Weather';
  const isEarthquake = candidate.hazardType === 'earthquake';

  if (airports && !isEarthquake) {
    if (isWeather) {
      // Prefer the name-derived family (e.g., "North Sea Winter Storm" →
      // winter even when hazardType is 'storm') so differently-typed signals
      // for the same phenomenon land on one ID.
      const fam = _familyFromName(candidate.name)
        || candidate.hazardFamily
        || hazardFamily(candidate.hazardType);
      if (fam) {
        const famKey = fam.toLowerCase().replace(/[^a-z]/g, '');
        return `${catKey}-${airports}-${famKey}`.slice(0, 50);
      }
    } else {
      // Non-weather: hazardType-derived topic (e.g., flow_restriction →
      // "flowrestriction") — same event type at same airports → one event.
      const topic = hazardFamily(candidate.hazardType);
      if (topic) {
        const topicKey = topic.toLowerCase().replace(/[^a-z]/g, '');
        return `${catKey}-${airports}-${topicKey}`.slice(0, 50);
      }
    }
  }

  // Fallback: strip numeric measurement values from the name
  // "MUC fog — Visibility 451m" → "mucfogvisibility" (no numbers)
  // NOTE: Do NOT include airports in the fallback ID — airports may be
  // resolved dynamically (e.g., for earthquakes) and including them would
  // create duplicates when the same event is re-detected with different
  // airport resolution.
  const nameKey = _nameKey(candidate.name);
  return `${catKey}-${nameKey}`.slice(0, 50);
}

function _nameKey(name) {
  return (name || '').toLowerCase()
    .replace(/\d+\s*m\b/g, '')     // remove "451m", "547m" etc.
    .replace(/\d+/g, '')            // remove any remaining numbers
    .replace(/[^a-z]/g, '')
    .slice(0, 20);
}

// Compute ALL plausible IDs for a candidate (primary + alternate scheme).
// Used when looking up existing events — an event created under the old
// ID scheme (name-key) must be found even when the new scheme produces an
// airports+topic ID, otherwise a duplicate is created.
function _candidateIds(candidate) {
  const primary = _generateEventId(candidate);
  const ids = [primary];
  const catKey = candidate.category.toLowerCase().replace(/[^a-z]/g, '');
  const airports = [...(candidate.airports || [])].sort().join('-');
  const isWeather = candidate.category === 'Weather';
  const isEarthquake = candidate.hazardType === 'earthquake';

  if (airports && !isEarthquake) {
    // Alternate: name-key form
    const altName = `${catKey}-${_nameKey(candidate.name)}`.slice(0, 50);
    if (altName !== primary) ids.push(altName);
    // Alternate: topic-key form (when primary was name-key — e.g.,
    // hazardType missing on this signal but present on the stored event)
    if (primary === `${catKey}-${_nameKey(candidate.name)}`.slice(0, 50)) {
      const topic = isWeather
        ? (_familyFromName(candidate.name) || hazardFamily(candidate.hazardType))
        : hazardFamily(candidate.hazardType);
      if (topic) {
        const topicKey = topic.toLowerCase().replace(/[^a-z]/g, '');
        const altTopic = `${catKey}-${airports}-${topicKey}`.slice(0, 50);
        if (!ids.includes(altTopic)) ids.push(altTopic);
      }
    }
  }
  return ids;
}

// Derive a hazard family from an event/candidate NAME using word-boundary
// keyword matching. More reliable than hazardType for storms — e.g., a
// "winter storm" signal typed 'storm' still maps to 'winter'.
function _familyFromName(name) {
  const n = (name || '').toLowerCase();
  if (/\bfog\b/.test(n) || /\blow\s+visib/.test(n) || /\bvisibility\b/.test(n)) return 'visibility';
  if (/\bthunderstorm\b/.test(n) || /\bthunder\b/.test(n) || /\bconvective\b/.test(n)) return 'thunderstorm';
  if (/\bsnow\b/.test(n) || /\bice\b/.test(n) || /\bicing\b/.test(n) || /\bwinter\b/.test(n)) return 'winter';
  if (/\bwind\b/.test(n) || /\bstorm\b/.test(n)) return 'wind';
  if (/\bceiling\b/.test(n)) return 'ceiling';
  if (/\bmonsoon\b/.test(n)) return 'monsoon';
  if (/\brain\b/.test(n) || /\bflood/.test(n)) return 'rain';
  if (/\bheat\b/.test(n)) return 'heat';
  if (/\bcold\b/.test(n)) return 'cold';
  return null;
}

// Format the "where" field from candidate geo + airports
function _formatWhere(candidate) {
  const airports = candidate.airports || [];
  const airspace = candidate.airspace || [];

  if (airspace.length > 0 && airports.length === 0) {
    return airspace.join(' / ');
  }
  if (airports.length > 0) {
    // Try to extract a place name from the event name for context
    // e.g., "M6.5 Earthquake — 165 km W of Nikolski, Alaska" → "165 km W of Nikolski, Alaska"
    const name = candidate.name || '';
    const dashIdx = name.indexOf('—');
    const placeName = dashIdx !== -1 ? name.slice(dashIdx + 1).trim() : '';
    if (placeName && airports.length <= 3) {
      return `${airports.join(' / ')} (${placeName})`;
    }
    return airports.join(' / ');
  }
  // Fall back to a human-readable location from the name/summary
  // rather than raw lat/lon coordinates
  const geo = candidate.geo || {};
  // Try to extract a place name from the event name (e.g., "M6.5 Earthquake — 165 km W of Nikolski, Alaska")
  const name = candidate.name || '';
  const dashIdx = name.indexOf('—');
  if (dashIdx !== -1) {
    return name.slice(dashIdx + 1).trim();
  }
  // If the name itself looks like a place, use it
  if (name && !name.match(/^\d/)) {
    return name;
  }
  // Last resort: lat/lon
  return `${geo.lat?.toFixed(1) || '0'}, ${geo.lon?.toFixed(1) || '0'}`;
}

// Run the pipeline on a timer (every 10 seconds by default)
let pipelineTimer = null;
let pipelineInterval = 10000;
let lastPipelineRun = null;
const pipelineRunHistory = [];

export function recordPipelineRun(result) {
  lastPipelineRun = { ...result, timestamp: new Date().toISOString() };
  // Keep history meaningful — only runs that actually processed signals
  if (result.processed > 0) {
    pipelineRunHistory.unshift(lastPipelineRun);
    if (pipelineRunHistory.length > 20) pipelineRunHistory.pop();
  }
}

export function getPipelineStatus() {
  return {
    autoRunning: !!pipelineTimer,
    intervalMs: pipelineInterval,
    lastRun: lastPipelineRun,
    history: pipelineRunHistory,
  };
}

// Phase 7: read from DB-backed ref_connectors via loader
export function startPipeline(intervalMs = null) {
  if (pipelineTimer) return;
  const interval = intervalMs ?? refLoader.getConnectorConfig('pipeline', 'interval_ms', 10000);
  pipelineInterval = interval;
  pipelineTimer = setInterval(() => {
    const result = processNewSignals();
    recordPipelineRun(result);
    if (result.processed > 0) {
      console.log(`[Pipeline] Processed ${result.processed} signals → ${result.candidates} candidates → ${result.eventsCreated} new events, ${result.eventsUpdated} updated`);
    }
  }, interval);
  console.log(`[Pipeline] Started (runs every ${interval / 1000}s)`);
}

export function stopPipeline() {
  if (pipelineTimer) {
    clearInterval(pipelineTimer);
    pipelineTimer = null;
    console.log('[Pipeline] Stopped');
  }
}

// ── One-time cleanup: merge existing duplicate events ───────────────
// Groups events by their normalized logical key (category + airports +
// hazard family) and merges groups with >1 member into a single event.
// The highest-scored event becomes the primary; evidence from all
// duplicates is merged in; duplicates are deleted.

function _deriveHazardFamilyFromEvent(event) {
  // Only apply hazard family grouping to Weather events
  if ((event.cat || '').toLowerCase() !== 'weather') return null;

  // Prefer the name-derived family — more reliable than _hazardType for
  // storms (e.g., "North Sea Winter Storm" typed 'storm' → 'winter')
  const fromName = _familyFromName(event.name);
  if (fromName) return fromName;

  // Check _hazardType (set by pipeline on new events)
  if (event._hazardType) return hazardFamily(event._hazardType);

  // Check event ID for hazard keywords (also with word boundaries)
  const id = (event.id || '').toLowerCase();
  if (/\bfog\b/.test(id) || /\bvisib/.test(id)) return 'visibility';
  if (/\bthunder\b/.test(id) || /\bconvect/.test(id)) return 'thunderstorm';
  if (/\bsnow\b/.test(id) || /\bice\b/.test(id) || /\bwinter\b/.test(id)) return 'winter';
  if (/\bwind\b/.test(id) || /\bstorm\b/.test(id)) return 'wind';
  if (/\bmonsoon\b/.test(id)) return 'monsoon';

  return null;
}

// Derive a logical "topic" key for NON-weather events (ATC, industrial,
// geopolitical, regulatory, infrastructure) from _hazardType or name
// keywords. Used to group the same event across differing ID schemes.
const NON_WEATHER_TOPICS = [
  ['atfmregulation', /\batfm\b/],
  ['flowrestriction', /\bflow\b|\bflow\s+control\b|\bflow\s+management\b|\bflow\s+regulation\b|\bregulation\b/],
  ['sectoroverload', /\boverload\b|\bcongestion\b/],
  ['groundstop', /\bground\s+stop\b/],
  ['capacityreduction', /\bcapacity\b|\bslot\b/],
  ['strike', /\bstrike\b|\bindustrial\s+action\b|\bwork\s+stoppage\b|\bstoppage\b/],
  ['goslow', /\bgo.?slow\b|\bslowdown\b/],
  ['groundhandleraction', /\bground\s+handl|\bbaggage\b|\bhandling\b|\bground\s+crew\b/],
  ['ilsoutage', /\bils\b|\binstrument\s+landing\b/],
  ['runwayclosure', /\brunway\b|\btaxiway\b|\boverlay\b|\bresurfacing\b/],
  ['fuelsupply', /\bfuel\b/],
  ['systemoutage', /\boutage\b|\bsystem\s+fail/],
  ['securitynotam', /\bnotam\b|\bsecurity\b|\badvisory\b/],
  ['airspacerestriction', /\bairspace\b|\boverflight\b|\btfr\b|\brestriction\b/],
  ['curfewchange', /\bcurfew\b|\bquota\b|\bnoise\s+abatement\b/],
  ['etopschange', /\betops\b/],
  ['opsspecchange', /\bops\s*spec\b|\bcompliance\b|\bdirective\b|\bslot\s+rule\b/],
  ['earthquake', /\bearthquake\b|\bquake\b|\bseismic\b/],
];

function _deriveTopicFromEvent(event) {
  // Prefer _hazardType (set by correlation from the signal) — name keywords
  // can misfire (e.g., "Sector Capacity Reduction" → 'sector' vs 'capacity')
  if (event._hazardType) {
    return hazardFamily(event._hazardType).toLowerCase().replace(/[^a-z]/g, '');
  }
  const n = (event.name || '').toLowerCase();
  for (const [key, re] of NON_WEATHER_TOPICS) {
    if (re.test(n)) return key;
  }
  return null;
}

// Normalized full name for grouping (keeps digits — distinguishes
// "M5.0 Earthquake — Sipí" from "M6.5 Earthquake — Sipí")
function _normName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _computeNormalizedId(event) {
  const airports = [...(event._airports || [])].sort().join('-');
  const catKey = (event.cat || '').toLowerCase().replace(/[^a-z]/g, '');
  const isWeather = catKey === 'weather';

  if (airports) {
    if (isWeather) {
      const fam = _deriveHazardFamilyFromEvent(event);
      if (fam) {
        const famKey = fam.toLowerCase().replace(/[^a-z]/g, '');
        return `${catKey}-${airports}-${famKey}`.slice(0, 50);
      }
    } else {
      const topic = _deriveTopicFromEvent(event);
      // Earthquakes keep name-key IDs — each USGS event is unique (place
      // name embedded) and shouldn't merge with other quakes at same airport
      if (topic && topic !== 'earthquake') {
        return `${catKey}-${airports}-${topic}`.slice(0, 50);
      }
    }
  }

  // No airports (or no derivable topic): canonical name-key — matches what
  // _generateEventId produces for new signals, so name-keyed events still
  // dedupe across old/new ID schemes.
  const nameKey = _eventNameKey(event.name);
  if (nameKey) return `${catKey}-${nameKey}`.slice(0, 50);
  return event.id;
}

// Name key matching _generateEventId's fallback (digits stripped, 20 chars)
function _eventNameKey(name) {
  return (name || '').toLowerCase()
    .replace(/\d+\s*m\b/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z]/g, '')
    .slice(0, 20);
}

// Merge a group of duplicate events into one survivor.
// - Primary = highest score; evidence, sourceSignals, airports, domains unioned
// - OPS preserved across deleteEvent (which removes OPS) and recomputed
//   when the airport set changed
// - Survivor renamed to `targetId` when different and free
function _mergeGroup(group, targetId) {
  group.sort((a, b) => (b.score || 0) - (a.score || 0));
  const primary = group[0];
  const duplicates = group.slice(1);

  // Union evidence (deduped)
  const allEvidence = [];
  const seenEvidence = new Set();
  for (const e of group) {
    for (const ev of (e.evidence || [])) {
      const key = `${ev.source}|${ev.time}|${(ev.text || '').slice(0, 100)}`;
      if (!seenEvidence.has(key)) {
        seenEvidence.add(key);
        allEvidence.push(ev);
      }
    }
  }

  const allSourceSignals = [...new Set(group.flatMap(e => e._sourceSignals || []))];
  const allAirports = [...new Set(group.flatMap(e => e._airports || []))].sort();
  const allDomains = [...new Set(group.flatMap(e => e.domains || []))];
  const airportsChanged = allAirports.join(',') !== [...(primary._airports || [])].sort().join(',');

  // Preserve OPS before deletions wipe it
  const opsBackup = store.ops[primary.id]
    || duplicates.map(d => store.ops[d.id]).find(Boolean)
    || null;

  // Fill primary's empty fields from duplicates (seeded events often carry
  // richer curated data — don't lose it)
  const filled = {};
  for (const field of ['summary', 'domains', 'chain', 'factors', 'assumptions', 'gaps', 'sopKey']) {
    if ((primary[field] == null || (Array.isArray(primary[field]) && primary[field].length === 0))) {
      const donor = duplicates.find(d => d[field] != null && (!Array.isArray(d[field]) || d[field].length > 0));
      if (donor) filled[field] = donor[field];
    }
  }

  for (const dup of duplicates) {
    store.deleteEvent(dup.id);
  }

  const updates = {
    evidence: allEvidence,
    _sourceSignals: allSourceSignals,
    _signalCount: allSourceSignals.length,
    ...filled,
  };
  if (allDomains.length > 0) updates.domains = allDomains;
  if (allAirports.length > 0) {
    updates._airports = allAirports;
    // Recompute `where` only when airports grew — preserves the
    // "BOG (29 km WSW of Sipí, Colombia)" place annotation format
    if (airportsChanged) updates.where = allAirports.join(' / ');
  }
  store.updateEvent(primary.id, updates);

  // Rename survivor to the canonical ID
  let finalId = primary.id;
  if (targetId && primary.id !== targetId && !store.getEventById(targetId)) {
    const current = store.getEventById(primary.id);
    if (current) {
      store.deleteEvent(primary.id);
      store.addEvent({ ...current, id: targetId });
      finalId = targetId;
    }
  }

  // Restore / recompute OPS under the final ID
  if (airportsChanged) {
    const ev = store.getEventById(finalId);
    const ops = ev ? computeOPS(ev) : null;
    if (ops) store.setOPS(finalId, ops, getImpactMode());
    else if (opsBackup) store.ops[finalId] = opsBackup;
  } else if (opsBackup) {
    store.ops[finalId] = opsBackup;
  }

  return {
    merged: 1,
    deleted: duplicates.length,
    finalId,
    info: {
      keptId: finalId,
      deletedIds: duplicates.map(d => d.id),
      score: primary.score,
      name: primary.name,
      evidenceCount: allEvidence.length,
    },
  };
}

export function mergeDuplicateEvents() {
  let mergedCount = 0;
  let deletedCount = 0;
  let renamedCount = 0;
  const merged = [];

  // ── Pass 1: Merge events sharing a canonical normalized ID ──
  // Catches old-vs-new ID scheme duplicates (e.g., atcairspace-HKG-
  // flowrestriction vs atcairspace-hongkongfirflowmanag) — same event,
  // different key derivation.
  const groups = new Map();
  for (const event of store.events) {
    const normId = _computeNormalizedId(event);
    if (!groups.has(normId)) groups.set(normId, []);
    groups.get(normId).push(event);
  }
  for (const [normId, group] of groups) {
    if (group.length <= 1) continue;
    const res = _mergeGroup(group, normId);
    mergedCount += res.merged;
    deletedCount += res.deleted;
    merged.push(res.info);
    console.log(`[Pipeline] Merged ${res.deleted} duplicates into ${res.finalId} (score ${res.info.score}, ${res.info.evidenceCount} evidence)`);
  }

  // ── Pass 2: Merge airported events sharing cat + airports + name ──
  // Catches the same event keyed under different topics (e.g., a
  // "Taiwan Strait Airspace Advisory" under securitynotam vs
  // airspacerestriction).
  const nameGroups = new Map();
  for (const event of store.events) {
    const aps = event._airports || [];
    if (aps.length === 0) continue;
    const catKey = (event.cat || '').toLowerCase().replace(/[^a-z]/g, '');
    const key = `${catKey}|${[...aps].sort().join('-')}|${_normName(event.name)}`;
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key).push(event);
  }
  for (const [, group] of nameGroups) {
    if (group.length <= 1) continue;
    const res = _mergeGroup(group, _computeNormalizedId(group[0]));
    mergedCount += res.merged;
    deletedCount += res.deleted;
    merged.push(res.info);
    console.log(`[Pipeline] Name-merged ${res.deleted} duplicates into ${res.finalId}`);
  }

  // ── Pass 3: Subset merge — same hazard family or same name, overlapping
  // airport sets (e.g., North Sea Winter Storm at different airport subsets)
  const subsetMerged = _mergeSubsetEvents();
  mergedCount += subsetMerged.mergedCount;
  deletedCount += subsetMerged.deletedCount;
  merged.push(...subsetMerged.merged);

  // ── Pass 3b: Cross-category merge — same name + same/overlapping airports
  // but different category (e.g., "CDG Mass Flight Delays" as Weather vs
  // ATC/Airspace). The higher-score event wins; the other is deleted.
  const crossCatGroups = new Map();
  for (const event of store.events) {
    const aps = event._airports || [];
    if (aps.length === 0) continue;
    const nn = _normName(event.name);
    if (!nn) continue;
    // Group by normalized name only — airport overlap is checked below
    if (!crossCatGroups.has(nn)) crossCatGroups.set(nn, []);
    crossCatGroups.get(nn).push(event);
  }
  for (const [, group] of crossCatGroups) {
    const live = group.filter(e => store.getEventById(e.id));
    if (live.length <= 1) continue;
    // Check they actually have different categories
    const cats = new Set(live.map(e => e.cat));
    if (cats.size <= 1) continue; // same category already handled by Pass 2
    // Check airport overlap — at least one shared airport
    const allAps = live.map(e => new Set(e._airports || []));
    let hasOverlap = false;
    for (let i = 0; i < allAps.length && !hasOverlap; i++) {
      for (let j = i + 1; j < allAps.length; j++) {
        for (const ap of allAps[i]) {
          if (allAps[j].has(ap)) { hasOverlap = true; break; }
        }
      }
    }
    if (!hasOverlap) continue;
    const res = _mergeGroup(live, _computeNormalizedId(live[0]));
    mergedCount += res.merged;
    deletedCount += res.deleted;
    merged.push(res.info);
    console.log(`[Pipeline] Cross-category merged ${res.deleted} duplicates into ${res.finalId}`);
  }

  // ── Pass 4: No-airport (mostly seeded) events ──
  // Group by cat + normalized name; then merge survivors into a same-named
  // airported event when one exists (adopting its airports), else merge
  // the group among themselves.
  const noAptGroups = new Map();
  for (const event of store.events) {
    if ((event._airports || []).length > 0) continue;
    const catKey = (event.cat || '').toLowerCase().replace(/[^a-z]/g, '');
    const key = `${catKey}|${_normName(event.name)}`;
    if (!noAptGroups.has(key)) noAptGroups.set(key, []);
    noAptGroups.get(key).push(event);
  }
  for (const [, group] of noAptGroups) {
    if (group.length <= 1) continue;
    const res = _mergeGroup(group, group[0].id);
    mergedCount += res.merged;
    deletedCount += res.deleted;
    merged.push(res.info);
    console.log(`[Pipeline] Merged ${res.deleted} no-airport duplicates into ${res.finalId}`);
  }
  // Merge remaining no-airport events into same-named airported events
  for (const event of [...store.events]) {
    // Skip if deleted by an earlier merge in this pass (iterating a copy)
    if (!store.getEventById(event.id)) continue;
    if ((event._airports || []).length > 0) continue;
    const catKey = (event.cat || '').toLowerCase().replace(/[^a-z]/g, '');
    const nn = _normName(event.name);
    const match = store.events.find(e =>
      e.id !== event.id
      && (e._airports || []).length > 0
      && (e.cat || '').toLowerCase().replace(/[^a-z]/g, '') === catKey
      && _normName(e.name) === nn
    );
    if (match) {
      const res = _mergeGroup([match, event], _computeNormalizedId(match));
      mergedCount += res.merged;
      deletedCount += res.deleted;
      merged.push(res.info);
      console.log(`[Pipeline] Merged seeded event ${event.id} into ${res.finalId}`);
    }
  }

  // ── Pass 5: Rename survivors to canonical IDs ──
  for (const event of [...store.events]) {
    const normId = _computeNormalizedId(event);
    if (normId !== event.id && !store.getEventById(normId)) {
      const savedOps = store.ops[event.id] || null;
      const updated = { ...event, id: normId };
      store.deleteEvent(event.id);
      store.addEvent(updated);
      if (savedOps) store.ops[normId] = savedOps;
      renamedCount++;
      console.log(`[Pipeline] Renamed ${event.id} → ${normId}`);
    }
  }

  return { mergedCount, deletedCount, renamedCount, merged };
}

// Merge events that share the same hazard family but have different
// (overlapping/subset) airport lists. Keeps the event with the most
// airports as primary; merges evidence + airports from all subsets.
function _mergeSubsetEvents() {
  // Group events by hazard family (weather) AND by normalized name (all
  // cats) — same-named events with different airport subsets are the same
  // physical event detected with different airport coverage.
  const families = new Map(); // familyKey → [event, ...]
  for (const event of store.events) {
    const airports = event._airports || [];
    if (airports.length === 0) continue;
    const catKey = (event.cat || '').toLowerCase().replace(/[^a-z]/g, '');

    const fam = _deriveHazardFamilyFromEvent(event);
    if (fam) {
      const key = `${catKey}|${fam}`;
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(event);
    }

    // Also group by normalized name (catches -storm/-winter family splits
    // and same-named non-weather events across airport subsets)
    const nn = _normName(event.name);
    if (nn) {
      const key = `name|${catKey}|${nn}`;
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(event);
    }
  }

  let mergedCount = 0;
  let deletedCount = 0;
  const merged = [];

  for (const [, familyEvents] of families) {
    // Filter to events still live in the store (earlier groups may have
    // already merged/deleted some of them)
    const live = familyEvents.filter(e => store.getEventById(e.id));
    if (live.length <= 1) continue;

    // Sort by airport count desc, then score desc — the event with the
    // most airports (superset) and highest score becomes the primary.
    live.sort((a, b) => {
      const aCount = (a._airports || []).length;
      const bCount = (b._airports || []).length;
      if (aCount !== bCount) return bCount - aCount;
      return (b.score || 0) - (a.score || 0);
    });

    // Greedily merge: for each event, check if its airports are a subset
    // of (or significantly overlap with) a "keeper" event.
    const keepers = [live[0]];

    for (let i = 1; i < live.length; i++) {
      const ev = live[i];
      if (!store.getEventById(ev.id)) continue; // already merged away
      const evAirports = new Set(ev._airports || []);

      // Find a keeper whose airport set is a superset (or near-superset)
      let mergeInto = null;
      for (const keeper of keepers) {
        const keeperAirports = new Set(keeper._airports || []);
        // Check if ev's airports are a subset of keeper's
        let subsetCount = 0;
        for (const ap of evAirports) {
          if (keeperAirports.has(ap)) subsetCount++;
        }
        // Merge if all of ev's airports are in keeper, OR if there's
        // significant overlap (≥2 shared airports) — same storm, different
        // agent runs may detect slightly different airport sets.
        if (subsetCount === evAirports.size || subsetCount >= 2) {
          mergeInto = keeper;
          break;
        }
      }

      if (mergeInto) {
        // Merge evidence
        const allEvidence = [];
        const seenEvidence = new Set();
        for (const e of [mergeInto, ev]) {
          for (const evidence of (e.evidence || [])) {
            const key = `${evidence.source}|${evidence.time}|${(evidence.text || '').slice(0, 100)}`;
            if (!seenEvidence.has(key)) {
              seenEvidence.add(key);
              allEvidence.push(evidence);
            }
          }
        }

        // Merge airports (union)
        const mergedAirports = [...new Set([
          ...(mergeInto._airports || []),
          ...(ev._airports || []),
        ])].sort();

        // Merge source signals
        const mergedSignals = [...new Set([
          ...(mergeInto._sourceSignals || []),
          ...(ev._sourceSignals || []),
        ])];

        // Save OPS before deleting the subset
        const evOps = store.ops[ev.id];
        const keeperOps = store.ops[mergeInto.id];

        // Delete the subset event
        store.deleteEvent(ev.id);
        deletedCount++;

        // Update the keeper with merged data — then refresh the reference
        // (updateEvent replaces the stored object, so the old reference
        // would go stale for subsequent merges in this group)
        const updated = store.updateEvent(mergeInto.id, {
          _airports: mergedAirports,
          where: mergedAirports.join(' / '),
          evidence: allEvidence,
          _sourceSignals: mergedSignals,
          _signalCount: mergedSignals.length,
        });
        if (updated) {
          const ki = keepers.indexOf(mergeInto);
          if (ki !== -1) keepers[ki] = updated;
          mergeInto = updated;
        }

        // Recompute OPS for the merged event (airports changed)
        if (keeperOps || evOps) {
          const updatedEvent = store.getEventById(mergeInto.id);
          if (updatedEvent) {
            const newOps = computeOPS(updatedEvent);
            if (newOps) {
              store.setOPS(mergeInto.id, newOps, getImpactMode());
            }
          }
        }

        mergedCount++;
        merged.push({
          keptId: mergeInto.id,
          deletedIds: [ev.id],
          score: mergeInto.score,
          name: mergeInto.name,
          evidenceCount: allEvidence.length,
        });

        console.log(`[Pipeline] Subset-merged ${ev.id} into ${mergeInto.id} (${mergedAirports.length} airports, ${allEvidence.length} evidence)`);
      } else {
        keepers.push(ev);
      }
    }
  }

  return { mergedCount, deletedCount, merged };
}

// Compute the data provenance of an event from its source signals
// Returns: { mode: 'real'|'mock'|'mixed', realCount, mockCount, totalCount }
function _computeDataModes(candidate) {
  const signals = store.signals.filter(s =>
    candidate.sourceSignals?.includes(s.signalId)
  );

  let realCount = 0, mockCount = 0;
  for (const s of signals) {
    if (s.dataSourceMode === 'mock') mockCount++;
    else realCount++; // default to real if not explicitly mock
  }

  const mode = mockCount > 0 && realCount > 0 ? 'mixed'
    : mockCount > 0 ? 'mock'
    : 'real';

  return { mode, realCount, mockCount, totalCount: signals.length };
}

export default {
  processNewSignals,
  startPipeline,
  stopPipeline,
  getPipelineStatus,
  recordPipelineRun,
};
