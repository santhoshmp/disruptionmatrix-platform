import { useState, useEffect } from 'react';
import { MONO, TEAL, CRIT, HIGH, OK } from '../theme.js';
import { api } from '../api/client.js';

const API_BASE = 'http://localhost:3001/api';

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    keyPrefix: 'sk-',
    keyUrl: 'https://platform.openai.com/api-keys',
    docs: 'platform.openai.com/docs',
    color: '#10A37F',
    keyRequired: true,
  },
  anthropic: {
    name: 'Anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    keyPrefix: 'sk-ant-',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    docs: 'docs.anthropic.com',
    color: '#D97757',
    keyRequired: true,
  },
  azure: {
    name: 'Azure OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4', 'gpt-35-turbo'],
    keyPrefix: '',
    keyUrl: 'https://portal.azure.com',
    docs: 'learn.microsoft.com/azure/ai-services/openai',
    color: '#0078D4',
    needsBase: true,
    keyRequired: true,
    basePlaceholder: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}',
  },
  google: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest'],
    keyPrefix: '',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    docs: 'ai.google.dev/gemini-api/docs',
    color: '#4285F4',
    keyRequired: true,
  },
  mistral: {
    name: 'Mistral AI',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x7b'],
    keyPrefix: '',
    keyUrl: 'https://console.mistral.ai/api-keys',
    docs: 'docs.mistral.ai',
    color: '#FF7000',
    keyRequired: true,
  },
  custom: {
    name: 'Custom / Private Cloud',
    defaultModel: '',
    models: [],
    keyPrefix: '',
    keyUrl: null,
    docs: null,
    color: '#8B5CF6',
    needsBase: true,
    keyRequired: false, // API key optional for private endpoints
    basePlaceholder: 'https://my-llm.internal:8080/v1',
    isCustom: true,
    description: 'Any OpenAI-compatible endpoint (vLLM, TGI, Ollama, LM Studio, LocalAI, etc.)',
  },
};

const PURPOSE_INFO = {
  prediction: {
    label: 'Event Prediction',
    description: 'Used for signal enrichment, correlation reasoning, and impact narratives. Typically requires a higher-capability model.',
    toggleKey: 'predictionEnabled',
    providerKey: 'predictionProvider',
    formsKey: 'predictionForms',
    color: TEAL,
    recommendedModels: 'gpt-4o, claude-sonnet-4-20250514, mistral-large-latest',
  },
  conversation: {
    label: 'Conversation Agent',
    description: 'Used for the RAG-powered chat assistant. A lower-complexity model is sufficient and more cost-effective.',
    toggleKey: 'conversationEnabled',
    providerKey: 'conversationProvider',
    formsKey: 'conversationForms',
    color: '#8B5CF6',
    recommendedModels: 'gpt-4o-mini, gpt-3.5-turbo, claude-3-5-haiku-20241022, mistral-small-latest, or any private cloud model',
  },
};

export default function AdminSettings() {
  const [tab, setTab] = useState('params');
  const [predictionEnabled, setPredictionEnabled] = useState(false);
  const [conversationEnabled, setConversationEnabled] = useState(false);
  const [predictionProvider, setPredictionProvider] = useState('openai');
  const [conversationProvider, setConversationProvider] = useState('openai');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // {purpose, provider}
  const [testing, setTesting] = useState(null); // purpose being tested
  const [testResults, setTestResults] = useState({}); // {prediction: result, conversation: result}
  const [error, setError] = useState(null);
  // Editable form state per provider per purpose
  const [predictionForms, setPredictionForms] = useState({});
  const [conversationForms, setConversationForms] = useState({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.getLLMSettings();
      setPredictionEnabled(data.prediction.enabled);
      setConversationEnabled(data.conversation.enabled);
      setPredictionProvider(data.prediction.activeProvider);
      setConversationProvider(data.conversation.activeProvider);

      // Build form state for both purposes
      setPredictionForms(buildForms(data.prediction.providers));
      setConversationForms(buildForms(data.conversation.providers));
    } catch (e) {
      setError('Failed to load settings: ' + e.message);
    }
    setLoading(false);
  }

  function buildForms(providers) {
    const formState = {};
    for (const [key, info] of Object.entries(PROVIDER_INFO)) {
      const existing = providers.find(p => p.provider === key);
      formState[key] = {
        apiKey: existing?.hasKey ? existing.apiKey : '',
        apiBase: existing?.apiBase || '',
        model: existing?.model || info.defaultModel,
        enabled: existing?.enabled || false,
        hasKey: existing?.hasKey || false,
      };
    }
    return formState;
  }

  async function toggleLLM(purpose) {
    const enabled = purpose === 'prediction' ? !predictionEnabled : !conversationEnabled;
    if (purpose === 'prediction') {
      setPredictionEnabled(enabled);
      try { await api.setPredictionEnabled(enabled); } catch (e) { setPredictionEnabled(!enabled); setError(e.message); }
    } else {
      setConversationEnabled(enabled);
      try { await api.setConversationEnabled(enabled); } catch (e) { setConversationEnabled(!enabled); setError(e.message); }
    }
  }

  async function selectActiveProvider(purpose, provider) {
    if (purpose === 'prediction') {
      setPredictionProvider(provider);
      try { await api.setPredictionProvider(provider); } catch (e) { setError(e.message); }
    } else {
      setConversationProvider(provider);
      try { await api.setConversationProvider(provider); } catch (e) { setError(e.message); }
    }
  }

  function updateForm(purpose, provider, field, value) {
    const setter = purpose === 'prediction' ? setPredictionForms : setConversationForms;
    setter(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  }

  async function saveProvider(purpose, provider) {
    setSaving({ purpose, provider });
    try {
      const forms = purpose === 'prediction' ? predictionForms : conversationForms;
      const form = forms[provider];
      await api.saveLLMProvider(provider, {
        apiKey: form.apiKey || undefined,
        apiBase: form.apiBase || undefined,
        model: form.model,
        enabled: form.enabled,
      }, purpose);
      await loadSettings(); // Reload to get masked key
    } catch (e) {
      setError(`Failed to save ${purpose}/${provider}: ${e.message}`);
    }
    setSaving(null);
  }

  async function testConnection(purpose) {
    setTesting(purpose);
    setTestResults(prev => ({ ...prev, [purpose]: null }));
    try {
      const result = await api.testLLM(purpose);
      setTestResults(prev => ({ ...prev, [purpose]: result }));
    } catch (e) {
      setTestResults(prev => ({ ...prev, [purpose]: { success: false, message: e.message } }));
    }
    setTesting(null);
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--mute)', ...MONO }}>Loading admin settings...</div>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ flex: '0 0 auto', padding: '20px 26px', borderBottom: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Admin Settings</div>
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>System parameters &amp; LLM providers</div>
        </div>
        {error && (
          <div style={{ color: CRIT, fontSize: 12, ...MONO }}>{error}</div>
        )}
      </div>

      <div style={{ padding: '20px 26px', maxWidth: 920 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--edge)' }}>
          {[['params', 'PARAMETERS'], ['profile', 'THREAT PROFILE'], ['llm', 'LLM SETUP']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                ...MONO, fontSize: 12, padding: '9px 18px', cursor: 'pointer',
                background: 'none', border: 'none', fontWeight: 700,
                color: tab === id ? TEAL : 'var(--mute)',
                borderBottom: `2px solid ${tab === id ? TEAL : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'llm' && <>
          {/* Info banner */}
          <div style={{
            padding: '12px 16px', marginBottom: 24, borderRadius: 4,
            background: 'var(--panel2)', border: '1px solid var(--edge)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={TEAL} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{ fontSize: 12.5, color: 'var(--mute)', lineHeight: 1.6 }}>
              <strong>Two LLM purposes are configured separately:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                <li><strong style={{ color: TEAL }}>Event Prediction</strong> — signal enrichment, correlation, impact narratives. Use a higher-capability model.</li>
                <li><strong style={{ color: '#8B5CF6' }}>Conversation Agent</strong> — RAG-powered chat. A lower-complexity model is sufficient and cheaper.</li>
              </ul>
              Each can use a different provider, model, and API endpoint. The <strong>Custom</strong> provider supports any OpenAI-compatible private cloud endpoint (vLLM, TGI, Ollama, LM Studio, etc.).
            </div>
          </div>

          {/* Render both purposes */}
          {Object.entries(PURPOSE_INFO).map(([purpose, info]) => {
            const enabled = purpose === 'prediction' ? predictionEnabled : conversationEnabled;
            const activeProvider = purpose === 'prediction' ? predictionProvider : conversationProvider;
            const forms = purpose === 'prediction' ? predictionForms : conversationForms;
            const testResult = testResults[purpose];
            const isTesting = testing === purpose;

            return (
              <PurposeSection
                key={purpose}
                purpose={purpose}
                info={info}
                enabled={enabled}
                activeProvider={activeProvider}
                forms={forms}
                testResult={testResult}
                isTesting={isTesting}
                saving={saving}
                onToggle={() => toggleLLM(purpose)}
                onSelectProvider={(p) => selectActiveProvider(purpose, p)}
                onUpdateForm={(provider, field, value) => updateForm(purpose, provider, field, value)}
                onSave={(provider) => saveProvider(purpose, provider)}
                onTest={() => testConnection(purpose)}
              />
            );
          })}
        </>}

        {tab === 'params' && <>
          {/* System operations: event lifecycle + agent feed refresh */}
          <SystemOperations onError={setError} />
        </>}

        {tab === 'profile' && <>
          {/* Threat profiling: EDPS factors, score bands, derivation reference */}
          <ThreatProfile onError={setError} />
        </>}

        {tab === 'llm' && (
          /* Info section */
          <div style={{ marginTop: 28, padding: 16, border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel2)' }}>
            <div className="kicker" style={{ marginBottom: 8 }}>HOW LLM IS USED</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--mute)', lineHeight: 1.7 }}>
              <li><strong style={{ color: TEAL }}>Prediction LLM</strong> — signal enrichment, correlation reasoning, impact narratives, evidence assessment</li>
              <li><strong style={{ color: '#8B5CF6' }}>Conversation LLM</strong> — RAG-powered chat assistant, natural language Q&A over the knowledge base</li>
            </ul>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hover)', fontSize: 11, color: 'var(--faint)', ...MONO }}>
              When a purpose's LLM is OFF, it falls back to deterministic/rule-based mode. No API calls are made.
              API keys are stored in the database and never exposed to the frontend (only last 4 characters shown).
              The Custom provider uses the OpenAI chat completions API format — compatible with vLLM, TGI, Ollama, LM Studio, LocalAI, and most private LLM deployments.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Purpose section (prediction or conversation) ───────────────────
function PurposeSection({ purpose, info, enabled, activeProvider, forms, testResult, isTesting, saving, onToggle, onSelectProvider, onUpdateForm, onSave, onTest }) {
  const providers = Object.keys(PROVIDER_INFO);

  return (
    <div style={{
      marginBottom: 28,
      border: `1px solid ${info.color}40`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        padding: '14px 18px',
        background: info.color + '08',
        borderBottom: `1px solid ${info.color}30`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 10, height: 10, background: info.color, borderRadius: '50%' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: info.color }}>{info.label}</div>
          <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: 2 }}>{info.description}</div>
        </div>
        {/* Toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)' }}>{enabled ? 'ENABLED' : 'DISABLED'}</span>
          <button
            onClick={onToggle}
            style={{
              ...MONO, fontSize: 12, padding: '7px 16px', cursor: 'pointer',
              border: `1px solid ${enabled ? OK : 'var(--edge)'}`,
              background: enabled ? OK + '15' : 'var(--panel2)',
              color: enabled ? OK : 'var(--mute)',
              borderRadius: 4, fontWeight: 700,
            }}
          >
            {enabled ? '● ON' : '○ OFF'}
          </button>
        </div>
      </div>

      <div style={{ padding: '18px' }}>
        {/* Warning when off */}
        {!enabled && (
          <div style={{
            padding: '10px 14px', marginBottom: 16, borderRadius: 4,
            background: 'var(--panel2)', border: '1px solid var(--edge)',
            fontSize: 12, color: 'var(--mute)',
          }}>
            {purpose === 'prediction'
              ? 'Prediction LLM is OFF. Agents use deterministic rules and scenario templates.'
              : 'Conversation LLM is OFF. Chat returns deterministic summaries of retrieved documents.'}
          </div>
        )}

        {/* Active provider selector */}
        <div style={{ marginBottom: 18 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>ACTIVE PROVIDER</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {providers.map(p => {
              const pInfo = PROVIDER_INFO[p];
              const isActive = activeProvider === p;
              const form = forms[p];
              const hasKey = form?.hasKey || !pInfo.keyRequired;
              return (
                <button
                  key={p}
                  onClick={() => hasKey && onSelectProvider(p)}
                  disabled={!hasKey}
                  style={{
                    ...MONO, fontSize: 11, padding: '7px 12px', cursor: hasKey ? 'pointer' : 'not-allowed',
                    border: `1px solid ${isActive ? pInfo.color : 'var(--edge)'}`,
                    background: isActive ? pInfo.color + '15' : 'var(--panel2)',
                    color: isActive ? pInfo.color : hasKey ? 'var(--ink2)' : 'var(--faint)',
                    borderRadius: 3, fontWeight: 600,
                    opacity: hasKey ? 1 : 0.5,
                  }}
                >
                  {isActive ? '● ' : '○ '}{pInfo.name}
                  {pInfo.keyRequired && !hasKey && ' (no key)'}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 5, ...MONO }}>
            Recommended: {info.recommendedModels}
          </div>
        </div>

        {/* Test connection */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onTest}
            disabled={isTesting || !enabled}
            style={{
              ...MONO, fontSize: 11, padding: '7px 14px', cursor: (isTesting || !enabled) ? 'wait' : 'pointer',
              border: '1px solid var(--edge)', background: 'var(--panel2)',
              color: isTesting ? 'var(--mute)' : info.color, borderRadius: 3, fontWeight: 600,
              opacity: enabled ? 1 : 0.5,
            }}
          >
            {isTesting ? 'TESTING...' : `TEST ${info.label.toUpperCase()} CONNECTION`}
          </button>
          {testResult && (
            <div style={{
              ...MONO, fontSize: 11, padding: '6px 12px', borderRadius: 3,
              border: `1px solid ${testResult.success ? OK : CRIT}`,
              color: testResult.success ? OK : CRIT,
              background: testResult.success ? OK + '10' : CRIT + '10',
            }}>
              {testResult.success
                ? `✓ ${testResult.provider}/${testResult.model}: "${testResult.response?.trim()}"`
                : `✗ ${testResult.message}`}
            </div>
          )}
        </div>

        {/* Provider configs */}
        <div className="kicker" style={{ marginBottom: 10 }}>PROVIDER CONFIGURATION</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {providers.map(p => {
            const pInfo = PROVIDER_INFO[p];
            const form = forms[p] || {};
            const isActive = activeProvider === p;
            const isSaving = saving?.purpose === purpose && saving?.provider === p;
            return (
              <div key={p} style={{
                border: `1px solid ${isActive ? pInfo.color + '60' : 'var(--edge)'}`,
                borderLeft: `4px solid ${pInfo.color}`,
                borderRadius: 4, background: 'var(--panel2)', overflow: 'hidden',
              }}>
                {/* Provider header */}
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid var(--edge)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 10, height: 10, background: pInfo.color, borderRadius: 2 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{pInfo.name}</span>
                  {isActive && (
                    <span style={{
                      ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                      background: pInfo.color + '20', color: pInfo.color, fontWeight: 700,
                    }}>
                      ACTIVE
                    </span>
                  )}
                  {form.hasKey && (
                    <span style={{
                      ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                      border: `1px solid ${OK}`, color: OK, fontWeight: 700,
                    }}>
                      KEY SET
                    </span>
                  )}
                  {pInfo.isCustom && (
                    <span style={{
                      ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                      background: pInfo.color + '15', color: pInfo.color, fontWeight: 600,
                    }}>
                      PRIVATE CLOUD
                    </span>
                  )}
                  {pInfo.keyUrl && (
                    <a href={pInfo.keyUrl} target="_blank" rel="noopener noreferrer"
                      style={{ marginLeft: 'auto', ...MONO, fontSize: 10, color: 'var(--faint)', textDecoration: 'none' }}>
                      Get API key →
                    </a>
                  )}
                </div>

                {/* Provider form */}
                <div style={{ padding: '12px 14px' }}>
                  {pInfo.isCustom && (
                    <div style={{ marginBottom: 10, fontSize: 11, color: 'var(--mute)', fontStyle: 'italic' }}>
                      {pInfo.description}
                    </div>
                  )}

                  {/* API Key (optional for custom) */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ ...MONO, fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>
                      API KEY {pInfo.keyRequired ? '' : '(optional — leave blank if your endpoint has no auth)'}
                    </label>
                    <input
                      type="password"
                      value={form.apiKey || ''}
                      onChange={(e) => onUpdateForm(p, 'apiKey', e.target.value)}
                      placeholder={form.hasKey ? '•••• (saved — type new key to replace)' : pInfo.keyRequired ? `Enter ${pInfo.name} API key...` : 'Optional API key or bearer token...'}
                      style={{
                        width: '100%', ...MONO, fontSize: 12, padding: '7px 10px',
                        border: '1px solid var(--edge)', background: 'var(--bg)',
                        color: 'var(--ink2)', borderRadius: 3, boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* API Base (for providers that need it) */}
                  {pInfo.needsBase && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ ...MONO, fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>
                        API BASE URL {pInfo.isCustom && '(required)'}
                      </label>
                      <input
                        type="text"
                        value={form.apiBase || ''}
                        onChange={(e) => onUpdateForm(p, 'apiBase', e.target.value)}
                        placeholder={pInfo.basePlaceholder || 'https://...'}
                        style={{
                          width: '100%', ...MONO, fontSize: 12, padding: '7px 10px',
                          border: '1px solid var(--edge)', background: 'var(--bg)',
                          color: 'var(--ink2)', borderRadius: 3, boxSizing: 'border-box',
                        }}
                      />
                      {pInfo.isCustom && (
                        <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3, ...MONO }}>
                          The base URL without /chat/completions. The endpoint must accept OpenAI-format requests.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Model */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ ...MONO, fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>
                      MODEL {pInfo.isCustom && '(model name as recognized by your endpoint)'}
                    </label>
                    {pInfo.models.length > 0 ? (
                      <select
                        value={form.model || pInfo.defaultModel}
                        onChange={(e) => onUpdateForm(p, 'model', e.target.value)}
                        style={{
                          width: '100%', ...MONO, fontSize: 12, padding: '7px 10px',
                          border: '1px solid var(--edge)', background: 'var(--bg)',
                          color: 'var(--ink2)', borderRadius: 3, boxSizing: 'border-box',
                        }}
                      >
                        {pInfo.models.map(m => <option key={m} value={m}>{m}</option>)}
                        {form.model && !pInfo.models.includes(form.model) && (
                          <option value={form.model}>{form.model} (custom)</option>
                        )}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.model || ''}
                        onChange={(e) => onUpdateForm(p, 'model', e.target.value)}
                        placeholder="e.g., llama-3.1-8b-instruct, qwen2.5-72b, etc."
                        style={{
                          width: '100%', ...MONO, fontSize: 12, padding: '7px 10px',
                          border: '1px solid var(--edge)', background: 'var(--bg)',
                          color: 'var(--ink2)', borderRadius: 3, boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>

                  {/* Enable toggle + Save */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.enabled || false}
                        onChange={(e) => onUpdateForm(p, 'enabled', e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ ...MONO, fontSize: 11, color: 'var(--mute)' }}>Enable this provider</span>
                    </label>
                    <button
                      onClick={() => onSave(p)}
                      disabled={isSaving}
                      style={{
                        marginLeft: 'auto', ...MONO, fontSize: 11, padding: '6px 14px',
                        cursor: isSaving ? 'wait' : 'pointer',
                        border: '1px solid var(--edge)', background: 'var(--panel)',
                        color: info.color, borderRadius: 3, fontWeight: 600,
                      }}
                    >
                      {isSaving ? 'SAVING...' : 'SAVE'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── System operations: event lifecycle + agent feed refresh ─────────
// The age thresholds live in ref_connectors under connector='archiver'
// and are also editable in Master Data → Connectors. Values take effect
// within ~60s (reference-loader cache refresh), no restart needed.

const ARCHIVER_PARAMS = [
  { key: 'stale_age_hours', label: 'STALE AFTER (HOURS)', desc: 'Events with no fresh signals for this long archive if score < stale threshold', def: '72' },
  { key: 'max_age_hours', label: 'MAX AGE (HOURS)', desc: 'Hard retention cap — archives regardless of score (0 = disabled)', def: '240' },
  { key: 'stale_score', label: 'STALE SCORE LIMIT', desc: 'Score ceiling below which a stale event archives', def: '65' },
  { key: 'low_score', label: 'LOW-THREAT LIMIT', desc: 'Score below this archives immediately', def: '50' },
];

function SystemOperations({ onError }) {
  const [values, setValues] = useState({});
  const [savingParams, setSavingParams] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    api.getConnectors('archiver')
      .then(d => {
        const v = {};
        for (const p of ARCHIVER_PARAMS) {
          v[p.key] = (d.connectors || []).find(c => c.config_key === p.key)?.config_value ?? p.def;
        }
        setValues(v);
      })
      .catch(e => onError?.('Failed to load archiver params: ' + e.message));
  }, []);

  async function saveParams() {
    setSavingParams(true); setSaveMsg(null);
    try {
      for (const p of ARCHIVER_PARAMS) {
        await api.upsertConnectorConfig({
          connector: 'archiver',
          config_key: p.key,
          config_value: String(values[p.key] ?? p.def),
          config_type: 'float',
          description: p.desc,
        });
      }
      setSaveMsg({ ok: true, text: 'Saved — takes effect within ~60s' });
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message });
    }
    setSavingParams(false);
  }

  async function refreshFeeds() {
    setRefreshing(true); setRefreshMsg(null);
    try {
      const r = await api.refreshAllAgents();
      setRefreshMsg({ ok: true, text: r.message || `${r.triggered} agents refreshing` });
    } catch (e) {
      setRefreshMsg({ ok: false, text: e.message });
    }
    setRefreshing(false);
  }

  return (
    <div style={{
      marginTop: 28, border: '1px solid var(--edge)', borderRadius: 6,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', background: 'var(--panel2)',
        borderBottom: '1px solid var(--edge)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 10, height: 10, background: HIGH, borderRadius: '50%' }} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>System Operations</div>
      </div>

      <div style={{ padding: '18px' }}>
        {/* Event lifecycle */}
        <div className="kicker" style={{ marginBottom: 8 }}>EVENT FRESHNESS / ARCHIVING</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', marginBottom: 12, lineHeight: 1.6 }}>
          Events with no fresh signals for longer than <strong>Stale After</strong> archive automatically
          (unless still scoring high). <strong>Max Age</strong> is a hard cap — nothing stays active past it.
          Archived events move to the Archive screen.
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          {ARCHIVER_PARAMS.map(p => (
            <div key={p.key} style={{ minWidth: 150 }}>
              <label style={{ ...MONO, fontSize: 10, color: 'var(--faint)', display: 'block', marginBottom: 3 }}>
                {p.label}
              </label>
              <input
                type="number"
                value={values[p.key] ?? ''}
                onChange={(e) => setValues(v => ({ ...v, [p.key]: e.target.value }))}
                placeholder={p.def}
                style={{
                  width: 130, ...MONO, fontSize: 12, padding: '7px 10px',
                  border: '1px solid var(--edge)', background: 'var(--bg)',
                  color: 'var(--ink2)', borderRadius: 3,
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3, maxWidth: 200, lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button
            onClick={saveParams}
            disabled={savingParams}
            style={{
              ...MONO, fontSize: 11, padding: '7px 16px', cursor: savingParams ? 'wait' : 'pointer',
              border: `1px solid ${HIGH}`, background: HIGH + '12',
              color: HIGH, borderRadius: 3, fontWeight: 700,
            }}
          >
            {savingParams ? 'SAVING...' : 'SAVE THRESHOLDS'}
          </button>
          {saveMsg && (
            <span style={{ ...MONO, fontSize: 11, color: saveMsg.ok ? OK : CRIT }}>
              {saveMsg.ok ? '✓' : '✗'} {saveMsg.text}
            </span>
          )}
        </div>

        {/* Agent feed refresh */}
        <div className="kicker" style={{ marginBottom: 8 }}>AGENT FEEDS</div>
        <div style={{ fontSize: 11.5, color: 'var(--mute)', marginBottom: 12, lineHeight: 1.6 }}>
          Force every polling agent to fetch its sources now instead of waiting for the next
          scheduled cycle. Calls are staggered (~200ms apart) so external APIs aren't hit at once.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={refreshFeeds}
            disabled={refreshing}
            style={{
              ...MONO, fontSize: 11, padding: '7px 16px', cursor: refreshing ? 'wait' : 'pointer',
              border: `1px solid ${TEAL}`, background: TEAL + '12',
              color: TEAL, borderRadius: 3, fontWeight: 700,
            }}
          >
            {refreshing ? 'REFRESHING...' : '⟳ REFRESH ALL AGENT FEEDS'}
          </button>
          {refreshMsg && (
            <span style={{ ...MONO, fontSize: 11, color: refreshMsg.ok ? OK : CRIT }}>
              {refreshMsg.ok ? '✓' : '✗'} {refreshMsg.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Threat Profile: EDPS factors + score bands + derivation reference ─
// Factor weights/toggles and band thresholds live in ref_edps_factors and
// ref_scoring_bands; edits take effect within ~60s (loader cache refresh).

function ThreatProfile({ onError }) {
  const [factors, setFactors] = useState([]);
  const [bands, setBands] = useState([]);
  const [bandValues, setBandValues] = useState({});
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [f, b, bv] = await Promise.all([
        api.getEdpsFactors(),
        api.getScoringBands(),
        api.getBandValues(),
      ]);
      setFactors((f.factors || []).sort((a, b) => a.sort_order - b.sort_order));
      setBands((b.bands || []).sort((a, b) => b.min_score - a.min_score));
      const grouped = {};
      for (const v of bv.values || []) {
        (grouped[v.band_type] = grouped[v.band_type] || []).push(v);
      }
      setBandValues(grouped);
    } catch (e) {
      onError?.('Failed to load threat profile config: ' + e.message);
    }
  }

  async function saveFactor(f, patch) {
    setSaving(f.key); setMsg(null);
    try {
      const res = await api.upsertEdpsFactor({ ...f, ...patch });
      setFactors(prev => prev.map(x => x.key === f.key ? { ...x, ...res } : x));
      setMsg({ ok: true, text: `${f.key} saved` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setSaving(null);
  }

  async function saveBand(band, patch) {
    setSaving(band.band); setMsg(null);
    try {
      const res = await api.upsertScoringBand({ ...band, ...patch });
      setBands(prev => prev.map(x => x.band === band.band ? { ...x, ...res } : x));
      setMsg({ ok: true, text: `${band.band} band saved` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setSaving(null);
  }

  const totalWeight = factors.filter(f => f.active !== false).reduce((s, f) => s + (parseFloat(f.weight) || 0), 0);

  const section = { border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel2)', padding: '14px 16px', marginBottom: 20 };
  const th = { ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)', letterSpacing: '0.05em' };
  const td = { padding: '8px 10px', fontSize: 11.5, verticalAlign: 'top' };
  const inp = { ...MONO, fontSize: 11, width: 56, padding: '3px 6px', background: 'var(--sunken)', border: '1px solid var(--edge)', borderRadius: 3, color: 'var(--ink)' };

  return (
    <div>
      {/* How the score is computed */}
      <div style={{ ...section, borderLeft: `3px solid ${TEAL}` }}>
        <div className="kicker" style={{ marginBottom: 6 }}>HOW THE THREAT SCORE WORKS</div>
        <div style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.7 }}>
          Each event's score (0–100) is <strong style={{ color: TEAL }}>Σ (factor value × factor weight) ÷ Σ active weights</strong>.
          Signals supply a 0–100 value per factor; the weights below decide how much each factor
          counts. Disabling a factor removes it from the score and the remaining weights are
          renormalised, so the scale stays 0–100. The score then maps to a band (L1–L4) below.
          Changes apply to <em>new and updated</em> events within ~60s.
        </div>
        {msg && <div style={{ ...MONO, fontSize: 11, marginTop: 8, color: msg.ok ? OK : CRIT }}>{msg.ok ? '✓' : '✗'} {msg.text}</div>}
      </div>

      {/* EDPS factors */}
      <div className="kicker" style={{ marginBottom: 8 }}>EDPS FACTORS · WEIGHTS · ENABLE/DISABLE</div>
      <div style={section}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--edge)' }}>
              <th style={th}>FACTOR</th>
              <th style={th}>HOW IT'S DERIVED</th>
              <th style={{ ...th, textAlign: 'right' }}>WEIGHT</th>
              <th style={{ ...th, textAlign: 'right' }}>SHARE</th>
              <th style={{ ...th, textAlign: 'center' }}>ON</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => {
              const on = f.active !== false;
              const w = parseFloat(f.weight) || 0;
              return (
                <tr key={f.key} style={{ borderBottom: '1px solid var(--hover)', opacity: on ? 1 : 0.5 }}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{f.label}</div>
                    <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>{f.key}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--mute)', fontSize: 11, lineHeight: 1.5, maxWidth: 420 }}>
                    {f.description || '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input
                      type="number" step="0.01" min="0" max="1"
                      defaultValue={w}
                      disabled={saving === f.key}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== w) saveFactor(f, { weight: v });
                      }}
                      style={{ ...inp, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right', ...MONO, color: TEAL, fontWeight: 700 }}>
                    {on && totalWeight > 0 ? `${Math.round((w / totalWeight) * 100)}%` : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button
                      onClick={() => saveFactor(f, { active: !on })}
                      disabled={saving === f.key}
                      style={{
                        ...MONO, fontSize: 9, padding: '3px 10px', cursor: 'pointer', borderRadius: 3, fontWeight: 700,
                        border: `1px solid ${on ? OK : 'var(--edge)'}`,
                        background: on ? OK + '15' : 'var(--panel2)',
                        color: on ? OK : 'var(--mute)',
                      }}
                    >
                      {on ? 'ON' : 'OFF'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ ...MONO, fontSize: 9.5, color: 'var(--faint)', marginTop: 8 }}>
          Active weight total: {totalWeight.toFixed(2)} — scores are renormalised by this value.
          Weight is 0–1; edit and click away to save.
        </div>
      </div>

      {/* Score bands */}
      <div className="kicker" style={{ marginBottom: 8 }}>SCORE BANDS (L1–L4)</div>
      <div style={section}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--edge)' }}>
              <th style={th}>BAND</th><th style={th}>ESCALATION</th>
              <th style={{ ...th, textAlign: 'right' }}>MIN</th>
              <th style={{ ...th, textAlign: 'right' }}>MAX</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.band} style={{ borderBottom: '1px solid var(--hover)' }}>
                <td style={td}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: b.color, marginRight: 8 }} />
                  <strong style={{ fontSize: 12 }}>{b.band}</strong>
                </td>
                <td style={{ ...td, ...MONO, color: 'var(--mute)' }}>{b.escalation}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <input type="number" min="0" max="100" defaultValue={b.min_score}
                    onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== b.min_score) saveBand(b, { min_score: v }); }}
                    style={{ ...inp, textAlign: 'right' }} />
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <input type="number" min="0" max="100" defaultValue={b.max_score}
                    onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== b.max_score) saveBand(b, { max_score: v }); }}
                    style={{ ...inp, textAlign: 'right' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Band values reference (read-only here; editable in Master Data) */}
      <div className="kicker" style={{ marginBottom: 8 }}>DERIVED-VALUE MAPPINGS (reference)</div>
      <div style={{ ...section, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {Object.entries(bandValues).map(([type, vals]) => (
          <div key={type} style={{ minWidth: 180 }}>
            <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: TEAL, marginBottom: 6, textTransform: 'uppercase' }}>{type}</div>
            {vals.map(v => (
              <div key={v.band} style={{ display: 'flex', justifyContent: 'space-between', ...MONO, fontSize: 10.5, color: 'var(--mute)', padding: '2px 0', borderBottom: '1px dashed var(--hover)' }}>
                <span>{v.band}</span><span style={{ color: 'var(--ink2)' }}>{v.numeric_value}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ ...MONO, fontSize: 9.5, color: 'var(--faint)', flexBasis: '100%' }}>
          These map qualitative assessments (e.g. "high likelihood") to 0–100 factor values before weighting.
          Edit them in Master Data → Band Values.
        </div>
      </div>
    </div>
  );
}
