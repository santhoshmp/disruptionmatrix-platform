// regulatory.js — RegulatoryAgent
// Uses GDELT for regulatory directive news + mock fallback.

import { Agent } from '../engine/agent-base.js';
import gdelt from '../connectors/gdelt.js';
import { generateMockRegulatory } from '../connectors/mock-regulatory.js';

export class RegulatoryAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const observations = [];

    // ── Real data: GDELT regulatory news ──
    try {
      const articles = await gdelt.fetchEvents('regulatory', { days: 7, maxRecords: 10 });
      const gdeltObs = gdelt.buildGDELTObservations(articles, 'regulatory', this.region, this.subRegion);
      observations.push(...gdeltObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] GDELT regulatory error:`, err.message);
    }

    // ── Fallback: if no real data, use mock ──
    if (observations.length === 0) {
      const mockObs = generateMockRegulatory(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    return observations;
  }
}
