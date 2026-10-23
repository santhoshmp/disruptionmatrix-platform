// mock-industrial.js — Synthetic strike / industrial action signals
import { getMockScenario } from '../data/reference-loader.js';

export const MOCK_SCENARIOS = {
  'R1:northIndia': [
    { name: 'Cabin Crew Go-Slow Notice — DEL Base', hazardType: 'go_slow', airports: ['DEL'], lat: 28.6, lon: 77.1, radiusKm: 80,
      summary: 'DEL-based cabin crew union issued a go-slow notice over a rostering grievance. No strike date named.',
      factorHints: { probability: 50, severity: 45, geographicReach: 35, expectedDuration: 60, timeToImpact: 40, escalationRate: 30, sourceCredibility: 75, predictionConfidence: 55 } },
  ],
  'R2:centralEurope': [
    { name: 'Vienna Ground Handler Industrial Action', hazardType: 'ground_handler_action', airports: ['VIE'], lat: 48.1, lon: 16.6, radiusKm: 100,
      summary: 'Vienna ground handler strike ballot threatens 48-hour action. Reduced handling capacity likely.',
      factorHints: { probability: 60, severity: 54, geographicReach: 40, expectedDuration: 70, timeToImpact: 55, escalationRate: 65, sourceCredibility: 80, predictionConfidence: 60 } },
  ],
  'R2:westernEurope': [
    { name: 'French ATC Strike Notice', hazardType: 'strike', airports: ['CDG'], lat: 49, lon: 2.5, radiusKm: 300,
      summary: 'French ATC strike ballot threatens French UIR airspace. Rerouting required for overflights.',
      factorHints: { probability: 65, severity: 70, geographicReach: 65, expectedDuration: 75, timeToImpact: 50, escalationRate: 70, sourceCredibility: 85, predictionConfidence: 65 } },
  ],
  'R2:southernEurope': [
    { name: 'Italian ATC Industrial Action', hazardType: 'strike', airports: ['FCO'], lat: 41.8, lon: 12.3, radiusKm: 200,
      summary: 'Italian ATC union announced 24-hour industrial action. FCO arrivals and departures affected.',
      factorHints: { probability: 62, severity: 60, geographicReach: 45, expectedDuration: 70, timeToImpact: 55, escalationRate: 65, sourceCredibility: 82, predictionConfidence: 62 } },
  ],
  'R3:gulfStates': [
    { name: 'Dubai Ground Handler Work Stoppage', hazardType: 'ground_handler_action', airports: ['DXB'], lat: 25.3, lon: 55.4, radiusKm: 100,
      summary: 'DXB ground handler work stoppage over contract dispute. Reduced handling capacity for 12 hours.',
      factorHints: { probability: 58, severity: 55, geographicReach: 40, expectedDuration: 60, timeToImpact: 45, escalationRate: 60, sourceCredibility: 80, predictionConfidence: 58 } },
  ],
  'R4:mainlandSEA': [
    { name: 'Bangkok Ground Handler Slowdown', hazardType: 'go_slow', airports: ['BKK'], lat: 13.7, lon: 100.8, radiusKm: 100,
      summary: 'BKK ground handler go-slow over wage dispute. Baggage handling delays of 45-60 min.',
      factorHints: { probability: 55, severity: 48, geographicReach: 35, expectedDuration: 55, timeToImpact: 40, escalationRate: 45, sourceCredibility: 78, predictionConfidence: 55 } },
  ],
  'R5:britishIsles': [
    { name: 'Heathrow Baggage Handler Strike', hazardType: 'strike', airports: ['LHR'], lat: 51.5, lon: -0.5, radiusKm: 80,
      summary: 'LHR baggage handler strike ballot. 48-hour action threatened if talks fail.',
      factorHints: { probability: 60, severity: 58, geographicReach: 35, expectedDuration: 65, timeToImpact: 50, escalationRate: 62, sourceCredibility: 82, predictionConfidence: 60 } },
  ],
  'R5:northAmerica': [
    { name: 'JFK TSA Work Stoppage', hazardType: 'go_slow', airports: ['JFK'], lat: 40.6, lon: -73.8, radiusKm: 80,
      summary: 'JFK TSA checkpoint go-slow during peak. Security wait times exceeding 90 min.',
      factorHints: { probability: 52, severity: 50, geographicReach: 30, expectedDuration: 50, timeToImpact: 35, escalationRate: 40, sourceCredibility: 80, predictionConfidence: 55 } },
  ],
  'R6:eastAsia': [
    { name: 'Narita Ground Handler Industrial Action', hazardType: 'ground_handler_action', airports: ['NRT'], lat: 35.8, lon: 140.4, radiusKm: 100,
      summary: 'NRT ground handler industrial action. Reduced handling capacity for 8 hours.',
      factorHints: { probability: 55, severity: 52, geographicReach: 35, expectedDuration: 55, timeToImpact: 45, escalationRate: 50, sourceCredibility: 82, predictionConfidence: 58 } },
  ],
  'R7:eastAfrica': [
    { name: 'Nairobi Ground Crew Work Stoppage', hazardType: 'go_slow', airports: ['NBO'], lat: -1.3, lon: 36.9, radiusKm: 80,
      summary: 'NBO ground crew go-slow over pay dispute. Handling delays of 30-45 min.',
      factorHints: { probability: 50, severity: 45, geographicReach: 30, expectedDuration: 50, timeToImpact: 35, escalationRate: 40, sourceCredibility: 75, predictionConfidence: 52 } },
  ],
  'R7:southernAfrica': [
    { name: 'Johannesburg Ground Handler Action', hazardType: 'ground_handler_action', airports: ['JNB'], lat: -26.1, lon: 28.2, radiusKm: 100,
      summary: 'JNB ground handler industrial action. Reduced capacity for 12 hours.',
      factorHints: { probability: 55, severity: 50, geographicReach: 35, expectedDuration: 55, timeToImpact: 40, escalationRate: 50, sourceCredibility: 78, predictionConfidence: 55 } },
  ],
  'R8:ausNZ': [
    { name: 'Sydney Ground Handler Work Stoppage', hazardType: 'ground_handler_action', airports: ['SYD'], lat: -33.9, lon: 151.2, radiusKm: 100,
      summary: 'SYD ground handler work stoppage over contract dispute. Reduced handling capacity for 8 hours.',
      factorHints: { probability: 58, severity: 52, geographicReach: 35, expectedDuration: 55, timeToImpact: 45, escalationRate: 55, sourceCredibility: 80, predictionConfidence: 58 } },
  ],
  'R9:southAmerica': [
    { name: 'Sao Paulo ATC Industrial Action', hazardType: 'strike', airports: ['GRU'], lat: -23.4, lon: -46.5, radiusKm: 200,
      summary: 'Brazilian ATC union announced 24-hour industrial action. GRU arrivals and departures affected.',
      factorHints: { probability: 62, severity: 58, geographicReach: 45, expectedDuration: 65, timeToImpact: 50, escalationRate: 60, sourceCredibility: 80, predictionConfidence: 60 } },
  ],
};

export function generateMockIndustrial(region, subRegion, airports) {
  const scenarios = getMockScenario(region, subRegion, 'industrial')
    || MOCK_SCENARIOS[`${region}:${subRegion}`] || [];
  if (scenarios.length === 0 || Math.random() > 0.15) return [];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return [{
    signalId: `ind-mock-${region}-${subRegion}-${Date.now()}`,
    detected: new Date().toISOString(),
    name: scenario.name,
    hazardType: scenario.hazardType,
    geo: { lat: scenario.lat, lon: scenario.lon, radiusKm: scenario.radiusKm },
    airports: scenario.airports,
    airspace: [],
    summary: scenario.summary,
    factorHints: scenario.factorHints,
    domains: ['Airport operations', 'Crew', 'Passengers'],
    preliminaryEffects: [
      { ord: 1, title: `Reduced handling capacity at ${scenario.airports.join(', ')}`, lead: '2–6h' },
      { ord: 2, title: 'Flight cancellations if action proceeds', lead: '12–24h' },
    ],
    evidence: [{
      source: 'Mock Industrial Action Data (synthetic)',
      tier: 2,
      role: 'Simulated labor source',
      timestamp: new Date().toISOString(),
      excerpt: scenario.summary,
    }],
    rawRefs: [`mock-ind-${Date.now()}`],
    dataSourceMode: 'mock',
  }];
}
