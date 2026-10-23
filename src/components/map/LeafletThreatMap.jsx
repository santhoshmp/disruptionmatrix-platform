// LeafletThreatMap.jsx — Leaflet renderer for the world threat map.
// Extracted from WorldMap.jsx; rendering logic is unchanged.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { scoreColor } from '../../theme.js';
import { leafletHandle } from '../../map/engine.js';

export default function LeafletThreatMap({ geoEvents, resolveGeo, airports, selId, onSelect, onReady, onMapClick, loading }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  // ── Initialize Leaflet map ───────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current) return; // guard against null ref during loading
    if (mapRef.current) return; // already initialized
    const map = L.map(mapEl.current, {
      zoomControl: false, worldCopyJump: true, minZoom: 2,
      // Tiles only cover ±85° lat — keep the view inside so no blank band shows
      maxBounds: [[-85, -360], [85, 360]], maxBoundsViscosity: 1.0,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', () => onMapClick?.()); // dismiss popup on map click
    map.setView([25, 15], 2);
    mapRef.current = map;
    onReady?.(leafletHandle(map));
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      onReady?.(null);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Invalidate map size when loading state changes (container appears/disappears)
  useEffect(() => {
    if (!loading && mapRef.current && mapEl.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 100);
    }
  }, [loading]);

  // ── Update map markers when events change ───────────────────────
  const fittedRef = useRef(false);
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    // Fit the viewport to visible events once data first arrives
    if (!fittedRef.current && geoEvents.length > 0 && mapRef.current) {
      const pts = geoEvents.map(e => resolveGeo(e)).filter(Boolean).map(g => [g.lat, g.lon]);
      if (pts.length > 0) leafletHandle(mapRef.current).fitPoints(pts);
      if (pts.length > 0) fittedRef.current = true;
    }

    geoEvents.forEach((e) => {
      const g = resolveGeo(e);
      if (!g) return;
      const c = scoreColor(e.score || 0);
      const on = e.id === selId;
      // Zoom-independent halo — stays visible around the score badge at any zoom,
      // so events with small blast radii (real METAR hazards ~50-100km) don't lose
      // their ring when zoomed out.
      L.circleMarker([g.lat, g.lon], {
        radius: on ? 30 : 24, color: c, weight: on ? 2 : 1.5,
        fillColor: c, fillOpacity: on ? 0.2 : 0.1
      }).on('click', () => onSelect?.(e.id)).addTo(layer);
      // True blast radius in km — reveals actual extent when zoomed in
      L.circle([g.lat, g.lon], {
        radius: (g.radiusKm || 100) * 1000, color: c, weight: on ? 2.5 : 1.2,
        fillColor: c, fillOpacity: on ? 0.18 : 0.08
      }).on('click', () => onSelect?.(e.id)).addTo(layer);
      const icon = L.divIcon({
        className: '', iconSize: [46, 26], iconAnchor: [23, 13],
        html: `<div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;text-align:center;padding:3px 6px;color:${c};border:1px solid ${c};background:#0B1220E6;cursor:pointer">${e.score || 0}</div>`
      });
      L.marker([g.lat, g.lon], { icon, zIndexOffset: on ? 900 : 400 })
        .on('click', () => onSelect?.(e.id)).addTo(layer);
      (g.airports || e._airports || []).forEach((code) => {
        const a = airports[code];
        if (!a) return;
        const dot = L.divIcon({
          className: '', iconSize: [14, 28], iconAnchor: [7, 7],
          html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:8px;height:8px;border-radius:50%;background:${c};border:1.5px solid #05080B"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div></div>`
        });
        L.marker([a.lat, a.lon], { icon: dot }).addTo(layer);
      });
    });
  }, [geoEvents, selId, resolveGeo, airports]);

  return <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />;
}
