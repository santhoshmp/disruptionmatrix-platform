import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DM from '../data/dm-data.json';
import { MONO, TEAL, scoreColor, trajColor, trajArrow } from '../theme.js';

const SAMPLE_QUESTIONS = [
  'Is there any disruption expected in Mumbai in the next 48 hours?',
  'What threats are currently impacting Bengaluru?',
  'Are there any weather disruptions in Europe right now?',
  'Which threats have the highest disruption score?',
  'Is Delhi airport affected by fog?',
  'Are there any ATC or airspace issues today?',
  'What is the status of Vienna airport?',
  'Show me all escalating threats'
];

function matchEvents(query) {
  const q = query.toLowerCase();
  const matches = [];

  for (const e of DM.EVENTS) {
    const name = (e.name || '').toLowerCase();
    const where = (e.where || '').toLowerCase();
    const cat = (e.cat || '').toLowerCase();
    const summary = (e.summary || '').toLowerCase();
    const id = (e.id || '').toLowerCase();

    const keywords = q.match(/[a-z]+/g) || [];
    let score = 0;

    for (const kw of keywords) {
      if (kw.length < 3) continue;
      if (name.includes(kw)) score += 3;
      if (where.includes(kw)) score += 4;
      if (cat.includes(kw)) score += 2;
      if (summary.includes(kw)) score += 1;
      if (id.includes(kw)) score += 2;
    }

    const airportMap = {
      'mumbai': 'bom', 'bom': 'bom',
      'bengaluru': 'blr', 'bangalore': 'blr', 'blr': 'blr',
      'delhi': 'del', 'del': 'del',
      'chennai': 'maa', 'maa': 'maa',
      'vienna': 'vie', 'vie': 'vie',
      'frankfurt': 'fra', 'fra': 'fra',
      'munich': 'muc', 'muc': 'muc',
      'zurich': 'zrh', 'zrh': 'zrh',
      'amsterdam': 'ams', 'ams': 'ams',
      'dubai': 'dxb', 'dxb': 'dxb',
      'kochi': 'cok', 'cok': 'cok',
      'london': 'lhr', 'heathrow': 'lhr', 'lhr': 'lhr'
    };

    for (const [city, code] of Object.entries(airportMap)) {
      if (q.includes(city) && (where.includes(code) || where.includes(city) || summary.includes(code))) {
        score += 5;
      }
    }

    if (q.includes('weather') && cat.includes('weather')) score += 3;
    if (q.includes('atc') && cat.includes('atc')) score += 4;
    if (q.includes('airspace') && cat.includes('airspace')) score += 4;
    if (q.includes('fog') && (name.includes('fog') || summary.includes('fog'))) score += 5;
    if (q.includes('monsoon') && (name.includes('monsoon') || summary.includes('monsoon'))) score += 5;
    if (q.includes('snow') && (name.includes('snow') || summary.includes('snow'))) score += 5;
    if (q.includes('strike') && (cat.includes('industrial') || name.includes('strike') || name.includes('go-slow'))) score += 4;
    if (q.includes('escalating') && e.traj === 'Escalating') score += 4;
    if (q.includes('highest') || q.includes('top') || q.includes('worst')) score += (100 - e.score) > 60 ? 0 : 3;
    if (q.includes('europe') && (where.includes('frankfurt') || where.includes('vienna') || where.includes('munich') || where.includes('zurich') || where.includes('amsterdam'))) score += 4;
    if (q.includes('india') && (where.includes('delhi') || where.includes('bengaluru') || where.includes('mumbai') || where.includes('chennai') || where.includes('kochi'))) score += 3;

    if (score > 0) matches.push({ event: e, score });
  }

  matches.sort((a, b) => b.score - a.score || b.event.score - a.event.score);

  if (q.includes('highest') || q.includes('top') || q.includes('worst') || q.includes('all')) {
    return DM.EVENTS.slice().sort((a, b) => b.score - a.score);
  }

  return matches.map(m => m.event).slice(0, 5);
}

function generateResponse(query) {
  const q = query.toLowerCase();
  const events = matchEvents(query);

  if (q.includes('48 hour') || q.includes('48h') || q.includes('next 48') || q.includes('coming days') || q.includes('next few days')) {
    const relevant = events.filter(e => {
      const tti = e.tti || '';
      return tti.includes('h') && parseInt(tti) <= 48 || tti.includes('d') || tti === '2d' || tti.includes('1d');
    });
    const list = (relevant.length > 0 ? relevant : events).slice(0, 4);

    if (list.length === 0) {
      return { type: 'text', content: 'Based on current threat intelligence, no disruptions are forecast within the next 48 hours for the queried area. All active threats are being monitored.' };
    }

    return {
      type: 'events',
      intro: `Based on current threat intelligence, here are the disruptions expected within the next 48 hours:`,
      events: list
    };
  }

  if (events.length === 0) {
    return {
      type: 'text',
      content: 'I could not find any active threats matching your query. Try asking about a specific airport (e.g., Mumbai, Delhi, Vienna), a category (weather, ATC, industrial action), or ask "Show me all escalating threats".'
    };
  }

  if (q.includes('highest') || q.includes('top') || q.includes('worst')) {
    return {
      type: 'events',
      intro: `Here are the highest-scoring active threats on the platform right now, ranked by External Disruption Potential Score:`,
      events: events.slice(0, 5)
    };
  }

  if (q.includes('escalating')) {
    return {
      type: 'events',
      intro: `The following threats are currently on an escalating trajectory — conditions are worsening:`,
      events: events.filter(e => e.traj === 'Escalating')
    };
  }

  return {
    type: 'events',
    intro: `I found ${events.length} active threat${events.length > 1 ? 's' : ''} matching your query:`,
    events
  };
}

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
          background: 'var(--panel)', border: '1px solid var(--line2)',
          borderRadius: '4px 12px 12px 12px', color: 'var(--ink)'
        }}>
          {msg.content && <div style={{ marginBottom: msg.events ? 12 : 0 }}>{msg.content}</div>}
          {msg.events && msg.events.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {msg.events.map((e) => {
                const c = scoreColor(e.score);
                return (
                  <Link key={e.id} to={`/event/${e.id}`} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                    border: '1px solid var(--line2)', background: 'var(--sunken)',
                    borderLeft: `3px solid ${c}`, textDecoration: 'none', color: 'var(--ink)',
                    cursor: 'pointer', borderRadius: 4
                  }}>
                    <div style={{
                      ...MONO, fontWeight: 700, fontSize: 14, color: c, flexShrink: 0,
                      border: `1px solid ${c}`, background: c + '1A', padding: '3px 7px', textAlign: 'center', borderRadius: 3
                    }}>{e.score}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--mute2)', lineHeight: 1.4, marginBottom: 4 }}>{e.summary}</div>
                      <div style={{ ...MONO, fontSize: 10.5, color: 'var(--mute)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ color: trajColor(e.traj) }}>{trajArrow(e.traj)} {e.traj}</span>
                        <span>TTI: {e.tti}</span>
                        <span>{e.cat}</span>
                        <span style={{ color: c }}>L{e.esc}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendQuestion = (question) => {
    if (!question.trim()) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setTyping(true);

    setTimeout(() => {
      const response = generateResponse(question);
      setTyping(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.type === 'text' ? response.content : response.intro,
        events: response.type === 'events' ? response.events : undefined
      }]);
    }, 600 + Math.random() * 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuestion(input);
  };

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
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px' }}>Disruption Assistant</div>
            <div style={{ ...MONO, fontSize: 11, color: 'var(--mute)', letterSpacing: '0.08em' }}>
              AI-POWERED THREAT QUERY · {DM.EVENTS.length} ACTIVE EVENTS
            </div>
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
              Query the threat intelligence platform in natural language. Ask about specific airports, weather conditions, ATC issues, or request a summary of escalating threats.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520, margin: '0 auto' }}>
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
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

        {typing && (
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
            placeholder="Ask about disruptions, threats, or airport conditions..."
            style={{
              width: '100%', padding: '12px 16px 12px 40px', fontSize: 14,
              border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--ink)',
              ...MONO, outline: 'none', borderRadius: 8, boxSizing: 'border-box',
              transition: 'border-color 0.15s'
            }}
            onFocus={(e) => { e.target.style.borderColor = TEAL; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--edge)'; }}
          />
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <button type="submit" disabled={!input.trim()} style={{
          width: 44, height: 44, flexShrink: 0, cursor: input.trim() ? 'pointer' : 'default',
          border: `1px solid ${input.trim() ? TEAL : 'var(--edge)'}`,
          background: input.trim() ? TEAL + '1F' : 'var(--panel2)',
          color: input.trim() ? TEAL : 'var(--faint)',
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
