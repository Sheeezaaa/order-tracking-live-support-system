// test-protocols.js
// Automated End-to-End Verification Test for all 4 Protocols:
// 1. REST (Catalog & Orders)
// 2. WebSockets (Socket.io Real-time Updates & Chat)
// 3. JSON-RPC 2.0 (Methods & Error Spec)
// 4. Server-Sent Events (SSE Stream & Live Broadcast)

process.env.NODE_ENV = 'test';
const http = require('http');
const { app, server } = require('./server/index');
const { io: ClientIo } = require('socket.io-client');

const TEST_PORT = 3456;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawData: body });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n========================================================');
  console.log('🧪 Starting Comprehensive Protocol Verification Tests');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Start test server
  await new Promise(resolve => server.listen(TEST_PORT, resolve));
  console.log(`Server listening on port ${TEST_PORT} for automated test runner...\n`);

  let createdOrderId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: REST Protocol
    // ----------------------------------------------------
    console.log('▶ [1/4] Testing REST API (/api/v1/...)');
    
    // GET /catalog
    const catRes = await request('/api/v1/catalog');
    assert(catRes.status === 200, 'GET /api/v1/catalog returns 200 OK');
    assert(Array.isArray(catRes.data.data) && catRes.data.data.length > 0, `Catalog contains ${catRes.data.data?.length} products`);

    // POST /orders
    const orderPayload = {
      customerName: "Test Automation",
      customerEmail: "qa@test.com",
      shippingAddress: "123 Test Lab Blvd, Suite 10",
      items: [{ productId: "prod-2", quantity: 2 }]
    };
    const orderRes = await request('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: orderPayload
    });
    assert(orderRes.status === 201, 'POST /api/v1/orders returns 201 Created');
    assert(orderRes.data.data.id && orderRes.data.data.status === 'PLACED', `Order created with ID: ${orderRes.data.data?.id}`);
    createdOrderId = orderRes.data.data.id;

    // GET /orders/:id
    const singleOrderRes = await request(`/api/v1/orders/${createdOrderId}`);
    assert(singleOrderRes.status === 200, `GET /api/v1/orders/${createdOrderId} returns 200 OK`);
    assert(singleOrderRes.data.data.totalAmount > 0, `Order totalAmount calculated: $${singleOrderRes.data.data.totalAmount}`);

    // ----------------------------------------------------
    // TEST 2: JSON-RPC 2.0 Protocol
    // ----------------------------------------------------
    console.log('\n▶ [2/4] Testing JSON-RPC 2.0 Specification (/rpc)');

    // ping method
    const pingRes = await request('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { jsonrpc: "2.0", method: "ping", id: "req-1" }
    });
    assert(pingRes.data.jsonrpc === "2.0", 'Response envelope has jsonrpc: "2.0"');
    assert(pingRes.data.id === "req-1", 'Response envelope matches request id');
    assert(pingRes.data.result?.status === "pong", 'Method "ping" returned pong');

    // calculateRefund method
    const refundRes = await request('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { jsonrpc: "2.0", method: "calculateRefund", params: { orderId: createdOrderId }, id: "req-2" }
    });
    assert(refundRes.data.result?.estimatedRefundAmount > 0, `Method "calculateRefund" returned $${refundRes.data.result?.estimatedRefundAmount}`);

    // cancelOrder method
    const cancelRes = await request('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { jsonrpc: "2.0", method: "cancelOrder", params: { orderId: createdOrderId, reason: "QA verification test" }, id: "req-3" }
    });
    assert(cancelRes.data.result?.success === true, 'Method "cancelOrder" successfully cancelled order');

    // verify error handling: Method not found (-32601)
    const badMethodRes = await request('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { jsonrpc: "2.0", method: "nonExistentMethod", id: "req-4" }
    });
    assert(badMethodRes.data.error?.code === -32601, 'Invalid method returns standard JSON-RPC 2.0 error code -32601 (Method not found)');

    // verify error handling: Invalid Request (-32600)
    const badReqRes = await request('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { invalidJsonRpc: true }
    });
    assert(badReqRes.data.error?.code === -32600, 'Invalid envelope returns standard JSON-RPC 2.0 error code -32600 (Invalid Request)');

    // ----------------------------------------------------
    // TEST 3: Server-Sent Events (SSE) Protocol
    // ----------------------------------------------------
    console.log('\n▶ [3/4] Testing Server-Sent Events (SSE) Stream (/events)');

    let sseReceivedAlert = false;
    let sseHandshakeReceived = false;

    // Connect to SSE stream
    const sseReq = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/events',
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      agent: false
    }, (res) => {
      assert(res.statusCode === 200, 'GET /events returns 200 OK');
      assert(res.headers['content-type'].includes('text/event-stream'), 'Content-Type header is text/event-stream');

      res.on('data', chunk => {
        const text = chunk.toString();
        // console.log('[SSE TEST DEBUG CHUNK]:', text);
        if (text.includes('event: connected')) {
          sseHandshakeReceived = true;
        }
        if (text.includes('Automated Test Alert')) {
          sseReceivedAlert = true;
        }
      });
    });
    sseReq.end();

    // Allow SSE connection to establish
    for (let i = 0; i < 20; i++) {
      if (sseHandshakeReceived) break;
      await sleep(50);
    }
    assert(sseHandshakeReceived, 'Received SSE initial handshake event over event-stream');

    // Trigger an SSE alert broadcast via POST /events/broadcast
    const broadcastRes = await request('/events/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        title: "QA Test Broadcast",
        message: "Automated Test Alert streamed via SSE",
        level: "warning"
      }
    });
    assert(broadcastRes.data.status === "broadcast_sent", 'POST /events/broadcast dispatched alert to active SSE streams');

    for (let i = 0; i < 20; i++) {
      if (sseReceivedAlert) break;
      await sleep(50);
    }
    assert(sseReceivedAlert, 'Client received real-time broadcast via continuous text/event-stream');
    sseReq.destroy();

    // ----------------------------------------------------
    // TEST 4: WebSockets (Socket.io) Protocol
    // ----------------------------------------------------
    console.log('\n▶ [4/4] Testing WebSockets Protocol (Socket.io)');

    const clientSocket1 = ClientIo(`http://127.0.0.1:${TEST_PORT}`, { reconnection: false });
    const clientSocket2 = ClientIo(`http://127.0.0.1:${TEST_PORT}`, { reconnection: false });

    await new Promise((resolve) => {
      let connectedCount = 0;
      const check = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };
      clientSocket1.on('connect', check);
      clientSocket2.on('connect', check);
    });
    assert(clientSocket1.connected && clientSocket2.connected, 'Two WebSocket clients successfully connected via Socket.io');

    const testRoomOrder = "ORD-9821";
    let client1Joined = false;
    let client2Joined = false;
    let client2ReceivedMessage = false;
    let client1ReceivedStatusUpdate = false;

    clientSocket1.on('joined_order_room', (data) => {
      if (data.orderId === testRoomOrder) client1Joined = true;
    });

    clientSocket2.on('joined_order_room', (data) => {
      if (data.orderId === testRoomOrder) client2Joined = true;
    });

    clientSocket2.on('receive_message', (data) => {
      if (data.message.text === "Testing 1-on-1 support chat room via WebSocket") {
        client2ReceivedMessage = true;
      }
    });

    clientSocket1.on('order_status_updated', (data) => {
      if (data.orderId === testRoomOrder && data.status === "OUT_FOR_DELIVERY") {
        client1ReceivedStatusUpdate = true;
      }
    });

    // Both join the room
    clientSocket1.emit('join_order', { orderId: testRoomOrder, role: 'customer', username: 'Alex' });
    clientSocket2.emit('join_order', { orderId: testRoomOrder, role: 'agent', username: 'Agent Sarah' });

    await sleep(300);
    assert(client1Joined && client2Joined, `Both Customer and Support Agent joined room order_${testRoomOrder}`);

    // Customer sends message to Agent
    clientSocket1.emit('send_message', {
      orderId: testRoomOrder,
      text: "Testing 1-on-1 support chat room via WebSocket",
      sender: "Alex",
      role: "customer"
    });

    await sleep(300);
    assert(client2ReceivedMessage, 'Customer message delivered in real-time to Support Agent in 1-on-1 room');

    // Agent dispatches status update
    clientSocket2.emit('order_status_update', {
      orderId: testRoomOrder,
      newStatus: "OUT_FOR_DELIVERY",
      note: "Dispatched by carrier in automated test",
      updatedBy: "Agent Sarah"
    });

    await sleep(300);
    assert(client1ReceivedStatusUpdate, 'Customer received real-time order_status_updated event over WebSocket');

    clientSocket1.disconnect();
    clientSocket2.disconnect();

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n========================================================');
  console.log(`📊 Test Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
