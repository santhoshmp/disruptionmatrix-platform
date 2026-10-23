// Archive.jsx — Archived threats view
// Events moved out of the active board: passed events, score < 50,
// or no aviation-related threat (no airports/airspace affected).

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MONO, TEAL, scoreColor, trajColor, trajArrow } from '../theme.js';

const REASON_LABELS = {
  low_threat: 'LOW THREAT (<50)',
  no_aviation_impact: 'NO AVIATION IMPACT',
  stale: 'STALE (>72H)',
  manual: 'MANUAL',
};

const REASON_COLORS = {
  low_threat: '#5B92C9',
  no_aviation_impact: '#F5A623',
  stale: 'var(--mute)',
  manual: '#A78BFA',
};

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Archive() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const load = useCallback(() => {
    api.getArchivedEvents('limit=1000')
      .then((res) => { setEvents(res.events || []); setTotal(res.total ?? (res.events || []).length); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const runSweep = async () => {
    setSweeping(true);
    try { await api.runArchiveSweep(); } catch { /* ignore */ }
    load();
    setSweeping(false);
  };

  const restore = async (id) => {
    setRestoring(id);
    try { await api.restoreEvent(id); } catch { /* ignore */ }
    setEvents(prev => prev.filter(e => e.id !== id));
    setTotal(t => t - 1);
    setRestoring(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '18px 26px', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--cyan)', letterSpacing: '0.12em', marginBottom: 4 }}>THREAT LIFECYCLE</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Archived Threats</h1>
          <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 4 }}>
            Events that have passed, scored below 50, or carry no aviation-related threat.
          </div>
        </div>
        <button
          onClick={runSweep}
          disabled={sweeping}
          style={{
            ...MONO, fontSize: 11, padding: '8px 14px', cursor: sweeping ? 'wait' : 'pointer',
            border: '1px solid var(--teal)', background: 'rgba(76,194,206,0.10)', color: 'var(--ink)',
            borderRadius: 4, fontWeight: 600,
          }}
        >
          {sweeping ? 'RUNNING SWEEP…' : 'RUN ARCHIVE SWEEP'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--mute)', ...MONO, fontSize: 12, padding: 24 }}>Loading archive…</div>
      ) : events.length === 0 ? (
        <div style={{ color: 'var(--mute)', ...MONO, fontSize: 12, padding: 24, border: '1px dashed var(--edge)', borderRadius: 4 }}>
          NO ARCHIVED THREATS — the archive sweep runs automatically every 15 minutes.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel)', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '110px 56px 1fr 200px 110px 130px 150px 130px 80px',
            gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--line)',
            ...MONO, fontSize: 9.5, color: 'var(--faint)', letterSpacing: '0.08em',
          }}>
            <span>REF</span><span>EDPS</span><span>THREAT</span><span>LOCATION</span>
            <span>DETECTED</span><span>TRAJECTORY</span><span>REASON</span><span>ARCHIVED</span><span></span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {events.map((e) => {
              const rc = REASON_COLORS[e.archiveReason] || 'var(--mute)';
              return (
                <div key={e.id} style={{
                  display: 'grid', gridTemplateColumns: '110px 56px 1fr 200px 110px 130px 150px 130px 80px',
                  gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--hover)', alignItems: 'center',
                }}>
                  <span className="mono" style={{ fontSize: 11, color: TEAL }}>{e.ref || e.id.slice(0, 12)}</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: scoreColor(e.score || 0) }}>{e.score}</span>
                  <div style={{ minWidth: 0 }}>
                    <Link to={`/event/${e.id}`} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.name}
                    </Link>
                    <div style={{ ...MONO, fontSize: 9.5, color: 'var(--faint)', marginTop: 1 }}>{e.cat}</div>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.where || '—'}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--mute)' }}>{fmtTime(e.detected)}</span>
                  <span className="mono" style={{ fontSize: 10, color: trajColor(e.traj) }}>{trajArrow(e.traj)} {e.traj || '—'}</span>
                  <span className="mono" style={{ fontSize: 9.5, color: rc, border: `1px solid ${rc}55`, borderRadius: 3, padding: '2px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {REASON_LABELS[e.archiveReason] || (e.archiveReason || 'ARCHIVED').toUpperCase()}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--mute)' }}>{fmtTime(e.archivedAt)}</span>
                  <button
                    onClick={() => restore(e.id)}
                    disabled={restoring === e.id}
                    style={{
                      ...MONO, fontSize: 9.5, padding: '5px 8px', cursor: 'pointer',
                      border: '1px solid var(--edge)', background: 'var(--panel2)',
                      color: TEAL, borderRadius: 3, fontWeight: 600,
                    }}
                  >
                    {restoring === e.id ? '…' : 'RESTORE'}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--faint)', padding: '8px 14px', borderTop: '1px solid var(--line)' }}>
            {total} archived event{total === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
