// index.js — DisruptionMatrix Agent Engine API Server
// Express + WebSocket server that serves the agent system API.
// Seeded with existing PoC data so all endpoints work immediately.

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import store from './store/event-store.js';
import agentsRouter from './routes/agents.js';
import regionsRouter from './routes/regions.js';
import signalsRouter from './routes/signals.js';
import eventsRouter from './routes/events.js';
import opsRouter from './routes/ops.js';
import streamRouter, { setupWebSocket } from './routes/stream.js';
import llmRouter from './routes/llm.js';
import sourcesRouter from './routes/sources.js';
import chatRouter from './routes/chat.js';
import agentManager from './engine/agent-manager.js';
import { startPipeline } from './engine/pipeline.js';
import ragIndexer from './engine/rag-indexer.js';

const PORT = process.env.PORT || 3001;
const START_AGENTS = process.env.AGENTS !== 'off'; // AGENTS=off to disable polling

// ── Initialize store (async: DB migrations + hydration) ──────────────
// This replaces the old sync store.seed(). Must complete before starting agents.
await store.init();

// Load persisted impact mode from DB
const { initImpactMode } = await import('./engine/impact-assessment.js');
await initImpactMode();

// ── Initialize RAG index ────────────────────────────────────────────
// Index all application data for the conversation agent.
// Runs in background — doesn't block server startup.
if (store.dbReady) {
  console.log('[RAG] Indexing application data...');
  ragIndexer.indexAll()
    .then((results) => {
      const total = Object.values(results).reduce((s, c) => s + c, 0);
      console.log(`[RAG] Indexed ${total} documents:`, results);
    })
    .catch((err) => console.error('[RAG] Indexing failed:', err.message));
}

// ── Start agent polling loops + scoring pipeline ────────────────────
if (START_AGENTS) {
  agentManager.startAll();
  startPipeline(10000); // process new signals into events every 10s
}

// ── Express app ─────────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/stream')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  }
  next();
});

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'disruptionmatrix-agent-engine',
    version: '0.1.0',
    uptime: process.uptime(),
    database: {
      ready: store.dbReady,
      mode: store.dbReady ? 'connected' : 'in-memory-only',
    },
    stats: {
      agents: store.agents.length,
      pollingAgents: agentManager.getAll().length,
      events: store.events.length,
      signals: store.signals.length,
      ops: Object.keys(store.ops).length,
      regions: store.regions.length,
      agentsEnabled: START_AGENTS,
    },
  });
});

// ── API routes ──────────────────────────────────────────────────────
app.use('/api/agents', agentsRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events', opsRouter); // /api/events/:eventId/ops
app.use('/api/stream', streamRouter);
app.use('/api/llm', llmRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/chat', chatRouter);

// ── Reference data ─────────────────────────────────────────────────
app.get('/api/reference', (_req, res) => {
  res.json(store.getReferenceData());
});

// ── Pipeline status ────────────────────────────────────────────────
app.get('/api/pipeline', (_req, res) => {
  const pipeline = store.config.pipeline;
  const status = pipeline.map(step => ({
    ...step,
    itemCount: _getPipelineStepCount(step.step),
  }));
  res.json({ pipeline: status });
});

// ── Agent runtime status ───────────────────────────────────────────
app.get('/api/agents-runtime', (_req, res) => {
  res.json({
    agentsEnabled: START_AGENTS,
    pollingAgents: agentManager.getAll().length,
    status: agentManager.getStatus(),
  });
});

// ── Pipeline trigger (manual) ──────────────────────────────────────
app.post('/api/pipeline/run', async (_req, res) => {
  const { processNewSignals } = await import('./engine/pipeline.js');
  const result = processNewSignals();
  res.json({ ...result, message: `Processed ${result.processed} signals` });
});

// ── Impact assessment trigger (manual) ─────────────────────────────
app.post('/api/events/:id/ops/recompute', async (req, res) => {
  const { computeOPS, getImpactMode } = await import('./engine/impact-assessment.js');
  const event = store.getEventById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const ops = computeOPS(event);
  if (!ops) return res.status(500).json({ error: 'Could not compute OPS' });
  store.setOPS(event.id, ops, getImpactMode());
  res.json({ eventId: event.id, ops });
});

// ── Compute OPS for all events (batch) ─────────────────────────────
app.post('/api/ops/compute-all', async (_req, res) => {
  const { computeOPS, getImpactMode } = await import('./engine/impact-assessment.js');
  const mode = getImpactMode();
  let computed = 0;
  for (const event of store.events) {
    const ops = computeOPS(event);
    if (ops) {
      store.setOPS(event.id, ops, mode);
      computed++;
    }
  }
  res.json({ computed, total: store.events.length });
});

// ── Impact mode toggle (mock vs real airlines) ──────────────────────
app.get('/api/ops/mode', async (_req, res) => {
  const { getImpactMode } = await import('./engine/impact-assessment.js');
  res.json({ mode: getImpactMode() });
});

app.put('/api/ops/mode', async (req, res) => {
  const { setImpactMode, getImpactMode, computeOPS } = await import('./engine/impact-assessment.js');
  const { mode } = req.body;
  if (mode !== 'mock' && mode !== 'real') {
    return res.status(400).json({ error: 'Mode must be "mock" or "real"' });
  }
  setImpactMode(mode);
  // Persist mode to DB
  await store.setSetting('impactMode', mode);
  // Recompute all OPS with the new mode
  let computed = 0;
  for (const event of store.events) {
    const ops = computeOPS(event);
    if (ops) {
      store.setOPS(event.id, ops, mode);
      computed++;
    }
  }
  res.json({ mode: getImpactMode(), recomputed: computed, total: store.events.length });
});

function _getPipelineStepCount(step) {
  switch (step) {
    case 1: return store.signals.length;        // Collection
    case 2: return store.signals.length;        // Normalization (same count)
    case 3: return store.events.length;         // Correlation → events
    case 4: return store.events.length;         // Scoring
    case 5: return store.events.length;         // Domain impact
    case 6: return store.events.length;         // Causal chain
    case 7: return store.events.length;         // Evidence assembly
    case 8: return Object.keys(store.ops).length; // Impact assessment
    case 9: return store.events.length;         // Event store
    default: return 0;
  }
}

// ── 404 handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', availableEndpoints: [
    '/api/health', '/api/agents', '/api/regions', '/api/signals',
    '/api/events', '/api/events/:id/ops', '/api/reference', '/api/pipeline',
    '/api/llm', '/api/llm/enabled', '/api/llm/active-provider', '/api/llm/test',
    '/api/sources', '/api/sources/:id',
    '/api/stream (WebSocket or SSE)',
  ]});
});

// ── HTTP + WebSocket server ─────────────────────────────────────────
const server = createServer(app);
const wss = setupWebSocket(server);

server.listen(PORT, () => {
  const pollingCount = agentManager.getAll().length;
  console.log(`\n┌─────────────────────────────────────────────────────────────────┐`);
  console.log(`│  DisruptionMatrix Agent Engine                                  │`);
  console.log(`│  Server running on http://localhost:${PORT}                        │`);
  console.log(`├─────────────────────────────────────────────────────────────────┤`);
  console.log(`│  Agents:     ${store.agents.length} instances (${store.agentTypes.length} types), ${pollingCount} polling${START_AGENTS ? '' : ' (DISABLED)'}      │`);
  console.log(`│  Events:     ${store.events.length} scored                                      │`);
  console.log(`│  Signals:    ${store.signals.length} recent                                       │`);
  console.log(`│  OPS:        ${Object.keys(store.ops).length} impact assessments                            │`);
  console.log(`│  Regions:    ${store.regions.length}                                              │`);
  console.log(`│  WebSocket:  ws://localhost:${PORT}/api/stream                       │`);
  console.log(`│  Real data:  aviationweather.gov (METAR/TAF/SIGMET)             │`);
  console.log(`└─────────────────────────────────────────────────────────────────┘\n`);
});

export { app, server, wss };
