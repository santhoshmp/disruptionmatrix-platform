// mock-infrastructure.js — Synthetic airport infrastructure failure signals
import { getMockScenario } from '../data/reference-loader.js';

export const MOCK_SCENARIOS = {
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
  'R2:southernEurope': [
    { name: 'Rome Runway Lighting Fault', hazardType: 'runway_closure', airports: ['FCO'], lat: 41.8, lon: 12.3, radiusKm: 80,
      summary: 'FCO runway edge lighting failure. Night operations restricted to single runway.',
      factorHints: { probability: 78, severity: 52, geographicReach: 30, expectedDuration: 55, timeToImpact: 80, escalationRate: 35, sourceCredibility: 85, predictionConfidence: 72 } },
  ],
  'R3:gulfStates': [
    { name: 'Dubai Taxiway Resurfacing', hazardType: 'runway_closure', airports: ['DXB'], lat: 25.3, lon: 55.4, radiusKm: 90,
      summary: 'DXB taxiway resurfacing reduces active taxiway capacity. Departure rate reduced 15%.',
      factorHints: { probability: 82, severity: 45, geographicReach: 30, expectedDuration: 60, timeToImpact: 70, escalationRate: 20, sourceCredibility: 88, predictionConfidence: 78 } },
  ],
  'R4:mainlandSEA': [
    { name: 'Singapore Runway Overlay Project', hazardType: 'runway_closure', airports: ['SIN'], lat: 1.4, lon: 104, radiusKm: 80,
      summary: 'SIN runway overlay project reducing capacity. Single-runway operations during overnight hours.',
      factorHints: { probability: 85, severity: 50, geographicReach: 30, expectedDuration: 70, timeToImpact: 75, escalationRate: 25, sourceCredibility: 90, predictionConfidence: 82 } },
  ],
  'R5:britishIsles': [
    { name: 'Heathrow Stand Allocation System Outage', hazardType: 'system_outage', airports: ['LHR'], lat: 51.5, lon: -0.5, radiusKm: 80,
      summary: 'LHR stand allocation system outage. Manual allocation causing 20-30 min departure delays.',
      factorHints: { probability: 80, severity: 55, geographicReach: 30, expectedDuration: 45, timeToImpact: 85, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R5:northAmerica': [
    { name: 'JFK ILS Outage — Runway 4R', hazardType: 'ils_outage', airports: ['JFK'], lat: 40.6, lon: -73.8, radiusKm: 80,
      summary: 'JFK ILS out of service on Runway 4R. CAT II/III approaches unavailable.',
      factorHints: { probability: 82, severity: 58, geographicReach: 30, expectedDuration: 55, timeToImpact: 88, escalationRate: 45, sourceCredibility: 88, predictionConfidence: 80 } },
  ],
  'R6:eastAsia': [
    { name: 'Hong Kong Taxiway Crack Repair', hazardType: 'runway_closure', airports: ['HKG'], lat: 22.3, lon: 113.9, radiusKm: 80,
      summary: 'HKG taxiway crack repair reducing taxiway capacity. Departure delays of 15-25 min.',
      factorHints: { probability: 80, severity: 48, geographicReach: 30, expectedDuration: 50, timeToImpact: 75, escalationRate: 30, sourceCredibility: 85, predictionConfidence: 78 } },
  ],
  'R7:eastAfrica': [
    { name: 'Nairobi Fuel Supply Shortage', hazardType: 'fuel_supply', airports: ['NBO'], lat: -1.3, lon: 36.9, radiusKm: 80,
      summary: 'NBO into-plane fuel supplier reports supply shortage. Uplift rationing in effect.',
      factorHints: { probability: 75, severity: 60, geographicReach: 35, expectedDuration: 55, timeToImpact: 80, escalationRate: 65, sourceCredibility: 82, predictionConfidence: 70 } },
  ],
  'R7:southernAfrica': [
    { name: 'Johannesburg ILS Calibration', hazardType: 'ils_outage', airports: ['JNB'], lat: -26.1, lon: 28.2, radiusKm: 80,
      summary: 'JNB ILS calibration reducing CAT II/III availability. Instrument approaches restricted.',
      factorHints: { probability: 78, severity: 50, geographicReach: 30, expectedDuration: 50, timeToImpact: 78, escalationRate: 35, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R8:ausNZ': [
    { name: 'Sydney Runway Resurfacing', hazardType: 'runway_closure', airports: ['SYD'], lat: -33.9, lon: 151.2, radiusKm: 80,
      summary: 'SYD runway resurfacing reducing capacity. Single-runway operations during overnight hours.',
      factorHints: { probability: 82, severity: 48, geographicReach: 30, expectedDuration: 60, timeToImpact: 75, escalationRate: 25, sourceCredibility: 88, predictionConfidence: 80 } },
  ],
  'R9:southAmerica': [
    { name: 'Sao Paulo ILS Outage — Runway 10', hazardType: 'ils_outage', airports: ['GRU'], lat: -23.4, lon: -46.5, radiusKm: 80,
      summary: 'GRU ILS out of service on Runway 10. CAT II/III approaches unavailable.',
      factorHints: { probability: 80, severity: 55, geographicReach: 30, expectedDuration: 55, timeToImpact: 85, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 78 } },
  ],
};

export function generateMockInfrastructure(region, subRegion, airports) {
  const scenarios = getMockScenario(region, subRegion, 'infrastructure')
    || MOCK_SCENARIOS[`${region}:${subRegion}`] || [];
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
    dataSourceMode: 'mock',
  }];
}
