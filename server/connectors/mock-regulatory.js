// mock-regulatory.js — Synthetic regulatory directive signals
import { getMockScenario } from '../data/reference-loader.js';

export const MOCK_SCENARIOS = {
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
  'R2:southernEurope': [
    { name: 'ENAV Slot Compliance Directive', hazardType: 'ops_spec_change', airports: ['FCO'], lat: 41.8, lon: 12.3, radiusKm: 150,
      summary: 'ENAV issued new slot compliance directive for Italian airports. Stricter adherence required.',
      factorHints: { probability: 62, severity: 38, geographicReach: 40, expectedDuration: 65, timeToImpact: 45, escalationRate: 20, sourceCredibility: 88, predictionConfidence: 75 } },
  ],
  'R4:mainlandSEA': [
    { name: 'CAAS Noise Abatement Revision', hazardType: 'curfew_change', airports: ['SIN'], lat: 1.4, lon: 104, radiusKm: 100,
      summary: 'CAAS revised noise abatement procedures for SIN. Reduced operations 02:00-06:00 local.',
      factorHints: { probability: 65, severity: 40, geographicReach: 35, expectedDuration: 70, timeToImpact: 50, escalationRate: 22, sourceCredibility: 88, predictionConfidence: 76 } },
  ],
  'R5:northAmerica': [
    { name: 'FAA Slot Rule Revision — JFK', hazardType: 'ops_spec_change', airports: ['JFK', 'ORD'], lat: 40.6, lon: -73.8, radiusKm: 300,
      summary: 'FAA revised slot allocation rules for JFK and ORD. New compliance deadline in 60 days.',
      factorHints: { probability: 70, severity: 45, geographicReach: 50, expectedDuration: 75, timeToImpact: 40, escalationRate: 28, sourceCredibility: 92, predictionConfidence: 82 } },
  ],
  'R6:eastAsia': [
    { name: 'JCAB ETOPS Revision Notice', hazardType: 'etops_change', airports: ['NRT', 'ICN'], lat: 36, lon: 140, radiusKm: 400,
      summary: 'JCAB published revised ETOPS diversion time requirements for Pacific routes. Compliance deadline 45 days.',
      factorHints: { probability: 65, severity: 42, geographicReach: 55, expectedDuration: 70, timeToImpact: 40, escalationRate: 25, sourceCredibility: 90, predictionConfidence: 80 } },
  ],
  'R7:eastAfrica': [
    { name: 'KCAA Ops Spec Update', hazardType: 'ops_spec_change', airports: ['NBO'], lat: -1.3, lon: 36.9, radiusKm: 120,
      summary: 'KCAA updated operations specifications for East African corridor operators. New routing requirements.',
      factorHints: { probability: 58, severity: 38, geographicReach: 35, expectedDuration: 60, timeToImpact: 45, escalationRate: 20, sourceCredibility: 88, predictionConfidence: 72 } },
  ],
  'R7:southernAfrica': [
    { name: 'SACAA ETOPS Compliance Notice', hazardType: 'etops_change', airports: ['JNB'], lat: -26.1, lon: 28.2, radiusKm: 150,
      summary: 'SACAA issued ETOPS compliance notice for southern African operators. Documentation deadline 30 days.',
      factorHints: { probability: 60, severity: 40, geographicReach: 40, expectedDuration: 65, timeToImpact: 42, escalationRate: 22, sourceCredibility: 88, predictionConfidence: 75 } },
  ],
  'R8:ausNZ': [
    { name: 'CASA Night Curfew Revision', hazardType: 'curfew_change', airports: ['SYD'], lat: -33.9, lon: 151.2, radiusKm: 100,
      summary: 'CASA revised night curfew rules for SYD. Reduced slot availability 23:00-06:00.',
      factorHints: { probability: 65, severity: 42, geographicReach: 35, expectedDuration: 70, timeToImpact: 50, escalationRate: 25, sourceCredibility: 88, predictionConfidence: 76 } },
  ],
  'R9:southAmerica': [
    { name: 'ANAC Brazil Slot Compliance Directive', hazardType: 'ops_spec_change', airports: ['GRU', 'EZE'], lat: -23.4, lon: -46.5, radiusKm: 300,
      summary: 'ANAC issued new slot compliance directive for Brazilian airports. Stricter adherence required.',
      factorHints: { probability: 62, severity: 38, geographicReach: 45, expectedDuration: 65, timeToImpact: 45, escalationRate: 20, sourceCredibility: 88, predictionConfidence: 75 } },
  ],
};

export function generateMockRegulatory(region, subRegion, airports) {
  const scenarios = getMockScenario(region, subRegion, 'regulatory')
    || MOCK_SCENARIOS[`${region}:${subRegion}`] || [];
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
    dataSourceMode: 'mock',
  }];
}
