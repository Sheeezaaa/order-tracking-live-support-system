// server/index.js
// Main Application Entry Point uniting REST, WebSockets, JSON-RPC, and SSE

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');

const restRouter = require('./routes/rest');
const rpcRouter = require('./routes/rpc');
const { router: sseRouter, broadcast: broadcastSse } = require('./routes/sse');
const configureSockets = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to Express route handlers
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// 1. REST Protocol: Resource Management (/api/v1/...)
app.use('/api/v1', restRouter);

// 2. JSON-RPC 2.0 Protocol: Method-based RPC (/rpc)
app.use('/rpc', rpcRouter);

// 3. Server-Sent Events (SSE) Protocol: Live Alerts (/events)
app.use('/events', sseRouter);

// 4. WebSockets: Real-time Order Tracking & 1-on-1 Chat
configureSockets(io, broadcastSse);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    protocols: {
      rest: "/api/v1/catalog, /api/v1/orders",
      websockets: "Socket.io enabled",
      jsonRpc2: "/rpc",
      sse: "/events"
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Fallback to SPA index.html for unknown HTML navigation routes
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.status(404).json({ error: "Resource not found" });
  }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Order Tracking & Live Support System Server Started!`);
    console.log(`👉 OPEN IN BROWSER: http://localhost:${PORT}`);
    console.log(`------------------------------------------------------`);
    console.log(`Integrated Protocols:`);
    console.log(`  [Web UI]     http://localhost:${PORT}`);
    console.log(`  [REST]       http://localhost:${PORT}/api/v1/catalog`);
    console.log(`  [JSON-RPC]   http://localhost:${PORT}/rpc (POST methods)`);
    console.log(`  [SSE]        http://localhost:${PORT}/events (EventStream)`);
    console.log(`  [WebSockets] Handled via Socket.io inside the Web UI`);
    console.log(`======================================================\n`);
  });
}

module.exports = { app, server, io };
