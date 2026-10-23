// ThreatOverview.jsx — At-a-glance dashboard: top 5 threats, action notifications,
// category breakdown, regional spread, and summary stats.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { MONO, CRIT, HIGH, MOD, LOW, OK, TEAL, CYAN, scoreColor, confLabel } from '../theme.js';

// Phase 8: use DB-backed categories/regions via API, fall back to hardcoded
const FALLBACK_CATEGORY_COLORS = {
  'Weather': '#22D3EE',
  'ATC / Airspace': '#A78BFA',
  'Infrastructure': '#34D399',
  'Industrial action': '#F5A623',
  'Geopolitical': '#F0495A',
  'Regulatory': '#E8C34A',
};

const FALLBACK_CATEGORY_ICONS = {
  'Weather': 'Wx',
  'ATC / Airspace': 'ATC',
  'Infrastructure': 'INF',
  'Industrial action': 'IND',
  'Geopolitical': 'GEO',
  'Regulatory': 'REG',
};

const FALLBACK_REGION_NAMES = {
  R1: 'Indian Subcontinent', R2: 'Europe', R3: 'Gulf',
  R4: 'Southeast Asia', R5: 'N Atlantic / N America',
  R6: 'East Asia', R7: 'Africa', R8: 'Oceania', R9: 'South America',
  remote: 'Oceanic / Remote',
};

const ESC_COLORS = { 4: CRIT, 3: HIGH, 2: MOD, 1: LOW };
const ESC_LABELS = { 4: 'CRITICAL', 3: 'HIGH', 2: 'MODERATE', 1: 'LOW' };

export default function ThreatOverview() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [profiling, setProfiling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [regionNames, setRegionNames] = useState(FALLBACK_REGION_NAMES);
  const [categoryColors, setCategoryColors] = useState(FALLBACK_CATEGORY_COLORS);
  const [categoryIcons, setCategoryIcons] = useState(FALLBACK_CATEGORY_ICONS);

  const loadAll = useCallback(async () => {
    try {
      const [eventsRes, agentsRes, profRes, refRes, catRes] = await Promise.all([
        api.getEvents('limit=500'),
        api.getAgentsRuntime(),
        api.getProfilingStatus().catch(() => null),
        api.getReference().catch(() => null),
        api.getCategories().catch(() => null),
      ]);
      setEvents(eventsRes.events || []);
      setAgents(agentsRes.status || []);
      setProfiling(profRes);
      // Phase 8: use DB-backed region names and category colors/icons
      if (refRes?.REGIONS) {
        const names = {};
        for (const r of refRes.REGIONS) names[r.id] = r.name;
        names.remote = 'Oceanic / Remote';
        setRegionNames(names);
      }
      if (catRes?.categories) {
        const colors = {};
        const icons = {};
        for (const c of catRes.categories) {
          if (c.color) colors[c.name] = c.color;
          if (c.icon) icons[c.name] = c.icon;
        }
        setCategoryColors(colors);
        setCategoryIcons(icons);
      }
    } catch (e) {
      console.error('Failed to load overview data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, [loadAll]);

  // ── Compute stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!events.length) return null;
    const scores = events.map(e => e.score || 0);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const escCounts = { 4: 0, 3: 0, 2: 0, 1: 0 };
    events.forEach(e => { if (escCounts[e.esc] !== undefined) escCounts[e.esc]++; });
    const modes = { real: 0, mixed: 0, mock: 0 };
    events.forEach(e => { const m = e._dataModes?.mode || 'mock'; if (modes[m] !== undefined) modes[m]++; });
    const regions = new Set();
    const airports = new Set();
    events.forEach(e => {
      if (e._region) regions.add(e._region);
      (e._airports || []).forEach(a => airports.add(a));
    });
    const nameCounts = {};
    events.forEach(e => { nameCounts[e.name] = (nameCounts[e.name] || 0) + 1; });
    const duplicateGroups = Object.entries(nameCounts).filter(([, c]) => c > 1).length;
    return {
      total: events.length,
      avgScore,
      escCounts,
      modes,
      regionsCovered: regions.size,
      airportsAffected: airports.size,
      duplicateGroups,
    };
  }, [events]);

  // ── Top 5 threats ───────────────────────────────────────────────────
  const top5 = useMemo(() => {
    return [...events].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
  }, [events]);

  // ── Category breakdown ─────────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const cats = {};
    events.forEach(e => {
      const c = e.cat || 'Unknown';
      if (!cats[c]) cats[c] = { name: c, count: 0, scores: [], esc4: 0, esc3: 0, top: null };
      cats[c].count++;
      cats[c].scores.push(e.score || 0);
      if (e.esc === 4) cats[c].esc4++;
      if (e.esc === 3) cats[c].esc3++;
      if (!cats[c].top || (e.score || 0) > (cats[c].top.score || 0)) cats[c].top = e;
    });
    return Object.values(cats).sort((a, b) => b.count - a.count);
  }, [events]);

  // ── Regional spread ─────────────────────────────────────────────────
  const regionStats = useMemo(() => {
    const regs = {};
    events.forEach(e => {
      const r = e._region || 'remote';
      if (!regs[r]) regs[r] = { id: r, count: 0, topScore: 0 };
      regs[r].count++;
      if ((e.score || 0) > regs[r].topScore) regs[r].topScore = e.score || 0;
    });
    return Object.values(regs).sort((a, b) => b.count - a.count);
  }, [events]);

  // ── Action notifications ────────────────────────────────────────────
  const notifications = useMemo(() => {
    if (!events.length) return [];
    const notifs = [];

    // Critical threats (esc 4)
    const critical = events.filter(e => e.esc === 4);
    critical.forEach(e => {
      notifs.push({
        id: `crit-${e.id}`,
        type: 'CRITICAL',
        color: CRIT,
        title: e.name || 'Unnamed threat',
        detail: `Score ${e.score} · Escalation 4 · ${(e._airports || []).join(' ')}`,
        action: 'VIEW',
        eventId: e.id,
      });
    });

    // OPS gaps — high-score events missing OPS
    const opsGaps = events.filter(e => (e.score || 0) > 60 && !e._hasOps);
    if (opsGaps.length > 0) {
      notifs.push({
        id: 'ops-gap',
        type: 'OPS GAP',
        color: HIGH,
        title: `${opsGaps.length} high-score events missing operational impact data`,
        detail: 'Run impact assessment to compute airline exposure',
        action: 'COMPUTE OPS',
        actionType: 'computeOps',
      });
    }

    // Duplicate events
    const nameCounts = {};
    events.forEach(e => { nameCounts[e.name] = (nameCounts[e.name] || 0) + 1; });
    const dupCount = Object.values(nameCounts).filter(c => c > 1).length;
    if (dupCount > 0) {
      notifs.push({
        id: 'duplicates',
        type: 'DUPLICATE',
        color: MOD,
        title: `${dupCount} duplicate event groups detected`,
        detail: 'Run merge to consolidate duplicate threats',
        action: 'MERGE',
        actionType: 'merge',
      });
    }

    // Low confidence + high score
    const lowConf = events.filter(e => (e.score || 0) > 70 && (e.conf || 0) <= 3);
    lowConf.forEach(e => {
      notifs.push({
        id: `lowconf-${e.id}`,
        type: 'REVIEW',
        color: LOW,
        title: e.name || 'Unnamed threat',
        detail: `Score ${e.score} but confidence ${confLabel(e.conf)} — needs review`,
        action: 'VIEW',
        eventId: e.id,
      });
    });

    // Agent errors
    const agentErrors = agents.filter(a => a.status === 'error');
    agentErrors.slice(0, 3).forEach(a => {
      notifs.push({
        id: `agent-err-${a.id}`,
        type: 'AGENT ERROR',
        color: CRIT,
        title: a.id,
        detail: (a.lastError || 'Unknown error').slice(0, 80),
        action: 'VIEW AGENTS',
        actionType: 'agents',
      });
    });

    // Profiling queue
    if (profiling?.stats) {
      const queued = profiling.stats.queued || 0;
      const running = profiling.stats.running || 0;
      const failed = profiling.stats.failed || 0;
      if (queued > 0 || running > 0) {
        notifs.push({
          id: 'profiling-active',
          type: 'PROFILING',
          color: CYAN,
          title: `Profiling: ${running} running, ${queued} queued`,
          detail: 'Threat profiling in progress',
          action: 'VIEW PROFILING',
          actionType: 'profiling',
        });
      }
      if (failed > 0) {
        notifs.push({
          id: 'profiling-failed',
          type: 'PROFILING',
          color: HIGH,
          title: `${failed} profiling jobs failed`,
          detail: 'Review failed profiling attempts',
          action: 'VIEW PROFILING',
          actionType: 'profiling',
        });
      }
    }

    return notifs;
  }, [events, agents, profiling]);

  // ── Actions ────────────────────────────────────────────────────────
  async function handleNotifAction(notif) {
    if (notif.eventId) {
      navigate(`/event/${notif.eventId}`);
      return;
    }
    if (notif.actionType === 'merge') {
      setActionLoading('merge');
      try {
        await api.mergeDuplicates();
        await loadAll();
      } catch (e) { console.error('Merge failed:', e); }
      setActionLoading(null);
      return;
    }
    if (notif.actionType === 'computeOps') {
      setActionLoading('computeOps');
      try {
        await api.computeAllOPS();
        await loadAll();
      } catch (e) { console.error('OPS compute failed:', e); }
      setActionLoading(null);
      return;
    }
    if (notif.actionType === 'agents') { navigate('/agents'); return; }
    if (notif.actionType === 'profiling') { navigate('/profiling'); return; }
  }

  if (loading) {
    return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--mute)', ...MONO, fontSize: 13 }}>Loading overview...</div>;
  }

  const maxRegionCount = regionStats.length ? regionStats[0].count : 1;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--sunken)' }}>
      {/* Header */}
      <div style={{ padding: '14px 22px 10px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Threat Overview</div>
        <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em', marginTop: 2 }}>
          {stats ? `${stats.total} ACTIVE THREATS · ${stats.regionsCovered} REGIONS · ${categoryStats.length} CATEGORIES · AVG SCORE ${stats.avgScore}` : 'LOADING...'}
        </div>
      </div>

      {/* Action Notifications */}
      {notifications.length > 0 && !notifDismissed && (
        <div style={{
          margin: '10px 22px 0', border: '1px solid var(--edge)', borderLeft: `4px solid ${CRIT}`,
          background: 'var(--panel)', borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 14px', background: CRIT + '08', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--edge)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: CRIT, fontSize: 14, fontWeight: 700 }}>⚠</span>
              <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: CRIT, letterSpacing: '0.05em' }}>
                ACTION REQUIRED
              </span>
              <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
                {notifications.length} NOTIFICATION{notifications.length !== 1 ? 'S' : ''}
              </span>
            </div>
            <button
              onClick={() => setNotifDismissed(true)}
              style={{ ...MONO, fontSize: 10, padding: '3px 8px', cursor: 'pointer',
                border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--mute)', borderRadius: 3 }}
            >
              DISMISS
            </button>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto' }}>
            {notifications.map((n) => (
              <div key={n.id} style={{
                padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--edge)', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{
                    ...MONO, fontSize: 8.5, fontWeight: 700, padding: '2px 6px', borderRadius: 2,
                    background: n.color + '20', color: n.color, textTransform: 'uppercase', flexShrink: 0,
                  }}>
                    {n.type}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.title}
                    </div>
                    <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.detail}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleNotifAction(n)}
                  disabled={actionLoading === n.actionType}
                  style={{
                    ...MONO, fontSize: 9, padding: '4px 10px', cursor: actionLoading === n.actionType ? 'wait' : 'pointer',
                    border: `1px solid ${n.color}55`, background: n.color + '15', color: n.color,
                    borderRadius: 3, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  {actionLoading === n.actionType ? '...' : n.action + ' →'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {notifications.length > 0 && notifDismissed && (
        <div
          onClick={() => setNotifDismissed(false)}
          style={{
            margin: '10px 22px 0', padding: '6px 14px', border: '1px solid var(--edge)',
            borderLeft: `4px solid ${CRIT}`, background: 'var(--panel)', borderRadius: 4,
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          }}
        >
          <span style={{ color: CRIT, fontSize: 13, fontWeight: 700 }}>⚠</span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
            {notifications.length} ALERT{notifications.length !== 1 ? 'S' : ''} — click to expand
          </span>
        </div>
      )}

      {/* Top 5 + Summary Stats */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 22px 0' }}>
        {/* Top 5 Threats */}
        <div style={{ flex: '0 0 55%', border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4 }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            TOP 5 THREATS BY EDPS
          </div>
          <div style={{ padding: '6px 10px' }}>
            {top5.map((e, i) => {
              const color = scoreColor(e.score || 0);
              const catColor = categoryColors[e.cat] || TEAL;
              return (
                <div
                  key={e.id}
                  onClick={() => navigate(`/event/${e.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderBottom: i < 4 ? '1px solid var(--edge)' : 'none', cursor: 'pointer',
                    borderRadius: 3,
                  }}
                  onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--panel2)'}
                  onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                >
                  {/* Rank badge */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: color + '20', border: `1px solid ${color}`,
                    display: 'grid', placeItems: 'center',
                    ...MONO, fontSize: 12, fontWeight: 800, color,
                  }}>
                    {i + 1}
                  </div>
                  {/* Threat info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.name || 'Unnamed'}
                    </div>
                    <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ color: catColor }}>{e.cat}</span>
                      <span>·</span>
                      <span>{e._region || '?'}</span>
                      <span>·</span>
                      <span>{(e._airports || []).slice(0, 3).join(' ') || '—'}</span>
                      {(e._airports || []).length > 3 && <span>+{(e._airports || []).length - 3}</span>}
                    </div>
                  </div>
                  {/* Score + bar */}
                  <div style={{ flexShrink: 0, width: 100 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 3 }}>
                      <span style={{ ...MONO, fontSize: 14, fontWeight: 800, color }}>{e.score || 0}</span>
                      {/* Escalation dots */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1, 2, 3, 4].map(n => (
                          <div key={n} style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: n <= (e.esc || 0) ? ESC_COLORS[e.esc] : 'var(--edge)',
                          }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--sunken)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${e.score || 0}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ flex: 1, border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4 }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            SUMMARY STATS
          </div>
          <div style={{ padding: '8px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <StatTile label="TOTAL THREATS" value={stats?.total || 0} color="var(--ink)" onClick={() => navigate('/board')} />
            <StatTile label="AVG SCORE" value={stats?.avgScore || 0} color={scoreColor(stats?.avgScore || 0)} />
            <StatTile label="CRITICAL (esc 4)" value={stats?.escCounts[4] || 0} color={CRIT} onClick={() => navigate('/board?minScore=80')} />
            <StatTile label="HIGH (esc 3)" value={stats?.escCounts[3] || 0} color={HIGH} onClick={() => navigate('/board?minScore=65')} />
            <StatTile label="MODERATE (esc 2)" value={stats?.escCounts[2] || 0} color={MOD} />
            <StatTile label="LOW (esc 1)" value={stats?.escCounts[1] || 0} color={LOW} />
            <StatTile label="REAL EVENTS" value={stats?.modes.real || 0} color={OK} onClick={() => navigate('/board?source=real')} />
            <StatTile label="MIXED" value={stats?.modes.mixed || 0} color={CYAN} onClick={() => navigate('/board?source=mixed')} />
            <StatTile label="MOCK" value={stats?.modes.mock || 0} color="var(--mute)" onClick={() => navigate('/board?source=mock')} />
            <StatTile label="REGIONS" value={stats?.regionsCovered || 0} color={TEAL} />
            <StatTile label="AIRPORTS" value={stats?.airportsAffected || 0} color={TEAL} />
            <StatTile label="DUPLICATES" value={stats?.duplicateGroups || 0} color={stats?.duplicateGroups > 0 ? HIGH : OK} />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div style={{ padding: '10px 22px 0' }}>
        <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em', marginBottom: 6 }}>
          CATEGORY BREAKDOWN
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categoryStats.map(cat => {
            const color = categoryColors[cat.name] || TEAL;
            const avg = cat.scores.length ? Math.round(cat.scores.reduce((a, b) => a + b, 0) / cat.scores.length) : 0;
            const maxScore = cat.scores.length ? Math.max(...cat.scores) : 1;
            return (
              <div
                key={cat.name}
                onClick={() => navigate(`/board?cat=${encodeURIComponent(cat.name)}`)}
                style={{
                  flex: '1 1 180px', border: '1px solid var(--line)', background: 'var(--panel)',
                  borderRadius: 4, padding: '10px 12px', cursor: 'pointer', borderTop: `3px solid ${color}`,
                }}
                onMouseEnter={(ev) => ev.currentTarget.style.borderColor = color + '55'}
                onMouseLeave={(ev) => ev.currentTarget.style.borderColor = 'var(--line)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, background: color + '20',
                    border: `1px solid ${color}`, display: 'grid', placeItems: 'center',
                    ...MONO, fontSize: 8, fontWeight: 700, color,
                  }}>
                    {categoryIcons[cat.name] || '?'}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{cat.name}</div>
                  <div style={{ marginLeft: 'auto', ...MONO, fontSize: 14, fontWeight: 800, color }}>
                    {cat.count}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--mute)' }}>AVG</span>
                  <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: scoreColor(avg) }}>{avg}</span>
                  <div style={{ flex: 1, height: 4, background: 'var(--sunken)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(avg / maxScore) * 100}%`, background: scoreColor(avg), borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, ...MONO, fontSize: 9, color: 'var(--mute)' }}>
                  {cat.esc4 > 0 && <span style={{ color: CRIT, fontWeight: 600 }}>{cat.esc4} crit</span>}
                  {cat.esc3 > 0 && <span style={{ color: HIGH }}>{cat.esc3} high</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--faint)' }}>VIEW CAT →</span>
                </div>
                {cat.top && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Top: {cat.top.name} ({cat.top.score})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Regional Spread */}
      <div style={{ padding: '10px 22px 20px' }}>
        <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em', marginBottom: 6 }}>
          REGIONAL SPREAD
        </div>
        <div style={{ border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4, padding: '8px 14px' }}>
          {regionStats.map(r => (
            <div
              key={r.id}
              onClick={() => navigate(`/board?region=${r.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', cursor: 'pointer', borderRadius: 3 }}
              onMouseEnter={(ev) => ev.currentTarget.style.background = 'var(--panel2)'}
              onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
            >
              <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', width: 140, flexShrink: 0 }}>
                {r.id} {regionNames[r.id] || r.id}
              </div>
              <div style={{ flex: 1, height: 16, background: 'var(--sunken)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', width: `${(r.count / maxRegionCount) * 100}%`,
                  background: scoreColor(r.topScore), borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
                <span style={{
                  position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                  ...MONO, fontSize: 9, fontWeight: 700, color: 'var(--ink)',
                }}>
                  {r.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, color, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        cursor: onClick ? 'pointer' : 'default',
        padding: onClick ? '4px 6px' : '0', margin: onClick ? '-4px -6px' : '0',
        borderRadius: 3,
        transition: 'background 0.15s',
      }}
      onMouseEnter={onClick ? (e) => e.currentTarget.style.background = 'var(--panel2)' : undefined}
      onMouseLeave={onClick ? (e) => e.currentTarget.style.background = 'transparent' : undefined}
    >
      <div style={{ ...MONO, fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
