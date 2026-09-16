// geopolitical.js — GeopoliticalAgent
// Uses SafeAirspace.net + FAA TFR feed + GDELT for geopolitical events + mock fallback.

import { Agent } from '../engine/agent-base.js';
import safeairspace from '../connectors/safeairspace.js';
import faaTFR from '../connectors/faa-tfr.js';
import gdelt from '../connectors/gdelt.js';
import { generateMockGeopolitical } from '../connectors/mock-geopolitical.js';

export class GeopoliticalAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const bbox = this.getRegionBbox();
    const observations = [];

    // ── Real data: FAA TFRs in this region bbox ──
    try {
      const tfrs = await faaTFR.fetchTFRs();
      const regionTFRs = faaTFR.filterTFRsByBbox(tfrs, bbox);
      const tfrObs = faaTFR.buildTFRObservations(regionTFRs, this.region, this.subRegion);
      observations.push(...tfrObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] FAA TFR error:`, err.message);
    }

    // ── Real data: GDELT geopolitical events ──
    try {
      const articles = await gdelt.fetchEvents('geopolitical', { days: 3, maxRecords: 10 });
      const gdeltObs = gdelt.buildGDELTObservations(articles, 'geopolitical', this.region, this.subRegion);
      observations.push(...gdeltObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] GDELT geopolitical error:`, err.message);
    }

    // ── Fallback: if no real data, use mock ──
    if (observations.length === 0) {
      const mockObs = generateMockGeopolitical(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    return observations;
  }
}
