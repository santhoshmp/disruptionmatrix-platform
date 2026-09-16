// Chat.jsx — RAG-powered conversation agent
// Calls POST /api/chat with the user question + conversation history.
// Shows retrieved source citations and LLM/deterministic mode indicator.

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { MONO, TEAL, CRIT, HIGH, scoreColor } from '../theme.js';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [ragStats, setRagStats] = useState(null);
  const [llmEnabled, setLlmEnabled] = useState(null);
  const scrollRef = useRef(null);

  // Load suggestions + RAG stats on mount
  useEffect(() => {
    api.chatSuggest().then((res) => setSuggestions(res.suggestions || [])).catch(() => {});
    api.chatStats().then((res) => setRagStats(res)).catch(() => {});
    api.health().then((h) => setLlmEnabled(h.llmEnabled)).catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendQuestion = async (question) => {
    if (!question.trim() || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build conversation history for the API
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const result = await api.chat(question, history);

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: result.answer,
        sources: result.sources || [],
        documents: result.documents || 0,
        llmEnabled: result.llmEnabled,
        provider: result.provider,
        model: result.model,
      }]);

      // Update LLM status
      if (result.llmEnabled !== undefined) setLlmEnabled(result.llmEnabled);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}. Make sure the backend is running and the RAG index is built.`,
        sources: [],
        error: true,
      }]);
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion(input);
  };

  const defaultSuggestions = [
    'What are the most critical threats right now?',
    'What weather disruptions are active?',
    'Are there any ATC or airspace restrictions?',
    'What agents are currently monitoring?',
    'Summarize the current threat landscape',
  ];

  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', maxWidth: 820, width: '100%', margin: '0 auto', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ padding: '20px 0 16px', borderBottom: '1px solid var(--line2)', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}08)`,
            border: `1.5px solid ${TEAL}55`,
            display: 'grid', placeItems: 'center'
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px' }}>Disruption Assistant</div>
            <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', letterSpacing: '0.08em' }}>
              RAG-POWERED · {ragStats ? `${ragStats.total} DOCUMENTS INDEXED` : 'LOADING INDEX...'}
            </div>
          </div>
          {/* LLM status badge */}
          <div style={{
            ...MONO, fontSize: 9, padding: '3px 8px', borderRadius: 3, fontWeight: 700,
            border: `1px solid ${llmEnabled ? '#34D399' : 'var(--edge)'}`,
            color: llmEnabled ? '#34D399' : 'var(--mute)',
            background: llmEnabled ? 'rgba(52, 211, 153, 0.08)' : 'transparent',
          }}>
            {llmEnabled ? '● LLM ENABLED' : '○ DETERMINISTIC'}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, margin: '0 auto 20px',
              background: `linear-gradient(135deg, ${TEAL}18, ${TEAL}06)`,
              border: `1.5px solid ${TEAL}44`,
              display: 'grid', placeItems: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Ask about active disruptions</div>
            <div style={{ fontSize: 13, color: 'var(--mute2)', lineHeight: 1.5, maxWidth: 440, margin: '0 auto 28px' }}>
              The assistant uses RAG (Retrieval-Augmented Generation) to search the platform's knowledge base —
              events, signals, impact assessments, airports, airlines, schedules, and reference data.
              {!llmEnabled && ' LLM is disabled, so answers will be deterministic summaries of retrieved documents.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520, margin: '0 auto' }}>
              {displaySuggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuestion(q)}
                  style={{
                    padding: '12px 16px', fontSize: 13.5, textAlign: 'left', cursor: 'pointer',
                    border: '1px solid var(--line2)', background: 'var(--panel)', color: 'var(--ink2)',
                    borderRadius: 8, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 10
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEAL + '55'; e.currentTarget.style.background = TEAL + '08'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line2)'; e.currentTarget.style.background = 'var(--panel)'; }}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}08)`,
              border: `1.5px solid ${TEAL}55`,
              display: 'grid', placeItems: 'center'
            }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                <path d="M8 12a4 4 0 108 0 4 4 0 00-8 0z" />
              </svg>
            </div>
            <div style={{
              padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--line2)',
              borderRadius: '4px 12px 12px 12px', display: 'flex', gap: 4, alignItems: 'center'
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--mute)',
                  animation: `dm-chat-dot 1.2s ${i * 0.2}s infinite ease-in-out`
                }} />
              ))}
              <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)', marginLeft: 6 }}>searching knowledge base...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} style={{
        flex: '0 0 auto', padding: '16px 0 20px', borderTop: '1px solid var(--line2)',
        display: 'flex', gap: 10, alignItems: 'flex-end'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about disruptions, threats, airports, airlines..."
            disabled={loading}
            style={{
              width: '100%', padding: '12px 16px 12px 40px', fontSize: 14,
              border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--ink)',
              ...MONO, outline: 'none', borderRadius: 8, boxSizing: 'border-box',
              transition: 'border-color 0.15s', opacity: loading ? 0.5 : 1,
            }}
            onFocus={(e) => { if (!loading) e.target.style.borderColor = TEAL; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--edge)'; }}
          />
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <button type="submit" disabled={!input.trim() || loading} style={{
          width: 44, height: 44, flexShrink: 0, cursor: input.trim() && !loading ? 'pointer' : 'default',
          border: `1px solid ${input.trim() && !loading ? TEAL : 'var(--edge)'}`,
          background: input.trim() && !loading ? TEAL + '1F' : 'var(--panel2)',
          color: input.trim() && !loading ? TEAL : 'var(--faint)',
          borderRadius: 8, display: 'grid', placeItems: 'center', transition: 'all 0.15s'
        }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{
          maxWidth: '75%', padding: '12px 16px', fontSize: 14, lineHeight: 1.5,
          background: TEAL + '18', border: `1px solid ${TEAL}33`, color: 'var(--ink)',
          borderRadius: '12px 12px 4px 12px'
        }}>
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}08)`,
        border: `1.5px solid ${TEAL}55`,
        display: 'grid', placeItems: 'center'
      }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
          <path d="M8 12a4 4 0 108 0 4 4 0 00-8 0z" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          padding: '12px 16px', fontSize: 14, lineHeight: 1.55,
          background: msg.error ? 'rgba(239, 68, 68, 0.06)' : 'var(--panel)',
          border: `1px solid ${msg.error ? CRIT + '44' : 'var(--line2)'}`,
          borderRadius: '4px 12px 12px 12px', color: msg.error ? CRIT : 'var(--ink)'
        }}>
          {/* Answer text */}
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

          {/* Source citations */}
          {msg.sources && msg.sources.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--hover)' }}>
              <div style={{ ...MONO, fontSize: 9, color: 'var(--faint)', marginBottom: 6 }}>
                SOURCES ({msg.sources.length} · {msg.documents || msg.sources.length} documents retrieved)
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {msg.sources.slice(0, 8).map((src, i) => {
                  const isEvent = src.type === 'event';
                  const isOps = src.type === 'ops';
                  const color = isEvent ? '#34D399' : isOps ? TEAL : 'var(--mute)';
                  return (
                    <Link
                      key={i}
                      to={isEvent || isOps ? `/event/${src.id}` : '#'}
                      style={{
                        ...MONO, fontSize: 9, padding: '2px 7px', borderRadius: 2,
                        border: `1px solid ${color}44`, color, textDecoration: 'none',
                        background: color + '08',
                      }}
                    >
                      {src.type}: {src.id.length > 20 ? src.id.slice(0, 18) + '…' : src.id}
                    </Link>
                  );
                })}
                {msg.sources.length > 8 && (
                  <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)', padding: '2px 4px' }}>
                    +{msg.sources.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Provider badge */}
          {msg.provider && (
            <div style={{ marginTop: 8, ...MONO, fontSize: 9, color: 'var(--faint)' }}>
              via {msg.provider} · {msg.model}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
