// master-data.js — Express routes for master data CRUD.
// All routes under /api/master/*

import { Router } from 'express';
import * as md from '../db/repositories/master-data.js';

const router = Router();

// Helper: wrap async handlers
function h(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch(e => {
    console.error('[master-data]', e.message);
    res.status(500).json({ error: e.message });
  });
}

// ── Summary ──────────────────────────────────────────────────────────
router.get('/summary', h(async (_req, res) => {
  res.json(await md.getSummary());
}));

// ── Loader status ───────────────────────────────────────────────────
router.get('/loader-status', h(async (_req, res) => {
  const refLoader = await import('../data/reference-loader.js');
  res.json({
    loaded: refLoader.isLoaded(),
    summary: refLoader.getSummary(),
  });
}));

// ── Airports ──────────────────────────────────────────────────────────
router.get('/airports', h(async (req, res) => {
  const filter = {};
  if (req.query.region_id) filter.region_id = req.query.region_id;
  if (req.query.active) filter.active = req.query.active === 'true';
  res.json({ airports: await md.getAirports(filter) });
}));

router.get('/airports/:iata', h(async (req, res) => {
  const a = await md.getAirport(req.params.iata);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
}));

router.post('/airports', h(async (req, res) => {
  res.json(await md.upsertAirport(req.body));
}));

router.delete('/airports/:iata', h(async (req, res) => {
  await md.deleteAirport(req.params.iata);
  res.json({ ok: true });
}));

// ── Airlines ──────────────────────────────────────────────────────────
router.get('/airlines', h(async (req, res) => {
  const filter = {};
  if (req.query.active) filter.active = req.query.active === 'true';
  res.json({ airlines: await md.getAirlines(filter) });
}));

router.get('/airlines/:iata', h(async (req, res) => {
  const a = await md.getAirline(req.params.iata);
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json(a);
}));

router.post('/airlines', h(async (req, res) => {
  res.json(await md.upsertAirline(req.body));
}));

router.delete('/airlines/:iata', h(async (req, res) => {
  await md.deleteAirline(req.params.iata);
  res.json({ ok: true });
}));

// ── Regions ──────────────────────────────────────────────────────────
router.get('/regions', h(async (_req, res) => {
  res.json({ regions: await md.getRegions() });
}));

router.get('/regions/:id', h(async (req, res) => {
  const r = await md.getRegion(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
}));

router.post('/regions', h(async (req, res) => {
  res.json(await md.upsertRegion(req.body));
}));

router.delete('/regions/:id', h(async (req, res) => {
  await md.deleteRegion(req.params.id);
  res.json({ ok: true });
}));

// ── Region Countries ─────────────────────────────────────────────────
router.get('/regions/:id/countries', h(async (req, res) => {
  res.json({ countries: await md.getRegionCountries(req.params.id) });
}));

router.put('/regions/:id/countries', h(async (req, res) => {
  await md.setRegionCountries(req.params.id, req.body.countries || []);
  res.json({ ok: true });
}));

// ── Sub-Regions ──────────────────────────────────────────────────────
router.get('/sub-regions', h(async (req, res) => {
  res.json({ subRegions: await md.getSubRegions(req.query.region) });
}));

router.post('/sub-regions', h(async (req, res) => {
  res.json(await md.upsertSubRegion(req.body));
}));

router.delete('/sub-regions/:id', h(async (req, res) => {
  await md.deleteSubRegion(req.params.id);
  res.json({ ok: true });
}));

// ── Categories ────────────────────────────────────────────────────────
router.get('/categories', h(async (_req, res) => {
  res.json({ categories: await md.getCategories() });
}));

router.post('/categories', h(async (req, res) => {
  res.json(await md.upsertCategory(req.body));
}));

router.delete('/categories/:id', h(async (req, res) => {
  await md.deleteCategory(req.params.id);
  res.json({ ok: true });
}));

// ── Agent Types ───────────────────────────────────────────────────────
router.get('/agent-types', h(async (_req, res) => {
  res.json({ agentTypes: await md.getAgentTypes() });
}));

router.post('/agent-types', h(async (req, res) => {
  res.json(await md.upsertAgentType(req.body));
}));

router.delete('/agent-types/:type', h(async (req, res) => {
  await md.deleteAgentType(req.params.type);
  res.json({ ok: true });
}));

// ── Hazard Types ─────────────────────────────────────────────────────
router.get('/hazard-types', h(async (_req, res) => {
  res.json({ hazardTypes: await md.getHazardTypes() });
}));

router.post('/hazard-types', h(async (req, res) => {
  res.json(await md.upsertHazardType(req.body));
}));

router.delete('/hazard-types/:type', h(async (req, res) => {
  await md.deleteHazardType(req.params.type);
  res.json({ ok: true });
}));

// ── Hazard Keywords ──────────────────────────────────────────────────
router.get('/hazard-keywords', h(async (req, res) => {
  res.json({ keywords: await md.getHazardKeywords(req.query.hazard_type) });
}));

router.post('/hazard-keywords', h(async (req, res) => {
  res.json(await md.upsertHazardKeyword(req.body));
}));

router.delete('/hazard-keywords/:id', h(async (req, res) => {
  await md.deleteHazardKeyword(req.params.id);
  res.json({ ok: true });
}));

// ── Domains ──────────────────────────────────────────────────────────
router.get('/domains', h(async (_req, res) => {
  res.json({ domains: await md.getDomains() });
}));

router.post('/domains', h(async (req, res) => {
  res.json(await md.upsertDomain(req.body));
}));

router.delete('/domains/:id', h(async (req, res) => {
  await md.deleteDomain(req.params.id);
  res.json({ ok: true });
}));

// ── Domain Profiles ──────────────────────────────────────────────────
router.get('/domain-profiles', h(async (req, res) => {
  res.json({ profiles: await md.getDomainProfiles(req.query.category_id) });
}));

router.post('/domain-profiles', h(async (req, res) => {
  res.json(await md.upsertDomainProfile(req.body));
}));

router.delete('/domain-profiles/:id', h(async (req, res) => {
  await md.deleteDomainProfile(req.params.id);
  res.json({ ok: true });
}));

// ── Scoring Bands ────────────────────────────────────────────────────
router.get('/scoring-bands', h(async (_req, res) => {
  res.json({ bands: await md.getScoringBands() });
}));

router.post('/scoring-bands', h(async (req, res) => {
  res.json(await md.upsertScoringBand(req.body));
}));

router.delete('/scoring-bands/:id', h(async (req, res) => {
  await md.deleteScoringBand(req.params.id);
  res.json({ ok: true });
}));

// ── EDPS Factors ─────────────────────────────────────────────────────
router.get('/edps-factors', h(async (_req, res) => {
  res.json({ factors: await md.getEdpsFactors() });
}));

router.post('/edps-factors', h(async (req, res) => {
  res.json(await md.upsertEdpsFactor(req.body));
}));

router.delete('/edps-factors/:id', h(async (req, res) => {
  await md.deleteEdpsFactor(req.params.id);
  res.json({ ok: true });
}));

// ── Band Values ──────────────────────────────────────────────────────
router.get('/band-values', h(async (req, res) => {
  res.json({ values: await md.getBandValues(req.query.band_type) });
}));

router.post('/band-values', h(async (req, res) => {
  res.json(await md.upsertBandValue(req.body));
}));

router.delete('/band-values/:id', h(async (req, res) => {
  await md.deleteBandValue(req.params.id);
  res.json({ ok: true });
}));

// ── WMO Codes ────────────────────────────────────────────────────────
router.get('/wmo-codes', h(async (_req, res) => {
  res.json({ codes: await md.getWmoCodes() });
}));

router.post('/wmo-codes', h(async (req, res) => {
  res.json(await md.upsertWmoCode(req.body));
}));

router.delete('/wmo-codes/:code', h(async (req, res) => {
  await md.deleteWmoCode(parseInt(req.params.code, 10));
  res.json({ ok: true });
}));

// ── LLM Providers ────────────────────────────────────────────────────
router.get('/llm-providers', h(async (_req, res) => {
  res.json({ providers: await md.getLlmProviders() });
}));

router.post('/llm-providers', h(async (req, res) => {
  res.json(await md.upsertLlmProvider(req.body));
}));

router.delete('/llm-providers/:key', h(async (req, res) => {
  await md.deleteLlmProvider(req.params.key);
  res.json({ ok: true });
}));

// ── Connector Configs ────────────────────────────────────────────────
router.get('/connectors', h(async (req, res) => {
  res.json({ connectors: await md.getConnectors(req.query.connector) });
}));

router.post('/connectors', h(async (req, res) => {
  res.json(await md.upsertConnectorConfig(req.body));
}));

router.delete('/connectors/:id', h(async (req, res) => {
  await md.deleteConnectorConfig(parseInt(req.params.id, 10));
  res.json({ ok: true });
}));

// ── GDELT Queries ────────────────────────────────────────────────────
router.get('/gdelt-queries', h(async (req, res) => {
  res.json({ queries: await md.getGdeltQueries(req.query.category) });
}));

router.post('/gdelt-queries', h(async (req, res) => {
  res.json(await md.upsertGdeltQuery(req.body));
}));

router.delete('/gdelt-queries/:id', h(async (req, res) => {
  await md.deleteGdeltQuery(parseInt(req.params.id, 10));
  res.json({ ok: true });
}));

// ── Subreddits ───────────────────────────────────────────────────────
router.get('/subreddits', h(async (_req, res) => {
  res.json({ subreddits: await md.getSubreddits() });
}));

router.post('/subreddits', h(async (req, res) => {
  res.json(await md.upsertSubreddit(req.body));
}));

router.delete('/subreddits/:id', h(async (req, res) => {
  await md.deleteSubreddit(parseInt(req.params.id, 10));
  res.json({ ok: true });
}));

// ── Flight Routes ───────────────────────────────────────────────────
router.get('/flight-routes', h(async (req, res) => {
  res.json({ routes: await md.getFlightRoutes(req.query.route_type) });
}));

router.post('/flight-routes', h(async (req, res) => {
  res.json(await md.upsertFlightRoute(req.body));
}));

router.delete('/flight-routes/:id', h(async (req, res) => {
  await md.deleteFlightRoute(parseInt(req.params.id, 10));
  res.json({ ok: true });
}));

// ── Mock Scenarios ───────────────────────────────────────────────────
router.get('/mock-scenarios', h(async (req, res) => {
  const filter = {};
  if (req.query.agent_type) filter.agent_type = req.query.agent_type;
  if (req.query.region) filter.region = req.query.region;
  res.json({ scenarios: await md.getMockScenarios(filter) });
}));

router.post('/mock-scenarios', h(async (req, res) => {
  res.json(await md.upsertMockScenario(req.body));
}));

router.delete('/mock-scenarios/:id', h(async (req, res) => {
  await md.deleteMockScenario(parseInt(req.params.id, 10));
  res.json({ ok: true });
}));

export default router;
