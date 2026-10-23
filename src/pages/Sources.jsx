// Sources.jsx — Data Sources & Provenance screen.
// Shows how each key data object in the system is derived (source chain +
// fallbacks), then the full source registry with health checks.

import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { MONO, TEAL, OK, HIGH, CRIT } from '../theme.js';
import SourcesTab from '../components/agents/SourcesTab.jsx';
import PipelineFlow from '../components/agents/PipelineFlow.jsx';

// ── Provenance map: key data object → source chain → consumers ────────
// `srcIds` link each step to the /api/sources registry where applicable,
// so auth/mode info shown here stays accurate when sources change.
const PROVENANCE = [
  {
    object: 'Airports',
    detail: 'ICAO/IATA codes, coordinates, names',
    chain: ['Master Data (ref_airports)'],
    srcIds: [],
    consumedBy: 'All agents, maps, OPS impact',
    origin: 'seeded from OurAirports dataset',
  },
  {
    object: 'Airlines',
    detail: 'IATA/ICAO codes, callsigns, hubs',
    chain: ['Master Data (ref_airlines)'],
    srcIds: [],
    consumedBy: 'Flight agents, OPS impact, airline map',
    origin: 'curated airline reference',
  },
  {
    object: 'Regions & Airports per Region',
    detail: 'Monitored region definitions, subregions',
    chain: ['Master Data (ref_regions, ref_region_airports)'],
    srcIds: [],
    consumedBy: 'Agent manager (spawns per-region agents)',
    origin: 'curated region definitions',
  },
  {
    object: 'Flight Schedules & Actuals',
    detail: 'Departure/arrival times, delays, cancellations',
    chain: ['AirLabs', 'AviationStack', 'OpenSky /flights', 'Mock fallback'],
    srcIds: ['airlabs', 'aviationstack', 'opensky'],
    consumedBy: 'flight-* agents, delay/cancel events',
    origin: 'first configured provider wins',
  },
  {
    object: 'Live Aircraft Positions',
    detail: 'ADS-B positions, ground activity, emergency squawks',
    chain: ['adsb.lol', 'OpenSky /states'],
    srcIds: ['adsblol', 'opensky'],
    consumedBy: 'flight-* agents (corroboration + emergency signals)',
    origin: 'merged — higher of the two counts',
  },
  {
    object: 'Weather Observations',
    detail: 'METAR, TAF, SIGMET, PIREP',
    chain: ['NOAA Aviation Weather'],
    srcIds: ['noaa-awc'],
    consumedBy: 'weather-* agents',
    origin: 'live, no key',
  },
  {
    object: 'Weather Forecasts',
    detail: 'Hourly forecast: wind, visibility, precipitation',
    chain: ['Open-Meteo'],
    srcIds: ['open-meteo'],
    consumedBy: 'weather-* agents (pre-METAR severe weather)',
    origin: 'live, no key',
  },
  {
    object: 'Earthquakes',
    detail: 'Magnitude, epicenter, depth',
    chain: ['USGS Earthquake Hazards'],
    srcIds: ['usgs-earthquakes'],
    consumedBy: 'infrastructure-* agents',
    origin: 'live, no key',
  },
  {
    object: 'Natural Events',
    detail: 'Wildfires, volcanoes, storms, floods',
    chain: ['NASA EONET'],
    srcIds: ['nasa-eonet'],
    consumedBy: 'weather-*/infrastructure-* agents',
    origin: 'live, no key',
  },
  {
    object: 'US Airport Delays & Closures',
    detail: 'GDP/ground stops, delays, airport status',
    chain: ['FAA ASWS'],
    srcIds: ['faa-asws'],
    consumedBy: 'atc-* agents',
    origin: 'live, no key',
  },
  {
    object: 'Temporary Flight Restrictions',
    detail: 'TFRs — stadiums, VIP movement, hazards',
    chain: ['FAA TFR'],
    srcIds: ['faa-tfr'],
    consumedBy: 'atc-* agents',
    origin: 'live, no key',
  },
  {
    object: 'Conflict Zone Airspace Risk',
    detail: 'Country-level risk ratings (Level 1-3)',
    chain: ['SafeAirspace (OPSGROUP)'],
    srcIds: ['safeairspace'],
    consumedBy: 'geopolitical-* agents, region airspace panel',
    origin: 'live, no key',
  },
  {
    object: 'Geopolitical News',
    detail: 'Global events, conflict, unrest reports',
    chain: ['GDELT Project'],
    srcIds: ['gdelt'],
    consumedBy: 'geopolitical-* agents',
    origin: 'live, rate-limited',
  },
  {
    object: 'Social Reports',
    detail: 'r/aviation, r/flights — passenger reports',
    chain: ['Reddit API', 'Mock fallback'],
    srcIds: ['reddit'],
    consumedBy: 'social-* agents',
    origin: 'requires REDDIT_CLIENT_ID/SECRET',
  },
  {
    object: 'Industrial Action',
    detail: 'Strikes, labor disputes affecting aviation',
    chain: ['GDELT Project', 'Mock fallback'],
    srcIds: ['gdelt'],
    consumedBy: 'industrial-* agents',
    origin: 'GDELT keyword queries',
  },
  {
    object: 'Threat Events',
    detail: 'Correlated, scored threat objects on the board',
    chain: ['Computed — pipeline correlation'],
    srcIds: [],
    consumedBy: 'Threat Board, World Map, Profiling',
    origin: 'derived from signals above',
  },
  {
    object: 'OPS Impact Data',
    detail: 'Flights at risk, aircraft rotations affected',
    chain: ['Computed — flight estimator'],
    srcIds: [],
    consumedBy: 'Event detail, OPS panels',
    origin: 'derived from schedules + event footprint',
  },
];

// Simple visual pipeline: object → chain steps (with live-auth badges) → consumers
export default function Sources() {
  const [srcById, setSrcById] = useState({});
  const [tab, setTab] = useState('provenance');

  useEffect(() => {
    api.getSources()
      .then((res) => {
        const map = {};
        for (const s of res.sources || []) map[s.id] = s;
        setSrcById(map);
      })
      .catch(() => {});
  }, []);

  // Match a chain label like "AirLabs" or "OpenSky /flights" to a registry id
  function authFor(step, srcIds) {
    const low = step.toLowerCase();
    for (const id of srcIds) {
      const s = srcById[id];
      if (s && (low.includes(s.name.split(' ')[0].toLowerCase()) || low.includes(id))) {
        return s.auth || '';
      }
    }
    return '';
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        flex: '0 0 auto', borderBottom: '1px solid var(--line)', background: 'var(--panel)',
        padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Data Sources</div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            PROVENANCE · SOURCE REGISTRY · PIPELINE
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        flex: '0 0 auto', borderBottom: '1px solid var(--line)', background: 'var(--sunken)',
        display: 'flex', padding: '0 22px', gap: 2,
      }}>
        {[['provenance', 'Provenance'], ['registry', 'Source Registry'], ['pipeline', 'Pipeline']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              ...MONO, fontSize: 12, padding: '8px 16px', cursor: 'pointer',
              border: 'none', borderBottom: tab === id ? `2px solid ${TEAL}` : '2px solid transparent',
              background: 'transparent', color: tab === id ? 'var(--ink)' : 'var(--mute)',
              fontWeight: tab === id ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {tab === 'provenance' && (
        <>
        <div style={{ padding: '14px 22px 0' }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.05em', marginBottom: 8 }}>
            DATA OBJECTS → SOURCE CHAIN → CONSUMERS
          </div>
          <div style={{ border: '1px solid var(--line)', background: 'var(--panel)', borderRadius: 4, overflow: 'hidden' }}>
            {/* header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '200px 1fr 220px 150px',
              padding: '8px 14px', borderBottom: '1px solid var(--line)', background: 'var(--sunken)',
              ...MONO, fontSize: 9, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.05em',
            }}>
              <span>DATA OBJECT</span><span>SOURCE CHAIN (PRIMARY → FALLBACK)</span><span>CONSUMED BY</span><span>ORIGIN / NOTES</span>
            </div>
            {PROVENANCE.map((row) => (
              <div key={row.object} style={{
                display: 'grid', gridTemplateColumns: '200px 1fr 220px 150px',
                padding: '9px 14px', borderBottom: '1px solid var(--edge)', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{row.object}</div>
                  <div style={{ fontSize: 10, color: 'var(--mute)', marginTop: 1 }}>{row.detail}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {row.chain.map((step, i) => {
                    const auth = authFor(step, row.srcIds);
                    const needsKey = auth && !auth.toLowerCase().startsWith('none');
                    return (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i > 0 && <span style={{ color: 'var(--faint)', fontSize: 10 }}>→</span>}
                        <span style={{
                          ...MONO, fontSize: 10, padding: '3px 8px', borderRadius: 3,
                          border: `1px solid ${i === 0 ? TEAL : 'var(--edge)'}`,
                          background: i === 0 ? TEAL + '12' : 'var(--sunken)',
                          color: i === 0 ? TEAL : 'var(--ink2)',
                          fontWeight: i === 0 ? 700 : 400,
                        }}>
                          {step}
                          {needsKey && <span title={auth} style={{ color: HIGH, marginLeft: 4 }}>⚿</span>}
                        </span>
                      </span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--mute)' }}>{row.consumedBy}</div>
                <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>{row.origin}</div>
              </div>
            ))}
          </div>
          <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginTop: 6 }}>
            ⚿ = API key required (configure in .env or Admin). First step = primary source; arrows show fallback order.
          </div>
        </div>
        </>
        )}

        {/* ── Full source registry (existing component) ─────────── */}
        {tab === 'registry' && <SourcesTab />}

        {/* ── Signal-to-event pipeline ──────────────────────────── */}
        {tab === 'pipeline' && (
          <div style={{ flex: 1, background: 'var(--panel)', display: 'flex', flexDirection: 'column' }}>
            <PipelineFlow />
          </div>
        )}
      </div>
    </div>
  );
}
