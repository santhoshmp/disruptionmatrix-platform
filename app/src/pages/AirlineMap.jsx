import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import GEO from '../data/geo.json';
import { MONO, sevColor } from '../theme.js';

function destOf(route) {
  const m = route.match(/–([A-Z]{3})/g);
  return m ? m[m.length - 1].slice(1) : null;
}

export default function AirlineMap({ airline }) {
  const D = airline.data;
  const scoreField = airline.scoreField;
  const accent = airline.accent;
  const THREATS = [...D.THREATS].sort((a, b) => b[scoreField] - a[scoreField]);
  const hubs = airline.hubs;
  const rp = airline.routePrefix;

  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [selected, setSelected] = useState(THREATS[0].id);
  const [hub, setHub] = useState('All');

  const t = THREATS.find((x) => x.id === selected) || THREATS[0];
  const ex = D.EXPOSURE[t.id];
  const flights = D.FLIGHTS.filter(
    (f) => f.threat === selected && (hub === 'All' || hubs.some((h) => f.route.includes(h) && hub === h))
  );

  useEffect(() => {
    const map = L.map(mapEl.current, { zoomControl: true, minZoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.setView(airline.mapCenter, airline.mapZoom);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => map.remove();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const c = sevColor(t[scoreField]);

    hubs.forEach((code, idx) => {
      const s = GEO.STATIONS[code];
      if (!s) return;
      const big = idx === 0;
      const icon = L.divIcon({
        className: '', iconSize: [big ? 30 : 22, 44], iconAnchor: [big ? 15 : 11, big ? 15 : 11],
        html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:${big ? 24 : 16}px;height:${big ? 24 : 16}px;border-radius:50%;background:${big ? accent : '#7C8CA6'};border:2px solid #05080B;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div></div>`
      });
      L.marker([s.lat, s.lon], { icon, zIndexOffset: 900 }).addTo(layer);
    });

    const destSet = {};
    flights.forEach((f) => {
      const d = destOf(f.route);
      if (d && GEO.STATIONS[d]) {
        const origin = hubs.find((h) => f.route.startsWith(h));
        destSet[d] = origin || hubs[0];
      }
    });
    Object.keys(destSet).forEach((code) => {
      const d = GEO.STATIONS[code];
      const from = GEO.STATIONS[destSet[code]];
      if (!d || !from) return;
      L.polyline([[from.lat, from.lon], [d.lat, d.lon]], {
        color: c, weight: 2, opacity: 0.75, dashArray: destSet[code] === hubs[1] ? '2 5' : null
      }).addTo(layer);
      const icon = L.divIcon({
        className: '', iconSize: [16, 34], iconAnchor: [8, 8],
        html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:11px;height:11px;border-radius:50%;background:${c};border:2px solid #05080B"></div><div style="font-family:'IBM Plex Mono',monospace;font-size:9.5px;color:#C7D2E3;text-shadow:0 1px 2px #000">${code}</div></div>`
      });
      L.marker([d.lat, d.lon], { icon, zIndexOffset: 500 }).addTo(layer);
    });
  }, [selected, hub, airline]);

  const c = sevColor(t[scoreField]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 'calc(100% - 24px)' }}>
          <span className="kicker" style={{ alignSelf: 'center', background: 'var(--panel)', padding: '6px 8px' }}>THREAT</span>
          {THREATS.map((x) => (
            <button
              key={x.id}
              className={`pill${x.id === selected ? ' on' : ''}`}
              onClick={() => setSelected(x.id)}
              style={x.id === selected ? { borderColor: sevColor(x[scoreField]), background: sevColor(x[scoreField]) + '1F', color: 'var(--ink)' } : { background: 'var(--panel)' }}
            >
              {x.code} · {x[scoreField]}
            </button>
          ))}
          <span style={{ width: 10 }} />
          <span className="kicker" style={{ alignSelf: 'center', background: 'var(--panel)', padding: '6px 8px' }}>HUB</span>
          {['All', ...hubs].map((h) => (
            <button key={h} className={`pill${hub === h ? ' on' : ''}`} onClick={() => setHub(h)} style={{ background: 'var(--panel)' }}>{h}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: '0 0 360px', borderLeft: '1px solid var(--line)', background: 'var(--panel)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--line)', borderTop: `3px solid ${c}` }}>
          <div style={{ ...MONO, fontSize: 11, color: accent, letterSpacing: '0.06em', marginBottom: 5 }}>
            {t.region} · External score {t.edps} (EDPS)
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, marginBottom: 10 }}>{t.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center' }}>
            <div style={{ ...MONO, textAlign: 'center', padding: '10px 14px', color: c, border: `1px solid ${c}`, background: c + '1A' }}>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{t[scoreField]}</div>
              <div style={{ fontSize: 8, letterSpacing: '0.12em', color: 'var(--mute)', marginTop: 3 }}>{airline.scoreLabel}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5 }}>{t.summary}</div>
          </div>
        </div>

        <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <div className="kicker" style={{ marginBottom: 9 }}>EXPOSURE SUMMARY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5, color: 'var(--ink3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Scheduled departures in window</span><span className="mono" style={{ color: 'var(--ink)' }}>{ex.tier0.routeCount}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tails / rotations at risk</span><span className="mono" style={{ color: 'var(--ink)' }}>{ex.tier1.count}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Crew pairings near duty limit</span><span className="mono" style={{ color: 'var(--ink)' }}>{ex.tier2.count}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Connecting pax at risk</span><span className="mono" style={{ color: 'var(--ink)' }}>{ex.tier3.pax.toLocaleString()}</span></div>
          </div>
        </div>

        <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <div className="kicker" style={{ marginBottom: 9 }}>ROUTES HIGHLIGHTED ON MAP</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {flights.length ? flights.map((f) => (
              <div key={f.flt} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                <span className="mono" style={{ color: 'var(--ink2)' }}>{f.flt}</span>
                <span style={{ color: 'var(--ink3)' }}>{f.route}</span>
                <span className="mono" style={{ color: 'var(--mute)' }}>{f.tail}</span>
              </div>
            )) : <div style={{ fontSize: 12.5, color: 'var(--mute2)' }}>No rotations currently flagged.</div>}
          </div>
        </div>

        <div style={{ marginTop: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to={`${rp}/radar`} style={{ display: 'block', textAlign: 'center', padding: '11px 16px', fontSize: 13, fontWeight: 600, border: `1px solid ${accent}`, background: accent + '1F', color: 'var(--ink)' }}>
            Open full exposure board →
          </Link>
          <Link to={`${rp}/explorer?tab=gantt&threat=${t.id}`} style={{ display: 'block', textAlign: 'center', padding: '11px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--edge)', color: accent }}>
            Fix schedule in solver →
          </Link>
        </div>
      </div>
    </div>
  );
}
