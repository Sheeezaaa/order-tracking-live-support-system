# 📦 Order Tracking & Live Support System
### Multi-Protocol Real-Time Architecture (AWT Assignment 4)

A unified full-stack application demonstrating four core web communication protocols (**REST**, **WebSockets**, **JSON-RPC 2.0**, and **Server-Sent Events (SSE)**) running seamlessly within a single Node.js & Express service.

---

## 🌟 Architecture & Protocol Mapping

| Protocol | Endpoint | Role & Use Case | Payload & Specification |
|---|---|---|---|
| **REST** | `/api/v1/catalog`<br>`/api/v1/orders` | **Resource Management**<br>Product catalog retrieval, order placement, order status queries. | HTTP standard verbs (`GET`, `POST`), JSON payloads, standard HTTP status codes (`200 OK`, `201 Created`, `404 Not Found`). |
| **WebSockets** | `/socket.io` | **Bi-directional Real-Time Communication**<br>Live order status progress transitions, 1-on-1 customer-to-agent support chat, typing indicators. | Persistent full-duplex TCP connection, room-based routing (`order_<id>`), event-driven architecture (`order_status_updated`, `send_message`, `typing`). |
| **JSON-RPC 2.0** | `/rpc` | **Method-Based Transactions**<br>Remote procedural commands: `cancelOrder`, `updateShippingAddress`, `calculateRefund`, and `ping`. | Strict JSON-RPC 2.0 specification: `{ "jsonrpc": "2.0", "method": "...", "params": {...}, "id": 1 }`, standard spec error codes (`-32600`, `-32601`, `-32602`). |
| **Server-Sent Events** | `/events` | **Unidirectional Push Broadcasts**<br>Push live system announcements, flash promotions, logistics alerts, and server heartbeats. | Continuous HTTP stream (`Content-Type: text/event-stream`), automated browser reconnection, lightweight memory footprint. |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### 1. Installation
```bash
npm install
```

### 2. Start the Application
```bash
npm start
```
Open your browser to:
👉 **`http://localhost:3000`**

### 3. Run Automated Protocol Verification Tests
```bash
npm test
```
The automated test runner will launch and verify all 4 protocols end-to-end, testing endpoints, socket messaging, JSON-RPC envelopes, and SSE streaming.

---

## 🖥️ User Interface Features

1. **Top Banner (SSE Stream)**:
   - Listens to `text/event-stream` at `/events`.
   - Flashes notifications instantly when an administrator broadcasts an alert or when an order is dispatched.

2. **Customer View**:
   - **Catalog & Checkout (REST)**: Browse live stock, select products, and submit orders with `POST /api/v1/orders`.
   - **Real-Time Tracker (WebSockets)**: 5-step visual progress stepper (`Placed` → `Confirmed` → `Preparing` → `In Transit` → `Delivered`) updated instantly without page reloads.
   - **1-on-1 Support Chat (WebSockets)**: Direct messaging channel into the order room with typing indicators.
   - **Method Actions (JSON-RPC 2.0)**: Trigger transactional actions like `cancelOrder`, `updateShippingAddress`, or `calculateRefund` and inspect the raw JSON-RPC wire frames.

3. **Support Agent / Admin View**:
   - **Order Dispatch Pipeline**: One-click status buttons (`Confirm`, `Prepare`, `Ship`, `Deliver`) emitting real-time WebSocket events.
   - **Agent Support Console**: Respond to customer inquiries with canned responses or custom replies.
   - **Live SSE Broadcast Station**: Trigger unilateral system broadcasts across all connected client browsers.

4. **Live Protocol Traffic Inspector**:
   - Built-in terminal log at the bottom of the dashboard.
   - Displays real-time frames with color-coded badges, direction indicators (`OUT ➜` / `IN ⬅`), timestamps, and inspectable JSON payloads.
   - Filterable by **ALL**, **REST**, **WS**, **RPC**, or **SSE**.

---

## 🔌 API & Protocol Examples

### 1. REST API
#### Fetch Catalog
```http
GET /api/v1/catalog HTTP/1.1
Host: localhost:3000
```
#### Create Order
```http
POST /api/v1/orders HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "shippingAddress": "123 Market St, San Francisco, CA",
  "items": [
    { "productId": "prod-1", "quantity": 1 }
  ]
}
```

### 2. JSON-RPC 2.0 (`/rpc`)
#### Cancel Order
```http
POST /rpc HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "cancelOrder",
  "params": {
    "orderId": "ORD-9821",
    "reason": "Customer requested cancellation"
  },
  "id": 101
}
```
**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 101,
  "result": {
    "success": true,
    "message": "Order ORD-9821 has been successfully cancelled via JSON-RPC 2.0.",
    "details": {
      "orderId": "ORD-9821",
      "status": "CANCELLED",
      "refundEligible": true,
      "refundAmount": 499.98
    }
  }
}
```

### 3. Server-Sent Events (`/events`)
```http
GET /events HTTP/1.1
Host: localhost:3000
Accept: text/event-stream
```
**Stream Response Format:**
```
id: 1727264400000
event: system_alert
data: {"protocol":"SSE","alert":{"id":"alt-1","level":"warning","title":"Flash Sale","message":"15% off all audio gear!"}}
```

### 4. WebSockets (Socket.io)
- **Room Joining**: `socket.emit('join_order', { orderId: 'ORD-9821', role: 'customer' })`
- **Status Event**: `socket.emit('order_status_update', { orderId: 'ORD-9821', newStatus: 'OUT_FOR_DELIVERY' })`
- **1-on-1 Chat**: `socket.emit('send_message', { orderId: 'ORD-9821', text: 'Where is my order?', sender: 'Alex' })`

---

## 📁 Directory Structure
```
├── package.json
├── test-protocols.js           # Automated end-to-end multi-protocol test suite
├── README.md
├── server/
│   ├── index.js                # Express & Socket.io server initialization
│   ├── data/
│   │   └── store.js            # In-memory store (catalog, orders, chats, alerts)
│   ├── routes/
│   │   ├── rest.js             # REST endpoints (/api/v1/catalog, /api/v1/orders)
│   │   ├── rpc.js              # JSON-RPC 2.0 router (/rpc)
│   │   └── sse.js              # Server-Sent Events stream (/events)
│   └── sockets/
│       └── socketHandler.js    # Socket.io order tracking and 1-on-1 chat
└── public/
    ├── index.html              # Single Page Application UI with dual roles
    ├── style.css               # Stepper styling & inspector theme
    └── app.js                  # Frontend client controller & wire logger
```
