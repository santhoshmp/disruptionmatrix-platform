// infrastructure.js — InfrastructureAgent
// Uses GDELT for infrastructure failure news + USGS earthquakes + mock fallback.

import { Agent } from '../engine/agent-base.js';
import gdelt from '../connectors/gdelt.js';
import usgs from '../connectors/usgs-earthquakes.js';
import { generateMockInfrastructure } from '../connectors/mock-infrastructure.js';

export class InfrastructureAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const bbox = this.getRegionBbox();
    const observations = [];

    // ── Real data: GDELT infrastructure failure news ──
    try {
      const articles = await gdelt.fetchEvents('infrastructure', { days: 3, maxRecords: 10 });
      const gdeltObs = gdelt.buildGDELTObservations(articles, 'infrastructure', this.region, this.subRegion);
      observations.push(...gdeltObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] GDELT infrastructure error:`, err.message);
    }

    // ── Real data: USGS earthquakes in this region ──
    try {
      const quakes = await usgs.fetchEarthquakes({ bbox, days: 1, minMagnitude: 4.5 });
      const quakeObs = usgs.buildEarthquakeObservations(quakes, this.region, this.subRegion);
      observations.push(...quakeObs);
    } catch (err) {
      console.error(`[Agent ${this.id}] USGS earthquake error:`, err.message);
    }

    // ── Fallback: if no real data, use mock ──
    if (observations.length === 0) {
      const mockObs = generateMockInfrastructure(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    return observations;
  }
}
