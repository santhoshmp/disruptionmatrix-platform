// agent-base.js — Base Agent class
// Provides the polling loop, normalization, signal emission, and scheduling.
// Each agent type (weather, atc, etc.) extends this class and implements
// the `collect()` method which calls its connector(s) and returns raw observations.

import store from '../store/event-store.js';

// IATA → ICAO code mapping for aviationweather.gov API
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
};

export const ICAO_TO_IATA = Object.fromEntries(
  Object.entries(IATA_TO_ICAO).map(([iata, icao]) => [icao, iata])
);

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
    this.pollCount = 0;
    this.lastPollAt = null;
    this.lastError = null;
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

    this.lastPollAt = new Date().toISOString();
    this.pollCount++;
    this._updateStatus('polling');

    try {
      const observations = await this.collect();
      if (observations && observations.length > 0) {
        for (const obs of observations) {
          const signal = this.normalize(obs);
          if (signal) {
            store.addSignal(signal);
          }
        }
        this._updateStatus('active');
      } else {
        this._updateStatus('idle');
      }
      this.lastError = null;
    } catch (err) {
      this.lastError = err.message;
      this._updateStatus('error');
      console.error(`[Agent ${this.id}] Poll error:`, err.message);
    }
  }

  // Update agent status in the store
  _updateStatus(status) {
    store.updateAgentStatus(this.id, status);
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
    };
  }

  // Subclasses MUST implement this — returns array of raw observations
  async collect() {
    throw new Error(`${this.id}: collect() must be implemented by subclass`);
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
