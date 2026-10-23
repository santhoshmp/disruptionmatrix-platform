// agent-base.js — Base Agent class
// Provides the polling loop, normalization, signal emission, and scheduling.
// Each agent type (weather, atc, etc.) extends this class and implements
// the `collect()` method which calls its connector(s) and returns raw observations.

import store from '../store/event-store.js';
import * as refLoader from '../data/reference-loader.js';

// IATA → ICAO code mapping for aviationweather.gov API
// Phase 1: hardcoded const kept as fallback; getIataToIcaoMap() reads from
// the DB-backed reference loader when available.
export const IATA_TO_ICAO = {
  // India
  BLR: 'VOBL', DEL: 'VIDP', BOM: 'VABB', MAA: 'VOMM', HYD: 'VOHS',
  COK: 'VOCI', CCU: 'VECC', GOI: 'VAGO', PNQ: 'VAPO', VTZ: 'VOVZ',
  AMD: 'VAAH', JAI: 'VIJP', LKO: 'VILK', IXC: 'VICG', GAU: 'VEGT',
  // Europe
  VIE: 'LOWW', MUC: 'EDDM', PRG: 'LKPR', BUD: 'LHBP',
  FRA: 'EDDF', AMS: 'EHAM', CDG: 'LFPG', BRU: 'EBBR',
  ZRH: 'LSZH', GVA: 'LSGG', CPH: 'EKCH', OSL: 'ENGM', EDI: 'EGPH',
  FCO: 'LIRF', MAD: 'LEMD', IST: 'LTFM', LIS: 'LPPT', ATH: 'LGAV',
  // Middle East
  DXB: 'OMDB', AUH: 'OMAA', MCT: 'OOMS', DOH: 'OTBD', BAH: 'OBBI',
  // Southeast Asia
  BKK: 'VTBS', KUL: 'WMKK', SIN: 'WSSS', CGK: 'WIII',
  // North Atlantic / North America
  LHR: 'EGLL', LGW: 'EGKK', STN: 'EGSS',
  JFK: 'KJFK', YYZ: 'CYYZ', ORD: 'KORD', SFO: 'KSFO',
  // East Asia
  HKG: 'VHHH', NRT: 'RJAA', ICN: 'RKSI',
  // Africa
  JNB: 'FAOR', NBO: 'HKJK',
  // Oceania
  SYD: 'YSSY', MEL: 'YMML', BNE: 'YBBN', PER: 'YPPH', AKL: 'NZAA',
  // South America
  GRU: 'SBGR', EZE: 'SAEZ', SCL: 'SCEL', BOG: 'SKBO', LIM: 'SPJC',
};

export const ICAO_TO_IATA = Object.fromEntries(
  Object.entries(IATA_TO_ICAO).map(([iata, icao]) => [icao, iata])
);

// DB-backed IATA↔ICAO lookups (fall back to hardcoded consts above)
export function getIataToIcaoMap() {
  return refLoader.getIataToIcao();
}
export function getIcaoToIataMap() {
  return refLoader.getIcaoToIata();
}
export function iataToIcao(iata) {
  return refLoader.getIataToIcao()[iata] || IATA_TO_ICAO[iata] || null;
}
export function icaoToIata(icao) {
  return refLoader.getIcaoToIata()[icao] || ICAO_TO_IATA[icao] || null;
}

export class Agent {
  constructor(config, typeConfig) {
    this.id = config.id;
    this.type = config.type;
    this.region = config.region;
    this.subRegion = config.subRegion;
    this.priority = config.priority;
    this.pollInterval = (typeConfig.pollIntervalMinutes || 5) * 60 * 1000;
    this.typeConfig = typeConfig;
    this.config = config;
    this.timer = null;
    this.isRunning = false;
    this.paused = false;
    this.status = 'idle';
    this.pollCount = 0;
    this.lastPollAt = null;
    this.lastError = null;
    // Outcome tracking — surfaced in getStatus() so the UI can show what
    // each agent actually produced, not just when it last ran.
    this.totalSignals = 0;
    this.lastSignalsGenerated = 0;
    this.lastSignalAt = null;
    this.lastSignalName = null;
    this.lastDurationMs = null;
  }

  // Start the polling loop
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._updateStatus('polling');
    // Do an initial poll after a short stagger (to avoid all agents hitting APIs at once)
    const stagger = Math.random() * 3000;
    this.timer = setTimeout(() => {
      this._poll();
      this.timer = setInterval(() => this._poll(), this.pollInterval);
    }, stagger);
    console.log(`[Agent ${this.id}] Started (poll every ${this.pollInterval / 1000}s, stagger ${Math.round(stagger)}ms)`);
  }

  // Stop the polling loop
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this._updateStatus('idle');
  }

  // Manually trigger a poll
  async trigger() {
    return this._poll();
  }

  // Internal poll cycle
  async _poll() {
    // Skip if paused (region disabled)
    if (this.paused) {
      this._updateStatus('paused');
      return { skipped: true, reason: 'Region disabled' };
    }

    const startedAt = Date.now();
    this.lastPollAt = new Date(startedAt).toISOString();
    this.pollCount++;
    this._updateStatus('polling');

    try {
      const observations = await this.collect();
      let signalsGenerated = 0;
      let lastSignalName = null;
      if (observations && observations.length > 0) {
        for (const obs of observations) {
          const signal = this.normalize(obs);
          if (signal) {
            store.addSignal(signal);
            lastSignalName = signal.name;
            signalsGenerated++;
          }
        }
      }
      this.lastDurationMs = Date.now() - startedAt;
      this.lastSignalsGenerated = signalsGenerated;
      if (signalsGenerated > 0) {
        this.totalSignals += signalsGenerated;
        this.lastSignalAt = new Date().toISOString();
        this.lastSignalName = lastSignalName;
      }
      this.lastError = null;
      this._updateStatus(signalsGenerated > 0 ? 'active' : 'idle', {
        signalCount: this.totalSignals,
        lastSignalAt: this.lastSignalAt,
        lastError: null,
      });
      store.notify({
        type: 'agent_poll',
        data: { id: this.id, agentType: this.type, region: this.region, signals: signalsGenerated, durationMs: this.lastDurationMs },
      });
      return { signalsGenerated };
    } catch (err) {
      this.lastDurationMs = Date.now() - startedAt;
      this.lastSignalsGenerated = 0;
      this.lastError = err.message;
      this._updateStatus('error', { lastError: err.message });
      store.notify({
        type: 'agent_poll',
        data: { id: this.id, agentType: this.type, region: this.region, signals: 0, durationMs: this.lastDurationMs, error: err.message },
      });
      console.error(`[Agent ${this.id}] Poll error:`, err.message);
      return { signalsGenerated: 0, error: err.message };
    }
  }

  // Update agent status in the store
  _updateStatus(status, extra = {}) {
    this.status = status;
    store.updateAgentStatus(this.id, status, extra);
  }

  // Normalize a raw observation into the signal contract
  normalize(obs) {
    if (!obs) return null;
    return {
      signalId: obs.signalId || `${this.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId: this.id,
      agentType: this.type,
      region: this.region,
      subRegion: this.subRegion,
      detected: obs.detected || new Date().toISOString(),
      name: obs.name || 'Unnamed signal',
      hazardType: obs.hazardType || this.type,
      geo: obs.geo || { lat: 0, lon: 0, radiusKm: 100 },
      airports: obs.airports || [],
      airspace: obs.airspace || [],
      summary: obs.summary || '',
      factorHints: obs.factorHints || {},
      domains: obs.domains || [],
      preliminaryEffects: obs.preliminaryEffects || [],
      evidence: obs.evidence || [],
      rawRefs: obs.rawRefs || [],
      eventId: obs.eventId || null,
      dataSourceMode: obs.dataSourceMode || this.typeConfig.dataSourceMode || 'mock',
      corroborateOnly: obs.corroborateOnly || false,
    };
  }

  // Subclasses MUST implement this — returns array of raw observations
  async collect() {
    throw new Error(`${this.id}: collect() must be implemented by subclass`);
  }

  // Whether mock connectors should emit signals (respects realOnlyMode)
  shouldEmitMockSignals() {
    return !store.realOnlyMode;
  }

  // Helper: get airports for this agent's sub-region from the config
  getRegionAirports() {
    const region = store.regions.find(r => r.id === this.region);
    if (!region) return [];
    const sub = region.subRegions.find(s => s.id === this.subRegion);
    return sub?.airports || [];
  }

  // Helper: get bounding box for this agent's sub-region
  getRegionBbox() {
    const region = store.regions.find(r => r.id === this.region);
    if (!region) return null;
    const sub = region.subRegions.find(s => s.id === this.subRegion);
    return sub?.bbox || null;
  }

  // Helper: convert IATA codes to ICAO
  toIcao(iataCodes) {
    return iataCodes.map(code => IATA_TO_ICAO[code]).filter(Boolean);
  }
}
