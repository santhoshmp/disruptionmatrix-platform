// RegionSettings.jsx — Region configuration screen
// Toggle monitoring on/off per region, view airports/airlines/airspace per region.

import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { MONO, TEAL, CRIT, HIGH, MOD, LOW, scoreColor } from '../theme.js';
import InfoIcon from '../components/agents/InfoIcon.jsx';

const PRIORITY_COLORS = {
  critical: CRIT,
  high: HIGH,
  medium: MOD,
  low: LOW,
  standard: LOW,
};

const RISK_COLORS = {
  'Level 1 - No Fly': CRIT,
  'Level 2 - Permitted with Precautions': HIGH,
  'Level 3 - Caution': MOD,
  'Unknown': LOW,
};

export default function RegionSettings() {
  const [regions, setRegions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [profile, setProfile] = useState(null);
  const [airspace, setAirspace] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingAirspace, setLoadingAirspace] = useState(false);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    async function loadRegions() {
      try {
        const data = await api.getRegions();
        setRegions(data.regions || []);
        if (data.regions?.length > 0 && !selectedRegion) {
          setSelectedRegion(data.regions[0].id);
        }
      } catch (e) { /* server down */ }
    }
    loadRegions();
  }, []);

  useEffect(() => {
    if (!selectedRegion) return;
    setLoadingProfile(true);
    setProfile(null);
    async function loadProfile() {
      try {
        const res = await fetch(`http://localhost:3001/api/regions/${selectedRegion}/profile`);
        const data = await res.json();
        setProfile(data);
      } catch (e) { /* ignore */ }
      setLoadingProfile(false);
    }
    loadProfile();
  }, [selectedRegion]);

  async function handleToggle(regionId, enabled) {
    setToggling(regionId);
    try {
      const res = await fetch(`http://localhost:3001/api/regions/${regionId}/enabled`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      setRegions((prev) => prev.map((r) => r.id === regionId ? { ...r, enabled: data.enabled } : r));
    } catch (e) { /* ignore */ }
    setToggling(null);
  }

  async function loadAirspace() {
    if (!selectedRegion) return;
    setLoadingAirspace(true);
    setAirspace(null);
    try {
      const res = await fetch(`http://localhost:3001/api/regions/${selectedRegion}/airspace`);
      const data = await res.json();
      setAirspace(data);
    } catch (e) { /* ignore */ }
    setLoadingAirspace(false);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        flex: '0 0 auto', borderBottom: '1px solid var(--line)', background: 'var(--panel)',
        padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Region Settings</div>
          <div style={{ ...MONO, fontSize: 10, color: 'var(--mute)', letterSpacing: '0.05em' }}>
            MONITORING TOGGLES · AIRPORT & AIRLINE DATA · AIRSPACE RISK
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <InfoIcon
            title="Region Settings"
            sections={[
              { body: 'Configure which regions the agent fleet monitors. Toggle monitoring on/off per region. When disabled, all agents in that region are paused and will stop polling.' },
              {
                title: 'Airport & Airline Data',
                body: 'Real airport and airline data per region from public sources:',
                list: [
                  'Airports: OurAirports (ourairports.com/data) — public domain CSV with IATA/ICAO codes, coordinates, and scheduled service flags.',
                  'Airlines: OpenFlights (openflights.org/data) — open license database with IATA/ICAO codes, names, and active status.',
                ],
              },
              {
                title: 'Airspace Risk',
                body: 'Airspace risk assessments are fetched from safeairspace.net, the Conflict Zone & Risk Database maintained by OPSGROUP. It provides country-level risk levels (Level 1 No Fly, Level 2 Permitted with Precautions, Level 3 Caution) with summaries and NOTAM references.',
              },
            ]}
            placement="left"
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: '0 0 360px', borderRight: '1px solid var(--line)', background: 'var(--panel)', overflow: 'auto' }}>
          <div style={{ padding: '10px 14px 6px' }}>
            <span className="kicker">REGIONS · {regions.length}</span>
          </div>
          <div style={{ padding: '0 14px 10px' }}>
            {regions.map((r) => {
              const prioColor = PRIORITY_COLORS[r.priority] || LOW;
              const isSelected = selectedRegion === r.id;
              const isToggling = toggling === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRegion(r.id)}
                  style={{
                    border: `1px solid ${isSelected ? TEAL : 'var(--edge)'}`,
                    background: isSelected ? TEAL + '10' : 'var(--panel2)',
                    borderRadius: 4, padding: '10px 12px', marginBottom: 6, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{r.id}</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</span>
                    </div>
                    <span style={{ ...MONO, fontSize: 9, color: prioColor, textTransform: 'uppercase', fontWeight: 600 }}>{r.priority}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ ...MONO, fontSize: 9.5, color: 'var(--mute)' }}>
                      {r.subRegions?.length || 0} sub-regions
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(r.id, r.enabled); }}
                      disabled={isToggling}
                      style={{
                        ...MONO, fontSize: 9.5, padding: '4px 10px', cursor: isToggling ? 'wait' : 'pointer',
                        border: `1px solid ${r.enabled ? '#34D399' : 'var(--edge)'}`,
                        background: r.enabled ? '#34D39915' : 'var(--panel)',
                        color: r.enabled ? '#34D399' : 'var(--mute)',
                        borderRadius: 3, fontWeight: 600,
                      }}
                    >
                      {isToggling ? '...' : r.enabled ? '● MONITORING' : '○ PAUSED'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '14px 22px' }}>
          {loadingProfile && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', ...MONO, fontSize: 12 }}>
              Loading region profile...
            </div>
          )}

          {!loadingProfile && profile && (
            <>
              <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ ...MONO, fontSize: 14, fontWeight: 700, color: TEAL }}>{profile.regionId}</span>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{profile.regionName}</span>
                  <span style={{
                    ...MONO, fontSize: 9, padding: '2px 8px', borderRadius: 2,
                    border: `1px solid ${profile.enabled ? '#34D399' : 'var(--edge)'}`,
                    color: profile.enabled ? '#34D399' : 'var(--mute)', fontWeight: 600,
                  }}>
                    {profile.enabled ? 'MONITORING' : 'PAUSED'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, ...MONO, fontSize: 10, color: 'var(--mute)' }}>
                  <span>Priority: <span style={{ color: PRIORITY_COLORS[profile.priority] || LOW, fontWeight: 600 }}>{profile.priority}</span></span>
                  <span>Countries: {profile.countries?.length || 0}</span>
                  <span>Airports: {profile.airports?.length || 0}</span>
                  <span>Airlines: {profile.airlines?.length || 0}</span>
                  <span>Sub-regions: {profile.subRegions?.length || 0}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16, padding: '10px 12px', border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4 }}>
                <div className="kicker" style={{ marginBottom: 6 }}>DATA SOURCES</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#34D399' }}>REAL</span>
                    <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>{profile.dataSource?.airports}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#34D399' }}>REAL</span>
                    <span style={{ ...MONO, fontSize: 10, color: 'var(--mute)' }}>{profile.dataSource?.airlines}</span>
                  </div>
                </div>
              </div>

              {profile.countries?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="kicker" style={{ marginBottom: 8 }}>COUNTRIES · {profile.countries.length}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {profile.countries.map((c) => (
                      <span key={c} style={{
                        ...MONO, fontSize: 10, padding: '4px 10px', border: '1px solid var(--edge)',
                        borderRadius: 3, background: 'var(--panel2)', color: 'var(--ink2)',
                      }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.airports?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="kicker" style={{ marginBottom: 8 }}>AIRPORTS · {profile.airports.length}</div>
                  <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--sunken)', borderBottom: '1px solid var(--line)' }}>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>IATA</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>ICAO</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>NAME</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>CITY</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>COUNTRY</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>COORDS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.airports.map((a, i) => (
                          <tr key={a.iata} style={{ borderBottom: i < profile.airports.length - 1 ? '1px solid var(--hover)' : 'none' }}>
                            <td style={{ ...MONO, fontSize: 11, fontWeight: 700, padding: '6px 10px', color: TEAL }}>{a.iata}</td>
                            <td style={{ ...MONO, fontSize: 10, padding: '6px 10px', color: 'var(--mute)' }}>{a.icao}</td>
                            <td style={{ fontSize: 11, padding: '6px 10px' }}>{a.name}</td>
                            <td style={{ fontSize: 11, padding: '6px 10px', color: 'var(--mute)' }}>{a.city}</td>
                            <td style={{ fontSize: 11, padding: '6px 10px', color: 'var(--mute)' }}>{a.country}</td>
                            <td style={{ ...MONO, fontSize: 9.5, padding: '6px 10px', textAlign: 'right', color: 'var(--faint)' }}>
                              {a.lat.toFixed(1)}, {a.lon.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {profile.airlines?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="kicker" style={{ marginBottom: 8 }}>AIRLINES · {profile.airlines.length}</div>
                  <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'var(--sunken)', borderBottom: '1px solid var(--line)' }}>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>IATA</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>ICAO</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>NAME</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>COUNTRY</th>
                          <th style={{ ...MONO, fontSize: 9, padding: '6px 10px', textAlign: 'left', color: 'var(--faint)' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.airlines.map((a, i) => (
                          <tr key={a.iata} style={{ borderBottom: i < profile.airlines.length - 1 ? '1px solid var(--hover)' : 'none' }}>
                            <td style={{ ...MONO, fontSize: 11, fontWeight: 700, padding: '6px 10px', color: TEAL }}>{a.iata}</td>
                            <td style={{ ...MONO, fontSize: 10, padding: '6px 10px', color: 'var(--mute)' }}>{a.icao}</td>
                            <td style={{ fontSize: 11, padding: '6px 10px' }}>{a.name}</td>
                            <td style={{ fontSize: 11, padding: '6px 10px', color: 'var(--mute)' }}>{a.country}</td>
                            <td style={{ padding: '6px 10px' }}>
                              <span style={{
                                ...MONO, fontSize: 9, padding: '1px 6px', borderRadius: 2,
                                border: `1px solid ${a.active ? '#34D399' : 'var(--edge)'}`,
                                color: a.active ? '#34D399' : 'var(--mute)', fontWeight: 600,
                              }}>{a.active ? 'ACTIVE' : 'INACTIVE'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="kicker" style={{ margin: 0 }}>AIRSPACE RISK · safeairspace.net</span>
                  <button
                    onClick={loadAirspace}
                    disabled={loadingAirspace}
                    style={{
                      ...MONO, fontSize: 10, padding: '4px 10px', cursor: loadingAirspace ? 'wait' : 'pointer',
                      border: '1px solid var(--edge)', background: 'var(--panel2)', color: loadingAirspace ? 'var(--mute)' : TEAL,
                      borderRadius: 3,
                    }}
                  >
                    {loadingAirspace ? 'FETCHING...' : 'CHECK AIRSPACE'}
                  </button>
                </div>
                {airspace && (
                  <div style={{ border: '1px solid var(--edge)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', background: 'var(--sunken)', borderBottom: '1px solid var(--line)', ...MONO, fontSize: 10, color: 'var(--mute)' }}>
                      Source: {airspace.source} · {airspace.countries?.length || 0} countries checked
                    </div>
                    {airspace.countries?.map((c, i) => {
                      const riskColor = RISK_COLORS[c.riskLevel] || LOW;
                      return (
                        <div key={i} style={{ padding: '10px 12px', borderBottom: i < airspace.countries.length - 1 ? '1px solid var(--hover)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{c.country}</span>
                            <span style={{
                              ...MONO, fontSize: 10, padding: '2px 8px', borderRadius: 2,
                              border: `1px solid ${riskColor}`, color: riskColor, fontWeight: 600,
                            }}>{c.riskLevel}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--mute)', lineHeight: 1.4 }}>{c.summary}</div>
                          {c.warnings?.length > 0 && (
                            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {c.warnings.map((w, j) => (
                                <span key={j} style={{ ...MONO, fontSize: 9, padding: '1px 5px', border: '1px solid var(--edge)', borderRadius: 2, color: 'var(--faint)' }}>{w}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!airspace && !loadingAirspace && (
                  <div style={{ padding: 12, border: '1px solid var(--edge)', borderRadius: 4, background: 'var(--panel2)', ...MONO, fontSize: 11, color: 'var(--mute)' }}>
                    Click "CHECK AIRSPACE" to fetch live airspace risk data from safeairspace.net
                  </div>
                )}
              </div>

              {profile.subRegions?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="kicker" style={{ marginBottom: 8 }}>SUB-REGIONS · {profile.subRegions.length}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {profile.subRegions.map((s) => (
                      <div key={s.id} style={{
                        border: '1px solid var(--edge)', background: 'var(--panel2)', borderRadius: 4,
                        padding: '6px 10px', minWidth: 160,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</div>
                        <div style={{ ...MONO, fontSize: 9, color: 'var(--mute)', marginTop: 2 }}>
                          {s.airports?.length || 0} airports · {s.airspace?.length || 0} FIRs
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
