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
    console.log(`[EventStore] Ready: ${this.events.length} events, ${Object.keys(this.ops).length} OPS, ${this.agents.length} agents, ${this.signals.length} signals (DB: ${this.dbReady ? 'ON' : 'OFF'})`);
  }

  // Hydrate all entities from DB into in-memory cache
  async _hydrateFromDb() {
    // Events
    const dbEvents = await eventsRepo.getAll({ limit: 5000 });
    this.events = dbEvents;

    // OPS
    const dbOps = await opsRepo.getAll();
    this.ops = dbOps;

    // Signals (latest 5000)
    const dbSignals = await signalsRepo.getAll({ limit: 5000 });
    this.signals = dbSignals;

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
    if (this.signals.length > 5000) this.signals.shift(); // cap memory
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
    if (filters.cat) result = result.filter(e => e.cat === filters.cat);
    if (filters.minScore) result = result.filter(e => e.score >= parseInt(filters.minScore));
    result.sort((a, b) => b.score - a.score);
    const limit = parseInt(filters.limit) || 50;
    const offset = parseInt(filters.offset) || 0;
    return {
      total: result.length,
      offset,
      limit,
      events: result.slice(offset, offset + limit),
    };
  }

  getEventById(id) {
    return this.events.find(e => e.id === id);
  }

  addEvent(event) {
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
    this._notify({ type: 'event_updated', data: this.events[idx] });
    // Write-through to DB
    if (this.dbReady) {
      eventsRepo.update(id, updates).catch(e => console.error('[DB] event update failed:', e.message));
    }
    return this.events[idx];
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
      if (extra.lastError) agent.lastError = extra.lastError;
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
      edpsFactors: agentConfig.edpsFactors,
      operationalDomains: agentConfig.operationalDomains,
      scoreBands: agentConfig.scoreBands,
      sourceTiers: agentConfig.sourceTiers,
      pipeline: agentConfig.pipeline,
    };
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

  // ── WebSocket subscriptions ──────────────────────────────────────────

  subscribe(client) {
    this.subscribers.push(client);
  }

  unsubscribe(client) {
    this.subscribers = this.subscribers.filter(c => c !== client);
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
