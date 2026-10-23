// gdelt.js — GDELT Project connector for global event monitoring
// Free, no API key. Global news event database.
// Source: https://api.gdeltproject.org/api/v2/events
//
// Used for: industrial action (strikes, walkouts), geopolitical events (border closures,
// conflicts, sanctions), regulatory changes, infrastructure failures reported in news.
// GDELT structures global news into events with CAMEO codes, actors, locations, tone.
//
// Aviation-relevant CAMEO codes:
// 14: Protest (strikes, walkouts, industrial action)
// 15: Appeal (regulatory appeals, policy demands)
// 17: Coerce (sanctions, embargoes)
// 18: Assault (military actions, conflicts)
// 19: Fight (armed conflict, border clashes)
// 20: Mass violence

import { fetchWithTimeout } from './http-utils.js';
import * as refLoader from '../data/reference-loader.js';

const GDELT_EVENTS_URL = 'https://api.gdeltproject.org/api/v2/events';
const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('gdelt', 'timeout_ms', 15000);
const _cacheTtl = () => refLoader.getConnectorConfig('gdelt', 'cache_ttl_ms', 3600000);
const _minInterval = () => refLoader.getConnectorConfig('gdelt', 'min_request_interval', 6000);

const cache = new Map(); // key: query → { data, time }
let lastRequestTime = 0; // global rate limit across all GDELT requests

// Aviation-relevant keywords for each disruption category
// Phase 7: read from DB-backed ref_gdelt_queries via loader
const CATEGORY_QUERIES = {
  industrial: '(airline strike OR airport strike OR ATC strike OR ground handler strike OR pilot strike OR cabin crew strike OR aviation walkout OR aviation industrial action)',
  geopolitical: '(airspace closure OR flight ban OR aviation sanctions OR airspace restriction OR no-fly zone OR conflict zone aviation)',
  infrastructure: '(airport runway closure OR airport power outage OR airport fuel shortage OR ILS outage OR airport infrastructure failure)',
  regulatory: '(aviation regulation OR airworthiness directive OR DGCA directive OR EASA regulation OR FAA directive OR aviation safety order)',
  flight: '(flight cancellations OR mass flight delays OR airport ground stop OR airline grounding OR fleet grounding OR ATC system outage OR mass diversions)',
};

function _getQuery(category) {
  const fromDb = refLoader.getGdeltQuery(category);
  if (fromDb) return fromDb;
  return CATEGORY_QUERIES[category] || null;
}

export async function fetchEvents(category, options = {}) {
  const query = _getQuery(category);
  if (!query) return [];

  const { maxRecords = 25, days = 7 } = options;
  const cacheKey = `${category}:${days}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < _cacheTtl()) {
    return cached.data;
  }

  // Global rate limiting — GDELT asks for max 1 request per 5 seconds
  const elapsed = Date.now() - lastRequestTime;
  const minInterval = _minInterval();
  if (elapsed < minInterval) {
    const wait = minInterval - elapsed;
    console.log(`[gdelt] Rate limiting: waiting ${Math.round(wait / 1000)}s...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  let events = [];

  try {
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startDate = startTime.toISOString().slice(0, 10).replace(/-/g, '');

    const params = new URLSearchParams({
      query,
      mode: 'ArtList',
      maxrecords: String(maxRecords),
      format: 'json',
      sort: 'DateDesc',
      startdatetime: startDate,
    });

    const res = await fetchWithTimeout(`${GDELT_DOC_URL}?${params}`, {}, _timeout());
    if (res.ok) {
      const text = await res.text();
      // GDELT sometimes returns a rate-limit message instead of JSON
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
          const data = JSON.parse(text);
          events = (data.articles || []).map(parseGDELArticle);
        } catch {
          console.error('[gdelt] JSON parse failed, likely rate-limited');
        }
      } else {
        console.error('[gdelt] Non-JSON response (rate-limited):', text.slice(0, 100));
      }
    }
  } catch (err) {
    console.error('[gdelt] fetch failed:', err.message);
  }

  cache.set(cacheKey, { data: events, time: Date.now() });
  return events;
}

function parseGDELArticle(article) {
  return {
    url: article.url || '',
    urlMobile: article.url_mobile || '',
    title: article.title || '',
    language: article.language || '',
    sourceCountry: article.sourcecountry || '',
    socialImage: article.socialimage || '',
    domain: article.domain || '',
    date: article.seendate || '',
    sourceName: article.sourcename || '',
    // Extract location from title if possible
    summary: article.title || '',
  };
}

// Build observations from GDELT articles
export function buildGDELTObservations(articles, category, region, subRegion) {
  const observations = [];

  const categoryConfig = {
    industrial: {
      hazardType: 'strike',
      domains: ['Airport operations', 'Crew', 'Passengers'],
      effects: [
        { ord: 1, title: 'Potential flight cancellations and reduced capacity', lead: '12–48h' },
      ],
      defaultSeverity: 55,
    },
    geopolitical: {
      hazardType: 'airspace_restriction',
      domains: ['Flight schedule', 'Aircraft rotations', 'Regulatory'],
      effects: [
        { ord: 1, title: 'Rerouting may be required for affected corridors', lead: '0–6h' },
      ],
      defaultSeverity: 60,
    },
    infrastructure: {
      hazardType: 'infrastructure_failure',
      domains: ['Airport operations', 'Flight schedule', 'Maintenance'],
      effects: [
        { ord: 1, title: 'Reduced airport capacity', lead: '0–4h' },
      ],
      defaultSeverity: 58,
    },
    regulatory: {
      hazardType: 'regulatory_change',
      domains: ['Regulatory', 'Flight schedule', 'Crew'],
      effects: [
        { ord: 1, title: 'Compliance review required', lead: '24–72h' },
      ],
      defaultSeverity: 45,
    },
  };

  const config = categoryConfig[category];
  if (!config) return [];

  for (const article of articles.slice(0, 10)) { // limit to 10 per poll
    observations.push({
      signalId: `gdelt-${category}-${article.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      detected: article.date ? new Date(article.date).toISOString() : new Date().toISOString(),
      name: article.title.slice(0, 100),
      hazardType: config.hazardType,
      geo: { lat: 0, lon: 0, radiusKm: 200 }, // GDELT doesn't always provide coords
      airports: [],
      airspace: [],
      summary: article.title,
      factorHints: {
        probability: 60,
        severity: config.defaultSeverity,
        geographicReach: 40,
        expectedDuration: 50,
        timeToImpact: 50,
        escalationRate: 45,
        sourceCredibility: 65, // news source (not official)
        predictionConfidence: 50, // news-based, needs verification
      },
      domains: config.domains,
      preliminaryEffects: config.effects,
      evidence: [{
        source: `GDELT / ${article.sourceName || article.domain}`,
        tier: 2,
        role: 'News-based signal (needs verification)',
        timestamp: article.date || new Date().toISOString(),
        excerpt: article.title,
        url: article.url,
      }],
      rawRefs: [`gdelt-${article.domain}-${article.date}`],
      dataSourceMode: 'real',
    });
  }

  return observations;
}

export default { fetchEvents, buildGDELTObservations, CATEGORY_QUERIES };
