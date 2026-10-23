// WorldMap.jsx — Live threat map using API data (not static JSON)
// Fetches events from /api/events and geo/airport reference from /api/reference
// Shows the same events as the Threat Board, with geo coordinates.
// Map engine is switchable: Leaflet (raster tiles) or GL vector (Mapbox/MapLibre).

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MONO, scoreColor, trajArrow, trajColor, confLabel } from '../theme.js';
import FilterSelect from '../components/FilterSelect.jsx';
import LeafletThreatMap from '../components/map/LeafletThreatMap.jsx';
import GLThreatMap from '../components/map/GLThreatMap.jsx';
import MapEngineToggle from '../map/MapEngineToggle.jsx';
import { useMapPrefs } from '../map/useMapEngine.js';

const CATS = ['All', 'Weather', 'ATC / Airspace', 'Industrial action', 'Geopolitical', 'Infrastructure', 'Regulatory'];

export default function WorldMap() {
  const mapEl = useRef(null);
  const [mapPrefs] = useMapPrefs();
  const mapEngine = mapPrefs.engine;
  const [mapHandle, setMapHandle] = useState(null);
  const [cat, setCat] = useState('All');
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventGeo, setEventGeo] = useState({}); // EVENT_GEO from reference
  const [airports, setAirports] = useState({}); // AIRPORTS from reference
  const [regions, setRegions] = useState([]); // REGIONS from reference
  const [regionFilter, setRegionFilter] = useState('All');
  const [topbarSlot, setTopbarSlot] = useState(null); // portal target in the app top bar

  // Find the top-bar actions slot (rendered by App.jsx TopBar)
  useEffect(() => {
    setTopbarSlot(document.getElementById('topbar-actions'));
  }, []);
  const [opsMap, setOpsMap] = useState({}); // eventId → ops
  const [popupPos, setPopupPos] = useState(null); // {x, y, below} screen point of selected marker
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all'); // 'agent' | 'mixed' | 'seeded' | 'all'

  // ── Load data from API ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [eventsRes, refRes] = await Promise.all([
        api.getEvents('limit=500'),
        api.getReference(),
      ]);
      setEvents(eventsRes.events || []);
      setEventGeo(refRes.EVENT_GEO || {});
      setAirports(refRes.AIRPORTS || {});
      setRegions(refRes.REGIONS || []);
    } catch (e) {
      console.error('Failed to load map data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000); // refresh every 15s
    return () => clearInterval(timer);
  }, [loadData]);

  // ── Resolve geo coordinates for an event ─────────────────────────
  const resolveGeo = useCallback((event) => {
    // 1. Check _geo (agent-pipeline events have this)
    if (event._geo && event._geo.lat != null && event._geo.lon != null) {
      return {
        lat: event._geo.lat,
        lon: event._geo.lon,
        radiusKm: event._geo.radiusKm || 100,
        airports: event._geo.airports || event._airports || [],
      };
    }
    // 2. Check EVENT_GEO reference (seeded events)
    const refGeo = eventGeo[event.id];
    if (refGeo && refGeo.lat != null) {
      return refGeo;
    }
    // 3. Derive from first affected airport
    const eventAirports = event._airports || [];
    if (eventAirports.length > 0) {
      const firstCode = eventAirports[0];
      const airport = airports[firstCode];
      if (airport) {
        return {
          lat: airport.lat,
          lon: airport.lon,
          radiusKm: 100,
          airports: eventAirports,
        };
      }
    }
    // 4. No geo available
    return null;
  }, [eventGeo, airports]);

  // ── Filtered events with geo ─────────────────────────────────────
  const geoEvents = events.filter(e => {
    if (cat !== 'All' && e.cat !== cat) return false;
    if (regionFilter !== 'All' && (e._region || 'remote') !== regionFilter) return false;
    const mode = e._dataModes?.mode;
    if (sourceFilter === 'agent' && mode !== 'real') return false;
    if (sourceFilter === 'mixed' && mode !== 'mixed') return false;
    if (sourceFilter === 'seeded' && mode !== 'mock' && e._source !== 'seeded') return false;
    return resolveGeo(e) !== null;
  });

  const sel = selected ? events.find(e => e.id === selected) : null;

  // ── Load OPS for selected event ──────────────────────────────────
  useEffect(() => {
    if (!sel) return;
    api.getOPS(sel.id).then(res => setOpsMap(prev => ({ ...prev, [sel.id]: res }))).catch(() => {});
  }, [sel?.id]);

  const ops = sel ? opsMap[sel.id] : null;

  // ── Popup card position: track selected marker's screen point ────
  useEffect(() => {
    if (!mapHandle || !sel) { setPopupPos(null); return; }
    const g = resolveGeo(sel);
    if (!g) { setPopupPos(null); return; }
    const update = () => {
      const p = mapHandle.project(g.lat, g.lon);
      setPopupPos({ x: p.x, y: p.y, below: p.y < 260 });
    };
    update();
    return mapHandle.onViewportChange(update);
  }, [mapHandle, sel, resolveGeo]);

  const mapProps = {
    geoEvents, resolveGeo, airports, selId: sel?.id,
    onSelect: setSelected,
    onReady: setMapHandle,
    onMapClick: () => setSelected(null),
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div ref={mapEl} style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {mapEngine === 'gl'
          ? <GLThreatMap {...mapProps} mapStyle={mapPrefs.style} projection={mapPrefs.proj} />
          : <LeafletThreatMap {...mapProps} loading={loading} />}
        <MapEngineToggle />
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg)', color: 'var(--mute)', ...MONO, fontSize: 12,
          }}>
            Loading live threat data...
          </div>
        )}
        {/* Filter controls — rendered in the app top bar via portal */}
        {topbarSlot && createPortal(
          <>
            <FilterSelect label="CAT" value={cat} onChange={setCat} options={CATS} />
            <FilterSelect
              label="REGION" value={regionFilter} onChange={setRegionFilter}
              options={[
                { value: 'All', label: 'All regions' },
                ...regions.map(r => ({ value: r.id, label: r.name })),
                { value: 'remote', label: 'Oceanic / Remote' },
              ]}
            />
            <FilterSelect
              label="SOURCE" value={sourceFilter} onChange={setSourceFilter}
              options={[
                { value: 'all', label: 'All sources' },
                { value: 'agent', label: 'Real' },
                { value: 'mixed', label: 'Mixed' },
                { value: 'seeded', label: 'Mock/Seeded' },
              ]}
            />
          </>,
          topbarSlot
        )}
        {/* Event count badge */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 1000, ...MONO, fontSize: 10, color: 'var(--mute)', background: 'var(--panel)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--line)' }}>
          {geoEvents.length} events with geo data · {events.length} total
        </div>

        {/* ── Threat popup card — anchored to the selected marker ── */}
        {sel && popupPos && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(popupPos.x, 175), (mapEl.current?.clientWidth || 1100) - 175),
              top: popupPos.y,
              transform: popupPos.below ? 'translate(-50%, 30px)' : 'translate(-50%, calc(-100% - 30px))',
              zIndex: 1500, width: 330,
              background: 'var(--panel)',
              border: `1px solid ${scoreColor(sel.score || 0)}`,
              borderRadius: 8,
              boxShadow: '0 14px 44px rgba(0,0,0,0.65)',
            }}
          >
            <div style={{ padding: '11px 13px 9px', borderTop: `3px solid ${scoreColor(sel.score || 0)}`, borderRadius: '8px 8px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ ...MONO, fontSize: 10, color: 'var(--cyan)' }}>
                  {sel.ref || sel.id} · {sel.cat} · Conf {confLabel(sel.conf || 2)}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--mute)', fontSize: 15, cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  title="Close"
                >×</button>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginTop: 6 }}>{sel.name}</div>
            </div>
            <div style={{ padding: '10px 13px 12px' }}>
              <div style={{
                fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5, marginBottom: 9,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {sel.summary}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ ...MONO, fontSize: 10, padding: '2px 6px', borderRadius: 3, background: scoreColor(sel.score || 0) + '20', color: scoreColor(sel.score || 0) }}>
                  EDPS {sel.score || 0}
                </span>
                <span style={{ ...MONO, fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--sunken)', color: 'var(--mute)' }}>
                  L{sel.esc || 1}
                </span>
                <span style={{ ...MONO, fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--sunken)', color: trajColor(sel.traj) }}>
                  {trajArrow(sel.traj)} {sel.traj || '—'}
                </span>
                <span style={{ ...MONO, fontSize: 10, padding: '2px 6px', borderRadius: 3, background: sel._dataModes?.mode === 'mixed' ? 'rgba(167,139,250,0.1)' : sel._dataModes?.mode === 'mock' ? 'rgba(245,166,35,0.1)' : sel._source === 'agent-pipeline' ? 'rgba(52,211,153,0.1)' : 'rgba(245,166,35,0.1)', color: sel._dataModes?.mode === 'mixed' ? '#A78BFA' : sel._dataModes?.mode === 'mock' ? '#F5A623' : sel._source === 'agent-pipeline' ? '#34D399' : '#F5A623' }}>
                  {sel._dataModes?.mode === 'mixed' ? 'MIXED' : sel._dataModes?.mode === 'mock' ? 'MOCK' : sel._source === 'agent-pipeline' ? 'REAL' : 'SEEDED'}
                </span>
              </div>
              {ops && ops.airports?.length === 0 && (
                <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em', padding: '7px 9px', border: '1px dashed var(--edge)', borderRadius: 4, marginBottom: 10 }}>
                  NO IMPACT TO AVIATION
                </div>
              )}
              {ops?.airports?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div className="kicker" style={{ marginBottom: 6, fontSize: 9 }}>AIRPORTS IN AREA OF EFFECT</div>
                  {ops.airports.slice(0, 4).map((a) => (
                    <div key={a.iata} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '2px 0' }}>
                      <span className="mono" style={{ color: 'var(--ink2)' }}>{a.iata}</span>
                      <span style={{ flex: 1, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                      <span className="mono" style={{ color: scoreColor(a.exposure || a.impactScore || 0) }}>{a.exposure || a.impactScore || '—'}</span>
                    </div>
                  ))}
                  {ops.airports.length > 4 && (
                    <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', marginTop: 2 }}>+{ops.airports.length - 4} more</div>
                  )}
                </div>
              )}
              <Link
                to={`/event/${sel.id}`}
                style={{ display: 'block', textAlign: 'center', padding: '9px 14px', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--teal)', borderRadius: 5, background: 'rgba(76,194,206,0.12)', color: 'var(--ink)', textDecoration: 'none' }}
              >
                Open threat assessment →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
