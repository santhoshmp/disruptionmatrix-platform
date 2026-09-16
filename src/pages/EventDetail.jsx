import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DM from '../data/dm-data.json';
import { api } from '../api/client.js';
import { MONO, scoreColor, confLabel, trajColor, trajArrow, CRIT, HIGH, MOD, LOW, OK, TEAL } from '../theme.js';

const TABS = [
  { id: 'detail', label: 'Assessment' },
  { id: 'flights', label: 'Impacted flights' },
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

function Assessment({ ev, onSelectAirline }) {
  const [ops, setOps] = useState(DM.OPS[ev.id] || null);
  const [impactMode, setImpactMode] = useState('mock');
  const [recomputing, setRecomputing] = useState(false);

  async function loadOps() {
    try {
      const data = await api.getOPS(ev.id);
      if (data.ops) setOps(data.ops);
    } catch (e) { /* use static fallback */ }
    try {
      const modeRes = await fetch('http://localhost:3001/api/ops/mode');
      const modeData = await modeRes.json();
      setImpactMode(modeData.mode || 'mock');
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    loadOps();
  }, [ev.id]);

  async function handleRecompute() {
    setRecomputing(true);
    try {
      await api.recomputeOPS(ev.id);
      await loadOps();
    } catch (e) { /* ignore */ }
    setRecomputing(false);
  }

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--mute)', flex: 1, lineHeight: 1.5 }}>{ops.basis}</div>
              <span style={{
                ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2, fontWeight: 700,
                border: `1px solid ${impactMode === 'real' ? '#34D399' : 'var(--edge)'}`,
                color: impactMode === 'real' ? '#34D399' : 'var(--mute)',
              }}>
                {impactMode === 'real' ? 'REAL AIRLINES' : 'MOCK AIRLINES'}
              </span>
              <button
                onClick={handleRecompute}
                disabled={recomputing}
                style={{
                  ...MONO, fontSize: 10, padding: '4px 10px', cursor: recomputing ? 'wait' : 'pointer',
                  border: '1px solid var(--edge)', background: 'var(--panel2)',
                  color: recomputing ? 'var(--mute)' : TEAL, borderRadius: 3, fontWeight: 600,
                }}
              >
                {recomputing ? 'RECOMPUTING...' : 'RECOMPUTE'}
              </button>
            </div>

            {/* Airports in the area of effect */}
            <div className="kicker" style={{ marginBottom: 8 }}>AIRPORTS IN THE AREA OF EFFECT</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 16 }}>
              {ops.airports.map((a) => {
                const expColor = scoreColor(a.exposure);
                return (
                  <div key={a.iata} style={{
                    border: `1px solid var(--edge)`, borderLeft: `3px solid ${expColor}`,
                    background: 'var(--panel2)', padding: '8px 10px', borderRadius: 3,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ ...MONO, fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>{a.iata}</span>
                      <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: expColor }}>{a.exposure}</span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{a.name}</div>
                    <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', marginTop: 2 }}>
                      {a.movements || 0} movements · {a.role}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Critical / High airlines — featured cards */}
            {(() => {
              const critical = ops.airlines.filter((a) => a.exposure === 'Critical' || a.exposure === 'High');
              const others = ops.airlines.filter((a) => a.exposure !== 'Critical' && a.exposure !== 'High');
              const expColor = (level) => level === 'Critical' ? CRIT : level === 'High' ? HIGH : level === 'Moderate' ? MOD : LOW;

              return (
                <>
                  {critical.length > 0 && (
                    <>
                      <div className="kicker" style={{ marginBottom: 8 }}>
                        CRITICAL & HIGH EXPOSURE · {critical.length} AIRLINES
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, marginBottom: 14 }}>
                        {critical.map((a) => {
                          const c = expColor(a.exposure);
                          return (
                            <div
                              key={a.code + a.hub}
                              onClick={() => onSelectAirline && onSelectAirline(a.code, a.name)}
                              className="hoverable"
                              style={{
                                border: `1px solid ${c}55`, borderLeft: `4px solid ${c}`,
                                background: c + '0D', padding: '10px 12px', borderRadius: 3,
                                cursor: onSelectAirline ? 'pointer' : 'default',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: 'var(--ink2)' }}>{a.code}</span>
                                  <span style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</span>
                                </div>
                                <span style={{ ...MONO, fontSize: 18, fontWeight: 700, color: c }}>{a.exposureScore}</span>
                              </div>
                              <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', marginBottom: 4 }}>
                                {a.daily} daily · {a.netShare}% network · hub {a.hub}
                              </div>
                              <div style={{ fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.35 }}>{a.note}</div>
                              {onSelectAirline && (
                                <div style={{ ...MONO, fontSize: 9, color: TEAL, marginTop: 6, fontWeight: 600 }}>
                                  → Click to view impacted flights
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Other airlines — compact scrollable grid */}
                  {others.length > 0 && (
                    <>
                      <div className="kicker" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        OTHER AIRLINES · {others.length}
                        <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)', fontWeight: 400 }}>MODERATE / LOW EXPOSURE</span>
                      </div>
                      <div style={{
                        maxHeight: 280, overflowY: 'auto', border: '1px solid var(--edge)', borderRadius: 4,
                        background: 'var(--panel2)',
                      }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                          gap: 1, background: 'var(--line2)',
                        }}>
                          {others.map((a) => {
                            const c = expColor(a.exposure);
                            return (
                              <div
                                key={a.code + a.hub}
                                onClick={() => onSelectAirline && onSelectAirline(a.code, a.name)}
                                className="hoverable"
                                style={{
                                  background: 'var(--panel2)', padding: '6px 8px',
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  cursor: onSelectAirline ? 'pointer' : 'default',
                                }}
                              >
                                <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: 'var(--ink2)', minWidth: 28 }}>{a.code}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                                  <div style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)' }}>{a.hub} · {a.netShare}%</div>
                                </div>
                                <span style={{ ...MONO, fontSize: 12, fontWeight: 700, color: c, minWidth: 24, textAlign: 'right' }}>{a.exposureScore}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Overflight exposure */}
                  {ops.overflightExposure && ops.overflightExposure.length > 0 && (
                    <>
                      <div className="kicker" style={{ margin: '14px 0 6px' }}>
                        OVERFLIGHT EXPOSURE · {ops.overflightExposure.length} ROUTES
                      </div>
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--edge)', borderRadius: 3, background: 'var(--panel2)' }}>
                        {ops.overflightExposure.map((o, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 1fr', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--hover)', alignItems: 'center' }}>
                            <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: 'var(--ink2)' }}>{o.code}</span>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{o.airline}</span>
                            <span style={{ ...MONO, fontSize: 10, color: TEAL }}>{o.route}</span>
                            <span style={{ fontSize: 10, color: 'var(--mute)' }}>{o.impact}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
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

function Flights({ ev, selectedAirline }) {
  const [flights, setFlights] = useState([]);
  const [airlineInfo, setAirlineInfo] = useState(null);
  const [airports, setAirports] = useState([]);
  const [mode, setMode] = useState('mock');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [airlineList, setAirlineList] = useState([]);
  const [currentAirline, setCurrentAirline] = useState(selectedAirline);

  // Load the list of impacted airlines for the dropdown
  useEffect(() => {
    async function loadAirlines() {
      try {
        const res = await fetch(`http://localhost:3001/api/events/${ev.id}/airlines`);
        const data = await res.json();
        setAirlineList(data.airlines || []);
      } catch (e) { /* ignore */ }
    }
    loadAirlines();
  }, [ev.id]);

  // Sync external selection (from clicking an airline card)
  useEffect(() => {
    if (selectedAirline?.code) setCurrentAirline(selectedAirline);
  }, [selectedAirline?.code]);

  // Load flights when airline changes
  useEffect(() => {
    if (!currentAirline?.code) return;
    async function loadFlights() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://localhost:3001/api/events/${ev.id}/airlines/${currentAirline.code}/flights`);
        const data = await res.json();
        setFlights(data.flights || []);
        setAirlineInfo(data.airline);
        setAirports(data.airports || []);
        setMode(data.mode || 'mock');
      } catch (e) {
        setError('Failed to load flights: ' + e.message);
      }
      setLoading(false);
    }
    loadFlights();
  }, [ev.id, currentAirline?.code]);

  const STATUS_COLORS = {
    cancelled: CRIT,
    delayed: HIGH,
    rerouted: TEAL,
    monitoring: MOD,
    scheduled: 'var(--mute)',
  };

  const STATUS_LABELS = {
    cancelled: 'CANCELLED',
    delayed: 'DELAYED',
    rerouted: 'REROUTED',
    monitoring: 'MONITORING',
    scheduled: 'SCHEDULED',
  };

  const filtered = statusFilter === 'all'
    ? flights
    : flights.filter(f => f.status === statusFilter);

  const statusCounts = flights.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Airline selector + header */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
          {/* Airline dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="kicker" style={{ whiteSpace: 'nowrap' }}>AIRLINE</span>
            <select
              value={currentAirline?.code || ''}
              onChange={(e) => {
                const code = e.target.value;
                const airline = airlineList.find(a => a.code === code);
                if (airline) setCurrentAirline(airline);
              }}
              style={{
                ...MONO, fontSize: 13, padding: '8px 12px', minWidth: 260,
                border: '1px solid var(--edge)', background: 'var(--bg)',
                color: 'var(--ink2)', borderRadius: 3, cursor: 'pointer',
              }}
            >
              {airlineList.length === 0 && currentAirline && (
                <option value={currentAirline.code}>{currentAirline.name} ({currentAirline.code})</option>
              )}
              {airlineList.map(a => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name} ({a.exposure}, score {a.exposureScore})
                </option>
              ))}
            </select>
          </div>

          {/* Airline info */}
          {airlineInfo && (
            <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>
              Hub: {airlineInfo.hub} · {airlineInfo.dailyDepartures} daily departures
            </div>
          )}

          {/* Mode badge */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              ...MONO, fontSize: 9, padding: '3px 8px', borderRadius: 2, fontWeight: 700,
              border: `1px solid ${mode === 'real' ? '#34D399' : 'var(--edge)'}`,
              color: mode === 'real' ? '#34D399' : 'var(--mute)',
            }}>
              {mode === 'real' ? 'REAL AIRLINES' : 'MOCK AIRLINES'}
            </span>
          </div>
        </div>

        {/* Affected airports */}
        {airports.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <span className="kicker" style={{ marginRight: 8 }}>AFFECTED AIRPORTS:</span>
            {airports.map(a => (
              <span key={a} style={{
                ...MONO, fontSize: 11, padding: '2px 8px', margin: 2,
                border: '1px solid var(--edge)', borderRadius: 2, color: 'var(--ink2)',
              }}>
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Status summary */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`pill${statusFilter === 'all' ? ' on' : ''}`}
          >
            All ({flights.length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`pill${statusFilter === status ? ' on' : ''}`}
              style={statusFilter === status ? { borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status] } : {}}
            >
              {STATUS_LABELS[status] || status} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Flights table */}
      {!currentAirline?.code ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 13 }}>
          Select an airline from the dropdown above to view impacted flights.
        </div>
      ) : loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 13 }}>
          Loading flights...
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: CRIT, ...MONO, fontSize: 12 }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 12 }}>
          No flights found for this airline at the affected airports.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 80px 50px 30px 50px 100px 70px 60px 100px 90px',
            gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--line)',
            background: 'var(--panel2)',
          }}>
            {['FLIGHT', 'DATE', 'DAY', '', 'ORIGIN', 'DEST', 'AIRCRAFT', 'TIME', 'STATUS', 'IMPACT'].map((h, i) => (
              <div key={i} className="kicker">{h}</div>
            ))}
          </div>
          {/* Flight rows */}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filtered.map((f, i) => {
              const sc = STATUS_COLORS[f.status] || 'var(--mute)';
              const dayLabel = f.dayOffset === 0 ? 'Today' : f.dayOffset === 1 ? 'Tmrw' : `+${f.dayOffset}d`;
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 80px 50px 30px 50px 100px 70px 60px 100px 90px',
                    gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--hover)',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ ...MONO, fontSize: 12, fontWeight: 600, color: 'var(--ink2)' }}>{f.flt}</div>
                  <div style={{ ...MONO, fontSize: 11, color: TEAL, fontWeight: 600 }}>{f.date || '—'}</div>
                  <div style={{ ...MONO, fontSize: 10, color: f.dayOffset === 0 ? HIGH : 'var(--faint)', fontWeight: 600 }}>{dayLabel}</div>
                  <div style={{ color: 'var(--faint)', textAlign: 'center' }}>→</div>
                  <div style={{ ...MONO, fontSize: 12, fontWeight: 600 }}>{f.origin}</div>
                  <div style={{ ...MONO, fontSize: 12, fontWeight: 600 }}>{f.dest}</div>
                  <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>{f.type}</div>
                  <div style={{ ...MONO, fontSize: 11, color: 'var(--ink2)' }}>{f.scheduled}</div>
                  <div style={{
                    ...MONO, fontSize: 10, fontWeight: 700, textAlign: 'center',
                    padding: '3px 6px', borderRadius: 2,
                    border: `1px solid ${sc}60`, color: sc, background: sc + '10',
                  }}>
                    {STATUS_LABELS[f.status] || f.status}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>{f.impact}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info note */}
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--faint)', ...MONO, lineHeight: 1.5 }}>
        {mode === 'mock'
          ? 'Flight data from published mock schedules (schedule-store). '
          : 'Representative flights generated from airline hub structure, network share, and affected airports. '
        }
        Dates are based on the event's predicted impact window, starting from the event date.
      </div>
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState('detail');
  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAirline, setSelectedAirline] = useState(null);

  function handleSelectAirline(code, name) {
    setSelectedAirline({ code, name });
    setTab('flights');
  }

  useEffect(() => {
    async function loadEvent() {
      setLoading(true);
      // Try backend API first (live event)
      try {
        const data = await api.getEvent(id);
        if (data && data.id) {
          setEv(data);
          setLoading(false);
          return;
        }
      } catch (e) { /* fall back to static */ }
      // Fall back to static dm-data.json
      const staticEv = DM.EVENTS.find((e) => e.id === id) || DM.EVENTS[0];
      setEv(staticEv);
      setLoading(false);
    }
    loadEvent();
  }, [id]);

  if (loading || !ev) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mute)', ...MONO, fontSize: 13 }}>
        Loading event...
      </div>
    );
  }

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
        {tab === 'detail' && <Assessment ev={ev} onSelectAirline={handleSelectAirline} />}
        {tab === 'flights' && <Flights ev={ev} selectedAirline={selectedAirline} />}
        {tab === 'process' && <Process ev={ev} />}
        {tab === 'sop' && <Sop ev={ev} />}
        {tab === 'retro' && <Retro ev={ev} />}
      </div>
    </div>
  );
}
