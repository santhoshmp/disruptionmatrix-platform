// SignalFeed.jsx — Live streaming list of recent signals from WebSocket + REST

import { useEffect, useState, useRef, useMemo } from 'react';
import { api, createStream } from '../../api/client.js';
import { MONO, scoreColor } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { SourceBadge, HELP } from './sourceMode.jsx';
import FilterSelect from '../FilterSelect.jsx';

const TYPE_COLORS = {
  weather: '#22D3EE',
  atc: '#A78BFA',
  flight: '#60A5FA',
  social: '#F472B6',
  industrial: '#F5A623',
  geopolitical: '#F0495A',
  infrastructure: '#34D399',
  regulatory: '#E8C34A',
  'impact-assessment': '#F59E2B',
};

const MAX_SIGNALS = 50;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'weather', label: 'Weather' },
  { value: 'atc', label: 'ATC / Airspace' },
  { value: 'flight', label: 'Flight Schedules' },
  { value: 'social', label: 'Social Reports' },
  { value: 'industrial', label: 'Industrial Action' },
  { value: 'geopolitical', label: 'Geopolitical' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'regulatory', label: 'Regulatory' },
];

const REGION_OPTIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'R1', label: 'R1 Indian Subcontinent' },
  { value: 'R2', label: 'R2 Europe' },
  { value: 'R3', label: 'R3 Gulf' },
  { value: 'R4', label: 'R4 Southeast Asia' },
  { value: 'R5', label: 'R5 N Atlantic / N America' },
  { value: 'R6', label: 'R6 East Asia' },
  { value: 'R7', label: 'R7 Africa' },
  { value: 'R8', label: 'R8 Oceania' },
  { value: 'R9', label: 'R9 South America' },
  { value: 'R10', label: 'R10 Russia / CIS' },
  { value: 'R11', label: 'R11 China' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'real', label: 'Real' },
  { value: 'mock', label: 'Mock' },
];

export default function SignalFeed() {
  const [signals, setSignals] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const streamRef = useRef(null);

  // Load initial signals
  useEffect(() => {
    async function loadInitial() {
      try {
        const data = await api.getSignals('limit=50');
        setSignals(data.signals || []);
      } catch (e) { /* server may be down */ }
    }
    loadInitial();
  }, []);

  // Subscribe to WebSocket stream for live updates
  useEffect(() => {
    streamRef.current = createStream((message) => {
      if (message.type === 'signal') {
        setSignals((prev) => [message.data, ...prev].slice(0, MAX_SIGNALS));
      }
    });
    return () => streamRef.current?.close();
  }, []);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (typeFilter !== 'all' && s.agentType !== typeFilter) return false;
      if (regionFilter !== 'all' && s.region !== regionFilter) return false;
      if (sourceFilter !== 'all' && (s.dataSourceMode || 'mock') !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.name} ${s.summary} ${s.agentId} ${s.agentType} ${(s.airports || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [signals, typeFilter, regionFilter, sourceFilter, search]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="kicker" style={{ margin: 0 }}>
          SIGNAL FEED · {filtered.length}/{signals.length} SHOWN
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoIcon title={HELP.signalFeed.title} sections={HELP.signalFeed.sections} placement="left" />
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', animation: 'dmPulse 2s ease-in-out infinite' }} />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '0 14px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <FilterSelect
          label="TYPE"
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_OPTIONS}
        />
        <FilterSelect
          label="REGION"
          value={regionFilter}
          onChange={setRegionFilter}
          options={REGION_OPTIONS}
        />
        <FilterSelect
          label="SOURCE"
          value={sourceFilter}
          onChange={setSourceFilter}
          options={SOURCE_OPTIONS}
        />
        <input
          type="text"
          placeholder="Search signals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...MONO, fontSize: 11, padding: '5px 10px', flex: 1, minWidth: 100,
            border: '1px solid var(--edge)', background: 'var(--panel2)',
            color: 'var(--ink)', borderRadius: 4, outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 10px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>
            {signals.length === 0 ? 'No signals yet. Waiting for agent polls...' : 'No signals match the current filters.'}
          </div>
        ) : (
          filtered.map((s) => {
            const color = TYPE_COLORS[s.agentType] || '#5B92C9';
            const avgHint = s.factorHints ? Object.values(s.factorHints).filter((v) => typeof v === 'number').reduce((a, b) => a + b, 0) / 8 : 0;
            const sevScore = Math.round(avgHint);

            return (
              <div
                key={s.signalId}
                style={{
                  border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4,
                  padding: '8px 10px', marginBottom: 5, borderLeft: `3px solid ${color}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...MONO, fontSize: 9, color, fontWeight: 700, textTransform: 'uppercase' }}>{s.agentType}</span>
                    <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>·</span>
                    <span style={{ ...MONO, fontSize: 9, color: 'var(--mute)' }}>{s.agentId?.replace(/^[a-z]+-/, '')}</span>
                    {s.region && (
                      <>
                        <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>·</span>
                        <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>{s.region}</span>
                      </>
                    )}
                    <SourceBadge mode={s.dataSourceMode || 'mock'} />
                  </div>
                  {sevScore > 0 && (
                    <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: scoreColor(sevScore) }}>{sevScore}</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.4, marginBottom: 4 }}>{s.summary?.slice(0, 120)}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {s.airports?.length > 0 && (
                    <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>
                      {s.airports.join(' · ')}
                    </span>
                  )}
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginLeft: 'auto' }}>
                    {new Date(s.detected).toLocaleTimeString('en-GB', { hour12: false })}Z
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
