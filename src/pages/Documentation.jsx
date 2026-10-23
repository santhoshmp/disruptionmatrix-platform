import { useState } from 'react';
import { MONO, TEAL } from '../theme.js';

// ── User-facing "How It Works" guide ─────────────────────────────
// Plain-English documentation: sources → signals → score → impact.
// Keep language non-technical; technical detail belongs in Admin/Master Data.

const SECTIONS = [
  { id: 'overview', title: 'What this application does' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'sources', title: 'Where the data comes from' },
  { id: 'pipeline', title: 'How raw data becomes a threat event' },
  { id: 'score', title: 'How the threat score is calculated' },
  { id: 'factors', title: 'The eight scoring factors' },
  { id: 'bands', title: 'What the bands and levels mean' },
  { id: 'impact', title: 'Operational impact (OPS) assessment' },
  { id: 'lifecycle', title: 'Event lifecycle and archiving' },
  { id: 'profiling', title: 'Threat profiling' },
  { id: 'controls', title: 'What administrators can control' },
];

const FACTOR_DOC = [
  { name: 'Probability of occurrence', w: '18%', desc: 'How likely the event is to occur or persist. Derived from the number of independent sources reporting it, forecast vs observed data, and corroboration between agents.' },
  { name: 'Severity if realised', w: '18%', desc: 'How bad the operational impact would be. Based on the hazard type\'s default severity (master data) adjusted by the observed magnitude (e.g. wind speed, visibility).' },
  { name: 'Time to impact', w: '14%', desc: 'How soon operations are affected. Mapped through the time-to-impact bands: imminent ~100, very short ~85, short ~65, medium ~40, long ~20.' },
  { name: 'Geographic reach', w: '12%', desc: 'How large an area is affected — number of airports in the affected zone, or the signal\'s geo radius.' },
  { name: 'Expected duration', w: '12%', desc: 'How long the disruption will last. Mapped through duration bands: very short ~10, short ~30, medium ~55, long and extended higher.' },
  { name: 'Escalation rate', w: '10%', desc: 'Whether the situation is worsening, stable, or improving — derived from recent score movement and signal volume trend.' },
  { name: 'Source credibility', w: '10%', desc: 'Trust in the reporting source, from the source-tier table: Tier 1 official APIs (NOAA, USGS, FAA) rank highest; social signals lowest.' },
  { name: 'Prediction confidence', w: '6%', desc: 'Confidence in the assessment itself — agreement between sources and forecast spread. Low-confidence events are flagged for review rather than auto-escalated.' },
];

const STAGES = [
  ['Collect', 'Agents poll external sources on their own interval (2–60 min depending on type) and emit raw signals.'],
  ['Correlate', 'Signals about the same real-world condition are grouped into candidate events; near-duplicates are merged across runs.'],
  ['Score', 'Each candidate gets a 0–100 EDPS score from the eight weighted factors (see below).'],
  ['Impact', 'A domain-impact model estimates which operational areas (flights, crew, cargo…) are exposed, and airport/airline exposure is counted.'],
  ['Enrich', 'Evidence links, causal chain (cause → effect → consequence), and OPS impact details are assembled and preserved.'],
  ['Publish', 'Finished events land on the Threat Board and World Map; updates keep the score and evidence fresh.'],
];

const SOURCE_TIERS = [
  ['Tier 1 — Official/public APIs', 'NOAA Aviation Weather, USGS earthquakes, FAA status & TFRs, NASA EONET, Open-Meteo. Highest credibility; used directly for scoring.'],
  ['Tier 2 — Aviation data providers', 'adsb.lol live positions (free), OpenSky states/flights, AirLabs & AviationStack schedules (need API keys).'],
  ['Tier 3 — News & advisories', 'GDELT global event database, SafeAirspace conflict-zone risk advisories.'],
  ['Tier 4 — Social', 'Reddit aviation subs. Corroboration only — enriches existing events, rarely creates them.'],
  ['Internal', 'Airports, airlines, regions, hazard types, band values — maintained in Master Data (PostgreSQL ref_* tables).'],
  ['Mock / fallback', 'When a provider is unavailable or unkeyed, a mock connector can substitute representative data so the pipeline still functions. These are labelled, never hidden.'],
];

function Row({ cols, header }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '180px 1fr',
      padding: '9px 14px', borderBottom: '1px solid var(--hover)',
      background: header ? 'var(--panel3)' : 'transparent',
    }}>
      <div style={{ ...MONO, fontSize: header ? 9 : 10.5, fontWeight: 700, color: header ? 'var(--faint)' : TEAL, letterSpacing: '0.04em' }}>{cols[0]}</div>
      <div style={{ fontSize: header ? 9 : 11.5, color: header ? 'var(--faint)' : 'var(--mute)', lineHeight: 1.55, fontWeight: header ? 700 : 400, letterSpacing: header ? '0.04em' : 0 }}>{cols[1]}</div>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 36, scrollMarginTop: 20 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>{title.toUpperCase()}</div>
      <div style={{ border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel2)', overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  );
}

function P({ children }) {
  return <div style={{ padding: '12px 14px', fontSize: 12.5, lineHeight: 1.75, color: 'var(--mute)' }}>{children}</div>;
}

// ── Architecture diagram (inline SVG, theme-aware) ────────────────

function Box({ x, y, w, h, title, sub, accent }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4}
        fill="var(--panel3)" stroke={accent || 'var(--edge)'} strokeWidth={accent ? 1.5 : 1} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 4)} textAnchor="middle"
        fill="var(--ink)" fontSize={11} fontWeight={700} fontFamily="inherit">{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle"
        fill="var(--faint)" fontSize={8.5} fontFamily="ui-monospace,monospace">{sub}</text>}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label }) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--edge)" strokeWidth={1.4} />
      <path d={arrowHead(x2, y2, x1, y1)} fill="var(--edge)" />
      {label && <text x={mx} y={my - 5} textAnchor="middle" fill="var(--faint)" fontSize={8.5} fontFamily="ui-monospace,monospace">{label}</text>}
    </g>
  );
}

function arrowHead(tx, ty, fx, fy) {
  const a = Math.atan2(ty - fy, tx - fx), s = 7;
  const p1 = [tx, ty];
  const p2 = [tx - s * Math.cos(a - 0.42), ty - s * Math.sin(a - 0.42)];
  const p3 = [tx - s * Math.cos(a + 0.42), ty - s * Math.sin(a + 0.42)];
  return `M${p1} L${p2} L${p3} Z`;
}

function ArchDiagram() {
  return (
    <svg viewBox="0 0 960 360" style={{ width: '100%', display: 'block' }}>
      {/* Sources column */}
      <Box x={10} y={20}  w={150} h={38} title="Weather APIs" sub="NOAA · Open-Meteo" />
      <Box x={10} y={66}  w={150} h={38} title="Flights" sub="adsb.lol · OpenSky · AirLabs" />
      <Box x={10} y={112} w={150} h={38} title="News & Airspace" sub="GDELT · SafeAirspace · FAA" />
      <Box x={10} y={158} w={150} h={38} title="Earth & Social" sub="USGS · EONET · Reddit" />

      <Arrow x1={160} y1={39}  x2={205} y2={75} />
      <Arrow x1={160} y1={85}  x2={205} y2={95} />
      <Arrow x1={160} y1={131} x2={205} y2={115} />
      <Arrow x1={160} y1={177} x2={205} y2={135} />

      {/* Agents */}
      <Box x={205} y={66} w={140} h={76} title="Agents ×156" sub="poll on own interval" accent={TEAL} />
      <Arrow x1={345} y1={104} x2={390} y2={104} label="signals" />

      {/* Signal buffer */}
      <Box x={390} y={80} w={110} h={48} title="Signal buffer" sub="recent raw signals" />

      {/* Pipeline vertical stack */}
      <Arrow x1={500} y1={104} x2={545} y2={60} />
      <Box x={545} y={20}  w={140} h={34} title="Correlate" sub="group same event" />
      <Arrow x1={685} y1={37} x2={725} y2={37} />
      <Box x={725} y={20}  w={120} h={34} title="EDPS score" sub="8 weighted factors" accent={TEAL} />
      <Arrow x1={785} y1={54} x2={785} y2={78} />
      <Box x={725} y={78}  w={120} h={34} title="OPS impact" sub="9 domains · exposure" />
      <Arrow x1={725} y1={95} x2={545} y2={95} />
      <Box x={545} y={78}  w={140} h={34} title="Enrich" sub="evidence · causal chain" />
      <Arrow x1={615} y1={112} x2={615} y2={145} />

      {/* Event store */}
      <Box x={545} y={145} w={140} h={40} title="Event store" sub="PostgreSQL + live cache" accent={TEAL} />

      {/* UI row */}
      <Arrow x1={615} y1={185} x2={615} y2={215} />
      <Box x={420} y={215} w={110} h={34} title="Threat Board" sub="prioritised list" />
      <Box x={545} y={215} w={110} h={34} title="World Map" sub="geo view" />
      <Box x={670} y={215} w={110} h={34} title="Profiling" sub="deep analysis" />
      <Box x={795} y={215} w={110} h={34} title="AI Assistant" sub="LLM answers" />
      <path d="M475 215 h405" stroke="var(--edge)" strokeWidth={1.4} />

      {/* Master data */}
      <Box x={205} y={300} w={200} h={40} title="Master Data (PostgreSQL ref_*)" sub="airports · regions · factors · bands" />
      <Arrow x1={405} y1={320} x2={545} y2={180} label="config & reference" />
      <Arrow x1={310} y1={300} x2={275} y2={142} label="regions / airports" />

      {/* Admin */}
      <Box x={700} y={300} w={160} h={40} title="Admin settings" sub="weights · bands · lifecycle" />
      <Arrow x1={780} y1={300} x2={785} y2={114} label="tuning" />

      {/* Archiver */}
      <Box x={420} y={300} w={130} h={40} title="Archiver" sub="stale / max-age sweep" />
      <Arrow x1={500} y1={300} x2={580} y2={185} label="archive" />
    </svg>
  );
}

export default function Documentation() {
  const [active, setActive] = useState('overview');

  function jump(e, id) {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollBehavior: 'smooth' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, padding: '20px 24px', maxWidth: 1100 }}>
      {/* Side TOC */}
      <nav style={{ position: 'sticky', top: 20, alignSelf: 'start' }}>
        <div className="kicker" style={{ marginBottom: 8 }}>GUIDE</div>
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`}
            onClick={(e) => jump(e, s.id)}
            style={{
              display: 'block', padding: '5px 8px', fontSize: 11, textDecoration: 'none',
              color: active === s.id ? TEAL : 'var(--mute)', fontWeight: active === s.id ? 700 : 400,
              borderLeft: `2px solid ${active === s.id ? TEAL : 'var(--edge)'}`,
              cursor: 'pointer',
            }}>
            {s.title}
          </a>
        ))}
      </nav>

      <div>
        <Section id="overview" title="What this application does">
          <P>
            DisruptionMatrix continuously watches aviation-relevant sources worldwide and turns what
            it sees into a prioritised list of <strong style={{ color: 'var(--ink)' }}>threat events</strong> —
            storms, airspace closures, strikes, geopolitical flashpoints, earthquakes — each scored by
            how urgently it deserves attention and mapped to the operational areas it would disrupt.
            Agents do the watching, the pipeline does the reasoning, and the board/map/profiling
            screens present the results.
          </P>
        </Section>

        <Section id="architecture" title="Architecture">
          <div style={{ padding: '14px 14px 4px' }}>
            <ArchDiagram />
          </div>
          <P>
            Data flows left to right: external sources are polled by per-region agents, raw signals
            land in the buffer, the pipeline correlates them into events, scores them (EDPS), adds
            operational impact and evidence, and stores the result. Master data supplies reference
            values to both agents and the scoring engine; Admin settings tune weights, bands and
            lifecycle rules; the archiver retires stale events on a schedule.
          </P>
        </Section>

        <Section id="sources" title="Where the data comes from">
          {SOURCE_TIERS.map(([t, d], i) => <Row key={i} cols={[t, d]} />)}
          <P>
            Health of every source can be checked in <strong style={{ color: TEAL }}>Sources → Source Registry</strong>,
            and the provenance view shows which source chain feeds each data object (flight schedules,
            live positions, weather, etc.).
          </P>
        </Section>

        <Section id="pipeline" title="How raw data becomes a threat event">
          {STAGES.map(([t, d], i) => <Row key={i} cols={[`${i + 1}. ${t}`, d]} />)}
          <P>
            The pipeline runs automatically every ~10 seconds on newly arrived signals.
            Its live status, last-run stats and history are visible in <strong style={{ color: TEAL }}>Sources → Pipeline</strong>.
          </P>
        </Section>

        <Section id="score" title="How the threat score is calculated">
          <P>
            Every event's score is a weighted sum of eight factors, each itself a 0–100 value
            supplied by the signals and derived rules:
          </P>
          <div style={{ padding: '10px 14px', textAlign: 'center' }}>
            <code style={{ ...MONO, fontSize: 13, color: TEAL, background: 'var(--sunken)', padding: '8px 16px', borderRadius: 4 }}>
              score = Σ (factor value × factor weight) ÷ Σ active weights
            </code>
          </div>
          <P>
            If a factor value is missing it defaults to 50 (neutral). If an administrator disables a
            factor in Admin → Threat Profile, its weight drops out and the remaining weights are
            renormalised — the result always stays on the 0–100 scale. Factor weights are the only
            tuning knob on the score itself.
          </P>
        </Section>

        <Section id="factors" title="The eight scoring factors">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', }}>
            {FACTOR_DOC.map((f, i) => (
              <div key={i} style={{ padding: '10px 14px', borderBottom: '1px solid var(--hover)', display: 'grid', gridTemplateColumns: '1fr 60px', gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--mute)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
                <div style={{ ...MONO, fontSize: 11, color: TEAL, fontWeight: 700, textAlign: 'right' }}>{f.w}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="bands" title="What the bands and levels mean">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
            {[['Critical', '80–100', 'L4', '#f43f5e', 'Immediate action — major disruption imminent or underway'],
              ['High', '65–79', 'L3', '#f59e0b', 'Escalate — significant operational impact likely'],
              ['Moderate', '45–64', 'L2', '#38bdf8', 'Monitor — conditions warrant attention'],
              ['Low', '0–44', 'L1', '#10b981', 'Informational — low current threat']].map(([b, r, l, c, d]) => (
              <div key={b} style={{ padding: '14px 16px', borderRight: '1px solid var(--hover)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: c }}>{b}</div>
                <div style={{ ...MONO, fontSize: 10, color: 'var(--faint)', margin: '3px 0 6px' }}>{r} · {l}</div>
                <div style={{ fontSize: 11, color: 'var(--mute)', lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
          <P>Band thresholds are configurable in Admin → Threat Profile.</P>
        </Section>

        <Section id="impact" title="Operational impact (OPS) assessment">
          <P>
            Beyond "how dangerous", each event is assessed for "what it touches" across nine
            operational domains: flight schedule, crew, aircraft rotations, airport operations,
            passengers, cargo, catering, maintenance, and regulatory. Each event category carries a
            domain profile (e.g. weather weights passengers + schedules heavily; regulatory events
            weight the regulatory domain), and airport/airline exposure is computed from master-data
            coverage. This is the OPS tab on an event — it drives who needs to be alerted.
          </P>
        </Section>

        <Section id="lifecycle" title="Event lifecycle and archiving">
          {[
            ['Active', 'On the board while signals are fresh and the score is meaningful.'],
            ['Stale → archived', 'No fresh signals for longer than the configured stale age (default 72h) and score below the stale limit (default 65).'],
            ['Max age → archived', 'Hard cap (default 10 days) archives any event regardless of score — prevents immortal events.'],
            ['Low score → archived', 'Score below the low-threat limit (default 50) archives immediately.'],
            ['Restored', 'If an archived event receives fresh signals it returns to active — but only when no archive rule currently applies.'],
          ].map(([t, d], i) => <Row key={i} cols={[t, d]} />)}
          <P>All thresholds are admin-controlled in Admin → Parameters.</P>
        </Section>

        <Section id="profiling" title="Threat profiling">
          <P>
            Profiling is a deeper analysis pass over an event — correlating related signals,
            rebuilding the causal chain, and refreshing evidence. It runs as a background job:
            queued → running → completed/failed/cancelled. Progress and logs are visible on the
            profiling screen, and a queued or running profile can be cancelled — the button is
            disabled while a run is in flight so it can't be triggered twice.
          </P>
        </Section>

        <Section id="controls" title="What administrators can control">
          {[
            ['Factor weights & on/off', 'Admin → Threat Profile — tune each of the eight scoring factors or disable it entirely; score renormalises automatically.'],
            ['Score bands', 'Min/max score for each band (L1–L4) in Admin → Threat Profile.'],
            ['Event freshness', 'Admin → Parameters — stale age, max age, stale-score and low-score limits for archiving.'],
            ['Agent feeds', 'Admin → Parameters — force-refresh all agent feeds; per-type poll intervals live in Master Data → Agent Types.'],
            ['Reference data', 'Master Data — airports, airlines, regions, categories, hazard types, band values, domain profiles, connectors.'],
            ['LLM', 'Admin → LLM Setup — provider, model and key for the AI assistant.'],
          ].map(([t, d], i) => <Row key={i} cols={[t, d]} />)}
        </Section>
      </div>
      </div>
    </div>
  );
}
