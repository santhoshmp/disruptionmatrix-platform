// AgentRegionMap.jsx — Map showing region bounding boxes + agent pins.
// Engine-switchable: Leaflet (default) or GL vector (Mapbox/MapLibre).

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { HELP } from './sourceMode.jsx';
import GLAgentRegionMap from '../map/GLAgentRegionMap.jsx';
import MapEngineToggle from '../../map/MapEngineToggle.jsx';
import { useMapPrefs } from '../../map/useMapEngine.js';

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

function LeafletAgentRegionMap({ agents, regions, selectedAgent, onSelectAgent }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: true, worldCopyJump: true, minZoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.setView([25, 20], 3);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => map.remove();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !regions || !agents) return;
    layer.clearLayers();

    // Draw region bounding boxes
    regions.forEach((r) => {
      r.subRegions?.forEach((sub) => {
        if (!sub.bbox) return;
        const { minLat, minLon, maxLat, maxLon } = sub.bbox;
        L.rectangle([[minLat, minLon], [maxLat, maxLon]], {
          color: r.priority === 'critical' ? CRIT : r.priority === 'high' ? HIGH : r.priority === 'medium' ? MOD : LOW,
          weight: 1, fillOpacity: 0.04, opacity: 0.3, dashArray: '4 4',
        }).addTo(layer);
      });
    });

    // Plot agent pins
    agents.forEach((a) => {
      // Find the sub-region center
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

      const icon = L.divIcon({
        className: '',
        iconSize: [size * 4, size * 4],
        iconAnchor: [size * 2, size * 2],
        html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
          <div style="width:${size * 2}px;height:${size * 2}px;border-radius:50%;background:${color};border:2px solid ${isSelected ? '#fff' : color};box-shadow:0 0 ${isSelected ? 8 : 4}px ${color}"></div>
          <div style="width:4px;height:4px;border-radius:50%;background:${statusColor};margin-top:1px"></div>
        </div>`,
      });

      L.marker([lat, lon], { icon, zIndexOffset: isSelected ? 900 : 400 })
        .on('click', () => onSelectAgent?.(a.id))
        .bindTooltip(`${a.id}<br/>${a.type} · ${a.priority}`, {
          className: 'agent-tooltip',
          direction: 'top', offset: [0, -size],
        })
        .addTo(layer);
    });
  }, [agents, regions, selectedAgent]);

  return <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />;
}

export default function AgentRegionMap({ agents, regions, selectedAgent, onSelectAgent }) {
  const [prefs] = useMapPrefs();
  const mapProps = { agents, regions, selectedAgent, onSelectAgent };

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      {prefs.engine === 'gl'
        ? <GLAgentRegionMap {...mapProps} mapStyle={prefs.style} projection={prefs.proj} />
        : <LeafletAgentRegionMap {...mapProps} />}
      <MapEngineToggle />
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 1000, background: 'var(--panel)', border: '1px solid var(--line)', padding: '8px 12px', ...MONO, fontSize: 10.5, color: 'var(--mute)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--ink2)', letterSpacing: '0.05em' }}>AGENT TYPES</span>
          <InfoIcon title={HELP.regionMap.title} sections={HELP.regionMap.sections} placement="right" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
              <span>{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
