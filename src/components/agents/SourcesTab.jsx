// SourcesTab.jsx — Lists all data sources with API URLs, sourcing methods, live health, and details

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';

const MODE_COLORS = {
  real: '#34D399',
  mock: '#F5A623',
  computed: '#22D3EE',
  planned: '#5B92C9',
  cached: '#5B92C9',
  unavailable: CRIT,
};

const TIER_COLORS = {
  1: '#34D399',
  2: HIGH,
  3: LOW,
};

const HEALTH_COLORS = {
  ok: '#34D399',
  error: CRIT,
  checking: '#F5A623',
  unknown: 'var(--mute)',
};

// Static source registry — describes every external data source the platform uses
const SOURCE_REGISTRY = [
  {
    id: 'noaa-awc',
    category: 'Weather',
    name: 'NOAA/NWS Aviation Weather Center',
    type: 'REST API',
    url: 'https://aviationweather.gov/api/data',
    method: 'REST API — METAR, TAF, SIGMET observations',
    scope: 'Airport-level (ICAO codes)',
    tier: 1,
    mode: 'real',
    auth: 'None (public)',
    updateFreq: 'Every 5 min (agent poll interval)',
    license: 'Public domain (US Government)',
    coverage: 'Global',
    dataTypes: ['METAR', 'TAF', 'SIGMET', 'PIREP'],
    rateLimit: '100 req/min',
    notes: 'Primary source for all weather agents. Returns live METAR observations with visibility, wind, ceiling, thunderstorm, and snow/ice data. Also provides SIGMETs (weather warnings) and TAFs (terminal forecasts).',
    agentsUsing: 'weather-* (9 agents)',
  },
  {
    id: 'open-meteo',
    category: 'Weather',
    name: 'Open-Meteo',
    type: 'REST API',
    url: 'https://api.open-meteo.com/v1/forecast',
    method: 'REST API — hourly weather forecasts from ECMWF/GFS models',
    scope: 'Lat/lon coordinates (airport-level)',
    tier: 1,
    mode: 'real',
    auth: 'None (free, CC BY 4.0)',
    updateFreq: 'Every 1-6 hours (model dependent)',
    license: 'CC BY 4.0 (non-commercial)',
    coverage: 'Global (10K+ weather models)',
    dataTypes: ['Temperature', 'Wind speed/direction', 'Precipitation', 'Visibility', 'WMO weather codes'],
    rateLimit: '10,000 calls/day (non-commercial)',
    notes: 'Complements aviationweather.gov with broader regional forecasts. Detects severe weather not yet at METAR threshold: heatwaves, flooding, dust storms, extreme cold. Uses ECMWF, GFS, ICON, and other model data.',
    agentsUsing: 'weather-* (supplementary forecast)',
  },
  {
    id: 'nasa-eonet',
    category: 'Weather',
    name: 'NASA EONET (Earth Observatory Natural Event Tracker)',
    type: 'REST API',
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events',
    method: 'REST API — global natural disaster events (GeoJSON)',
    scope: 'Global (point/polygon geometries)',
    tier: 1,
    mode: 'real',
    auth: 'None (public)',
    updateFreq: 'Near real-time',
    license: 'Public domain (NASA)',
    coverage: 'Global',
    dataTypes: ['Wildfires', 'Volcanoes', 'Severe storms', 'Floods', 'Dust/haze', 'Snow', 'Temp extremes', 'Sea/lake ice'],
    rateLimit: 'No limit (be respectful)',
    notes: 'Aggregates natural events from multiple NASA and NOAA sources. Aviation-critical for volcanic ash (affects airspace for hundreds of km), wildfires (smoke/visibility), and severe storms. Each event includes source URLs and geometry.',
    agentsUsing: 'weather-* (natural disaster events)',
  },
  {
    id: 'usgs-earthquakes',
    category: 'Infrastructure',
    name: 'USGS Earthquake Hazards Program',
    type: 'REST API (GeoJSON)',
    url: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    method: 'REST API — real-time earthquake data (FDSN-WS)',
    scope: 'Global (lat/lon + magnitude filter)',
    tier: 1,
    mode: 'real',
    auth: 'None (public)',
    updateFreq: 'Real-time',
    license: 'Public domain (USGS)',
    coverage: 'Global',
    dataTypes: ['Earthquake magnitude', 'Depth', 'Location', 'PAGER alert level', 'Tsunami flag', 'Significance score'],
    rateLimit: 'No limit (be respectful)',
    notes: 'Aviation relevance: earthquakes near airports can damage runways, terminals, and ATC infrastructure. PAGER alert levels (green/yellow/orange/red) indicate expected impact severity. Tsunami flag triggers coastal airport alerts.',
    agentsUsing: 'infrastructure-* (seismic events)',
  },
  {
    id: 'faa-asws',
    category: 'ATC / Airspace',
    name: 'FAA Airport Status Web Service (ASWS)',
    type: 'REST API',
    url: 'https://external-api.faa.gov/asws/api/airport/delays',
    method: 'REST API — live US airport delay summary',
    scope: 'US (40 major airports)',
    tier: 1,
    mode: 'real',
    auth: 'None (public, unauthenticated)',
    updateFreq: 'Real-time',
    license: 'Public domain (FAA)',
    coverage: 'United States',
    dataTypes: ['Ground stops', 'Ground delay programs', 'Arrival/departure delays', 'Airport closures'],
    rateLimit: 'No limit (be respectful)',
    notes: 'Official FAA source for US airport status. Covers BOS, LGA, EWR, JFK, PHL, IAD, BWI, DCA, ATL, ORD, DFW, DEN, LAX, SFO, SEA, and 25 more major airports. Replaces mock ATC data for US-focused agents.',
    agentsUsing: 'atc-* (US airport delays)',
  },
  {
    id: 'faa-tfr',
    category: 'Geopolitical',
    name: 'FAA Temporary Flight Restrictions',
    type: 'REST API (JSON)',
    url: 'https://tfr.faa.gov/tfrapi/exportTfrList',
    method: 'REST API — active TFRs nationwide',
    scope: 'US airspace',
    tier: 1,
    mode: 'real',
    auth: 'None (public)',
    updateFreq: 'Real-time',
    license: 'Public domain (FAA)',
    coverage: 'United States',
    dataTypes: ['VIP movements (presidential)', 'Disaster response TFRs', 'Special event TFRs', 'Airspace closures', 'Wildfire restrictions'],
    rateLimit: 'No limit (be respectful)',
    notes: 'TFRs are temporary airspace restrictions issued via NOTAM. Includes VIP movements (presidential travel), disaster response areas, wildfire airspace restrictions, and stadium/venue restrictions. Typically 50-100 active TFRs at any time.',
    agentsUsing: 'geopolitical-* (US airspace restrictions)',
  },
  {
    id: 'safeairspace',
    category: 'Geopolitical',
    name: 'SafeAirspace.net (OPSGROUP)',
    type: 'Web scrape',
    url: 'https://safeairspace.net/',
    method: 'HTML page scrape — country-level risk levels, warnings, NOTAMs',
    scope: 'Country + FIR level',
    tier: 1,
    mode: 'real',
    auth: 'None (public website)',
    updateFreq: 'On demand (cached 1 hour)',
    license: 'Free, OPSGROUP-maintained',
    coverage: 'Global (country-level)',
    dataTypes: ['Conflict zone risk levels (Level 1-3)', 'Airspace warnings', 'No-fly advisories'],
    rateLimit: 'N/A (scraped, 1hr cache)',
    notes: 'Conflict Zone & Risk Database maintained by OPSGROUP. Provides Level 1 (No Fly), Level 2 (Permitted with Precautions), Level 3 (Caution) risk assessments per country. No official API — pages are scraped with 1-hour cache.',
    agentsUsing: 'geopolitical-* (3 agents), Region Settings airspace check',
  },
  {
    id: 'gdelt',
    category: 'Industrial Action',
    name: 'GDELT Project (Global Event Database)',
    type: 'REST API',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc',
    method: 'REST API — global news event database (article search)',
    scope: 'Global (keyword + date filtered)',
    tier: 2,
    mode: 'real',
    auth: 'None (public)',
    updateFreq: 'Every 15 min',
    license: 'Open (GDELT Project)',
    coverage: 'Global (news aggregation)',
    dataTypes: ['Strike/walkout news', 'Geopolitical events', 'Infrastructure failures', 'Regulatory changes'],
    rateLimit: '1 req per 6s (rate-limited)',
    notes: 'Monitors global news for aviation-relevant events. Used by 4 agent types: industrial (airline strikes, ATC walkouts), geopolitical (airspace closures, sanctions), infrastructure (airport failures), regulatory (directives, ADs). News-based signals have lower confidence than official sources — best used as early indicators with LLM enrichment.',
    agentsUsing: 'industrial-*, geopolitical-*, infrastructure-*, regulatory-*',
  },
  {
    id: 'mock-weather',
    category: 'Weather',
    name: 'Mock weather scenario data (fallback)',
    type: 'Internal',
    url: 'N/A — server/connectors/mock-weather.js',
    method: 'Synthetic weather scenarios per sub-region',
    scope: 'All configured regions',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'On poll (probabilistic)',
    license: 'Internal',
    coverage: 'All regions',
    dataTypes: ['Synthetic storm/fog/cyclone/snow signals'],
    rateLimit: 'N/A',
    notes: 'Fallback when real weather APIs return no hazards. Generates synthetic weather signals from curated scenario templates. Used only when NOAA AWC, Open-Meteo, and NASA EONET return no data for the region.',
    agentsUsing: 'weather-* (fallback only)',
  },
  {
    id: 'mock-atc',
    category: 'ATC / Airspace',
    name: 'Mock ATC scenario data (fallback)',
    type: 'Internal',
    url: 'N/A — server/connectors/mock-atc.js',
    method: 'Synthetic ATFM regulation / sector overload scenarios',
    scope: 'All configured regions',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'On poll (25% probability)',
    license: 'Internal',
    coverage: 'All regions',
    dataTypes: ['Synthetic flow restrictions, capacity reductions, sector overloads'],
    rateLimit: 'N/A',
    notes: 'Fallback when FAA ASWS returns no delays. Generates synthetic ATC signals from curated scenario templates per sub-region.',
    agentsUsing: 'atc-* (fallback only)',
  },
  {
    id: 'mock-industrial',
    category: 'Industrial Action',
    name: 'Mock industrial action data (fallback)',
    type: 'Internal',
    url: 'N/A — server/connectors/mock-industrial.js',
    method: 'Synthetic strike/walkout scenarios',
    scope: 'All configured regions',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'On poll (15% probability)',
    license: 'Internal',
    coverage: 'All regions',
    dataTypes: ['Synthetic strike notices, go-slow, ground handler action'],
    rateLimit: 'N/A',
    notes: 'Fallback when GDELT returns no industrial action news. Generates synthetic strike signals from curated scenario templates.',
    agentsUsing: 'industrial-* (fallback only)',
  },
  {
    id: 'mock-geopolitical',
    category: 'Geopolitical',
    name: 'Mock geopolitical data (fallback)',
    type: 'Internal',
    url: 'N/A — server/connectors/mock-geopolitical.js',
    method: 'Synthetic airspace restriction / NOTAM scenarios',
    scope: 'All configured regions',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'On poll (15% probability)',
    license: 'Internal',
    coverage: 'All regions',
    dataTypes: ['Synthetic airspace restrictions, security NOTAMs, overflight advisories'],
    rateLimit: 'N/A',
    notes: 'Fallback when SafeAirspace, FAA TFR, and GDELT return no data. Generates synthetic geopolitical signals from curated scenario templates.',
    agentsUsing: 'geopolitical-* (fallback only)',
  },
  {
    id: 'mock-infrastructure',
    category: 'Infrastructure',
    name: 'Mock infrastructure data (fallback)',
    type: 'Internal',
    url: 'N/A — server/connectors/mock-infrastructure.js',
    method: 'Synthetic airport infrastructure failure scenarios',
    scope: 'All configured regions',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'On poll (15% probability)',
    license: 'Internal',
    coverage: 'All regions',
    dataTypes: ['Synthetic fuel supply, runway closure, ILS outage signals'],
    rateLimit: 'N/A',
    notes: 'Fallback when GDELT and USGS return no data. Generates synthetic infrastructure failure signals from curated scenario templates.',
    agentsUsing: 'infrastructure-* (fallback only)',
  },
  {
    id: 'mock-regulatory',
    category: 'Regulatory',
    name: 'Mock regulatory data (fallback)',
    type: 'Internal',
    url: 'N/A — server/connectors/mock-regulatory.js',
    method: 'Synthetic regulatory directive scenarios',
    scope: 'All configured regions',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'On poll (10% probability)',
    license: 'Internal',
    coverage: 'All regions',
    dataTypes: ['Synthetic fog directives, ETOPS changes, ops spec updates, curfew changes'],
    rateLimit: 'N/A',
    notes: 'Fallback when GDELT returns no regulatory news. Generates synthetic regulatory signals from curated scenario templates.',
    agentsUsing: 'regulatory-* (fallback only)',
  },
  {
    category: 'Airport Data',
    name: 'OurAirports',
    type: 'CSV dataset',
    url: 'https://ourairports.com/data/',
    method: 'Static CSV download (GitHub: davidmegginson/ourairports-data)',
    scope: 'Global (75K+ airports)',
    tier: 1,
    mode: 'real',
    auth: 'None (public domain)',
    updateFreq: 'Nightly',
    license: 'Public domain',
    coverage: 'Global',
    dataTypes: ['Airport metadata (IATA/ICAO, coords, city, country, runways)'],
    rateLimit: 'N/A (static dataset)',
    notes: 'Airport metadata: IATA/ICAO codes, coordinates, city, country, scheduled service flag, runways, frequencies. Used in Region Settings for airport lookup per region.',
    agentsUsing: 'Region Settings, Impact Assessment',
  },
  {
    category: 'Airline Data',
    name: 'OpenFlights',
    type: 'CSV dataset',
    url: 'https://openflights.org/data',
    method: 'Static CSV download (GitHub: jpatokal/openflights)',
    scope: 'Global (5K+ airlines)',
    tier: 1,
    mode: 'real',
    auth: 'None (open license)',
    updateFreq: 'Periodic (not real-time)',
    license: 'Database Contents License (open)',
    coverage: 'Global',
    dataTypes: ['Airline metadata (IATA/ICAO, name, country, active)'],
    rateLimit: 'N/A (static dataset)',
    notes: 'Airline metadata: IATA/ICAO codes, name, country, active status. Used in Region Settings for airline lookup per region.',
    agentsUsing: 'Region Settings, Impact Assessment',
  },
  {
    category: 'Flight Schedules',
    name: 'Published airline schedules (mock)',
    type: 'Internal dataset',
    url: 'N/A — server/data/schedule-store.js',
    method: 'Curated mock schedule data',
    scope: '3 airlines, 57 flights',
    tier: 2,
    mode: 'mock',
    auth: 'N/A',
    updateFreq: 'Static',
    license: 'Internal',
    coverage: '3 mock airlines',
    dataTypes: ['Flight schedules (mock)'],
    rateLimit: 'N/A',
    notes: 'Mock published schedules for Namma Air (N7), EuroVista (EV), IndiConnect (IC). In production, would use OAG, Cirium, or airline GDS feeds.',
    agentsUsing: 'Impact Assessment agent',
  },
  {
    category: 'Airline Registry',
    name: 'Airline operational metadata (mock)',
    type: 'Internal dataset',
    url: 'N/A — server/data/airline-registry.js',
    method: 'Curated mock airline data',
    scope: '3 airlines',
    tier: 2,
    mode: 'computed',
    auth: 'N/A',
    updateFreq: 'Static',
    license: 'Internal',
    coverage: '3 mock airlines',
    dataTypes: ['Hub structure', 'Fleet types', 'Daily departures', 'Network share', 'Bank structures', 'CAT IIIB/ETOPS'],
    rateLimit: 'N/A',
    notes: 'Hub structure, fleet types, daily departures, network share, bank structures, CAT IIIB/ETOPS capabilities. In production, airline-side data stays in confidential solvers.',
    agentsUsing: 'Impact Assessment agent',
  },
];

export default function SourcesTab() {
  const [agentTypes, setAgentTypes] = useState([]);
  const [healthStatus, setHealthStatus] = useState({}); // id → { health, count, sample, error, lastCheck }
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(null); // expanded source id

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAgents();
        const types = {};
        for (const a of res.agents || []) {
          if (!types[a.type]) types[a.type] = { type: a.type, mode: a.dataSourceMode, count: 0 };
          types[a.type].count++;
        }
        setAgentTypes(Object.values(types));
      } catch (e) { /* ignore */ }
    }
    load();
  }, []);

  const runHealthChecks = useCallback(async () => {
    setChecking(true);
    try {
      const res = await api.getSources(true);
      const status = {};
      for (const s of res.sources || []) {
        status[s.id] = {
          health: s.health,
          count: s.count,
          sample: s.sample,
          error: s.error,
          lastCheck: s.lastCheck,
        };
      }
      setHealthStatus(status);
    } catch (e) {
      console.error('[SourcesTab] health check failed:', e);
    }
    setChecking(false);
  }, []);

  const testSource = useCallback(async (id) => {
    setHealthStatus((prev) => ({ ...prev, [id]: { ...prev[id], health: 'checking' } }));
    try {
      const res = await api.testSource(id);
      setHealthStatus((prev) => ({
        ...prev,
        [id]: { health: res.health, count: res.count, sample: res.sample, lastCheck: res.lastCheck },
      }));
    } catch (e) {
      setHealthStatus((prev) => ({
        ...prev,
        [id]: { health: 'error', error: e.message, lastCheck: new Date().toISOString() },
      }));
    }
  }, []);

  // Group sources by category
  const categories = [...new Set(SOURCE_REGISTRY.map((s) => s.category))];

  // Count sources by mode
  const modeCounts = SOURCE_REGISTRY.reduce((acc, s) => {
    acc[s.mode] = (acc[s.mode] || 0) + 1;
    return acc;
  }, {});

  // Count healthy sources
  const healthCounts = Object.values(healthStatus).reduce((acc, h) => {
    if (h.health) acc[h.health] = (acc[h.health] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Data Sources</div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            {SOURCE_REGISTRY.length} SOURCES · {categories.length} CATEGORIES ·
            {' '}{modeCounts.real || 0} REAL · {modeCounts.mock || 0} MOCK · {modeCounts.computed || 0} COMPUTED · {modeCounts.planned || 0} PLANNED
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.keys(healthCounts).length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {healthCounts.ok > 0 && (
                <span style={{ ...MONO, fontSize: 9, color: HEALTH_COLORS.ok }}>
                  {healthCounts.ok} OK
                </span>
              )}
              {healthCounts.error > 0 && (
                <span style={{ ...MONO, fontSize: 9, color: HEALTH_COLORS.error }}>
                  {healthCounts.error} ERR
                </span>
              )}
            </div>
          )}
          <button
            onClick={runHealthChecks}
            disabled={checking}
            style={{
              ...MONO, fontSize: 10, fontWeight: 700, padding: '5px 12px',
              border: '1px solid var(--edge)', borderRadius: 3, cursor: checking ? 'wait' : 'pointer',
              background: checking ? 'var(--sunken)' : 'var(--panel2)', color: checking ? 'var(--mute)' : 'var(--ink2)',
            }}
          >
            {checking ? 'CHECKING...' : 'CHECK ALL'}
          </button>
          <InfoIcon
            title="Data Sources"
            sections={[
              { body: 'This tab lists every external data source the DisruptionMatrix platform uses. Each source is tagged with its sourcing method, data tier, and current status.' },
              {
                title: 'Source Modes',
                body: '',
                list: [
                  'REAL (green): Live data from an external API or dataset',
                  'MOCK (orange): Synthetic scenario data, ready to swap for real APIs',
                  'COMPUTED (cyan): Derived internally from other data',
                ],
              },
              {
                title: 'Data Tiers',
                body: '',
                list: [
                  'Tier 1: Primary, authoritative source (e.g. NOAA, FAA, NASA, USGS)',
                  'Tier 2: Secondary, corroborating source (e.g. GDELT news)',
                  'Tier 3: Tertiary, indirect source',
                ],
              },
              {
                title: 'Health Checks',
                body: 'Click "CHECK ALL" to test every source connection. Each source shows a live health indicator (OK/ERROR) with the last fetch result count and a sample of returned data.',
              },
            ]}
            placement="left"
          />
        </div>
      </div>

      {/* Agent type summary */}
      {agentTypes.length > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 12px', border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>AGENT SOURCE MODES</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {agentTypes.map((t) => (
              <div key={t.type} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                border: '1px solid var(--edge)', borderRadius: 3, background: 'var(--panel)',
              }}>
                <span style={{ ...MONO, fontSize: 10, fontWeight: 600 }}>{t.type}</span>
                <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>×{t.count}</span>
                <span style={{
                  ...MONO, fontSize: 9, padding: '1px 6px', borderRadius: 2, fontWeight: 700,
                  border: `1px solid ${MODE_COLORS[t.mode] || LOW}`,
                  color: MODE_COLORS[t.mode] || LOW,
                }}>
                  {t.mode?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source cards by category */}
      {categories.map((cat) => {
        const sources = SOURCE_REGISTRY.filter((s) => s.category === cat);
        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>{cat.toUpperCase()} · {sources.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sources.map((src, i) => {
                const modeColor = MODE_COLORS[src.mode] || LOW;
                const tierColor = TIER_COLORS[src.tier] || LOW;
                const health = healthStatus[src.id];
                const healthColor = HEALTH_COLORS[health?.health || 'unknown'];
                const isExpanded = expanded === (src.id || `${cat}-${i}`);
                const sourceKey = src.id || `${cat}-${i}`;

                return (
                  <div key={sourceKey} style={{
                    border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4,
                    padding: '12px 14px', borderLeft: `4px solid ${modeColor}`,
                  }}>
                    {/* Row 1: name + badges + health */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{src.name}</span>
                      <span style={{
                        ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2, fontWeight: 700,
                        border: `1px solid ${modeColor}`, color: modeColor,
                      }}>
                        {src.mode.toUpperCase()}
                      </span>
                      <span style={{
                        ...MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2, fontWeight: 700,
                        border: `1px solid ${tierColor}`, color: tierColor,
                      }}>
                        TIER {src.tier}
                      </span>
                      <span style={{
                        ...MONO, fontSize: 9, padding: '2px 6px', borderRadius: 2,
                        border: '1px solid var(--edge)', color: 'var(--mute)',
                      }}>
                        {src.type}
                      </span>
                      {/* Health badge */}
                      {src.id && (
                        <span style={{
                          ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2, fontWeight: 700,
                          border: `1px solid ${healthColor}`, color: healthColor,
                          background: health?.health === 'ok' ? 'rgba(52, 211, 153, 0.08)' :
                                     health?.health === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        }}>
                          {health?.health === 'checking' ? '⟳ CHECKING' :
                           health?.health === 'ok' ? '● OK' :
                           health?.health === 'error' ? '✕ ERROR' : '○ UNCHECKED'}
                        </span>
                      )}
                      {/* Test button */}
                      {src.id && (
                        <button
                          onClick={() => testSource(src.id)}
                          disabled={health?.health === 'checking'}
                          style={{
                            ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                            border: '1px solid var(--edge)', background: 'var(--panel)',
                            cursor: health?.health === 'checking' ? 'wait' : 'pointer',
                            color: 'var(--mute)',
                          }}
                        >
                          TEST
                        </button>
                      )}
                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : sourceKey)}
                        style={{
                          ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                          border: '1px solid var(--edge)', background: 'var(--panel)',
                          cursor: 'pointer', color: 'var(--mute)', marginLeft: 'auto',
                        }}
                      >
                        {isExpanded ? '− HIDE' : '+ DETAILS'}
                      </button>
                    </div>

                    {/* Row 2: URL + method */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                      <div>
                        <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 2 }}>URL / ENDPOINT</div>
                        <div style={{ ...MONO, fontSize: 10.5, color: src.url === 'N/A' ? 'var(--mute)' : TEAL, wordBreak: 'break-all' }}>
                          {src.url}
                        </div>
                      </div>
                      <div>
                        <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 2 }}>SOURCING METHOD</div>
                        <div style={{ fontSize: 11, color: 'var(--ink2)' }}>{src.method}</div>
                      </div>
                    </div>

                    {/* Row 3: scope + auth + freq + license */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                      <MetaItem label="SCOPE" value={src.scope} />
                      <MetaItem label="AUTH" value={src.auth} />
                      <MetaItem label="UPDATE FREQ" value={src.updateFreq} />
                      <MetaItem label="LICENSE" value={src.license} />
                    </div>

                    {/* Row 4: notes */}
                    <div style={{
                      padding: '6px 10px', background: 'var(--sunken)', borderRadius: 3,
                      fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.4,
                    }}>
                      {src.notes}
                    </div>

                    {/* Row 5: agents using */}
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>AGENTS:</span>
                      <span style={{ ...MONO, fontSize: 9.5, color: 'var(--ink3)' }}>{src.agentsUsing}</span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{
                        marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--edge)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        {/* Data types */}
                        {src.dataTypes && (
                          <div>
                            <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 4 }}>DATA TYPES</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {src.dataTypes.map((dt, j) => (
                                <span key={j} style={{
                                  ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                                  border: '1px solid var(--edge)', background: 'var(--panel)',
                                  color: 'var(--ink3)',
                                }}>
                                  {dt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Coverage + rate limit */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {src.coverage && <MetaItem label="COVERAGE" value={src.coverage} />}
                          {src.rateLimit && <MetaItem label="RATE LIMIT" value={src.rateLimit} />}
                        </div>

                        {/* Health details */}
                        {health && (
                          <div style={{
                            padding: '8px 10px', background: 'var(--sunken)', borderRadius: 3,
                            border: `1px solid ${healthColor}`,
                          }}>
                            <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 4 }}>
                              LAST HEALTH CHECK
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <span style={{ ...MONO, fontSize: 10, color: healthColor }}>
                                {health.health?.toUpperCase()}
                              </span>
                              {health.count !== undefined && (
                                <span style={{ ...MONO, fontSize: 10, color: 'var(--ink3)' }}>
                                  Records: {health.count}
                                </span>
                              )}
                              {health.lastCheck && (
                                <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>
                                  {new Date(health.lastCheck).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {health.sample && (
                              <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', marginTop: 4, wordBreak: 'break-all' }}>
                                Sample: {health.sample}
                              </div>
                            )}
                            {health.error && (
                              <div style={{ ...MONO, fontSize: 9.5, color: CRIT, marginTop: 4, wordBreak: 'break-all' }}>
                                Error: {health.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetaItem({ label, value }) {
  return (
    <div>
      <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink2)' }}>{value}</div>
    </div>
  );
}
