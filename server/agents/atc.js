// atc.js — ATCAgent
// Uses FAA ASWS connector for real US airport delays + mock fallback.

import { Agent } from '../engine/agent-base.js';
import faaASWS from '../connectors/faa-asws.js';
import { generateMockATC } from '../connectors/mock-atc.js';

export class ATCAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const observations = [];

    // ── Real data: FAA ASWS airport delays ──
    try {
      const delays = await faaASWS.fetchAirportDelays();
      // Filter to airports in this sub-region
      const regionDelays = delays.filter((d) => airports.includes(d.airport));
      const realObs = faaASWS.buildDelayObservations(regionDelays, this.region, this.subRegion);
      observations.push(...realObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] FAA ASWS error:`, err.message);
    }

    // ── Fallback: if no real data, use mock ──
    if (observations.length === 0 && this.shouldEmitMockSignals()) {
      const mockObs = generateMockATC(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    return observations;
  }
}
