// GET /api/regions              — list all regions with sub-regions + enabled flag
// GET /api/regions/:id          — single region detail with agents
// GET /api/regions/:id/profile  — region profile: airports + airlines + countries
// PUT /api/regions/:id/enabled  — toggle region monitoring on/off
// GET /api/regions/:id/airspace — airspace risk from safeairspace.net

import { Router } from 'express';
import store from '../store/event-store.js';
import airportAirlineData from '../data/airport-airline-data.js';
import { getAirspaceRisks } from '../connectors/safeairspace.js';
import agentManager from '../engine/agent-manager.js';

const router = Router();

// GET /api/regions
router.get('/', (req, res) => {
  res.json({ regions: store.getRegions() });
});

// GET /api/regions/:id
router.get('/:id', (req, res) => {
  const region = store.getRegion(req.params.id);
  if (!region) return res.status(404).json({ error: 'Region not found' });

  const agentsInRegion = store.agents.filter(a => a.region === req.params.id);
  res.json({
    ...region,
    agentCount: agentsInRegion.length,
    agents: agentsInRegion.map(a => ({ id: a.id, type: a.type, priority: a.priority, status: a.status, dataSourceMode: a.dataSourceMode })),
  });
});

// GET /api/regions/:id/profile — airports + airlines + countries for this region
router.get('/:id/profile', (req, res) => {
  const region = store.getRegion(req.params.id);
  if (!region) return res.status(404).json({ error: 'Region not found' });

  const profile = airportAirlineData.getRegionProfile(req.params.id);
  res.json({
    regionId: req.params.id,
    regionName: region.name,
    priority: region.priority,
    enabled: region.enabled,
    countries: profile.countries,
    airports: profile.airports,
    airlines: profile.airlines,
    subRegions: region.subRegions || [],
    dataSource: {
      airports: 'OurAirports (public domain, ourairports.com/data)',
      airlines: 'OpenFlights (open license, openflights.org/data)',
    },
  });
});

// PUT /api/regions/:id/enabled — toggle region monitoring
router.put('/:id/enabled', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Body must include { enabled: boolean }' });
  }

  const region = store.setRegionEnabled(req.params.id, enabled);
  if (!region) return res.status(404).json({ error: 'Region not found' });

  // Pause/resume agents in this region
  if (enabled) {
    agentManager.resumeRegion(req.params.id);
  } else {
    agentManager.pauseRegion(req.params.id);
  }

  res.json({
    regionId: region.id,
    regionName: region.name,
    enabled: region.enabled,
    message: `Region ${region.name} monitoring ${enabled ? 'enabled' : 'disabled'}`,
  });
});

// GET /api/regions/:id/airspace — airspace risk from safeairspace.net
router.get('/:id/airspace', async (req, res) => {
  const region = store.getRegion(req.params.id);
  if (!region) return res.status(404).json({ error: 'Region not found' });

  const countries = airportAirlineData.getCountriesByRegion(req.params.id);
  try {
    const risks = await getAirspaceRisks(countries);
    res.json({
      regionId: req.params.id,
      regionName: region.name,
      source: 'safeairspace.net',
      countries: risks,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch airspace data', details: err.message });
  }
});

export default router;
