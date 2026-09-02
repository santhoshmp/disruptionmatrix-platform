import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MONO, sevColor, statusColor, CYAN, CRIT, HIGH, OK } from '../theme.js';

const TABS = [
  { id: 'flights', label: 'Flight schedule', sub: 'Rotations flagged against active external threats' },
  { id: 'gantt', label: 'Schedule Gantt', sub: 'Aircraft utilisation with a recovery solver' },
  { id: 'fleet', label: 'Fleet', sub: 'Aircraft — tail, type, base, CAT IIIB certification, status' },
  { id: 'crew', label: 'Crew roster', sub: 'Individual crew, rank, base and duty status' },
  { id: 'pairings', label: 'Crew pairings', sub: 'Duty pairings and margin to FDP limits' },
  { id: 'banks', label: 'Bank structure', sub: 'Hub bank structure and disruption sensitivity' },
  { id: 'threats', label: 'Threat feed', sub: 'DisruptionMatrix events feeding the exposure model' }
];

// generic mock solver rules — delay per threat category, no airline-specific tail swaps
const SOLVER_RULES = {
  monsoon: { delayMin: 75, action: 'Delay past squall window' },
  convwx: { delayMin: 60, action: 'Ground stop — convective weather' },
  bommonsoon: { delayMin: 80, action: 'Delay past thunderstorm window' },
  blrstorms: { delayMin: 45, action: 'Arrival rate delay' },
  viesnow: { delayMin: 35, action: 'De-icing delay' },
  fuel: { delayMin: 25, action: 'Reduced-uplift delay' },
  delfog: { delayMin: 40, action: 'Hold for visibility' },
  zrhfog: { delayMin: 30, action: 'LVP delay' },
  fraatfm: { delayMin: 45, action: 'ATFM regulation delay' },
  delatc: { delayMin: 30, action: 'ATC flow control delay' },
  chnAtc: { delayMin: 20, action: 'ATFM delay' },
  gulf: { delayMin: 25, action: 'Reroute — extended block time' },
  dxbacongest: { delayMin: 30, action: 'Flow control delay' },
  viestrike: { delayMin: 25, action: 'Extended turnaround' },
  amslot: { delayMin: 20, action: 'Slot adjustment' },
  cokmonsoon: { delayMin: 15, action: 'Ground access delay' },
  cabincrew: { delayMin: 10, action: 'Monitor buffer' }
};

function hhmm(dec) {
  const h = Math.floor(dec % 24);
  const m = Math.round((dec - Math.floor(dec)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function computePlan(D) {
  const plan = {};
  D.FLIGHTS.forEach((f) => {
    const rule = SOLVER_RULES[f.threat];
    const sched = D.SCHEDULE[f.flt];
    if (!rule || !sched) return;
    plan[f.flt] = {
      tail: f.tail, dep: sched.dep + rule.delayMin / 60, dur: sched.dur,
      action: rule.action, delayMin: rule.delayMin, tailChanged: false
    };
  });
  return plan;
}

function ganttRows(D, scoreField, plan, threatFilter) {
  const barsByTail = {};
  const relevantTails = threatFilter ? new Set(D.FLIGHTS.filter((f) => f.threat === threatFilter).map((f) => f.tail)) : null;
  D.FLIGHTS.forEach((f) => {
    const sched = D.SCHEDULE[f.flt];
    if (!sched) return;
    if (relevantTails && !relevantTails.has(f.tail)) return;
    const p = plan && plan[f.flt];
    const tail = p ? p.tail : f.tail;
    const dep = p ? p.dep : sched.dep;
    const dur = p ? p.dur : sched.dur;
    const threat = D.THREATS.find((t) => t.id === f.threat);
    const color = threat ? sevColor(threat[scoreField]) : 'var(--mute2)';
    const leftPct = Math.max(0, (dep / 24) * 100);
    const widthPct = Math.max(1.6, (Math.min(24 - dep, dur / 60) / 24) * 100);
    (barsByTail[tail] = barsByTail[tail] || []).push({
      key: f.flt, title: `${f.flt} ${f.route}${p ? ' · ' + p.action : ''}`, label: f.flt, leftPct, widthPct, color
    });
  });
  return Object.keys(barsByTail).sort().map((tail) => ({ tail, bars: barsByTail[tail] }));
}

function GanttStrip({ rows }) {
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  return (
    <div style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: '0 0 90px', padding: '6px 10px' }} className="kicker">TAIL</div>
        <div style={{ flex: 1, position: 'relative', height: 24 }}>
          {ticks.map((h) => (
            <div key={h} style={{ position: 'absolute', left: `${(h / 24) * 100}%`, top: 0, ...MONO, fontSize: 9.5, color: 'var(--mute2)', borderLeft: '1px solid var(--line)', paddingLeft: 4 }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
      </div>
      {rows.map((r, i) => (
        <div key={r.tail} style={{ display: 'flex', borderBottom: '1px solid var(--hover)', background: i % 2 ? 'var(--panel2)' : 'transparent' }}>
          <div style={{ flex: '0 0 90px', padding: '8px 10px', ...MONO, fontSize: 11.5, color: 'var(--ink2)' }}>{r.tail}</div>
          <div style={{ flex: 1, position: 'relative', height: 32 }}>
            {r.bars.map((b) => (
              <div
                key={b.key} title={b.title}
                style={{
                  position: 'absolute', top: 5, height: 22, left: `${b.leftPct.toFixed(2)}%`, width: `${b.widthPct.toFixed(2)}%`,
                  background: b.color + '22', border: `1px solid ${b.color}`, color: 'var(--ink2)',
                  ...MONO, fontSize: 9.5, display: 'flex', alignItems: 'center', padding: '0 5px',
                  overflow: 'hidden', whiteSpace: 'nowrap', borderRadius: 2
                }}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Gantt({ airline, threatFilter, clearFilter }) {
  const D = airline.data;
  const scoreField = airline.scoreField;
  const accent = airline.accent;
  const [applied, setApplied] = useState(false);
  const plan = useMemo(() => (applied ? computePlan(D) : null), [applied, D]);
  const before = useMemo(() => ganttRows(D, scoreField, null, threatFilter), [D, scoreField, threatFilter]);
  const after = useMemo(() => (plan ? ganttRows(D, scoreField, plan, threatFilter) : []), [plan, D, scoreField, threatFilter]);
  const threatName = threatFilter ? (D.THREATS.find((t) => t.id === threatFilter) || {}).name : null;
  const affected = D.FLIGHTS.filter((f) => SOLVER_RULES[f.threat]).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {!applied ? (
          <button onClick={() => setApplied(true)} style={{ ...MONO, fontSize: 12, padding: '8px 14px', cursor: 'pointer', border: `1px solid ${accent}`, background: accent + '1F', color: 'var(--ink)' }}>
            Run recovery solver · {affected} affected flights
          </button>
        ) : (
          <button onClick={() => setApplied(false)} style={{ ...MONO, fontSize: 12, padding: '8px 14px', cursor: 'pointer', border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--mute)' }}>
            Reset proposal
          </button>
        )}
        {threatName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...MONO, fontSize: 11.5, color: accent }}>
            Filtered to: {threatName}
            <button onClick={clearFilter} style={{ cursor: 'pointer', border: '1px solid var(--edge)', background: 'transparent', color: 'var(--mute)', ...MONO, fontSize: 11 }}>clear ×</button>
          </div>
        )}
        <span style={{ ...MONO, fontSize: 11, color: 'var(--faint)' }}>Solver output is a proposal — nothing is auto-applied.</span>
      </div>

      <div className="kicker" style={{ marginBottom: 8 }}>CURRENT SCHEDULE</div>
      <GanttStrip rows={before} />

      {applied && (
        <>
          <div className="kicker" style={{ margin: '16px 0 8px' }}>PASSENGER IMPACT ALERTS</div>
          <SolverPaxAlerts plan={plan} airline={airline} />
          <div className="kicker" style={{ margin: '16px 0 8px' }}>SOLVER PROPOSAL</div>
          <GanttStrip rows={after} />
          <div className="kicker" style={{ margin: '16px 0 8px' }}>PROPOSED CHANGES</div>
          <table className="data">
            <thead>
              <tr><th>FLIGHT</th><th>TAIL BEFORE</th><th>TAIL AFTER</th><th>DEP BEFORE</th><th>DEP AFTER</th><th>ACTION</th><th>THREAT</th></tr>
            </thead>
            <tbody>
              {Object.keys(plan).map((flt) => {
                const f = D.FLIGHTS.find((x) => x.flt === flt);
                if (!f) return null;
                const sched = D.SCHEDULE[flt];
                const p = plan[flt];
                const threat = D.THREATS.find((t) => t.id === f.threat);
                const tc = threat ? sevColor(threat[scoreField]) : 'var(--mute)';
                return (
                  <tr key={flt}>
                    <td className="mono" style={{ color: 'var(--ink2)' }}>{flt}</td>
                    <td className="mono">{f.tail}</td>
                    <td className="mono" style={{ color: 'var(--ink3)' }}>{p.tail}</td>
                    <td className="mono">{hhmm(sched.dep)}</td>
                    <td className="mono" style={{ color: 'var(--ink2)' }}>{hhmm(p.dep)}</td>
                    <td>{p.action} (+{p.delayMin}m)</td>
                    <td><span style={{ ...MONO, fontSize: 10, padding: '3px 7px', border: `1px solid ${tc}`, color: tc }}>{threat ? threat.code : f.threat}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function dataset(id, D, scoreField, scoreLabel) {
  if (id === 'flights') return { cols: ['Flight', 'Route', 'Tail', 'Type', 'Bank', 'Pax', 'Connect', 'Cargo (t)', 'Linked threat'], rows: D.FLIGHTS.map((f) => [f.flt, f.route, f.tail, f.type, f.bank, f.pax, f.connectPax, f.cargo, f.threat]), numCols: [5, 6, 7] };
  if (id === 'fleet') return { cols: ['Tail', 'Type', 'Base', 'CAT IIIB', 'Status'], rows: D.FLEET.map((a) => [a.tail, a.type, a.base, a.catIIIB ? 'Yes' : 'No', a.status]), tagCols: [4] };
  if (id === 'crew') return { cols: ['Crew ID', 'Name', 'Rank', 'Base', 'Status', 'Duty remaining', 'Pairing'], rows: D.CREW.map((c) => [c.id, c.name, c.rank, c.base, c.status, `${Math.round(c.dutyRemaining * 100)}%`, c.pairing]), tagCols: [4] };
  if (id === 'pairings') return { cols: ['Pairing', 'Base', 'Route', 'Margin (min)', 'Status', 'Linked threat'], rows: D.PAIRINGS.map((p) => [p.id, p.base, p.route, p.margin, p.status, p.threat]), tagCols: [4] };
  if (id === 'banks') return { cols: ['Bank', 'Sub-label', 'Window', 'Kind', 'Severity (1–4)'], rows: D.BANKS.map((b) => [b.label, b.sub, b.window, b.kind, b.severity]) };
  if (id === 'threats') return { cols: ['Code', 'Name', 'Category', 'Region', 'EDPS', scoreLabel, 'Trajectory', 'Time to impact'], rows: D.THREATS.map((t) => [t.code, t.name, t.cat, t.region, t.edps, t[scoreField], t.traj, t.tti]) };
  return { cols: [], rows: [] };
}

const NOTES = {
  threats: 'This is the raw feed — see the airline radar for the exposure breakdown per event.',
  fleet: 'CAT IIIB certification determines which aircraft can operate in low-visibility conditions.',
  flights: 'Pax = total booked passengers · Connect = passengers with onward connections at the hub · Cargo in tonnes.'
};

function PaxImpactPanel({ airline }) {
  const D = airline.data;
  const scoreField = airline.scoreField;
  const atRisk = D.FLIGHTS.filter((f) => f.threat);
  const totalPax = atRisk.reduce((s, f) => s + f.pax, 0);
  const totalConnect = atRisk.reduce((s, f) => s + f.connectPax, 0);
  const totalCargo = atRisk.reduce((s, f) => s + f.cargo, 0);

  const byThreat = {};
  atRisk.forEach((f) => {
    if (!byThreat[f.threat]) byThreat[f.threat] = { flights: 0, pax: 0, connectPax: 0, cargo: 0 };
    byThreat[f.threat].flights++;
    byThreat[f.threat].pax += f.pax;
    byThreat[f.threat].connectPax += f.connectPax;
    byThreat[f.threat].cargo += f.cargo;
  });

  return (
    <div style={{ margin: '0 16px 16px', border: '1px solid var(--line)', background: 'var(--panel)' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CRIT }} />
        <div className="kicker" style={{ margin: 0 }}>PASSENGER IMPACT · AT-RISK FLIGHTS</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--hover)' }}>
        <div style={{ padding: '14px 16px', borderRight: '1px solid var(--hover)' }}>
          <div style={{ ...MONO, fontSize: 28, fontWeight: 600, color: CRIT }}>{totalPax.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>Total passengers on at-risk flights</div>
        </div>
        <div style={{ padding: '14px 16px', borderRight: '1px solid var(--hover)' }}>
          <div style={{ ...MONO, fontSize: 28, fontWeight: 600, color: HIGH }}>{totalConnect.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>Connecting passengers at misconnection risk</div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ ...MONO, fontSize: 28, fontWeight: 600, color: 'var(--ink2)' }}>{totalCargo.toFixed(1)}t</div>
          <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>Cargo on at-risk rotations</div>
        </div>
      </div>
      <table className="data" style={{ border: 'none' }}>
        <thead>
          <tr><th>THREAT</th><th>FLIGHTS</th><th>PAX</th><th>CONNECTING PAX</th><th>CARGO (t)</th></tr>
        </thead>
        <tbody>
          {Object.entries(byThreat).map(([tid, d]) => {
            const t = D.THREATS.find((x) => x.id === tid);
            const tc = t ? sevColor(t[scoreField]) : 'var(--mute)';
            return (
              <tr key={tid}>
                <td><span style={{ ...MONO, fontSize: 10, padding: '3px 7px', border: `1px solid ${tc}`, color: tc }}>{t ? t.code : tid}</span> <span style={{ fontSize: 12.5, marginLeft: 6 }}>{t ? t.name : tid}</span></td>
                <td className="mono">{d.flights}</td>
                <td className="mono" style={{ color: 'var(--ink2)' }}>{d.pax.toLocaleString()}</td>
                <td className="mono" style={{ color: d.connectPax > 100 ? HIGH : 'var(--ink3)' }}>{d.connectPax.toLocaleString()}</td>
                <td className="mono">{d.cargo.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SolverPaxAlerts({ plan, airline }) {
  const D = airline.data;
  const scoreField = airline.scoreField;
  const accent = airline.accent;
  const alerts = [];
  Object.keys(plan).forEach((flt) => {
    const f = D.FLIGHTS.find((x) => x.flt === flt);
    if (!f) return;
    const p = plan[flt];
    const threat = D.THREATS.find((t) => t.id === f.threat);
    const tc = threat ? sevColor(threat[scoreField]) : 'var(--mute)';

    if (p.delayMin >= 60 && f.connectPax > 30) {
      alerts.push({
        flt, route: f.route, delayMin: p.delayMin, pax: f.pax, connectPax: f.connectPax,
        action: p.action, threatCode: threat ? threat.code : f.threat, tc, severity: 'critical',
        msg: `${f.connectPax} connecting passengers on ${flt} (${f.route}) face likely misconnection — delay ${p.delayMin} min exceeds minimum connect time.`
      });
    } else if (p.delayMin >= 30 && f.connectPax > 50) {
      alerts.push({
        flt, route: f.route, delayMin: p.delayMin, pax: f.pax, connectPax: f.connectPax,
        action: p.action, threatCode: threat ? threat.code : f.threat, tc, severity: 'warning',
        msg: `${f.connectPax} connecting passengers on ${flt} (${f.route}) at risk — delay ${p.delayMin} min approaching connect-time threshold.`
      });
    }
    if (p.tailChanged && (f.type === 'A350-900' || f.type === 'A321neo')) {
      alerts.push({
        flt, route: f.route, delayMin: p.delayMin, pax: f.pax, connectPax: f.connectPax,
        action: p.action, threatCode: threat ? threat.code : f.threat, tc, severity: 'info',
        msg: `Tail swap on ${flt} (${f.route}) — ${f.pax} passengers re-accommodated to new aircraft ${p.tail}.`
      });
    }
  });

  const totalPaxDelayed = Object.keys(plan).reduce((s, flt) => {
    const f = D.FLIGHTS.find((x) => x.flt === flt);
    return s + (f ? f.pax : 0);
  }, 0);
  const totalConnectAtRisk = Object.keys(plan).reduce((s, flt) => {
    const f = D.FLIGHTS.find((x) => x.flt === flt);
    return s + (f ? f.connectPax : 0);
  }, 0);

  const critical = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');
  const infos = alerts.filter((a) => a.severity === 'info');

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ padding: '10px 14px', border: `1px solid ${CRIT}`, background: CRIT + '14' }}>
          <div style={{ ...MONO, fontSize: 22, fontWeight: 600, color: CRIT }}>{totalPaxDelayed.toLocaleString()}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>Passengers on delayed flights</div>
        </div>
        <div style={{ padding: '10px 14px', border: `1px solid ${HIGH}`, background: HIGH + '14' }}>
          <div style={{ ...MONO, fontSize: 22, fontWeight: 600, color: HIGH }}>{totalConnectAtRisk.toLocaleString()}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>Connecting pax at misconnection risk</div>
        </div>
        <div style={{ padding: '10px 14px', border: `1px solid ${CRIT}`, background: CRIT + '14' }}>
          <div style={{ ...MONO, fontSize: 22, fontWeight: 600, color: CRIT }}>{critical.length}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>Critical pax alerts</div>
        </div>
        <div style={{ padding: '10px 14px', border: `1px solid ${HIGH}`, background: HIGH + '14' }}>
          <div style={{ ...MONO, fontSize: 22, fontWeight: 600, color: HIGH }}>{warnings.length}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>Warnings</div>
        </div>
      </div>

      {critical.length > 0 && (
        <div style={{ border: `1px solid ${CRIT}`, background: CRIT + '0D', marginBottom: 8 }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${CRIT}33`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: CRIT }} />
            <span className="kicker" style={{ margin: 0, color: CRIT }}>CRITICAL · LIKELY MISCONNECTIONS</span>
          </div>
          {critical.map((a, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: i < critical.length - 1 ? '1px solid var(--hover)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ ...MONO, fontSize: 10, padding: '3px 7px', border: `1px solid ${a.tc}`, color: a.tc, flexShrink: 0 }}>{a.threatCode}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{a.msg}</div>
                <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', display: 'flex', gap: 14 }}>
                  <span>{a.pax} total pax</span>
                  <span style={{ color: HIGH }}>{a.connectPax} connecting</span>
                  <span>Delay: +{a.delayMin}m</span>
                  <span>{a.action}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ border: `1px solid ${HIGH}`, background: HIGH + '0D', marginBottom: 8 }}>
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${HIGH}33`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: HIGH }} />
            <span className="kicker" style={{ margin: 0, color: HIGH }}>WARNING · CONNECT-TIME RISK</span>
          </div>
          {warnings.map((a, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: i < warnings.length - 1 ? '1px solid var(--hover)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ ...MONO, fontSize: 10, padding: '3px 7px', border: `1px solid ${a.tc}`, color: a.tc, flexShrink: 0 }}>{a.threatCode}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{a.msg}</div>
                <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', display: 'flex', gap: 14 }}>
                  <span>{a.pax} total pax</span>
                  <span style={{ color: HIGH }}>{a.connectPax} connecting</span>
                  <span>Delay: +{a.delayMin}m</span>
                  <span>{a.action}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {infos.length > 0 && (
        <div style={{ border: '1px solid var(--edge)', background: 'var(--panel2)' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
            <span className="kicker" style={{ margin: 0, color: accent }}>INFO · TAIL SWAP RE-ACCOMMODATION</span>
          </div>
          {infos.map((a, i) => (
            <div key={i} style={{ padding: '10px 14px', borderBottom: i < infos.length - 1 ? '1px solid var(--hover)' : 'none', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ ...MONO, fontSize: 10, padding: '3px 7px', border: `1px solid ${a.tc}`, color: a.tc, flexShrink: 0 }}>{a.threatCode}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--ink2)', marginBottom: 3 }}>{a.msg}</div>
                <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', display: 'flex', gap: 14 }}>
                  <span>{a.pax} total pax</span>
                  <span>{a.connectPax} connecting</span>
                  <span>{a.action}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{ padding: '12px 16px', border: `1px solid ${OK}`, background: OK + '0D', ...MONO, fontSize: 12, color: OK }}>
          No passenger impact alerts — all proposed delays are within connect-time thresholds.
        </div>
      )}
    </div>
  );
}

export default function DataExplorer({ airline }) {
  const D = airline.data;
  const scoreField = airline.scoreField;
  const scoreLabel = airline.scoreLabel;
  const accent = airline.accent;
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'flights';
  const threatFilter = params.get('threat') || null;
  const [query, setQuery] = useState('');

  const setTab = (id) => { setParams(id === 'flights' ? {} : { tab: id, ...(threatFilter && id === 'gantt' ? { threat: threatFilter } : {}) }); setQuery(''); };
  const cur = TABS.find((t) => t.id === tab) || TABS[0];
  const ds = dataset(tab, D, scoreField, scoreLabel);
  const q = query.trim().toLowerCase();
  const rows = ds.rows.filter((r) => !q || r.some((v) => String(v).toLowerCase().includes(q)));

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <div style={{ flex: '0 0 240px', borderRight: '1px solid var(--line)', background: 'var(--panel2)', overflow: 'auto', padding: '12px 8px' }}>
        <div className="kicker" style={{ padding: '0 10px', marginBottom: 10 }}>DATASETS</div>
        {TABS.map((t) => {
          const cnt = t.id === 'gantt' ? D.FLIGHTS.filter((f) => SOLVER_RULES[f.threat]).length : dataset(t.id, D, scoreField, scoreLabel).rows.length;
          const on = tab === t.id;
          return (
            <div
              key={t.id} onClick={() => setTab(t.id)} className="hoverable"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', fontSize: 13,
                borderLeft: `2px solid ${on ? accent : 'transparent'}`, background: on ? 'var(--hover)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--mute)'
              }}
            >
              <span>{t.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--faint)' }}>{cnt}</span>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{cur.label}</div>
            <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{cur.sub}</div>
          </div>
          {tab !== 'gantt' && (
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter rows…"
              style={{ marginLeft: 'auto', width: 240, padding: '8px 12px', border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--ink)', ...MONO, fontSize: 12, outline: 'none' }}
            />
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: tab === 'gantt' ? 18 : 0 }}>
          {tab === 'gantt' ? (
            <Gantt airline={airline} threatFilter={threatFilter} clearFilter={() => setParams({ tab: 'gantt' })} />
          ) : (
            <>
              <table className="data">
                <thead>
                  <tr>{ds.cols.map((c) => <th key={c}>{c.toUpperCase()}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((v, i) => {
                        const isTag = (ds.tagCols || []).includes(i);
                        return (
                          <td key={i}>
                            {isTag ? (
                              <span style={{ ...MONO, fontSize: 11, padding: '3px 8px', border: `1px solid ${statusColor(v)}`, color: statusColor(v) }}>{v}</span>
                            ) : (
                              <span style={typeof v === 'number' ? { ...MONO, color: 'var(--ink2)' } : undefined}>{v}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <div style={{ padding: 24, color: 'var(--mute)', fontSize: 13 }}>No rows match the filter.</div>}
              <div style={{ padding: '12px 16px', ...MONO, fontSize: 11, color: 'var(--faint)' }}>
                {NOTES[tab] || 'Synthetic PoC data.'} · {rows.length} of {ds.rows.length} rows
              </div>
              {tab === 'flights' && <PaxImpactPanel airline={airline} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
