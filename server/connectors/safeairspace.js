// safeairspace.js — Connector for safeairspace.net (Conflict Zone & Risk Database)
// safeairspace.net is a free, independent airspace risk database maintained by OPSGROUP.
// It provides country-level airspace risk assessments (Level 1-3, No Fly/Caution/OK).
//
// Data source: https://safeairspace.net/
// No official API — we scrape the country pages for risk level + summary.
// Rate limit: be respectful, cache results for at least 1 hour.

import { fetchWithTimeout } from './http-utils.js';
import * as refLoader from '../data/reference-loader.js';

const BASE_URL = 'https://safeairspace.net';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('safeairspace', 'timeout_ms', 10000);
const _cacheTtl = () => refLoader.getConnectorConfig('safeairspace', 'cache_ttl_ms', 3600000);

// Country name → safeairspace.net URL slug mapping
// (safeairspace.net uses country-name slugs, not ICAO codes)
const COUNTRY_SLUGS = {
  'India': 'india',
  'Pakistan': 'pakistan',
  'Afghanistan': 'afghanistan',
  'Iran': 'iran',
  'Iraq': 'iraq',
  'Syria': 'syria',
  'Yemen': 'yemen',
  'Libya': 'libya',
  'Mali': 'mali',
  'Ukraine': 'ukraine',
  'Russia': 'russia',
  'Belarus': 'belarus',
  'Moldova': 'moldova',
  'Israel': 'israel',
  'Lebanon': 'lebanon',
  'Egypt': 'egypt',
  'Sudan': 'sudan',
  'South Sudan': 'south-sudan',
  'Ethiopia': 'ethiopia',
  'Eritrea': 'eritrea',
  'Somalia': 'somalia',
  'Kenya': 'kenya',
  'Nigeria': 'nigeria',
  'Mali': 'mali',
  'Burkina Faso': 'burkina-faso',
  'Niger': 'niger',
  'Chad': 'chad',
  'Central African Republic': 'central-african-republic',
  'Democratic Republic of Congo': 'dr-congo',
  'Rwanda': 'rwanda',
  'Burundi': 'burundi',
  'Venezuela': 'venezuela',
  'Colombia': 'colombia',
  'Haiti': 'haiti',
  'Myanmar': 'myanmar',
  'North Korea': 'north-korea',
  'China': 'china',
  'Taiwan': 'taiwan',
  'Philippines': 'philippines',
  'Indonesia': 'indonesia',
  'Saudi Arabia': 'saudi-arabia',
  'Azerbaijan': 'azerbaijan',
  'United Arab Emirates': 'uae',
  'Qatar': 'qatar',
  'Kuwait': 'kuwait',
  'Bahrain': 'bahrain',
  'Oman': 'oman',
  'Jordan': 'jordan',
  'Turkey': 'turkey',
  'Cyprus': 'cyprus',
  'Greece': 'greece',
  'Balkans': 'balkans',
  'Serbia': 'serbia',
  'Kosovo': 'kosovo',
  'Albania': 'albania',
  'North Macedonia': 'north-macedonia',
  'Montenegro': 'montenegro',
  'Bosnia': 'bosnia',
  'Croatia': 'croatia',
  'Slovenia': 'slovenia',
  'Hungary': 'hungary',
  'Romania': 'romania',
  'Bulgaria': 'bulgaria',
  'Poland': 'poland',
  'Lithuania': 'lithuania',
  'Latvia': 'latvia',
  'Estonia': 'estonia',
  'Finland': 'finland',
  'Sweden': 'sweden',
  'Norway': 'norway',
  'Denmark': 'denmark',
  'Germany': 'germany',
  'France': 'france',
  'United Kingdom': 'united-kingdom',
  'Ireland': 'ireland',
  'Iceland': 'iceland',
  'Spain': 'spain',
  'Portugal': 'portugal',
  'Italy': 'italy',
  'Switzerland': 'switzerland',
  'Austria': 'austria',
  'Czech Republic': 'czech-republic',
  'Slovakia': 'slovakia',
  'Netherlands': 'netherlands',
  'Belgium': 'belgium',
  'Luxembourg': 'luxembourg',
  'Japan': 'japan',
  'South Korea': 'south-korea',
  'Thailand': 'thailand',
  'Vietnam': 'vietnam',
  'Cambodia': 'cambodia',
  'Laos': 'laos',
  'Malaysia': 'malaysia',
  'Singapore': 'singapore',
  'Australia': 'australia',
  'New Zealand': 'new-zealand',
  'United States': 'united-states',
  'Canada': 'canada',
  'Mexico': 'mexico',
  'Brazil': 'brazil',
  'Argentina': 'argentina',
  'Chile': 'chile',
  'Peru': 'peru',
  'Bolivia': 'bolivia',
  'Ecuador': 'ecuador',
  'Colombia': 'colombia',
  'Paraguay': 'paraguay',
  'Uruguay': 'uruguay',
};

const cache = new Map(); // country → { data, timestamp }
const inflight = new Map(); // country → Promise (dedupe concurrent fetches)

// ── API ─────────────────────────────────────────────────────────────

// Get airspace risk for a specific country.
// Dedupes concurrent requests — a burst of agents polling at the same
// time shares one in-flight fetch per country instead of ~12 parallel
// hits to safeairspace.net (which timed out under load).
export async function getAirspaceRisk(countryName) {
  const slug = COUNTRY_SLUGS[countryName];
  if (!slug) {
    return { country: countryName, riskLevel: 'Unknown', summary: 'No data available for this country.', source: 'safeairspace.net', url: null };
  }

  // Check cache
  const cached = cache.get(countryName);
  if (cached && Date.now() - cached.timestamp < _cacheTtl()) {
    return cached.data;
  }

  // Share an in-flight fetch
  if (inflight.has(countryName)) return inflight.get(countryName);

  const p = (async () => {
    try {
      const url = `${BASE_URL}/${slug}/`;
      const html = await fetchWithTimeout(url, {}, 15000);
      const text = await html.text();

      // Parse risk level from the page
      const riskLevel = _parseRiskLevel(text);
      const summary = _parseSummary(text);
      const warnings = _parseWarnings(text);

      const data = {
        country: countryName,
        riskLevel,
        summary,
        warnings,
        source: 'safeairspace.net',
        url,
        fetchedAt: new Date().toISOString(),
      };

      cache.set(countryName, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.error(`[safeairspace] Failed to fetch ${countryName}:`, err.message);
      return {
        country: countryName,
        riskLevel: 'Unknown',
        summary: 'Failed to fetch airspace data.',
        source: 'safeairspace.net',
        url: `${BASE_URL}/${slug}/`,
        error: err.message,
      };
    } finally {
      inflight.delete(countryName);
    }
  })();

  inflight.set(countryName, p);
  return p;
}

// Get airspace risk for multiple countries (batch, limited concurrency —
// parallel bursts get us rate-limited / timed out)
export async function getAirspaceRisks(countryNames, concurrency = 3) {
  const results = new Array(countryNames.length);
  let idx = 0;
  async function worker() {
    while (idx < countryNames.length) {
      const i = idx++;
      try {
        results[i] = await getAirspaceRisk(countryNames[i]);
      } catch {
        results[i] = { country: countryNames[i], riskLevel: 'Unknown', summary: 'Failed to fetch.', source: 'safeairspace.net' };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, countryNames.length) }, worker));
  return results;
}

// Get all monitored countries (those we have slugs for)
export function getMonitoredCountries() {
  return Object.keys(COUNTRY_SLUGS);
}

// ── Parsing helpers ─────────────────────────────────────────────────

function _parseRiskLevel(html) {
  // safeairspace.net shows "Risk Level: One/Two/Three" or "No Fly" etc.
  const match = html.match(/Risk Level:\s*<[^>]*>\s*([^<]+)/i);
  if (match) {
    const level = match[1].trim();
    // Normalize: "One - Do Not Fly", "Two - Permitted with Pl...", "Three - Caution"
    if (/do.?not.?fly|no.?fly|prohibited/i.test(level)) return 'Level 1 - No Fly';
    if (/two|permitted|level\s*2/i.test(level)) return 'Level 2 - Permitted with Precautions';
    if (/three|caution|level\s*3/i.test(level)) return 'Level 3 - Caution';
    if (/one|level\s*1/i.test(level)) return 'Level 1 - No Fly';
    return level;
  }

  // Alternative: look for risk level in heading
  const hMatch = html.match(/<h[1-6][^>]*>.*?(No.?Fly|Level\s*[1-3]|Caution|Permitted).*?<\/h[1-6]>/i);
  if (hMatch) return hMatch[1].trim();

  return 'Unknown';
}

function _parseSummary(html) {
  // Extract the main summary paragraph (usually after "Risk Level" heading)
  // Look for paragraph text after the risk level
  const match = html.match(/<\/h[1-6]>\s*<p[^>]*>([^<]{50,500})<\/p>/i);
  if (match) {
    return match[1].trim().replace(/\s+/g, ' ');
  }

  // Alternative: look for the first substantial paragraph
  const pMatch = html.match(/<p[^>]*>([^<]{80,500})<\/p>/i);
  if (pMatch) {
    return pMatch[1].trim().replace(/\s+/g, ' ');
  }

  return 'No summary available.';
}

function _parseWarnings(html) {
  // Extract warning references (NOTAM numbers, etc.)
  const warnings = [];
  const matches = html.matchAll(/(?:NOTAM|Notam|AIC|AIP)\s*([A-Z]{4})\s*([A-Z0-9\/]+)/gi);
  for (const m of matches) {
    warnings.push(`${m[0]}`);
    if (warnings.length >= 5) break;
  }
  return warnings;
}

// Map a normalized risk-level string to a numeric level for agent logic.
function levelOf(riskLevel) {
  if (!riskLevel) return 0;
  if (/level\s*1|no fly|do not fly|prohibited/i.test(riskLevel)) return 1;
  if (/level\s*2|permitted/i.test(riskLevel)) return 2;
  if (/level\s*3|caution/i.test(riskLevel)) return 3;
  return 0; // Unknown
}

// Build signal observations from country airspace-risk results.
// Emits for Level 1 (No Fly), Level 2 (Permitted with Precautions) and
// Level 3 (Caution) — the kind of geopolitical airspace advisory that
// should always surface on the threat board.
export function buildAirspaceObservations(risks, region, subRegion) {
  const observations = [];
  for (const r of risks || []) {
    const level = levelOf(r.riskLevel);
    if (level === 0) continue; // Unknown / no data

    const countryAirports = refLoader.getAirportsByCountry(r.country) || [];
    const iatas = countryAirports.map((a) => a.iata).filter(Boolean);
    const anchor = countryAirports.find((a) => a.lat && a.lon) || {};

    const severity = level === 1 ? 90 : level === 2 ? 70 : 45;
    const name =
      level === 1 ? `Airspace CLOSED: ${r.country} (Do Not Fly)`
      : level === 2 ? `Airspace warning: ${r.country} (Level 2 — precautions)`
      : `Airspace caution: ${r.country} (Level 3)`;

    observations.push({
      signalId: `safeairspace-${r.country}-${Date.now()}`,
      detected: r.fetchedAt || new Date().toISOString(),
      name,
      hazardType: 'airspace_restriction',
      geo: { lat: anchor.lat || 0, lon: anchor.lon || 0, radiusKm: 600 },
      airports: iatas,
      airspace: [r.country],
      summary: `${r.country} airspace risk: ${r.riskLevel}. ${r.summary || ''}`.slice(0, 300),
      factorHints: {
        probability: 85,
        severity,
        geographicReach: level === 1 ? 85 : 60,
        expectedDuration: 70,
        timeToImpact: level === 1 ? 95 : 60,
        escalationRate: 40,
        sourceCredibility: 85, // OPSGROUP-maintained risk database
        predictionConfidence: 70,
      },
      domains: ['Flight schedule', 'Aircraft rotations', 'Regulatory', 'Airport operations'],
      preliminaryEffects: level === 1
        ? [{ ord: 1, title: `Overflight of ${r.country} prohibited — reroutes required`, lead: '0–2h' }]
        : [{ ord: 1, title: `Operators should review ${r.country} overflight advisories`, lead: '0–24h' }],
      evidence: [{
        source: 'SafeAirspace.net (OPSGROUP)',
        tier: 1,
        role: 'Conflict-zone airspace risk assessment',
        timestamp: r.fetchedAt || new Date().toISOString(),
        excerpt: `${r.country}: ${r.riskLevel}${(r.warnings || []).length ? ' — ' + r.warnings.join(', ') : ''}`,
        url: r.url,
      }],
      rawRefs: [`safeairspace-${r.country}`],
      dataSourceMode: 'real',
      region,
      subRegion,
    });
  }
  return observations;
}

export default {
  getAirspaceRisk,
  getAirspaceRisks,
  getMonitoredCountries,
  buildAirspaceObservations,
};
