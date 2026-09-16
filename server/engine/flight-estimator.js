// flight-estimator.js — Generates flight schedules for airlines at affected airports
// Mock mode: uses actual flights from schedule-store
// Real mode: generates representative flights from airline hub structure + network share

import scheduleStore from '../data/schedule-store.js';
import realAirlineRegistry from '../data/real-airline-registry.js';
import airlineRegistry from '../data/airline-registry.js';
import store from '../store/event-store.js';
import { getImpactMode } from './impact-assessment.js';

// ── Generate flights for an airline at affected airports ─────────────
// Returns: [{ flt, origin, dest, airline, airlineCode, bank, type, date, scheduled, status, impact }]

export function getAirlineFlightsForEvent(eventId, airlineCode) {
  const event = store.getEventById(eventId);
  if (!event) return { flights: [], airline: null, airports: [] };

  const mode = getImpactMode();
  const affectedAirports = _getAffectedAirports(event);

  let flights = [];
  let airlineInfo = null;

  if (mode === 'mock') {
    const result = _getMockFlights(airlineCode, affectedAirports, event);
    flights = result.flights;
    airlineInfo = result.airlineInfo;
  } else {
    const result = _getRealFlights(airlineCode, affectedAirports, event);
    flights = result.flights;
    airlineInfo = result.airlineInfo;
  }

  // Tag each flight with impact status + date based on event
  flights = flights.map(f => _tagFlightImpact(f, event, affectedAirports));

  return {
    flights,
    airline: airlineInfo,
    airports: affectedAirports,
    mode,
  };
}

// ── List all impacted airlines for an event (for dropdown) ──────────

export function getImpactedAirlinesForEvent(eventId) {
  const event = store.getEventById(eventId);
  if (!event) return [];

  const ops = store.getOPS(eventId);
  if (!ops || !ops.airlines) return [];

  return ops.airlines.map(a => ({
    code: a.code,
    name: a.name,
    exposure: a.exposure,
    exposureScore: a.exposureScore,
    hub: a.hub,
  }));
}

// ── Get affected airports from event ────────────────────────────────

function _getAffectedAirports(event) {
  // Try _airports first, then geo, then parse from 'where'
  if (event._airports && event._airports.length > 0) return event._airports;
  if (event._geo?.airports && event._geo.airports.length > 0) return event._geo.airports;
  const geo = store.geoData.EVENT_GEO[event.id];
  if (geo?.airports && geo.airports.length > 0) return geo.airports;
  return [];
}

// ── Mock mode: use actual schedule-store flights ────────────────────

function _getMockFlights(airlineCode, affectedAirports, event) {
  // Find the airline key from the code (N7 → namma, EV → eva, IC → ica)
  const codeToKey = { N7: 'namma', EV: 'eva', IC: 'ica' };
  const airlineKey = codeToKey[airlineCode] || airlineCode.toLowerCase();

  const allFlights = scheduleStore.getAirlineFlights(airlineKey);
  const airline = airlineRegistry.getAirlineByCode(airlineCode);

  // Filter to flights that touch any affected airport
  const affected = affectedAirports.map(a => a.toUpperCase());
  const flights = allFlights.filter(f =>
    affected.includes(f.origin.toUpperCase()) || affected.includes(f.dest.toUpperCase())
  );

  // If no affected airports specified, return all flights
  const finalFlights = affected.length > 0 ? flights : allFlights;

  return {
    flights: finalFlights.map(f => ({
      flt: f.flt,
      origin: f.origin,
      dest: f.dest,
      airline: f.airline,
      airlineCode: f.airlineCode,
      bank: f.bank,
      type: f.type,
      tail: f.tail,
      pax: f.pax,
      cargo: f.cargo,
      scheduled: _estimateDepartureTime(f.bank),
      status: 'scheduled',
    })),
    airlineInfo: airline ? {
      name: airline.name,
      code: airline.code,
      hub: airline.hub,
      dailyDepartures: airline.dailyDepartures,
      fleet: airline.fleet,
    } : null,
  };
}

// ── Real mode: generate representative flights ──────────────────────

function _getRealFlights(airlineCode, affectedAirports, event) {
  const airline = realAirlineRegistry.getAirlineByCode(airlineCode);
  if (!airline) return { flights: [], airlineInfo: null };

  const flights = [];
  const affected = affectedAirports.map(a => a.toUpperCase());

  // Get the airline's hub airports
  const hubs = airline.hubs || [airline.hub];

  // Generate flights from hubs to affected airports and vice versa
  const routePairs = new Set();
  let flightNum = 100;

  // 1. Hub → Affected airport flights
  for (const hub of hubs) {
    for (const airport of affected) {
      if (hub.toUpperCase() === airport) continue;
      const key = `${hub}-${airport}`;
      if (routePairs.has(key)) continue;
      routePairs.add(key);
      routePairs.add(`${airport}-${hub}`);

      // Estimate frequency based on network share
      const share = realAirlineRegistry.getNetworkShare(airlineCode, airport) || 2;
      const frequency = Math.max(1, Math.min(4, Math.round((share / 100) * 6)));

      for (let i = 0; i < frequency; i++) {
        const bank = _getBankForIndex(i);
        const aircraft = _getAircraftForAirline(airlineCode);
        // Outbound: hub → airport
        flights.push({
          flt: `${airlineCode}-${flightNum++}`,
          origin: hub,
          dest: airport,
          airline: airline.name,
          airlineCode,
          bank: bank.name,
          type: aircraft,
          scheduled: bank.departure,
          status: 'scheduled',
        });
        // Return: airport → hub
        flights.push({
          flt: `${airlineCode}-${flightNum++}`,
          origin: airport,
          dest: hub,
          airline: airline.name,
          airlineCode,
          bank: bank.name,
          type: aircraft,
          scheduled: bank.arrival,
          status: 'scheduled',
        });
      }
    }
  }

  // 2. Affected airport → other major airports (if airline has share there)
  for (const airport of affected) {
    const share = realAirlineRegistry.getNetworkShare(airlineCode, airport) || 0;
    if (share < 3) continue;

    // Add some domestic connections from this airport
    const domesticDestinations = _getDomesticConnections(airport, airlineCode, hubs);
    for (const dest of domesticDestinations) {
      if (affected.includes(dest) || hubs.includes(dest)) continue;
      const key = `${airport}-${dest}`;
      if (routePairs.has(key)) continue;
      routePairs.add(key);

      flights.push({
        flt: `${airlineCode}-${300 + flights.length}`,
        origin: airport,
        dest,
        airline: airline.name,
        airlineCode,
        bank: 'Midday Bank',
        type: _getAircraftForAirline(airlineCode),
        scheduled: '12:30',
        status: 'scheduled',
      });
    }
  }

  // 3. Overflight flights (if event has airspace data)
  if (event._airspace && event._airspace.length > 0) {
    const overflightRoutes = _getOverflightRoutes(airlineCode, hubs, affected);
    for (const r of overflightRoutes) {
      flights.push({
        flt: `${airlineCode}-${400 + flights.length}`,
        origin: r.origin,
        dest: r.dest,
        airline: airline.name,
        airlineCode,
        bank: 'International',
        type: _getLongHaulAircraft(airlineCode),
        scheduled: r.departure,
        status: 'scheduled',
        overflight: true,
      });
    }
  }

  return {
    flights,
    airlineInfo: {
      name: airline.name,
      code: airline.code,
      hub: airline.hub,
      dailyDepartures: airline.dailyDepartures,
      fleet: ['A320neo', 'A321neo', 'B737 MAX', 'A350-900'],
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function _estimateDepartureTime(bank) {
  const bankTimes = {
    'Bank 1': '06:00', 'Bank 2': '11:30', 'Bank 3': '17:00', 'Bank 4': '22:00',
    'DEL node': '08:00', 'ATR regional': '14:00',
  };
  return bankTimes[bank] || '12:00';
}

function _getBankForIndex(i) {
  const banks = [
    { name: 'Morning Bank', departure: '06:30', arrival: '08:15' },
    { name: 'Midday Bank', departure: '12:30', arrival: '14:15' },
    { name: 'Evening Bank', departure: '18:00', arrival: '19:45' },
  ];
  return banks[i % 3];
}

function _getAircraftForAirline(code) {
  // Common narrow-body aircraft by airline
  const fleet = {
    '6E': 'A320neo', 'AI': 'A321neo', 'UK': 'A320neo', 'SG': 'B737 MAX',
    'QP': 'B737 MAX', 'IX': 'A320neo', 'LH': 'A320neo', 'EK': 'B777-300ER',
    'QR': 'A350-900', 'SQ': 'A350-900', 'TK': 'A321neo', 'AF': 'A320neo',
    'BA': 'A320neo', 'KL': 'B737-800', 'SK': 'A320neo', 'DY': 'B737 MAX',
  };
  return fleet[code] || 'A320neo';
}

function _getLongHaulAircraft(code) {
  const widebody = {
    '6E': 'A321neo', 'AI': 'B787-8', 'UK': 'B787-9', 'LH': 'A350-900',
    'EK': 'B777-300ER', 'QR': 'A350-1000', 'SQ': 'A350-900', 'TK': 'B787-9',
    'AF': 'A350-900', 'BA': 'B787-9', 'KL': 'B777-300ER',
  };
  return widebody[code] || 'A350-900';
}

function _getDomesticConnections(airport, airlineCode, hubs) {
  // Major domestic connections from key airports
  const connections = {
    'DEL': ['BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'AMD'],
    'BOM': ['DEL', 'BLR', 'MAA', 'GOI', 'HYD'],
    'BLR': ['DEL', 'BOM', 'MAA', 'HYD', 'COK'],
    'MAA': ['DEL', 'BOM', 'BLR', 'HYD'],
    'AMS': ['CDG', 'FRA', 'MUC', 'LHR', 'ZRH'],
    'CDG': ['AMS', 'FRA', 'LHR', 'FCO'],
    'FRA': ['AMS', 'CDG', 'LHR', 'MUC', 'VIE'],
    'LHR': ['AMS', 'CDG', 'FRA', 'DUB', 'CPH'],
    'DXB': ['DOH', 'BAH', 'DEL', 'BOM', 'BLR'],
    'DOH': ['DXB', 'BAH', 'DEL', 'BOM'],
    'SIN': ['KUL', 'BKK', 'DEL', 'BLR'],
  };
  return connections[airport] || [];
}

function _getOverflightRoutes(airlineCode, hubs, affected) {
  // Generate some routes that cross the affected airspace without landing there
  const routes = [];
  const hub = hubs[0];
  // Hub to a non-affected major airport that crosses the affected region
  const longHaulDest = {
    'DEL': ['LHR', 'CDG', 'FRA', 'JFK'],
    'BOM': ['LHR', 'SIN', 'DXB'],
    'BLR': ['SIN', 'BKK', 'DXB'],
    'DXB': ['LHR', 'JFK', 'SIN'],
    'DOH': ['LHR', 'JFK', 'BKK'],
    'AMS': ['JFK', 'DXB', 'SIN'],
    'FRA': ['JFK', 'DXB', 'SIN'],
  };
  const dests = longHaulDest[hub] || ['LHR', 'JFK'];
  for (const dest of dests.slice(0, 2)) {
    if (affected.includes(dest)) continue;
    routes.push({
      origin: hub,
      dest,
      departure: '09:30',
    });
  }
  return routes;
}

function _tagFlightImpact(flight, event, affectedAirports) {
  const affected = affectedAirports.map(a => a.toUpperCase());
  const isAtAffected = affected.includes(flight.origin.toUpperCase()) || affected.includes(flight.dest.toUpperCase());
  const isOverflight = flight.overflight || (!isAtAffected && affected.length > 0);

  let status = 'scheduled';
  let impact = 'none';

  if (isAtAffected) {
    const cat = event.cat;
    if (cat === 'Weather') {
      impact = event.score >= 70 ? 'delayed' : 'monitoring';
      if (event.score >= 80) status = 'delayed';
    } else if (cat === 'ATC / Airspace') {
      impact = 'restricted';
      status = event.score >= 75 ? 'cancelled' : 'delayed';
    } else if (cat === 'Industrial action') {
      impact = 'disrupted';
      status = event.score >= 70 ? 'cancelled' : 'delayed';
    } else if (cat === 'Geopolitical') {
      impact = 'restricted';
      status = event.score >= 75 ? 'cancelled' : 'rerouted';
    } else if (cat === 'Infrastructure') {
      impact = 'disrupted';
      status = event.score >= 70 ? 'cancelled' : 'delayed';
    } else if (cat === 'Regulatory') {
      impact = 'monitoring';
      status = 'monitoring';
    } else {
      impact = 'affected';
      status = event.score >= 75 ? 'cancelled' : 'delayed';
    }
  } else if (isOverflight) {
    impact = 'overflight_risk';
    status = event.cat === 'Geopolitical' ? 'rerouted' : 'monitoring';
  }

  // Compute flight date based on event prediction timeline
  const flightDate = _computeFlightDate(event, flight);

  return { ...flight, date: flightDate.dateStr, dayOffset: flightDate.dayOffset, status, impact };
}

// ── Compute flight date based on the threat event date ──────────────
// Uses event.detected + event.ttiMin to determine the impact window.
// If the event date is in the past (e.g. seeded demo data), clamps to today
// so we never show past flights on a real-time board.

function _computeFlightDate(event, flight) {
  // Parse the event's detected timestamp + time-to-impact
  const detected = _parseEventDate(event.detected);
  const ttiMin = event.ttiMin || 600; // default 10h
  const impactStart = new Date(detected.getTime() + ttiMin * 60 * 1000);

  // Clamp to today — never show past dates on a real-time board
  const now = new Date();
  now.setHours(0, 0, 0, 0); // midnight today
  const startDate = impactStart < now ? now : impactStart;

  // Spread flights across 3 days starting from the impact start
  const flightIdx = parseInt((flight.flt || '').split('-')[1]) || 0;
  const dayOffset = flightIdx % 3; // 0, 1, or 2 days after start

  const flightDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

  // Format as DD MMM YYYY
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateStr = `${String(flightDate.getDate()).padStart(2, '0')} ${months[flightDate.getMonth()]} ${flightDate.getFullYear()}`;

  return { dateStr, dayOffset };
}

function _parseEventDate(detected) {
  if (!detected) return new Date();
  // Try "11 FEB 06:00Z" format first (no year — assume current year)
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const m = detected.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})?/i);
  if (m) {
    const day = parseInt(m[1]);
    const month = months[m[2].toUpperCase()] || 0;
    const year = m[3] ? parseInt(m[3]) : new Date().getFullYear();
    return new Date(year, month, day);
  }
  // Try ISO format (e.g. "2026-02-11T06:00:00Z")
  const iso = new Date(detected);
  if (!isNaN(iso.getTime())) return iso;
  return new Date();
}

export default { getAirlineFlightsForEvent };
