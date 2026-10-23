// GLThreatMap.jsx — Mapbox GL / MapLibre renderer for the world threat map.
// Mirrors LeafletThreatMap output: blast-radius polygons (true km), fixed-pixel
// halos, score-badge markers, airport dots, click-to-select, fit-once.

import { useEffect, useRef, useState } from 'react';
import { scoreColor } from '../../theme.js';
import { loadGL, glHandle } from '../../map/engine.js';
import { circlePolygon } from '../../map/circle.js';

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const GLOBE_CENTER = [62, 30]; // Asia + Middle East faces the viewer in globe mode

export default function GLThreatMap({ geoEvents, resolveGeo, airports, selId, onSelect, onReady, onMapClick, mapStyle = 'dark', projection = 'mercator' }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const fittedRef = useRef(false);
  const appliedStyleRef = useRef(mapStyle); // style used at construction
  const appliedProjRef = useRef(projection); // projection used at construction
  const [gl, setGl] = useState(null); // { name, lib, styles } once loaded
  const [styleReady, setStyleReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0); // bumps on each style load
  const [error, setError] = useState(null);

  // ── Initialize GL map ────────────────────────────────────────────
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
            center: projection === 'globe' ? GLOBE_CENTER : [15, 25], // [lon, lat]
            zoom: 2,
            minZoom: 2,
            projection, // string form works on both mapbox ('name' spec) and maplibre ('type' spec)
            attributionControl: { compact: true },
          });
        } catch (e) {
          console.error('[map] GL engine failed to load:', e);
          setError(e.message || 'GL engine failed to load');
          return;
        }
      map.addControl(new engine.lib.NavigationControl({ showCompass: false }), 'bottom-right');

      const CLICKABLE = ['threat-halo', 'threat-blast'];

      // General click — deselect when nothing hit (guarded for missing layers)
      map.on('click', (e) => {
        if (!map.getLayer('threat-halo')) { onMapClick?.(); return; }
        const feats = map.queryRenderedFeatures(e.point, { layers: CLICKABLE });
        if (feats.length === 0) onMapClick?.();
      });

      let handlersAttached = false;

      // style.load fires on initial load AND after every setStyle() —
      // re-adding sources/layers each time keeps them across style switches.
      map.on('style.load', () => {
        if (!map.getSource('threats')) {
          map.addSource('threats', { type: 'geojson', data: EMPTY_FC });
          // True blast radius — polygon fill + stroke
          map.addLayer({
            id: 'threat-blast', type: 'fill', source: 'threats',
            filter: ['==', ['get', 'kind'], 'blast'],
            paint: {
              'fill-color': ['get', 'c'],
              'fill-opacity': ['case', ['get', 'sel'], 0.18, 0.08],
            },
          });
          map.addLayer({
            id: 'threat-blast-line', type: 'line', source: 'threats',
            filter: ['==', ['get', 'kind'], 'blast'],
            paint: {
              'line-color': ['get', 'c'],
              'line-width': ['case', ['get', 'sel'], 2.5, 1.2],
            },
          });
          // Zoom-independent halo — fixed pixel radius
          map.addLayer({
            id: 'threat-halo', type: 'circle', source: 'threats',
            filter: ['==', ['get', 'kind'], 'halo'],
            paint: {
              'circle-radius': ['case', ['get', 'sel'], 30, 24],
              'circle-color': ['get', 'c'],
              'circle-opacity': ['case', ['get', 'sel'], 0.2, 0.1],
              'circle-stroke-color': ['get', 'c'],
              'circle-stroke-width': ['case', ['get', 'sel'], 2, 1.5],
            },
          });
        }
        if (!handlersAttached) {
          handlersAttached = true;
          for (const lyr of CLICKABLE) {
            map.on('click', lyr, (e) => {
              const id = e.features?.[0]?.properties?.id;
              if (id) onSelect?.(id);
            });
            map.on('mouseenter', lyr, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', lyr, () => { map.getCanvas().style.cursor = ''; });
          }
        }
        setStyleReady(true);
        setStyleEpoch(e => e + 1);
      });

        mapRef.current = map;
        setGl(engine);
        onReady?.(glHandle(map));
      };
      create();
    }).catch((e) => {
      console.error('[map] GL engine failed to load:', e);
      setError(e.message || 'GL engine failed to load');
    });
    return () => {
      cancelled = true;
      onReady?.(null);
      markersRef.current = [];
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

  // ── Update features + markers when data changes ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gl || !styleReady) return;
    const src = map.getSource('threats');
    if (!src) return;

    // Fit viewport once on first data
    if (!fittedRef.current && geoEvents.length > 0) {
      const pts = geoEvents.map(e => resolveGeo(e)).filter(Boolean).map(g => [g.lat, g.lon]);
      if (pts.length > 0) {
        glHandle(map).fitPoints(pts);
        fittedRef.current = true;
      }
    }

    // Build GeoJSON: blast polygons + halo points
    const features = [];
    geoEvents.forEach((e) => {
      const g = resolveGeo(e);
      if (!g) return;
      const c = scoreColor(e.score || 0);
      const on = e.id === selId;
      features.push({
        type: 'Feature', properties: { kind: 'blast', id: e.id, c, sel: on },
        geometry: circlePolygon(g.lon, g.lat, g.radiusKm || 100),
      });
      features.push({
        type: 'Feature', properties: { kind: 'halo', id: e.id, c, sel: on },
        geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
      });
    });
    src.setData({ type: 'FeatureCollection', features });

    // Rebuild badge + airport-dot markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    geoEvents.forEach((e) => {
      const g = resolveGeo(e);
      if (!g) return;
      const c = scoreColor(e.score || 0);
      const on = e.id === selId;

      const badge = document.createElement('div');
      badge.style.cssText = `font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;text-align:center;padding:3px 6px;color:${c};border:1px solid ${c};background:#0B1220E6;cursor:pointer`;
      badge.textContent = e.score || 0;
      badge.addEventListener('click', (ev) => { ev.stopPropagation(); onSelect?.(e.id); });
      const bm = new gl.lib.Marker({ element: badge, anchor: 'center' })
        .setLngLat([g.lon, g.lat]).addTo(map);
      markersRef.current.push(bm);

      (g.airports || e._airports || []).forEach((code) => {
        const a = airports[code];
        if (!a) return;
        const dot = document.createElement('div');
        dot.style.cssText = 'display:flex;flex-direction:column;align-items:center';
        dot.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${c};border:1.5px solid #05080B"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div>`;
        markersRef.current.push(
          new gl.lib.Marker({ element: dot, anchor: 'center' }).setLngLat([a.lon, a.lat]).addTo(map)
        );
      });
    });
  }, [gl, styleReady, styleEpoch, geoEvents, selId, resolveGeo, airports]);

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
