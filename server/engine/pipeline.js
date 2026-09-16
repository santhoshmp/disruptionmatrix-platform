// pipeline.js — Orchestrates the full signal-to-event pipeline
// Steps: Collection → Normalization → Correlation → Scoring → Domain Impact →
//        Causal Chain → Evidence Assembly → Impact Assessment → Event Store

import store from '../store/event-store.js';
import { correlate } from './correlation.js';
import ragIndexer from './rag-indexer.js';
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
  const newSignals = store.signals.filter((s) => !processedSignals.has(s.signalId));

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
    };

    // Step 9: Publish to event store
    const existing = store.getEventById(eventId);
    if (existing) {
      // Update existing event
      store.updateEvent(eventId, {
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
        _signalCount: candidate.signalCount,
      });
      eventsUpdated++;
    } else {
      store.addEvent(event);
      eventsCreated++;
    }
    step9Count++;

    // Step 8: Impact Assessment — compute OPS for this event
    const ops = computeOPS(event);
    if (ops) {
      store.setOPS(eventId, ops, getImpactMode());
      opsComputed++;
    }
    step8Count++;

    // ── RAG: Index the new/updated event + OPS for the conversation agent ──
    // Fire-and-forget — don't block the pipeline on RAG indexing
    ragIndexer.indexEvent(eventId).catch(() => {});
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

// Generate a stable event ID from candidate (based on category + airports + name hash)
function _generateEventId(candidate) {
  const airports = [...(candidate.airports || [])].sort().join('-');
  const nameKey = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  const catKey = candidate.category.toLowerCase().replace(/[^a-z]/g, '');

  if (airports) {
    return `${catKey}-${airports}-${nameKey}`.slice(0, 50);
  }
  return `${catKey}-${nameKey}`.slice(0, 50);
}

// Format the "where" field from candidate geo + airports
function _formatWhere(candidate) {
  const airports = candidate.airports || [];
  const airspace = candidate.airspace || [];

  if (airspace.length > 0 && airports.length === 0) {
    return airspace.join(' / ');
  }
  if (airports.length > 0) {
    return airports.join(' / ');
  }
  const geo = candidate.geo || {};
  return `${geo.lat?.toFixed(1) || '0'}, ${geo.lon?.toFixed(1) || '0'}`;
}

// Run the pipeline on a timer (every 10 seconds)
let pipelineTimer = null;

export function startPipeline(intervalMs = 10000) {
  if (pipelineTimer) return;
  pipelineTimer = setInterval(() => {
    const result = processNewSignals();
    if (result.processed > 0) {
      console.log(`[Pipeline] Processed ${result.processed} signals → ${result.candidates} candidates → ${result.eventsCreated} new events, ${result.eventsUpdated} updated`);
    }
  }, intervalMs);
  console.log(`[Pipeline] Started (runs every ${intervalMs / 1000}s)`);
}

export function stopPipeline() {
  if (pipelineTimer) {
    clearInterval(pipelineTimer);
    pipelineTimer = null;
    console.log('[Pipeline] Stopped');
  }
}

export default {
  processNewSignals,
  startPipeline,
  stopPipeline,
};
