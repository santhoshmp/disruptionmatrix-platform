// GLAgentRegionMap.jsx — Mapbox GL / MapLibre renderer for the agent region map.
// Mirrors AgentRegionMap.jsx: region bounding boxes + agent pins + hover tooltips.

import { useEffect, useRef, useState } from 'react';
import { TEAL, CRIT, HIGH, MOD, LOW } from '../../theme.js';
import { loadGL } from '../../map/engine.js';
import { bboxPolygon } from '../../map/circle.js';

const TYPE_COLORS = {
  weather: '#22D3EE',
  atc: '#A78BFA',
  industrial: '#F5A623',
  geopolitical: '#F0495A',
  infrastructure: '#34D399',
  regulatory: '#E8C34A',
  'impact-assessment': '#F59E2B',
};

const PRIORITY_SIZES = {
  critical: 8,
  high: 6,
  medium: 5,
  low: 4,
  standard: 4,
};

const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const GLOBE_CENTER = [62, 30]; // Asia + Middle East faces the viewer in globe mode

export default function GLAgentRegionMap({ agents, regions, selectedAgent, onSelectAgent, mapStyle = 'dark', projection = 'mercator' }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupRef = useRef(null);
  const appliedStyleRef = useRef(mapStyle);
  const appliedProjRef = useRef(projection);
  const [gl, setGl] = useState(null);
  const [styleReady, setStyleReady] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [error, setError] = useState(null);

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
            center: projection === 'globe' ? GLOBE_CENTER : [20, 25],
            zoom: projection === 'globe' ? 2 : 3,
            minZoom: 2,
            projection, // string form works on both mapbox and maplibre
            attributionControl: { compact: true },
          });
        } catch (e) {
          console.error('[map] GL engine failed to load:', e);
          setError(e.message || 'GL engine failed to load');
          return;
        }
      map.addControl(new engine.lib.NavigationControl({ showCompass: false }), 'top-right');

      // style.load fires on initial load AND after every setStyle()
      map.on('style.load', () => {
        if (!map.getSource('region-bboxes')) {
          map.addSource('region-bboxes', { type: 'geojson', data: EMPTY_FC });
          map.addLayer({
            id: 'region-fill', type: 'fill', source: 'region-bboxes',
            paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.04 },
          });
          map.addLayer({
            id: 'region-line', type: 'line', source: 'region-bboxes',
            paint: {
              'line-color': ['get', 'c'], 'line-width': 1,
              'line-opacity': 0.3, 'line-dasharray': [4, 4],
            },
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
      popupRef.current?.remove();
      popupRef.current = null;
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
    if (!map || !gl || !styleReady || !regions || !agents) return;
    const src = map.getSource('region-bboxes');
    if (!src) return;

    // Region bounding boxes
    const features = [];
    regions.forEach((r) => {
      r.subRegions?.forEach((sub) => {
        if (!sub.bbox) return;
        const { minLat, minLon, maxLat, maxLon } = sub.bbox;
        const c = r.priority === 'critical' ? CRIT : r.priority === 'high' ? HIGH : r.priority === 'medium' ? MOD : LOW;
        features.push({
          type: 'Feature', properties: { c },
          geometry: bboxPolygon(minLat, minLon, maxLat, maxLon),
        });
      });
    });
    src.setData({ type: 'FeatureCollection', features });

    // Agent pins as Marker elements
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    popupRef.current?.remove();
    popupRef.current = null;

    agents.forEach((a) => {
      const region = regions.find((r) => r.id === a.region);
      const sub = region?.subRegions?.find((s) => s.id === a.subRegion);
      if (!sub?.bbox) return;

      const { minLat, minLon, maxLat, maxLon } = sub.bbox;
      const lat = (minLat + maxLat) / 2;
      const lon = (minLon + maxLon) / 2;

      const color = TYPE_COLORS[a.type] || TEAL;
      const size = PRIORITY_SIZES[a.priority] || 5;
      const isSelected = selectedAgent === a.id;
      const statusColor = a.status === 'active' ? '#34D399' : a.status === 'polling' ? '#F5A623' : a.status === 'error' ? '#F0495A' : 'var(--mute)';

      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer';
      el.innerHTML = `
        <div style="width:${size * 2}px;height:${size * 2}px;border-radius:50%;background:${color};border:2px solid ${isSelected ? '#fff' : color};box-shadow:0 0 ${isSelected ? 8 : 4}px ${color}"></div>
        <div style="width:4px;height:4px;border-radius:50%;background:${statusColor};margin-top:1px"></div>`;
      el.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectAgent?.(a.id); });
      // Hover tooltip via a shared GL Popup
      el.addEventListener('mouseenter', () => {
        popupRef.current?.remove();
        popupRef.current = new gl.lib.Popup({ closeButton: false, closeOnClick: false, offset: [0, -size], className: 'agent-tooltip' })
          .setLngLat([lon, lat])
          .setHTML(`${a.id}<br/>${a.type} · ${a.priority}`)
          .addTo(map);
      });
      el.addEventListener('mouseleave', () => {
        popupRef.current?.remove();
        popupRef.current = null;
      });

      markersRef.current.push(
        new gl.lib.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map)
      );
    });
  }, [gl, styleReady, styleEpoch, agents, regions, selectedAgent]);

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
