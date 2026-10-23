// seed-mock-scenarios.js — Populates ref_mock_scenarios from connector MOCK_SCENARIOS exports.
// Run once: node server/db/seed-mock-scenarios.js
// Safe to re-run: uses ON CONFLICT DO NOTHING.

import pool from './pool.js';

const CONNECTORS = [
  { agentType: 'weather',        file: '../connectors/mock-weather.js' },
  { agentType: 'atc',            file: '../connectors/mock-atc.js' },
  { agentType: 'geopolitical',   file: '../connectors/mock-geopolitical.js' },
  { agentType: 'industrial',     file: '../connectors/mock-industrial.js' },
  { agentType: 'infrastructure', file: '../connectors/mock-infrastructure.js' },
  { agentType: 'regulatory',     file: '../connectors/mock-regulatory.js' },
];

async function seed() {
  let total = 0;
  for (const { agentType, file } of CONNECTORS) {
    const mod = await import(file);
    const scenarios = mod.MOCK_SCENARIOS || {};
    let count = 0;
    let sort = 0;
    for (const [key, arr] of Object.entries(scenarios)) {
      const [region, subRegion] = key.split(':');
      for (const s of arr) {
        sort++;
        await pool.query(
          `INSERT INTO ref_mock_scenarios
             (agent_type, region, sub_region, name, hazard_type, airports, lat, lon, radius_km, summary, factor_hints, active, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (agent_type, region, sub_region, name) DO UPDATE SET
             hazard_type = EXCLUDED.hazard_type,
             airports    = EXCLUDED.airports,
             lat         = EXCLUDED.lat,
             lon         = EXCLUDED.lon,
             radius_km   = EXCLUDED.radius_km,
             summary     = EXCLUDED.summary,
             factor_hints = EXCLUDED.factor_hints,
             active      = EXCLUDED.active,
             sort_order  = EXCLUDED.sort_order`,
          [
            agentType, region, subRegion,
            s.name, s.hazardType, JSON.stringify(s.airports || []),
            s.lat, s.lon, s.radiusKm, s.summary,
            JSON.stringify(s.factorHints || {}), true, sort,
          ]
        );
        count++;
      }
    }
    console.log(`  ${agentType}: ${count} scenarios seeded`);
    total += count;
  }
  console.log(`Total: ${total} scenarios seeded`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
