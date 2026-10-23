// FilterSelect.jsx — Compact labeled dropdown for filter toolbars.
// Custom popover menu styled to the app theme (native <select> popups
// render in OS style and clash with the dark UI).
// Options accept strings or { value, label } pairs.

import { useEffect, useRef, useState } from 'react';
import { MONO } from '../theme.js';

export default function FilterSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = opts.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label && <span className="kicker">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...MONO, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          color: open ? 'var(--cyan)' : 'var(--ink)',
          background: 'var(--panel)',
          border: `1px solid ${open ? 'var(--cyan)' : 'var(--line)'}`,
          borderRadius: 4, padding: '5px 10px', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}
      >
        {current?.label ?? value}
        <span style={{ fontSize: 8, color: 'var(--mute)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 3000,
          minWidth: '100%', maxHeight: 280, overflowY: 'auto',
          background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6,
          boxShadow: '0 10px 30px rgba(0,0,0,0.55)', padding: '4px 0',
        }}>
          {opts.map((o) => {
            const on = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = on ? 'rgba(76,194,206,0.08)' : 'transparent'; }}
                style={{
                  ...MONO, fontSize: 11, padding: '7px 12px', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  color: on ? 'var(--cyan)' : 'var(--ink3)',
                  background: on ? 'rgba(76,194,206,0.08)' : 'transparent',
                  borderLeft: `2px solid ${on ? 'var(--cyan)' : 'transparent'}`,
                }}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
