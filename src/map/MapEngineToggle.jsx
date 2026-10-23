// MapEngineToggle.jsx — Floating map controls: engine, style, projection.
// Style + projection only apply to the GL engine (Mapbox/MapLibre).

import { MONO } from '../theme.js';
import { useMapPrefs } from './useMapEngine.js';
import { glEngineName } from './engine.js';

export default function MapEngineToggle({ style }) {
  const [prefs, setPref] = useMapPrefs();
  const glName = glEngineName().toUpperCase();
  const isGL = prefs.engine === 'gl';

  const btn = (group, value, label) => (
    <button
      key={value}
      onClick={() => setPref(group, value)}
      style={{
        ...MONO, fontSize: 9, letterSpacing: '0.06em', cursor: 'pointer',
        padding: '4px 8px', border: 'none',
        background: prefs[group] === value ? 'var(--teal)' : 'transparent',
        color: prefs[group] === value ? '#05080B' : 'var(--mute)',
        fontWeight: prefs[group] === value ? 700 : 400,
        borderRadius: 3,
      }}
    >{label}</button>
  );

  const group = (children, key) => (
    <div key={key} style={{
      display: 'flex', gap: 2, padding: 2,
      background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 5,
      boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
    }}>
      {children}
    </div>
  );

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 2000,
      display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end',
      ...style,
    }}>
      {group([btn('engine', 'leaflet', 'LEAFLET'), btn('engine', 'gl', glName)], 'eng')}
      {isGL && group([btn('style', 'dark', 'DARK'), btn('style', 'light', 'LIGHT')], 'sty')}
      {isGL && group([btn('proj', 'mercator', '2D'), btn('proj', 'globe', 'GLOBE')], 'prj')}
    </div>
  );
}
