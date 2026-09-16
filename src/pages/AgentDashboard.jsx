// AgentDashboard.jsx — Main Agent Dashboard page
// Tabs: Agents | Signals | Pipeline | Sources

import { useEffect, useState } from 'react';
import { api, createStream } from '../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW, scoreColor } from '../theme.js';
import AgentRegionMap from '../components/agents/AgentRegionMap.jsx';
import AgentGrid from '../components/agents/AgentGrid.jsx';
import AgentDetailPanel from '../components/agents/AgentDetailPanel.jsx';
import PipelineFlow from '../components/agents/PipelineFlow.jsx';
import SignalFeed from '../components/agents/SignalFeed.jsx';
import SourcesTab from '../components/agents/SourcesTab.jsx';

export default function AgentDashboard() {
  const [agents, setAgents] = useState([]);
  const [regions, setRegions] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [stats, setStats] = useState({ agents: 0, events: 0, signals: 0, ops: 0 });
  const [activeTab, setActiveTab] = useState('agents'); // 'agents' | 'signals' | 'pipeline' | 'sources'
  const [showMap, setShowMap] = useState(false);
  const [connected, setConnected] = useState(false);

  async function loadAll() {
    try {
      const [agentsRes, regionsRes, eventsRes, healthRes] = await Promise.all([
        api.getAgents(),
        api.getRegions(),
        api.getEvents('limit=20'),
        api.health(),
      ]);
      setAgents(agentsRes.agents || []);
      setRegions(regionsRes.regions || []);
      setEvents(eventsRes.events || []);
      setStats(healthRes.stats || {});
      if (agentsRes.agents?.length > 0 && !selectedAgent) {
        setSelectedAgent(agentsRes.agents[0].id);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stream = createStream((message) => {
      if (message.type === 'connected') {
        setConnected(true);
      } else if (message.type === 'signal') {
        setStats((prev) => ({ ...prev, signals: (prev.signals || 0) + 1 }));
      } else if (message.type === 'event' || message.type === 'event_updated' || message.type === 'ops') {
        loadAll();
      } else if (message.type === 'agent_status') {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === message.data.id
              ? { ...a, status: message.data.status, lastPoll: message.data.lastPoll }
              : a
          )
        );
      }
    });
    return () => stream.close();
  }, []);

  const tabs = [
    { id: 'agents', label: 'Agents' },
    { id: 'signals', label: 'Signals' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'sources', label: 'Sources' },
  ];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        flex: '0 0 auto', borderBottom: '1px solid var(--line)', background: 'var(--panel)',
        padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Agent Engine Dashboard</div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            AGENT FLEET · SIGNAL PIPELINE · DATA SOURCES
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <Stat label="AGENTS" value={stats.agents || agents.length} color={TEAL} />
            <Stat label="EVENTS" value={stats.events || events.length} color={scoreColor(70)} />
            <Stat label="SIGNALS" value={stats.signals || 0} color={HIGH} />
            <Stat label="OPS" value={stats.ops || 0} color={MOD} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: connected ? '#34D399' : 'var(--mute)',
              boxShadow: connected ? '0 0 6px #34D399' : 'none',
              animation: connected ? 'dmPulse 2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)' }}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        flex: '0 0 auto', borderBottom: '1px solid var(--line)', background: 'var(--sunken)',
        display: 'flex', padding: '0 22px', gap: 2,
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              ...MONO, fontSize: 12, padding: '8px 16px', cursor: 'pointer',
              border: 'none', borderBottom: activeTab === t.id ? `2px solid ${TEAL}` : '2px solid transparent',
              background: 'transparent', color: activeTab === t.id ? 'var(--ink)' : 'var(--mute)',
              fontWeight: activeTab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'agents' && (
          <>
            {/* Left: Agent grid */}
            <div style={{ flex: '0 0 420px', borderRight: '1px solid var(--line)', overflow: 'auto', background: 'var(--panel)' }}>
              <AgentGrid
                agents={agents}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
                onAgentTriggered={loadAll}
              />
            </div>
            {/* Right: Agent detail panel */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--panel)' }}>
              <div style={{
                flex: '0 0 auto', padding: '6px 14px', borderBottom: '1px solid var(--line)',
                background: 'var(--sunken)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
                  {selectedAgent ? `AGENT: ${selectedAgent}` : 'No agent selected'}
                </span>
                <button
                  onClick={() => setShowMap(!showMap)}
                  style={{
                    ...MONO, fontSize: 10, padding: '4px 10px', cursor: 'pointer',
                    border: `1px solid ${showMap ? TEAL : 'var(--edge)'}`,
                    background: showMap ? TEAL + '15' : 'var(--panel2)',
                    color: showMap ? TEAL : 'var(--mute)', borderRadius: 3, fontWeight: 600,
                    marginLeft: 'auto',
                  }}
                >
                  {showMap ? '▼ HIDE MAP' : '◀ SHOW MAP'}
                </button>
              </div>
              {showMap && (
                <div style={{ flex: '0 0 300px', minHeight: 0, position: 'relative', borderBottom: '1px solid var(--line)' }}>
                  <AgentRegionMap
                    agents={agents}
                    regions={regions}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                  />
                </div>
              )}
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <AgentDetailPanel agentId={selectedAgent} onTrigger={loadAll} />
              </div>
            </div>
          </>
        )}

        {activeTab === 'signals' && (
          <div style={{ flex: 1, background: 'var(--panel)', display: 'flex', flexDirection: 'column' }}>
            <SignalFeed />
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div style={{ flex: 1, background: 'var(--panel)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <PipelineFlow />
          </div>
        )}

        {activeTab === 'sources' && (
          <div style={{ flex: 1, background: 'var(--panel)', display: 'flex', flexDirection: 'column' }}>
            <SourcesTab />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...MONO, fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
