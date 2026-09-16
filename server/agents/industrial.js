// industrial.js — IndustrialActionAgent
// Uses GDELT for strike/walkout news + mock fallback.

import { Agent } from '../engine/agent-base.js';
import gdelt from '../connectors/gdelt.js';
import { generateMockIndustrial } from '../connectors/mock-industrial.js';

export class IndustrialActionAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const observations = [];

    // ── Real data: GDELT industrial action news ──
    try {
      const articles = await gdelt.fetchEvents('industrial', { days: 7, maxRecords: 15 });
      const gdeltObs = gdelt.buildGDELTObservations(articles, 'industrial', this.region, this.subRegion);
      observations.push(...gdeltObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] GDELT industrial error:`, err.message);
    }

    // ── Fallback: if no real data, use mock ──
    if (observations.length === 0) {
      const mockObs = generateMockIndustrial(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    return observations;
  }
}
