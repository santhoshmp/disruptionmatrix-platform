// AgentGrid.jsx — Grid of 29 agent cards with status + trigger buttons

import { useState } from 'react';
import { api } from '../../api/client.js';
import { MONO, CRIT, HIGH, MOD, LOW, TEAL } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { SourceBadge, HELP } from './sourceMode.jsx';

const TYPE_ICONS = {
  weather: 'Wx',
  atc: 'ATC',
  industrial: 'IND',
  geopolitical: 'GEO',
  infrastructure: 'INF',
  regulatory: 'REG',
  'impact-assessment': 'IMP',
};

const TYPE_COLORS = {
  weather: '#22D3EE',
  atc: '#A78BFA',
  industrial: '#F5A623',
  geopolitical: '#F0495A',
  infrastructure: '#34D399',
  regulatory: '#E8C34A',
  'impact-assessment': '#F59E2B',
};

const PRIORITY_COLORS = {
  critical: CRIT,
  high: HIGH,
  medium: MOD,
  low: LOW,
  standard: LOW,
};

const STATUS_COLORS = {
  idle: 'var(--mute)',
  polling: '#F5A623',
  active: '#34D399',
  error: CRIT,
};

export default function AgentGrid({ agents, selectedAgent, onSelectAgent, onAgentTriggered }) {
  const [triggering, setTriggering] = useState(null);

  async function handleTrigger(id) {
    setTriggering(id);
    try {
      await api.triggerAgent(id);
      onAgentTriggered?.();
    } catch (e) {
      console.error('Trigger failed:', e);
    }
    setTriggering(null);
  }

  if (!agents || agents.length === 0) {
    return <div style={{ padding: 20, color: 'var(--mute)', ...MONO, fontSize: 12 }}>Loading agents...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span className="kicker" style={{ margin: 0 }}>AGENT FLEET · {agents.length} INSTANCES</span>
        <InfoIcon title={HELP.agentGrid.title} sections={HELP.agentGrid.sections} placement="left" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
        {agents.map((a) => {
          const color = TYPE_COLORS[a.type] || TEAL;
          const prioColor = PRIORITY_COLORS[a.priority] || LOW;
          const statusColor = STATUS_COLORS[a.status] || 'var(--mute)';
          const isSelected = selectedAgent === a.id;
          const isTriggering = triggering === a.id;

          return (
            <div
              key={a.id}
              onClick={() => onSelectAgent?.(a.id)}
              style={{
                border: `1px solid ${isSelected ? color : 'var(--edge)'}`,
                background: isSelected ? color + '10' : 'var(--panel2)',
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 4,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 4, background: color + '20',
                    border: `1px solid ${color}`, display: 'grid', placeItems: 'center',
                    ...MONO, fontSize: 9, fontWeight: 700, color,
                  }}>
                    {TYPE_ICONS[a.type] || '??'}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.1 }}>{a.id.replace(/^[a-z]+-/, '')}</div>
                    <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>{a.region} · {a.subRegion}</div>
                  </div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, boxShadow: a.status === 'active' ? `0 0 6px ${statusColor}` : 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ ...MONO, fontSize: 9, color: prioColor, textTransform: 'uppercase', fontWeight: 600 }}>{a.priority}</span>
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>·</span>
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--mute)' }}>{a.signalCount || 0} sig</span>
                  <SourceBadge mode={a.dataSourceMode || 'mock'} />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleTrigger(a.id); }}
                  disabled={isTriggering}
                  style={{
                    ...MONO, fontSize: 9, padding: '3px 8px', cursor: isTriggering ? 'wait' : 'pointer',
                    border: '1px solid var(--edge)', background: 'var(--panel)', color: isTriggering ? 'var(--mute)' : color,
                    borderRadius: 3,
                  }}
                >
                  {isTriggering ? '...' : 'POLL'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
