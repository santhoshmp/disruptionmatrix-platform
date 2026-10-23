import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DM from '../data/dm-data.json';
import { api } from '../api/client.js';
import { MONO, scoreColor, confLabel, trajColor, trajArrow, CRIT, HIGH, MOD, LOW, TEAL } from '../theme.js';
import InfoIcon from '../components/agents/InfoIcon.jsx';
import FilterSelect from '../components/FilterSelect.jsx';

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
  { id: 'agent', label: 'Real events' },
  { id: 'all', label: 'All sources' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'seeded', label: 'Mock/Seeded' },
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
  // Determine actual data provenance from signal-level modes
  const dataMode = event._dataModes?.mode || (isAgent ? 'real' : 'mock');
  const modeConfig = {
    real:  { color: '#34D399', label: 'REAL' },
    mock:  { color: '#F5A623', label: 'MOCK' },
    mixed: { color: '#A78BFA', label: 'MIXED' },
  };
  const mc = modeConfig[dataMode] || modeConfig.mock;

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
        border: `1px solid ${mc.color}`,
        color: mc.color,
        letterSpacing: '0.05em',
      }}>
        {mc.label}
      </span>
      {event._dataModes && event._dataModes.totalCount > 1 && (
        <span style={{ ...MONO, fontSize: 8, color: 'var(--faint)' }}>
          {event._dataModes.realCount}r {event._dataModes.mockCount}m
        </span>
      )}
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
  const [searchParams] = useSearchParams();
  const [cat, setCat] = useState(() => searchParams.get('cat') || 'All');
  const [minScore, setMinScore] = useState(() => {
    const s = searchParams.get('minScore');
    return s ? parseInt(s, 10) : 0;
  });
  const [sort, setSort] = useState('score');
  const [layout, setLayout] = useState('ranked');
  const [sourceFilter, setSourceFilter] = useState(() => {
    const s = searchParams.get('source');
    if (s === 'real') return 'agent';
    if (s === 'mock') return 'seeded';
    if (s === 'mixed') return 'mixed';
    return 'all';
  });
  const [regionFilter, setRegionFilter] = useState(() => searchParams.get('region') || 'All');
  const [regions, setRegions] = useState([]);
  const [realDataMode, setRealDataMode] = useState(false);
  const [realDataModeLoading, setRealDataModeLoading] = useState(false);
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
    // Load real data mode
    api.getRealDataMode().then(d => setRealDataMode(!!d.enabled)).catch(() => {});
    // Load region reference for the region filter
    api.getReference().then(d => setRegions(d.REGIONS || [])).catch(() => {});
  }, []);

  // Sync filters when URL params change (e.g., navigating from Overview)
  useEffect(() => {
    const catParam = searchParams.get('cat');
    const regionParam = searchParams.get('region');
    const sourceParam = searchParams.get('source');
    const minScoreParam = searchParams.get('minScore');
    if (catParam) setCat(catParam);
    if (regionParam) setRegionFilter(regionParam);
    if (minScoreParam) setMinScore(parseInt(minScoreParam, 10));
    if (sourceParam === 'real') setSourceFilter('agent');
    else if (sourceParam === 'mock') setSourceFilter('seeded');
    else if (sourceParam === 'mixed') setSourceFilter('mixed');
    else if (sourceParam === 'all') setSourceFilter('all');
  }, [searchParams]);

  // Toggle real data mode
  async function toggleRealDataMode() {
    setRealDataModeLoading(true);
    try {
      const res = await api.setRealDataMode(!realDataMode);
      setRealDataMode(!!res.enabled);
      // Reload events to reflect the change
      const eventsData = await api.getEvents('limit=500');
      if (eventsData.events) setEvents(eventsData.events);
    } catch (e) {
      console.error('Failed to toggle real data mode:', e);
    }
    setRealDataModeLoading(false);
  }

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

  // Filter events by actual data provenance (not just pipeline source)
  let filteredEvents = events;
  if (sourceFilter === 'agent') {
    filteredEvents = events.filter((e) => e._dataModes?.mode === 'real');
  } else if (sourceFilter === 'seeded') {
    filteredEvents = events.filter((e) => e._dataModes?.mode === 'mock' || e._source === 'seeded');
  } else if (sourceFilter === 'mixed') {
    filteredEvents = events.filter((e) => e._dataModes?.mode === 'mixed');
  }

  const rows = filteredEvents
    .filter((x) => (cat === 'All' || x.cat === cat)
      && (regionFilter === 'All' || (x._region || 'remote') === regionFilter)
      && x.score >= minScore)
    .sort((a, b) =>
      sort === 'score' ? b.score - a.score
        : sort === 'tti' ? (a.ttiMin || 360) - (b.ttiMin || 360)
        : (TRAJ_ORDER[a.traj] - TRAJ_ORDER[b.traj]) || b.score - a.score
    );

  const open = (id) => nav(`/event/${id}`);
  const laneColor = (i) => (i === 3 ? CRIT : i === 2 ? HIGH : i === 1 ? MOD : LOW);

  const agentCount = events.filter((e) => e._dataModes?.mode === 'real').length;
  const seededCount = events.filter((e) => e._dataModes?.mode === 'mock' || e._source === 'seeded').length;
  const mixedCount = events.filter((e) => e._dataModes?.mode === 'mixed').length;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
      {/* Main content area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            <InfoIcon
              title="VP Threshold"
              placement="left"
              sections={[
                { body: 'VP (Vice President) threshold means events at Escalation Level 4 — the highest escalation tier.' },
                {
                  title: 'Escalation Levels',
                  body: '',
                  list: [
                    'L1 — Watch: Monitoring, no operational action yet',
                    'L2 — Advisory: Inform stakeholders, assess exposure',
                    'L3 — Alert: Active disruption, begin mitigation',
                    'L4 — VP Threshold: Severe disruption requiring VP-level decision (ground stops, cancellations, reroutes)',
                  ],
                },
                { body: 'Events at L4 typically have EDPS scores of 80+ and are escalating. They require immediate executive attention.' },
              ]}
            />
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
              · {agentCount} real · {mixedCount} mixed · {seededCount} mock/seeded · {events.length} total · refreshes every 10s
            </span>
          )}
          <InfoIcon
            title="Data Source Status"
            placement="right"
            sections={[
              { body: 'This indicator shows where the threat events come from and how fresh they are.' },
              {
                title: 'Agent-Generated',
                body: 'Events created by the autonomous agent pipeline. Agents collect signals from real APIs (NOAA, FAA, NASA, USGS, GDELT, SafeAirspace) and mock fallbacks, correlate them, and score them through the 8-step pipeline. These events have live evidence trails showing the actual data source.',
              },
              {
                title: 'Seeded',
                body: 'Events from the original proof-of-concept demo dataset. These are synthetic scenario events used to demonstrate the platform before agents were connected. They have "Intelligence desk" as the evidence source.',
              },
              {
                title: 'Total',
                body: 'Combined count of agent-generated and seeded events currently in the event store.',
              },
              {
                title: 'Refresh',
                body: 'The Threat Board automatically polls the backend every 10 seconds for new events. You can also trigger the pipeline manually from the Agent Engine page.',
              },
            ]}
          />
        </div>

        {/* Real Data Mode toggle */}
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={toggleRealDataMode}
            disabled={realDataModeLoading}
            style={{
              ...MONO, fontSize: 10, padding: '4px 12px', cursor: 'pointer', fontWeight: 700,
              border: `1px solid ${realDataMode ? '#34D399' : 'var(--edge)'}`,
              background: realDataMode ? 'rgba(52,211,153,0.15)' : 'var(--panel2)',
              color: realDataMode ? '#34D399' : 'var(--mute)',
              borderRadius: 3, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: realDataMode ? '#34D399' : 'var(--mute)',
              boxShadow: realDataMode ? '0 0 6px #34D399' : 'none',
            }} />
            {realDataMode ? 'REAL DATA MODE' : 'REAL DATA MODE'}
          </button>
          <InfoIcon
            title="Real Data Mode"
            placement="right"
            sections={[
              { body: 'When enabled, mock connectors are disabled and only real API signals produce events. Existing mock events remain in the store but are hidden from the default view.' },
              {
                title: 'How it works',
                list: [
                  'Agents check realOnlyMode before falling back to mock connectors',
                  'Pipeline filters out signals with dataSourceMode=mock',
                  'Existing mock events stay in the store but are excluded from the "Real events" view',
                  'Toggle is persisted to the database — survives server restarts',
                ],
              },
              { title: 'Use case', body: 'Switch to Real Data Mode to see only threats backed by actual API data (NOAA, FAA, NASA, USGS, GDELT, SafeAirspace). Useful for production monitoring where synthetic data is not wanted.' },
            ]}
          />
          {realDataMode && (
            <span style={{ ...MONO, fontSize: 10, color: '#34D399' }}>
              Only real API signals produce events
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <FilterSelect label="CAT" value={cat} onChange={setCat} options={CATS} />
          <FilterSelect
            label="REGION" value={regionFilter} onChange={setRegionFilter}
            options={[
              { value: 'All', label: 'All regions' },
              ...regions.map((r) => ({ value: r.id, label: r.name })),
              { value: 'remote', label: 'Oceanic / Remote' },
            ]}
          />
          <FilterSelect
            label="SOURCE" value={sourceFilter} onChange={setSourceFilter}
            options={SOURCES.map((s) => ({
              value: s.id,
              label: `${s.label} (${
                s.id === 'agent' ? agentCount
                : s.id === 'mixed' ? mixedCount
                : s.id === 'seeded' ? seededCount
                : events.length
              })`,
            }))}
          />
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <FilterSelect label="SORT" value={sort} onChange={setSort} options={SORTS.map((s) => ({ value: s.id, label: s.label }))} />
            <InfoIcon
              title="Sort Options"
              placement="right"
              sections={[
                { body: 'Choose how events are ordered in the list.' },
                {
                  title: 'Options',
                  body: '',
                  list: [
                    'EDPS — Sort by Event Disruption Potential Score (highest first)',
                    'Time to impact — Sort by urgency (soonest impact first)',
                    'Trajectory — Sort by trend: Escalating → Stable → Improving',
                  ],
                },
              ]}
            />
          </span>
          <FilterSelect label="LAYOUT" value={layout} onChange={setLayout} options={LAYOUTS.map((l) => ({ value: l.id, label: l.label }))} />
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
          <span className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            MIN EDPS {minScore}
            <InfoIcon
              title="EDPS Score"
              placement="right"
              sections={[
                { body: 'EDPS (Event Disruption Potential Score) is a 0–100 score that ranks events by their potential to disrupt aviation operations.' },
                {
                  title: '8 Factors',
                  body: 'EDPS = Σ(factor.value × weight) across 8 weighted factors:',
                  list: [
                    'Probability of occurrence (weight 0.20)',
                    'Severity if realised (weight 0.18)',
                    'Geographic reach (weight 0.14)',
                    'Expected duration (weight 0.12)',
                    'Time to impact (weight 0.12)',
                    'Escalation rate (weight 0.10)',
                    'Source credibility (weight 0.08)',
                    'Prediction confidence (weight 0.06)',
                  ],
                },
                {
                  title: 'Score Bands',
                  body: '',
                  list: [
                    '80–100: Critical — VP-level attention required',
                    '60–79: High — Active disruption management',
                    '40–59: Moderate — Monitoring and preparation',
                    '0–39: Low — Awareness only',
                  ],
                },
                { body: 'Use the slider to filter out low-scoring events and focus on the most disruptive threats.' },
              ]}
            />
          </span>
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
    </div>
  );
}
