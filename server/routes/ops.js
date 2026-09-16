// GET /api/events/:id/ops  — impact assessment (OPS object) for an event
// GET /api/events/:id/airlines — list all impacted airlines for an event
// GET /api/events/:id/airlines/:code/flights — flights impacted for an airline

import { Router } from 'express';
import store from '../store/event-store.js';
import { getAirlineFlightsForEvent, getImpactedAirlinesForEvent } from '../engine/flight-estimator.js';

const router = Router();

// GET /api/events/:eventId/ops
router.get('/:eventId/ops', (req, res) => {
  const event = store.getEventById(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const ops = store.getOPS(req.params.eventId);
  if (!ops) return res.status(404).json({ error: 'OPS not computed for this event' });

  res.json({
    eventId: req.params.eventId,
    eventName: event.name,
    edps: event.score,
    ops: ops,
  });
});

// GET /api/events/:eventId/airlines — list all impacted airlines
router.get('/:eventId/airlines', (req, res) => {
  const event = store.getEventById(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const airlines = getImpactedAirlinesForEvent(req.params.eventId);
  res.json({ eventId: req.params.eventId, eventName: event.name, airlines });
});

// GET /api/events/:eventId/airlines/:airlineCode/flights
router.get('/:eventId/airlines/:airlineCode/flights', (req, res) => {
  const { eventId, airlineCode } = req.params;
  const event = store.getEventById(eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const result = getAirlineFlightsForEvent(eventId, airlineCode.toUpperCase());
  res.json({
    eventId,
    eventName: event.name,
    airlineCode: airlineCode.toUpperCase(),
    ...result,
  });
});

export default router;
