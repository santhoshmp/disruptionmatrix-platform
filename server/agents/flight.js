// flight.js — FlightAgent
// Collects real-time flight schedule data from OpenSky (live ADS-B),
// AviationStack (scheduled vs actual), and FAA ASWS (ground stops).
// Falls back to mock-flights.js when no API keys are configured.

import { Agent, icaoToIata as lookupIcaoToIata } from '../engine/agent-base.js';
import opensky from '../connectors/opensky.js';
import aviationstack from '../connectors/aviationstack.js';
import airlabs from '../connectors/airlabs.js';
import adsblol from '../connectors/adsblol.js';
import { generateMockFlights } from '../connectors/mock-flights.js';
import { AIRPORTS } from '../data/airport-lookup.js';
import * as refLoader from '../data/reference-loader.js';

export class FlightAgent extends Agent {
  async collect() {
    const airports = this.getRegionAirports();
    const observations = [];

    // ── Real data: scheduled vs actual flights ──
    // AirLabs free tier (~1,000 req/mo) is more generous than AviationStack
    // (100 req/mo) — prefer it when configured, fall back to AviationStack.
    const flightApi = airlabs.isConfigured() ? airlabs : (aviationstack.isConfigured() ? aviationstack : null);
    if (flightApi) {
      try {
        for (const iata of airports) {
          const cancelled = await flightApi.fetchCancellations(iata, 20);
          observations.push(...cancelled);
          const departures = await flightApi.fetchDepartures(iata, 50);
          observations.push(...departures.filter(f => f.delayMin > 45));
        }
      } catch (err) {
        console.error(`[Agent ${this.id}] Flight schedule API error:`, err.message);
      }
    }

    // ── Real data: OpenSky live flight activity ──
    if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
      try {
        const icaos = this.toIcao(airports);
        const now = Math.floor(Date.now() / 1000);
        // /flights/all: one shared call covers every airport (10-min cache).
        const all = await opensky.fetchAllFlights(now - 7200, now);
        for (const f of all) {
          if (f.estDepartureAirport && icaos.includes(f.estDepartureAirport)) {
            observations.push(this.normalizeOpenskyFlight(f, 'departure'));
          } else if (f.estArrivalAirport && icaos.includes(f.estArrivalAirport)) {
            observations.push(this.normalizeOpenskyFlight(f, 'arrival'));
          }
        }

        // /states/all: live ADS-B positions — separate quota bucket, so this
        // works even when /flights/* is exhausted. Count aircraft on the
        // ground at each region airport as a live-activity corroboration.
        const states = await opensky.fetchAllStates();
        const apCoords = this.getAirportCoords(airports);
        const onGround = {};
        for (const s of states) {
          if (!s[8]) continue; // not on ground
          const lon = s[5], lat = s[6];
          if (lon == null || lat == null) continue;
          for (const [iata, c] of Object.entries(apCoords)) {
            const d = Math.hypot(lat - c.lat, lon - c.lon) * 111; // rough km
            if (d < 25) { onGround[iata] = (onGround[iata] || 0) + 1; break; }
          }
        }
        this.openskyGround = onGround;
      } catch (err) {
        console.error(`[Agent ${this.id}] OpenSky error:`, err.message);
      }
    }

    // ── adsb.lol: free community ADS-B — no key, denser coverage than
    // OpenSky in Gulf/Asia. Per-airport queries give ground counts plus
    // emergency squawks (7700/7600/7500) which ARE real threat signals.
    try {
      const apCoords = this.getAirportCoords(airports);
      for (const iata of airports) {
        const c = apCoords[iata];
        if (!c) continue;
        const ac = await adsblol.fetchAircraftNearPoint(c.lat, c.lon, 15);
        if (ac.length === 0) continue;

        const ground = ac.filter(a => a.onGround).length;
        const openSkyCount = this.openskyGround?.[iata] || 0;
        const groundCount = Math.max(ground, openSkyCount);
        // Throttle: ~60 airports × every-2min floods the signal buffer.
        // Emit only on meaningful change (±3 aircraft or ±25%) or every
        // 30 min as a heartbeat — corroboration stays fresh without noise.
        this._lastGround = this._lastGround || {};
        const prev = this._lastGround[iata];
        const changed = !prev || Math.abs(groundCount - prev.count) >= 3
          || Math.abs(groundCount - prev.count) >= Math.max(1, prev.count * 0.25);
        const heartbeat = !prev || (Date.now() - prev.at) > 30 * 60 * 1000;
        if (groundCount > 0 && (changed || heartbeat)) {
          this._lastGround[iata] = { count: groundCount, at: Date.now() };
          const src = ground >= openSkyCount ? 'adsb.lol' : 'OpenSky';
          observations.push({
            type: 'flight_schedule',
            name: `${iata} ground activity`,
            airports: [iata],
            geo: { lat: c.lat, lon: c.lon, radiusKm: 50 },
            summary: `${iata}: ${groundCount} aircraft on ground (live ADS-B, ${src})`,
            hazardType: null,
            corroborateOnly: true, // enrich events, don't create threat events
          });
        }

        // Emergency squawks are genuine threat signals — emit real events.
        for (const a of ac) {
          const isEmergency = a.emergency || ['7700', '7600', '7500'].includes(a.squawk);
          if (!isEmergency) continue;
          const label = a.squawk === '7500' ? 'unlawful interference'
            : a.squawk === '7600' ? 'radio failure'
            : (a.emergency || 'general emergency');
          observations.push({
            type: 'flight_schedule',
            name: `${a.callsign || a.hex} declared emergency`,
            airports: [iata],
            geo: { lat: a.lat, lon: a.lon, radiusKm: 30 },
            summary: `${a.callsign || a.hex} squawking ${a.squawk} (${label}) near ${iata}`,
            hazardType: 'emergency',
            factorHints: { severity: 75, geographicReach: 20, timeToImpact: 95, probability: 90, sourceCredibility: 85 },
          });
        }
      }
    } catch (err) {
      console.error(`[Agent ${this.id}] adsb.lol error:`, err.message);
    }

    // ── Fallback: mock flight schedules ──
    if (observations.length === 0 && this.shouldEmitMockSignals()) {
      const mockObs = generateMockFlights(this.region, this.subRegion, airports);
      observations.push(...mockObs);
    }

    // Tag all with region/subRegion
    for (const o of observations) {
      o.region = this.region;
      o.subRegion = this.subRegion;
    }

    return observations;
  }

  normalizeOpenskyFlight(f, type) {
    const airportIcao = type === 'departure' ? f.estDepartureAirport : f.estArrivalAirport;
    const airportIata = this.icaoToIata(airportIcao);
    return {
      type: 'flight_schedule',
      flightNumber: (f.callsign || 'UNKNOWN').trim(),
      departureAirport: this.icaoToIata(f.estDepartureAirport),
      arrivalAirport: this.icaoToIata(f.estArrivalAirport),
      scheduledDeparture: f.firstSeen ? new Date(f.firstSeen * 1000).toISOString() : null,
      actualDeparture: f.firstSeen ? new Date(f.firstSeen * 1000).toISOString() : null,
      actualArrival: f.lastSeen ? new Date(f.lastSeen * 1000).toISOString() : null,
      status: 'active',
      cancelled: false,
      diverted: false,
      airports: [airportIata].filter(Boolean),
      name: `${(f.callsign || 'UNKNOWN').trim()} ${type} ${airportIata || '?'}`,
      summary: `${(f.callsign || 'UNKNOWN').trim()} ${type} ${airportIata || '?'}`,
      hazardType: null,
    };
  }

  icaoToIata(icao) {
    if (!icao) return null;
    return lookupIcaoToIata(icao);
  }

  // IATA → {lat, lon} for region airports: master data first, hardcoded fallback.
  getAirportCoords(iataCodes) {
    const out = {};
    for (const iata of iataCodes) {
      const ap = refLoader.getAirport(iata);
      if (ap && ap.lat != null) { out[iata] = { lat: ap.lat, lon: ap.lon }; continue; }
      const fb = AIRPORTS[iata];
      if (fb) out[iata] = { lat: fb.lat, lon: fb.lon };
    }
    return out;
  }
}

export default { FlightAgent };
