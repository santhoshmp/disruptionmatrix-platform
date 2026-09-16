// seed.js — standalone script to verify the store seeds correctly.
// Run: node scripts/seed.js

import store from '../store/event-store.js';

console.log('=== DisruptionMatrix Store Seeder ===\n');

store.seed();

console.log('\n=== Seeded Data Summary ===');
console.log(`Events:     ${store.events.length}`);
console.log(`OPS:        ${Object.keys(store.ops).length}`);
console.log(`Agents:     ${store.agents.length}`);
console.log(`Signals:    ${store.signals.length}`);
console.log(`Regions:    ${store.regions.length}`);
console.log(`Agent types: ${store.agentTypes.length}`);

console.log('\n=== Events (by score) ===');
const sorted = [...store.events].sort((a, b) => b.score - a.score);
for (const ev of sorted.slice(0, 5)) {
  console.log(`  ${ev.score} | ${ev.ref} | ${ev.cat.padEnd(20)} | ${ev.name}`);
}
console.log(`  ... and ${sorted.length - 5} more`);

console.log('\n=== Agents (first 5) ===');
for (const a of store.agents.slice(0, 5)) {
  console.log(`  ${a.id.padEnd(35)} | ${a.type.padEnd(15)} | ${a.priority} | signals: ${a.signalCount}`);
}
console.log(`  ... and ${store.agents.length - 5} more`);

console.log('\n=== Regions ===');
for (const r of store.regions) {
  console.log(`  ${r.id} | ${r.priority.padEnd(8)} | ${r.name} (${r.subRegions.length} sub-regions)`);
}

console.log('\n=== API Endpoints (available when server runs) ===');
console.log('  GET  /api/agents              — list all agents');
console.log('  GET  /api/agents/types        — agent type definitions');
console.log('  GET  /api/agents/:id          — single agent');
console.log('  POST /api/agents/:id/trigger  — trigger agent poll');
console.log('  GET  /api/regions             — list all regions');
console.log('  GET  /api/regions/:id         — single region');
console.log('  GET  /api/signals             — list signals');
console.log('  GET  /api/signals/:id         — single signal');
console.log('  GET  /api/events              — list events');
console.log('  GET  /api/events/:id          — single event');
console.log('  GET  /api/events/:id/ops      — impact assessment');
console.log('  GET  /api/reference           — reference data (SOPS, ESC, etc.)');
console.log('  WS   /api/stream              — real-time stream');
console.log('  GET  /api/stream              — SSE fallback');

console.log('\n✓ Seed complete.');
