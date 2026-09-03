import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MONO, sevColor, statusColor, toneColor, CRIT, HIGH, OK } from '../theme.js';

function sparkPoints(arr) {
  const min = Math.min(...arr), max = Math.max(...arr), span = max - min || 1;
  return arr.map((v, i) => `${((i / (arr.length - 1)) * 100).toFixed(1)},${(22 - ((v - min) / span) * 20).toFixed(1)}`).join(' ');
}

export default function Radar({ airline }) {
  const D = airline.data;
  const scoreField = airline.scoreField;
  const THREATS = [...D.THREATS].sort((a, b) => b[scoreField] - a[scoreField]);
  const accent = airline.accent;

  const [selId, setSelId] = useState(THREATS[0].id);
  const sel = THREATS.find((t) => t.id === selId) || THREATS[0];
  const ex = D.EXPOSURE[sel.id];
  const c = sevColor(sel[scoreField]);

  const maxScore = Math.max(...THREATS.map((t) => t[scoreField]));
  const netColor = sevColor(maxScore);
  const netLabel = maxScore >= 80 ? 'RED — ELEVATED, VP THRESHOLD CROSSED' : maxScore >= 55 ? 'AMBER — ELEVATED' : 'GREEN — NOMINAL';

  const tiers = ['tier0', 'tier1', 'tier2', 'tier3', 'tier4'].map((k, i) => {
    const t = ex[k];
    const big = k === 'tier0' ? t.routeCount : k === 'tier1' || k === 'tier2' ? t.count : k === 'tier3' ? t.pax : t.esc;
    const color = k === 'tier4' ? sevColor(t.esc * 22) : big > 0 ? accent : 'var(--mute2)';
    return { num: `TIER ${i}`, label: t.label, note: t.note, big: k === 'tier3' ? big.toLocaleString() : big, color };
  });

  const flights = D.FLIGHTS.filter((f) => f.threat === sel.id);
  const pairings = D.PAIRINGS.filter((p) => p.threat === sel.id);
  const rp = airline.routePrefix;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 18, padding: '13px 26px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{airline.radarTitle}</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{airline.radarSub}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 13px', border: `1px solid ${netColor}`, background: netColor + '14', ...MONO, fontSize: 11, letterSpacing: '0.06em', color: netColor }}>
          <div className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: netColor }} />
          {netLabel}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr) 300px' }}>
        <div style={{ borderRight: '1px solid var(--line)', overflow: 'auto', padding: 12, background: 'var(--panel2)' }}>
          <div className="kicker" style={{ marginBottom: 10 }}>ACTIVE THREATS · BY {airline.code} SCORE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {THREATS.map((t) => (
              <div
                key={t.id} onClick={() => setSelId(t.id)} className="hoverable"
                style={{ padding: '11px 12px', border: `1px solid ${t.id === selId ? accent : 'var(--line)'}`, background: t.id === selId ? accent + '14' : 'var(--panel)' }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ ...MONO, fontWeight: 700, fontSize: 15, textAlign: 'center', padding: '6px 8px', color: sevColor(t[scoreField]), border: `1px solid ${sevColor(t[scoreField])}`, background: sevColor(t[scoreField]) + '1A' }}>{t[scoreField]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{t.name}</div>
                    <div style={{ ...MONO, fontSize: 10.5, color: 'var(--mute2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ border: '1px solid var(--edge)', padding: '1px 5px' }}>{t.code}</span>
                      <span>EDPS {t.edps}</span>
                      <span>{t.tti}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="kicker" style={{ margin: '18px 0 10px' }}>STANDING VULNERABILITIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {D.VULNERABILITIES.map((v) => (
              <div key={v.title} style={{ border: '1px solid var(--line)', background: 'var(--panel)', padding: '10px 12px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{v.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--mute)', lineHeight: 1.5 }}>{v.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: 18 }}>
          <div className="card" style={{ borderTop: `3px solid ${c}`, marginBottom: 14 }}>
            <div style={{ ...MONO, fontSize: 11, color: accent, letterSpacing: '0.06em', marginBottom: 6 }}>
              {sel.region} · {sel.cat} · Time to impact {sel.tti} · {sel.traj}
            </div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
              <div style={{ ...MONO, textAlign: 'center', padding: '12px 18px', color: c, border: `1px solid ${c}`, background: c + '14' }}>
                <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{sel[scoreField]}</div>
                <div style={{ fontSize: 8.5, letterSpacing: '0.14em', marginTop: 4, opacity: 0.85 }}>{airline.scoreLabel}</div>
                <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 6 }}>EDPS {sel.edps}</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 8 }}>{sel.name}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink3)', lineHeight: 1.6 }}>{sel.summary}</div>
              </div>
            </div>
          </div>

          <div className="kicker" style={{ marginBottom: 10 }}>FIVE-TIER EXPOSURE INTERSECTION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            {tiers.map((t) => (
              <div key={t.num} style={{ border: '1px solid var(--line)', background: 'var(--panel)', padding: 13, borderTop: `3px solid ${t.color}` }}>
                <div style={{ ...MONO, fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--faint)', marginBottom: 6 }}>{t.num}</div>
                <div style={{ ...MONO, fontSize: 26, fontWeight: 700, color: t.color, lineHeight: 1, marginBottom: 6 }}>{t.big}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
                <div style={{ fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.5 }}>{t.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14 }}>
            <div className="card">
              <div className="kicker" style={{ marginBottom: 10 }}>FLAGGED ROTATIONS · {flights.length}</div>
              {flights.length ? flights.map((f) => (
                <div key={f.flt} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 70px 76px', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--hover)', fontSize: 12.5, alignItems: 'center' }}>
                  <span className="mono" style={{ color: 'var(--ink2)' }}>{f.flt}</span>
                  <span style={{ color: 'var(--ink3)' }}>{f.route} · {f.type}</span>
                  <span className="mono" style={{ color: 'var(--mute)' }}>{f.tail}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--mute2)', textAlign: 'right' }}>{f.bank}</span>
                </div>
              )) : <div style={{ fontSize: 12.5, color: 'var(--mute2)' }}>No rotations currently flagged.</div>}
              <Link to={`${rp}/explorer?tab=gantt&threat=${sel.id}`} style={{ display: 'inline-block', marginTop: 12, ...MONO, fontSize: 12, padding: '8px 13px', border: `1px solid ${accent}`, background: accent + '1F', color: 'var(--ink)' }}>
                Fix schedule in solver →
              </Link>
            </div>
            <div className="card">
              <div className="kicker" style={{ marginBottom: 10 }}>CREW PAIRINGS AT RISK · {pairings.length}</div>
              {pairings.length ? pairings.map((p) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '76px 1fr 60px', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--hover)', fontSize: 12.5, alignItems: 'center' }}>
                  <span className="mono" style={{ color: 'var(--ink2)' }}>{p.id}</span>
                  <span style={{ color: 'var(--ink3)' }}>{p.route}</span>
                  <span className="mono" style={{ fontWeight: 600, textAlign: 'right', color: statusColor(p.status) }}>{p.margin}m</span>
                </div>
              )) : <div style={{ fontSize: 12.5, color: 'var(--mute2)' }}>No pairings within margin.</div>}
            </div>
          </div>

          <div className="kicker" style={{ margin: '18px 0 10px' }}>{airline.bankLabel}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {D.BANKS.map((b) => {
              const bc = sevColor(b.severity * 22);
              return (
                <div key={b.id} style={{ padding: '12px 14px', background: 'var(--panel2)', border: '1px solid var(--line)', borderTop: `3px solid ${bc}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{b.label}</span>
                    <span style={{ ...MONO, fontSize: 9, letterSpacing: '0.08em', color: bc }}>
                      {b.severity >= 4 ? 'HIGH' : b.severity >= 3 ? 'ELEVATED' : b.severity >= 2 ? 'WATCH' : 'NOMINAL'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginBottom: 3 }}>{b.sub}</div>
                  <div style={{ ...MONO, fontSize: 10.5, color: 'var(--mute)' }}>{b.window} · {b.kind}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid var(--line)', overflow: 'auto', padding: 12, background: 'var(--panel2)' }}>
          <div className="kicker" style={{ marginBottom: 10 }}>OPERATIONS SNAPSHOT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(D.SNAPSHOT).map(([k, s]) => (
              <div key={k} style={{ border: '1px solid var(--line)', background: 'var(--panel)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{s.label}</span>
                  <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: toneColor(s.tone) }}>{s.value}{s.unit}</span>
                </div>
                {s.trend ? (
                  <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: 24, display: 'block' }}>
                    <polyline points={sparkPoints(s.trend)} fill="none" stroke={toneColor(s.tone)} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                  </svg>
                ) : (
                  <div style={{ ...MONO, fontSize: 10.5, color: 'var(--mute)' }}>{s.note}</div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Link to={`${rp}/airline-map`} style={{ display: 'block', textAlign: 'center', padding: '10px 14px', fontSize: 12.5, fontWeight: 600, border: '1px solid var(--edge)', color: accent }}>
              View on network map →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
