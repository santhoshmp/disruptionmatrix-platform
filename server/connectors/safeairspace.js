// safeairspace.js — Connector for safeairspace.net (Conflict Zone & Risk Database)
// safeairspace.net is a free, independent airspace risk database maintained by OPSGROUP.
// It provides country-level airspace risk assessments (Level 1-3, No Fly/Caution/OK).
//
// Data source: https://safeairspace.net/
// No official API — we scrape the country pages for risk level + summary.
// Rate limit: be respectful, cache results for at least 1 hour.

import { fetchWithTimeout } from './http-utils.js';

const BASE_URL = 'https://safeairspace.net';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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

// ── API ─────────────────────────────────────────────────────────────

// Get airspace risk for a specific country
export async function getAirspaceRisk(countryName) {
  const slug = COUNTRY_SLUGS[countryName];
  if (!slug) {
    return { country: countryName, riskLevel: 'Unknown', summary: 'No data available for this country.', source: 'safeairspace.net', url: null };
  }

  // Check cache
  const cached = cache.get(countryName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `${BASE_URL}/${slug}/`;
    const html = await fetchWithTimeout(url, {}, 8000);
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
  }
}

// Get airspace risk for multiple countries (batch)
export async function getAirspaceRisks(countryNames) {
  const results = await Promise.allSettled(
    countryNames.map((c) => getAirspaceRisk(c))
  );
  return results.map((r, i) => r.value || {
    country: countryNames[i],
    riskLevel: 'Unknown',
    summary: 'Failed to fetch.',
    source: 'safeairspace.net',
  });
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
    // Normalize: "One - No Fly", "Two - Permitted with Pl...", "Three - Caution"
    if (/no.?fly/i.test(level)) return 'Level 1 - No Fly';
    if (/two/i.test(level)) return 'Level 2 - Permitted with Precautions';
    if (/three/i.test(level)) return 'Level 3 - Caution';
    if (/level\s*1/i.test(level)) return 'Level 1 - No Fly';
    if (/level\s*2/i.test(level)) return 'Level 2 - Permitted with Precautions';
    if (/level\s*3/i.test(level)) return 'Level 3 - Caution';
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

export default {
  getAirspaceRisk,
  getAirspaceRisks,
  getMonitoredCountries,
};
