// GET /api/signals        — list recent signals (paginated, filterable)
// GET /api/signals/:id    — single signal detail

import { Router } from 'express';
import store from '../store/event-store.js';

const router = Router();

// GET /api/signals
// Query params: agentType, region, agentId, limit, offset
router.get('/', (req, res) => {
  const result = store.getSignals(req.query);
  res.json(result);
});

// GET /api/signals/:id
router.get('/:id', (req, res) => {
  const signal = store.getSignalById(req.params.id);
  if (!signal) return res.status(404).json({ error: 'Signal not found' });
  res.json(signal);
});

export default router;
