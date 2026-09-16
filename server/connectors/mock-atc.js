// mock-atc.js — Synthetic ATFM regulation / sector overload signals

const MOCK_SCENARIOS = {
  'R1:southIndia': [
    { name: 'Chennai ACC Flow Restriction', hazardType: 'flow_restriction', airports: ['MAA', 'BLR'], lat: 13, lon: 80.2, radiusKm: 300,
      summary: 'Reduced sector capacity in Chennai ACC following an equipment fault. Flow control affects southbound departures.',
      factorHints: { probability: 80, severity: 71, geographicReach: 60, expectedDuration: 55, timeToImpact: 90, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R1:northIndia': [
    { name: 'Delhi ATC Sector Capacity Reduction', hazardType: 'capacity_reduction', airports: ['DEL', 'BOM'], lat: 28.6, lon: 77.1, radiusKm: 300,
      summary: 'Delhi ATC reducing sector capacity due to staffing. Ground delays expected.',
      factorHints: { probability: 75, severity: 57, geographicReach: 50, expectedDuration: 50, timeToImpact: 85, escalationRate: 35, sourceCredibility: 85, predictionConfidence: 70 } },
  ],
  'R2:centralEurope': [
    { name: 'Frankfurt ATFM Regulation — Sector Overload', hazardType: 'atfm_regulation', airports: ['FRA'], lat: 50, lon: 8.5, radiusKm: 200,
      summary: 'EUROCONTROL NM activated ATFM regulation for Frankfurt airspace sector due to predicted overload. Delays 30-60 min.',
      factorHints: { probability: 85, severity: 74, geographicReach: 45, expectedDuration: 60, timeToImpact: 95, escalationRate: 50, sourceCredibility: 90, predictionConfidence: 80 } },
  ],
  'R2:westernEurope': [
    { name: 'Amsterdam Slot Constraints — Runway Maintenance', hazardType: 'capacity_reduction', airports: ['AMS'], lat: 52.3, lon: 4.8, radiusKm: 90,
      summary: 'AMS runway maintenance reducing slot availability. Departure rate reduced by 30%.',
      factorHints: { probability: 78, severity: 48, geographicReach: 35, expectedDuration: 55, timeToImpact: 70, escalationRate: 30, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R3:gulfStates': [
    { name: 'Dubai Airspace Congestion — Peak Hour', hazardType: 'sector_overload', airports: ['DXB'], lat: 25.3, lon: 55.4, radiusKm: 120,
      summary: 'DXB peak hour congestion. Flow control measures in effect for arrivals.',
      factorHints: { probability: 72, severity: 61, geographicReach: 40, expectedDuration: 45, timeToImpact: 80, escalationRate: 40, sourceCredibility: 80, predictionConfidence: 70 } },
  ],
  'R5:britishIsles': [
    { name: 'London TMA Flow Regulation', hazardType: 'flow_restriction', airports: ['LHR', 'LGW'], lat: 51.1, lon: -0.3, radiusKm: 150,
      summary: 'London TMA flow regulation due to weather. Holding delays 20-40 min.',
      factorHints: { probability: 76, severity: 58, geographicReach: 50, expectedDuration: 50, timeToImpact: 85, escalationRate: 45, sourceCredibility: 85, predictionConfidence: 72 } },
  ],
};

export function generateMockATC(region, subRegion, airports) {
  const key = `${region}:${subRegion}`;
  const scenarios = MOCK_SCENARIOS[key] || [];
  if (scenarios.length === 0 || Math.random() > 0.25) return [];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  return [{
    signalId: `atc-mock-${region}-${subRegion}-${Date.now()}`,
    detected: new Date().toISOString(),
    name: scenario.name,
    hazardType: scenario.hazardType,
    geo: { lat: scenario.lat, lon: scenario.lon, radiusKm: scenario.radiusKm },
    airports: scenario.airports,
    airspace: [],
    summary: scenario.summary,
    factorHints: scenario.factorHints,
    domains: ['Flight schedule', 'Aircraft rotations', 'Airport operations'],
    preliminaryEffects: [
      { ord: 1, title: `ATFM delays of 20-60 min at ${scenario.airports.join(', ')}`, lead: '0–1h' },
      { ord: 2, title: 'Connection risk at hub banks', lead: '1–3h' },
    ],
    evidence: [{
      source: 'Mock ATC Data (synthetic)',
      tier: 2,
      role: 'Simulated ATFM source',
      timestamp: new Date().toISOString(),
      excerpt: scenario.summary,
    }],
    rawRefs: [`mock-atc-${Date.now()}`],
  }];
}
