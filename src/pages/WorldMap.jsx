import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import DM from '../data/dm-data.json';
import GEO from '../data/geo.json';
import { MONO, scoreColor, trajArrow, trajColor, confLabel } from '../theme.js';

const CATS = ['All', 'Weather', 'Industrial action', 'Geopolitical', 'Infrastructure', 'Regulatory'];

export default function WorldMap() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [cat, setCat] = useState('All');
  const [selected, setSelected] = useState('storm');

  const shown = DM.EVENTS.filter((e) => GEO.EVENT_GEO[e.id] && (cat === 'All' || e.cat === cat));
  const sel = DM.EVENTS.find((e) => e.id === selected) || shown[0] || DM.EVENTS[0];

  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: true, worldCopyJump: true, minZoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.setView([46, 10], 4);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => map.remove();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    shown.forEach((e) => {
      const g = GEO.EVENT_GEO[e.id];
      const c = scoreColor(e.score);
      const on = e.id === selected;
      L.circle([g.lat, g.lon], {
        radius: g.radiusKm * 1000, color: c, weight: on ? 2.5 : 1.2,
        fillColor: c, fillOpacity: on ? 0.18 : 0.08
      }).on('click', () => setSelected(e.id)).addTo(layer);
      const icon = L.divIcon({
        className: '', iconSize: [46, 26], iconAnchor: [23, 13],
        html: `<div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;text-align:center;padding:3px 6px;color:${c};border:1px solid ${c};background:#0B1220E6;cursor:pointer">${e.score}</div>`
      });
      L.marker([g.lat, g.lon], { icon, zIndexOffset: on ? 900 : 400 })
        .on('click', () => setSelected(e.id)).addTo(layer);
      g.airports.forEach((code) => {
        const a = GEO.AIRPORTS[code];
        if (!a) return;
        const dot = L.divIcon({
          className: '', iconSize: [14, 28], iconAnchor: [7, 7],
          html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:8px;height:8px;border-radius:50%;background:${c};border:1.5px solid #05080B"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div></div>`
        });
        L.marker([a.lat, a.lon], { icon: dot }).addTo(layer);
      });
    });
  }, [cat, selected]);

  const ops = DM.OPS[sel.id];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CATS.map((c) => (
            <button key={c} className={`pill${cat === c ? ' on' : ''}`} onClick={() => setCat(c)} style={{ background: 'var(--panel)' }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: '0 0 360px', borderLeft: '1px solid var(--line)', background: 'var(--panel)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <div className="kicker" style={{ marginBottom: 10 }}>ACTIVE EVENTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shown.map((e) => (
              <div
                key={e.id} onClick={() => setSelected(e.id)} className="hoverable"
                style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', border: `1px solid ${e.id === selected ? scoreColor(e.score) : 'var(--line)'}`, background: e.id === selected ? scoreColor(e.score) + '14' : 'var(--panel2)' }}
              >
                <div style={{ ...MONO, fontWeight: 600, fontSize: 14, color: scoreColor(e.score) }}>{e.score}</div>
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{e.name}</div>
                <div style={{ ...MONO, fontSize: 10.5, color: trajColor(e.traj) }}>{trajArrow(e.traj)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 14, borderBottom: '1px solid var(--line)', borderTop: `3px solid ${scoreColor(sel.score)}` }}>
          <div style={{ ...MONO, fontSize: 11, color: 'var(--cyan)', marginBottom: 5 }}>{sel.ref} · {sel.cat} · Conf {confLabel(sel.conf)}</div>
          <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.3, marginBottom: 8 }}>{sel.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.55 }}>{sel.summary}</div>
        </div>

        {ops && (
          <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
            <div className="kicker" style={{ marginBottom: 9 }}>AIRPORTS IN AREA OF EFFECT</div>
            {ops.airports.map((a) => (
              <div key={a.iata} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, padding: '4px 0' }}>
                <span className="mono" style={{ color: 'var(--ink2)' }}>{a.iata}</span>
                <span style={{ flex: 1, color: 'var(--ink3)' }}>{a.name}</span>
                <span className="mono" style={{ color: scoreColor(a.exposure) }}>{a.exposure}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', padding: 14 }}>
          <Link to={`/event/${sel.id}`} style={{ display: 'block', textAlign: 'center', padding: '11px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--teal)', background: 'rgba(76,194,206,0.12)', color: 'var(--ink)' }}>
            Open full assessment →
          </Link>
        </div>
      </div>
    </div>
  );
}
