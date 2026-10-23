// GET /api/events         — list scored events (paginated, filterable)
// GET /api/events/:id     — single event with full detail

import { Router } from 'express';
import store from '../store/event-store.js';

const router = Router();

// GET /api/events
// Query params: cat, minScore, limit, offset
router.get('/', (req, res) => {
  const result = store.getEvents(req.query);
  res.json(result);
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const event = store.getEventById(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  // Enrich with geo data
  const eventGeo = store.geoData.EVENT_GEO[req.params.id] || null;
  const ops = store.getOPS(req.params.id);

  res.json({
    ...event,
    geo: eventGeo,
    ops: ops,
  });
});

// DELETE /api/events/:id — delete an event (and its OPS)
router.delete('/:id', (req, res) => {
  const deleted = store.deleteEvent(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Event not found' });
  res.json({ deleted: true, id: req.params.id });
});

export default router;
