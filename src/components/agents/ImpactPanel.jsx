// ImpactPanel.jsx — Per-airport and per-airline exposure for a selected event

import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { MONO, scoreColor, CRIT, HIGH, MOD, LOW, TEAL } from '../../theme.js';
import InfoIcon from './InfoIcon.jsx';
import { HELP } from './sourceMode.jsx';

const EXPOSURE_COLORS = {
  Critical: CRIT,
  High: HIGH,
  Moderate: MOD,
  Low: LOW,
};

export default function ImpactPanel({ eventId }) {
  const [event, setEvent] = useState(null);
  const [ops, setOps] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    async function load() {
      try {
        const evData = await api.getEvent(eventId);
        setEvent(evData);
        const opsData = await api.getOPS(eventId);
        setOps(opsData.ops);
      } catch (e) {
        setEvent(null);
        setOps(null);
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  async function handleRecompute() {
    if (!eventId) return;
    setLoading(true);
    try {
      await api.recomputeOPS(eventId);
      const opsData = await api.getOPS(eventId);
      setOps(opsData.ops);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  if (!eventId) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>
        Select an event to view impact assessment
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>Loading...</div>;
  }

  if (!event || !ops) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 11 }}>
        No data available for event "{eventId}"
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
      {/* Event header */}
      <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="kicker" style={{ margin: 0 }}>IMPACT ASSESSMENT</span>
            <InfoIcon title={HELP.impactPanel.title} sections={HELP.impactPanel.sections} placement="left" />
          </div>
          <button
            onClick={handleRecompute}
            style={{
              ...MONO, fontSize: 9, padding: '3px 8px', cursor: 'pointer',
              border: '1px solid var(--edge)', background: 'var(--panel2)', color: TEAL, borderRadius: 3,
            }}
          >
            RECOMPUTE
          </button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{event.name}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: scoreColor(event.score) }}>EDPS {event.score}</span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>{event.cat}</span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)' }}>·</span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>TTI {event.tti}</span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--faint)' }}>·</span>
          <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>{event.traj}</span>
        </div>
      </div>

      {/* Airport exposure */}
      <div style={{ marginBottom: 14 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>AIRPORT EXPOSURE · {ops.airports?.length || 0}</div>
        {ops.airports?.map((a) => {
          const expColor = scoreColor(a.exposure || a.impactScore || 0);
          return (
            <div key={a.iata} style={{ border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4, padding: '8px 10px', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...MONO, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{a.iata}</span>
                  <span style={{ fontSize: 11, color: 'var(--mute)' }}>{a.name}</span>
                </div>
                <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: expColor }}>{a.exposure}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', ...MONO, fontSize: 9.5, color: 'var(--mute)' }}>
                <span>movements: {a.movements}</span>
                {(a.arrivals != null) && <span>arr: {a.arrivals}</span>}
                {(a.departures != null) && <span>dep: {a.departures}</span>}
                {(a.airlineCount != null) && <span>airlines: {a.airlineCount}</span>}
                <span>window: {a.window}</span>
              </div>
              <div style={{ height: 3, background: 'var(--track)', marginTop: 5, borderRadius: 2 }}>
                <div style={{ height: 3, width: `${a.exposure}%`, background: expColor, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Airline exposure */}
      <div style={{ marginBottom: 14 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>AIRLINE EXPOSURE · {ops.airlines?.length || 0}</div>
        {ops.airlines?.map((a) => {
          const expColor = EXPOSURE_COLORS[a.exposure] || LOW;
          const score = a.exposureScore || 0;
          return (
            <div key={a.code} style={{ border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4, padding: '8px 10px', marginBottom: 5, borderLeft: `3px solid ${expColor}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: expColor }}>{a.code}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600 }}>{a.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...MONO, fontSize: 12, fontWeight: 700, color: expColor }}>{a.exposure}</span>
                  <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>({score})</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, ...MONO, fontSize: 9.5, color: 'var(--mute)', marginBottom: 4 }}>
                <span>hub: {a.hub}</span>
                <span>share: {a.netShare}%</span>
                <span>daily: {a.daily}</span>
                <span>airports: {a.airports}</span>
              </div>
              {a.drivers && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {Object.entries(a.drivers).map(([key, val]) => (
                    <span key={key} style={{ ...MONO, fontSize: 8.5, padding: '1px 5px', border: '1px solid var(--edge)', borderRadius: 2, color: 'var(--faint)' }}>
                      {key.replace('Factor', '')}: {val}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--mute)', lineHeight: 1.4 }}>{a.note}</div>
              <div style={{ height: 3, background: 'var(--track)', marginTop: 5, borderRadius: 2 }}>
                <div style={{ height: 3, width: `${score}%`, background: expColor, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overflight exposure */}
      {ops.overflightExposure && ops.overflightExposure.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="kicker" style={{ marginBottom: 8, color: HIGH }}>OVERFLIGHT EXPOSURE · {ops.overflightExposure.length} ROUTES</div>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {ops.overflightExposure.slice(0, 20).map((o, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--hover)' }}>
                <span style={{ ...MONO, fontSize: 10, fontWeight: 600, color: 'var(--ink2)' }}>{o.code}</span>
                <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>{o.route}</span>
                <span style={{ fontSize: 9.5, color: 'var(--faint)', marginLeft: 'auto', textAlign: 'right', maxWidth: 200 }}>{o.impact}</span>
              </div>
            ))}
            {ops.overflightExposure.length > 20 && (
              <div style={{ ...MONO, fontSize: 9, color: 'var(--mute)', padding: '4px 0', textAlign: 'center' }}>
                + {ops.overflightExposure.length - 20} more routes...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
