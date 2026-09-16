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
    defaultModel: 'gemini-1.5-pro',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
    keyPrefix: 'AIza',
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
          <div style={{ fontSize: 13, color: 'var(--faint)' }}>LLM provider configuration</div>
        </div>
        {error && (
          <div style={{ color: CRIT, fontSize: 12, ...MONO }}>{error}</div>
        )}
      </div>

      <div style={{ padding: '20px 26px', maxWidth: 920 }}>
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

        {/* Info section */}
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
