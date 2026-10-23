// rescore-no-airport-events.js — One-off maintenance script
// Re-scores events that have geo coordinates but NO affected airports and NO
// airspace (e.g. remote oceanic earthquakes, far-from-airport wildfires).
// These events are real, but they have no aviation impact — their EDPS should
// reflect that instead of being driven purely by hazard severity.
//
// Applies the same dampening the connectors now emit:
//   severity        → capped at 25
//   geographicReach → 10
//   escalationRate  → 30
// Then recomputes EDPS = Σ(val × weight) and re-maps the escalation band.
//
// Usage: node scripts/rescore-no-airport-events.js [--dry-run]

import eventsRepo from '../db/repositories/events.js';
import pool from '../db/pool.js';

const DRY_RUN = process.argv.includes('--dry-run');

const DAMPEN = {
  'Severity if realised': (v) => Math.min(v, 25),
  'Geographic reach': () => 10,
  'Time to impact': (v) => Math.min(v, 35),
  'Escalation rate': () => 30,
};

const ESC_MAP = { L4: 4, L3: 3, L2: 2, L1: 1 };

async function main() {
  const bandsRes = await pool.query('SELECT * FROM ref_scoring_bands ORDER BY min_score DESC');
  const bands = bandsRes.rows;

  const escFor = (score) => {
    for (const b of bands) {
      if (score >= b.min_score && score <= b.max_score) return ESC_MAP[b.escalation] || 1;
    }
    return 1;
  };

  const events = await eventsRepo.getAll({ limit: 10000 });
  let fixed = 0, skipped = 0;

  for (const ev of events) {
    const airports = ev._airports || [];
    const airspace = ev._airspace || [];
    const geo = ev._geo || {};
    if (airports.length > 0 || airspace.length > 0) { skipped++; continue; }
    if (geo.lat == null || geo.lon == null) { skipped++; continue; }

    const factors = (ev.factors || []).map((f) => ({ ...f }));
    let changed = false;
    for (const f of factors) {
      const fn = DAMPEN[f.label];
      if (fn && f.val !== fn(f.val)) {
        f.val = fn(f.val);
        f.readout = f.label === 'Geographic reach' ? 'No airports in range' : f.readout;
        changed = true;
      }
    }
    if (!changed) { skipped++; continue; }

    const score = Math.round(factors.reduce((s, f) => s + f.val * (f.weight || 0), 0));
    const esc = escFor(score);
    const traj = score < ev.score - 3 ? 'Improving' : ev.traj;

    console.log(`${DRY_RUN ? '[dry] ' : ''}${ev.id}: ${ev.score} → ${score} (esc ${ev.esc}→${esc}) — ${(ev.name || '').slice(0, 60)}`);

    if (!DRY_RUN) {
      await eventsRepo.update(ev.id, { score, esc, traj, factors });
    }
    fixed++;
  }

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Rescored ${fixed} events, skipped ${skipped} (have airports/airspace or no geo)`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
