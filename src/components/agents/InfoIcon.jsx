// InfoIcon.jsx — Reusable "i" info icon with popover help panel
// Click the icon to open a help document explaining the module.

import { useState, useRef, useEffect } from 'react';
import { MONO, TEAL } from '../../theme.js';

export default function InfoIcon({ title, sections, placement = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const popoverStyle = {
    position: 'absolute',
    zIndex: 10000,
    background: 'var(--panel)',
    border: '1px solid var(--line2)',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    padding: '14px 16px',
    width: 360,
    maxHeight: 400,
    overflow: 'auto',
    [placement === 'left' ? 'right' : 'left']: '100%',
    top: 0,
    marginLeft: placement === 'right' ? 8 : 0,
    marginRight: placement === 'left' ? 8 : 0,
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={`About ${title}`}
        style={{
          width: 16, height: 16, borderRadius: '50%',
          border: `1px solid ${open ? TEAL : 'var(--edge)'}`,
          background: open ? TEAL + '20' : 'transparent',
          color: open ? TEAL : 'var(--mute)',
          cursor: 'pointer', display: 'grid', placeItems: 'center',
          fontSize: 10, fontWeight: 700, lineHeight: 1, padding: 0,
          fontFamily: 'serif',
        }}
      >
        i
      </button>
      {open && (
        <div style={popoverStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--ink)' }}>{title}</div>
          {sections.map((section, i) => (
            <div key={i} style={{ marginBottom: section.title ? 10 : 0 }}>
              {section.title && (
                <div style={{ ...MONO, fontSize: 9.5, fontWeight: 600, color: TEAL, letterSpacing: '0.05em', marginBottom: 4, textTransform: 'uppercase' }}>
                  {section.title}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>{section.body}</div>
              {section.list && (
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11, color: 'var(--ink3)', lineHeight: 1.5 }}>
                  {section.list.map((item, j) => (
                    <li key={j} style={{ marginBottom: 2 }}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
