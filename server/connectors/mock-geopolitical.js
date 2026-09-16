// mock-geopolitical.js — Synthetic airspace restriction / NOTAM signals

const MOCK_SCENARIOS = {
  'R3:overflight': [
    { name: 'Gulf Airspace Overflight Restriction', hazardType: 'airspace_restriction', airports: ['DXB', 'LHR'], lat: 27, lon: 52, radiusKm: 500,
      summary: 'Reserved airspace block over the Gulf corridor narrows the standard BLR-LHR overflight routing.',
      factorHints: { probability: 70, severity: 62, geographicReach: 55, expectedDuration: 65, timeToImpact: 60, escalationRate: 35, sourceCredibility: 85, predictionConfidence: 70 } },
  ],
  'R2:westernEurope': [
    { name: 'Eastern European Airspace Advisory', hazardType: 'security_notam', airports: ['FRA', 'VIE'], lat: 48, lon: 20, radiusKm: 600,
      summary: 'Security NOTAM issued for eastern European corridor. Rerouting recommended for affected sectors.',
      factorHints: { probability: 65, severity: 55, geographicReach: 60, expectedDuration: 55, timeToImpact: 70, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 65 } },
  ],
  'R1:southIndia': [
    { name: 'Bay of Bengal Airspace Advisory', hazardType: 'security_notam', airports: ['MAA', 'CCU'], lat: 15, lon: 85, radiusKm: 400,
      summary: 'Airspace advisory for Bay of Bengal maritime corridor. Military exercise NOTAM in effect.',
      factorHints: { probability: 60, severity: 50, geographicReach: 45, expectedDuration: 50, timeToImpact: 65, escalationRate: 30, sourceCredibility: 80, predictionConfidence: 60 } },
  ],
};

export function generateMockGeopolitical(region, subRegion, airports) {
  const key = `${region}:${subRegion}`;
  const scenarios = MOCK_SCENARIOS[key] || [];
  if (scenarios.length === 0 || Math.random() > 0.15) return [];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return [{
    signalId: `geo-mock-${region}-${subRegion}-${Date.now()}`,
    detected: new Date().toISOString(),
    name: scenario.name,
    hazardType: scenario.hazardType,
    geo: { lat: scenario.lat, lon: scenario.lon, radiusKm: scenario.radiusKm },
    airports: scenario.airports,
    airspace: ['Gulf corridor', 'Iraqi/Turkish UIR'],
    summary: scenario.summary,
    factorHints: scenario.factorHints,
    domains: ['Flight schedule', 'Aircraft rotations', 'Regulatory'],
    preliminaryEffects: [
      { ord: 1, title: 'Rerouting required for affected sectors', lead: '0–2h' },
      { ord: 2, title: 'Extended block time, crew duty implications', lead: '2–6h' },
    ],
    evidence: [{
      source: 'Mock Geopolitical Data (synthetic)',
      tier: 2,
      role: 'Simulated NOTAM source',
      timestamp: new Date().toISOString(),
      excerpt: scenario.summary,
    }],
    rawRefs: [`mock-geo-${Date.now()}`],
  }];
}
