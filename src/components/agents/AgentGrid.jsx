// AgentGrid.jsx — Grid of agent cards with status + trigger buttons + filters

import { useState, useMemo } from 'react';
import { api } from '../../api/client.js';
import { MONO, CRIT, HIGH, MOD, LOW, TEAL } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { SourceBadge, HELP, computeSourceMode } from './sourceMode.jsx';
import FilterSelect from '../FilterSelect.jsx';

const TYPE_ICONS = {
  weather: 'Wx',
  atc: 'ATC',
  flight: 'FLT',
  social: 'SOC',
  industrial: 'IND',
  geopolitical: 'GEO',
  infrastructure: 'INF',
  regulatory: 'REG',
  'impact-assessment': 'IMP',
};

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
  { value: 'impact-assessment', label: 'Impact Assessment' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'polling', label: 'Polling' },
  { value: 'error', label: 'Error' },
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

export default function AgentGrid({ agents, selectedAgent, onSelectAgent, onAgentTriggered }) {
  const [triggering, setTriggering] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    if (!agents || agents.length === 0) return [];
    return agents.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (regionFilter !== 'all' && a.region !== regionFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${a.id} ${a.region} ${a.subRegion} ${a.type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [agents, typeFilter, regionFilter, statusFilter, search]);

  if (!agents || agents.length === 0) {
    return <div style={{ padding: 20, color: 'var(--mute)', ...MONO, fontSize: 12 }}>Loading agents...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span className="kicker" style={{ margin: 0 }}>
          AGENT FLEET · {filtered.length}/{agents.length} SHOWN
        </span>
        <InfoIcon title={HELP.agentGrid.title} sections={HELP.agentGrid.sections} placement="left" />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
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
          label="STATUS"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...MONO, fontSize: 11, padding: '5px 10px', flex: 1, minWidth: 100,
            border: '1px solid var(--edge)', background: 'var(--panel2)',
            color: 'var(--ink)', borderRadius: 4, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
        {filtered.map((a) => {
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
                  {a.lastSignalAt && (
                    <span
                      title={`Last signal: ${new Date(a.lastSignalAt).toLocaleString('en-GB', { hour12: false })}Z`}
                      style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)' }}
                    >
                      · {new Date(a.lastSignalAt).toLocaleTimeString('en-GB', { hour12: false })}Z
                    </span>
                  )}
                  <SourceBadge mode={computeSourceMode(a.config?.dataSources, a.dataSourceMode) || 'mock'} />
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
      {filtered.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>
          No agents match the current filters.
        </div>
      )}
    </div>
  );
}
