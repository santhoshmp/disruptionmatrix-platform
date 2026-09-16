// GET /api/agents          — list all agent instances with runtime status
// GET /api/agents/:id       — single agent detail
// POST /api/agents/:id/trigger — manually trigger an agent poll (stub for Phase 2)

import { Router } from 'express';
import store from '../store/event-store.js';
import agentManager from '../engine/agent-manager.js';

const router = Router();

// GET /api/agents — list all agents
// Query params: type, region, priority
router.get('/', (req, res) => {
  const result = store.getAgents(req.query);
  res.json(result);
});

// GET /api/agents/types — list agent type definitions
router.get('/types', (req, res) => {
  res.json({ agentTypes: store.agentTypes });
});

// GET /api/agents/:id — single agent detail
router.get('/:id', (req, res) => {
  const agent = store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

// POST /api/agents/:id/trigger — manually trigger a poll
router.post('/:id/trigger', async (req, res) => {
  const agent = store.getAgentById(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  store.updateAgentStatus(agent.id, 'polling');

  try {
    // Trigger the real agent poll
    const agentInstance = agentManager.get(agent.id);
    if (agentInstance) {
      const result = await agentInstance.trigger();
      res.json({
        agentId: agent.id,
        triggered: true,
        status: 'completed',
        signalsGenerated: result?.length || 0,
        lastPoll: new Date().toISOString(),
      });
    } else {
      // Impact-assessment agent or not instantiated
      res.json({
        agentId: agent.id,
        triggered: true,
        status: 'no-instance',
        message: 'Agent is event-driven or not instantiated for polling',
        lastPoll: agent.lastPoll,
      });
    }
  } catch (err) {
    res.status(500).json({
      agentId: agent.id,
      triggered: false,
      error: err.message,
    });
  }
});

export default router;
