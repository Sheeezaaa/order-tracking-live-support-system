// server/routes/sse.js
// Server-Sent Events (SSE) router pushing live system alerts (/events)

const express = require('express');
const router = express.Router();
const store = require('../data/store');

// Active client response objects for SSE
const sseClients = new Set();

/**
 * Helper to write a formatted SSE message to a client stream
 */
function sendSseEvent(res, eventName, data, id = null) {
  if (id !== null) {
    res.write(`id: ${id}\n`);
  }
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

/**
 * Broadcast an event to all connected SSE clients
 */
function broadcast(eventName, data) {
  const messageId = Date.now();
  for (const client of sseClients) {
    try {
      sendSseEvent(client, eventName, data, messageId);
    } catch (err) {
      console.error("Failed to push SSE message to client:", err.message);
      sseClients.delete(client);
    }
  }
}

/**
 * @route   GET /events
 * @desc    Establish continuous Server-Sent Events stream for system alerts
 */
router.get('/', (req, res) => {
  // Disable Nagle's algorithm for instant chunk delivery
  if (req.socket) {
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);
  }

  // Required SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Flush headers if method exists
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  // Add client to active connection set
  sseClients.add(res);

  // Send initial connection handshake
  sendSseEvent(res, 'connected', {
    protocol: "SSE",
    message: "Connected to Live System Alerts EventStream",
    connectedClients: sseClients.size,
    timestamp: new Date().toISOString()
  });

  // Send current recent alerts
  const recentAlerts = store.getAlerts();
  sendSseEvent(res, 'initial_alerts', recentAlerts);

  // Keep-alive heartbeat every 20 seconds to prevent network timeouts
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeatInterval);
      sseClients.delete(res);
    }
  }, 20000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    sseClients.delete(res);
  });
});

/**
 * @route   POST /events/broadcast
 * @desc    Trigger an alert broadcast to all SSE subscribers
 */
router.post('/broadcast', (req, res) => {
  const { title, message, level } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Field 'message' is required." });
  }

  const newAlert = store.addAlert({
    title: title || "System Announcement",
    message,
    level: level || "info" // info, warning, success, danger
  });

  // Broadcast to all active SSE streams
  broadcast('system_alert', {
    protocol: "SSE",
    alert: newAlert
  });

  res.json({
    status: "broadcast_sent",
    protocol: "SSE",
    recipientsCount: sseClients.size,
    alert: newAlert
  });
});

/**
 * @route   GET /events/status
 * @desc    Get current SSE connection stats
 */
router.get('/status', (req, res) => {
  res.json({
    protocol: "SSE",
    activeConnections: sseClients.size,
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  router,
  broadcast
};
