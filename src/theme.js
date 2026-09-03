export const CRIT = '#F0495A';
export const HIGH = '#F5A623';
export const MOD = '#E8C34A';
export const LOW = '#5B92C9';
export const OK = '#34D399';
export const CYAN = '#22D3EE';
export const TEAL = '#4CC2CE';

export const MONO = { fontFamily: "'IBM Plex Mono', monospace" };

export function scoreColor(s) {
  return s >= 80 ? CRIT : s >= 65 ? HIGH : s >= 45 ? MOD : LOW;
}

export function sevColor(v) {
  return v >= 80 ? CRIT : v >= 55 ? HIGH : v >= 35 ? MOD : OK;
}

export function confLabel(c) {
  return c >= 4 ? 'High' : c >= 3 ? 'Moderate' : c >= 2 ? 'Low' : 'Very low';
}

export function trajColor(t) {
  return t === 'Escalating' ? CRIT : t === 'Improving' ? OK : 'var(--mute)';
}

export function trajArrow(t) {
  return t === 'Escalating' ? '\u25B2' : t === 'Improving' ? '\u25BC' : '\u25A0';
}

export function statusColor(s) {
  if (s === 'AOG' || s === 'Red') return CRIT;
  if (s === 'Scheduled maintenance' || s === 'Standby' || s === 'Amber') return HIGH;
  return OK;
}

export function toneColor(t) {
  return t === 'red' ? CRIT : t === 'amber' ? HIGH : t === 'green' ? OK : 'var(--ink3)';
}
