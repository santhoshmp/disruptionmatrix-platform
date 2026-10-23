// EventStore — hybrid in-memory cache + PostgreSQL write-through.
// Reads come from in-memory cache (fast). Writes go to cache + DB (durable).
// On startup: hydrate cache from DB. If DB is empty, seed from JSON and persist.
// If DB is down, app still works from cache (graceful degradation).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { testConnection } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import eventsRepo from '../db/repositories/events.js';
import signalsRepo from '../db/repositories/signals.js';
import opsRepo from '../db/repositories/ops.js';
import agentsRepo from '../db/repositories/agents.js';
import regionsRepo from '../db/repositories/regions.js';
import settingsRepo from '../db/repositories/settings.js';
import { deriveEventRegion, AIRPORT_REGION } from '../data/airport-lookup.js';
import * as refLoader from '../data/reference-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const dmData = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'dm-data.json'), 'utf-8'));
const agentConfig = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'agent-config.json'), 'utf-8'));
const geoData = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'geo.json'), 'utf-8'));

class EventStore {
  constructor() {
    this.signals = [];
    this.events = [];
    this.ops = {};
    this.agents = [];
    this.regions = agentConfig.regions.map(r => ({ ...r, enabled: true }));
    this.agentTypes = agentConfig.agentTypes;
    this.config = agentConfig;
    this.dmData = dmData;
    this.geoData = geoData;
    this.subscribers = [];
    this.refCounter = 1;
    this.dbReady = false;     // DB connection status
    this.initialized = false; // init() has run
    this.realOnlyMode = false; // when true, mock connectors are skipped
  }

  // ── Initialization (async) ──────────────────────────────────────────
  // Called on startup before agents/server start. Replaces the old sync seed().

  async init() {
    if (this.initialized) return;

    // 1. Test DB connection
    const version = await testConnection();
    if (!version) {
      console.warn('[EventStore] DB not available — falling back to in-memory only');
      this._seedFromJson();
      this.initialized = true;
      return;
    }
    console.log(`[EventStore] Connected to PostgreSQL: ${version.split(',')[0]}`);

    // 2. Run migrations
    try {
      await runMigrations();
      this.dbReady = true;
    } catch (e) {
      console.warn('[EventStore] Migration failed — falling back to in-memory only:', e.message);
      this._seedFromJson();
      this.initialized = true;
      return;
    }

    // 3. Try to hydrate from DB
    const dbEventCount = await eventsRepo.getCount().catch(() => 0);

    if (dbEventCount > 0) {
      // DB has data — hydrate from DB
      console.log(`[EventStore] Hydrating from DB: ${dbEventCount} events found`);
      await this._hydrateFromDb();
    } else {
      // DB is empty — seed from JSON and persist to DB
      console.log('[EventStore] DB is empty — seeding from JSON and persisting');
      this._seedFromJson();
      await this._persistSeedToDb();
    }

    this.initialized = true;
    // Load realOnlyMode from settings
    this.realOnlyMode = (await this.getSetting('realOnlyMode', 'false')) === 'true';
    console.log(`[EventStore] Ready: ${this.events.length} events, ${Object.keys(this.ops).length} OPS, ${this.agents.length} agents, ${this.signals.length} signals (DB: ${this.dbReady ? 'ON' : 'OFF'}, realOnlyMode: ${this.realOnlyMode})`);
  }

  // Hydrate all entities from DB into in-memory cache
  async _hydrateFromDb() {
    // Events — include archived so the store preserves their archive flag
    // through pipeline updates; getEvents() filters them for API consumers.
    const dbEvents = await eventsRepo.getAll({ limit: 5000, archived: 'all' });
    this.events = dbEvents;

    // OPS
    const dbOps = await opsRepo.getAll();
    this.ops = dbOps;

    // Signals (latest N from DB-backed config)
    const maxSignals = refLoader.getConnectorConfig('store', 'max_signals', 5000);
    const dbSignals = await signalsRepo.getAll({ limit: maxSignals });
    this.signals = dbSignals;

    // Enrich events with data provenance (compute from signals)
    this._enrichEventsWithDataModes();

    // Agents
    const dbAgents = await agentsRepo.getAll();
    if (dbAgents.length > 0) {
      // Merge DB runtime state with config (config has the `config` field with type info)
      this.agents = agentConfig.agents.map(a => {
        const dbState = dbAgents.find(db => db.id === a.id);
        return {
          ...a,
          status: dbState?.status || 'idle',
          lastPoll: dbState?.lastPoll || null,
          lastSignalAt: dbState?.lastSignalAt || null,
          signalCount: dbState?.signalCount || 0,
          errorCount: dbState?.errorCount || 0,
          lastError: dbState?.lastError || null,
          config: agentConfig.agentTypes.find(t => t.type === a.type) || null,
          dataSourceMode: (agentConfig.agentTypes.find(t => t.type === a.type) || {}).dataSourceMode || 'mock',
        };
      });
    } else {
      this._seedAgentsFromConfig();
    }

    // Regions
    const dbRegions = await regionsRepo.getAll();
    if (dbRegions.length > 0) {
      this.regions = dbRegions;
    }
  }

  // Seed from JSON (in-memory only — same as old seed())
  _seedFromJson() {
    this.events = dmData.EVENTS.map(ev => ({ ...ev }));
    this.ops = { ...dmData.OPS };
    this._seedAgentsFromConfig();
    this._generateSeedSignals();
  }

  _seedAgentsFromConfig() {
    this.agents = agentConfig.agents.map(a => ({
      ...a,
      status: 'idle',
      lastPoll: null,
      lastSignalAt: null,
      signalCount: 0,
      config: agentConfig.agentTypes.find(t => t.type === a.type) || null,
      dataSourceMode: (agentConfig.agentTypes.find(t => t.type === a.type) || {}).dataSourceMode || 'mock',
    }));
  }

  // Persist seed data to DB (first run)
  async _persistSeedToDb() {
    if (!this.dbReady) return;
    console.log('[EventStore] Persisting seed data to DB...');

    // Persist events
    for (const ev of this.events) {
      await eventsRepo.upsert(ev).catch(e => console.error('[DB] event persist failed:', ev.id, e.message));
    }

    // Persist OPS
    for (const [eventId, ops] of Object.entries(this.ops)) {
      await opsRepo.upsert(eventId, ops).catch(e => console.error('[DB] ops persist failed:', eventId, e.message));
    }

    // Persist agents
    for (const agent of this.agents) {
      await agentsRepo.upsert(agent).catch(e => console.error('[DB] agent persist failed:', agent.id, e.message));
    }

    // Persist regions
    for (const region of this.regions) {
      await regionsRepo.upsert(region).catch(e => console.error('[DB] region persist failed:', region.id, e.message));
    }

    // Persist seed signals
    for (const signal of this.signals) {
      await signalsRepo.insert(signal).catch(e => console.error('[DB] signal persist failed:', signal.signalId, e.message));
    }

    console.log(`[EventStore] Persisted: ${this.events.length} events, ${Object.keys(this.ops).length} OPS, ${this.agents.length} agents, ${this.signals.length} signals`);
  }

  // ── Region management ─────────────────────────────────────────────

  getRegions() {
    return this.regions;
  }

  getRegion(id) {
    return this.regions.find(r => r.id === id) || null;
  }

  setRegionEnabled(id, enabled) {
    const region = this.regions.find(r => r.id === id);
    if (!region) return null;
    region.enabled = !!enabled;
    this._notify({ type: 'region_update', data: region });
    // Write-through to DB
    if (this.dbReady) {
      regionsRepo.setEnabled(id, region.enabled).catch(e => console.error('[DB] region update failed:', e.message));
    }
    return region;
  }

  isRegionEnabled(id) {
    const region = this.regions.find(r => r.id === id);
    return region ? region.enabled : true;
  }

  getEnabledRegions() {
    return this.regions.filter(r => r.enabled);
  }

  // ── Signal operations ────────────────────────────────────────────────

  addSignal(signal) {
    this.signals.push(signal);
    if (this.signals.length > refLoader.getConnectorConfig('store', 'max_signals', 5000)) this.signals.shift(); // cap memory
    this._notify({ type: 'signal', data: signal });

    // Update agent stats
    const agent = this.agents.find(a => a.id === signal.agentId);
    if (agent) {
      agent.signalCount++;
      agent.lastSignalAt = signal.detected;
      agent.status = 'active';
    }
    // Write-through to DB
    if (this.dbReady) {
      signalsRepo.insert(signal).catch(e => console.error('[DB] signal write failed:', e.message));
      if (agent) {
        agentsRepo.updateStatus(signal.agentId, 'active', {
          lastSignalAt: signal.detected,
          signalCount: agent.signalCount,
        }).catch(e => console.error('[DB] agent update failed:', e.message));
      }
    }
    return signal;
  }

  getSignals(filters = {}) {
    let result = this.signals;
    if (filters.agentType) result = result.filter(s => s.agentType === filters.agentType);
    if (filters.region) result = result.filter(s => s.region === filters.region);
    if (filters.agentId) result = result.filter(s => s.agentId === filters.agentId);
    result = [...result].sort((a, b) => (b.detected || '').localeCompare(a.detected || ''));
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    return {
      total: result.length,
      offset,
      limit,
      signals: result.slice(offset, offset + limit),
    };
  }

  getSignalById(id) {
    return this.signals.find(s => s.signalId === id);
  }

  // ── Event operations ──────────────────────────────────────────────────

  getEvents(filters = {}) {
    let result = [...this.events];
    // archived=only → archived only; archived=all → include all; default → active only
    if (filters.archived === 'only') {
      result = result.filter(e => e.archived);
    } else if (filters.archived !== 'all') {
      result = result.filter(e => !e.archived);
    }
    if (filters.cat) result = result.filter(e => e.cat === filters.cat);
    if (filters.minScore) result = result.filter(e => e.score >= parseInt(filters.minScore));
    if (filters.region) result = result.filter(e => this._eventRegion(e) === filters.region);
    result.sort((a, b) => b.score - a.score);
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    const page = result.slice(offset, offset + limit);
    for (const e of page) e._region = this._eventRegion(e);
    return {
      total: result.length,
      offset,
      limit,
      events: page,
    };
  }

  // Region id (R1–R9) or 'remote', derived once and cached on the event.
  _eventRegion(event) {
    if (!event._region) {
      event._region = deriveEventRegion(event, geoData.EVENT_GEO[event.id]);
    }
    return event._region;
  }

  getEventById(id) {
    const e = this.events.find(e => e.id === id);
    if (e) e._region = this._eventRegion(e);
    return e;
  }

  addEvent(event) {
    event._dataModes = event._dataModes || this._computeEventDataMode(event);
    this.events.push(event);
    this._notify({ type: 'event', data: event });
    // Write-through to DB
    if (this.dbReady) {
      eventsRepo.upsert(event).catch(e => console.error('[DB] event write failed:', e.message));
    }
    return event;
  }

  updateEvent(id, updates) {
    const idx = this.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this.events[idx] = { ...this.events[idx], ...updates };
    // Recompute data provenance if signals changed
    if (updates._sourceSignals || updates._dataModes == null) {
      this.events[idx]._dataModes = this._computeEventDataMode(this.events[idx]);
    }
    this._notify({ type: 'event_updated', data: this.events[idx] });
    // Write-through to DB
    if (this.dbReady) {
      eventsRepo.upsert(this.events[idx]).catch(e => console.error('[DB] event write failed:', e.message));
    }
    return this.events[idx];
  }

  archiveEvent(id, reason = 'manual') {
    return this.updateEvent(id, {
      archived: true,
      archivedAt: new Date().toISOString(),
      archiveReason: reason,
    });
  }

  restoreEvent(id) {
    return this.updateEvent(id, {
      archived: false,
      archivedAt: null,
      archiveReason: null,
    });
  }

  countArchived() {
    return this.events.filter(e => e.archived).length;
  }

  deleteEvent(id) {
    const idx = this.events.findIndex(e => e.id === id);
    if (idx === -1) return false;
    const [removed] = this.events.splice(idx, 1);
    delete this.ops[id];
    this._notify({ type: 'event_deleted', data: { id } });
    if (this.dbReady) {
      eventsRepo.deleteById(id).catch(e => console.error('[DB] event delete failed:', e.message));
    }
    return true;
  }

  // ── OPS operations ────────────────────────────────────────────────────

  getOPS(eventId) {
    return this.ops[eventId] || null;
  }

  setOPS(eventId, ops, impactMode = 'mock') {
    this.ops[eventId] = ops;
    this._notify({ type: 'ops', data: { eventId, ops } });
    // Write-through to DB
    if (this.dbReady) {
      opsRepo.upsert(eventId, ops, impactMode).catch(e => console.error('[DB] ops write failed:', e.message));
    }
    return ops;
  }

  // ── Agent operations ──────────────────────────────────────────────────

  getAgents(filters = {}) {
    let result = [...this.agents];
    if (filters.type) result = result.filter(a => a.type === filters.type);
    if (filters.region) result = result.filter(a => a.region === filters.region);
    if (filters.priority) result = result.filter(a => a.priority === filters.priority);
    return { total: result.length, agents: result };
  }

  getAgentById(id) {
    return this.agents.find(a => a.id === id);
  }

  updateAgentStatus(id, status, extra = {}) {
    const agent = this.agents.find(a => a.id === id);
    if (agent) {
      agent.status = status;
      agent.lastPoll = new Date().toISOString();
      if (extra.signalCount != null) agent.signalCount = extra.signalCount;
      if (extra.lastSignalAt) agent.lastSignalAt = extra.lastSignalAt;
      if (extra.errorCount != null) agent.errorCount = extra.errorCount;
      if ('lastError' in extra) agent.lastError = extra.lastError;
      this._notify({ type: 'agent_status', data: { id, status, lastPoll: agent.lastPoll } });
      // Write-through to DB
      if (this.dbReady) {
        agentsRepo.updateStatus(id, status, {
          lastPoll: agent.lastPoll,
          ...extra,
        }).catch(e => console.error('[DB] agent status write failed:', e.message));
      }
    }
    return agent;
  }

  // ── Region operations (duplicate methods kept for backward compat) ──

  getRegionById(id) {
    return this.regions.find(r => r.id === id);
  }

  // ── Reference data ────────────────────────────────────────────────────

  getReferenceData() {
    return {
      DOMAINS: dmData.DOMAINS,
      ESC: dmData.ESC,
      PHASES: dmData.PHASES,
      SOPS: dmData.SOPS,
      RETRO: dmData.RETRO,
      STATIONS: geoData.STATIONS,
      AIRPORTS: geoData.AIRPORTS,
      EVENT_GEO: geoData.EVENT_GEO,
      REGIONS: refLoader.getAllRegions().map(r => ({ id: r.id, name: r.name })),
      AIRPORT_REGION,
      edpsFactors: refLoader.getEdpsFactors().length > 0
        ? refLoader.getEdpsFactors()
        : agentConfig.edpsFactors,
      operationalDomains: agentConfig.operationalDomains,
      scoreBands: refLoader.getScoringBands().length > 0
        ? refLoader.getScoringBands()
        : agentConfig.scoreBands,
      sourceTiers: agentConfig.sourceTiers,
      pipeline: agentConfig.pipeline,
    };
  }

  // ── Data provenance ─────────────────────────────────────────────────

  // Compute _dataModes for all events by looking up their source signals
  _enrichEventsWithDataModes() {
    const signalMap = {};
    for (const s of this.signals) {
      signalMap[s.signalId] = s;
    }
    for (const ev of this.events) {
      ev._dataModes = this._computeEventDataMode(ev, signalMap);
    }
  }

  // Compute data provenance for a single event
  _computeEventDataMode(event, signalMap = null) {
    if (event._source === 'seeded') {
      return { mode: 'mock', realCount: 0, mockCount: 0, totalCount: 0 };
    }
    if (!signalMap) {
      signalMap = {};
      for (const s of this.signals) signalMap[s.signalId] = s;
    }
    const sourceSignals = event._sourceSignals || [];
    let realCount = 0, mockCount = 0;
    for (const sigId of sourceSignals) {
      const sig = signalMap[sigId];
      if (!sig) continue;
      if (sig.dataSourceMode === 'mock') mockCount++;
      else realCount++;
    }
    const mode = mockCount > 0 && realCount > 0 ? 'mixed'
      : mockCount > 0 ? 'mock'
      : 'real';
    return { mode, realCount, mockCount, totalCount: realCount + mockCount };
  }

  // ── Settings (DB-backed) ──────────────────────────────────────────────

  async getSetting(key, defaultValue = null) {
    if (!this.dbReady) return defaultValue;
    return settingsRepo.get(key, defaultValue).catch(() => defaultValue);
  }

  async setSetting(key, value) {
    if (!this.dbReady) return;
    await settingsRepo.set(key, value).catch(e => console.error('[DB] setting write failed:', e.message));
  }

  // Real-only mode: when true, agents skip mock connectors
  async setRealOnlyMode(enabled) {
    this.realOnlyMode = !!enabled;
    await this.setSetting('realOnlyMode', String(this.realOnlyMode));
    this._notify({ type: 'real_only_mode', data: { enabled: this.realOnlyMode } });
    console.log(`[EventStore] realOnlyMode: ${this.realOnlyMode}`);
  }

  // ── WebSocket subscriptions ──────────────────────────────────────────

  subscribe(client) {
    this.subscribers.push(client);
  }

  unsubscribe(client) {
    this.subscribers = this.subscribers.filter(c => c !== client);
  }

  // Public broadcast — used by agents to report poll outcomes, etc.
  notify(message) {
    this._notify(message);
  }

  _notify(message) {
    const data = JSON.stringify(message);
    for (const client of this.subscribers) {
      if (client.readyState === 1) {
        try { client.send(data); } catch (e) { /* client disconnected */ }
      }
    }
  }

  // ── Seed signal generation (for first run / fallback) ────────────────

  _generateSeedSignals() {
    const categoryToAgentType = {
      'Weather': 'weather',
      'ATC / Airspace': 'atc',
      'Industrial action': 'industrial',
      'Geopolitical': 'geopolitical',
      'Infrastructure': 'infrastructure',
      'Regulatory': 'regulatory',
    };

    for (const ev of this.events) {
      const agentType = categoryToAgentType[ev.cat] || 'weather';
      const agent = this.agents.find(a => a.type === agentType) || this.agents[0];
      const signal = {
        signalId: `sig-seed-${ev.id}`,
        agentId: agent.id,
        agentType: agentType,
        region: agent.region,
        subRegion: agent.subRegion,
        detected: ev.detected,
        name: ev.name,
        hazardType: ev.cat.toLowerCase().replace(/[^a-z]/g, '_'),
        geo: geoData.EVENT_GEO[ev.id] || { lat: 0, lon: 0, radiusKm: 100 },
        airports: geoData.EVENT_GEO[ev.id]?.airports || [],
        airspace: [],
        summary: ev.summary,
        factorHints: this._extractFactorHints(ev),
        domains: ev.domains?.map(d => d.name) || [],
        preliminaryEffects: ev.chain?.map(c => ({ ord: c.ord, title: c.title, lead: c.lead })) || [],
        evidence: ev.evidence || [],
        rawRefs: [],
        eventId: ev.id,
        dataSourceMode: agentType === 'weather' ? 'real' : 'mock',
      };
      this.signals.push(signal);
      agent.signalCount++;
      agent.lastSignalAt = ev.detected;
    }
  }

  _extractFactorHints(ev) {
    if (!ev.factors) return {};
    const hints = {};
    const map = {
      'Probability of occurrence': 'probability',
      'Severity if realised': 'severity',
      'Geographic reach': 'geographicReach',
      'Expected duration': 'expectedDuration',
      'Time to impact': 'timeToImpact',
      'Escalation rate': 'escalationRate',
      'Source credibility': 'sourceCredibility',
      'Prediction confidence': 'predictionConfidence',
    };
    for (const f of ev.factors) {
      const key = map[f.label];
      if (key) hints[key] = f.val;
    }
    return hints;
  }
}

// Singleton
const store = new EventStore();
export default store;
