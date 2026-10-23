// AgentDetailPanel.jsx — Detailed view for a selected agent
// Shows: identity, runtime status, last run, data sources, signals/messages read, config

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW, scoreColor } from '../../theme.js';
import { SourceBadge, computeSourceMode, sourceModeSummary } from './sourceMode.jsx';

const TYPE_COLORS = {
  weather: '#22D3EE',
  atc: '#A78BFA',
  industrial: '#F5A623',
  geopolitical: '#F0495A',
  infrastructure: '#34D399',
  regulatory: '#E8C34A',
  'impact-assessment': '#F59E2B',
};

const STATUS_COLORS = {
  idle: 'var(--mute)',
  polling: '#F5A623',
  active: '#34D399',
  error: CRIT,
  paused: '#5B92C9',
};

export default function AgentDetailPanel({ agentId, onTrigger }) {
  const [agent, setAgent] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Load agent detail + runtime + signals
  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    async function load() {
      try {
        const [agentRes, runtimeRes] = await Promise.all([
          api.getAgent(agentId),
          api.getAgentsRuntime(),
        ]);
        setAgent(agentRes);
        const rt = runtimeRes.status?.find((s) => s.id === agentId);
        setRuntime(rt || null);

        // Load signals for this agent
        const sigRes = await api.getSignals(`agentId=${agentId}&limit=20`);
        setSignals(sigRes.signals || []);
      } catch (e) {
        console.error('Failed to load agent detail:', e);
      }
      setLoading(false);
    }
    load();
  }, [agentId]);

  async function handleTrigger() {
    if (!agentId) return;
    setTriggering(true);
    try {
      await api.triggerAgent(agentId);
      // Reload after trigger
      const [agentRes, runtimeRes] = await Promise.all([
        api.getAgent(agentId),
        api.getAgentsRuntime(),
      ]);
      setAgent(agentRes);
      const rt = runtimeRes.status?.find((s) => s.id === agentId);
      setRuntime(rt);
      const sigRes = await api.getSignals(`agentId=${agentId}&limit=20`);
      setSignals(sigRes.signals || []);
      onTrigger?.();
    } catch (e) { /* ignore */ }
    setTriggering(false);
  }

  if (!agentId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', ...MONO, fontSize: 12 }}>
        Select an agent to view details
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', ...MONO, fontSize: 12 }}>
        Loading agent details...
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', ...MONO, fontSize: 12 }}>
        Agent not found
      </div>
    );
  }

  const typeColor = TYPE_COLORS[agent.type] || TEAL;
  const statusColor = STATUS_COLORS[agent.status] || 'var(--mute)';
  const pollIntervalMin = runtime ? Math.round(runtime.pollInterval / 60000) : '?';
  const lastPollTime = runtime?.lastPollAt ? new Date(runtime.lastPollAt).toLocaleString('en-GB', { hour12: false }) : '—';
  const lastError = runtime?.lastError;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6, background: typeColor + '20',
            border: `1px solid ${typeColor}`, display: 'grid', placeItems: 'center',
            ...MONO, fontSize: 11, fontWeight: 700, color: typeColor,
          }}>
            {agent.type.slice(0, 3).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{agent.id}</div>
            <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
              {agent.type} · {agent.region} · {agent.subRegion}
            </div>
          </div>
          <SourceBadge mode={computeSourceMode(agent.config?.dataSources, agent.dataSourceMode) || 'mock'} />
          {agent.config?.dataSources && (
            <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginLeft: 4 }}>
              {sourceModeSummary(agent.config.dataSources)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            style={{
              ...MONO, fontSize: 11, padding: '6px 14px', cursor: triggering ? 'wait' : 'pointer',
              border: `1px solid ${typeColor}`, background: typeColor + '15', color: typeColor,
              borderRadius: 4, fontWeight: 600,
            }}
          >
            {triggering ? 'POLLING...' : 'TRIGGER POLL NOW'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: agent.status === 'active' ? `0 0 6px ${statusColor}` : 'none' }} />
            <span style={{ ...MONO, fontSize: 10, color: statusColor, fontWeight: 600, textTransform: 'uppercase' }}>{agent.status || 'idle'}</span>
          </div>
        </div>
      </div>

      {/* ── Mission ────────────────────────────────────────────── */}
      {agent.config?.mission && (
        <div style={{ marginBottom: 14, padding: '10px 12px', border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>MISSION</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.5 }}>{agent.config.mission}</div>
        </div>
      )}

      {/* ── Runtime stats ──────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>RUNTIME STATUS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <StatBox label="POLL COUNT" value={runtime?.pollCount ?? agent.signalCount ?? 0} color={TEAL} />
          <StatBox label="SIGNALS" value={agent.signalCount || 0} color={HIGH} />
          <StatBox label="INTERVAL" value={`${pollIntervalMin}m`} color={MOD} />
          <StatBox label="RUNNING" value={runtime?.isRunning ? 'YES' : 'NO'} color={runtime?.isRunning ? '#34D399' : 'var(--mute)'} />
        </div>
      </div>

      {/* ── Last run ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>LAST RUN</div>
        <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
          <Row label="Last poll" value={lastPollTime} />
          <Row
            label="Last poll result"
            value={runtime?.lastDurationMs != null
              ? `${runtime.lastSignalsGenerated ?? 0} signals in ${runtime.lastDurationMs}ms`
              : '—'}
            valueColor={lastError ? CRIT : runtime?.lastSignalsGenerated > 0 ? '#34D399' : 'var(--ink2)'}
          />
          <Row label="Last signal" value={runtime?.lastSignalAt ? new Date(runtime.lastSignalAt).toLocaleString('en-GB', { hour12: false }) : agent.lastSignalAt ? new Date(agent.lastSignalAt).toLocaleString('en-GB', { hour12: false }) : '—'} />
          {runtime?.lastSignalName && (
            <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--hover)' }}>
              <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', letterSpacing: '0.03em', marginBottom: 2 }}>LAST OUTPUT</div>
              <div style={{ fontSize: 11, color: 'var(--ink2)', lineHeight: 1.4 }}>{runtime.lastSignalName}</div>
            </div>
          )}
          <Row label="Total signals" value={runtime?.totalSignals ?? agent.signalCount ?? 0} />
          <Row label="Last error" value={lastError || 'None'} valueColor={lastError ? CRIT : '#34D399'} />
          <Row label="Priority" value={agent.priority} valueColor={agent.priority === 'critical' ? CRIT : agent.priority === 'high' ? HIGH : agent.priority === 'medium' ? MOD : LOW} />
        </div>
      </div>

      {/* ── Data sources ──────────────────────────────────────── */}
      {agent.config?.dataSources && agent.config.dataSources.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="kicker" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>DATA SOURCES · {agent.config.dataSources.length}</span>
            <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>
              {sourceModeSummary(agent.config.dataSources)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {agent.config.dataSources.map((src, i) => {
              const srcMode = src.mode || (agent.dataSourceMode === 'real' ? 'real' : 'mock');
              const modeColor = srcMode === 'real' ? '#34D399' : srcMode === 'mock' ? '#F5A623' : srcMode === 'planned' ? '#5B92C9' : 'var(--mute)';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  border: `1px solid ${srcMode === 'planned' ? 'var(--edge)' : modeColor + '40'}`,
                  background: srcMode === 'planned' ? 'var(--sunken)' : 'var(--panel2)',
                  borderRadius: 3,
                  opacity: srcMode === 'planned' ? 0.55 : 1,
                }}>
                  <div style={{
                    ...MONO, fontSize: 9, padding: '1px 5px', borderRadius: 2, fontWeight: 700,
                    border: `1px solid ${src.tier === 1 ? '#34D399' : src.tier === 2 ? HIGH : LOW}`,
                    color: src.tier === 1 ? '#34D399' : src.tier === 2 ? HIGH : LOW,
                  }}>
                    T{src.tier}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{src.name}</div>
                    {src.scope && <div style={{ ...MONO, fontSize: 9, color: 'var(--mute)' }}>scope: {src.scope}</div>}
                    {src.url && src.url !== 'N/A' && (
                      <div style={{ ...MONO, fontSize: 9, color: TEAL, marginTop: 1, wordBreak: 'break-all' }}>
                        {src.url}
                      </div>
                    )}
                  </div>
                  <span style={{
                    ...MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, fontWeight: 700,
                    border: `1px solid ${modeColor}`, color: modeColor,
                    background: srcMode === 'real' ? 'rgba(52, 211, 153, 0.08)' :
                               srcMode === 'mock' ? 'rgba(245, 166, 35, 0.08)' :
                               srcMode === 'planned' ? 'rgba(91, 146, 201, 0.08)' : 'transparent',
                  }}>
                    {srcMode.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Explanation of mixed mode */}
          {(() => {
            const mode = computeSourceMode(agent.config.dataSources, agent.dataSourceMode);
            if (mode === 'mixed') {
              const realCount = agent.config.dataSources.filter(s => s.mode === 'real').length;
              const mockCount = agent.config.dataSources.filter(s => s.mode === 'mock').length;
              const plannedCount = agent.config.dataSources.filter(s => s.mode === 'planned').length;
              return (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 3,
                  background: 'rgba(167, 139, 250, 0.06)', border: '1px solid rgba(167, 139, 250, 0.3)',
                  fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.5,
                }}>
                  <strong style={{ color: '#A78BFA' }}>MIXED MODE</strong> — This agent uses {realCount} real API source{realCount !== 1 ? 's' : ''} as primary input,
                  with {mockCount} mock fallback{mockCount !== 1 ? 's' : ''} when real APIs return no data{plannedCount > 0 ? `, and ${plannedCount} planned source${plannedCount !== 1 ? 's' : ''} not yet connected` : ''}.
                  Signals may be a mix of real and synthetic data.
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* ── Signals / Messages read ────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span className="kicker" style={{ margin: 0 }}>SIGNALS READ · {signals.length}</span>
          <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>latest 20</span>
        </div>
        {signals.length === 0 ? (
          <div style={{ padding: 12, border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel2)', ...MONO, fontSize: 11, color: 'var(--mute)', textAlign: 'center' }}>
            No signals generated yet. Click "TRIGGER POLL NOW" to collect data.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflow: 'auto' }}>
            {signals.map((s) => (
              <div key={s.signalId} style={{
                border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 3,
                padding: '8px 10px', borderLeft: `3px solid ${typeColor}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>
                    {new Date(s.detected).toLocaleTimeString('en-GB', { hour12: false })}Z
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.4, marginBottom: 4 }}>{s.summary}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {s.airports?.length > 0 && (
                    <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>
                      airports: {s.airports.join(', ')}
                    </span>
                  )}
                  {s.evidence?.length > 0 && (
                    <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>
                      evidence: {s.evidence[0].source}
                    </span>
                  )}
                </div>
                {s.evidence?.[0]?.excerpt && (
                  <div style={{
                    marginTop: 4, padding: '4px 8px', background: 'var(--sunken)', borderRadius: 2,
                    ...MONO, fontSize: 9, color: 'var(--mute)', lineHeight: 1.4,
                    borderLeft: '2px solid var(--edge)', whiteSpace: 'pre-wrap',
                  }}>
                    {s.evidence[0].excerpt.slice(0, 200)}
                    {s.evidence[0].excerpt.length > 200 ? '...' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Configuration ──────────────────────────────────────── */}
      {agent.config && (
        <div style={{ marginBottom: 14 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>CONFIGURATION</div>
          <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
            <Row label="Category" value={agent.config.category || agent.type} />
            <Row label="Poll interval" value={`${agent.config.pollIntervalMinutes || pollIntervalMin} minutes`} />
            {agent.config.factorHints && (
              <Row label="Factor hints" value={`${Object.keys(agent.config.factorHints).length} factors configured`} />
            )}
            {agent.config.domains && (
              <Row label="Domains" value={agent.config.domains.join(', ')} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 6px', border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel2)' }}>
      <div style={{ ...MONO, fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ ...MONO, fontSize: 8, color: 'var(--faint)', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Row({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--hover)' }}>
      <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)', letterSpacing: '0.03em' }}>{label}</span>
      <span style={{ ...MONO, fontSize: 11, fontWeight: 600, color: valueColor || 'var(--ink2)' }}>{value}</span>
    </div>
  );
}
