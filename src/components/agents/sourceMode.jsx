// sourceMode.js — Shared helpers for real/mock source tagging and help content

export const MODE_COLORS = {
  real: '#34D399',
  mock: '#F5A623',
  computed: '#22D3EE',
  planned: '#5B92C9',
  mixed: '#A78BFA',
};

export const MODE_LABELS = {
  real: 'REAL',
  mock: 'MOCK',
  computed: 'COMPUTED',
  planned: 'PLANNED',
  mixed: 'MIXED',
};

export function SourceBadge({ mode }) {
  const color = MODE_COLORS[mode] || MODE_COLORS.mock;
  const label = MODE_LABELS[mode] || 'MOCK';
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2,
      border: `1px solid ${color}`, color, background: color + '15',
      letterSpacing: '0.05em', lineHeight: 1.4,
    }}>
      {label}
    </span>
  );
}

// Compute the aggregate source mode from an agent's data sources.
// Returns 'real' if all non-planned sources are real,
// 'mock' if all are mock,
// 'mixed' if there's a combination of real and mock,
// 'planned' if all are planned,
// 'computed' for impact-assessment agents.
export function computeSourceMode(dataSources, fallbackMode) {
  if (!dataSources || dataSources.length === 0) return fallbackMode || 'mock';

  // If the fallback is 'computed' (impact-assessment agent), keep it
  if (fallbackMode === 'computed') return 'computed';

  const modes = dataSources
    .map(s => s.mode || 'planned')
    .filter(m => m !== 'planned'); // exclude planned sources from the mix calculation

  if (modes.length === 0) return 'planned';

  const hasReal = modes.includes('real');
  const hasMock = modes.includes('mock');
  const hasComputed = modes.includes('computed');

  if (hasComputed && !hasReal && !hasMock) return 'computed';
  if (hasReal && hasMock) return 'mixed';
  if (hasReal) return 'real';
  if (hasMock) return 'mock';
  return 'planned';
}

// Get a summary string of source mode counts
export function sourceModeSummary(dataSources) {
  if (!dataSources || dataSources.length === 0) return '';
  const counts = {};
  for (const s of dataSources) {
    const m = s.mode || 'planned';
    counts[m] = (counts[m] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => {
      const order = { real: 0, mock: 1, planned: 2, computed: 3 };
      return (order[a[0]] || 9) - (order[b[0]] || 9);
    })
    .map(([mode, count]) => `${count} ${mode.toUpperCase()}`)
    .join(' · ');
}

// ── Help content for each module ───────────────────────────────────

export const HELP = {
  agentGrid: {
    title: 'Agent Fleet',
    sections: [
      {
        body: 'The agent fleet consists of 29 instances across 7 agent types. Each agent monitors a specific sub-region and collects intelligence signals for its category.',
      },
      {
        title: 'Real vs Mock Sources',
        body: 'Each agent is tagged with its data source mode:',
        list: [
          'REAL — Weather agents fetch live METAR/TAF/SIGMET data from the NOAA/NWS Aviation Weather Center API (aviationweather.gov). No API key required, rate-limited to 100 requests/minute.',
          'MOCK — ATC, Industrial Action, Geopolitical, Infrastructure, and Regulatory agents generate synthetic signals from scenario templates matching the PoC data. These connectors are stubs ready to be replaced with real APIs (EUROCONTROL NM, FAA SWIM, NOTAM feeds, etc.).',
          'COMPUTED — The Impact Assessment Agent is event-driven and computes results from existing event + schedule data rather than polling external sources.',
        ],
      },
      {
        title: 'How to Use',
        body: 'Click an agent card to see its detail. Click the POLL button to manually trigger a data collection cycle. The status dot shows the current state: green = active, amber = polling, grey = idle, red = error.',
      },
    ],
  },

  signalFeed: {
    title: 'Signal Feed',
    sections: [
      {
        body: 'The signal feed shows raw intelligence signals emitted by the agent fleet in real time. Each signal represents a detected hazard or event precursor from a specific data source.',
      },
      {
        title: 'Signal Lifecycle',
        body: 'Signals flow through the 9-step pipeline: Collection → Normalization → Correlation → Scoring → Domain Impact → Causal Chain → Evidence Assembly → Impact Assessment → Event Store. Multiple signals for the same event are correlated and merged into a single scored event.',
      },
      {
        title: 'Source Modes',
        body: 'Each signal is tagged REAL or MOCK based on its originating connector. REAL signals come from live APIs; MOCK signals are synthetic. This helps you understand which data is live vs simulated.',
      },
      {
        title: 'Filtering',
        body: 'Use the filter buttons to show only signals from a specific agent type.',
      },
    ],
  },

  pipeline: {
    title: 'Scoring Pipeline',
    sections: [
      {
        body: 'The pipeline transforms raw signals into scored events through 9 automated steps. It runs automatically every 10 seconds, or you can trigger it manually with the RUN NOW button.',
      },
      {
        title: 'Steps',
        body: '',
        list: [
          '1. Collection — Agents poll their data sources at configured intervals.',
          '2. Normalization — Geocode, UTC timestamp, source-tier, category tag.',
          '3. Correlation — Dedup by geo+time+category, merge corroborating sources.',
          '4. Scoring — EDPS = Σ(factor.val × weight) for 8 factors.',
          '5. Domain Impact — 9-domain vector from category heuristics.',
          '6. Causal Chain — 1st/2nd/3rd order effects with likelihood + lead time.',
          '7. Evidence Assembly — Attach evidence trail with tier + role.',
          '8. Impact Assessment — Compute per-airport + per-airline exposure (OPS).',
          '9. Event Store — Publish to EVENTS[] + OPS[], trigger airline solver.',
        ],
      },
    ],
  },

  impactPanel: {
    title: 'Impact Assessment',
    sections: [
      {
        body: 'The Impact Assessment Agent computes per-airport and per-airline operational exposure for each scored event. It uses published flight schedules and airline metadata — not confidential airline operational data.',
      },
      {
        title: 'Airport Exposure',
        body: 'For each affected airport: scheduled movements (arrivals + departures), airline count, exposure score (EDPS adjusted by movement density), and exposure band (Critical/High/Moderate/Low).',
      },
      {
        title: 'Airline Exposure (5-Factor Model)',
        body: 'airlineExposure = EDPS × (0.35×hubF + 0.25×moveShareF + 0.20×fleetCapF + 0.10×bankOverlapF + 0.10×overflightF)',
        list: [
          'Hub Factor (0.5–1.5): 1.5 if primary hub, 1.2 if secondary, 0.8 if focus city, 0.5 if outstation.',
          'Movement Share (0.3–1.2): Airline\'s % of movements at the affected airport.',
          'Fleet Capability (0.5–1.3): 1.3 if fleet lacks hazard capability (e.g. no CAT III for fog), 0.5 if equipped.',
          'Bank Overlap (0.5–1.2): 1.2 if event window overlaps the airline\'s most sensitive bank.',
          'Overflight (0.5–1.3): 1.3 for "invisible exposure" — airline overflies affected airspace but has no destination there.',
        ],
      },
      {
        title: 'Privacy Boundary',
        body: 'This agent uses only public schedule data (Tier 0). It produces a public approximation of airline exposure. The airline solver then refines this with confidential data (tail assignments, crew pairings, passenger loads) to produce the five-tier intersection. The agent does not claim actual tail displacement, crew legality, passenger counts, or projected cost.',
      },
    ],
  },

  regionMap: {
    title: 'Region Map',
    sections: [
      {
        body: 'The map shows 7 global regions with 20 sub-regions. Each colored pin represents an agent instance monitoring that sub-region.',
      },
      {
        title: 'Pin Colors',
        body: 'Pin color indicates agent type: cyan = weather, purple = ATC, orange = industrial, red = geopolitical, green = infrastructure, yellow = regulatory. Pin size indicates priority (critical > high > medium > low).',
      },
      {
        title: 'Region Priority',
        body: 'Region bounding boxes are color-coded by priority: red = critical, orange = high, yellow = medium, blue = low. Priority is derived from the synthetic airlines\' hub density and overflight corridor exposure.',
      },
    ],
  },
};
