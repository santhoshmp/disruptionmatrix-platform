// llm-service.js — Provider-agnostic LLM service
// Supports OpenAI, Anthropic, Azure OpenAI, Google Gemini, Mistral, and Custom (private cloud)
// Two separate purposes:
//   'prediction'   — event scoring, signal enrichment, correlation (higher complexity)
//   'conversation' — RAG-powered chat assistant (lower complexity, cheaper)
// Each purpose has its own enabled flag, active provider, and provider configs.
// LLM is OFF by default. Must be enabled via admin settings.

import llmSettingsRepo from '../db/repositories/llm-settings.js';
import store from '../store/event-store.js';
import pool from '../db/pool.js';

// ── Settings helpers (read from settings table) ─────────────────────

async function _getSetting(key, defaultValue = null) {
  const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return res.rows[0]?.value || defaultValue;
}

async function _setSetting(key, value) {
  await pool.query(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [key, String(value)]);
}

// ── LLM on/off flags (per purpose) ──────────────────────────────────

// Prediction LLM (event scoring, signal enrichment)
export async function isLLMEnabled() {
  const val = await _getSetting('llm_enabled', 'false');
  return val === 'true';
}

export async function setLLMEnabled(enabled) {
  await _setSetting('llm_enabled', enabled ? 'true' : 'false');
  console.log(`[LLM] Prediction ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// Conversation LLM (chat assistant)
export async function isConversationLLMEnabled() {
  const val = await _getSetting('llm_conversation_enabled', 'false');
  return val === 'true';
}

export async function setConversationLLMEnabled(enabled) {
  await _setSetting('llm_conversation_enabled', enabled ? 'true' : 'false');
  console.log(`[LLM] Conversation ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// ── Active providers (per purpose) ──────────────────────────────────

// Prediction active provider
export async function getActiveProvider() {
  return _getSetting('llm_active_provider', 'openai');
}

export async function setActiveProvider(provider) {
  await _setSetting('llm_active_provider', provider);
  console.log(`[LLM] Prediction active provider: ${provider}`);
}

// Conversation active provider
export async function getConversationActiveProvider() {
  return _getSetting('llm_conversation_active_provider', 'openai');
}

export async function setConversationActiveProvider(provider) {
  await _setSetting('llm_conversation_active_provider', provider);
  console.log(`[LLM] Conversation active provider: ${provider}`);
}

// ── Provider configs (masked for display) ───────────────────────────

export async function getProviderConfigs(purpose = null) {
  const configs = await llmSettingsRepo.getAll(purpose);
  return configs.map(c => ({
    ...c,
    apiKey: llmSettingsRepo.maskApiKey(c.apiKey),
    hasKey: !!c.apiKey,
  }));
}

// ── Save provider config (for a specific purpose) ──────────────────

export async function saveProviderConfig(provider, { apiKey, apiBase, model, enabled, purpose = 'prediction' }) {
  // If apiKey is masked (starts with ****), keep the existing key
  if (apiKey && apiKey.startsWith('****')) {
    const existing = await llmSettingsRepo.getByProvider(provider, purpose);
    apiKey = existing?.apiKey || null;
  }
  await llmSettingsRepo.upsert({ provider, apiKey, apiBase, model, enabled, purpose });
  console.log(`[LLM] Saved ${purpose} config for ${provider}`);
}

// ── Get full config for making API calls (unmasked) ─────────────────

// For prediction (event scoring, signal enrichment)
async function _getActiveConfig() {
  if (!store.dbReady) return null;
  const enabled = await isLLMEnabled();
  if (!enabled) return null;
  const provider = await getActiveProvider();
  const config = await llmSettingsRepo.getByProvider(provider, 'prediction');
  if (!config || !config.apiKey) return null;
  return config;
}

// For conversation (chat assistant)
async function _getConversationConfig() {
  if (!store.dbReady) return null;
  const enabled = await isConversationLLMEnabled();
  if (!enabled) return null;
  const provider = await getConversationActiveProvider();
  const config = await llmSettingsRepo.getByProvider(provider, 'conversation');
  if (!config) return null;
  // For custom/private cloud providers, apiKey may be optional
  if (!config.apiKey && config.provider !== 'custom') return null;
  return config;
}

// ── Chat completion (provider-agnostic) ──────────────────────────────
// Returns { content, provider, model } or null if LLM is disabled
// options.purpose: 'prediction' | 'conversation' (defaults to 'prediction')

export async function chatCompletion(messages, options = {}) {
  const purpose = options.purpose || 'prediction';
  const config = purpose === 'conversation'
    ? await _getConversationConfig()
    : await _getActiveConfig();

  if (!config) {
    return null; // LLM disabled or not configured for this purpose
  }

  const { provider, apiKey, apiBase, model } = config;

  switch (provider) {
    case 'openai':
      return _callOpenAI(apiKey, apiBase, model || 'gpt-4o', messages, options);
    case 'anthropic':
      return _callAnthropic(apiKey, apiBase, model || 'claude-sonnet-4-20250514', messages, options);
    case 'azure':
      return _callAzure(apiKey, apiBase, model || 'gpt-4o', messages, options);
    case 'google':
      return _callGoogle(apiKey, model || 'gemini-1.5-pro', messages, options);
    case 'mistral':
      return _callMistral(apiKey, apiBase, model || 'mistral-large-latest', messages, options);
    case 'custom':
      return _callCustom(apiKey, apiBase, model || 'default', messages, options);
    default:
      console.error(`[LLM] Unknown provider: ${provider}`);
      return null;
  }
}

// ── Provider implementations ────────────────────────────────────────

async function _callOpenAI(apiKey, apiBase, model, messages, options) {
  const base = apiBase || 'https://api.openai.com/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    provider: 'openai',
    model,
  };
}

async function _callAnthropic(apiKey, apiBase, model, messages, options) {
  const base = apiBase || 'https://api.anthropic.com/v1';
  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: messages.filter(m => m.role !== 'system'),
      system: messages.find(m => m.role === 'system')?.content,
      max_tokens: options.maxTokens ?? 1000,
      temperature: options.temperature ?? 0.3,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.content[0].text,
    provider: 'anthropic',
    model,
  };
}

async function _callAzure(apiKey, apiBase, model, messages, options) {
  const url = `${apiBase}/chat/completions?api-version=2024-02-15-preview`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1000,
    }),
  });
  if (!res.ok) throw new Error(`Azure API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    provider: 'azure',
    model,
  };
}

async function _callGoogle(apiKey, model, messages, options) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const systemPrompt = messages.find(m => m.role === 'system')?.content;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 1000,
      },
    }),
  });
  if (!res.ok) throw new Error(`Google API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.candidates[0].content.parts[0].text,
    provider: 'google',
    model,
  };
}

async function _callMistral(apiKey, apiBase, model, messages, options) {
  const base = apiBase || 'https://api.mistral.ai/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1000,
    }),
  });
  if (!res.ok) throw new Error(`Mistral API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    provider: 'mistral',
    model,
  };
}

// ── Custom provider (private cloud / OpenAI-compatible endpoint) ────
// Supports any endpoint that follows the OpenAI chat completions API format.
// This is the standard for: vLLM, TGI, Ollama, LM Studio, LocalAI, etc.
// The apiBase should be the full base URL (e.g., https://my-llm.internal:8080/v1)
// The model should be the model name as recognized by the endpoint.
// apiKey is optional — if the endpoint requires auth, set it; if not, leave blank.

async function _callCustom(apiKey, apiBase, model, messages, options) {
  if (!apiBase) {
    throw new Error('Custom LLM provider requires API Base URL. Configure it in Admin Settings.');
  }

  // Ensure apiBase ends without trailing slash, then append /chat/completions
  const base = apiBase.replace(/\/+$/, '');
  const url = `${base}/chat/completions`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'default',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Custom LLM API error: ${res.status} ${errText}`);
  }

  const data = await res.json();

  // Handle OpenAI-compatible response format
  if (data.choices?.[0]?.message?.content) {
    return {
      content: data.choices[0].message.content,
      provider: 'custom',
      model: model || 'custom',
    };
  }

  // Handle alternative response formats (some private deployments)
  if (data.content) {
    return {
      content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
      provider: 'custom',
      model: model || 'custom',
    };
  }

  throw new Error('Custom LLM returned unexpected response format');
}

// ── Get config for a specific purpose (public, for retriever/embeddings) ─
export async function getConfigForPurpose(purpose = 'prediction') {
  return purpose === 'conversation'
    ? _getConversationConfig()
    : _getActiveConfig();
}

export default {
  isLLMEnabled,
  setLLMEnabled,
  isConversationLLMEnabled,
  setConversationLLMEnabled,
  getActiveProvider,
  setActiveProvider,
  getConversationActiveProvider,
  setConversationActiveProvider,
  getProviderConfigs,
  saveProviderConfig,
  chatCompletion,
  getConfigForPurpose,
};
