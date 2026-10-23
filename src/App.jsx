import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import ThreatBoard from './pages/ThreatBoard.jsx';
import ThreatOverview from './pages/ThreatOverview.jsx';
import ThreatProfiling from './pages/ThreatProfiling.jsx';
import EventDetail from './pages/EventDetail.jsx';
import WorldMap from './pages/WorldMap.jsx';
import Radar from './pages/Radar.jsx';
import AirlineMap from './pages/AirlineMap.jsx';
import DataExplorer from './pages/DataExplorer.jsx';
import Chat from './pages/Chat.jsx';
import AgentDashboard from './pages/AgentDashboard.jsx';
import RegionSettings from './pages/RegionSettings.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import MasterData from './pages/MasterData.jsx';
import Sources from './pages/Sources.jsx';
import Documentation from './pages/Documentation.jsx';
import Archive from './pages/Archive.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import DM from './data/dm-data.json';
import { AIRLINES } from './airlines.js';
import { isAuthenticated, logout } from './auth.js';
import { MONO, TEAL, CYAN, scoreColor, trajColor, trajArrow } from './theme.js';

// ── Shared UI atoms ──────────────────────────────────────────────────

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
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        {p(now.getUTCHours())}:{p(now.getUTCMinutes())}:{p(now.getUTCSeconds())}
      </div>
      <div style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.1em' }}>UTC</div>
    </div>
  );
}

function MatrixLogo({ size = 28 }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid ${TEAL}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', padding: 3, gap: 2, flexShrink: 0 }}>
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

// ── Navigation items ─────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )},
  { to: '/board', label: 'Threat Board', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )},
  { to: '/profiling', label: 'Threat Profiling', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )},
  { to: '/map', label: 'World Map', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  )},
  { to: '/archive', label: 'Archive', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" rx="1" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )},
  { to: '/chat', label: 'AI Assistant', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )},
  { to: '/agents', label: 'Agent Engine', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )},
  { to: '/regions', label: 'Regions', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )},
  { to: '/sources', label: 'Sources', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 17l6-6-6-6" />
      <path d="M12 19h8" />
    </svg>
  )},
  { to: '/admin', label: 'Admin', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )},
  { to: '/master-data', label: 'Master Data', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0018 0V5" />
      <path d="M3 12a9 3 0 0018 0" />
    </svg>
  )},
  { to: '/guide', label: 'How It Works', icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  )},
];

// ── Collapsible icon rail sidebar ────────────────────────────────────

function Sidebar({ expanded, setExpanded }) {
  const loc = useLocation();

  return (
    <div style={{
      width: expanded ? 200 : 52,
      flexShrink: 0,
      background: 'var(--sunken)',
      borderRight: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.15s ease',
      overflow: 'hidden',
    }}>
      {/* Logo / collapse toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: expanded ? '14px 16px' : '14px 10px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: expanded ? 10 : 0,
          justifyContent: expanded ? 'flex-start' : 'center',
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
        title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <MatrixLogo size={expanded ? 24 : 24} />
        {expanded && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>DisruptionMatrix</div>
            <div style={{ ...MONO, fontSize: 8.5, color: 'var(--faint)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>THREAT INTEL</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = loc.pathname === item.to || loc.pathname.startsWith(item.to + '/');
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              style={{
                display: 'flex', alignItems: 'center', gap: expanded ? 10 : 0,
                padding: expanded ? '9px 16px' : '9px 0',
                justifyContent: expanded ? 'flex-start' : 'center',
                color: isActive ? TEAL : 'var(--ink3)',
                background: isActive ? TEAL + '12' : 'transparent',
                borderLeft: expanded ? `2px solid ${isActive ? TEAL : 'transparent'}` : 'none',
                borderRight: !expanded ? `2px solid ${isActive ? TEAL : 'transparent'}` : 'none',
                fontSize: 13, fontWeight: isActive ? 600 : 500,
                whiteSpace: 'nowrap', transition: 'all 0.12s ease',
                textDecoration: 'none',
              }}
            >
              {item.icon}
              {expanded && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* Home link */}
      <div style={{ padding: '4px 0', borderTop: '1px solid var(--line)' }}>
        <NavLink
          to="/"
          title="Home"
          style={{
            display: 'flex', alignItems: 'center', gap: expanded ? 10 : 0,
            padding: expanded ? '9px 16px' : '9px 0',
            justifyContent: expanded ? 'flex-start' : 'center',
            color: 'var(--faint)', fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap', textDecoration: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {expanded && <span>Home</span>}
        </NavLink>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────

function TopBar({ theme, onToggleTheme }) {
  const loc = useLocation();

  // Derive page title from route
  const pageTitle = (() => {
    if (loc.pathname.startsWith('/event/')) return 'Event Detail';
    const item = NAV_ITEMS.find(n => loc.pathname === n.to || loc.pathname.startsWith(n.to + '/'));
    return item?.label || 'DisruptionMatrix';
  })();

  return (
    <div style={{
      flex: '0 0 auto', height: 48,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', borderBottom: '1px solid var(--line)', background: 'var(--panel)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{pageTitle}</div>
      <div id="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 14 }} />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <GlobalSearch />
        <ThemeBtn theme={theme} onToggle={onToggleTheme} />
        <LogoutBtn />
        <Clock />
      </div>
    </div>
  );
}

// ── Layouts ──────────────────────────────────────────────────────────

const GLOBAL_ROUTES = ['/overview', '/board', '/map', '/event', '/chat', '/agents', '/regions', '/admin', '/master-data'];
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
    </div>
  );
}

function GlobalLayout({ theme, onToggleTheme, children }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return localStorage.getItem('dm-sidebar-expanded') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('dm-sidebar-expanded', String(sidebarExpanded));
  }, [sidebarExpanded]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar theme={theme} onToggleTheme={onToggleTheme} />
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
      <Route path="/overview" element={<ThreatOverview />} />
      <Route path="/board" element={<ThreatBoard />} />
      <Route path="/profiling" element={<ThreatProfiling />} />
      <Route path="/event/:id" element={<EventDetail />} />
      <Route path="/map" element={<WorldMap />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/agents" element={<AgentDashboard />} />
      <Route path="/regions" element={<RegionSettings />} />
      <Route path="/sources" element={<Sources />} />
      <Route path="/admin" element={<AdminSettings />} />
      <Route path="/master-data" element={<MasterData />} />
      <Route path="/guide" element={<Documentation />} />
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
