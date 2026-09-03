import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import ThreatBoard from './pages/ThreatBoard.jsx';
import EventDetail from './pages/EventDetail.jsx';
import WorldMap from './pages/WorldMap.jsx';
import Radar from './pages/Radar.jsx';
import AirlineMap from './pages/AirlineMap.jsx';
import DataExplorer from './pages/DataExplorer.jsx';
import Chat from './pages/Chat.jsx';
import DM from './data/dm-data.json';
import { AIRLINES } from './airlines.js';
import { isAuthenticated, logout } from './auth.js';
import { MONO, TEAL, CYAN, scoreColor, trajColor, trajArrow } from './theme.js';

function ThemeBtn({ theme, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title="Switch theme"
      style={{
        display: 'grid', placeItems: 'center', width: 32, height: 32, cursor: 'pointer',
        border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--mute)'
      }}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = (n) => String(n).padStart(2, '0');
  return (
    <div style={{ textAlign: 'right', ...MONO }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>
        {p(now.getUTCHours())}:{p(now.getUTCMinutes())}:{p(now.getUTCSeconds())}
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.1em' }}>UTC · LIVE PROTOTYPE</div>
    </div>
  );
}

function MatrixLogo({ size = 30 }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid ${TEAL}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', padding: 4, gap: 3 }}>
      <div style={{ background: TEAL }} />
      <div style={{ background: 'var(--edge)' }} />
      <div style={{ background: 'var(--edge)' }} />
      <div style={{ background: '#F59E2B' }} />
    </div>
  );
}

function LogoutBtn() {
  const nav = useNavigate();
  return (
    <button
      onClick={() => { logout(); nav('/login'); }}
      title="Sign out"
      style={{
        display: 'grid', placeItems: 'center', width: 32, height: 32, cursor: 'pointer',
        border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--mute)'
      }}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}

const GLOBAL_ROUTES = ['/board', '/map', '/event', '/chat'];
const NAMMA_ROUTES = ['/radar', '/airline-map', '/explorer'];

function airlineFromPath(pathname) {
  if (pathname.startsWith('/eva')) return AIRLINES.eva;
  if (pathname.startsWith('/ica')) return AIRLINES.ica;
  return AIRLINES.namma;
}

function HomeLayout({ theme, onToggleTheme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px',
        borderBottom: '1px solid var(--line)', background: 'var(--panel)'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--ink)', cursor: 'pointer' }}>
          <MatrixLogo size={26} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px' }}>DisruptionMatrix</div>
            <div style={{ ...MONO, fontSize: 10, color: 'var(--faint)', letterSpacing: '0.1em' }}>THREAT INTELLIGENCE PLATFORM</div>
          </div>
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
          <LogoutBtn />
        </div>
      </div>

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Home />
      </main>

      <div style={{
        flex: '0 0 auto', padding: '10px 28px', borderTop: '1px solid var(--line)',
        background: 'var(--sunken)', ...MONO, fontSize: 10.5, color: 'var(--faint)'
      }}>
        Synthetic data · proof-of-concept build · advises, does not decide
      </div>
    </div>
  );
}

function GlobalLayout({ theme, onToggleTheme, children }) {
  const nav = useNavigate();
  const activeCount = DM.EVENTS.length;

  const topNavBtn = (isActive, accent) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 14px', fontSize: 13, fontWeight: 600,
    border: `1px solid ${isActive ? (accent || TEAL) : 'var(--line2)'}`,
    background: isActive ? (accent || TEAL) + '14' : 'transparent',
    color: isActive ? 'var(--ink)' : 'var(--ink3)', cursor: 'pointer',
    borderRadius: 4, whiteSpace: 'nowrap'
  });

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        width: 320, flex: '0 0 320px', background: 'var(--sunken)',
        borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0
      }}>
        <Link to="/" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)', cursor: 'pointer' }}>
          <MatrixLogo size={28} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px' }}>DisruptionMatrix</div>
            <div style={{ ...MONO, fontSize: 10, color: 'var(--faint)', letterSpacing: '0.1em' }}>EXTERNAL INTELLIGENCE</div>
          </div>
        </Link>

        <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...MONO, fontSize: 11, color: 'var(--ink2)', letterSpacing: '0.1em', fontWeight: 600 }}>ACTIVE THREATS</div>
          <div style={{ ...MONO, fontSize: 11, color: TEAL, fontWeight: 600 }}>{activeCount} live</div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {DM.EVENTS.map((e) => {
            const c = scoreColor(e.score);
            return (
              <div
                key={e.id}
                onClick={() => nav(`/event/${e.id}`)}
                className="hoverable"
                style={{
                  border: '1px solid var(--line2)', background: 'var(--panel)', padding: '12px 14px', cursor: 'pointer',
                  borderLeft: `3px solid ${c}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    ...MONO, fontWeight: 700, fontSize: 16, color: c,
                    border: `1px solid ${c}`, background: c + '1A', padding: '5px 8px', textAlign: 'center', borderRadius: 3
                  }}>{e.score}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{e.name}</div>
                    <div style={{ ...MONO, fontSize: 11, color: 'var(--mute2)', display: 'flex', gap: 8 }}>
                      <span style={{ color: trajColor(e.traj) }}>{trajArrow(e.traj)}</span>
                      <span>{e.tti}</span>
                      <span>L{e.esc}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...MONO, fontSize: 11.5, color: 'var(--mute)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sources polled</span><span style={{ color: 'var(--ink2)' }}>1,284</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Reports / 24h</span><span style={{ color: 'var(--ink2)' }}>9,417</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Contradictions</span><span style={{ color: '#F59E2B' }}>4</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--track)' }}>
            <div className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: '#31C48D' }} />
            <span style={{ ...MONO, fontSize: 11.5, color: 'var(--mute)' }}>Ingest live · EUR region</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: '0 0 auto', borderBottom: '1px solid var(--line)', background: 'var(--panel)',
          display: 'flex', alignItems: 'center', padding: '10px 22px', gap: 10, flexWrap: 'wrap'
        }}>
          <NavLink to="/board" style={({ isActive }) => topNavBtn(isActive)}>
            <span>Threat board</span>
            <span style={{ ...MONO, fontSize: 11, color: 'var(--faint)' }}>{activeCount}</span>
          </NavLink>
          <NavLink to="/map" style={({ isActive }) => topNavBtn(isActive)}>
            <span>World map</span>
          </NavLink>
          <NavLink to="/chat" style={({ isActive }) => topNavBtn(isActive)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span>AI Assistant</span>
          </NavLink>
          <span style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px' }} />
          <NavLink to="/" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', ...MONO, fontSize: 12,
            border: '1px solid var(--line2)', color: 'var(--faint)', cursor: 'pointer', borderRadius: 4
          }}>
            ← Home
          </NavLink>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeBtn theme={theme} onToggle={onToggleTheme} />
            <LogoutBtn />
            <Clock />
          </div>
        </div>
        <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function AirlineLayout({ theme, onToggleTheme, airline, children }) {
  const rp = airline.routePrefix;
  const linkBtn = {
    ...MONO, fontSize: 11, padding: '6px 11px',
    border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--mute)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        flex: '0 0 auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px 20px',
        padding: '12px 22px', background: 'var(--panel)', borderBottom: '1px solid var(--line)'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink)', cursor: 'pointer' }}>
          <div style={{
            width: 26, height: 26, border: `2px solid ${airline.accent}`, borderRadius: '50%',
            display: 'grid', placeItems: 'center', ...MONO, fontSize: 11, fontWeight: 700, color: airline.accent
          }}>{airline.code}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.2px' }}>{airline.name}</div>
            <div style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)', letterSpacing: '0.1em' }}>{airline.occLabel}</div>
          </div>
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 14px' }}>
          <NavLink to="/" style={linkBtn}>Home</NavLink>
          <NavLink to={`${rp}/airline-map`} style={linkBtn}>Network map</NavLink>
          <NavLink to={`${rp}/explorer`} style={linkBtn}>Data explorer</NavLink>
          <ThemeBtn theme={theme} onToggle={onToggleTheme} />
          <LogoutBtn />
          <Clock />
        </div>
      </div>

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('dm-app-theme') || 'dark');
  const loc = useLocation();
  const nav = useNavigate();
  const [authed, setAuthed] = useState(isAuthenticated());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dm-app-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated() && loc.pathname !== '/login') {
      nav('/login');
    }
    setAuthed(isAuthenticated());
  }, [loc.pathname, nav]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  if (!authed && loc.pathname !== '/login') {
    return null;
  }

  const isHome = loc.pathname === '/';
  const isGlobal = GLOBAL_ROUTES.some((r) => loc.pathname === r || loc.pathname.startsWith(r + '/') || (r === '/event' && loc.pathname.startsWith('/event/')));
  const isNamma = NAMMA_ROUTES.some((r) => loc.pathname === r);
  const isEva = loc.pathname.startsWith('/eva');
  const isIca = loc.pathname.startsWith('/ica');
  const isAirline = isNamma || isEva || isIca;
  const airline = airlineFromPath(loc.pathname);

  const routes = (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/board" element={<ThreatBoard />} />
      <Route path="/event/:id" element={<EventDetail />} />
      <Route path="/map" element={<WorldMap />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/radar" element={<Radar airline={AIRLINES.namma} />} />
      <Route path="/airline-map" element={<AirlineMap airline={AIRLINES.namma} />} />
      <Route path="/explorer" element={<DataExplorer airline={AIRLINES.namma} />} />
      <Route path="/eva/radar" element={<Radar airline={AIRLINES.eva} />} />
      <Route path="/eva/airline-map" element={<AirlineMap airline={AIRLINES.eva} />} />
      <Route path="/eva/explorer" element={<DataExplorer airline={AIRLINES.eva} />} />
      <Route path="/ica/radar" element={<Radar airline={AIRLINES.ica} />} />
      <Route path="/ica/airline-map" element={<AirlineMap airline={AIRLINES.ica} />} />
      <Route path="/ica/explorer" element={<DataExplorer airline={AIRLINES.ica} />} />
    </Routes>
  );

  if (loc.pathname === '/login') {
    return routes;
  }
  if (isHome) {
    return <HomeLayout theme={theme} onToggleTheme={toggleTheme}>{routes}</HomeLayout>;
  }
  if (isAirline) {
    return <AirlineLayout theme={theme} onToggleTheme={toggleTheme} airline={airline}>{routes}</AirlineLayout>;
  }
  return <GlobalLayout theme={theme} onToggleTheme={toggleTheme}>{routes}</GlobalLayout>;
}
