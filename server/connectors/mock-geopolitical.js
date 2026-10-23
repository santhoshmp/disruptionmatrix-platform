// mock-geopolitical.js — Synthetic airspace restriction / NOTAM signals
import { getMockScenario } from '../data/reference-loader.js';

export const MOCK_SCENARIOS = {
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
  'R2:southernEurope': [
    { name: 'Eastern Mediterranean Airspace Advisory', hazardType: 'security_notam', airports: ['IST', 'ATH'], lat: 39, lon: 22, radiusKm: 500,
      summary: 'Security NOTAM for eastern Mediterranean corridor. Rerouting recommended for affected sectors.',
      factorHints: { probability: 65, severity: 55, geographicReach: 60, expectedDuration: 55, timeToImpact: 70, escalationRate: 40, sourceCredibility: 85, predictionConfidence: 65 } },
  ],
  'R4:mainlandSEA': [
    { name: 'South China Sea Airspace Restriction', hazardType: 'airspace_restriction', airports: ['HKG', 'SIN'], lat: 15, lon: 115, radiusKm: 600,
      summary: 'Military airspace restriction over South China Sea. Rerouting required for SIN-HKG corridor.',
      factorHints: { probability: 72, severity: 60, geographicReach: 65, expectedDuration: 60, timeToImpact: 55, escalationRate: 45, sourceCredibility: 85, predictionConfidence: 70 } },
  ],
  'R5:britishIsles': [
    { name: 'North Atlantic Track System Disruption', hazardType: 'airspace_restriction', airports: ['LHR', 'SFO'], lat: 50, lon: -30, radiusKm: 800,
      summary: 'North Atlantic track system restructured due to volcanic ash advisory. Rerouting of transatlantic flights.',
      factorHints: { probability: 68, severity: 58, geographicReach: 70, expectedDuration: 65, timeToImpact: 60, escalationRate: 40, sourceCredibility: 88, predictionConfidence: 72 } },
  ],
  'R5:northAmerica': [
    { name: 'US-Mexico Border TFR', hazardType: 'airspace_restriction', airports: ['JFK', 'SFO'], lat: 32, lon: -100, radiusKm: 500,
      summary: 'Temporary flight restriction along US-Mexico border corridor. Rerouting for southbound flights.',
      factorHints: { probability: 62, severity: 48, geographicReach: 55, expectedDuration: 50, timeToImpact: 65, escalationRate: 35, sourceCredibility: 85, predictionConfidence: 68 } },
  ],
  'R6:eastAsia': [
    { name: 'Taiwan Strait Airspace Advisory', hazardType: 'security_notam', airports: ['HKG', 'NRT'], lat: 25, lon: 121, radiusKm: 400,
      summary: 'Airspace advisory for Taiwan Strait. Military exercise NOTAM in effect. Rerouting recommended.',
      factorHints: { probability: 70, severity: 55, geographicReach: 60, expectedDuration: 55, timeToImpact: 60, escalationRate: 50, sourceCredibility: 85, predictionConfidence: 72 } },
  ],
  'R7:eastAfrica': [
    { name: 'Horn of Africa Overflight Advisory', hazardType: 'airspace_restriction', airports: ['NBO'], lat: 5, lon: 45, radiusKm: 600,
      summary: 'Overflight advisory for Horn of Africa. Rerouting recommended for affected long-haul corridors.',
      factorHints: { probability: 65, severity: 50, geographicReach: 55, expectedDuration: 60, timeToImpact: 55, escalationRate: 35, sourceCredibility: 82, predictionConfidence: 65 } },
  ],
  'R7:southernAfrica': [
    { name: 'Southern African Airspace Restriction', hazardType: 'security_notam', airports: ['JNB'], lat: -25, lon: 25, radiusKm: 400,
      summary: 'Airspace restriction over southern African corridor. Rerouting for affected sectors.',
      factorHints: { probability: 60, severity: 45, geographicReach: 50, expectedDuration: 50, timeToImpact: 60, escalationRate: 30, sourceCredibility: 80, predictionConfidence: 62 } },
  ],
  'R8:ausNZ': [
    { name: 'Tasman Sea Airspace Advisory', hazardType: 'security_notam', airports: ['SYD', 'AKL'], lat: -40, lon: 160, radiusKm: 500,
      summary: 'Airspace advisory for Tasman Sea corridor. Military exercise NOTAM in effect.',
      factorHints: { probability: 62, severity: 48, geographicReach: 55, expectedDuration: 50, timeToImpact: 65, escalationRate: 35, sourceCredibility: 82, predictionConfidence: 65 } },
  ],
  'R9:southAmerica': [
    { name: 'Amazon Basin Airspace Restriction', hazardType: 'airspace_restriction', airports: ['GRU', 'LIM'], lat: -5, lon: -65, radiusKm: 600,
      summary: 'Airspace restriction over Amazon basin corridor. Rerouting required for affected sectors.',
      factorHints: { probability: 65, severity: 50, geographicReach: 60, expectedDuration: 55, timeToImpact: 55, escalationRate: 35, sourceCredibility: 82, predictionConfidence: 68 } },
  ],
};

export function generateMockGeopolitical(region, subRegion, airports) {
  const scenarios = getMockScenario(region, subRegion, 'geopolitical')
    || MOCK_SCENARIOS[`${region}:${subRegion}`] || [];
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
    dataSourceMode: 'mock',
  }];
}
