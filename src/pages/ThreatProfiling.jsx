// ThreatProfiling.jsx — Threat Profiling Agent UI
// Manually select events and trigger LLM-assisted profiling in the background.
// Shows queue status, progress, and results.

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, createStream } from '../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW, OK, scoreColor, trajArrow, trajColor } from '../theme.js';

const PROFILING_PURPLE = '#A78BFA';

const STEP_LABELS = {
  queued: 'Queued', starting: 'Starting', llm_request: 'LLM request',
  llm_retry: 'Retrying LLM', parsing: 'Parsing', validating: 'Validating',
  scoring: 'Scoring', saving: 'Saving', done: 'Done', failed: 'Failed', cancelled: 'Cancelled',
};
const STEP_PCT = {
  queued: 5, starting: 10, llm_request: 30, llm_retry: 45, parsing: 60,
  validating: 70, scoring: 80, saving: 90, done: 100, failed: 100, cancelled: 100,
};
const isActiveStatus = (s) => s === 'queued' || s === 'running';

function elapsed(from, to = Date.now()) {
  if (!from) return '—';
  const s = Math.max(0, Math.round((new Date(to) - new Date(from)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function ThreatProfiling() {
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [profilingStatus, setProfilingStatus] = useState({});
  const [queueStats, setQueueStats] = useState({ queued: 0, running: 0, completed: 0, failed: 0, skipped: 0, queueLength: 0, total: 0 });
  const [llmStatus, setLlmStatus] = useState({ enabled: false, provider: 'custom', method: 'deterministic' });
  const [realDataMode, setRealDataMode] = useState(false);
  const [realDataModeLoading, setRealDataModeLoading] = useState(false);
  const [filter, setFilter] = useState({ source: 'agent', minScore: 0, category: '' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showLLMConfig, setShowLLMConfig] = useState(false);
  const [drawerTab, setDrawerTab] = useState(null); // null | 'progress' | 'logs'
  const [logs, setLogs] = useState([]);
  const [logEventFilter, setLogEventFilter] = useState(''); // '' = all events
  const logsRef = useRef(null);

  const isActive = useCallback((id) => isActiveStatus(profilingStatus[id]?.status), [profilingStatus]);

  // ── Load events + profiling status ──────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [eventsRes, statusRes, llmRes, realModeRes] = await Promise.all([
        api.getEvents('limit=500'),
        api.getProfilingStatus(),
        api.getProfilingLLMStatus(),
        api.getRealDataMode(),
      ]);
      setEvents(eventsRes.events || []);
      setProfilingStatus(statusRes.events || {});
      setQueueStats(statusRes.stats || {});
      setLlmStatus(llmRes);
      setRealDataMode(!!realModeRes.enabled);
    } catch (e) {
      console.error('Failed to load profiling data:', e);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 3000); // refresh every 3s for live status
    return () => clearInterval(timer);
  }, [loadAll]);

  // ── Poll profiler logs while the Logs tab is open ─────────────────
  useEffect(() => {
    if (drawerTab !== 'logs') return;
    let cancelled = false;
    const fetchLogs = async () => {
      try {
        const res = await api.getProfilingLogs(logEventFilter || null, 300);
        if (!cancelled) setLogs(res.logs || []);
      } catch (e) { /* backend may be down */ }
    };
    fetchLogs();
    const t = setInterval(fetchLogs, 2000);
    return () => { cancelled = true; clearInterval(t); };
  }, [drawerTab, logEventFilter]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (drawerTab === 'logs' && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, drawerTab]);

  const openLogsFor = (eventId) => {
    setLogEventFilter(eventId || '');
    setDrawerTab('logs');
  };

  // ── WebSocket for real-time updates ─────────────────────────────
  const lastLoadRef = useRef(0);
  useEffect(() => {
    const stream = createStream((message) => {
      if (message.type === 'event' || message.type === 'event_updated') {
        // Throttle: pipeline emits events constantly — refetch at most
        // once per 4s so the page doesn't re-render in a loop.
        const now = Date.now();
        if (now - lastLoadRef.current > 4000) {
          lastLoadRef.current = now;
          loadAll();
        }
      }
    });
    return () => stream.close();
  }, [loadAll]);

  // ── Filtered events ──────────────────────────────────────────────
  const filteredEvents = events.filter(e => {
    if (filter.source === 'agent' && e._dataModes?.mode !== 'real') return false;
    if (filter.source === 'seeded' && e._dataModes?.mode !== 'mock' && e._source !== 'seeded') return false;
    if (filter.source === 'mixed' && e._dataModes?.mode !== 'mixed') return false;
    if (filter.minScore && (e.score || 0) < parseInt(filter.minScore)) return false;
    if (filter.category && e.cat !== filter.category) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.name?.toLowerCase().includes(q) && !e.id?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const categories = [...new Set(events.map(e => e.cat))].sort();

  // ── Selection helpers ────────────────────────────────────────────
  // Events with an active (queued/running) profiling job can't be selected —
  // they can only be cancelled.
  const toggleSelect = (id) => {
    if (isActive(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableEvents = filteredEvents.filter(e => !isActive(e.id));
  const selectAll = () => setSelected(new Set(selectableEvents.map(e => e.id)));
  const selectNone = () => setSelected(new Set());
  const selectCritical = () => setSelected(new Set(selectableEvents.filter(e => (e.score || 0) >= 80).map(e => e.id)));
  const selectHigh = () => setSelected(new Set(selectableEvents.filter(e => (e.score || 0) >= 65).map(e => e.id)));

  // ── Trigger profiling ────────────────────────────────────────────
  const triggerSelected = async () => {
    const ids = [...selected].filter(id => !isActive(id));
    if (ids.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.triggerProfiling(ids);
      setMessage({ type: 'success', text: `Queued ${result.queued.length} events for profiling${result.skipped.length ? `, skipped ${result.skipped.length}` : ''}${result.alreadyRunning?.length ? `, ${result.alreadyRunning.length} already in-flight` : ''}` });
      setSelected(prev => { const n = new Set(prev); result.queued.forEach(id => n.delete(id)); return n; });
      setDrawerTab('progress');
      await loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const triggerAll = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.triggerAllProfiling({
        minScore: filter.minScore || 0,
        category: filter.category || null,
      });
      setMessage({ type: 'success', text: `Queued ${result.queued.length} events for profiling${result.alreadyRunning?.length ? `, ${result.alreadyRunning.length} already in-flight` : ''}` });
      setDrawerTab('progress');
      await loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const cancelOne = async (eventId) => {
    try {
      await api.cancelProfiling(eventId);
      await loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const clearCompleted = async () => {
    try {
      await api.clearProfiling();
      await loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const toggleRealDataMode = async () => {
    setRealDataModeLoading(true);
    try {
      const res = await api.setRealDataMode(!realDataMode);
      setRealDataMode(!!res.enabled);
      setMessage({ type: 'success', text: res.message });
      await loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
    setRealDataModeLoading(false);
  };

  const toggleLLM = async () => {
    try {
      await api.setProfilingLLMEnabled(!llmStatus.enabled);
      await loadAll();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  // ── Status badge for an event (click → open logs for that event) ──
  const statusBadge = (eventId) => {
    const s = profilingStatus[eventId];
    if (!s) return null;
    const styles = {
      queued:    { bg: 'rgba(245,166,35,0.15)',  color: HIGH,  label: 'QUEUED' },
      running:   { bg: 'rgba(76,194,206,0.15)',  color: TEAL,  label: s.cancelRequested ? 'CANCELLING' : 'RUNNING' },
      completed: { bg: 'rgba(52,211,153,0.15)',  color: OK,    label: 'DONE' },
      failed:    { bg: 'rgba(240,73,90,0.15)',   color: CRIT,  label: 'FAILED' },
      skipped:   { bg: 'rgba(91,146,201,0.15)',  color: LOW,   label: 'SKIPPED' },
      cancelled: { bg: 'rgba(148,163,184,0.12)', color: 'var(--mute)', label: 'CANCELLED' },
    };
    const style = styles[s.status];
    if (!style) return null;
    return (
      <span
        onClick={(e) => { e.stopPropagation(); openLogsFor(eventId); }}
        title="View profiling logs"
        style={{
          ...MONO,
          fontSize: 9,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 3,
          background: style.bg,
          color: style.color,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}>
        {style.label}
        {s.status === 'running' && s.step && s.step !== 'starting' ? ` · ${STEP_LABELS[s.step] || s.step}` : ''}
      </span>
    );
  };

  // Jobs for the progress tab — active first, then most recently finished
  const jobs = Object.entries(profilingStatus)
    .map(([id, s]) => ({ id, ...s, name: events.find(e => e.id === id)?.name }))
    .sort((a, b) => {
      const rank = (j) => j.status === 'running' ? 0 : j.status === 'queued' ? 1 : 2;
      return rank(a) - rank(b) || String(b.completedAt || b.queuedAt || '').localeCompare(String(a.completedAt || a.queuedAt || ''));
    })
    .slice(0, 50);
  const activeCount = jobs.filter(j => isActiveStatus(j.status)).length;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Threat Profiling</h1>
          <span style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>
            {filteredEvents.length} events · {selected.size} selected
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Real Data Mode toggle */}
          <button
            onClick={toggleRealDataMode}
            disabled={realDataModeLoading}
            style={{
              ...MONO,
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 4,
              border: `1px solid ${realDataMode ? '#34D399' : 'var(--line)'}`,
              background: realDataMode ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: realDataMode ? '#34D399' : 'var(--mute)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {realDataMode ? '● REAL DATA MODE' : '○ REAL DATA MODE'}
          </button>

          {/* LLM status indicator */}
          <button
            onClick={() => setShowLLMConfig(!showLLMConfig)}
            style={{
              ...MONO,
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 4,
              border: `1px solid ${llmStatus.enabled ? PROFILING_PURPLE : 'var(--line)'}`,
              background: llmStatus.enabled ? 'rgba(167,139,250,0.1)' : 'transparent',
              color: llmStatus.enabled ? PROFILING_PURPLE : 'var(--mute)',
              cursor: 'pointer',
            }}
          >
            {llmStatus.enabled ? '● LLM ON' : '○ LLM OFF'} · {llmStatus.method}
          </button>

          {/* Queue stats */}
          {queueStats.total > 0 && (
            <span style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>
              {queueStats.queued > 0 && <span style={{ color: HIGH }}> {queueStats.queued} queued</span>}
              {queueStats.running > 0 && <span style={{ color: TEAL }}> {queueStats.running} running</span>}
              {queueStats.completed > 0 && <span style={{ color: OK }}> {queueStats.completed} done</span>}
              {queueStats.failed > 0 && <span style={{ color: CRIT }}> {queueStats.failed} failed</span>}
              {queueStats.cancelled > 0 && <span style={{ color: 'var(--mute)' }}> {queueStats.cancelled} cancelled</span>}
            </span>
          )}
        </div>
      </div>

      {/* LLM config bar (collapsible) */}
      {showLLMConfig && (
        <div style={{
          padding: '10px 20px',
          background: 'rgba(167,139,250,0.05)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PROFILING_PURPLE }}>
            Profiling LLM Configuration
          </span>
          <span style={{ fontSize: 11, color: 'var(--mute)' }}>
            When enabled, profiling uses the configured LLM to assess evidence and recommend factor bands.
            When disabled, profiling uses deterministic scoring from signal factor hints.
          </span>
          <button
            onClick={toggleLLM}
            style={{
              ...MONO,
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 4,
              border: `1px solid ${llmStatus.enabled ? OK : PROFILING_PURPLE}`,
              background: llmStatus.enabled ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: llmStatus.enabled ? OK : PROFILING_PURPLE,
              cursor: 'pointer',
            }}
          >
            {llmStatus.enabled ? 'Disable LLM' : 'Enable LLM'}
          </button>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
            Provider: {llmStatus.provider} · Configure in Admin Settings → Profiling
          </span>
        </div>
      )}

      {/* Action bar */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {/* Selection actions */}
        <span style={{ fontSize: 11, color: 'var(--mute)', marginRight: 4 }}>Select:</span>
        <button onClick={selectAll} style={btnStyle}>All ({filteredEvents.length})</button>
        <button onClick={selectCritical} style={btnStyle}>Critical (≥80)</button>
        <button onClick={selectHigh} style={btnStyle}>High (≥65)</button>
        <button onClick={selectNone} style={btnStyle}>None</button>

        <div style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />

        {/* Trigger actions */}
        <button
          onClick={triggerSelected}
          disabled={busy || selected.size === 0}
          style={{
            ...btnStyle,
            background: selected.size > 0 ? 'rgba(167,139,250,0.15)' : 'transparent',
            color: selected.size > 0 ? PROFILING_PURPLE : 'var(--mute)',
            borderColor: selected.size > 0 ? PROFILING_PURPLE : 'var(--line)',
            cursor: selected.size > 0 && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? '⏳ Processing...' : `Profile Selected (${selected.size})`}
        </button>
        <button
          onClick={triggerAll}
          disabled={busy}
          style={{
            ...btnStyle,
            background: 'rgba(76,194,206,0.1)',
            color: TEAL,
            borderColor: TEAL,
          }}
        >
          Profile All Real Events
        </button>

        {(queueStats.completed > 0 || queueStats.failed > 0) && (
          <button onClick={clearCompleted} style={btnStyle}>Clear Status</button>
        )}

        {/* Filters */}
        <div style={{ flex: 1 }} />
        <select
          value={filter.source}
          onChange={e => setFilter(f => ({ ...f, source: e.target.value }))}
          style={selectStyle}
        >
          <option value="agent">Real events only</option>
          <option value="mixed">Mixed (real+mock)</option>
          <option value="seeded">Mock/Seeded only</option>
          <option value="">All sources</option>
        </select>
        <select
          value={filter.category}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
          style={selectStyle}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...MONO, fontSize: 11, padding: '4px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg)', color: 'var(--ink)', width: 120 }}
        />
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '8px 20px',
          background: message.type === 'error' ? 'rgba(240,73,90,0.1)' : 'rgba(52,211,153,0.1)',
          color: message.type === 'error' ? CRIT : OK,
          fontSize: 12,
          borderBottom: '1px solid var(--line)',
        }}>
          {message.text}
        </div>
      )}

      {/* Event table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
              <th style={thStyle}><input type="checkbox" checked={selected.size > 0 && selected.size === selectableEvents.length} onChange={e => e.target.checked ? selectAll() : selectNone()} /></th>
              <th style={thStyle}>EDPS</th>
              <th style={thStyle}>Esc</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Event</th>
              <th style={thStyle}>Where</th>
              <th style={thStyle}>Traj</th>
              <th style={thStyle}>Profiled</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(e => {
              const isSelected = selected.has(e.id);
              const status = profilingStatus[e.id];
              const isRunning = status?.status === 'running' || status?.status === 'queued';
              return (
                <tr
                  key={e.id}
                  style={{
                    borderBottom: '1px solid var(--line)',
                    background: isSelected ? 'rgba(167,139,250,0.05)' : 'transparent',
                  }}
                >
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isRunning}
                      title={isRunning ? 'Profiling in progress — cancel it to modify' : ''}
                      onChange={() => toggleSelect(e.id)}
                    />
                  </td>
                  <td style={{ ...tdStyle, ...MONO, color: scoreColor(e.score || 0), fontWeight: 700 }}>
                    {e.score || 0}
                  </td>
                  <td style={{ ...tdStyle, ...MONO }}>
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      background: (e.esc || 0) >= 4 ? 'rgba(240,73,90,0.15)' : (e.esc || 0) >= 3 ? 'rgba(245,166,35,0.15)' : 'rgba(91,146,201,0.1)',
                      color: (e.esc || 0) >= 4 ? CRIT : (e.esc || 0) >= 3 ? HIGH : LOW,
                    }}>
                      L{e.esc || 1}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      ...MONO,
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: e._dataModes?.mode === 'mixed' ? 'rgba(167,139,250,0.1)' : e._dataModes?.mode === 'mock' ? 'rgba(245,166,35,0.1)' : e._source === 'agent-pipeline' ? 'rgba(52,211,153,0.1)' : 'rgba(245,166,35,0.1)',
                      color: e._dataModes?.mode === 'mixed' ? '#A78BFA' : e._dataModes?.mode === 'mock' ? '#F5A623' : e._source === 'agent-pipeline' ? OK : HIGH,
                    }}>
                      {e._dataModes?.mode === 'mixed' ? 'MIXED' : e._dataModes?.mode === 'mock' ? 'MOCK' : e._source === 'agent-pipeline' ? 'REAL' : 'SEEDED'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--mute)' }}>{e.cat}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{e.name}</div>
                    {e.summary && <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 2 }}>{e.summary.slice(0, 80)}{e.summary.length > 80 ? '...' : ''}</div>}
                  </td>
                  <td style={{ ...tdStyle, ...MONO, fontSize: 11 }}>{e.where || '—'}</td>
                  <td style={{ ...tdStyle, ...MONO, color: trajColor(e.traj), fontSize: 11 }}>
                    {trajArrow(e.traj)} {e.traj || '—'}
                  </td>
                  <td style={{ ...tdStyle, ...MONO, fontSize: 10, color: 'var(--mute)' }}>
                    {e._profiledAt ? new Date(e._profiledAt).toLocaleTimeString() : '—'}
                    {e._profiledBy && e._profiledBy !== 'deterministic' && (
                      <div style={{ fontSize: 9, color: PROFILING_PURPLE }}>{e._profiledBy.slice(0, 20)}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {statusBadge(e.id)}
                      {status?.error && (
                        <span
                          onClick={() => openLogsFor(e.id)}
                          style={{ fontSize: 9, color: status.status === 'cancelled' ? 'var(--mute)' : CRIT, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                          title={`${status.error} — click for logs`}
                        >
                          ⚠ {status.error.slice(0, 30)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {isRunning ? (
                      <button
                        onClick={() => cancelOne(e.id)}
                        disabled={status?.cancelRequested}
                        style={{ ...btnStyle, fontSize: 10, padding: '2px 6px', color: CRIT, borderColor: CRIT, opacity: status?.cancelRequested ? 0.5 : 1 }}
                      >
                        {status?.status === 'running' ? (status.cancelRequested ? 'Cancelling…' : 'Abort') : 'Cancel'}
                      </button>
                    ) : (
                      <button
                        onClick={() => api.triggerProfiling([e.id]).then(loadAll)}
                        style={{ ...btnStyle, fontSize: 10, padding: '2px 6px' }}
                      >
                        {status?.status === 'failed' ? 'Retry' : 'Profile'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredEvents.length === 0 && (
              <tr>
                <td colSpan={11} style={{ ...tdStyle, textAlign: 'center', padding: 40, color: 'var(--mute)' }}>
                  No events match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Activity drawer: Progress + Logs tabs */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', background: 'var(--sunken)', display: 'flex', flexDirection: 'column' }}>
        {drawerTab === 'progress' && (
          <div style={{ height: 220, overflow: 'auto', padding: '6px 20px' }}>
            {jobs.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--mute)', fontSize: 12 }}>
                No profiling jobs yet. Select events and click "Profile Selected".
              </div>
            )}
            {jobs.map(j => {
              const active = isActiveStatus(j.status);
              const pct = STEP_PCT[j.status === 'completed' ? 'done' : j.step] ?? 0;
              const barColor = j.status === 'failed' ? CRIT : j.status === 'cancelled' ? 'var(--mute)' : j.status === 'completed' ? OK : j.status === 'queued' ? HIGH : TEAL;
              return (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
                  <span style={{ flexShrink: 0 }}>{statusBadge(j.id)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {j.name || j.id}
                    </div>
                    <div style={{ ...MONO, fontSize: 9, color: 'var(--mute)', marginTop: 1 }}>
                      {j.id}{j.model ? ` · ${j.model}` : ''}{j.error ? ` · ${j.error}` : ''}
                    </div>
                    {active && (
                      <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, marginTop: 4, maxWidth: 320 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s' }} />
                      </div>
                    )}
                  </div>
                  <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)', flexShrink: 0 }}>
                    {STEP_LABELS[j.step] || j.step || j.status}
                    {' · '}
                    {j.completedAt ? elapsed(j.startedAt || j.queuedAt, j.completedAt) : elapsed(j.startedAt || j.queuedAt)}
                  </span>
                  {j.edps != null && (
                    <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: scoreColor(j.edps), flexShrink: 0 }}>
                      {j.edps} L{j.escalation}
                    </span>
                  )}
                  <button onClick={() => openLogsFor(j.id)} style={{ ...btnStyle, fontSize: 9, padding: '1px 6px', flexShrink: 0 }}>Logs</button>
                  {active && (
                    <button
                      onClick={() => cancelOne(j.id)}
                      disabled={j.cancelRequested}
                      style={{ ...btnStyle, fontSize: 9, padding: '1px 6px', flexShrink: 0, color: CRIT, borderColor: CRIT, opacity: j.cancelRequested ? 0.5 : 1 }}
                    >
                      {j.cancelRequested ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {drawerTab === 'logs' && (
          <div ref={logsRef} style={{ height: 220, overflow: 'auto', padding: '8px 20px', ...MONO, fontSize: 11, lineHeight: 1.6 }}>
            {logs.length === 0 && (
              <div style={{ color: 'var(--mute)', padding: 8 }}>No log entries{logEventFilter ? ` for ${logEventFilter}` : ''} yet.</div>
            )}
            {logs.map((l, i) => (
              <div key={i} style={{ color: l.level === 'error' ? CRIT : l.level === 'warn' ? HIGH : 'var(--ink3)', whiteSpace: 'pre-wrap' }}>
                <span style={{ color: 'var(--faint)' }}>{new Date(l.ts).toLocaleTimeString()}</span>
                {' '}<span style={{ color: TEAL }}>{l.eventId || 'profiler'}</span>{' '}{l.msg}
              </div>
            ))}
          </div>
        )}
        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 12px', borderTop: drawerTab ? '1px solid var(--line)' : 'none' }}>
          {[['progress', 'Progress'], ['logs', 'Logs']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setDrawerTab(drawerTab === id ? null : id)}
              style={{
                ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                padding: '6px 14px', cursor: 'pointer', border: 'none',
                borderTop: `2px solid ${drawerTab === id ? PROFILING_PURPLE : 'transparent'}`,
                background: 'transparent',
                color: drawerTab === id ? PROFILING_PURPLE : 'var(--mute)',
              }}
            >
              {label}
              {id === 'progress' && activeCount > 0 && (
                <span style={{ marginLeft: 6, color: TEAL }}>●{activeCount}</span>
              )}
            </button>
          ))}
          {drawerTab === 'logs' && (
            <select
              value={logEventFilter}
              onChange={e => setLogEventFilter(e.target.value)}
              style={{ ...selectStyle, fontSize: 10, marginLeft: 8 }}
            >
              <option value="">All events</option>
              {Object.keys(profilingStatus).map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          )}
          <div style={{ flex: 1 }} />
          {drawerTab && (
            <button onClick={() => setDrawerTab(null)} style={{ ...btnStyle, fontSize: 9, padding: '1px 8px' }}>✕</button>
          )}
        </div>
      </div>

      {/* Footer summary */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--line)',
        background: 'var(--sunken)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...MONO,
        fontSize: 10,
        color: 'var(--mute)',
      }}>
        <span>
          Threat Profiling Agent · {llmStatus.enabled ? `LLM mode (${llmStatus.provider})` : 'Deterministic mode'}
        </span>
        <span>
          {queueStats.total > 0 && `${queueStats.completed} completed · ${queueStats.failed} failed · ${queueStats.queued} queued`}
        </span>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const btnStyle = {
  ...MONO,
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--ink3)',
  cursor: 'pointer',
};

const selectStyle = {
  ...MONO,
  fontSize: 11,
  padding: '4px 8px',
  border: '1px solid var(--line)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--ink)',
};

const thStyle = {
  textAlign: 'left',
  padding: '8px 6px',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--mute)',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '8px 6px',
  verticalAlign: 'top',
};
