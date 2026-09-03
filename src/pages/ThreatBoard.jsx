import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DM from '../data/dm-data.json';
import { MONO, scoreColor, confLabel, trajColor, trajArrow, CRIT, HIGH, MOD, LOW, TEAL } from '../theme.js';

const CATS = ['All', 'Weather', 'ATC / Airspace', 'Industrial action', 'Geopolitical', 'Infrastructure', 'Regulatory'];
const SORTS = [
  { id: 'score', label: 'EDPS' },
  { id: 'tti', label: 'Time to impact' },
  { id: 'traj', label: 'Trajectory' }
];
const LAYOUTS = [
  { id: 'ranked', label: 'Ranked list' },
  { id: 'lanes', label: 'Escalation lanes' }
];
const TRAJ_ORDER = { Escalating: 0, Stable: 1, Improving: 2 };

function ScoreBox({ score, size = 17 }) {
  const c = scoreColor(score);
  return (
    <div style={{ ...MONO, fontWeight: 600, fontSize: size, color: c, border: `1px solid ${c}`, background: c + '1A', padding: '6px 9px', textAlign: 'center', alignSelf: 'center' }}>
      {score}
    </div>
  );
}

function DomainDots({ event }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {DM.DOMAINS.map((name) => {
        const hit = event.domains.find((d) => d.name === name);
        const v = hit ? hit.v : 0;
        const c = v >= 70 ? CRIT : v >= 45 ? HIGH : v >= 25 ? 'var(--dim)' : 'var(--line2)';
        return <div key={name} title={`${name} · ${v || 'not implicated'}`} style={{ width: 11, height: 11, background: c }} />;
      })}
    </div>
  );
}

function EventRow({ e, onOpen }) {
  return (
    <div
      onClick={() => onOpen(e.id)}
      className="hoverable"
      style={{
        display: 'grid',
        gridTemplateColumns: '64px minmax(200px, 2.4fr) minmax(96px, 0.9fr) minmax(110px, 1fr) 88px 128px 118px',
        gap: 16, padding: '14px 16px', borderBottom: '1px solid var(--hover)', alignItems: 'center'
      }}
    >
      <ScoreBox score={e.score} />
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 3 }}>{e.name}</div>
        <div style={{ ...MONO, fontSize: 11, color: 'var(--mute2)' }}>{e.ref} · {e.where}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink3)' }}>{e.cat}</div>
      <DomainDots event={e} />
      <div style={{ ...MONO, fontSize: 13, color: 'var(--ink2)' }}>{e.tti}</div>
      <div style={{ color: trajColor(e.traj), fontWeight: 600, ...MONO, fontSize: 12 }}>
        {trajArrow(e.traj)} {e.traj}
      </div>
      <div style={{ ...MONO, fontSize: 12, padding: '6px 9px', textAlign: 'center', border: `1px solid ${e.esc >= 4 ? CRIT : e.esc === 3 ? HIGH : 'var(--edge)'}`, color: e.esc >= 3 ? (e.esc >= 4 ? CRIT : HIGH) : 'var(--mute)' }}>
        L{e.esc} {DM.ESC[e.esc - 1].badge}
      </div>
    </div>
  );
}

export default function ThreatBoard() {
  const nav = useNavigate();
  const [cat, setCat] = useState('All');
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState('score');
  const [layout, setLayout] = useState('ranked');

  const rows = DM.EVENTS
    .filter((x) => (cat === 'All' || x.cat === cat) && x.score >= minScore)
    .sort((a, b) =>
      sort === 'score' ? b.score - a.score
        : sort === 'tti' ? a.ttiMin - b.ttiMin
        : (TRAJ_ORDER[a.traj] - TRAJ_ORDER[b.traj]) || b.score - a.score
    );

  const open = (id) => nav(`/event/${id}`);
  const laneColor = (i) => (i === 3 ? CRIT : i === 2 ? HIGH : i === 1 ? MOD : LOW);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 0 auto', padding: '16px 26px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Active external threat board</div>
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>Correlated public-source events ranked by disruption potential</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px', border: '1px solid var(--edge)', background: 'var(--panel2)' }}>
            <div className="pulse" style={{ width: 7, height: 7, background: '#F04A52' }} />
            <span style={{ ...MONO, fontSize: 12, color: 'var(--ink2)' }}>
              {DM.EVENTS.filter((e) => e.esc >= 4).length} events at VP threshold
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {CATS.map((c) => (
            <button key={c} className={`pill${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">SORT</span>
          {SORTS.map((s) => (
            <button key={s.id} className={`pill${sort === s.id ? ' on' : ''}`} onClick={() => setSort(s.id)}>{s.label}</button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">LAYOUT</span>
          {LAYOUTS.map((l) => (
            <button key={l.id} className={`pill${layout === l.id ? ' on' : ''}`} onClick={() => setLayout(l.id)}>{l.label}</button>
          ))}
          <span style={{ width: 14 }} />
          <span className="kicker">MIN EDPS {minScore}</span>
          <input type="range" min="0" max="90" step="5" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: layout === 'lanes' ? '18px 26px' : 0 }}>
        {layout === 'ranked' ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '64px minmax(200px, 2.4fr) minmax(96px, 0.9fr) minmax(110px, 1fr) 88px 128px 118px',
                gap: 16, padding: '10px 16px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1
              }}
            >
              {['EDPS', 'EVENT', 'CATEGORY', 'DOMAINS', 'IMPACT', 'TRAJECTORY', 'ESCALATION'].map((h) => (
                <div key={h} className="kicker">{h}</div>
              ))}
            </div>
            {rows.map((e) => <EventRow key={e.id} e={e} onOpen={open} />)}
            {rows.length === 0 && <div style={{ padding: 30, color: 'var(--mute)' }}>No events match the current filters.</div>}
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
            {DM.ESC.map((L, i) => {
              const list = rows.filter((x) => x.esc === i + 1);
              return (
                <div key={L.code} style={{ border: '1px solid var(--line)', background: 'var(--panel2)' }}>
                  <div style={{ padding: '13px 15px', borderBottom: '1px solid var(--line)', borderTop: `3px solid ${laneColor(i)}`, background: 'var(--panel)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{L.title}</div>
                    <div style={{ ...MONO, fontSize: 10.5, color: 'var(--mute)', marginTop: 3 }}>{L.trigger}</div>
                    <div style={{ ...MONO, fontSize: 11, color: 'var(--ink3)', marginTop: 6 }}>{list.length ? `${list.length} active` : 'none'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
                    {list.map((e) => (
                      <div key={e.id} onClick={() => open(e.id)} className="hoverable" style={{ border: '1px solid var(--edge)', background: 'var(--panel)', padding: '12px 13px' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <ScoreBox score={e.score} size={14} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>{e.name}</div>
                            <div style={{ ...MONO, fontSize: 11, color: 'var(--mute2)', display: 'flex', gap: 8 }}>
                              <span style={{ color: trajColor(e.traj), fontWeight: 600 }}>{trajArrow(e.traj)}</span>
                              <span>{e.tti}</span>
                              <span>Conf {confLabel(e.conf)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
