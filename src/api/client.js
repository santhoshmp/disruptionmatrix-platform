// client.js — Fetch wrapper for the DisruptionMatrix backend API + WebSocket stream

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

export const api = {
  health: () => fetchJSON('/health'),
  getAgents: (params = '') => fetchJSON(`/agents${params ? '?' + params : ''}`),
  getAgentTypes: () => fetchJSON('/agents/types'),
  getAgent: (id) => fetchJSON(`/agents/${id}`),
  triggerAgent: (id) => fetchJSON(`/agents/${id}/trigger`, { method: 'POST' }),
  getAgentsRuntime: () => fetchJSON('/agents-runtime'),
  getRegions: () => fetchJSON('/regions'),
  getRegion: (id) => fetchJSON(`/regions/${id}`),
  getSignals: (params = '') => fetchJSON(`/signals${params ? '?' + params : ''}`),
  getSignal: (id) => fetchJSON(`/signals/${id}`),
  getEvents: (params = '') => fetchJSON(`/events${params ? '?' + params : ''}`),
  getEvent: (id) => fetchJSON(`/events/${id}`),
  getOPS: (eventId) => fetchJSON(`/events/${eventId}/ops`),
  recomputeOPS: (eventId) => fetchJSON(`/events/${eventId}/ops/recompute`, { method: 'POST' }),
  computeAllOPS: () => fetchJSON('/ops/compute-all', { method: 'POST' }),
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
};

// ── WebSocket / SSE stream ──────────────────────────────────────────

export function createStream(callback) {
  const wsUrl = (import.meta.env.VITE_API_URL || 'ws://localhost:3001/api').replace(/^http/, 'ws') + '/stream';

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
