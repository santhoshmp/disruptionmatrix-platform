import { getAirportName } from '../data/airport-lookup.js';
import { AIRPORTS } from '../data/airport-lookup.js';
// Generates plausible passenger/crew disruption reports referencing
// real airport codes so the pipeline can correlate them with events.

const SAMPLE_REPORTS = [
  { kw: 'cancelled', hazard: 'cancellation', tmpl: 'My flight from {dep} to {arr} just got cancelled. Anyone know why?' },
  { kw: 'delayed', hazard: 'massdelay', tmpl: 'Stuck at {dep} — {delay}min delay on {flight}. Weather looking rough.' },
  { kw: 'diverted', hazard: 'diversion', tmpl: 'We just got diverted from {arr} to {alt}. Turbulence was insane.' },
  { kw: 'ground stop', hazard: 'groundstop', tmpl: 'Ground stop at {dep} right now. ATC says expect 2+ hour delays.' },
  { kw: 'stranded', hazard: 'massdelay', tmpl: 'Stranded at {dep} overnight. Hotel vouchers running out. {airline} not helping.' },
  { kw: 'closure', hazard: 'massdelay', tmpl: 'Heard {dep} runway is closed. Diversions to {alt} and {alt2}.' },
  { kw: 'notam', hazard: 'socialreport', tmpl: 'NOTAM just dropped for {dep}. ILS outage — expect delays all day.' },
  { kw: 'mechanical', hazard: 'socialreport', tmpl: '{airline} {flight} at {dep} — mechanical issue. Back to gate.' },
];

const AIRLINES = ['Air India', 'Lufthansa', 'Emirates', 'Singapore Airlines', 'Delta', 'Qantas', 'LATAM', 'Cathay Pacific'];
const SUBS = ['r/aviation', 'r/flightdelay', 'r/airline', 'r/ATC'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function generateMockSocial(region, subRegion, airports) {
  if (!airports || airports.length < 2) return [];
  const observations = [];
  const count = randInt(1, 3);
  for (let i = 0; i < count; i++) {
    const report = pick(SAMPLE_REPORTS);
    const dep = pick(airports);
    const arr = pick(airports.filter(a => a !== dep)) || pick(airports);
    const alt = pick(airports.filter(a => a !== arr)) || dep;
    const alt2 = pick(airports) || dep;
    const airline = pick(AIRLINES);
    const flight = `${airline.slice(0, 2).toUpperCase()}${randInt(100, 9999)}`;
    const delay = randInt(30, 180);
    const text = report.tmpl
      .replace('{dep}', dep)
      .replace('{arr}', arr)
      .replace('{alt}', alt)
      .replace('{alt2}', alt2)
      .replace('{airline}', airline)
      .replace('{flight}', flight)
      .replace('{delay}', delay);

    const apCoords = AIRPORTS[dep] || { lat: 0, lon: 0 };

    observations.push({
      type: 'social_report',
      name: `${dep} ${report.hazard === 'cancellation' ? 'Cancellation' : report.hazard === 'diversion' ? 'Diversion' : 'Disruption'} Reports`,
      subreddit: pick(SUBS),
      title: text,
      author: `u_${pick(['traveler', 'pilot_life', 'atc_guy', 'frequent_flyer', 'crew_life'])}_${randInt(10, 99)}`,
      createdUtc: new Date(Date.now() - randInt(60, 3600) * 1000).toISOString(),
      score: randInt(5, 500),
      numComments: randInt(2, 80),
      url: `https://reddit.com/r/${pick(['aviation', 'flightdelay', 'airline'])}/comments/mock_${randInt(10000, 99999)}`,
      matchedKeywords: [report.kw],
      airportCodes: [dep, arr, alt].filter(Boolean),
      relevanceScore: randInt(2, 8),
      summary: text,
      hazardType: report.hazard,
      corroborateOnly: true,
      airports: [dep, arr].filter(Boolean),
      geo: { lat: apCoords.lat, lon: apCoords.lon, radiusKm: 50 },
      region,
      subRegion,
      evidence: [{
        source: 'Reddit (mock)',
        tier: 2,
        role: 'Corroborates',
        excerpt: text,
        url: `https://reddit.com/r/aviation/comments/mock_${randInt(10000, 99999)}`,
        timestamp: new Date().toISOString(),
      }],
    });
  }
  return observations;
}

export default { generateMockSocial };
