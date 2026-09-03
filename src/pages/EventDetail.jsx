import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DM from '../data/dm-data.json';
import { MONO, scoreColor, confLabel, trajColor, trajArrow, CRIT, HIGH, OK, TEAL } from '../theme.js';

const TABS = [
  { id: 'detail', label: 'Assessment' },
  { id: 'process', label: 'Escalation & response' },
  { id: 'sop', label: 'Event-type SOP' },
  { id: 'retro', label: 'Retrospective' }
];

function Section({ title, children, style }) {
  return (
    <div className="card" style={{ marginBottom: 14, ...style }}>
      <div className="kicker" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Assessment({ ev }) {
  const ops = DM.OPS[ev.id];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(430px, 1.25fr) minmax(360px, 1fr)', gap: 14, alignItems: 'start' }}>
      <div>
        <Section title="SCORE COMPOSITION · 8 WEIGHTED FACTORS">
          {ev.factors.map((f) => (
            <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '190px 1fr 110px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--hover)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
                <div style={{ ...MONO, fontSize: 10.5, color: 'var(--faint)' }}>weight {Math.round(f.weight * 100)}%</div>
              </div>
              <div title={f.why}>
                <div style={{ height: 6, background: 'var(--track)' }}>
                  <div style={{ height: 6, width: `${f.val}%`, background: scoreColor(f.val) }} />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 5, lineHeight: 1.45 }}>{f.why}</div>
              </div>
              <div style={{ ...MONO, fontSize: 12.5, color: 'var(--ink2)', textAlign: 'right' }}>{f.readout}</div>
            </div>
          ))}
        </Section>

        <Section title="KNOCK-ON REASONING CHAIN">
          {ev.chain.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--hover)' }}>
              <div style={{ ...MONO, flex: '0 0 96px', fontSize: 11, color: TEAL, letterSpacing: '0.05em' }}>{c.ord}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>{c.detail}</div>
              </div>
              <div style={{ ...MONO, flex: '0 0 110px', fontSize: 11.5, color: 'var(--mute)', textAlign: 'right' }}>
                <div style={{ color: 'var(--ink2)' }}>{c.lik}</div>
                <div>{c.lead}</div>
              </div>
            </div>
          ))}
        </Section>

        {ops && (
          <Section title="PUBLISHED-OPERATIONS EXPOSURE (PUBLIC DATA ONLY)">
            <div style={{ fontSize: 12.5, color: 'var(--mute)', marginBottom: 12, lineHeight: 1.5 }}>{ops.basis}</div>
            <div className="kicker" style={{ marginBottom: 8 }}>AIRPORTS IN THE AREA OF EFFECT</div>
            {ops.airports.map((a) => (
              <div key={a.iata} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 90px', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--hover)' }}>
                <div style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)' }}>{a.iata}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name} <span style={{ color: 'var(--mute2)', fontWeight: 400 }}>· {a.role}</span></div>
                  <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{a.note}</div>
                </div>
                <div style={{ ...MONO, fontSize: 12, color: scoreColor(a.exposure), textAlign: 'right' }}>{a.exposure}</div>
              </div>
            ))}
            <div className="kicker" style={{ margin: '14px 0 8px' }}>AIRLINES WITH PUBLISHED EXPOSURE</div>
            {ops.airlines.map((a) => (
              <div key={a.code + a.hub} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--hover)' }}>
                <div style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: 'var(--ink2)' }}>{a.code}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.name} <span style={{ color: 'var(--mute2)', fontWeight: 400 }}>· {a.daily} daily · {a.netShare}% of network</span></div>
                  <div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{a.note}</div>
                </div>
                <div style={{ ...MONO, fontSize: 11.5, textAlign: 'right', color: a.exposure === 'Critical' ? CRIT : a.exposure === 'High' ? HIGH : 'var(--mute)' }}>{a.exposure}</div>
              </div>
            ))}
          </Section>
        )}
      </div>

      <div>
        <Section title="DOMAIN IMPLICATION PROFILE">
          {ev.domains.map((d) => (
            <div key={d.name} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 40px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{d.name}</div>
              <div style={{ height: 6, background: 'var(--track)' }}>
                <div style={{ height: 6, width: `${d.v}%`, background: d.v >= 70 ? CRIT : d.v >= 45 ? HIGH : 'var(--dim)' }} />
              </div>
              <div style={{ ...MONO, fontSize: 12, color: 'var(--ink2)', textAlign: 'right' }}>{d.v}</div>
            </div>
          ))}
        </Section>

        <Section title="EVIDENCE TRAIL">
          {ev.evidence.map((e, i) => (
            <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid var(--hover)' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 4, ...MONO, fontSize: 11 }}>
                <span style={{ color: 'var(--mute)' }}>{e.time}</span>
                <span style={{ color: 'var(--ink2)' }}>{e.source}</span>
                <span style={{ color: e.cred === 'Tier 1' ? OK : e.cred === 'Tier 2' ? HIGH : CRIT }}>{e.cred}</span>
                <span style={{ marginLeft: 'auto', color: e.role === 'Contradicts' ? CRIT : TEAL }}>{e.role}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>{e.text}</div>
            </div>
          ))}
        </Section>

        <Section title="STATED ASSUMPTIONS">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
            {ev.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </Section>

        <Section title="INFORMATION GAPS">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
            {ev.gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Process({ ev }) {
  return (
    <div>
      <Section title="ESCALATION THRESHOLD MODEL">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {DM.ESC.map((L, i) => {
            const active = ev.esc === i + 1;
            const c = i === 3 ? CRIT : i === 2 ? HIGH : 'var(--edge)';
            return (
              <div key={L.code} style={{ border: `1px solid ${active ? TEAL : 'var(--line)'}`, background: active ? 'var(--sel-bg)' : 'var(--panel2)', padding: 14, borderTop: `3px solid ${c}` }}>
                <div style={{ ...MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--faint)', marginBottom: 6 }}>{L.code} · {L.badge.toUpperCase()}{active ? ' · CURRENT' : ''}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{L.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.5, marginBottom: 8 }}>{L.desc}</div>
                <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>{L.trigger}</div>
              </div>
            );
          })}
        </div>
      </Section>
      <Section title="PHASED RESPONSE FLOW">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {DM.PHASES.map((p) => (
            <div key={p.num} style={{ border: '1px solid var(--line)', background: 'var(--panel2)', padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ ...MONO, fontSize: 15, fontWeight: 600, color: TEAL }}>{p.num}</span>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{p.title}</span>
              </div>
              <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', marginBottom: 10 }}>{p.owner} · {p.window}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
                {p.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Sop({ ev }) {
  const sop = DM.SOPS[ev.sopKey];
  const [done, setDone] = useState({});
  if (!sop) return <div style={{ color: 'var(--mute)' }}>No SOP configured for this event type.</div>;
  const gateColor = (s) => (s === 'Active' ? OK : s === 'Closed' ? 'var(--faint)' : 'var(--mute)');
  const typeColor = { Conditional: HIGH, Gate: TEAL, Standing: 'var(--mute2)' };
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{sop.title}</div>
        <div style={{ ...MONO, fontSize: 11.5, color: 'var(--mute)', marginTop: 4 }}>{sop.meta}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sop.gates.length}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {sop.gates.map((g) => (
          <div key={g.name} style={{ border: '1px solid var(--line)', background: 'var(--panel2)', padding: 13, borderTop: `3px solid ${gateColor(g.state)}` }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</div>
            <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>{g.window}</div>
            <div style={{ ...MONO, fontSize: 11, color: gateColor(g.state), marginTop: 6 }}>{g.state.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <Section title={`ACTION LIST · ${Object.values(done).filter(Boolean).length}/${sop.actions.length} DONE`}>
        {sop.actions.map((a, i) => (
          <label key={i} style={{ display: 'grid', gridTemplateColumns: '24px 90px 90px 1fr 130px 100px', gap: 12, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--hover)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!done[i]} onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))} />
            <span style={{ ...MONO, fontSize: 11.5, color: 'var(--ink2)' }}>{a.timing}</span>
            <span style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>{a.gate}</span>
            <span style={{ fontSize: 13, color: done[i] ? 'var(--faint)' : 'var(--ink3)', textDecoration: done[i] ? 'line-through' : 'none', lineHeight: 1.5 }}>{a.text}</span>
            <span style={{ fontSize: 12, color: 'var(--mute)' }}>{a.desk}</span>
            <span style={{ ...MONO, fontSize: 10.5, padding: '3px 7px', textAlign: 'center', border: `1px solid ${typeColor[a.type]}`, color: typeColor[a.type] }}>{a.type}</span>
          </label>
        ))}
      </Section>
    </div>
  );
}

function Retro({ ev }) {
  const retro = DM.RETRO[ev.id];
  if (!retro) {
    return (
      <div className="card" style={{ color: 'var(--mute)', fontSize: 14 }}>
        No retrospective available yet — this review is generated after event close-out. See the storm event for a completed example.
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {retro.stats.map((s) => (
          <div key={s.k} className="card">
            <div className="kicker" style={{ marginBottom: 8 }}>{s.k}</div>
            <div style={{ ...MONO, fontSize: 20, fontWeight: 600 }}>{s.v}</div>
            <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 4 }}>{s.note}</div>
          </div>
        ))}
      </div>
      <Section title="INTELLIGENCE AVAILABILITY VERSUS ACTION TAKEN">
        {retro.rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 90px 1fr', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--hover)' }}>
            <div style={{ ...MONO, fontSize: 12, color: 'var(--mute)' }}>{r.time}</div>
            <div style={{ ...MONO, fontSize: 12, color: scoreColor(r.edps) }}>EDPS {r.edps}<div style={{ color: 'var(--faint)' }}>{r.conf}</div></div>
            <div>
              {r.intelTitle && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>{r.intelTitle}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>{r.intelDetail}</div>
                </>
              )}
              {r.actionTitle && (
                <div style={{ borderLeft: `3px solid ${TEAL}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEAL }}>{r.actionTitle} <span style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>· {r.actionRole}</span></div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.5 }}>{r.actionDetail}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState('detail');
  const ev = DM.EVENTS.find((e) => e.id === id) || DM.EVENTS[0];
  const c = scoreColor(ev.score);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 0 auto', background: 'var(--panel)', borderBottom: '1px solid var(--line)', padding: '16px 26px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 22, marginBottom: 14 }}>
          <div style={{ padding: '14px 18px', color: c, border: `1px solid ${c}`, background: c + '14', textAlign: 'center' }}>
            <div style={{ ...MONO, fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{ev.score}</div>
            <div style={{ ...MONO, fontSize: 9.5, letterSpacing: '0.16em', opacity: 0.85, marginTop: 5 }}>EDPS</div>
          </div>
          <div style={{ flex: '1 1 460px', minWidth: 320 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 6, ...MONO, fontSize: 12 }}>
              <span style={{ color: TEAL, letterSpacing: '0.08em' }}>{ev.ref}</span>
              <span style={{ color: 'var(--mute2)' }}>{ev.cat}</span>
              <span style={{ color: 'var(--mute2)' }}>{ev.where}</span>
              <span style={{ color: 'var(--mute2)' }}>Detected {ev.detected}</span>
            </div>
            <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>{ev.name}</div>
            <div style={{ fontSize: 14, color: 'var(--ink3)', lineHeight: 1.6, maxWidth: 1000 }}>{ev.summary}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 1, background: 'var(--line2)', border: '1px solid var(--line2)' }}>
            {[
              { k: 'CONFIDENCE', v: confLabel(ev.conf) },
              { k: 'TRAJECTORY', v: `${trajArrow(ev.traj)} ${ev.traj}`, color: trajColor(ev.traj) },
              { k: 'TIME TO IMPACT', v: ev.tti },
              { k: 'ESCALATION', v: `L${ev.esc} ${DM.ESC[ev.esc - 1].badge}`, color: ev.esc >= 4 ? CRIT : ev.esc === 3 ? HIGH : 'var(--ink2)' }
            ].map((h) => (
              <div key={h.k} style={{ background: 'var(--panel2)', padding: '11px 16px', minWidth: 122 }}>
                <div className="kicker" style={{ fontSize: 9.5, marginBottom: 6 }}>{h.k}</div>
                <div style={{ ...MONO, fontSize: 14, fontWeight: 600, color: h.color || 'var(--ink2)' }}>{h.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => nav('/board')} style={{ ...MONO, fontSize: 12, padding: '10px 14px', cursor: 'pointer', border: '1px solid var(--line2)', borderBottom: 'none', background: 'transparent', color: 'var(--faint)' }}>← Board</button>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '11px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                border: `1px solid ${tab === t.id ? 'var(--line2)' : 'transparent'}`, borderBottom: 'none',
                background: tab === t.id ? 'var(--bg)' : 'transparent',
                color: tab === t.id ? 'var(--ink)' : 'var(--mute2)',
                boxShadow: tab === t.id ? `inset 0 2px 0 ${TEAL}` : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
          <Link to="/" style={{ marginLeft: 'auto', ...MONO, fontSize: 12, padding: '8px 13px', border: '1px solid var(--edge)', color: 'var(--cyan)' }}>
            Airline exposure views →
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 26px' }}>
        {tab === 'detail' && <Assessment ev={ev} />}
        {tab === 'process' && <Process ev={ev} />}
        {tab === 'sop' && <Sop ev={ev} />}
        {tab === 'retro' && <Retro ev={ev} />}
      </div>
    </div>
  );
}
