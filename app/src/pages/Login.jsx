import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../auth.js';
import { MONO, TEAL } from '../theme.js';

const FEATURES = [
  { icon: 'M3 12h3l3-9 6 18 3-9h3', label: 'Threat intelligence fusion' },
  { icon: 'M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z', label: 'Airline exposure modelling' },
  { icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', label: 'Real-time disruption scoring' }
];

export default function Login() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const nav = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(user, pass)) {
      nav('/');
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--sunken)' }}>
      {/* Left — hero image with overlay */}
      <div style={{
        flex: '1 1 55%', position: 'relative', overflow: 'hidden',
        borderRight: '1px solid var(--line2)'
      }}>
        <img src="/hero.png" alt="Aircraft on runway" style={{
          width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 65%', display: 'block'
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(160deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.75) 100%)'
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '44px 48px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 42, height: 42, border: `2px solid ${TEAL}`,
              display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', padding: 5, gap: 3
            }}>
              <div style={{ background: TEAL }} />
              <div style={{ background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ background: '#F59E2B' }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>DisruptionMatrix</div>
              <div style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em' }}>THREAT INTELLIGENCE PLATFORM</div>
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, maxWidth: 480, marginBottom: 12 }}>
            See the disruption<br />before it sees you.
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, maxWidth: 440, marginBottom: 28 }}>
            Correlated threat intelligence fused with airline exposure models — weather, ATC, geopolitical, infrastructure and regulatory events, scored and ranked.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map((f) => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  display: 'grid', placeItems: 'center'
                }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — login form with visual depth */}
      <div style={{
        flex: '1 1 45%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--panel)', position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative gradient accent */}
        <div style={{
          position: 'absolute', top: '-30%', right: '-20%', width: '70%', height: '70%',
          background: `radial-gradient(circle, ${TEAL}08 0%, transparent 70%)`,
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-15%', width: '60%', height: '60%',
          background: `radial-gradient(circle, ${TEAL}05 0%, transparent 70%)`,
          pointerEvents: 'none'
        }} />

        <div style={{ width: 360, padding: '0 8px', position: 'relative', zIndex: 1 }}>
          {/* Logo mark */}
          <div style={{
            width: 48, height: 48, border: `2px solid ${TEAL}`,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', padding: 6, gap: 3,
            marginBottom: 28
          }}>
            <div style={{ background: TEAL }} />
            <div style={{ background: 'var(--edge)' }} />
            <div style={{ background: 'var(--edge)' }} />
            <div style={{ background: '#F59E2B' }} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 8 }}>Sign in</div>
            <div style={{ fontSize: 13, color: 'var(--mute2)', lineHeight: 1.5 }}>
              Enter your credentials to access the platform.
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', ...MONO, fontSize: 11, color: 'var(--mute)', marginBottom: 7, letterSpacing: '0.08em' }}>USERNAME</label>
              <div style={{ position: 'relative' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  value={user} onChange={(e) => setUser(e.target.value)} autoFocus
                  placeholder="opsadmin"
                  style={{
                    width: '100%', padding: '12px 14px 12px 38px', fontSize: 14,
                    border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--ink)',
                    ...MONO, outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = TEAL; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--edge)'; }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', ...MONO, fontSize: 11, color: 'var(--mute)', marginBottom: 7, letterSpacing: '0.08em' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input
                  type="password" value={pass} onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '12px 14px 12px 38px', fontSize: 14,
                    border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--ink)',
                    ...MONO, outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = TEAL; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--edge)'; }}
                />
              </div>
            </div>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                ...MONO, fontSize: 12, color: '#EF4444', marginBottom: 16,
                padding: '10px 14px', border: '1px solid #EF444433', background: '#EF44440D'
              }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}
            <button type="submit" style={{
              width: '100%', padding: '13px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${TEAL}`, background: TEAL + '1F', color: 'var(--ink)',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
              onMouseEnter={(e) => { e.target.style.background = TEAL + '33'; e.target.style.borderColor = TEAL; }}
              onMouseLeave={(e) => { e.target.style.background = TEAL + '1F'; }}
            >
              Sign in
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>

          <div style={{
            marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--hover)',
            display: 'flex', alignItems: 'center', gap: 10,
            ...MONO, fontSize: 11, color: 'var(--faint)', lineHeight: 1.6
          }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Prototype credentials: <span style={{ color: 'var(--mute2)' }}>opsadmin / disrupt2026</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
