// mock-industrial.js — Synthetic strike / industrial action signals

const MOCK_SCENARIOS = {
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
};

export function generateMockIndustrial(region, subRegion, airports) {
  const key = `${region}:${subRegion}`;
  const scenarios = MOCK_SCENARIOS[key] || [];
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
  }];
}
