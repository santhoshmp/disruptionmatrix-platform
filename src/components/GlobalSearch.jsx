import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DM from '../data/dm-data.json';
import GEO from '../data/geo.json';
import { AIRLINES } from '../airlines.js';
import { MONO, TEAL, scoreColor, trajColor, trajArrow } from '../theme.js';

function buildSearchIndex() {
  const items = [];

  for (const e of DM.EVENTS) {
    items.push({
      type: 'Threat',
      id: e.id,
      title: e.name,
      subtitle: e.cat,
      detail: e.where,
      score: e.score,
      traj: e.traj,
      tti: e.tti,
      route: `/event/${e.id}`,
      searchText: `${e.id} ${e.name} ${e.cat} ${e.where} ${e.summary || ''}`.toLowerCase()
    });
  }

  for (const [code, info] of Object.entries(GEO.AIRPORTS || {})) {
    const station = (GEO.STATIONS || {})[code];
    const name = info.name || code;
    items.push({
      type: 'Airport',
      id: code,
      title: name,
      subtitle: code,
      detail: station ? station.role : 'Airport',
      route: `/map`,
      searchText: `${code} ${name} airport`.toLowerCase()
    });
  }

  for (const [code, info] of Object.entries(GEO.STATIONS || {})) {
    if (GEO.AIRPORTS && GEO.AIRPORTS[code]) continue;
    items.push({
      type: 'Station',
      id: code,
      title: info.name || code,
      subtitle: code,
      detail: info.role || '',
      route: `/map`,
      searchText: `${code} ${info.name || ''} ${info.role || ''} station`.toLowerCase()
    });
  }

  for (const a of Object.values(AIRLINES)) {
    items.push({
      type: 'Airline',
      id: a.key,
      title: a.name,
      subtitle: `${a.code} · ${a.icao}`,
      detail: `${a.hubName} hub · ${a.hubs.join(', ')}`,
      route: `${a.routePrefix}/radar`,
      searchText: `${a.name} ${a.code} ${a.icao} ${a.callsign} ${a.hubName} airline`.toLowerCase()
    });
  }

  for (const [airlineKey, airline] of Object.entries(AIRLINES)) {
    const flights = airline.data?.FLIGHTS || [];
    for (const f of flights) {
      items.push({
        type: 'Flight',
        id: f.flt,
        title: f.flt,
        subtitle: f.route,
        detail: `${airline.shortName} · ${f.type} · ${f.tail || ''}${f.threat ? ' · linked: ' + f.threat : ''}`,
        route: `${airline.routePrefix}/explorer`,
        searchText: `${f.flt} ${f.route} ${f.tail || ''} ${airline.name} flight`.toLowerCase()
      });
    }

    const fleet = airline.data?.FLEET || [];
    for (const ac of fleet) {
      items.push({
        type: 'Aircraft',
        id: ac.tail,
        title: ac.tail || ac.type,
        subtitle: ac.type,
        detail: `${airline.shortName} · ${ac.status || ''}${ac.base ? ' · ' + ac.base : ''}`,
        route: `${airline.routePrefix}/explorer`,
        searchText: `${ac.tail || ''} ${ac.type} ${ac.status || ''} ${airline.name} aircraft`.toLowerCase()
      });
    }
  }

  for (const [eventId, geo] of Object.entries(GEO.EVENT_GEO || {})) {
    const event = DM.EVENTS.find(e => e.id === eventId);
    if (event) continue;
    items.push({
      type: 'Event Geo',
      id: eventId,
      title: eventId,
      subtitle: 'Geographic event',
      detail: geo.label || '',
      route: `/map`,
      searchText: `${eventId} ${geo.label || ''} geo`.toLowerCase()
    });
  }

  return items;
}

const SEARCH_INDEX = buildSearchIndex();

const TYPE_ICONS = {
  Threat: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Airport: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  ),
  Airline: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
    </svg>
  ),
  Flight: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  ),
  Aircraft: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 10h4.5a1.5 1.5 0 010 3H16l-4 7H9l2-7H5l-2 3H1l1.5-5L1 6h2l2 3h7L9 2h3l4 8z" />
    </svg>
  ),
  Station: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  ),
  'Event Geo': (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
};

const TYPE_COLORS = {
  Threat: '#F5A623',
  Airport: TEAL,
  Airline: '#A78BFA',
  Flight: '#22D3EE',
  Aircraft: '#F59E2B',
  Station: '#5B92C9',
  'Event Geo': '#34D399'
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const nav = useNavigate();

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const scored = SEARCH_INDEX.map(item => {
      const text = item.searchText;
      let score = 0;
      if (text.includes(q)) score += 10;
      const words = q.split(/\s+/).filter(w => w.length >= 2);
      for (const w of words) {
        if (item.title.toLowerCase().includes(w)) score += 5;
        if (item.subtitle && item.subtitle.toLowerCase().includes(w)) score += 3;
        if (item.detail && item.detail.toLowerCase().includes(w)) score += 2;
        if (text.includes(w)) score += 1;
      }
      return { item, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
    return scored.map(r => r.item);
  }, [query]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKey = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[highlightIdx]) {
      e.preventDefault();
      const r = results[highlightIdx];
      setOpen(false);
      setQuery('');
      nav(r.route);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const selectResult = (r) => {
    setOpen(false);
    setQuery('');
    nav(r.route);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: 320, flexShrink: 0 }}>
      <div style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="Search threats, airports, airlines, flights…"
          style={{
            width: '100%', padding: '7px 12px 7px 32px', fontSize: 13,
            border: '1px solid var(--edge)', background: 'var(--panel2)', color: 'var(--ink)',
            ...MONO, outline: 'none', borderRadius: 4, boxSizing: 'border-box',
            transition: 'border-color 0.15s'
          }}
          onFocusCapture={(e) => { e.target.style.borderColor = TEAL; }}
          onBlurCapture={(e) => { e.target.style.borderColor = 'var(--edge)'; }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus(); }}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)',
              display: 'grid', placeItems: 'center', padding: 2
            }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
          border: '1px solid var(--edge)', background: 'var(--panel)',
          maxHeight: 420, overflow: 'auto', borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '16px 14px', fontSize: 13, color: 'var(--mute)', textAlign: 'center' }}>
              No results for "{query}"
            </div>
          ) : (
            <>
              <div style={{ ...MONO, fontSize: 10, color: 'var(--faint)', padding: '8px 12px 6px', letterSpacing: '0.1em' }}>
                {results.length} RESULT{results.length > 1 ? 'S' : ''}
              </div>
              {results.map((r, i) => {
                const tc = TYPE_COLORS[r.type] || TEAL;
                const isHl = i === highlightIdx;
                return (
                  <div
                    key={`${r.type}-${r.id}-${i}`}
                    onClick={() => selectResult(r)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                      cursor: 'pointer', borderTop: '1px solid var(--hover)',
                      background: isHl ? 'var(--hover)' : 'transparent',
                      borderLeft: `3px solid ${isHl ? tc : 'transparent'}`
                    }}
                  >
                    <div style={{ color: tc, marginTop: 2, flexShrink: 0 }}>
                      {TYPE_ICONS[r.type]}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                        <span style={{ ...MONO, fontSize: 9, color: tc, border: `1px solid ${tc}44`, padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{r.type.toUpperCase()}</span>
                      </div>
                      {r.subtitle && <div style={{ ...MONO, fontSize: 11, color: 'var(--mute2)', marginBottom: 2 }}>{r.subtitle}</div>}
                      {r.detail && <div style={{ fontSize: 11.5, color: 'var(--mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail}</div>}
                      {r.score !== undefined && (
                        <div style={{ ...MONO, fontSize: 10, color: 'var(--faint)', display: 'flex', gap: 8, marginTop: 3 }}>
                          <span style={{ color: scoreColor(r.score) }}>Score {r.score}</span>
                          {r.traj && <span style={{ color: trajColor(r.traj) }}>{trajArrow(r.traj)} {r.traj}</span>}
                          {r.tti && <span>TTI {r.tti}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
