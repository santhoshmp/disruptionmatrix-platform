// social.js — SocialAgent
// Collects social disruption reports from Reddit (aviation subreddits)
// and GDELT news. Falls back to mock-social.js when no API keys are configured.
// Social signals have corroborateOnly=true — they enrich existing events
// rather than creating new ones (see pipeline.js).

import { Agent } from '../engine/agent-base.js';
import reddit from '../connectors/reddit.js';
import { generateMockSocial } from '../connectors/mock-social.js';

export class SocialAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const observations = [];

    // ── Real data: Reddit aviation subreddits ──
    if (reddit.isConfigured()) {
      try {
        const posts = await reddit.fetchAllSubreddits();
        // Filter to posts mentioning airports in this region
        const regionPosts = posts.filter(p =>
          p.airportCodes.some(c => airports.includes(c))
        );
        observations.push(...regionPosts);
      } catch (err) {
        console.error(`[Agent ${this.id}] Reddit error:`, err.message);
      }
    }

    // ── Fallback: mock social reports ──
    if (observations.length === 0 && this.shouldEmitMockSignals()) {
      const mockObs = generateMockSocial(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    // Tag all with region/subRegion
    for (const o of observations) {
      o.region = this.region;
      o.subRegion = this.subRegion;
    }

    return observations;
  }
}

export default { SocialAgent };
