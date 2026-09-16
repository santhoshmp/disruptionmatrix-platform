// mock-regulatory.js — Synthetic regulatory directive signals

const MOCK_SCENARIOS = {
  'R1:northIndia': [
    { name: 'DGCA Winter-Schedule Fog Directive', hazardType: 'fog_directive', airports: ['DEL'], lat: 28.6, lon: 77.1, radiusKm: 100,
      summary: 'DGCA directive requiring CAT III crew/aircraft compliance on DEL routes during fog season.',
      factorHints: { probability: 70, severity: 50, geographicReach: 40, expectedDuration: 80, timeToImpact: 45, escalationRate: 30, sourceCredibility: 90, predictionConfidence: 75 } },
  ],
  'R2:centralEurope': [
    { name: 'EASA ETOPS Revision Notice', hazardType: 'etops_change', airports: ['VIE', 'MUC'], lat: 48, lon: 14, radiusKm: 300,
      summary: 'EASA published revised ETOPS diversion time requirements. Compliance deadline in 30 days.',
      factorHints: { probability: 65, severity: 45, geographicReach: 50, expectedDuration: 70, timeToImpact: 40, escalationRate: 25, sourceCredibility: 90, predictionConfidence: 80 } },
  ],
  'R3:gulfStates': [
    { name: 'GCAA Ops Spec Update', hazardType: 'ops_spec_change', airports: ['DXB'], lat: 25.3, lon: 55.4, radiusKm: 120,
      summary: 'GCAA updated operations specifications for Gulf corridor operators. New routing requirements.',
      factorHints: { probability: 60, severity: 40, geographicReach: 35, expectedDuration: 60, timeToImpact: 50, escalationRate: 20, sourceCredibility: 90, predictionConfidence: 75 } },
  ],
  'R5:britishIsles': [
    { name: 'UK CAA Night Quota Directive', hazardType: 'curfew_change', airports: ['LHR'], lat: 51.1, lon: -0.3, radiusKm: 100,
      summary: 'UK CAA revised night quota rules for LHR. Reduced slot availability 23:00-06:00.',
      factorHints: { probability: 68, severity: 42, geographicReach: 30, expectedDuration: 75, timeToImpact: 55, escalationRate: 25, sourceCredibility: 90, predictionConfidence: 78 } },
  ],
};

export function generateMockRegulatory(region, subRegion, airports) {
  const key = `${region}:${subRegion}`;
  const scenarios = MOCK_SCENARIOS[key] || [];
  if (scenarios.length === 0 || Math.random() > 0.1) return [];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return [{
    signalId: `reg-mock-${region}-${subRegion}-${Date.now()}`,
    detected: new Date().toISOString(),
    name: scenario.name,
    hazardType: scenario.hazardType,
    geo: { lat: scenario.lat, lon: scenario.lon, radiusKm: scenario.radiusKm },
    airports: scenario.airports,
    airspace: [],
    summary: scenario.summary,
    factorHints: scenario.factorHints,
    domains: ['Regulatory', 'Flight schedule', 'Crew'],
    preliminaryEffects: [
      { ord: 1, title: 'Compliance review required', lead: '24–48h' },
      { ord: 2, title: 'Fleet/crew requalification may be needed', lead: '1–2 weeks' },
    ],
    evidence: [{
      source: 'Mock Regulatory Data (synthetic)',
      tier: 2,
      role: 'Simulated regulatory source',
      timestamp: new Date().toISOString(),
      excerpt: scenario.summary,
    }],
    rawRefs: [`mock-reg-${Date.now()}`],
  }];
}
