// MasterData.jsx — Admin UI for viewing and managing all master data tables.
// Standalone page with sidebar section selector + data table with inline CRUD.

import { useState, useEffect, useCallback } from 'react';
import { MONO, TEAL, CRIT, HIGH, OK } from '../theme.js';
import { api } from '../api/client.js';

// ── Section definitions ─────────────────────────────────────────────
const SECTIONS = [
  { id: 'airports', label: 'Airports', icon: 'AP', apiList: 'getAirports', apiUpsert: 'upsertAirport', apiDelete: 'deleteAirport', pk: 'iata' },
  { id: 'airlines', label: 'Airlines', icon: 'AL', apiList: 'getAirlines', apiUpsert: 'upsertAirline', apiDelete: 'deleteAirline', pk: 'iata' },
  { id: 'regions', label: 'Regions', icon: 'RG', apiList: 'getMasterRegions', apiUpsert: 'upsertRegion', apiDelete: 'deleteRegion', pk: 'id' },
  { id: 'sub_regions', label: 'Sub-Regions', icon: 'SR', apiList: 'getSubRegions', apiUpsert: 'upsertSubRegion', apiDelete: 'deleteSubRegion', pk: 'id', responseKey: 'subRegions' },
  { id: 'categories', label: 'Categories', icon: 'CT', apiList: 'getCategories', apiUpsert: 'upsertCategory', apiDelete: 'deleteCategory', pk: 'id' },
  { id: 'agent_types', label: 'Agent Types', icon: 'AT', apiList: 'getMasterAgentTypes', apiUpsert: 'upsertAgentType', apiDelete: 'deleteAgentType', pk: 'type', responseKey: 'agentTypes' },
  { id: 'hazard_types', label: 'Hazard Types', icon: 'HZ', apiList: 'getHazardTypes', apiUpsert: 'upsertHazardType', apiDelete: 'deleteHazardType', pk: 'hazard_type', responseKey: 'hazardTypes' },
  { id: 'hazard_keywords', label: 'Hazard Keywords', icon: 'HK', apiList: 'getHazardKeywords', apiUpsert: 'upsertHazardKeyword', apiDelete: 'deleteHazardKeyword', pk: 'id', responseKey: 'keywords' },
  { id: 'domains', label: 'Domains', icon: 'DM', apiList: 'getDomains', apiUpsert: 'upsertDomain', apiDelete: 'deleteDomain', pk: 'id' },
  { id: 'domain_profiles', label: 'Domain Profiles', icon: 'DP', apiList: 'getDomainProfiles', apiUpsert: 'upsertDomainProfile', apiDelete: 'deleteDomainProfile', pk: 'id', responseKey: 'profiles' },
  { id: 'scoring_bands', label: 'Scoring Bands', icon: 'SB', apiList: 'getScoringBands', apiUpsert: 'upsertScoringBand', apiDelete: 'deleteScoringBand', pk: 'id', responseKey: 'bands' },
  { id: 'edps_factors', label: 'EDPS Factors', icon: 'EF', apiList: 'getEdpsFactors', apiUpsert: 'upsertEdpsFactor', apiDelete: 'deleteEdpsFactor', pk: 'id', responseKey: 'factors' },
  { id: 'band_values', label: 'Band Values', icon: 'BV', apiList: 'getBandValues', apiUpsert: 'upsertBandValue', apiDelete: 'deleteBandValue', pk: 'id', responseKey: 'values' },
  { id: 'wmo_codes', label: 'WMO Codes', icon: 'WM', apiList: 'getWmoCodes', apiUpsert: 'upsertWmoCode', apiDelete: 'deleteWmoCode', pk: 'wmo_code', responseKey: 'codes' },
  { id: 'llm_providers', label: 'LLM Providers', icon: 'LL', apiList: 'getLlmProviders', apiUpsert: 'upsertLlmProvider', apiDelete: 'deleteLlmProvider', pk: 'key', responseKey: 'providers' },
  { id: 'connectors', label: 'Connectors', icon: 'CN', apiList: 'getConnectors', apiUpsert: 'upsertConnectorConfig', apiDelete: 'deleteConnectorConfig', pk: 'id', responseKey: 'connectors' },
  { id: 'gdelt_queries', label: 'GDELT Queries', icon: 'GQ', apiList: 'getGdeltQueries', apiUpsert: 'upsertGdeltQuery', apiDelete: 'deleteGdeltQuery', pk: 'id', responseKey: 'queries' },
  { id: 'subreddits', label: 'Subreddits', icon: 'RE', apiList: 'getSubreddits', apiUpsert: 'upsertSubreddit', apiDelete: 'deleteSubreddit', pk: 'id', responseKey: 'subreddits' },
  { id: 'flight_routes', label: 'Flight Routes', icon: 'FR', apiList: 'getFlightRoutes', apiUpsert: 'upsertFlightRoute', apiDelete: 'deleteFlightRoute', pk: 'id', responseKey: 'routes' },
  { id: 'mock_scenarios', label: 'Mock Scenarios', icon: 'MS', apiList: 'getMockScenarios', apiUpsert: 'upsertMockScenario', apiDelete: 'deleteMockScenario', pk: 'id', responseKey: 'scenarios' },
];

// ── Column definitions per section ─────────────────────────────────
const COLUMNS = {
  airports: [
    { key: 'iata', label: 'IATA', type: 'text', width: 60 },
    { key: 'icao', label: 'ICAO', type: 'text', width: 60 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'city', label: 'City', type: 'text', width: 120 },
    { key: 'country', label: 'Country', type: 'text', width: 120 },
    { key: 'region_id', label: 'Region', type: 'text', width: 60 },
    { key: 'lat', label: 'Lat', type: 'number', width: 80 },
    { key: 'lon', label: 'Lon', type: 'number', width: 80 },
    { key: 'daily_movements', label: 'Movements', type: 'number', width: 80 },
    { key: 'cat3_capable', label: 'CAT3', type: 'bool', width: 50 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  airlines: [
    { key: 'iata', label: 'IATA', type: 'text', width: 60 },
    { key: 'icao', label: 'ICAO', type: 'text', width: 60 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'country', label: 'Country', type: 'text', width: 120 },
    { key: 'hub_primary', label: 'Hub', type: 'text', width: 60 },
    { key: 'cat3_capable', label: 'CAT3', type: 'bool', width: 50 },
    { key: 'narrowbody_type', label: 'Narrowbody', type: 'text', width: 100 },
    { key: 'widebody_type', label: 'Widebody', type: 'text', width: 100 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  regions: [
    { key: 'id', label: 'ID', type: 'text', width: 60 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  sub_regions: [
    { key: 'id', label: 'ID', type: 'text', width: 120 },
    { key: 'region_id', label: 'Region', type: 'text', width: 60 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  categories: [
    { key: 'id', label: 'ID', type: 'text', width: 100 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'sop_key', label: 'SOP Key', type: 'text', width: 100 },
    { key: 'color', label: 'Color', type: 'text', width: 80 },
    { key: 'icon', label: 'Icon', type: 'text', width: 60 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  agent_types: [
    { key: 'type', label: 'Type', type: 'text', width: 100 },
    { key: 'category_id', label: 'Category', type: 'text', width: 100 },
    { key: 'label', label: 'Label', type: 'text', flex: 1 },
    { key: 'icon', label: 'Icon', type: 'text', width: 60 },
    { key: 'color', label: 'Color', type: 'text', width: 80 },
    { key: 'poll_interval_min', label: 'Poll (min)', type: 'number', width: 80 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  hazard_types: [
    { key: 'hazard_type', label: 'Hazard Type', type: 'text', width: 140 },
    { key: 'family', label: 'Family', type: 'text', width: 120 },
    { key: 'requires_cat3', label: 'CAT3', type: 'bool', width: 50 },
    { key: 'default_severity', label: 'Severity', type: 'text', width: 80 },
    { key: 'default_sev_val', label: 'Sev Val', type: 'number', width: 70 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  hazard_keywords: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'hazard_type', label: 'Hazard Type', type: 'text', width: 140 },
    { key: 'keyword', label: 'Keyword', type: 'text', flex: 1 },
  ],
  domains: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
  ],
  domain_profiles: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'category_id', label: 'Category', type: 'text', width: 100 },
    { key: 'domain_name', label: 'Domain', type: 'text', flex: 1 },
    { key: 'weight', label: 'Weight', type: 'number', width: 80 },
  ],
  scoring_bands: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'min_score', label: 'Min', type: 'number', width: 60 },
    { key: 'max_score', label: 'Max', type: 'number', width: 60 },
    { key: 'band', label: 'Band', type: 'text', width: 100 },
    { key: 'color', label: 'Color', type: 'text', width: 80 },
    { key: 'escalation', label: 'Escalation', type: 'text', width: 80 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
  ],
  edps_factors: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'label', label: 'Label', type: 'text', flex: 1 },
    { key: 'key', label: 'Key', type: 'text', width: 140 },
    { key: 'weight', label: 'Weight', type: 'number', width: 80 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
  ],
  band_values: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'band_type', label: 'Band Type', type: 'text', width: 100 },
    { key: 'band', label: 'Band', type: 'text', width: 100 },
    { key: 'numeric_value', label: 'Value', type: 'number', width: 80 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
  ],
  wmo_codes: [
    { key: 'wmo_code', label: 'WMO Code', type: 'number', width: 100 },
    { key: 'hazard_type', label: 'Hazard Type', type: 'text', flex: 1 },
  ],
  llm_providers: [
    { key: 'key', label: 'Key', type: 'text', width: 100 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'default_model', label: 'Default Model', type: 'text', width: 160 },
    { key: 'color', label: 'Color', type: 'text', width: 80 },
    { key: 'key_required', label: 'Key Req', type: 'bool', width: 60 },
    { key: 'needs_base', label: 'Base', type: 'bool', width: 50 },
    { key: 'is_custom', label: 'Custom', type: 'bool', width: 50 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  connectors: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'connector', label: 'Connector', type: 'text', width: 120 },
    { key: 'config_key', label: 'Key', type: 'text', width: 160 },
    { key: 'config_value', label: 'Value', type: 'text', flex: 1 },
    { key: 'config_type', label: 'Type', type: 'text', width: 70 },
  ],
  gdelt_queries: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'category', label: 'Category', type: 'text', width: 120 },
    { key: 'query_text', label: 'Query', type: 'text', flex: 1 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  subreddits: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
    { key: 'sort_order', label: 'Sort', type: 'number', width: 60 },
  ],
  flight_routes: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'origin', label: 'Origin', type: 'text', width: 70 },
    { key: 'dest', label: 'Dest', type: 'text', width: 70 },
    { key: 'route_type', label: 'Type', type: 'text', width: 100 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
  mock_scenarios: [
    { key: 'id', label: 'ID', type: 'number', width: 50 },
    { key: 'agent_type', label: 'Agent', type: 'text', width: 90 },
    { key: 'region', label: 'Region', type: 'text', width: 60 },
    { key: 'name', label: 'Name', type: 'text', flex: 1 },
    { key: 'hazard_type', label: 'Hazard', type: 'text', width: 120 },
    { key: 'active', label: 'Active', type: 'bool', width: 50 },
  ],
};

// ── Main component ──────────────────────────────────────────────────
export default function MasterData() {
  const [activeSection, setActiveSection] = useState('airports');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingRow, setEditingRow] = useState(null); // row being edited (or 'new' for new row)
  const [editForm, setEditForm] = useState({});
  const [summary, setSummary] = useState(null);

  const section = SECTIONS.find(s => s.id === activeSection);
  const columns = COLUMNS[activeSection] || [];

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api[section.apiList]();
      const key = section.responseKey || section.id;
      setData(response[key] || []);
    } catch (e) {
      setError(e.message);
      setData([]);
    }
    setLoading(false);
  }, [section]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await api.getMasterSummary();
      setSummary(s);
    } catch (e) {
      // silent
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleSave = async () => {
    try {
      await api[section.apiUpsert](editForm);
      setEditingRow(null);
      setEditForm({});
      loadData();
      loadSummary();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (row) => {
    const pk = section.pk;
    const pkValue = row[pk];
    if (!confirm(`Delete ${section.label.slice(0, -1)} "${pkValue}"?`)) return;
    try {
      await api[section.apiDelete](pkValue);
      loadData();
      loadSummary();
    } catch (e) {
      setError(e.message);
    }
  };

  const startEdit = (row) => {
    setEditingRow(row[section.pk]);
    setEditForm({ ...row });
  };

  const startNew = () => {
    setEditingRow('new');
    const blank = {};
    columns.forEach(c => {
      if (c.type === 'bool') blank[c.key] = false;
      else if (c.type === 'number') blank[c.key] = 0;
      else blank[c.key] = '';
    });
    setEditForm(blank);
  };

  const filteredData = data.filter(row => {
    if (!search) return true;
    return Object.values(row).some(v => String(v || '').toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Sidebar */}
      <div style={{
        width: 200,
        minWidth: 200,
        borderRight: '1px solid var(--line)',
        background: 'var(--sunken)',
        overflowY: 'auto',
        padding: '12px 0',
      }}>
        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--line)' }}>
          <div className="kicker" style={{ color: TEAL, ...MONO, fontSize: 10 }}>MASTER DATA</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>Reference Tables</div>
          {summary && (
            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4, ...MONO }}>
              {Object.keys(summary).length} tables
            </div>
          )}
        </div>
        {SECTIONS.map(s => {
          const count = summary ? summary[`ref_${s.id === 'sub_regions' ? 'sub_regions' : s.id}`] : null;
          return (
            <button
              key={s.id}
              onClick={() => { setActiveSection(s.id); setSearch(''); setEditingRow(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                background: activeSection === s.id ? 'var(--hover)' : 'transparent',
                color: activeSection === s.id ? 'var(--ink)' : 'var(--mute)',
                fontSize: 12, textAlign: 'left', fontFamily: 'inherit',
                borderLeft: activeSection === s.id ? `2px solid ${TEAL}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (activeSection !== s.id) e.currentTarget.style.background = 'var(--hover2)'; }}
              onMouseLeave={(e) => { if (activeSection !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)', width: 22 }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              {count !== null && (
                <span style={{ ...MONO, fontSize: 9, color: 'var(--faint)' }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          background: 'var(--panel)',
        }}>
          <div>
            <div className="kicker" style={{ color: TEAL, ...MONO, fontSize: 10 }}>{section.icon} · TABLE</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{section.label}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '6px 10px', fontSize: 12, background: 'var(--sunken)',
                border: '1px solid var(--line)', borderRadius: 3, color: 'var(--ink)',
                width: 200, fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => { editingRow === 'new' ? setEditingRow(null) : startNew(); }}
              style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: editingRow === 'new' ? 'var(--hover)' : TEAL,
                color: editingRow === 'new' ? 'var(--mute)' : '#0a0e14',
                border: 'none', borderRadius: 3, fontFamily: 'inherit',
              }}
            >
              {editingRow === 'new' ? 'Cancel' : '+ Add New'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '8px 20px', background: `${CRIT}15`, borderBottom: `1px solid ${CRIT}40` }}>
            <span style={{ color: CRIT, fontSize: 12, ...MONO }}>⚠ {error}</span>
            <button onClick={() => setError(null)} style={{ float: 'right', border: 'none', background: 'none', color: CRIT, cursor: 'pointer', fontSize: 12 }}>×</button>
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--mute)', fontSize: 12, ...MONO }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, ...MONO }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {columns.map(c => (
                    <th key={c.key} style={{
                      padding: '8px 6px', textAlign: 'left', color: 'var(--faint)',
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
                      whiteSpace: 'nowrap', width: c.width, ...(c.flex ? { width: 'auto' } : {}),
                    }}>
                      {c.label}
                    </th>
                  ))}
                  <th style={{ padding: '8px 6px', width: 60, textAlign: 'right' }}>·</th>
                </tr>
              </thead>
              <tbody>
                {/* New row form */}
                {editingRow === 'new' && (
                  <tr style={{ background: `${TEAL}10`, borderBottom: '1px solid var(--line)' }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: '4px 6px' }}>
                        <CellEditor col={c} value={editForm[c.key]} onChange={(v) => setEditForm({ ...editForm, [c.key]: v })} />
                      </td>
                    ))}
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                      <button onClick={handleSave} style={{ border: 'none', background: TEAL, color: '#0a0e14', padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Save</button>
                    </td>
                  </tr>
                )}
                {/* Data rows */}
                {filteredData.map((row, idx) => (
                  <tr key={row[section.pk] || idx} style={{ borderBottom: '1px solid var(--line2)', ...(idx % 2 ? { background: 'var(--sunken)' } : {}) }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: '6px' }}>
                        {editingRow === row[section.pk] ? (
                          <CellEditor col={c} value={editForm[c.key]} onChange={(v) => setEditForm({ ...editForm, [c.key]: v })} />
                        ) : (
                          <CellDisplay col={c} value={row[c.key]} />
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {editingRow === row[section.pk] ? (
                        <>
                          <button onClick={handleSave} style={{ border: 'none', background: TEAL, color: '#0a0e14', padding: '3px 6px', borderRadius: 2, cursor: 'pointer', fontSize: 10, fontWeight: 600, marginRight: 4 }}>Save</button>
                          <button onClick={() => { setEditingRow(null); setEditForm({}); }} style={{ border: 'none', background: 'var(--hover)', color: 'var(--mute)', padding: '3px 6px', borderRadius: 2, cursor: 'pointer', fontSize: 10 }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)} style={{ border: 'none', background: 'none', color: 'var(--mute)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }} title="Edit">✎</button>
                          <button onClick={() => handleDelete(row)} style={{ border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }} title="Delete" onMouseEnter={(e) => e.currentTarget.style.color = CRIT} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--faint)'}>×</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && editingRow !== 'new' && (
                  <tr>
                    <td colSpan={columns.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--faint)', fontSize: 12 }}>
                      {search ? 'No matches found.' : 'No data. Click "+ Add New" to create.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {/* Footer */}
          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--faint)', ...MONO }}>
            {filteredData.length} of {data.length} rows{search ? ' (filtered)' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cell display ─────────────────────────────────────────────────────
function CellDisplay({ col, value }) {
  if (col.type === 'bool') {
    return (
      <span style={{
        display: 'inline-block', width: 16, height: 16, lineHeight: '16px', textAlign: 'center',
        borderRadius: 2, fontSize: 9, fontWeight: 700,
        background: value ? `${OK}30` : 'var(--hover)',
        color: value ? OK : 'var(--faint)',
      }}>
        {value ? '✓' : '·'}
      </span>
    );
  }
  if (col.type === 'number') {
    return <span style={{ color: 'var(--mute)', textAlign: 'right', display: 'block' }}>{value ?? ''}</span>;
  }
  // Color swatch
  if (col.key === 'color' && value && value.startsWith('#')) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: value, border: '1px solid var(--line)' }} />
        <span style={{ fontSize: 10, color: 'var(--mute)' }}>{value}</span>
      </span>
    );
  }
  return <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 300 }}>{value ?? ''}</span>;
}

// ── Cell editor ──────────────────────────────────────────────────────
function CellEditor({ col, value, onChange }) {
  const baseStyle = {
    width: '100%', padding: '3px 6px', fontSize: 11, background: 'var(--panel)',
    border: '1px solid var(--line2)', borderRadius: 2, color: 'var(--ink)',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  if (col.type === 'bool') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: 'pointer' }}
      />
    );
  }
  if (col.type === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        style={baseStyle}
      />
    );
  }
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={baseStyle}
    />
  );
}
