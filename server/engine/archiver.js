// archiver.js — Event lifecycle: move passed/non-aviation events to archive
//
// An event is archived when ANY rule matches (thresholds in ref_connectors):
//   low_threat          — EDPS score < archiver.low_score (default 50)
//   no_aviation_impact  — no airports AND no airspace affected
//   stale               — detected > archiver.stale_age_hours ago (default 72h)
//                         and score < archiver.stale_score (default 65),
//                         OR detected > archiver.max_age_hours (default 240h)
//                         regardless of score — a hard retention cap
//
// Archived events stay in the DB (visible on /archive) but drop out of the
// active events list, map, and board. A sweep runs after each pipeline pass
// and on an interval; auto-archived events are restored when no archive rule
// applies anymore (fresh signals refresh `detected`, raise the score, or add
// an aviation footprint). Manually archived events are never auto-restored.

import store from '../store/event-store.js';
import * as refLoader from '../data/reference-loader.js';

// Tunables — editable via ref_connectors (Master Data → Connectors or
// Admin Settings → System Operations). Loader refreshes every 60s.
const _staleAgeMs = () => (parseFloat(refLoader.getConnectorConfig('archiver', 'stale_age_hours', 72)) || 72) * 3600e3;
const _maxAgeMs = () => {
  const h = parseFloat(refLoader.getConnectorConfig('archiver', 'max_age_hours', 240));
  return h > 0 ? h * 3600e3 : Infinity;
};
const _lowScore = () => parseFloat(refLoader.getConnectorConfig('archiver', 'low_score', 50)) || 50;
const _staleScore = () => parseFloat(refLoader.getConnectorConfig('archiver', 'stale_score', 65)) || 65;

// Extract valid IATA codes from the "where" display field.
// Handles "DXB / JFK" (bare codes) and "Delhi (DEL)" (parenthesized codes).
function _whereAirports(ev) {
  const out = new Set();
  const where = ev.where || '';
  for (const m of where.matchAll(/\(([A-Z]{3})\)/g)) {
    if (refLoader.getAirport(m[1])) out.add(m[1]);
  }
  for (const t of where.split(/[\/,]/)) {
    const tok = t.replace(/\(.*$/, '').trim();
    if (/^[A-Z]{3}$/.test(tok) && refLoader.getAirport(tok)) out.add(tok);
  }
  return [...out];
}

function _eventAirports(ev) {
  // Airports may live on the event (_airports / _geo.airports), in the
  // EVENT_GEO reference (seeded events), or embedded in the where string.
  const direct = [
    ...(ev._airports || []),
    ...(ev._geo?.airports || []),
    ...(store.geoData?.EVENT_GEO?.[ev.id]?.airports || []),
  ];
  if (direct.length > 0) return [...new Set(direct)];
  return _whereAirports(ev);
}

export function archiveReason(ev, now = Date.now()) {
  const score = ev.score || 0;
  if (score < _lowScore()) return 'low_threat';
  const airports = _eventAirports(ev);
  const airspace = ev._airspace || [];
  if (airports.length === 0 && airspace.length === 0) return 'no_aviation_impact';
  const detected = ev.detected ? Date.parse(ev.detected) : NaN;
  if (!isNaN(detected)) {
    const age = now - detected;
    // Hard cap: event older than max_age_hours archives regardless of score
    // (no live threat stays "approaching" for 10+ days).
    if (age > _maxAgeMs()) return 'stale';
    if (age > _staleAgeMs() && score < _staleScore()) return 'stale';
  }
  return null;
}

// Archive matching active events + restore auto-archived events that
// regained aviation relevance. Returns { archived, restored }.
export function archiveSweep() {
  const now = Date.now();
  const archived = [];
  const restored = [];

  for (const ev of store.events) {
    if (!ev.archived) {
      const reason = archiveReason(ev, now);
      if (reason) {
        store.archiveEvent(ev.id, reason);
        archived.push(ev.id);
      }
      continue;
    }
    // Auto-restore: only for machine-archived events that no longer match
    // ANY archive rule. Reusing archiveReason() here prevents flap — the
    // old check (score >= 50 + has airports) was weaker than the 'stale'
    // rule, so stale events oscillated archive→restore→archive forever.
    if (ev.archiveReason !== 'manual' && !archiveReason(ev, now)) {
      store.restoreEvent(ev.id);
      restored.push(ev.id);
    }
  }

  if (archived.length || restored.length) {
    console.log(`[Archiver] archived ${archived.length}, restored ${restored.length}`);
  }
  return { archived, restored };
}

let sweepTimer = null;

export function startArchiver(intervalMs = 15 * 60 * 1000) {
  archiveSweep();
  sweepTimer = setInterval(() => {
    try { archiveSweep(); } catch (e) { console.error('[Archiver] sweep failed:', e.message); }
  }, intervalMs);
  sweepTimer.unref?.();
  console.log(`[Archiver] Started — sweep every ${Math.round(intervalMs / 60000)}min`);
}

export function stopArchiver() {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

export default { archiveSweep, archiveReason, startArchiver, stopArchiver };
