// weather.js — WeatherAgent
// Uses the real aviationweather.gov connector for METAR/TAF/SIGMET.
// Falls back to mock data if the API is unreachable.

import { Agent } from '../engine/agent-base.js';
import aw from '../connectors/aviationweather.js';
import openMeteo from '../connectors/open-meteo.js';
import eonet from '../connectors/nasa-eonet.js';
import { generateMockWeather } from '../connectors/mock-weather.js';

export class WeatherAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const bbox = this.getRegionBbox();
    const observations = [];

    // ── Real data: METAR for airports in this sub-region ──
    if (airports.length > 0) {
      const icaoCodes = this.toIcao(airports);
      const metars = await aw.fetchMETAR(icaoCodes);

      for (const metar of metars) {
        const parsed = aw.parseMETAR(metar);
        if (parsed.hazards.length === 0) continue; // no hazard = no signal

        for (const hazard of parsed.hazards) {
          observations.push(this._buildWeatherObservation(parsed, hazard));
        }
      }
    }

    // ── Real data: SIGMETs within the sub-region bbox ──
    if (bbox) {
      const sigmets = await aw.fetchSIGMET(bbox);
      for (const sigmet of sigmets) {
        const parsed = aw.parseSIGMET(sigmet);
        if (parsed.hazardType === 'weather') continue; // unparseable
        observations.push(this._buildSIGMETObservation(parsed));
      }
    }

    // ── Real data: Open-Meteo forecast for airports (severe weather not in METAR) ──
    if (airports.length > 0) {
      try {
        const ometeoObs = await openMeteo.buildWeatherObservations(airports);
        observations.push(...ometeoObs);
      } catch (err) {
        console.error(`[Agent ${this.id}] Open-Meteo error:`, err.message);
      }
    }

    // ── Real data: NASA EONET natural events in this region ──
    if (bbox) {
      try {
        const events = await eonet.fetchEvents({ status: 'open', limit: 50, days: 7 });
        const regionEvents = eonet.filterByBbox(events, bbox);
        const eonetObs = eonet.buildEonetObservations(regionEvents, this.region, this.subRegion);
        observations.push(...eonetObs);
      } catch (err) {
        console.error(`[Agent ${this.id}] NASA EONET error:`, err.message);
      }
    }

    // ── Fallback: if no real data came through, use mock ──
    if (observations.length === 0) {
      const mockObs = generateMockWeather(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    return observations;
  }

  _buildWeatherObservation(parsed, hazard) {
    const severityMap = { critical: 90, high: 75, moderate: 55, low: 35 };
    const sevVal = severityMap[hazard.severity] || 50;

    return {
      signalId: `wx-${this.id}-${parsed.iata}-${hazard.type}-${Date.now()}`,
      detected: new Date().toISOString(),
      name: `${parsed.iata} ${hazard.type.replace(/_/g, ' ')} — ${hazard.detail}`,
      hazardType: hazard.type,
      geo: parsed.lat ? { lat: parsed.lat, lon: parsed.lon, radiusKm: 50 } : { lat: 0, lon: 0, radiusKm: 50 },
      airports: parsed.iata ? [parsed.iata] : [],
      airspace: [],
      summary: hazard.detail,
      factorHints: {
        probability: sevVal + 5,
        severity: sevVal,
        geographicReach: parsed.iata ? 40 : 30,
        expectedDuration: 60,
        timeToImpact: 85,
        escalationRate: 50,
        sourceCredibility: 85, // official met source
        predictionConfidence: 70,
      },
      domains: ['Airport operations', 'Flight schedule'],
      preliminaryEffects: [
        { ord: 1, title: `Reduced capacity at ${parsed.iata || 'affected airport'}`, lead: '0–2h' },
      ],
      evidence: [{
        source: 'NOAA/NWS Aviation Weather Center (METAR)',
        tier: 1,
        role: 'Primary meteorological source',
        timestamp: new Date().toISOString(),
        excerpt: parsed.rawOb || hazard.detail,
      }],
      rawRefs: [`awc-metar-${parsed.icao}-${Date.now()}`],
      dataSourceMode: 'real',
    };
  }

  _buildSIGMETObservation(parsed) {
    const severityMap = { critical: 90, high: 75, moderate: 55, low: 35 };
    const sevVal = severityMap[parsed.severity] || 50;

    return {
      signalId: `wx-sigmet-${this.id}-${parsed.hazardType}-${Date.now()}`,
      detected: new Date().toISOString(),
      name: `SIGMET: ${parsed.hazardType.replace(/_/g, ' ')}${parsed.iata ? ' near ' + parsed.iata : ''}`,
      hazardType: parsed.hazardType,
      geo: parsed.lat ? { lat: parsed.lat, lon: parsed.lon, radiusKm: 200 } : { lat: 0, lon: 0, radiusKm: 200 },
      airports: parsed.iata ? [parsed.iata] : [],
      airspace: [],
      summary: parsed.rawSigmet || `${parsed.hazardType} SIGMET issued`,
      factorHints: {
        probability: sevVal + 10,
        severity: sevVal,
        geographicReach: 60,
        expectedDuration: 70,
        timeToImpact: 90,
        escalationRate: 60,
        sourceCredibility: 85,
        predictionConfidence: 75,
      },
      domains: ['Airport operations', 'Flight schedule', 'Aircraft rotations'],
      preliminaryEffects: [
        { ord: 1, title: 'Airspace avoidance / rerouting likely', lead: '0–1h' },
      ],
      evidence: [{
        source: 'NOAA/NWS Aviation Weather Center (SIGMET)',
        tier: 1,
        role: 'Primary meteorological source',
        timestamp: new Date().toISOString(),
        excerpt: parsed.rawSigmet,
      }],
      rawRefs: [`awc-sigmet-${Date.now()}`],
      dataSourceMode: 'real',
    };
  }
}
