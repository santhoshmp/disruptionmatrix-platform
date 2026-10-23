// mock-flights.js — Mock flight schedule observations for development.
// Generates plausible per-airport schedules with injected delays,
// cancellations, and diversions so the pipeline works without API keys.

import { getAirportName } from '../data/airport-lookup.js';
import { AIRPORTS } from '../data/airport-lookup.js';

const AIRLINES = [
  { code: 'AI', name: 'Air India' }, { code: '6E', name: 'IndiGo' },
  { code: 'LH', name: 'Lufthansa' }, { code: 'BA', name: 'British Airways' },
  { code: 'EK', name: 'Emirates' }, { code: 'SQ', name: 'Singapore Airlines' },
  { code: 'QF', name: 'Qantas' }, { code: 'LA', name: 'LATAM' },
  { code: 'DL', name: 'Delta' }, { code: 'CX', name: 'Cathay Pacific' },
];

const DESTINATIONS = {
  R1: ['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'COK'],
  R2: ['FRA', 'AMS', 'CDG', 'LHR', 'MUC', 'VIE', 'ZRH'],
  R3: ['DXB', 'DOH', 'AUH', 'BAH', 'MCT'],
  R4: ['BKK', 'SIN', 'KUL', 'CGK'],
  R5: ['JFK', 'LHR', 'ORD', 'YYZ', 'SFO'],
  R6: ['HKG', 'NRT', 'ICN'],
  R7: ['JNB', 'NBO'],
  R8: ['SYD', 'MEL', 'BNE', 'PER', 'AKL'],
  R9: ['GRU', 'EZE', 'SCL', 'BOG', 'LIM'],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Generate mock flight observations for a region's airports.
// Returns observations in the same shape as real OpenSky/AviationStack data.
export function generateMockFlights(region, subRegion, airports) {
  if (!airports || airports.length === 0) return [];
  const dests = DESTINATIONS[region] || airports;
  const observations = [];
  const now = Date.now();

  for (const depIata of airports) {
    // 2-5 flights per airport per poll
    const count = randInt(2, 5);
    for (let i = 0; i < count; i++) {
      const airline = pick(AIRLINES);
      const arrIata = pick(dests.filter(d => d !== depIata)) || pick(dests);
      const flightNum = `${airline.code}${randInt(100, 9999)}`;
      const scheduledDep = now + randInt(-1800, 7200) * 1000; // ±30min to +2h
      const delayMin = pick([0, 0, 0, 5, 15, 25, 45, 90, 0, 0]);
      const cancelled = Math.random() < 0.06; // 6% cancellation rate
      const diverted = Math.random() < 0.02; // 2% diversion rate
      const status = cancelled ? 'cancelled'
        : diverted ? 'diverted'
        : delayMin > 60 ? 'delayed'
        : 'scheduled';

      // Build a meaningful event name for disruptive flights only
      const apName = getAirportName(depIata) || depIata;
      const eventName = cancelled
        ? `${depIata} Flight Cancellations`
        : diverted
        ? `${depIata} Flight Diversions`
        : delayMin > 45
        ? `${depIata} Mass Flight Delays`
        : null;

      // Geo from the departure airport's coordinates
      const apCoords = AIRPORTS[depIata] || { lat: 0, lon: 0 };

      observations.push({
        type: 'flight_schedule',
        name: eventName,
        flightNumber: flightNum,
        airline: airline.name,
        airlineCode: airline.code,
        departureAirport: depIata,
        arrivalAirport: arrIata,
        scheduledDeparture: new Date(scheduledDep).toISOString(),
        estimatedDeparture: new Date(scheduledDep + delayMin * 60000).toISOString(),
        delayMin: cancelled || diverted ? 0 : delayMin,
        status,
        cancelled,
        diverted,
        divertedTo: diverted ? pick(airports) : null,
        airports: [depIata],
        geo: { lat: apCoords.lat, lon: apCoords.lon, radiusKm: 50 },
        region,
        subRegion,
        summary: cancelled
          ? `${flightNum} ${depIata}→${arrIata} CANCELLED`
          : diverted
          ? `${flightNum} ${depIata}→${arrIata} DIVERTED to ${pick(airports)}`
          : delayMin > 0
          ? `${flightNum} ${depIata}→${arrIata} delayed ${delayMin}min`
          : `${flightNum} ${depIata}→${arrIata} on schedule`,
        hazardType: cancelled ? 'cancellation'
          : diverted ? 'diversion'
          : delayMin > 45 ? 'massdelay'
          : null,
        factorHints: {
          delayMin,
          cancellationRate: cancelled ? 1 : 0,
          affectedFlightCount: cancelled || delayMin > 45 ? 1 : 0,
        },
      });
    }
  }

  // Only return disruptive flights (cancellations, diversions, mass delays)
  return observations.filter(o => o.hazardType !== null);
}

export default { generateMockFlights };
