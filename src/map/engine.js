// engine.js — Engine-agnostic GL map loader.
// Dynamically imports mapbox-gl or maplibre-gl so only the selected engine's
// code is downloaded. Selection precedence:
//   1. VITE_MAP_ENGINE ('mapbox' | 'maplibre') — explicit override
//   2. VITE_MAPBOX_TOKEN present → mapbox-gl
//   3. Otherwise → maplibre-gl with free CARTO vector tiles (no token needed)
// Style URL can be overridden with VITE_MAP_STYLE.

let _enginePromise = null;

const MAPLIBRE_STYLES = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};
const MAPBOX_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
};

export function glEngineName() {
  const pref = import.meta.env.VITE_MAP_ENGINE;
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (pref === 'maplibre') return 'MapLibre';
  if (pref === 'mapbox') return token ? 'Mapbox' : 'MapLibre (no Mapbox token)';
  return token ? 'Mapbox' : 'MapLibre';
}

export async function loadGL() {
  if (_enginePromise) return _enginePromise;
  _enginePromise = (async () => {
    const pref = import.meta.env.VITE_MAP_ENGINE;
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const styleOverride = import.meta.env.VITE_MAP_STYLE;
    const lightOverride = import.meta.env.VITE_MAP_STYLE_LIGHT;
    const wantMapbox = pref === 'mapbox' || (!pref && !!token);

    if (wantMapbox && token) {
      try {
        const mod = await import('mapbox-gl');
        await import('mapbox-gl/dist/mapbox-gl.css');
        const lib = mod.default || mod;
        lib.accessToken = token;
        return {
          name: 'Mapbox',
          lib,
          styles: {
            dark: styleOverride || MAPBOX_STYLES.dark,
            light: lightOverride || MAPBOX_STYLES.light,
          },
          attribution: '© Mapbox © OpenStreetMap contributors',
        };
      } catch (e) {
        console.warn('[map] mapbox-gl failed to load, falling back to maplibre-gl:', e);
      }
    } else if (wantMapbox && !token) {
      console.warn('[map] VITE_MAP_ENGINE=mapbox but no VITE_MAPBOX_TOKEN — using maplibre-gl');
    }

    const mod = await import('maplibre-gl');
    await import('maplibre-gl/dist/maplibre-gl.css');
    const lib = mod.default || mod;
    return {
      name: 'MapLibre',
      lib,
      styles: {
        dark: styleOverride || MAPLIBRE_STYLES.dark,
        light: lightOverride || MAPLIBRE_STYLES.light,
      },
      attribution: '© OpenStreetMap contributors © CARTO',
    };
  })();
  // If loading failed entirely, clear the cache so a retry is possible
  _enginePromise.catch(() => { _enginePromise = null; });
  return _enginePromise;
}

// ── Shared map handle helpers ────────────────────────────────────────────────
// A normalized interface both engines expose to parent components so popup
// anchoring / viewport-fit logic doesn't care which engine is underneath.

export function leafletHandle(map) {
  return {
    project: (lat, lon) => map.latLngToContainerPoint([lat, lon]),
    onViewportChange: (cb) => {
      map.on('move', cb);
      map.on('zoom', cb);
      map.on('resize', cb);
      return () => { map.off('move', cb); map.off('zoom', cb); map.off('resize', cb); };
    },
    fitPoints: (pts) => { // pts: [[lat, lon], ...]
      if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50] });
      else if (pts.length === 1) map.setView(pts[0], 5);
    },
  };
}

export function glHandle(map) {
  return {
    project: (lat, lon) => map.project([lon, lat]), // GL uses [lon, lat]
    onViewportChange: (cb) => {
      map.on('move', cb);
      map.on('zoom', cb);
      map.on('resize', cb);
      return () => { map.off('move', cb); map.off('zoom', cb); map.off('resize', cb); };
    },
    fitPoints: (pts) => { // pts: [[lat, lon], ...]
      if (pts.length > 1) {
        const lons = pts.map(p => p[1]);
        const lats = pts.map(p => p[0]);
        map.fitBounds(
          [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
          { padding: 50 }
        );
      } else if (pts.length === 1) {
        map.jumpTo({ center: [pts[0][1], pts[0][0]], zoom: 5 });
      }
    },
  };
}
