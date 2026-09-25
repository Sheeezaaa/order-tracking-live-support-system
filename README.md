# 📦 Order Tracking & Live Support System
### Multi-Protocol Real-Time Architecture 

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

## 🔌 API & Protocol 
### 1. REST API
#### Fetch Catalog
```http
GET /api/v1/catalog HTTP/1.1
Host: localhost:3000
```
#### Create Order


### 2. JSON-RPC 2.0 (`/rpc`)
#### Cancel Order

### 3. Server-Sent Events (`/events`)
```http
GET /events HTTP/1.1
Host: localhost:3000
Accept: text/event-stream
```
**Stream Response Format:**

### 4. WebSockets (Socket.io)
- **Room Joining**: `socket.emit('join_order', { orderId: 'ORD-9821', role: 'customer' })`
- **Status Event**: `socket.emit('order_status_update', { orderId: 'ORD-9821', newStatus: 'OUT_FOR_DELIVERY' })`
- **1-on-1 Chat**: `socket.emit('send_message', { orderId: 'ORD-9821', text: 'Where is my order?', sender: 'Alex' })`

<img width="1910" height="1577" alt="screencapture-localhost-3000-api-v1-orders-2026-09-25-04_50_20" src="https://github.com/user-attachments/assets/e5c1ef5b-1a9f-4e62-b8cb-fd723c09bedd" />

<img width="1910" height="1046" alt="screencapture-localhost-3000-api-v1-catalog-2026-09-25-04_50_49" src="https://github.com/user-attachments/assets/c43dd7ef-bb5b-4afc-8769-f10f1592ef0f" />

<img width="1910" height="2477" alt="screencapture-localhost-3000-2026-09-25-05_51_49" src="https://github.com/user-attachments/assets/4caa5ee6-ccd2-4998-9a28-b8bd49b7812f" />

<img width="1910" height="2477" alt="screencapture-localhost-3000-2026-09-25-05_52_13" src="https://github.com/user-attachments/assets/2411c791-2b35-4795-b320-7f16770a9152" />

<img width="1915" height="418" alt="Screenshot 2026-09-25 065913" src="https://github.com/user-attachments/assets/77930b45-1da1-4ea5-9dca-424b996dbbe7" />





---

