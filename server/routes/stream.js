// WebSocket /api/stream — real-time signal/event/agent status updates
// Also: GET /api/stream (fallback) — Server-Sent Events for clients without WS

import { Router } from 'express';
import { WebSocketServer } from 'ws';
import store from '../store/event-store.js';

const router = Router();

// GET /api/stream — SSE fallback
router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (message) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };

  // Create a fake WS-like object for the SSE client
  const fakeClient = {
    readyState: 1,
    send: (data) => sendEvent(JSON.parse(data)),
  };
  store.subscribe(fakeClient);

  // Send initial connection ack
  sendEvent({ type: 'connected', data: { message: 'SSE stream connected' } });

  req.on('close', () => {
    store.unsubscribe(fakeClient);
  });
});

// WebSocket setup function — called from index.js after HTTP server is created
export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/api/stream' });

  wss.on('connection', (ws) => {
    store.subscribe(ws);

    // Send initial connection ack
    ws.send(JSON.stringify({
      type: 'connected',
      data: {
        message: 'WebSocket stream connected',
        agentCount: store.agents.length,
        eventCount: store.events.length,
        signalCount: store.signals.length,
      },
    }));

    ws.on('close', () => {
      store.unsubscribe(ws);
    });

    ws.on('error', () => {
      store.unsubscribe(ws);
    });
  });

  return wss;
}

export default router;
