// rag-indexer.js — Converts application data into RAG documents
// Indexes: events, signals, OPS, airports, airlines, schedules, regions, reference data, agents
//
// Each document has:
//   docType:  the category (event, signal, ops, airport, airline, schedule, region, reference, agent)
//   sourceId: the original entity ID
//   content:  searchable text (natural language description)
//   metadata: structured fields for filtering (JSONB)

import ragRepo from '../db/repositories/rag.js';
import store from '../store/event-store.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Load static config data
let _agentConfig = null;
function getAgentConfig() {
  if (!_agentConfig) {
    _agentConfig = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'agent-config.json'), 'utf-8'));
  }
  return _agentConfig;
}

// ── Index all data ────────────────────────────────────────────────
export async function indexAll() {
  const results = {};
  results.events = await indexEvents();
  results.signals = await indexSignals();
  results.ops = await indexOPS();
  results.airports = await indexAirports();
  results.airlines = await indexAirlines();
  results.schedules = await indexSchedules();
  results.regions = await indexRegions();
  results.reference = await indexReference();
  results.agents = await indexAgents();
  return results;
}

// ── Index events ─────────────────────────────────────────────────
export async function indexEvents() {
  const { events } = store.getEvents({ limit: 1000 });
  let count = 0;
  for (const e of events) {
    const content = buildEventContent(e);
    const metadata = {
      score: e.score,
      category: e.cat,
      escalation: e.esc,
      trajectory: e.traj,
      airports: e._airports || [],
      airspace: e._airspace || [],
      ttiMin: e.ttiMin,
      source: e._source,
      detected: e.detected,
      sopKey: e.sopKey,
    };
    await ragRepo.upsertDocument({
      docType: 'event',
      sourceId: e.id,
      content,
      metadata,
    });
    count++;
  }
  return count;
}

function buildEventContent(e) {
  const parts = [
    `Event: ${e.name}`,
    `Category: ${e.cat}`,
    `Location: ${e.where}`,
    `EDPS Score: ${e.score}/100`,
    `Escalation Level: L${e.esc}`,
    `Trajectory: ${e.traj}`,
    `Time to Impact: ${e.tti}`,
    `Summary: ${e.summary}`,
  ];

  if (e.factors?.length > 0) {
    parts.push('EDPS Factors:');
    for (const f of e.factors) {
      parts.push(`  - ${f.label}: ${f.readout} (weight ${f.weight}) — ${f.why}`);
    }
  }

  if (e.domains?.length > 0) {
    parts.push('Domains affected:');
    for (const d of e.domains) {
      parts.push(`  - ${d.name}: ${d.v}/100`);
    }
  }

  if (e.chain?.length > 0) {
    parts.push('Causal chain:');
    for (const c of e.chain) {
      parts.push(`  ${c.ord}. ${c.title} (${c.lead})`);
    }
  }

  if (e.evidence?.length > 0) {
    parts.push('Evidence:');
    for (const ev of e.evidence) {
      parts.push(`  - [${ev.cred || 'Tier 1'}] ${ev.source}: ${ev.text || ev.excerpt || ''}`);
    }
  }

  if (e._airports?.length > 0) {
    parts.push(`Affected airports: ${e._airports.join(', ')}`);
  }
  if (e._airspace?.length > 0) {
    parts.push(`Affected airspace: ${e._airspace.join(', ')}`);
  }

  return parts.join('\n');
}

// ── Index signals ────────────────────────────────────────────────
export async function indexSignals() {
  const { signals } = store.getSignals({ limit: 1000 });
  let count = 0;
  for (const s of signals) {
    const content = buildSignalContent(s);
    const metadata = {
      agentId: s.agentId,
      agentType: s.agentType,
      region: s.region,
      subRegion: s.subRegion,
      hazardType: s.hazardType,
      airports: s.airports || [],
      dataSourceMode: s.dataSourceMode,
      detected: s.detected,
    };
    await ragRepo.upsertDocument({
      docType: 'signal',
      sourceId: s.signalId,
      content,
      metadata,
    });
    count++;
  }
  return count;
}

function buildSignalContent(s) {
  const parts = [
    `Signal: ${s.name}`,
    `Agent: ${s.agentId} (${s.agentType})`,
    `Region: ${s.region} / ${s.subRegion || 'N/A'}`,
    `Hazard Type: ${s.hazardType}`,
    `Summary: ${s.summary}`,
  ];

  if (s.airports?.length > 0) {
    parts.push(`Airports: ${s.airports.join(', ')}`);
  }
  if (s.airspace?.length > 0) {
    parts.push(`Airspace: ${s.airspace.join(', ')}`);
  }
  if (s.factorHints) {
    parts.push(`Factor hints: probability=${s.factorHints.probability}, severity=${s.factorHints.severity}`);
  }
  if (s.evidence?.length > 0) {
    for (const ev of s.evidence) {
      parts.push(`Evidence: ${ev.source} — ${ev.excerpt || ''}`);
    }
  }

  return parts.join('\n');
}

// ── Index OPS (impact assessments) ───────────────────────────────
export async function indexOPS() {
  const { events } = store.getEvents({ limit: 1000 });
  let count = 0;
  for (const e of events) {
    const ops = store.getOPS(e.id);
    if (!ops) continue;

    const content = buildOPSContent(e, ops);
    const metadata = {
      eventId: e.id,
      eventName: e.name,
      category: e.cat,
      mode: ops.mode,
      airlineCount: ops.airlines?.length || 0,
      airportCount: ops.airports?.length || 0,
    };
    await ragRepo.upsertDocument({
      docType: 'ops',
      sourceId: e.id,
      content,
      metadata,
    });
    count++;
  }
  return count;
}

function buildOPSContent(event, ops) {
  const parts = [
    `Impact Assessment for: ${event.name} (${event.id})`,
    `Event Category: ${event.cat}`,
    `EDPS Score: ${event.score}/100`,
    `Assessment Mode: ${ops.mode}`,
  ];

  if (ops.airports?.length > 0) {
    parts.push('\nAirport Impact:');
    for (const a of ops.airports) {
      parts.push(`  ${a.iata || a.code}: ${a.impact || a.level || 'affected'} — ${a.summary || a.reason || ''}`);
    }
  }

  if (ops.airlines?.length > 0) {
    parts.push('\nAirline Exposure:');
    for (const a of ops.airlines) {
      parts.push(`  ${a.code} (${a.name}): exposure ${a.exposure || a.score || '?'}/100 — ${a.level || ''}`);
      if (a.affectedFlights) parts.push(`    Affected flights: ${a.affectedFlights}`);
      if (a.hub) parts.push(`    Hub: ${a.hub}`);
    }
  }

  if (ops.summary) parts.push(`\nSummary: ${ops.summary}`);

  return parts.join('\n');
}

// ── Index airports ───────────────────────────────────────────────
export async function indexAirports() {
  const ref = store.getReferenceData();
  const airports = ref.AIRPORTS || {};
  let count = 0;

  for (const [code, a] of Object.entries(airports)) {
    const content = [
      `Airport: ${a.name || code} (${code})`,
      `IATA: ${code}`,
      a.icao ? `ICAO: ${a.icao}` : '',
      a.city ? `City: ${a.city}` : '',
      a.country ? `Country: ${a.country}` : '',
      a.lat ? `Coordinates: ${a.lat}, ${a.lon}` : '',
      a.runways ? `Runways: ${a.runways}` : '',
      a.cat3 ? `CAT III: ${a.cat3}` : '',
      a.airlines ? `Airlines served: ${a.airlines.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    await ragRepo.upsertDocument({
      docType: 'airport',
      sourceId: code,
      content,
      metadata: { code, ...a },
    });
    count++;
  }

  return count;
}

// ── Index airlines ───────────────────────────────────────────────
export async function indexAirlines() {
  const config = getAgentConfig();
  const airlines = config.agentTypes
    ?.find((t) => t.type === 'impact-assessment')
    ?.airlineRegistry || [];

  let count = 0;
  for (const a of airlines) {
    const content = [
      `Airline: ${a.name} (${a.code})`,
      `IATA Code: ${a.code}`,
      `Primary Hub: ${a.hub}`,
      a.secondaryHub ? `Secondary Hub: ${a.secondaryHub}` : '',
      `Daily Departures: ${a.dailyDepartures}`,
      `Fleet: ${a.fleet?.join(', ')}`,
      a.networkShare ? `Network share: ${Object.entries(a.networkShare).map(([k, v]) => `${k} ${v}%`).join(', ')}` : '',
      a.fleetCapabilities ? `CAT III aircraft: ${a.fleetCapabilities.cat3Count}/${a.fleetCapabilities.cat3Total}, ETOPS: ${a.fleetCapabilities.etops}` : '',
    ].filter(Boolean).join('\n');

    await ragRepo.upsertDocument({
      docType: 'airline',
      sourceId: a.code,
      content,
      metadata: { ...a },
    });
    count++;
  }

  // Also index real airline registry
  try {
    const realAirlines = await import('../data/real-airline-registry.js');
    const registry = realAirlines.default || realAirlines;
    if (typeof registry.getRealAirlines === 'function') {
      const real = registry.getRealAirlines();
      for (const a of real) {
        const content = [
          `Airline: ${a.name} (${a.code})`,
          `IATA Code: ${a.code}`,
          a.hub ? `Primary Hub: ${a.hub}` : '',
          a.dailyDepartures ? `Daily Departures: ${a.dailyDepartures}` : '',
          a.fleet ? `Fleet: ${a.fleet}` : '',
        ].filter(Boolean).join('\n');

        await ragRepo.upsertDocument({
          docType: 'airline',
          sourceId: a.code,
          content,
          metadata: { ...a },
        });
        count++;
      }
    }
  } catch (e) { /* real-airline-registry may not export getRealAirlines */ }

  return count;
}

// ── Index schedules ──────────────────────────────────────────────
export async function indexSchedules() {
  let count = 0;
  try {
    const scheduleStore = await import('../data/schedule-store.js');
    const schedules = scheduleStore.default || scheduleStore;
    if (typeof schedules.getAllSchedules === 'function') {
      const all = schedules.getAllSchedules();
      for (const s of all) {
        const content = [
          `Flight: ${s.flightNo} (${s.airline})`,
          `Route: ${s.origin} → ${s.destination}`,
          `Departure: ${s.depTime}`,
          `Arrival: ${s.arrTime}`,
          `Aircraft: ${s.aircraft || 'N/A'}`,
          `Days: ${s.days || 'daily'}`,
        ].filter(Boolean).join('\n');

        await ragRepo.upsertDocument({
          docType: 'schedule',
          sourceId: s.flightNo,
          content,
          metadata: { ...s },
        });
        count++;
      }
    }
  } catch (e) { /* schedule store may not be available */ }

  return count;
}

// ── Index regions ────────────────────────────────────────────────
export async function indexRegions() {
  const config = getAgentConfig();
  let count = 0;

  for (const region of config.regions || []) {
    for (const sub of region.subRegions || []) {
      const content = [
        `Region: ${region.name} (${region.id})`,
        `Sub-region: ${sub.name} (${sub.id})`,
        `Priority: ${region.priority}`,
        `Airports: ${sub.airports?.join(', ')}`,
        `Airspace: ${sub.airspace?.join(', ')}`,
        sub.bbox ? `Bounding box: ${sub.bbox.minLat}-${sub.bbox.maxLat} lat, ${sub.bbox.minLon}-${sub.bbox.maxLon} lon` : '',
        sub.seasonalWatchlist ? `Seasonal watchlist: ${sub.seasonalWatchlist.join('; ')}` : '',
      ].filter(Boolean).join('\n');

      await ragRepo.upsertDocument({
        docType: 'region',
        sourceId: `${region.id}-${sub.id}`,
        content,
        metadata: {
          regionId: region.id,
          regionName: region.name,
          subRegionId: sub.id,
          subRegionName: sub.name,
          priority: region.priority,
          airports: sub.airports,
          airspace: sub.airspace,
        },
      });
      count++;
    }
  }

  return count;
}

// ── Index reference data (SOPS, DOMAINS, ESC, PHASES, edpsFactors) ──
export async function indexReference() {
  const ref = store.getReferenceData();
  let count = 0;

  // SOPs
  if (ref.SOPS) {
    for (const [key, sop] of Object.entries(ref.SOPS)) {
      const content = `SOP: ${sop.title || key} (key: ${key})\n${sop.summary || sop.description || JSON.stringify(sop)}`;
      await ragRepo.upsertDocument({
        docType: 'reference',
        sourceId: `sop-${key}`,
        content,
        metadata: { type: 'sop', key, ...sop },
      });
      count++;
    }
  }

  // Domains
  if (ref.DOMAINS) {
    for (const d of ref.DOMAINS) {
      const content = `Operational Domain: ${d}`;
      await ragRepo.upsertDocument({
        docType: 'reference',
        sourceId: `domain-${d}`,
        content,
        metadata: { type: 'domain', name: d },
      });
      count++;
    }
  }

  // Escalation levels
  if (ref.ESC) {
    for (const e of ref.ESC) {
      const content = `Escalation Level: ${e.tier} (L${e.level || e.tier})\n${e.description || e.badge || ''}`;
      await ragRepo.upsertDocument({
        docType: 'reference',
        sourceId: `esc-${e.tier}`,
        content,
        metadata: { type: 'escalation', ...e },
      });
      count++;
    }
  }

  // EDPS factors
  if (ref.edpsFactors) {
    for (const f of ref.edpsFactors) {
      const content = `EDPS Factor: ${f.label || f.name}\nWeight: ${f.weight}\n${f.description || f.why || ''}`;
      await ragRepo.upsertDocument({
        docType: 'reference',
        sourceId: `edps-${f.label || f.name}`,
        content,
        metadata: { type: 'edps-factor', ...f },
      });
      count++;
    }
  }

  // Phases
  if (ref.PHASES) {
    for (const p of ref.PHASES) {
      const content = `Operational Phase: ${p.name || p}\n${p.description || ''}`;
      await ragRepo.upsertDocument({
        docType: 'reference',
        sourceId: `phase-${p.name || p}`,
        content,
        metadata: { type: 'phase', ...p },
      });
      count++;
    }
  }

  return count;
}

// ── Index agents ─────────────────────────────────────────────────
export async function indexAgents() {
  const { agents } = store.getAgents({ limit: 1000 });
  let count = 0;

  for (const a of agents) {
    const content = [
      `Agent: ${a.id}`,
      `Type: ${a.type}`,
      `Region: ${a.region} / ${a.subRegion || 'N/A'}`,
      `Priority: ${a.priority}`,
      `Status: ${a.status}`,
      `Data Source Mode: ${a.dataSourceMode}`,
      `Signal Count: ${a.signalCount || 0}`,
      a.config?.mission ? `Mission: ${a.config.mission}` : '',
      a.config?.dataSources?.length ? `Data Sources: ${a.config.dataSources.map(s => s.name).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    await ragRepo.upsertDocument({
      docType: 'agent',
      sourceId: a.id,
      content,
      metadata: {
        type: a.type,
        region: a.region,
        subRegion: a.subRegion,
        priority: a.priority,
        status: a.status,
        dataSourceMode: a.dataSourceMode,
        signalCount: a.signalCount,
      },
    });
    count++;
  }

  return count;
}

// ── Index a single event (for event-driven updates) ──────────────
export async function indexEvent(eventId) {
  const { events } = store.getEvents({ limit: 1000 });
  const event = events.find((e) => e.id === eventId);
  if (!event) return;

  await ragRepo.upsertDocument({
    docType: 'event',
    sourceId: event.id,
    content: buildEventContent(event),
    metadata: {
      score: event.score,
      category: event.cat,
      escalation: event.esc,
      trajectory: event.traj,
      airports: event._airports || [],
      airspace: event._airspace || [],
      ttiMin: event.ttiMin,
      source: event._source,
      detected: event.detected,
    },
  });

  // Also index the OPS for this event
  const ops = store.getOPS(eventId);
  if (ops) {
    await ragRepo.upsertDocument({
      docType: 'ops',
      sourceId: eventId,
      content: buildOPSContent(event, ops),
      metadata: {
        eventId,
        eventName: event.name,
        category: event.cat,
        mode: ops.mode,
      },
    });
  }
}

// ── Index a single signal (for event-driven updates) ─────────────
export async function indexSignal(signalId) {
  const { signals } = store.getSignals({ limit: 5000 });
  const signal = signals.find((s) => s.signalId === signalId);
  if (!signal) return;

  await ragRepo.upsertDocument({
    docType: 'signal',
    sourceId: signal.signalId,
    content: buildSignalContent(signal),
    metadata: {
      agentId: signal.agentId,
      agentType: signal.agentType,
      region: signal.region,
      hazardType: signal.hazardType,
      airports: signal.airports || [],
      dataSourceMode: signal.dataSourceMode,
    },
  });
}

export default {
  indexAll,
  indexEvents,
  indexSignals,
  indexOPS,
  indexAirports,
  indexAirlines,
  indexSchedules,
  indexRegions,
  indexReference,
  indexAgents,
  indexEvent,
  indexSignal,
};
