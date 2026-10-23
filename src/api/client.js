// client.js — Fetch wrapper for the DisruptionMatrix backend API + WebSocket stream
// Uses VITE_API_URL env var for the backend URL.
// Locally: http://localhost:3001/api
// Production: https://disruptionmatrix-backend.up.railway.app/api (via Vercel rewrites)

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── REST helpers ────────────────────────────────────────────────────

async function fetchJSON(path, options) {
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`[API] ${path}:`, err.message);
    throw err;
  }
}

// Build query string from a filter object (empty/undefined values skipped)
function _qs(filter) {
  if (!filter || typeof filter !== 'object') return '';
  const entries = Object.entries(filter).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export const api = {
  health: () => fetchJSON('/health'),
  getAgents: (params = '') => fetchJSON(`/agents${params ? '?' + params : ''}`),
  getAgentTypes: () => fetchJSON('/agents/types'),
  getAgent: (id) => fetchJSON(`/agents/${id}`),
  triggerAgent: (id) => fetchJSON(`/agents/${id}/trigger`, { method: 'POST' }),
  refreshAllAgents: () => fetchJSON('/agents/refresh-all', { method: 'POST' }),
  getAgentsRuntime: () => fetchJSON('/agents-runtime'),
  getRegions: () => fetchJSON('/regions'),
  getRegion: (id) => fetchJSON(`/regions/${id}`),
  getSignals: (params = '') => fetchJSON(`/signals${params ? '?' + params : ''}`),
  getSignal: (id) => fetchJSON(`/signals/${id}`),
  getEvents: (params = '') => fetchJSON(`/events${params ? '?' + params : ''}`),
  getEvent: (id) => fetchJSON(`/events/${id}`),
  getOPS: (eventId) => fetchJSON(`/events/${eventId}/ops`),
  getArchivedEvents: (params = '') => fetchJSON(`/events?archived=only${params ? '&' + params : ''}`),
  archiveEvent: (id) => fetchJSON(`/events/${id}/archive`, { method: 'POST' }),
  restoreEvent: (id) => fetchJSON(`/events/${id}/restore`, { method: 'POST' }),
  runArchiveSweep: () => fetchJSON('/maintenance/archive', { method: 'POST' }),
  recomputeOPS: (eventId) => fetchJSON(`/events/${eventId}/ops/recompute`, { method: 'POST' }),
  computeAllOPS: () => fetchJSON('/ops/compute-all', { method: 'POST' }),
  mergeDuplicates: () => fetchJSON('/pipeline/merge-duplicates', { method: 'POST' }),
  getReference: () => fetchJSON('/reference'),
  getPipeline: () => fetchJSON('/pipeline'),
  runPipeline: () => fetchJSON('/pipeline/run', { method: 'POST' }),
  getSources: (health = false) => fetchJSON(`/sources${health ? '?health=true' : ''}`),
  getSource: (id) => fetchJSON(`/sources/${id}`),
  testSource: (id) => fetchJSON(`/sources/${id}/test`, { method: 'POST' }),
  chat: (question, history = [], docTypes = null) =>
    fetchJSON('/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, history, docTypes }) }),
  chatSuggest: () => fetchJSON('/chat/suggest'),
  chatIndex: () => fetchJSON('/chat/index', { method: 'POST' }),
  chatStats: () => fetchJSON('/chat/stats'),
  chatRetrieve: (query, docTypes = null) =>
    fetchJSON('/chat/retrieve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, docTypes }) }),
  // LLM settings (per-purpose: prediction + conversation)
  getLLMSettings: () => fetchJSON('/llm'),
  setPredictionEnabled: (enabled) =>
    fetchJSON('/llm/prediction/enabled', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }),
  setConversationEnabled: (enabled) =>
    fetchJSON('/llm/conversation/enabled', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }),
  setPredictionProvider: (provider) =>
    fetchJSON('/llm/prediction/active-provider', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) }),
  setConversationProvider: (provider) =>
    fetchJSON('/llm/conversation/active-provider', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) }),
  saveLLMProvider: (provider, config, purpose = 'prediction') =>
    fetchJSON(`/llm/providers/${provider}?purpose=${purpose}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }),
  testLLM: (purpose = 'prediction') =>
    fetchJSON(`/llm/test?purpose=${purpose}`, { method: 'POST' }),
  // Real data mode
  getRealDataMode: () => fetchJSON('/settings/real-data-mode'),
  setRealDataMode: (enabled) =>
    fetchJSON('/settings/real-data-mode', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }),

  // Threat profiling
  getProfilingStatus: () => fetchJSON('/profiling/status'),
  getProfilingStatusForEvent: (eventId) => fetchJSON(`/profiling/status/${eventId}`),
  triggerProfiling: (eventIds, force = false) =>
    fetchJSON('/profiling/trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventIds, force }) }),
  triggerAllProfiling: (options = {}) =>
    fetchJSON('/profiling/trigger-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options) }),
  cancelProfiling: (eventId) =>
    fetchJSON(`/profiling/cancel/${eventId}`, { method: 'POST' }),
  clearProfiling: () =>
    fetchJSON('/profiling/clear', { method: 'POST' }),
  getProfilingLLMStatus: () => fetchJSON('/profiling/llm-status'),
  getProfilingLogs: (eventId = null, limit = 200) =>
    fetchJSON(`/profiling/logs${eventId ? `/${eventId}` : ''}?limit=${limit}`),
  setProfilingLLMEnabled: (enabled) =>
    fetchJSON('/profiling/llm-enabled', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }),
  setProfilingProvider: (provider) =>
    fetchJSON('/profiling/active-provider', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) }),

  // ── Master Data ─────────────────────────────────────────────────────
  getMasterSummary: () => fetchJSON('/master/summary'),
  getAirports: (filter = {}) => fetchJSON('/master/airports' + _qs(filter)),
  getAirport: (iata) => fetchJSON(`/master/airports/${iata}`),
  upsertAirport: (data) => fetchJSON('/master/airports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteAirport: (iata) => fetchJSON(`/master/airports/${iata}`, { method: 'DELETE' }),
  getAirlines: (filter = {}) => fetchJSON('/master/airlines' + _qs(filter)),
  getAirline: (iata) => fetchJSON(`/master/airlines/${iata}`),
  upsertAirline: (data) => fetchJSON('/master/airlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteAirline: (iata) => fetchJSON(`/master/airlines/${iata}`, { method: 'DELETE' }),
  getMasterRegions: () => fetchJSON('/master/regions'),
  getMasterRegion: (id) => fetchJSON(`/master/regions/${id}`),
  upsertRegion: (data) => fetchJSON('/master/regions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteRegion: (id) => fetchJSON(`/master/regions/${id}`, { method: 'DELETE' }),
  getRegionCountries: (id) => fetchJSON(`/master/regions/${id}/countries`),
  setRegionCountries: (id, countries) => fetchJSON(`/master/regions/${id}/countries`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ countries }) }),
  getSubRegions: (regionId) => fetchJSON('/master/sub-regions' + _qs(regionId ? { region: regionId } : {})),
  upsertSubRegion: (data) => fetchJSON('/master/sub-regions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteSubRegion: (id) => fetchJSON(`/master/sub-regions/${id}`, { method: 'DELETE' }),
  getCategories: () => fetchJSON('/master/categories'),
  upsertCategory: (data) => fetchJSON('/master/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteCategory: (id) => fetchJSON(`/master/categories/${id}`, { method: 'DELETE' }),
  getMasterAgentTypes: () => fetchJSON('/master/agent-types'),
  upsertAgentType: (data) => fetchJSON('/master/agent-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteAgentType: (type) => fetchJSON(`/master/agent-types/${type}`, { method: 'DELETE' }),
  getHazardTypes: () => fetchJSON('/master/hazard-types'),
  upsertHazardType: (data) => fetchJSON('/master/hazard-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteHazardType: (type) => fetchJSON(`/master/hazard-types/${type}`, { method: 'DELETE' }),
  getHazardKeywords: (hazardType) => fetchJSON('/master/hazard-keywords' + _qs(hazardType ? { hazard_type: hazardType } : {})),
  upsertHazardKeyword: (data) => fetchJSON('/master/hazard-keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteHazardKeyword: (id) => fetchJSON(`/master/hazard-keywords/${id}`, { method: 'DELETE' }),
  getDomains: () => fetchJSON('/master/domains'),
  upsertDomain: (data) => fetchJSON('/master/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteDomain: (id) => fetchJSON(`/master/domains/${id}`, { method: 'DELETE' }),
  getDomainProfiles: (categoryId) => fetchJSON('/master/domain-profiles' + _qs(categoryId ? { category_id: categoryId } : {})),
  upsertDomainProfile: (data) => fetchJSON('/master/domain-profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteDomainProfile: (id) => fetchJSON(`/master/domain-profiles/${id}`, { method: 'DELETE' }),
  getScoringBands: () => fetchJSON('/master/scoring-bands'),
  upsertScoringBand: (data) => fetchJSON('/master/scoring-bands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteScoringBand: (id) => fetchJSON(`/master/scoring-bands/${id}`, { method: 'DELETE' }),
  getEdpsFactors: () => fetchJSON('/master/edps-factors'),
  upsertEdpsFactor: (data) => fetchJSON('/master/edps-factors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteEdpsFactor: (id) => fetchJSON(`/master/edps-factors/${id}`, { method: 'DELETE' }),
  getBandValues: (bandType) => fetchJSON('/master/band-values' + _qs(bandType ? { band_type: bandType } : {})),
  upsertBandValue: (data) => fetchJSON('/master/band-values', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteBandValue: (id) => fetchJSON(`/master/band-values/${id}`, { method: 'DELETE' }),
  getWmoCodes: () => fetchJSON('/master/wmo-codes'),
  upsertWmoCode: (data) => fetchJSON('/master/wmo-codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteWmoCode: (code) => fetchJSON(`/master/wmo-codes/${code}`, { method: 'DELETE' }),
  getLlmProviders: () => fetchJSON('/master/llm-providers'),
  upsertLlmProvider: (data) => fetchJSON('/master/llm-providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteLlmProvider: (key) => fetchJSON(`/master/llm-providers/${key}`, { method: 'DELETE' }),
  getConnectors: (connector) => fetchJSON('/master/connectors' + _qs(connector ? { connector } : {})),
  upsertConnectorConfig: (data) => fetchJSON('/master/connectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteConnectorConfig: (id) => fetchJSON(`/master/connectors/${id}`, { method: 'DELETE' }),
  getGdeltQueries: (category) => fetchJSON('/master/gdelt-queries' + _qs(category ? { category } : {})),
  upsertGdeltQuery: (data) => fetchJSON('/master/gdelt-queries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteGdeltQuery: (id) => fetchJSON(`/master/gdelt-queries/${id}`, { method: 'DELETE' }),
  getSubreddits: () => fetchJSON('/master/subreddits'),
  upsertSubreddit: (data) => fetchJSON('/master/subreddits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteSubreddit: (id) => fetchJSON(`/master/subreddits/${id}`, { method: 'DELETE' }),
  getFlightRoutes: (routeType) => fetchJSON('/master/flight-routes' + _qs(routeType ? { route_type: routeType } : {})),
  upsertFlightRoute: (data) => fetchJSON('/master/flight-routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteFlightRoute: (id) => fetchJSON(`/master/flight-routes/${id}`, { method: 'DELETE' }),
  getMockScenarios: (filter = {}) => fetchJSON('/master/mock-scenarios' + _qs(filter)),
  upsertMockScenario: (data) => fetchJSON('/master/mock-scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteMockScenario: (id) => fetchJSON(`/master/mock-scenarios/${id}`, { method: 'DELETE' }),
};

// ── WebSocket / SSE stream ──────────────────────────────────────────

export function createStream(callback) {
  // Use relative path so Vite proxy handles it locally
  // In production, Vercel rewrites /api/stream to the Railway backend
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/^http/, 'ws')}/stream`
    : `${protocol}//${window.location.host}/api/stream`;

  let ws = null;
  let reconnectTimer = null;
  let shouldReconnect = true;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[Stream] WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          callback(message);
        } catch (e) {
          console.error('[Stream] Parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[Stream] WebSocket closed');
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (e) {
      console.error('[Stream] WebSocket error:', e);
      if (shouldReconnect) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return {
    close: () => {
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
  };
}

export default api;
