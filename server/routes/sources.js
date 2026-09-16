// sources.js — API routes for data source status and health
// GET /api/sources          — list all data sources with live health status
// GET /api/sources/:id       — single source detail with last fetch result
// POST /api/sources/:id/test — manually test a source connection

import { Router } from 'express';
import { fetchWithTimeout } from '../connectors/http-utils.js';
import faaASWS from '../connectors/faa-asws.js';
import faaTFR from '../connectors/faa-tfr.js';
import eonet from '../connectors/nasa-eonet.js';
import usgs from '../connectors/usgs-earthquakes.js';
import openMeteo from '../connectors/open-meteo.js';
import gdelt from '../connectors/gdelt.js';
import aw from '../connectors/aviationweather.js';
import safeairspace from '../connectors/safeairspace.js';

const router = Router();

// Source registry with live health check functions
const SOURCES = [
  {
    id: 'noaa-awc',
    category: 'Weather',
    name: 'NOAA/NWS Aviation Weather Center',
    type: 'REST API',
    url: 'https://aviationweather.gov/api/data',
    auth: 'None (public)',
    license: 'Public domain (US Government)',
    tier: 1,
    updateFreq: 'Every 5 min',
    coverage: 'Global (METAR/TAF/SIGMET)',
    dataTypes: ['METAR', 'TAF', 'SIGMET', 'PIREP'],
    agentsUsing: 'weather-* (9 agents)',
    check: async () => {
      const metars = await aw.fetchMETAR(['KJFK']);
      return { status: 'ok', count: metars.length, sample: metars[0]?.rawOb?.slice(0, 80) || 'no data' };
    },
  },
  {
    id: 'open-meteo',
    category: 'Weather',
    name: 'Open-Meteo',
    type: 'REST API',
    url: 'https://api.open-meteo.com/v1/forecast',
    auth: 'None (free, CC BY 4.0)',
    license: 'CC BY 4.0 (non-commercial)',
    tier: 1,
    updateFreq: 'Every 1-6 hours (model dependent)',
    coverage: 'Global (10K+ weather models)',
    dataTypes: ['Temperature', 'Wind', 'Precipitation', 'Visibility', 'Weather codes'],
    agentsUsing: 'weather-* (supplementary forecast)',
    check: async () => {
      const data = await openMeteo.fetchForecast(40.7, -74.0);
      return { status: 'ok', count: data?.hourly?.time?.length || 0, sample: 'forecast retrieved' };
    },
  },
  {
    id: 'nasa-eonet',
    category: 'Weather',
    name: 'NASA EONET (Earth Observatory Natural Event Tracker)',
    type: 'REST API',
    url: 'https://eonet.gsfc.nasa.gov/api/v3/events',
    auth: 'None (public)',
    license: 'Public domain (NASA)',
    tier: 1,
    updateFreq: 'Near real-time',
    coverage: 'Global',
    dataTypes: ['Wildfires', 'Volcanoes', 'Severe storms', 'Floods', 'Dust/haze', 'Snow', 'Temp extremes'],
    agentsUsing: 'weather-* (natural disaster events)',
    check: async () => {
      const events = await eonet.fetchEvents({ status: 'open', limit: 5, days: 7 });
      return { status: 'ok', count: events.length, sample: events[0]?.title?.slice(0, 80) || 'no events' };
    },
  },
  {
    id: 'usgs-earthquakes',
    category: 'Infrastructure',
    name: 'USGS Earthquake Hazards Program',
    type: 'REST API (GeoJSON)',
    url: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    auth: 'None (public)',
    license: 'Public domain (USGS)',
    tier: 1,
    updateFreq: 'Real-time',
    coverage: 'Global',
    dataTypes: ['Earthquake magnitude', 'Depth', 'Location', 'PAGER alert level', 'Tsunami flag'],
    agentsUsing: 'infrastructure-* (seismic events)',
    check: async () => {
      const quakes = await usgs.fetchEarthquakes({ days: 1, minMagnitude: 4.5 });
      return { status: 'ok', count: quakes.length, sample: quakes[0]?.title?.slice(0, 80) || 'no quakes' };
    },
  },
  {
    id: 'faa-asws',
    category: 'ATC / Airspace',
    name: 'FAA Airport Status Web Service (ASWS)',
    type: 'REST API',
    url: 'https://external-api.faa.gov/asws/api/airport/delays',
    auth: 'None (public)',
    license: 'Public domain (FAA)',
    tier: 1,
    updateFreq: 'Real-time',
    coverage: 'US (40 major airports)',
    dataTypes: ['Ground stops', 'Ground delay programs', 'Arrival/departure delays', 'Closures'],
    agentsUsing: 'atc-* (US airport delays)',
    check: async () => {
      const delays = await faaASWS.fetchAirportDelays();
      return { status: 'ok', count: delays.length, sample: delays[0]?.reason?.slice(0, 80) || 'no delays' };
    },
  },
  {
    id: 'faa-tfr',
    category: 'Geopolitical',
    name: 'FAA Temporary Flight Restrictions',
    type: 'REST API (JSON)',
    url: 'https://tfr.faa.gov/tfrapi/exportTfrList',
    auth: 'None (public)',
    license: 'Public domain (FAA)',
    tier: 1,
    updateFreq: 'Real-time',
    coverage: 'US airspace',
    dataTypes: ['VIP movements', 'Disaster TFRs', 'Special event TFRs', 'Airspace closures'],
    agentsUsing: 'geopolitical-* (US airspace restrictions)',
    check: async () => {
      const tfrs = await faaTFR.fetchTFRs();
      return { status: 'ok', count: tfrs.length, sample: tfrs[0]?.name?.slice(0, 80) || 'no TFRs' };
    },
  },
  {
    id: 'safeairspace',
    category: 'Geopolitical',
    name: 'SafeAirspace.net (OPSGROUP)',
    type: 'Web scrape',
    url: 'https://safeairspace.net/',
    auth: 'None (public website)',
    license: 'Free, OPSGROUP-maintained',
    tier: 1,
    updateFreq: 'Cached 1 hour',
    coverage: 'Global (country-level)',
    dataTypes: ['Conflict zone risk levels', 'Airspace warnings', 'No-fly advisories'],
    agentsUsing: 'geopolitical-* (3 agents), Region Settings',
    check: async () => {
      // safeairspace doesn't export a simple fetch — just verify URL is reachable
      const res = await fetchWithTimeout('https://safeairspace.net/', {}, 5000);
      return { status: res.ok ? 'ok' : 'error', count: 0, sample: res.ok ? 'site reachable' : `HTTP ${res.status}` };
    },
  },
  {
    id: 'gdelt',
    category: 'Industrial Action',
    name: 'GDELT Project (Global Event Database)',
    type: 'REST API',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc',
    auth: 'None (public)',
    license: 'Open (GDELT Project)',
    tier: 2,
    updateFreq: 'Every 15 min',
    coverage: 'Global (news aggregation)',
    dataTypes: ['Strike/walkout news', 'Geopolitical events', 'Infrastructure failures', 'Regulatory changes'],
    agentsUsing: 'industrial-*, geopolitical-*, infrastructure-*, regulatory-*',
    check: async () => {
      const articles = await gdelt.fetchEvents('industrial', { days: 1, maxRecords: 5 });
      return { status: 'ok', count: articles.length, sample: articles[0]?.title?.slice(0, 80) || 'no articles' };
    },
  },
];

// GET /api/sources — list all sources with optional live health check
router.get('/', async (req, res) => {
  const { health } = req.query;

  if (health !== 'true') {
    // Return static info only (fast)
    return res.json({
      sources: SOURCES.map((s) => ({
        id: s.id,
        category: s.category,
        name: s.name,
        type: s.type,
        url: s.url,
        auth: s.auth,
        license: s.license,
        tier: s.tier,
        updateFreq: s.updateFreq,
        coverage: s.coverage,
        dataTypes: s.dataTypes,
        agentsUsing: s.agentsUsing,
      })),
    });
  }

  // Live health check — run all checks in parallel
  const results = await Promise.allSettled(
    SOURCES.map(async (s) => {
      try {
        const result = await s.check();
        return {
          id: s.id,
          category: s.category,
          name: s.name,
          type: s.type,
          url: s.url,
          auth: s.auth,
          license: s.license,
          tier: s.tier,
          updateFreq: s.updateFreq,
          coverage: s.coverage,
          dataTypes: s.dataTypes,
          agentsUsing: s.agentsUsing,
          health: 'ok',
          lastCheck: new Date().toISOString(),
          count: result.count,
          sample: result.sample,
        };
      } catch (err) {
        return {
          id: s.id,
          category: s.category,
          name: s.name,
          type: s.type,
          url: s.url,
          auth: s.auth,
          license: s.license,
          tier: s.tier,
          updateFreq: s.updateFreq,
          coverage: s.coverage,
          dataTypes: s.dataTypes,
          agentsUsing: s.agentsUsing,
          health: 'error',
          lastCheck: new Date().toISOString(),
          error: err.message,
        };
      }
    })
  );

  const sources = results.map((r) => r.value || r.reason?.message);
  res.json({ sources, checkedAt: new Date().toISOString() });
});

// GET /api/sources/:id — single source detail with live health check
router.get('/:id', async (req, res) => {
  const source = SOURCES.find((s) => s.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'Source not found' });

  try {
    const result = await source.check();
    res.json({
      id: source.id,
      category: source.category,
      name: source.name,
      type: source.type,
      url: source.url,
      auth: source.auth,
      license: source.license,
      tier: source.tier,
      updateFreq: source.updateFreq,
      coverage: source.coverage,
      dataTypes: source.dataTypes,
      agentsUsing: source.agentsUsing,
      health: 'ok',
      lastCheck: new Date().toISOString(),
      count: result.count,
      sample: result.sample,
    });
  } catch (err) {
    res.json({
      id: source.id,
      category: source.category,
      name: source.name,
      type: source.type,
      url: source.url,
      health: 'error',
      lastCheck: new Date().toISOString(),
      error: err.message,
    });
  }
});

// POST /api/sources/:id/test — manually test a source
router.post('/:id/test', async (req, res) => {
  const source = SOURCES.find((s) => s.id === req.params.id);
  if (!source) return res.status(404).json({ error: 'Source not found' });

  try {
    const result = await source.check();
    res.json({
      id: source.id,
      health: 'ok',
      lastCheck: new Date().toISOString(),
      count: result.count,
      sample: result.sample,
    });
  } catch (err) {
    res.status(502).json({
      id: source.id,
      health: 'error',
      lastCheck: new Date().toISOString(),
      error: err.message,
    });
  }
});

export default router;
