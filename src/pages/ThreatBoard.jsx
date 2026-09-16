import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DM from '../data/dm-data.json';
import { api } from '../api/client.js';
import { MONO, scoreColor, confLabel, trajColor, trajArrow, CRIT, HIGH, MOD, LOW, TEAL } from '../theme.js';

const CATS = ['All', 'Weather', 'ATC / Airspace', 'Industrial action', 'Geopolitical', 'Infrastructure', 'Regulatory'];
const SORTS = [
  { id: 'score', label: 'EDPS' },
  { id: 'tti', label: 'Time to impact' },
  { id: 'traj', label: 'Trajectory' }
];
const LAYOUTS = [
  { id: 'ranked', label: 'Ranked list' },
  { id: 'lanes', label: 'Escalation lanes' }
];
const SOURCES = [
  { id: 'all', label: 'All sources' },
  { id: 'agent', label: 'Agent output' },
  { id: 'seeded', label: 'Seeded demo' },
];
const TRAJ_ORDER = { Escalating: 0, Stable: 1, Improving: 2 };

function ScoreBox({ score, size = 17 }) {
  const c = scoreColor(score);
  return (
    <div style={{ ...MONO, fontWeight: 600, fontSize: size, color: c, border: `1px solid ${c}`, background: c + '1A', padding: '6px 9px', textAlign: 'center', alignSelf: 'center' }}>
      {score}
    </div>
  );
}

function DomainDots({ event }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {DM.DOMAINS.map((name) => {
        const hit = event.domains?.find((d) => d.name === name);
        const v = hit ? hit.v : 0;
        const c = v >= 70 ? CRIT : v >= 45 ? HIGH : v >= 25 ? 'var(--dim)' : 'var(--line2)';
        return <div key={name} title={`${name} · ${v || 'not implicated'}`} style={{ width: 11, height: 11, background: c }} />;
      })}
    </div>
  );
}

function SourceTag({ event }) {
  const isAgent = event._source === 'agent-pipeline';
  // Extract the evidence source name (e.g., "FAA TFR", "USGS", "NASA EONET")
  const evidenceSource = event.evidence?.[0]?.source || '';
  // Shorten common source names for display
  const shortSource = evidenceSource
    .replace('FAA Airport Status Web Service (ASWS)', 'FAA ASWS')
    .replace('FAA TFR Feed (tfr.faa.gov)', 'FAA TFR')
    .replace('NASA EONET', 'NASA EONET')
    .replace('USGS Earthquake Hazards Program', 'USGS')
    .replace('NOAA/NWS Aviation Weather Center (METAR)', 'NOAA METAR')
    .replace('NOAA/NWS Aviation Weather Center (SIGMET)', 'NOAA SIGMET')
    .replace('Open-Meteo (ECMWF/GFS model data)', 'Open-Meteo')
    .replace('SafeAirspace.net (OPSGROUP)', 'SafeAirspace')
    .replace('GDELT / ', 'GDELT: ')
    .replace('GDELT Project (Global Event Database)', 'GDELT')
    .slice(0, 22);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      <span style={{
        ...MONO, fontSize: 8.5, padding: '2px 6px', borderRadius: 2, fontWeight: 700,
        border: `1px solid ${isAgent ? '#34D399' : 'var(--edge)'}`,
        color: isAgent ? '#34D399' : 'var(--mute)',
        letterSpacing: '0.05em',
      }}>
        {isAgent ? 'AGENT' : 'SEEDED'}
      </span>
      {shortSource && (
        <span style={{
          ...MONO, fontSize: 8, color: 'var(--faint)', maxWidth: 88,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={evidenceSource}>
          {shortSource}
        </span>
      )}
    </div>
  );
}

function EventRow({ e, onOpen }) {
  return (
    <div
      onClick={() => onOpen(e.id)}
      className="hoverable"
      style={{
        display: 'grid',
        gridTemplateColumns: '64px minmax(200px, 2.4fr) minmax(80px, 0.7fr) minmax(110px, 1fr) 100px 88px 128px 118px',
        gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--hover)', alignItems: 'center'
      }}
    >
      <ScoreBox score={e.score} />
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 3 }}>{e.name}</div>
        <div style={{ ...MONO, fontSize: 11, color: 'var(--mute2)' }}>{e.ref} · {e.where}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink3)' }}>{e.cat}</div>
      <DomainDots event={e} />
      <SourceTag event={e} />
      <div style={{ ...MONO, fontSize: 13, color: 'var(--ink2)' }}>{e.tti}</div>
      <div style={{ color: trajColor(e.traj), fontWeight: 600, ...MONO, fontSize: 12 }}>
        {trajArrow(e.traj)} {e.traj}
      </div>
      <div style={{ ...MONO, fontSize: 12, padding: '6px 9px', textAlign: 'center', border: `1px solid ${e.esc >= 4 ? CRIT : e.esc === 3 ? HIGH : 'var(--edge)'}`, color: e.esc >= 3 ? (e.esc >= 4 ? CRIT : HIGH) : 'var(--mute)' }}>
        L{e.esc} {DM.ESC[e.esc - 1].badge}
      </div>
    </div>
  );
}

export default function ThreatBoard() {
  const nav = useNavigate();
  const [cat, setCat] = useState('All');
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState('score');
  const [layout, setLayout] = useState('ranked');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [impactMode, setImpactMode] = useState('mock');
  const [modeSwitching, setModeSwitching] = useState(false);
  const [dataSource, setDataSource] = useState('loading');

  // Load impact mode from backend
  useEffect(() => {
    async function loadMode() {
      try {
        const res = await fetch('http://localhost:3001/api/ops/mode');
        const data = await res.json();
        setImpactMode(data.mode || 'mock');
      } catch (e) { /* backend may be down */ }
    }
    loadMode();
  }, []);

  // Load events from backend API (live agent output)
  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await api.getEvents('limit=500');
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          setDataSource('live');
        } else {
          // Fall back to static data if backend returns no events
          setEvents(DM.EVENTS);
          setDataSource('static');
        }
      } catch (e) {
        // Backend down — fall back to static demo data
        setEvents(DM.EVENTS);
        setDataSource('static');
      }
      setLoading(false);
    }
    loadEvents();
    const timer = setInterval(loadEvents, 10000);
    return () => clearInterval(timer);
  }, [impactMode]);

  // Toggle impact mode (mock vs real airlines)
  async function handleModeToggle() {
    const newMode = impactMode === 'mock' ? 'real' : 'mock';
    setModeSwitching(true);
    try {
      const res = await fetch('http://localhost:3001/api/ops/mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json();
      setImpactMode(data.mode || newMode);
      // Reload events to get updated OPS
      const eventsData = await api.getEvents('limit=500');
      if (eventsData.events) setEvents(eventsData.events);
    } catch (e) { /* ignore */ }
    setModeSwitching(false);
  }

  // Filter events by source
  let filteredEvents = events;
  if (sourceFilter === 'agent') {
    filteredEvents = events.filter((e) => e._source === 'agent-pipeline');
  } else if (sourceFilter === 'seeded') {
    filteredEvents = events.filter((e) => e._source !== 'agent-pipeline');
  }

  const rows = filteredEvents
    .filter((x) => (cat === 'All' || x.cat === cat) && x.score >= minScore)
    .sort((a, b) =>
      sort === 'score' ? b.score - a.score
        : sort === 'tti' ? (a.ttiMin || 360) - (b.ttiMin || 360)
        : (TRAJ_ORDER[a.traj] - TRAJ_ORDER[b.traj]) || b.score - a.score
    );

  const open = (id) => nav(`/event/${id}`);
  const laneColor = (i) => (i === 3 ? CRIT : i === 2 ? HIGH : i === 1 ? MOD : LOW);

  const agentCount = events.filter((e) => e._source === 'agent-pipeline').length;
  const seededCount = events.filter((e) => e._source !== 'agent-pipeline').length;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 0 auto', padding: '16px 26px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Active external threat board</div>
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Correlated public-source events ranked by disruption potential</div>

          {/* Impact mode toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)', letterSpacing: '0.05em' }}>IMPACT TO:</span>
            <button
              onClick={handleModeToggle}
              disabled={modeSwitching}
              style={{
                ...MONO, fontSize: 11, padding: '6px 14px', cursor: modeSwitching ? 'wait' : 'pointer',
                border: `1px solid ${impactMode === 'real' ? '#34D399' : 'var(--edge)'}`,
                background: impactMode === 'real' ? '#34D39915' : 'var(--panel2)',
                color: impactMode === 'real' ? '#34D399' : 'var(--mute)',
                borderRadius: 3, fontWeight: 600,
              }}
            >
              {modeSwitching ? 'SWITCHING...' : impactMode === 'real' ? '● REAL AIRLINES' : '○ MOCK AIRLINES'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', border: '1px solid var(--edge)', background: 'var(--panel2)' }}>
            <div className="pulse" style={{ width: 7, height: 7, background: '#F04A52' }} />
            <span style={{ ...MONO, fontSize: 12, color: 'var(--ink2)' }}>
              {events.filter((e) => e.esc >= 4).length} events at VP threshold
            </span>
          </div>
        </div>

        {/* Data source indicator */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dataSource === 'live' ? '#34D399' : dataSource === 'static' ? 'var(--mute)' : TEAL,
            boxShadow: dataSource === 'live' ? '0 0 6px #34D399' : 'none',
            animation: dataSource === 'live' ? 'dmPulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ ...MONO, fontSize: 11, color: dataSource === 'live' ? '#34D399' : 'var(--mute)', fontWeight: 600 }}>
            {dataSource === 'live'
              ? `LIVE FROM AGENT PIPELINE`
              : dataSource === 'static'
              ? `STATIC DEMO DATA (backend offline)`
              : `LOADING...`
            }
          </span>
          {dataSource === 'live' && (
            <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)' }}>
              · {agentCount} agent-generated · {seededCount} seeded · {events.length} total · refreshes every 10s
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {CATS.map((c) => (
            <button key={c} className={`pill${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">SORT</span>
          {SORTS.map((s) => (
            <button key={s.id} className={`pill${sort === s.id ? ' on' : ''}`} onClick={() => setSort(s.id)}>{s.label}</button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">LAYOUT</span>
          {LAYOUTS.map((l) => (
            <button key={l.id} className={`pill${layout === l.id ? ' on' : ''}`} onClick={() => setLayout(l.id)}>{l.label}</button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">SOURCE</span>
          {SOURCES.map((s) => (
            <button
              key={s.id}
              className={`pill${sourceFilter === s.id ? ' on' : ''}`}
              onClick={() => setSourceFilter(s.id)}
              style={sourceFilter === s.id && s.id === 'agent' ? { borderColor: '#34D399', color: '#34D399' } : {}}
            >
              {s.label}{s.id === 'agent' && agentCount > 0 ? ` (${agentCount})` : ''}
            </button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">MIN EDPS {minScore}</span>
          <input type="range" min="0" max="90" step="5" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: layout === 'lanes' ? '18px 26px' : 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 13 }}>
            Loading events from agent pipeline...
          </div>
        ) : layout === 'ranked' ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '64px minmax(200px, 2.4fr) minmax(80px, 0.7fr) minmax(110px, 1fr) 100px 88px 128px 118px',
                gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1
              }}
            >
              {['EDPS', 'EVENT', 'CATEGORY', 'DOMAINS', 'SRC', 'IMPACT', 'TRAJECTORY', 'ESCALATION'].map((h) => (
                <div key={h} className="kicker">{h}</div>
              ))}
            </div>
            {rows.map((e) => <EventRow key={e.id} e={e} onOpen={open} />)}
            {rows.length === 0 && <div style={{ padding: 30, color: 'var(--mute)' }}>No events match the current filters.</div>}
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
            {DM.ESC.map((L, i) => {
              const list = rows.filter((x) => x.esc === i + 1);
              return (
                <div key={L.tier}>
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, background: laneColor(i) }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{L.tier}</span>
                    <span style={{ ...MONO, fontSize: 11, color: 'var(--mute2)' }}>{list.length}</span>
                  </div>
                  {list.map((e) => (
                    <div key={e.id} onClick={() => open(e.id)} className="hoverable" style={{ marginBottom: 10, padding: 12, border: '1px solid var(--line)', borderLeft: `3px solid ${laneColor(i)}`, background: 'var(--panel2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <ScoreBox score={e.score} size={14} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{e.name}</span>
                        <SourceTag event={e} />
                      </div>
                      <div style={{ ...MONO, fontSize: 11, color: 'var(--mute2)' }}>{e.cat} · {e.tti}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
