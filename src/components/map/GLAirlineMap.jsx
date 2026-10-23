// GLAirlineMap.jsx — Mapbox GL / MapLibre renderer for the airline exposure map.
// Mirrors the Leaflet version in AirlineMap.jsx: hub markers, route lines
// (dashed for secondary-hub routes), destination markers.

import { useEffect, useRef, useState } from 'react';
import { sevColor } from '../../theme.js';
import { loadGL } from '../../map/engine.js';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

function destOf(route) {
  const m = route.match(/–([A-Z]{3})/g);
  return m ? m[m.length - 1].slice(1) : null;
}

const GLOBE_CENTER = [62, 30]; // Asia + Middle East faces the viewer in globe mode

export default function GLAirlineMap({ airline, GEO, selected, hub, flights, mapStyle = 'dark', projection = 'mercator' }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const appliedStyleRef = useRef(mapStyle);
  const appliedProjRef = useRef(projection);
  const [gl, setGl] = useState(null);
  const [styleReady, setStyleReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [error, setError] = useState(null);

  const hubs = airline.hubs;
  const accent = airline.accent;
  const scoreField = airline.scoreField;
  const THREATS = airline.data.THREATS;
  const t = THREATS.find((x) => x.id === selected) || THREATS[0];
  const c = sevColor(t[scoreField]);

  useEffect(() => {
    let cancelled = false;
    loadGL().then((engine) => {
      const create = () => {
        if (cancelled || !mapEl.current) return;
        // Defer until the container is laid out — maplibre crashes in
        // _calcMatrices if constructed against a 0×0 container.
        if (mapEl.current.clientWidth === 0 || mapEl.current.clientHeight === 0) {
          requestAnimationFrame(create);
          return;
        }
        let map;
        try {
          map = new engine.lib.Map({
            container: mapEl.current,
            style: engine.styles[mapStyle] || engine.styles.dark,
            center: projection === 'globe' ? GLOBE_CENTER : [airline.mapCenter[1], airline.mapCenter[0]], // [lon, lat]
            zoom: projection === 'globe' ? 2 : airline.mapZoom,
            minZoom: 2,
            projection, // string form works on both mapbox and maplibre
            attributionControl: { compact: true },
          });
        } catch (e) {
          console.error('[map] GL engine failed to load:', e);
          setError(e.message || 'GL engine failed to load');
          return;
        }
      map.addControl(new engine.lib.NavigationControl({ showCompass: false }), 'bottom-right');

      // style.load fires on initial load AND after every setStyle()
      map.on('style.load', () => {
        if (!map.getSource('routes')) {
          map.addSource('routes', { type: 'geojson', data: EMPTY_FC });
          map.addLayer({
            id: 'routes-solid', type: 'line', source: 'routes',
            filter: ['!=', ['get', 'dashed'], true],
            paint: { 'line-color': ['get', 'c'], 'line-width': 2, 'line-opacity': 0.75 },
          });
          map.addLayer({
            id: 'routes-dashed', type: 'line', source: 'routes',
            filter: ['==', ['get', 'dashed'], true],
            paint: { 'line-color': ['get', 'c'], 'line-width': 2, 'line-opacity': 0.75, 'line-dasharray': [1.5, 2.5] },
          });
        }
        setStyleReady(true);
        setStyleEpoch(e => e + 1);
      });

        mapRef.current = map;
        setGl(engine);
      };
      create();
    }).catch((e) => {
      console.error('[map] GL engine failed to load:', e);
      setError(e.message || 'GL engine failed to load');
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, []);

  // ── Switch base style (dark/light) ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gl || appliedStyleRef.current === mapStyle) return;
    appliedStyleRef.current = mapStyle;
    map.setStyle(gl.styles[mapStyle] || gl.styles.dark);
  }, [gl, mapStyle]);

  // ── Switch projection (2D mercator / globe) ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gl || appliedProjRef.current === projection) return;
    appliedProjRef.current = projection;
    map.setProjection(projection);
    if (projection === 'globe') {
      map.jumpTo({ center: GLOBE_CENTER, zoom: 2 });
    }
  }, [gl, projection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gl || !styleReady) return;
    const src = map.getSource('routes');
    if (!src) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Hub markers
    hubs.forEach((code, idx) => {
      const s = GEO.STATIONS[code];
      if (!s) return;
      const big = idx === 0;
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center';
      el.innerHTML = `<div style="width:${big ? 24 : 16}px;height:${big ? 24 : 16}px;border-radius:50%;background:${big ? accent : '#7C8CA6'};border:2px solid #05080B;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div>`;
      markersRef.current.push(
        new gl.lib.Marker({ element: el, anchor: 'center' }).setLngLat([s.lon, s.lat]).addTo(map)
      );
    });

    // Route lines + destination markers
    const destSet = {};
    flights.forEach((f) => {
      const d = destOf(f.route);
      if (d && GEO.STATIONS[d]) {
        const origin = hubs.find((h) => f.route.startsWith(h));
        destSet[d] = origin || hubs[0];
      }
    });
    const features = [];
    Object.keys(destSet).forEach((code) => {
      const d = GEO.STATIONS[code];
      const from = GEO.STATIONS[destSet[code]];
      if (!d || !from) return;
      features.push({
        type: 'Feature', properties: { c, dashed: destSet[code] === hubs[1] },
        geometry: { type: 'LineString', coordinates: [[from.lon, from.lat], [d.lon, d.lat]] },
      });
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center';
      el.innerHTML = `<div style="width:11px;height:11px;border-radius:50%;background:${c};border:2px solid #05080B"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:9.5px;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div>`;
      markersRef.current.push(
        new gl.lib.Marker({ element: el, anchor: 'center' }).setLngLat([d.lon, d.lat]).addTo(map)
      );
    });
    src.setData({ type: 'FeatureCollection', features });
  }, [gl, styleReady, styleEpoch, selected, hub, airline, flights]);

  return (
    <>
      <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
      {error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg)', color: 'var(--mute)', fontSize: 12,
        }}>
          Map engine failed to load: {error}
        </div>
      )}
    </>
  );
}
