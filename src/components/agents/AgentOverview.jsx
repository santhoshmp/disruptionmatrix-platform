// AgentOverview.jsx — At-a-glance dashboard for the Agent Engine module.
// Shows fleet status, type breakdown, regional coverage, signal throughput,
// and action notifications before the user drills into detail tabs.

import { useEffect, useState, useMemo, useRef } from 'react';
import { api, createStream } from '../../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW, OK, CYAN, scoreColor } from '../../theme.js';

// Phase 8: use DB-backed agent types via API, fall back to hardcoded
const FALLBACK_TYPE_META = {
  weather: { icon: 'Wx', color: '#22D3EE', label: 'Weather' },
  atc: { icon: 'ATC', color: '#A78BFA', label: 'ATC / Airspace' },
  flight: { icon: 'FLT', color: '#60A5FA', label: 'Flight Schedules' },
  social: { icon: 'SOC', color: '#F472B6', label: 'Social Reports' },
  industrial: { icon: 'IND', color: '#F5A623', label: 'Industrial Action' },
  geopolitical: { icon: 'GEO', color: '#F0495A', label: 'Geopolitical' },
  infrastructure: { icon: 'INF', color: '#34D399', label: 'Infrastructure' },
  regulatory: { icon: 'REG', color: '#E8C34A', label: 'Regulatory' },
};

// Phase 8: use DB-backed regions via API, fall back to hardcoded
const FALLBACK_REGION_NAMES = {
  R1: 'Indian Subcontinent', R2: 'Europe', R3: 'Gulf',
  R4: 'Southeast Asia', R5: 'N Atlantic / N America',
  R6: 'East Asia', R7: 'Africa', R8: 'Oceania', R9: 'South America',
  R10: 'Russia / CIS', R11: 'China',
};

const STATUS_COLORS = {
  idle: 'var(--mute)', polling: HIGH, active: OK, error: CRIT,
};

export default function AgentOverview({ onNavigateTab }) {
  const [agents, setAgents] = useState([]);
  const [runtime, setRuntime] = useState([]);
  const [stats, setStats] = useState({});
  const [signals, setSignals] = useState([]);
  const [realDataMode, setRealDataMode] = useState(false);
  const [connected, setConnected] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [regionNames, setRegionNames] = useState(FALLBACK_REGION_NAMES);
  const [typeMeta, setTypeMeta] = useState(FALLBACK_TYPE_META);
  const signalCountRef = useRef(0);

  async function loadAll() {
    try {
      const [agentsRes, runtimeRes, healthRes, signalsRes, modeRes, refRes, typeRes] = await Promise.all([
        api.getAgents(),
        api.getAgentsRuntime(),
        api.health(),
        api.getSignals('limit=100'),
        api.getRealDataMode().catch(() => ({ enabled: false })),
        api.getReference().catch(() => null),
        api.getMasterAgentTypes().catch(() => null),
      ]);
      setAgents(agentsRes.agents || []);
      setRuntime(runtimeRes.status || []);
      setStats(healthRes.stats || {});
      setSignals(signalsRes.signals || []);
      setRealDataMode(!!modeRes.enabled);
      // Phase 8: use DB-backed region names and agent type metadata
      if (refRes?.REGIONS) {
        const names = {};
        for (const r of refRes.REGIONS) names[r.id] = r.name;
        setRegionNames(names);
      }
      if (typeRes?.agentTypes) {
        const meta = {};
        for (const t of typeRes.agentTypes) {
          meta[t.type] = { icon: t.icon, color: t.color, label: t.label };
        }
        setTypeMeta(meta);
      }
    } catch (e) {
      console.error('AgentOverview load failed:', e);
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket for live activity feed
  useEffect(() => {
    const stream = createStream((message) => {
      if (message.type === 'connected') {
        setConnected(true);
      } else if (message.type === 'signal') {
        signalCountRef.current++;
        setRecentActivity((prev) => [
          { kind: 'signal', time: new Date().toISOString(), data: message.data },
          ...prev,
        ].slice(0, 20));
      } else if (message.type === 'agent_poll') {
        // Poll outcome: agent ran and produced N signals (or errored).
        // This is the meaningful unit for "what are agents doing".
        setRecentActivity((prev) => [
          { kind: 'poll', time: new Date().toISOString(), data: message.data },
          ...prev,
        ].slice(0, 20));
      } else if (message.type === 'event' || message.type === 'event_updated') {
        setRecentActivity((prev) => [
          { kind: 'event', time: new Date().toISOString(), data: message.data },
          ...prev,
        ].slice(0, 20));
      }
    });
    return () => stream.close();
  }, []);

  // ── Compute fleet stats ─────────────────────────────────────────────
  const fleet = useMemo(() => {
    const byType = {};
    const byRegion = {};
    const byStatus = { active: 0, idle: 0, polling: 0, error: 0 };
    let totalPolls = 0;

    agents.forEach((a) => {
      const rt = runtime.find((r) => r.id === a.id) || {};
      const status = rt.status || (rt.isRunning ? 'active' : 'idle');

      if (!byType[a.type]) byType[a.type] = { count: 0, active: 0, errors: 0, polls: 0, lastPoll: null };
      byType[a.type].count++;
      if (status === 'active' || status === 'polling') byType[a.type].active++;
      if (status === 'error' || rt.lastError) byType[a.type].errors++;
      byType[a.type].polls += rt.pollCount || 0;
      if (rt.lastPollAt && (!byType[a.type].lastPoll || rt.lastPollAt > byType[a.type].lastPoll)) {
        byType[a.type].lastPoll = rt.lastPollAt;
      }

      if (!byRegion[a.region]) byRegion[a.region] = { count: 0, active: 0, types: new Set() };
      byRegion[a.region].count++;
      if (status === 'active' || status === 'polling') byRegion[a.region].active++;
      byRegion[a.region].types.add(a.type);

      if (byStatus[status] !== undefined) byStatus[status]++;
      totalPolls += rt.pollCount || 0;
    });

    return { byType, byRegion, byStatus, totalPolls, total: agents.length };
  }, [agents, runtime]);

  // ── Signal stats ────────────────────────────────────────────────────
  const signalStats = useMemo(() => {
    const byType = {};
    let total = 0;
    signals.forEach((s) => {
      total++;
      const t = s.agentType || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    });
    // Recent signals (last 5 min)
    const now = Date.now();
    const recent = signals.filter((s) => {
      if (!s.detected) return false;
      const dt = new Date(s.detected).getTime();
      return now - dt < 5 * 60 * 1000;
    }).length;
    return { byType, total, recent };
  }, [signals]);

  // ── Action notifications ────────────────────────────────────────────
  const notifications = useMemo(() => {
    const notifs = [];

    // Agent errors
    runtime.forEach((rt) => {
      if (rt.status === 'error' || rt.lastError) {
        notifs.push({
          type: 'AGENT ERROR',
          color: CRIT,
          title: rt.id,
          agentId: rt.id,
          detail: (rt.lastError || 'Unknown error').slice(0, 80),
          action: 'VIEW AGENTS',
          actionType: 'agents',
        });
      }
    });

    // Stalled agents — no poll for longer than 1.5× their own interval
    // (industrial polls every 30min, regulatory every 60min; a flat 15min
    // threshold flags them all as stalled while on schedule)
    const now = Date.now();
    runtime.forEach((rt) => {
      if (!rt.lastPollAt) return;
      const dt = now - new Date(rt.lastPollAt).getTime();
      const stallAfter = Math.max(15 * 60 * 1000, (rt.pollInterval || 0) * 1.5);
      if (dt > stallAfter && rt.isRunning) {
        notifs.push({
          type: 'STALLED',
          color: HIGH,
          title: rt.id,
          agentId: rt.id,
          detail: `Last poll ${Math.round(dt / 60000)} min ago (polls every ${Math.round((rt.pollInterval || 0) / 60000)} min) — may be stuck`,
          action: 'VIEW AGENTS',
          actionType: 'agents',
        });
      }
    });

    // Real data mode status
    if (realDataMode) {
      const missingCreds = [];
      if (!import.meta.env.VITE_OPENSKY_CLIENT_ID) missingCreds.push('OpenSky');
      if (!import.meta.env.VITE_AVIATIONSTACK_KEY) missingCreds.push('AviationStack');
      if (!import.meta.env.VITE_REDDIT_CLIENT_ID) missingCreds.push('Reddit');
      if (missingCreds.length > 0) {
        notifs.push({
          type: 'CONFIG',
          color: MOD,
          title: 'Real data mode enabled but connectors missing credentials',
          detail: `${missingCreds.join(', ')} will fall back to mock data`,
          action: 'VIEW SOURCES',
          actionType: 'sources',
        });
      }
    }

    // Signal store near capacity
    if (stats.signals >= 4900) {
      notifs.push({
        type: 'CAPACITY',
        color: HIGH,
        title: 'Signal store near capacity',
        detail: `${stats.signals}/5000 signals — oldest signals will be dropped`,
        action: 'VIEW SIGNALS',
        actionType: 'signals',
      });
    }

    return notifs;
  }, [runtime, realDataMode, stats]);

  // Dismissed notifications (session-only) — keyed by type+agent so the same
  // alert can be acknowledged once but a NEW error on the same agent resurfaces.
  const [dismissed, setDismissed] = useState(new Set());
  const [repolling, setRepolling] = useState(null);
  const notifKey = (n) => `${n.type}|${n.title}|${n.detail}`;
  const visibleNotifs = notifications.filter(n => !dismissed.has(notifKey(n)));

  function handleNotifAction(notif) {
    if (notif.actionType) onNavigateTab?.(notif.actionType);
  }

  async function handleRepoll(notif) {
    if (!notif.agentId) return;
    setRepolling(notif.agentId);
    try {
      await api.triggerAgent(notif.agentId);
      // Poll finished — drop the notification immediately; if the agent
      // errors again the next runtime refresh brings it back.
      setDismissed(prev => new Set([...prev, notifKey(notif)]));
      loadAll();
    } catch (e) { /* next refresh will show the error */ }
    setRepolling(null);
  }

  const maxRegionAgents = Math.max(...Object.values(fleet.byRegion).map((r) => r.count), 1);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--sunken)' }}>
      {/* Action Notifications */}
      {visibleNotifs.length > 0 && (
        <div style={{ margin: '10px 22px 0', border: '1px solid var(--edge)', borderLeft: `4px solid ${CRIT}`, background: 'var(--panel)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: CRIT + '08', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--edge)' }}>
            <span style={{ color: CRIT, fontSize: 14, fontWeight: 700 }}>⚠</span>
            <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: CRIT, letterSpacing: '0.05em' }}>ACTION REQUIRED</span>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>{visibleNotifs.length} notification{visibleNotifs.length !== 1 ? 's' : ''}</span>
            {dismissed.size > 0 && (
              <button
                onClick={() => setDismissed(new Set())}
                style={{ ...MONO, fontSize: 8.5, marginLeft: 'auto', padding: '2px 8px', cursor: 'pointer', border: '1px solid var(--edge)', background: 'transparent', color: 'var(--faint)', borderRadius: 3 }}
              >
                SHOW {dismissed.size} DISMISSED
              </button>
            )}
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {visibleNotifs.map((n, i) => (
            <div key={i} style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--edge)', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ ...MONO, fontSize: 8.5, fontWeight: 700, padding: '2px 6px', borderRadius: 2, background: n.color + '20', color: n.color, textTransform: 'uppercase', flexShrink: 0 }}>{n.type}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                  <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.detail}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {n.agentId && (
                  <button
                    onClick={() => handleRepoll(n)}
                    disabled={repolling === n.agentId}
                    style={{ ...MONO, fontSize: 9, padding: '4px 10px', cursor: repolling === n.agentId ? 'wait' : 'pointer', border: `1px solid ${TEAL}55`, background: TEAL + '15', color: TEAL, borderRadius: 3, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {repolling === n.agentId ? 'POLLING…' : '⟳ POLL NOW'}
                  </button>
                )}
                <button onClick={() => handleNotifAction(n)} style={{ ...MONO, fontSize: 9, padding: '4px 10px', cursor: 'pointer', border: `1px solid ${n.color}55`, background: n.color + '15', color: n.color, borderRadius: 3, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {n.action} →
                </button>
                <button
                  title="Dismiss"
                  onClick={() => setDismissed(prev => new Set([...prev, notifKey(n)]))}
                  style={{ ...MONO, fontSize: 10, padding: '4px 7px', cursor: 'pointer', border: '1px solid var(--edge)', background: 'transparent', color: 'var(--faint)', borderRadius: 3 }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Fleet Summary + Signal Throughput */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 22px 0' }}>
        {/* Fleet Summary */}
        <div style={{ flex: '1 1 50%', border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4 }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            FLEET STATUS
          </div>
          <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
            <StatTile label="TOTAL AGENTS" value={fleet.total} color={TEAL} />
            <StatTile label="ACTIVE" value={fleet.byStatus.active + fleet.byStatus.polling} color={OK} />
            <StatTile label="IDLE" value={fleet.byStatus.idle} color="var(--mute)" />
            <StatTile label="ERRORS" value={fleet.byStatus.error} color={fleet.byStatus.error > 0 ? CRIT : OK} />
            <StatTile label="TOTAL POLLS" value={fleet.totalPolls} color={CYAN} />
            <StatTile label="REGIONS" value={Object.keys(fleet.byRegion).length} color={TEAL} />
          </div>
          {/* Status bar */}
          <div style={{ padding: '0 14px 10px' }}>
            <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(fleet.byStatus.active + fleet.byStatus.polling) / fleet.total * 100}%`, background: OK }} />
              <div style={{ width: `${fleet.byStatus.idle / fleet.total * 100}%`, background: 'var(--edge)' }} />
              <div style={{ width: `${fleet.byStatus.error / fleet.total * 100}%`, background: CRIT }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, ...MONO, fontSize: 9, color: 'var(--mute)' }}>
              <span><span style={{ color: OK }}>●</span> Active {fleet.byStatus.active + fleet.byStatus.polling}</span>
              <span><span style={{ color: 'var(--edge)' }}>●</span> Idle {fleet.byStatus.idle}</span>
              {fleet.byStatus.error > 0 && <span><span style={{ color: CRIT }}>●</span> Error {fleet.byStatus.error}</span>}
            </div>
          </div>
        </div>

        {/* Signal Throughput */}
        <div style={{ flex: '1 1 50%', border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4 }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            SIGNAL THROUGHPUT
          </div>
          <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
            <StatTile label="TOTAL SIGNALS" value={stats.signals || 0} color={HIGH} />
            <StatTile label="LAST 5 MIN" value={signalStats.recent} color={signalStats.recent > 0 ? OK : 'var(--mute)'} />
            <StatTile label="EVENTS" value={stats.events || 0} color={scoreColor(70)} />
            <StatTile label="OPS RECORDS" value={stats.ops || 0} color={MOD} />
            <StatTile label="DATA MODE" value={realDataMode ? 'REAL' : 'MOCK'} color={realDataMode ? OK : LOW} />
            <StatTile label="WS STREAM" value={connected ? 'LIVE' : 'OFF'} color={connected ? OK : 'var(--mute)'} />
          </div>
          {/* Signal by type mini bars */}
          <div style={{ padding: '0 14px 10px' }}>
            <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 4 }}>SIGNALS BY TYPE</div>
            <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 3, overflow: 'hidden' }}>
              {Object.entries(signalStats.byType).map(([type, count]) => {
                const meta = typeMeta[type] || { color: '#5B92C9' };
                const pct = signalStats.total > 0 ? (count / signalStats.total) * 100 : 0;
                return <div key={type} title={`${meta.label || type}: ${count}`} style={{ width: `${pct}%`, background: meta.color, minWidth: count > 0 ? 2 : 0 }} />;
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, ...MONO, fontSize: 8.5, color: 'var(--mute)' }}>
              {Object.entries(signalStats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const meta = typeMeta[type] || { color: '#5B92C9', label: type };
                return <span key={type}><span style={{ color: meta.color }}>●</span> {meta.label} {count}</span>;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Type Breakdown */}
      <div style={{ padding: '10px 22px 0' }}>
        <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em', marginBottom: 6 }}>
          AGENT TYPES
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(fleet.byType).sort((a, b) => b[1].count - a[1].count).map(([type, info]) => {
            const meta = typeMeta[type] || { icon: '?', color: TEAL, label: type };
            const activePct = info.count > 0 ? (info.active / info.count) * 100 : 0;
            return (
              <div
                key={type}
                onClick={() => onNavigateTab?.('agents')}
                style={{
                  flex: '1 1 140px', border: '1px solid var(--line)', background: 'var(--panel)',
                  borderRadius: 4, padding: '10px 12px', cursor: 'pointer', borderTop: `3px solid ${meta.color}`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = meta.color + '55'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: meta.color + '20', border: `1px solid ${meta.color}`, display: 'grid', placeItems: 'center', ...MONO, fontSize: 8, fontWeight: 700, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{meta.label}</div>
                  <div style={{ marginLeft: 'auto', ...MONO, fontSize: 14, fontWeight: 800, color: meta.color }}>{info.count}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--sunken)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${activePct}%`, background: OK, borderRadius: 2 }} />
                  </div>
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--mute)' }}>{info.active}/{info.count}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, ...MONO, fontSize: 9, color: 'var(--mute)' }}>
                  <span>{info.polls} polls</span>
                  {info.errors > 0 && <span style={{ color: CRIT, fontWeight: 600 }}>{info.errors} err</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Regional Coverage + Live Activity */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 22px 0' }}>
        {/* Regional Coverage */}
        <div style={{ flex: '1 1 45%', border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4 }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            REGIONAL COVERAGE
          </div>
          <div style={{ padding: '8px 14px' }}>
            {Object.entries(fleet.byRegion).sort((a, b) => b[1].count - a[1].count).map(([region, info]) => (
              <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0' }}>
                <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', width: 160, flexShrink: 0 }}>
                  {region} {regionNames[region] || region}
                </div>
                <div style={{ flex: 1, height: 14, background: 'var(--sunken)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${(info.count / maxRegionAgents) * 100}%`, background: TEAL, borderRadius: 3 }} />
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', ...MONO, fontSize: 9, fontWeight: 700, color: 'var(--ink)' }}>
                    {info.count} agents · {info.types.size} types
                  </span>
                </div>
                <div style={{ ...MONO, fontSize: 9, color: info.active > 0 ? OK : 'var(--mute)', width: 50, textAlign: 'right', flexShrink: 0 }}>
                  {info.active} active
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div style={{ flex: '1 1 55%', border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em' }}>LIVE ACTIVITY</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? OK : 'var(--mute)', animation: connected ? 'dmPulse 2s ease-in-out infinite' : 'none' }} />
              <span style={{ ...MONO, fontSize: 9, color: 'var(--mute)' }}>{connected ? 'STREAMING' : 'OFFLINE'}</span>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 10px 10px', maxHeight: 260 }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>
                Waiting for live events...
              </div>
            ) : (
              recentActivity.map((item, i) => <ActivityRow key={i} item={item} typeMeta={typeMeta} />)
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}

// Renders one live-activity row: poll outcome, signal, or event result.
function ActivityRow({ item, typeMeta }) {
  const d = item.data || {};
  let icon, iconColor, title, sub;

  if (item.kind === 'poll') {
    // Agent poll outcome — the "what the agent just did" line
    icon = 'POLL';
    iconColor = d.error ? CRIT : d.signals > 0 ? OK : 'var(--mute)';
    title = d.id || 'agent';
    sub = d.error
      ? `poll failed: ${String(d.error).slice(0, 60)}`
      : `poll ${d.durationMs != null ? `${d.durationMs}ms` : ''} → ${d.signals} signal${d.signals === 1 ? '' : 's'}`;
  } else if (item.kind === 'signal') {
    icon = 'SIG';
    const meta = typeMeta[d.agentType] || { color: TEAL };
    iconColor = meta.color;
    title = d.name || 'signal';
    sub = `${d.agentType || ''}${d.agentId ? ' · ' + d.agentId : ''}${d.airports?.length ? ' · ' + d.airports.join(' ') : ''}`;
  } else {
    // event created / updated by the pipeline
    icon = 'EVT';
    iconColor = d.score != null ? scoreColor(d.score) : HIGH;
    title = `→ ${d.title || d.name || 'event'}`;
    sub = `pipeline · ${d.score != null ? `L${d.score}` : 'updated'}${d.category ? ' · ' + d.category : ''}`;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderBottom: '1px solid var(--edge)' }}>
      <span style={{ ...MONO, fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2, background: iconColor + '20', color: iconColor, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ ...MONO, fontSize: 9, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
      <span style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)', flexShrink: 0 }}>
        {new Date(item.time).toLocaleTimeString('en-GB', { hour12: false })}Z
      </span>
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ ...MONO, fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
