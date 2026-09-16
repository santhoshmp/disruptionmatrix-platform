// mock-infrastructure.js — Synthetic airport infrastructure failure signals

const MOCK_SCENARIOS = {
  'R1:southIndia': [
    { name: 'BLR Fuel Depot Supply Disruption', hazardType: 'fuel_supply', airports: ['BLR'], lat: 13.2, lon: 77.7, radiusKm: 50,
      summary: 'Primary into-plane fuel supplier at BLR reports a pipeline valve fault reducing uplift rate by ~40%.',
      factorHints: { probability: 75, severity: 68, geographicReach: 35, expectedDuration: 60, timeToImpact: 80, escalationRate: 70, sourceCredibility: 85, predictionConfidence: 72 } },
  ],
  'R2:centralEurope': [
    { name: 'Vienna ILS Outage — Runway 16', hazardType: 'ils_outage', airports: ['VIE'], lat: 48.1, lon: 16.6, radiusKm: 80,
      summary: 'ILS out of service on VIE Runway 16. CAT II/III approaches unavailable.',
      factorHints: { probability: 80, severity: 55, geographicReach: 30, expectedDuration: 50, timeToImpact: 90, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R2:westernEurope': [
    { name: 'Amsterdam Runway Maintenance', hazardType: 'runway_closure', airports: ['AMS'], lat: 52.3, lon: 4.8, radiusKm: 90,
      summary: 'AMS Runway 18R/36L closed for scheduled maintenance. Capacity reduced to 60%.',
      factorHints: { probability: 85, severity: 48, geographicReach: 30, expectedDuration: 65, timeToImpact: 75, escalationRate: 25, sourceCredibility: 90, predictionConfidence: 80 } },
  ],
};

export function generateMockInfrastructure(region, subRegion, airports) {
  const key = `${region}:${subRegion}`;
  const scenarios = MOCK_SCENARIOS[key] || [];
  if (scenarios.length === 0 || Math.random() > 0.15) return [];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return [{
    signalId: `inf-mock-${region}-${subRegion}-${Date.now()}`,
    detected: new Date().toISOString(),
    name: scenario.name,
    hazardType: scenario.hazardType,
    geo: { lat: scenario.lat, lon: scenario.lon, radiusKm: scenario.radiusKm },
    airports: scenario.airports,
    airspace: [],
    summary: scenario.summary,
    factorHints: scenario.factorHints,
    domains: ['Airport operations', 'Flight schedule', 'Maintenance'],
    preliminaryEffects: [
      { ord: 1, title: `Reduced capacity at ${scenario.airports.join(', ')}`, lead: '0–2h' },
      { ord: 2, title: 'Weight restrictions or tech stops possible', lead: '2–6h' },
    ],
    evidence: [{
      source: 'Mock Infrastructure Data (synthetic)',
      tier: 2,
      role: 'Simulated airport operator source',
      timestamp: new Date().toISOString(),
      excerpt: scenario.summary,
    }],
    rawRefs: [`mock-inf-${Date.now()}`],
  }];
}
