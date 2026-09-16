// SignalFeed.jsx — Live streaming list of recent signals from WebSocket + REST

import { useEffect, useState, useRef } from 'react';
import { api, createStream } from '../../api/client.js';
import { MONO, scoreColor } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { SourceBadge, HELP } from './sourceMode.jsx';

const TYPE_COLORS = {
  weather: '#22D3EE',
  atc: '#A78BFA',
  industrial: '#F5A623',
  geopolitical: '#F0495A',
  infrastructure: '#34D399',
  regulatory: '#E8C34A',
  'impact-assessment': '#F59E2B',
};

const MAX_SIGNALS = 50;

export default function SignalFeed() {
  const [signals, setSignals] = useState([]);
  const [filter, setFilter] = useState('all');
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

  const filtered = filter === 'all' ? signals : signals.filter((s) => s.agentType === filter);
  const agentTypes = ['all', 'weather', 'atc', 'industrial', 'geopolitical', 'infrastructure', 'regulatory'];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="kicker" style={{ margin: 0 }}>SIGNAL FEED · LIVE</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InfoIcon title={HELP.signalFeed.title} sections={HELP.signalFeed.sections} placement="left" />
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', animation: 'dmPulse 2s ease-in-out infinite' }} />
        </div>
      </div>
      <div style={{ padding: '0 14px 6px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {agentTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              ...MONO, fontSize: 9.5, padding: '3px 8px', cursor: 'pointer',
              border: `1px solid ${filter === t ? 'var(--line2)' : 'var(--edge)'}`,
              background: filter === t ? 'var(--panel2)' : 'transparent',
              color: filter === t ? 'var(--ink2)' : 'var(--mute)', borderRadius: 3,
              textTransform: 'uppercase',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 10px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>
            No signals yet. Waiting for agent polls...
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
