// reddit.js — Reddit connector for social disruption reports.
// Free OAuth tier: 100 queries/minute per client ID (10-min average).
// Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars.
//
// Monitors aviation subreddits for passenger/crew reports of delays,
// cancellations, diversions, ground stops — often 30-60min before NOTAMs.
//
// When credentials are absent, all functions return empty arrays (no-op).
// The SocialAgent falls back to mock-social.js.

import { fetchWithTimeout } from './http-utils.js';
import { configureRateLimit, waitForToken, updateFromHeaders } from '../data/rate-limiter.js';
import * as refLoader from '../data/reference-loader.js';

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API_BASE = 'https://oauth.reddit.com';
// Phase 7: read from DB-backed ref_connectors via loader
const _timeout = () => refLoader.getConnectorConfig('reddit', 'timeout_ms', 12000);
const _cacheTtl = () => refLoader.getConnectorConfig('reddit', 'cache_ttl_ms', 300000);
const _limit = () => refLoader.getConnectorConfig('reddit', 'limit', 25);

// 100 QPM = 1.67/sec. Allow burst of 25, refill at 1.67/sec.
configureRateLimit('reddit', { capacity: 25, refillPerSec: 1.67 });

// Phase 7: read from DB-backed ref_subreddits via loader
const _subreddits = () => refLoader.getSubreddits();

const DISRUPTION_KEYWORDS = [
  'cancelled', 'canceled', 'delayed', 'delay', 'diverted', 'diversion',
  'ground stop', 'ground delay', 'closure', 'closed', 'stranded',
  'stuck', 'missed connection', 'rerouted', 'grounded', 'notam',
  'weather delay', 'mechanical', 'atc', 'airspace',
];

let token = null;
let tokenExpiry = 0;
const cache = new Map(); // key: subreddit → { data, time }

function isConfigured() {
  return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

async function getAuthToken() {
  if (!isConfigured()) return null;
  if (token && Date.now() < tokenExpiry) return token;
  try {
    const auth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
    const res = await fetchWithTimeout(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DisruptionMatrix/1.0 (threat intelligence)',
      },
      body: 'grant_type=client_credentials',
    }, _timeout());
    if (res.ok) {
      const data = await res.json();
      token = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return token;
    }
  } catch (err) {
    console.error('[reddit] auth failed:', err.message);
  }
  return null;
}

// Fetch newest posts from a subreddit, filter for disruption keywords.
export async function fetchSubredditPosts(subreddit, limit = 25) {
  if (!isConfigured()) return [];
  const cacheKey = subreddit;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < _cacheTtl()) return cached.data;

  await waitForToken('reddit');
  const tok = await getAuthToken();
  if (!tok) return [];

  try {
    const res = await fetchWithTimeout(`${API_BASE}/r/${subreddit}/new?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${tok}`,
        'User-Agent': 'DisruptionMatrix/1.0 (threat intelligence)',
      },
    }, _timeout());
    updateFromHeaders('reddit', Object.fromEntries(res.headers.entries()));
    if (!res.ok) throw new Error(`Reddit ${res.status}`);
    const data = await res.json();
    const posts = (data.data?.children || [])
      .map(c => c.data)
      .filter(p => p && p.title)
      .map(parsePost)
      .filter(p => p.relevanceScore > 0); // only keep disruption-relevant posts
    cache.set(cacheKey, { data: posts, time: Date.now() });
    return posts;
  } catch (err) {
    console.error(`[reddit] r/${subreddit} fetch failed:`, err.message);
    return cached?.data || [];
  }
}

function parsePost(p) {
  const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
  const matchedKeywords = DISRUPTION_KEYWORDS.filter(k => text.includes(k));
  // Extract airport codes (3 uppercase letters) from title/text
  const airportCodes = (p.title + ' ' + (p.selftext || ''))
    .match(/\b([A-Z]{3})\b/g) || [];
  return {
    type: 'social_report',
    subreddit: p.subreddit_name_prefixed,
    title: p.title,
    author: p.author,
    createdUtc: new Date(p.created_utc * 1000).toISOString(),
    score: p.score,
    numComments: p.num_comments,
    url: `https://reddit.com${p.permalink}`,
    matchedKeywords,
    airportCodes: [...new Set(airportCodes)],
    relevanceScore: matchedKeywords.length
      + (p.score > 50 ? 2 : p.score > 10 ? 1 : 0)
      + (p.num_comments > 20 ? 1 : 0),
    summary: p.title,
    hazardType: matchedKeywords.includes('cancelled') ? 'cancellation'
      : matchedKeywords.includes('diverted') ? 'diversion'
      : matchedKeywords.includes('ground stop') ? 'groundstop'
      : matchedKeywords.length > 2 ? 'massdelay'
      : 'socialreport',
    corroborateOnly: true, // social signals enrich existing events, don't create new ones
  };
}

// Fetch from all monitored subreddits, merged + sorted by relevance.
export async function fetchAllSubreddits() {
  const all = [];
  for (const sub of _subreddits()) {
    const posts = await fetchSubredditPosts(sub);
    all.push(...posts);
  }
  return all.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export default {
  isConfigured,
  fetchSubredditPosts,
  fetchAllSubreddits,
  get SUBREDDITS() { return _subreddits(); },
};
