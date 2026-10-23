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
import airlabs from '../connectors/airlabs.js';
import adsblol from '../connectors/adsblol.js';
import opensky from '../connectors/opensky.js';
import aviationstack from '../connectors/aviationstack.js';
import reddit from '../connectors/reddit.js';

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
    id: 'adsblol',
    category: 'Flight Tracking',
    name: 'adsb.lol Community ADS-B',
    type: 'REST API',
    url: 'https://api.adsb.lol/v2',
    auth: 'None (free, community feeder network)',
    license: 'Open (community)',
    tier: 1,
    updateFreq: 'Real-time (cached 5 min)',
    coverage: 'Global — often denser than OpenSky in Gulf/Asia',
    dataTypes: ['Live positions', 'Ground activity', 'Emergency squawks (7700/7600/7500)'],
    agentsUsing: 'flight-* (live ground activity + emergency squawks)',
    check: async () => {
      const ac = await adsblol.fetchAircraftNearPoint(25.2532, 55.3657, 15); // DXB
      return { status: 'ok', count: ac.length, sample: ac[0]?.callsign || `${ac.length} aircraft near DXB` };
    },
  },
  {
    id: 'airlabs',
    category: 'Flight Schedules',
    name: 'AirLabs Flight Data API',
    type: 'REST API',
    url: 'https://airlabs.co/api/v9',
    auth: 'API key (free tier ~1,000 req/month)',
    license: 'Commercial (AirLabs)',
    tier: 2,
    updateFreq: 'Real-time (cached 15 min)',
    coverage: 'Global (scheduled vs actual, delays, cancellations)',
    dataTypes: ['Schedules', 'Delays', 'Cancellations', 'Flight status'],
    agentsUsing: 'flight-* (scheduled vs actual flights)',
    check: async () => {
      if (!airlabs.isConfigured()) {
        return { status: 'ok', count: 0, sample: 'not configured — set AIRLABS_KEY' };
      }
      const deps = await airlabs.fetchDepartures('JFK', 5);
      return { status: 'ok', count: deps.length, sample: deps[0]?.flightNumber || 'no flights' };
    },
  },
  {
    id: 'opensky',
    category: 'Flight Tracking',
    name: 'OpenSky Network',
    type: 'REST API (OAuth2)',
    url: 'https://opensky-network.org/api',
    auth: 'OAuth2 client credentials (optional — anonymous works with lower quota)',
    license: 'Open (OpenSky Network)',
    tier: 2,
    updateFreq: 'Real-time (cached 90s)',
    coverage: 'Global live states; /flights/* actual dep/arr (daily quota bucket)',
    dataTypes: ['Live positions', 'Flight arrivals/departures', 'Ground activity'],
    agentsUsing: 'flight-* (live positions + actual flight times)',
    check: async () => {
      // states bucket is separate from flights bucket; uses shared cache
      const states = await opensky.fetchAllStates();
      return { status: 'ok', count: states.length, sample: `${states.length} aircraft tracked globally` };
    },
  },
  {
    id: 'aviationstack',
    category: 'Flight Schedules',
    name: 'AviationStack',
    type: 'REST API',
    url: 'https://api.aviationstack.com/v1',
    auth: 'API key (paid — AirLabs preferred when configured)',
    license: 'Commercial (AviationStack)',
    tier: 2,
    updateFreq: 'Real-time (cached 15 min)',
    coverage: 'Global (scheduled vs actual, delays, cancellations)',
    dataTypes: ['Schedules', 'Delays', 'Cancellations', 'Flight status'],
    agentsUsing: 'flight-* (fallback when AIRLABS_KEY not set)',
    check: async () => {
      if (!aviationstack.isConfigured()) {
        return { status: 'ok', count: 0, sample: 'not configured — set AVIATIONSTACK_KEY' };
      }
      const deps = await aviationstack.fetchDepartures('JFK', 5);
      return { status: 'ok', count: deps.length, sample: deps[0]?.flightNumber || 'no flights' };
    },
  },
  {
    id: 'reddit',
    category: 'Social',
    name: 'Reddit API',
    type: 'REST API (OAuth2)',
    url: 'https://www.reddit.com',
    auth: 'OAuth2 app credentials (free — reddit.com/prefs/apps)',
    license: 'Reddit API terms',
    tier: 2,
    updateFreq: 'Every 5 min',
    coverage: 'r/aviation, r/flights and regional subreddits',
    dataTypes: ['Passenger reports', 'Delay/cancel complaints', 'Incident sightings'],
    agentsUsing: 'social-* (17 agents)',
    check: async () => {
      if (!reddit.isConfigured()) {
        return { status: 'ok', count: 0, sample: 'not configured — set REDDIT_CLIENT_ID/SECRET' };
      }
      const posts = await reddit.fetchSubredditPosts('aviation', 5);
      return { status: 'ok', count: posts.length, sample: posts[0]?.title?.slice(0, 80) || 'no posts' };
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
