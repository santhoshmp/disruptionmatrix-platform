// mock-weather.js — Synthetic weather signals for fallback when real API is unavailable.
// Generates deterministic mock signals based on region + sub-region.

const MOCK_SCENARIOS = {
  'R1:southIndia': [
    { name: 'Bay of Bengal Monsoon Depression', hazardType: 'monsoon', airports: ['BLR', 'MAA'], lat: 12, lon: 80, radiusKm: 400,
      summary: 'Deepening low-pressure system tracking toward the southeast coast. Heavy rain and low-level wind shear forecast.',
      factorHints: { probability: 89, severity: 84, geographicReach: 79, expectedDuration: 74, timeToImpact: 90, escalationRate: 75, sourceCredibility: 82, predictionConfidence: 78 } },
  ],
  'R1:northIndia': [
    { name: 'Delhi Winter Fog — CAT III Demand Surge', hazardType: 'fog', airports: ['DEL'], lat: 28.6, lon: 77.1, radiusKm: 100,
      summary: 'Dense fog advisory for DEL with visibility below 200m expected overnight. CAT IIIB approach capability required.',
      factorHints: { probability: 82, severity: 76, geographicReach: 50, expectedDuration: 70, timeToImpact: 85, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R1:westIndia': [
    { name: 'Mumbai Monsoon Thunderstorms', hazardType: 'thunderstorm', airports: ['BOM'], lat: 19.1, lon: 72.9, radiusKm: 250,
      summary: 'Severe monsoon thunderstorms at Mumbai. Heavy rainfall and wind shear on approach.',
      factorHints: { probability: 85, severity: 79, geographicReach: 55, expectedDuration: 65, timeToImpact: 92, escalationRate: 78, sourceCredibility: 80, predictionConfidence: 72 } },
  ],
  'R2:centralEurope': [
    { name: 'Central European Convective Weather', hazardType: 'thunderstorm', airports: ['FRA', 'MUC', 'VIE'], lat: 49, lon: 10, radiusKm: 350,
      summary: 'Severe CB activity forecast across the FRA-MUC-VIE corridor. Embedded thunderstorms, hail, and wind shear.',
      factorHints: { probability: 88, severity: 82, geographicReach: 72, expectedDuration: 68, timeToImpact: 95, escalationRate: 80, sourceCredibility: 85, predictionConfidence: 78 } },
  ],
  'R2:westernEurope': [
    { name: 'Frankfurt Low Visibility Procedures', hazardType: 'low_visibility', airports: ['FRA', 'AMS'], lat: 50, lon: 8.5, radiusKm: 200,
      summary: 'Low visibility procedures in effect at FRA and AMS. Arrival rate reduced.',
      factorHints: { probability: 75, severity: 65, geographicReach: 50, expectedDuration: 60, timeToImpact: 80, escalationRate: 45, sourceCredibility: 85, predictionConfidence: 70 } },
  ],
  'R2:northernEurope': [
    { name: 'North Sea Winter Storm', hazardType: 'storm', airports: ['AMS', 'CPH', 'OSL'], lat: 55, lon: 5, radiusKm: 400,
      summary: 'Rapidly deepening low crossing the North Sea with surface winds 45-55 kt, gusts to 75 kt.',
      factorHints: { probability: 94, severity: 88, geographicReach: 79, expectedDuration: 72, timeToImpact: 76, escalationRate: 85, sourceCredibility: 88, predictionConfidence: 80 } },
  ],
  'R3:gulfStates': [
    { name: 'Dubai Sandstorm Advisory', hazardType: 'low_visibility', airports: ['DXB'], lat: 25.3, lon: 55.4, radiusKm: 120,
      summary: 'Blowing sand reducing visibility at DXB. Departure rate reduced during peak hours.',
      factorHints: { probability: 70, severity: 60, geographicReach: 40, expectedDuration: 55, timeToImpact: 75, escalationRate: 50, sourceCredibility: 80, predictionConfidence: 65 } },
  ],
};

export function generateMockWeather(region, subRegion, airports) {
  const key = `${region}:${subRegion}`;
  const scenarios = MOCK_SCENARIOS[key] || [];

  // Only emit a mock signal ~30% of the time (so the feed isn't flooded)
  if (scenarios.length === 0 || Math.random() > 0.3) return [];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return [{
    signalId: `wx-mock-${region}-${subRegion}-${Date.now()}`,
    detected: new Date().toISOString(),
    name: scenario.name,
    hazardType: scenario.hazardType,
    geo: { lat: scenario.lat, lon: scenario.lon, radiusKm: scenario.radiusKm },
    airports: scenario.airports,
    airspace: [],
    summary: scenario.summary,
    factorHints: scenario.factorHints,
    domains: ['Airport operations', 'Flight schedule', 'Aircraft rotations'],
    preliminaryEffects: [
      { ord: 1, title: `Reduced arrival rate at ${scenario.airports.join(', ')}`, lead: '0–2h' },
      { ord: 2, title: 'Potential ground stops during peak', lead: '2–4h' },
    ],
    evidence: [{
      source: 'Mock Weather Data (synthetic)',
      tier: 2,
      role: 'Simulated meteorological source',
      timestamp: new Date().toISOString(),
      excerpt: scenario.summary,
    }],
    rawRefs: [`mock-wx-${Date.now()}`],
  }];
}
