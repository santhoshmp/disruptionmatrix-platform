// mock-weather.js — Synthetic weather signals for fallback when real API is unavailable.
// Generates deterministic mock signals based on region + sub-region.
import { getMockScenario } from '../data/reference-loader.js';

export const MOCK_SCENARIOS = {
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
  'R2:southernEurope': [
    { name: 'Rome Thunderstorm Outbreak', hazardType: 'thunderstorm', airports: ['FCO', 'MAD'], lat: 41.8, lon: 12.3, radiusKm: 250,
      summary: 'Convective activity across southern Europe affecting FCO and MAD. Hail and wind shear on approach.',
      factorHints: { probability: 78, severity: 70, geographicReach: 60, expectedDuration: 60, timeToImpact: 85, escalationRate: 55, sourceCredibility: 82, predictionConfidence: 70 } },
  ],
  'R4:mainlandSEA': [
    { name: 'Singapore Sumatra Squall Line', hazardType: 'thunderstorm', airports: ['SIN', 'KUL'], lat: 1.4, lon: 104, radiusKm: 300,
      summary: 'Sumatra squall line tracking across the Strait of Malacca. Gust fronts and heavy precipitation at SIN and KUL.',
      factorHints: { probability: 82, severity: 75, geographicReach: 55, expectedDuration: 50, timeToImpact: 80, escalationRate: 65, sourceCredibility: 80, predictionConfidence: 72 } },
    { name: 'Jakarta Monsoon Flood — Airport Access', hazardType: 'monsoon', airports: ['CGK'], lat: -6.1, lon: 106.7, radiusKm: 150,
      summary: 'Seasonal monsoon flooding affecting road access to CGK. Reduced ground handling throughput.',
      factorHints: { probability: 85, severity: 60, geographicReach: 40, expectedDuration: 70, timeToImpact: 75, escalationRate: 50, sourceCredibility: 78, predictionConfidence: 68 } },
  ],
  'R5:britishIsles': [
    { name: 'London Heathrow Crosswind Event', hazardType: 'wind', airports: ['LHR', 'LGW'], lat: 51.5, lon: -0.5, radiusKm: 100,
      summary: 'Strong southwesterly crosswind at LHR and LGW. Single-runway operations at LHR, go-arounds likely.',
      factorHints: { probability: 80, severity: 62, geographicReach: 45, expectedDuration: 55, timeToImpact: 85, escalationRate: 60, sourceCredibility: 85, predictionConfidence: 75 } },
  ],
  'R5:northAmerica': [
    { name: 'JFK Winter Nor\'easter', hazardType: 'snow_ice', airports: ['JFK', 'ORD'], lat: 40.6, lon: -73.8, radiusKm: 400,
      summary: 'Coastal nor\'easter bringing heavy snow and low ceilings to JFK and ORD. De-icing delays expected.',
      factorHints: { probability: 88, severity: 80, geographicReach: 70, expectedDuration: 75, timeToImpact: 90, escalationRate: 75, sourceCredibility: 88, predictionConfidence: 82 } },
    { name: 'SFO Marine Layer Low Visibility', hazardType: 'low_visibility', airports: ['SFO'], lat: 37.6, lon: -122.4, radiusKm: 80,
      summary: 'Persistent marine layer at SFO reducing vis below CAT I minima. Arrival rate reduced 40%.',
      factorHints: { probability: 82, severity: 55, geographicReach: 30, expectedDuration: 65, timeToImpact: 70, escalationRate: 35, sourceCredibility: 85, predictionConfidence: 78 } },
  ],
  'R6:eastAsia': [
    { name: 'Hong Kong Typhoon Approach', hazardType: 'thunderstorm', airports: ['HKG', 'NRT'], lat: 22.3, lon: 113.9, radiusKm: 500,
      summary: 'Tropical system tracking toward the Pearl River Delta. HKG closure likely; NRT diversions from transpacific routes.',
      factorHints: { probability: 90, severity: 85, geographicReach: 75, expectedDuration: 80, timeToImpact: 95, escalationRate: 85, sourceCredibility: 90, predictionConfidence: 85 } },
    { name: 'Seoul Incheon Yellow Dust', hazardType: 'low_visibility', airports: ['ICN'], lat: 37.5, lon: 126.5, radiusKm: 200,
      summary: 'Yellow dust (Hwangsa) from Mongolian deserts reducing visibility at ICN. Runway changes and arrival delays.',
      factorHints: { probability: 75, severity: 50, geographicReach: 45, expectedDuration: 55, timeToImpact: 65, escalationRate: 40, sourceCredibility: 82, predictionConfidence: 70 } },
  ],
  'R7:eastAfrica': [
    { name: 'Nairobi Convective Activity', hazardType: 'thunderstorm', airports: ['NBO'], lat: -1.3, lon: 36.9, radiusKm: 150,
      summary: 'Convective cells over Nairobi FIR. NBO arrivals experiencing wind shear and holding delays.',
      factorHints: { probability: 72, severity: 58, geographicReach: 40, expectedDuration: 50, timeToImpact: 75, escalationRate: 45, sourceCredibility: 78, predictionConfidence: 65 } },
  ],
  'R7:southernAfrica': [
    { name: 'Johannesburg Highveld Thunderstorms', hazardType: 'thunderstorm', airports: ['JNB'], lat: -26.1, lon: 28.2, radiusKm: 200,
      summary: 'Highveld thunderstorm activity affecting JNB. Hail risk and wind shear on approach.',
      factorHints: { probability: 80, severity: 65, geographicReach: 45, expectedDuration: 55, timeToImpact: 80, escalationRate: 60, sourceCredibility: 80, predictionConfidence: 72 } },
  ],
  'R8:ausNZ': [
    { name: 'Sydney Southerly Change — Wind Shear', hazardType: 'wind', airports: ['SYD', 'MEL'], lat: -33.9, lon: 151.2, radiusKm: 250,
      summary: 'Strong southerly change tracking up the NSW coast. SYD and MEL crosswind conditions, go-arounds likely.',
      factorHints: { probability: 82, severity: 62, geographicReach: 50, expectedDuration: 50, timeToImpact: 85, escalationRate: 55, sourceCredibility: 85, predictionConfidence: 75 } },
    { name: 'Brisbane Convective Storm Outbreak', hazardType: 'thunderstorm', airports: ['BNE'], lat: -27.4, lon: 153.1, radiusKm: 200,
      summary: 'Severe thunderstorms at BNE. Hail and wind shear on approach. Ground stops likely during peak.',
      factorHints: { probability: 85, severity: 75, geographicReach: 45, expectedDuration: 55, timeToImpact: 90, escalationRate: 70, sourceCredibility: 82, predictionConfidence: 72 } },
  ],
  'R9:southAmerica': [
    { name: 'Sao Paulo Severe Thunderstorms', hazardType: 'thunderstorm', airports: ['GRU', 'EZE'], lat: -23.4, lon: -46.5, radiusKm: 300,
      summary: 'Convective activity across southeast Brazil and Argentina. GRU and EZE experiencing wind shear and delays.',
      factorHints: { probability: 80, severity: 70, geographicReach: 55, expectedDuration: 60, timeToImpact: 85, escalationRate: 60, sourceCredibility: 82, predictionConfidence: 70 } },
    { name: 'Santiago Andean Wind Shear', hazardType: 'wind', airports: ['SCL'], lat: -33.4, lon: -70.8, radiusKm: 150,
      summary: 'Strong Andean downdrafts at SCL. Crosswind conditions on approach, runway changes likely.',
      factorHints: { probability: 78, severity: 58, geographicReach: 35, expectedDuration: 50, timeToImpact: 80, escalationRate: 50, sourceCredibility: 80, predictionConfidence: 68 } },
  ],
};

export function generateMockWeather(region, subRegion, airports) {
  const scenarios = getMockScenario(region, subRegion, 'weather')
    || MOCK_SCENARIOS[`${region}:${subRegion}`] || [];

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
    dataSourceMode: 'mock',
  }];
}
