// profiling.js — Routes for the Threat Profiling Agent
// Manual trigger: queue one, multiple, or all events for profiling
// Background processing with status tracking

import { Router } from 'express';
import store from '../store/event-store.js';
import threatProfiler from '../engine/threat-profiler.js';
import llmService from '../engine/llm-service.js';

const router = Router();

// GET /api/profiling/status — get profiling status for all events
router.get('/status', (req, res) => {
  const stats = threatProfiler.getQueueStats();
  const allStatus = threatProfiler.getAllStatus();
  res.json({ stats, events: allStatus });
});

// GET /api/profiling/status/:eventId — get profiling status for a single event
router.get('/status/:eventId', (req, res) => {
  const status = threatProfiler.getStatus(req.params.eventId);
  if (!status) return res.status(404).json({ error: 'No profiling status for this event' });
  res.json({ eventId: req.params.eventId, ...status });
});

// GET /api/profiling/logs — global activity log (?limit=200)
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  res.json({ logs: threatProfiler.getLogs(null, limit) });
});

// GET /api/profiling/logs/:eventId — per-event log
router.get('/logs/:eventId', (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  res.json({ eventId: req.params.eventId, logs: threatProfiler.getLogs(req.params.eventId, limit) });
});

// POST /api/profiling/trigger — queue one or more events for profiling
// Body: { eventIds: ["id1", "id2", ...], force: false }
router.post('/trigger', (req, res) => {
  const { eventIds, force } = req.body;
  if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
    return res.status(400).json({ error: 'eventIds must be a non-empty array' });
  }
  const result = threatProfiler.queueProfiling(eventIds, { force });
  res.json(result);
});

// POST /api/profiling/trigger-all — queue all real (agent-pipeline) events
// Body: { minScore: 0, category: null, force: false }
router.post('/trigger-all', (req, res) => {
  const { minScore, category, force } = req.body;
  const result = threatProfiler.queueAllRealEvents({ minScore, category, force });
  res.json(result);
});

// POST /api/profiling/cancel/:eventId — cancel profiling for an event (queued or running)
router.post('/cancel/:eventId', (req, res) => {
  const cancelled = threatProfiler.cancelProfiling(req.params.eventId);
  if (!cancelled) {
    return res.status(400).json({ error: 'Cannot cancel — no active profiling job for this event' });
  }
  res.json({ cancelled: true, eventId: req.params.eventId });
});

// POST /api/profiling/clear — clear completed/failed statuses
router.post('/clear', (req, res) => {
  const cleared = threatProfiler.clearCompleted();
  res.json({ cleared });
});

// GET /api/profiling/llm-status — check if profiling LLM is enabled
router.get('/llm-status', async (req, res) => {
  const enabled = await llmService.isProfilingLLMEnabled();
  const provider = await llmService.getProfilingActiveProvider();
  res.json({ enabled, provider, method: enabled ? 'llm' : 'deterministic' });
});

// PUT /api/profiling/llm-enabled — toggle profiling LLM
router.put('/llm-enabled', async (req, res) => {
  const { enabled } = req.body;
  await llmService.setProfilingLLMEnabled(enabled);
  res.json({ enabled });
});

// PUT /api/profiling/active-provider — set profiling active provider
router.put('/active-provider', async (req, res) => {
  const { provider } = req.body;
  await llmService.setProfilingActiveProvider(provider);
  res.json({ provider });
});

export default router;
