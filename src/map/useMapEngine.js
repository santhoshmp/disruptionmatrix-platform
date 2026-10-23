// useMapEngine.js — Shared map preferences: engine, base style, projection.
// Persisted to localStorage; a window event keeps all mounted maps in sync
// within the same tab, and the 'storage' event covers other tabs.

import { useCallback, useEffect, useState } from 'react';

const KEYS = {
  engine: 'dm-map-engine',     // 'leaflet' | 'gl'
  style: 'dm-map-style',       // 'dark' | 'light'   (GL only)
  proj: 'dm-map-projection',   // 'mercator' | 'globe' (GL only)
};
const EVT = 'dm-map-prefs-change';
const DEFAULTS = { engine: 'leaflet', style: 'dark', proj: 'mercator' };

export function getMapPrefs() {
  return {
    engine: localStorage.getItem(KEYS.engine) || DEFAULTS.engine,
    style: localStorage.getItem(KEYS.style) || DEFAULTS.style,
    proj: localStorage.getItem(KEYS.proj) || DEFAULTS.proj,
  };
}

export function setMapPref(name, value) {
  localStorage.setItem(KEYS[name], value);
  window.dispatchEvent(new Event(EVT));
}

export function getMapEngine() {
  return getMapPrefs().engine;
}

export function setMapEngine(engine) {
  setMapPref('engine', engine);
}

export function useMapPrefs() {
  const [prefs, setPrefs] = useState(getMapPrefs);

  useEffect(() => {
    const sync = () => setPrefs(getMapPrefs());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const set = useCallback((name, value) => setMapPref(name, value), []);
  return [prefs, set];
}

export function useMapEngine() {
  const [prefs, set] = useMapPrefs();
  return [prefs.engine, (v) => set('engine', v)];
}
