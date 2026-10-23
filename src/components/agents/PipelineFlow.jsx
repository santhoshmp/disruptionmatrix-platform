// PipelineFlow.jsx — Full pipeline tab with 9-step detail, execution stats, and run history

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { HELP } from './sourceMode.jsx';

const STEP_DETAILS = [
  { step: 1, name: 'Collection', desc: 'Agents poll their data sources and collect raw observations (METAR, NOTAMs, bulletins, advisories).', input: 'External sources', output: 'Raw signals' },
  { step: 2, name: 'Normalization', desc: 'Raw data is normalized into a common signal schema with agent ID, region, category, airports, evidence, and factor hints.', input: 'Raw signals', output: 'Normalized signals' },
  { step: 3, name: 'Correlation', desc: 'Signals are grouped by category + geographic proximity (<200km) + time window (<60min) or shared airport (<120min). Deduplication merges evidence.', input: 'Normalized signals', output: 'Candidate events' },
  { step: 4, name: 'Scoring (EDPS)', desc: 'Each candidate is scored using the 8-factor EDPS model: Intensity, Geographic Scope, Duration, Cascade Potential, Reversibility, Time to Impact, Confidence, and Novelty.', input: 'Candidate events', output: 'Scored events (0-100)' },
  { step: 5, name: 'Domain Impact', desc: 'A 9-domain impact vector is computed (Airport Ops, Flight Schedule, Rotations, Passengers, Crew, Cargo, Catering, Maintenance, Regulatory) using category-specific weight profiles.', input: 'Scored events', output: 'Domain impact vector' },
  { step: 6, name: 'Causal Chain', desc: 'First/second/Third order effects are expanded with likelihood decay (100%, 82%, 65%) and category-specific lead times.', input: 'Scored events', output: 'Causal chain (3 orders)' },
  { step: 7, name: 'Evidence Assembly', desc: 'Evidence trail is normalized with tier → credibility mapping (Tier 1 = Primary, Tier 2 = Corroborating, Tier 3 = Indirect).', input: 'Candidate evidence', output: 'Evidence trail' },
  { step: 8, name: 'Impact Assessment', desc: 'Per-airport and per-airline exposure is computed using the 5-factor weighted model (hub, movement share, fleet capability, bank overlap, overflight).', input: 'Scored events + schedules', output: 'OPS impact assessment' },
  { step: 9, name: 'Event Store', desc: 'Events are published or updated in the store. New events get a DM reference number. WebSocket notifies all connected clients.', input: 'Complete event entity', output: 'Stored event + OPS' },
];

export default function PipelineFlow() {
  const [pipeline, setPipeline] = useState([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [autoRun, setAutoRun] = useState(false);
  const [intervalMs, setIntervalMs] = useState(10000);
  const [archivedEvents, setArchivedEvents] = useState(0);

  async function loadPipeline() {
    try {
      const data = await api.getPipeline();
      setPipeline(data.pipeline || []);
      setAutoRun(!!data.autoRunning);
      if (data.intervalMs) setIntervalMs(data.intervalMs);
      setArchivedEvents(data.archivedEvents || 0);
      if (data.lastRun) setLastRun(data.lastRun);
      if (data.runHistory) setRunHistory(data.runHistory);
    } catch (e) { /* server may be down */ }
  }

  useEffect(() => {
    loadPipeline();
    const timer = setInterval(loadPipeline, 5000);
    return () => clearInterval(timer);
  }, []);

  async function handleRun() {
    setRunning(true);
    try {
      await api.runPipeline();
      await loadPipeline();
    } catch (e) { /* ignore */ }
    setRunning(false);
  }

  const totalItems = pipeline.reduce((sum, s) => sum + (s.itemCount || 0), 0);

  return (
    <div style={{ padding: '14px 22px', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Pipeline</div>
            <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em' }}>
              9-STEP SIGNAL-TO-EVENT PIPELINE · {totalItems} TOTAL ITEMS
            </div>
          </div>
          <InfoIcon title={HELP.pipeline.title} sections={HELP.pipeline.sections} placement="right" />
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            ...MONO, fontSize: 12, padding: '8px 18px', cursor: running ? 'wait' : 'pointer',
            border: `1px solid ${running ? 'var(--edge)' : TEAL}`,
            background: running ? 'var(--panel2)' : TEAL + '15',
            color: running ? 'var(--mute)' : TEAL, borderRadius: 4, fontWeight: 600,
          }}
        >
          {running ? 'RUNNING...' : '▶ RUN NOW'}
        </button>
      </div>

      {/* Pipeline status bar */}
      <div style={{
        marginBottom: 16, padding: '10px 14px', border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: autoRun ? '#34D399' : 'var(--mute)',
            boxShadow: autoRun ? '0 0 6px #34D399' : 'none', animation: autoRun ? 'dmPulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ ...MONO, fontSize: 10, color: autoRun ? '#34D399' : 'var(--mute)', fontWeight: 600 }}>
            {autoRun ? `AUTO-RUNNING (every ${Math.round(intervalMs / 1000)}s)` : 'MANUAL ONLY'}
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)' }}>|</span>
        <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
          {pipeline.length} steps loaded
        </span>
        {lastRun?.timestamp && (
          <>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)' }}>|</span>
            <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
              LAST RUN {new Date(lastRun.timestamp).toLocaleTimeString('en-GB', { hour12: false })}
              {lastRun.processed > 0 ? ` · ${lastRun.processed} signals` : ' · idle'}
            </span>
          </>
        )}
        {archivedEvents > 0 && (
          <span style={{ ...MONO, fontSize: 9.5, color: 'var(--faint)', marginLeft: 'auto' }}>
            item counts show ACTIVE events ({archivedEvents} archived not counted)
          </span>
        )}
      </div>

      {/* Step-by-step detail table */}
      <div style={{ marginBottom: 20 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>PIPELINE STEPS</div>
        <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--sunken)', borderBottom: '1px solid var(--line)' }}>
                <th style={{ ...MONO, fontSize: 9, padding: '8px 10px', textAlign: 'left', color: 'var(--faint)', width: 50 }}>STEP</th>
                <th style={{ ...MONO, fontSize: 9, padding: '8px 10px', textAlign: 'left', color: 'var(--faint)', width: 140 }}>NAME</th>
                <th style={{ ...MONO, fontSize: 9, padding: '8px 10px', textAlign: 'left', color: 'var(--faint)' }}>DESCRIPTION</th>
                <th style={{ ...MONO, fontSize: 9, padding: '8px 10px', textAlign: 'left', color: 'var(--faint)', width: 130 }}>INPUT</th>
                <th style={{ ...MONO, fontSize: 9, padding: '8px 10px', textAlign: 'left', color: 'var(--faint)', width: 130 }}>OUTPUT</th>
                <th style={{ ...MONO, fontSize: 9, padding: '8px 10px', textAlign: 'right', color: 'var(--faint)', width: 70 }}>ITEMS</th>
              </tr>
            </thead>
            <tbody>
              {STEP_DETAILS.map((sd, i) => {
                const liveStep = pipeline.find((p) => p.step === sd.step);
                const count = liveStep?.itemCount ?? 0;
                return (
                  <tr key={sd.step} style={{ borderBottom: i < STEP_DETAILS.length - 1 ? '1px solid var(--hover)' : 'none' }}>
                    <td style={{ ...MONO, fontSize: 12, fontWeight: 700, padding: '8px 10px', color: 'var(--faint)' }}>{sd.step}</td>
                    <td style={{ fontSize: 11, fontWeight: 600, padding: '8px 10px', color: TEAL }}>{sd.name}</td>
                    <td style={{ fontSize: 10.5, padding: '8px 10px', color: 'var(--ink3)', lineHeight: 1.4 }}>{sd.desc}</td>
                    <td style={{ ...MONO, fontSize: 9.5, padding: '8px 10px', color: 'var(--mute)' }}>{sd.input}</td>
                    <td style={{ ...MONO, fontSize: 9.5, padding: '8px 10px', color: 'var(--mute)' }}>{sd.output}</td>
                    <td style={{ ...MONO, fontSize: 14, fontWeight: 700, padding: '8px 10px', textAlign: 'right', color: count > 0 ? TEAL : 'var(--faint)' }}>{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last run result */}
      {lastRun && (
        <div style={{ marginBottom: 20 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>LAST RUN RESULT</div>
          <div style={{ border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4, padding: '14px' }}>
            {/* Summary line + duration */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.4 }}>
                {lastRun.message || 'Pipeline run complete.'}
              </span>
              <span style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>
                {lastRun.durationMs != null ? `${lastRun.durationMs}ms` : ''}
              </span>
            </div>

            {/* Summary stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
              <RunStat label="SIGNALS PROCESSED" value={lastRun.processed ?? 0} color={TEAL} />
              <RunStat label="CANDIDATES FORMED" value={lastRun.candidates ?? 0} color={HIGH} />
              <RunStat label="EVENTS CREATED" value={lastRun.eventsCreated ?? 0} color={CRIT} />
              <RunStat label="EVENTS UPDATED" value={lastRun.eventsUpdated ?? 0} color={MOD} />
              <RunStat label="OPS COMPUTED" value={lastRun.opsComputed ?? 0} color={LOW} />
            </div>

            {/* Per-step breakdown */}
            {lastRun.steps && (
              <div>
                <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 6, letterSpacing: '0.05em' }}>
                  PER-STEP ITEM COUNTS
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {lastRun.steps.map((s) => (
                    <div key={s.step} style={{
                      ...MONO, fontSize: 10, padding: '4px 10px', border: '1px solid var(--edge)',
                      borderRadius: 3, background: 'var(--panel)', color: 'var(--mute)',
                    }}>
                      <span style={{ color: 'var(--faint)' }}>{s.step}.</span> {s.name}: <span style={{ color: TEAL, fontWeight: 700 }}>{s.items}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Run history */}
      {runHistory.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 8 }}>RUN HISTORY · LAST {runHistory.length}</div>
          <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--sunken)', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>TIME</th>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>SIGNALS</th>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>CANDIDATES</th>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>CREATED</th>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>UPDATED</th>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>OPS</th>
                  <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>DURATION</th>
                </tr>
              </thead>
              <tbody>
                {runHistory.map((r, i) => (
                  <tr key={i} style={{ borderBottom: i < runHistory.length - 1 ? '1px solid var(--hover)' : 'none' }}>
                    <td style={{ ...MONO, fontSize: 10, padding: '6px 10px', color: 'var(--mute)' }}>
                      {new Date(r.timestamp).toLocaleTimeString('en-GB', { hour12: false })}
                    </td>
                    <td style={{ ...MONO, fontSize: 11, fontWeight: 600, padding: '6px 10px', textAlign: 'right', color: TEAL }}>{r.processed ?? 0}</td>
                    <td style={{ ...MONO, fontSize: 11, fontWeight: 600, padding: '6px 10px', textAlign: 'right', color: HIGH }}>{r.candidates ?? 0}</td>
                    <td style={{ ...MONO, fontSize: 11, fontWeight: 600, padding: '6px 10px', textAlign: 'right', color: CRIT }}>{r.eventsCreated ?? 0}</td>
                    <td style={{ ...MONO, fontSize: 11, fontWeight: 600, padding: '6px 10px', textAlign: 'right', color: MOD }}>{r.eventsUpdated ?? 0}</td>
                    <td style={{ ...MONO, fontSize: 11, fontWeight: 600, padding: '6px 10px', textAlign: 'right', color: LOW }}>{r.opsComputed ?? 0}</td>
                    <td style={{ ...MONO, fontSize: 10, padding: '6px 10px', textAlign: 'right', color: 'var(--mute)' }}>{r.durationMs ?? 0}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RunStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 6px', border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel)' }}>
      <div style={{ ...MONO, fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ ...MONO, fontSize: 8, color: 'var(--faint)', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}
