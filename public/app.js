// public/app.js
// Full-stack Client Controller demonstrating REST, WebSockets, JSON-RPC 2.0, and SSE

// ============================================================================
// Application State
// ============================================================================
const state = {
  catalog: [],
  selectedProductId: null,
  orders: [],
  currentOrderId: "ORD-9821",
  activeView: "split",
  activeFilter: "ALL",
  logs: [],
  socket: null,
  eventSource: null,
  typingTimeouts: { customer: null, agent: null }
};

// Stepper sequence definition
const STATUS_STEPS = ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"];

// ============================================================================
// Protocol Traffic Inspector Logging Utility
// ============================================================================
function logTraffic(protocol, direction, summary, payload = null) {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
  
  const logEntry = {
    id: `log-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    timeStr,
    protocol, // 'REST', 'WS', 'RPC', 'SSE'
    direction, // 'OUT' -> (request), 'IN' <- (response / push)
    summary,
    payload
  };

  state.logs.unshift(logEntry);
  if (state.logs.length > 100) state.logs.pop();

  renderLogEntry(logEntry);
  document.getElementById('log-count').innerText = `${state.logs.length} frames`;
}

function renderLogEntry(entry) {
  const container = document.getElementById('inspector-console');
  if (!container) return;

  // Filter check
  if (state.activeFilter !== 'ALL' && state.activeFilter !== entry.protocol) {
    return;
  }

  const row = document.createElement('div');
  row.className = `log-row log-${entry.protocol} font-mono animate-fadeIn`;

  const dirBadge = entry.direction === 'OUT' 
    ? '<span class="text-amber-400 font-bold">OUT ➜</span>' 
    : '<span class="text-cyan-400 font-bold">IN  ⬅</span>';

  let protoColor = 'text-slate-400';
  if (entry.protocol === 'REST') protoColor = 'text-emerald-400 font-bold';
  if (entry.protocol === 'WS') protoColor = 'text-amber-400 font-bold';
  if (entry.protocol === 'RPC') protoColor = 'text-blue-400 font-bold';
  if (entry.protocol === 'SSE') protoColor = 'text-purple-400 font-bold';

  const payloadStr = entry.payload ? JSON.stringify(entry.payload) : '';

  row.innerHTML = `
    <span class="text-slate-500 whitespace-nowrap">${entry.timeStr}</span>
    <span class="${protoColor} w-14 shrink-0">[${entry.protocol}]</span>
    <span class="w-12 shrink-0">${dirBadge}</span>
    <span class="text-slate-200 font-medium">${entry.summary}</span>
    ${payloadStr ? `<span class="text-slate-400 truncate max-w-md ml-auto" title='${payloadStr.replace(/'/g, "&apos;")}'>${payloadStr}</span>` : ''}
  `;

  container.insertBefore(row, container.firstChild);
}

function filterLogs(protocol) {
  state.activeFilter = protocol;
  document.querySelectorAll('.protocol-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-proto') === protocol) {
      btn.className = "protocol-filter-btn px-2.5 py-1 rounded font-mono text-[11px] bg-indigo-600 text-white font-bold";
    } else {
      btn.className = "protocol-filter-btn px-2.5 py-1 rounded font-mono text-[11px] bg-slate-800 text-slate-400 hover:text-white";
    }
  });

  const container = document.getElementById('inspector-console');
  container.innerHTML = '';
  const filtered = state.activeFilter === 'ALL' 
    ? state.logs 
    : state.logs.filter(l => l.protocol === state.activeFilter);

  filtered.slice().reverse().forEach(entry => renderLogEntry(entry));
}

function clearInspectorLogs() {
  state.logs = [];
  document.getElementById('inspector-console').innerHTML = '';
  document.getElementById('log-count').innerText = '0 frames';
}

// ============================================================================
// 1. REST PROTOCOL: Catalog & Orders (/api/v1)
// ============================================================================
async function loadCatalog() {
  try {
    logTraffic('REST', 'OUT', 'GET /api/v1/catalog');
    const res = await fetch('/api/v1/catalog');
    const data = await res.json();
    logTraffic('REST', 'IN', `GET /api/v1/catalog (200 OK) - ${data.count} items`, data);

    if (data.status === 'success') {
      state.catalog = data.data;
      renderCatalog(data.data);
      if (data.data.length > 0 && !state.selectedProductId) {
        selectProduct(data.data[0].id);
      }
    }
  } catch (err) {
    logTraffic('REST', 'IN', 'GET /api/v1/catalog Error', { error: err.message });
    console.error("Failed to load catalog:", err);
  }
}

function renderCatalog(items) {
  const container = document.getElementById('catalog-list');
  container.innerHTML = items.map(item => `
    <div id="catalog-card-${item.id}" onclick="selectProduct('${item.id}')" class="catalog-item-card cursor-pointer p-2.5 rounded-lg border transition ${state.selectedProductId === item.id ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">${item.category}</span>
        <span class="text-xs font-bold text-emerald-400 font-mono">$${item.price.toFixed(2)}</span>
      </div>
      <h4 class="text-xs font-semibold text-slate-100 truncate">${item.name}</h4>
      <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">${item.description}</p>
      <div class="mt-1 flex items-center justify-between text-[10px] text-slate-500">
        <span>Stock: ${item.stock} left</span>
        <span class="text-indigo-400 font-medium">${item.badge || ''}</span>
      </div>
    </div>
  `).join('');
}

function selectProduct(id) {
  state.selectedProductId = id;
  const prod = state.catalog.find(p => p.id === id);
  if (prod) {
    document.getElementById('selected-product-summary').innerText = `${prod.name} ($${prod.price.toFixed(2)})`;
  }
  // Update card styling
  document.querySelectorAll('.catalog-item-card').forEach(el => {
    el.classList.remove('border-indigo-500', 'bg-indigo-950/40', 'ring-1', 'ring-indigo-500');
    el.classList.add('border-slate-800', 'bg-slate-950');
  });
  const activeCard = document.getElementById(`catalog-card-${id}`);
  if (activeCard) {
    activeCard.classList.remove('border-slate-800', 'bg-slate-950');
    activeCard.classList.add('border-indigo-500', 'bg-indigo-950/40', 'ring-1', 'ring-indigo-500');
  }
}

async function submitOrderViaRest() {
  if (!state.selectedProductId) {
    alert("Please select a product from the catalog first.");
    return;
  }

  const customerName = document.getElementById('order-customer-name').value.trim();
  const customerEmail = document.getElementById('order-customer-email').value.trim();
  const shippingAddress = document.getElementById('order-shipping-address').value.trim();

  const payload = {
    customerName: customerName || "Customer",
    customerEmail: customerEmail || "customer@example.com",
    shippingAddress: shippingAddress || "456 Innovation Way, San Francisco, CA",
    items: [
      { productId: state.selectedProductId, quantity: 1 }
    ],
    notes: "Priority dispatch requested via REST checkout."
  };

  try {
    logTraffic('REST', 'OUT', 'POST /api/v1/orders', payload);
    const res = await fetch('/api/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    logTraffic('REST', 'IN', `POST /api/v1/orders (${res.status})`, result);

    if (res.ok && result.status === 'success') {
      const newOrder = result.data;
      // Refresh order list and switch tracker to new order
      await refreshOrders();
      onCustomerSelectOrder(newOrder.id);
      
      // Auto-trigger a welcome support message in the 1-on-1 room
      setTimeout(() => {
        if (state.socket) {
          state.socket.emit('send_message', {
            orderId: newOrder.id,
            text: `Order ${newOrder.id} received! Our warehouse is reviewing your items.`,
            sender: "System Bot",
            role: "agent"
          });
        }
      }, 700);
    } else {
      alert(`Error creating order: ${result.message}`);
    }
  } catch (err) {
    logTraffic('REST', 'IN', 'POST /api/v1/orders failed', { error: err.message });
    console.error("Order creation failed:", err);
  }
}

async function refreshOrders() {
  try {
    logTraffic('REST', 'OUT', 'GET /api/v1/orders');
    const res = await fetch('/api/v1/orders');
    const data = await res.json();
    logTraffic('REST', 'IN', `GET /api/v1/orders (200 OK) - ${data.count} orders`, data);

    if (data.status === 'success') {
      state.orders = data.data;
      renderOrderSelectOptions(data.data);
      renderAdminOrdersList(data.data);

      // If active order exists in list, update tracking box
      const current = data.data.find(o => o.id === state.currentOrderId);
      if (current) {
        updateOrderTrackerDisplay(current);
      } else if (data.data.length > 0) {
        onCustomerSelectOrder(data.data[0].id);
      }
    }
  } catch (err) {
    console.error("Failed to load orders:", err);
  }
}

function renderOrderSelectOptions(orders) {
  const select = document.getElementById('customer-order-select');
  select.innerHTML = orders.map(o => `
    <option value="${o.id}" ${o.id === state.currentOrderId ? 'selected' : ''}>
      ${o.id} - ${o.status} ($${o.totalAmount})
    </option>
  `).join('');
}

function renderAdminOrdersList(orders) {
  const container = document.getElementById('admin-orders-list');
  container.innerHTML = orders.map(o => {
    const isCancelled = o.status === 'CANCELLED';
    const isDelivered = o.status === 'DELIVERED';
    const isCurrent = o.id === state.currentOrderId;

    return `
      <div class="p-3 rounded-lg border transition ${isCurrent ? 'border-emerald-500/60 bg-emerald-950/20' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2">
            <span class="font-mono font-bold text-xs text-white">${o.id}</span>
            <span class="text-[11px] text-slate-400">(${o.customerName})</span>
          </div>
          <div class="flex items-center space-x-1.5">
            <span class="font-mono text-xs font-bold px-2 py-0.5 rounded ${
              isCancelled ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              isDelivered ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }">${o.status}</span>
            <button onclick="onAgentSelectOrder('${o.id}')" class="text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200" title="Connect chat & track">
              <i class="fa-solid fa-headset"></i>
            </button>
          </div>
        </div>

        <div class="text-[11px] text-slate-300 mb-2 truncate">
          ${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
        </div>

        <!-- Real-time Status Dispatch Buttons (Socket.io) -->
        ${!isCancelled ? `
          <div class="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-900 text-[10px]">
            <span class="text-slate-500 mr-1 font-mono">WS Dispatch:</span>
            <button onclick="dispatchOrderStatus('${o.id}', 'CONFIRMED')" class="px-2 py-1 rounded bg-slate-800 hover:bg-blue-600 hover:text-white transition ${o.status === 'CONFIRMED' ? 'ring-1 ring-blue-400 text-blue-300' : 'text-slate-300'}">
              Confirm
            </button>
            <button onclick="dispatchOrderStatus('${o.id}', 'PREPARING')" class="px-2 py-1 rounded bg-slate-800 hover:bg-amber-600 hover:text-white transition ${o.status === 'PREPARING' ? 'ring-1 ring-amber-400 text-amber-300' : 'text-slate-300'}">
              Prepare
            </button>
            <button onclick="dispatchOrderStatus('${o.id}', 'OUT_FOR_DELIVERY')" class="px-2 py-1 rounded bg-slate-800 hover:bg-purple-600 hover:text-white transition ${o.status === 'OUT_FOR_DELIVERY' ? 'ring-1 ring-purple-400 text-purple-300' : 'text-slate-300'}">
              Ship
            </button>
            <button onclick="dispatchOrderStatus('${o.id}', 'DELIVERED')" class="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-white transition ${o.status === 'DELIVERED' ? 'ring-1 ring-emerald-400 text-emerald-300' : 'text-slate-300'}">
              Deliver
            </button>
          </div>
        ` : `
          <div class="text-[10px] text-rose-400 italic">
            Order cancelled via JSON-RPC. Status transitions locked.
          </div>
        `}
      </div>
    `;
  }).join('');
}

// ============================================================================
// 2. WEBSOCKETS (Socket.io): Real-Time Status Updates & 1-on-1 Chat Room
// ============================================================================
function initWebSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    document.getElementById('badge-ws-dot').className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
    document.getElementById('badge-ws-status').innerText = "Online";
    logTraffic('WS', 'IN', `Socket.io Connected (id: ${state.socket.id})`);
    
    // Join current order room
    joinOrderRoom(state.currentOrderId);
  });

  state.socket.on('disconnect', () => {
    document.getElementById('badge-ws-dot').className = "w-2 h-2 rounded-full bg-rose-500";
    document.getElementById('badge-ws-status').innerText = "Disconnected";
    logTraffic('WS', 'IN', 'Socket.io Disconnected');
  });

  // Acknowledged join with initial room state
  state.socket.on('joined_order_room', (data) => {
    logTraffic('WS', 'IN', `joined_order_room (#${data.orderId})`, data);
    if (data.order) {
      updateOrderTrackerDisplay(data.order);
    }
    renderChatMessages(data.messages || []);
  });

  // Real-time status update received over WebSocket
  state.socket.on('order_status_updated', (data) => {
    logTraffic('WS', 'IN', `EVENT: order_status_updated [${data.status}]`, data);
    if (data.order && data.orderId === state.currentOrderId) {
      updateOrderTrackerDisplay(data.order);
    }
    // Also notify with a brief highlight toast
    showToastNotification(`Order ${data.orderId} updated to ${data.status} via WebSocket`, 'info');
  });

  // Global order state changed (updates admin dashboard list)
  state.socket.on('global_order_update', (data) => {
    logTraffic('WS', 'IN', `EVENT: global_order_update (#${data.orderId} -> ${data.status})`, data);
    refreshOrdersSilently();
  });

  // Message received in order room
  state.socket.on('receive_message', (data) => {
    logTraffic('WS', 'IN', `EVENT: receive_message [${data.message.sender}]`, data);
    appendChatMessage(data.message);
  });

  // Live typing indicator
  state.socket.on('user_typing', (data) => {
    if (data.orderId === state.currentOrderId) {
      updateTypingIndicator(data.username, data.isTyping);
    }
  });

  // User presence notice
  state.socket.on('user_presence', (data) => {
    logTraffic('WS', 'IN', `EVENT: user_presence (${data.user} ${data.action})`, data);
  });
}

function joinOrderRoom(orderId) {
  if (!state.socket || !orderId) return;
  state.currentOrderId = orderId;
  document.getElementById('chat-room-badge').innerText = `order_${orderId}`;

  logTraffic('WS', 'OUT', `EMIT: join_order (room: order_${orderId})`, {
    orderId,
    role: "customer",
    username: "Alex Morgan"
  });

  state.socket.emit('join_order', {
    orderId,
    role: "customer",
    username: "Alex Morgan"
  });
}

function onCustomerSelectOrder(orderId) {
  state.currentOrderId = orderId;
  const select = document.getElementById('customer-order-select');
  if (select) select.value = orderId;
  joinOrderRoom(orderId);
  const found = state.orders.find(o => o.id === orderId);
  if (found) updateOrderTrackerDisplay(found);
}

function onAgentSelectOrder(orderId) {
  onCustomerSelectOrder(orderId);
  showToastNotification(`Support Agent focused on order ${orderId}`, 'info');
}

function dispatchOrderStatus(orderId, newStatus) {
  if (!state.socket) return;

  logTraffic('WS', 'OUT', `EMIT: order_status_update (${orderId} -> ${newStatus})`, {
    orderId,
    newStatus,
    updatedBy: "Support Agent"
  });

  state.socket.emit('order_status_update', {
    orderId,
    newStatus,
    note: `Dispatched by Support Agent to ${newStatus}`,
    updatedBy: "Support Agent"
  });
}

function updateOrderTrackerDisplay(order) {
  document.getElementById('tracker-order-id').innerText = order.id;
  document.getElementById('tracker-order-date').innerText = new Date(order.createdAt).toLocaleString();
  document.getElementById('tracker-address').innerText = order.shippingAddress;
  document.getElementById('tracker-total').innerText = `$${order.totalAmount.toFixed(2)}`;

  // Status pill
  const pill = document.getElementById('tracker-status-pill');
  pill.innerText = order.status;

  // Items list
  const itemsContainer = document.getElementById('tracker-items-list');
  itemsContainer.innerHTML = order.items.map(i => `
    <div class="flex items-center justify-between text-slate-300">
      <span>• ${i.name} <span class="text-slate-500">(x${i.quantity})</span></span>
      <span class="font-mono text-slate-400">$${(i.price * i.quantity).toFixed(2)}</span>
    </div>
  `).join('');

  // Cancelled handling
  const cancelAlert = document.getElementById('tracker-cancelled-alert');
  if (order.status === 'CANCELLED') {
    cancelAlert.classList.remove('hidden');
    document.getElementById('tracker-cancel-reason').innerText = order.cancellationReason || "Customer requested";
    pill.className = "text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30";
    setStepperState(-1, true);
    return;
  } else {
    cancelAlert.classList.add('hidden');
  }

  // Update Stepper Progress
  const stepIndex = STATUS_STEPS.indexOf(order.status);
  if (stepIndex !== -1) {
    pill.className = "text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30";
    setStepperState(stepIndex, false);
  }
}

function setStepperState(activeIndex, isCancelled = false) {
  const progressBar = document.getElementById('stepper-progress-bar');
  if (isCancelled) {
    progressBar.style.width = '100%';
    progressBar.className = 'h-full bg-rose-600 transition-all duration-500';
  } else {
    const percentage = activeIndex >= 0 ? (activeIndex / (STATUS_STEPS.length - 1)) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    progressBar.className = 'h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500';
  }

  STATUS_STEPS.forEach((stepName, idx) => {
    const node = document.getElementById(`step-node-${stepName}`);
    if (!node) return;
    const icon = node.querySelector('.step-icon');
    const label = node.querySelector('span');

    icon.classList.remove('active', 'completed', 'cancelled');

    if (isCancelled) {
      icon.classList.add('cancelled');
      label.className = "text-[10px] mt-1.5 font-medium text-rose-400";
    } else if (idx < activeIndex) {
      icon.classList.add('completed');
      label.className = "text-[10px] mt-1.5 font-medium text-emerald-400";
    } else if (idx === activeIndex) {
      icon.classList.add('active');
      label.className = "text-[10px] mt-1.5 font-bold text-indigo-300";
    } else {
      icon.className = "step-icon w-8 h-8 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center text-xs shadow-md border-2 border-slate-900 transition-all duration-300";
      label.className = "text-[10px] mt-1.5 font-medium text-slate-500";
    }
  });
}

// Chat functions
function renderChatMessages(messages) {
  const customerBox = document.getElementById('customer-chat-messages');
  const agentBox = document.getElementById('agent-chat-messages');
  customerBox.innerHTML = '';
  agentBox.innerHTML = '';

  messages.forEach(msg => appendChatMessage(msg));
}

function appendChatMessage(msg) {
  const customerBox = document.getElementById('customer-chat-messages');
  const agentBox = document.getElementById('agent-chat-messages');

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isAgent = msg.role === 'agent';

  // Customer View bubble
  const customerBubble = document.createElement('div');
  customerBubble.className = `flex flex-col ${isAgent ? 'items-start' : 'items-end'}`;
  customerBubble.innerHTML = `
    <div class="max-w-[80%] rounded-lg px-3 py-1.5 ${isAgent ? 'bg-slate-800 text-slate-100 border border-slate-700' : 'bg-indigo-600 text-white'} shadow-sm">
      <div class="text-[10px] font-bold opacity-75 mb-0.5 flex items-center gap-1">
        ${isAgent ? '<i class="fa-solid fa-headset text-emerald-400"></i>' : '<i class="fa-solid fa-user"></i>'}
        ${msg.sender}
      </div>
      <div>${escapeHtml(msg.text)}</div>
      <div class="text-[9px] opacity-60 text-right mt-0.5">${time}</div>
    </div>
  `;
  customerBox.appendChild(customerBubble);
  customerBox.scrollTop = customerBox.scrollHeight;

  // Agent View bubble
  const agentBubble = document.createElement('div');
  agentBubble.className = `flex flex-col ${isAgent ? 'items-end' : 'items-start'}`;
  agentBubble.innerHTML = `
    <div class="max-w-[80%] rounded-lg px-3 py-1.5 ${isAgent ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'} shadow-sm">
      <div class="text-[10px] font-bold opacity-75 mb-0.5 flex items-center gap-1">
        ${isAgent ? '<i class="fa-solid fa-headset"></i>' : '<i class="fa-solid fa-user text-indigo-400"></i>'}
        ${msg.sender}
      </div>
      <div>${escapeHtml(msg.text)}</div>
      <div class="text-[9px] opacity-60 text-right mt-0.5">${time}</div>
    </div>
  `;
  agentBox.appendChild(agentBubble);
  agentBox.scrollTop = agentBox.scrollHeight;
}

function handleCustomerSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('customer-chat-input');
  const text = input.value.trim();
  if (!text || !state.socket) return;

  logTraffic('WS', 'OUT', 'EMIT: send_message (role: customer)', {
    orderId: state.currentOrderId,
    text,
    sender: "Alex Morgan"
  });

  state.socket.emit('send_message', {
    orderId: state.currentOrderId,
    text,
    sender: "Alex Morgan",
    role: "customer"
  });

  input.value = '';
}

function handleAgentSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('agent-chat-input');
  const text = input.value.trim();
  if (!text || !state.socket) return;

  logTraffic('WS', 'OUT', 'EMIT: send_message (role: agent)', {
    orderId: state.currentOrderId,
    text,
    sender: "Agent Sarah"
  });

  state.socket.emit('send_message', {
    orderId: state.currentOrderId,
    text,
    sender: "Agent Sarah",
    role: "agent"
  });

  input.value = '';
}

function sendQuickReply(text) {
  if (!state.socket) return;
  state.socket.emit('send_message', {
    orderId: state.currentOrderId,
    text,
    sender: "Agent Sarah",
    role: "agent"
  });
}

function handleTyping(role) {
  if (!state.socket) return;
  const username = role === 'customer' ? "Alex Morgan" : "Agent Sarah";
  state.socket.emit('typing', { orderId: state.currentOrderId, username, isTyping: true });

  clearTimeout(state.typingTimeouts[role]);
  state.typingTimeouts[role] = setTimeout(() => {
    state.socket.emit('typing', { orderId: state.currentOrderId, username, isTyping: false });
  }, 1200);
}

function updateTypingIndicator(username, isTyping) {
  const noticeCust = document.getElementById('customer-typing-notice');
  const noticeAgent = document.getElementById('agent-typing-notice');
  const text = isTyping ? `💬 ${username} is typing...` : '';
  if (noticeCust) noticeCust.innerText = text;
  if (noticeAgent) noticeAgent.innerText = text;
}

// ============================================================================
// 3. JSON-RPC 2.0 PROTOCOL: Method-Based Transactions (/rpc)
// ============================================================================
async function callJsonRpc(method, params = {}) {
  const rpcPayload = {
    jsonrpc: "2.0",
    method,
    params,
    id: `req-${Date.now()}`
  };

  logTraffic('RPC', 'OUT', `POST /rpc [${method}]`, rpcPayload);

  try {
    const res = await fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload)
    });

    const responsePayload = await res.json();
    logTraffic('RPC', 'IN', `POST /rpc Response [${method}]`, responsePayload);

    // Update the on-screen RPC wire preview box
    const preview = document.getElementById('rpc-preview-box');
    const statusTag = document.getElementById('rpc-status-tag');

    if (responsePayload.error) {
      statusTag.className = "text-rose-400 font-bold";
      statusTag.innerText = `ERR ${responsePayload.error.code}`;
      preview.innerText = `REQUEST:\n${JSON.stringify(rpcPayload, null, 2)}\n\nERROR RESPONSE:\n${JSON.stringify(responsePayload, null, 2)}`;
    } else {
      statusTag.className = "text-emerald-400 font-bold";
      statusTag.innerText = "200 OK (RPC 2.0)";
      preview.innerText = `REQUEST:\n${JSON.stringify(rpcPayload, null, 2)}\n\nRESULT RESPONSE:\n${JSON.stringify(responsePayload, null, 2)}`;
    }

    return responsePayload;
  } catch (err) {
    logTraffic('RPC', 'IN', `POST /rpc Error [${method}]`, { error: err.message });
    throw err;
  }
}

async function rpcCancelOrderModal() {
  const reason = prompt(`JSON-RPC 2.0 cancelOrder\nEnter cancellation reason for ${state.currentOrderId}:`, "Customer changed mind");
  if (reason === null) return; // User cancelled prompt

  const res = await callJsonRpc('cancelOrder', {
    orderId: state.currentOrderId,
    reason
  });

  if (res.result && res.result.success) {
    showToastNotification(`Order ${state.currentOrderId} cancelled via JSON-RPC 2.0!`, 'danger');
    await refreshOrders();
  } else if (res.error) {
    alert(`JSON-RPC Error (${res.error.code}): ${res.error.message}`);
  }
}

async function rpcUpdateAddressModal() {
  const newAddress = prompt(`JSON-RPC 2.0 updateShippingAddress\nEnter new address for ${state.currentOrderId}:`, "990 Market Street, Suite 500, San Francisco, CA");
  if (!newAddress) return;

  const res = await callJsonRpc('updateShippingAddress', {
    orderId: state.currentOrderId,
    newAddress
  });

  if (res.result && res.result.success) {
    showToastNotification(`Shipping address updated via JSON-RPC 2.0`, 'success');
    await refreshOrders();
  } else if (res.error) {
    alert(`JSON-RPC Error (${res.error.code}): ${res.error.message}`);
  }
}

async function rpcCalculateRefund() {
  const res = await callJsonRpc('calculateRefund', {
    orderId: state.currentOrderId
  });

  if (res.result && res.result.success) {
    const d = res.result;
    alert(`JSON-RPC Refund Breakdown for ${d.orderId}:\n• Order Total: $${d.originalAmount}\n• Restocking Fee: $${d.restockingFee}\n• Estimated Refund: $${d.estimatedRefundAmount} ${d.currency}`);
  } else if (res.error) {
    alert(`JSON-RPC Error: ${res.error.message}`);
  }
}

// ============================================================================
// 4. SERVER-SENT EVENTS (SSE) PROTOCOL: Live Alerts (/events)
// ============================================================================
function initSseStream() {
  state.eventSource = new EventSource('/events');

  state.eventSource.onopen = () => {
    document.getElementById('badge-sse-dot').className = "w-2 h-2 rounded-full bg-purple-400 animate-pulse";
    document.getElementById('badge-sse-status').innerText = "Streaming";
    logTraffic('SSE', 'IN', 'EventSource Stream Established (GET /events)');
  };

  state.eventSource.onerror = (e) => {
    logTraffic('SSE', 'IN', 'EventSource Reconnecting...');
  };

  // Connected event
  state.eventSource.addEventListener('connected', (event) => {
    const data = JSON.parse(event.data);
    logTraffic('SSE', 'IN', 'EVENT: connected', data);
  });

  // Initial alerts event
  state.eventSource.addEventListener('initial_alerts', (event) => {
    const alerts = JSON.parse(event.data);
    logTraffic('SSE', 'IN', `EVENT: initial_alerts (${alerts.length} loaded)`, alerts);
  });

  // System alert broadcast event
  state.eventSource.addEventListener('system_alert', (event) => {
    const payload = JSON.parse(event.data);
    logTraffic('SSE', 'IN', `EVENT: system_alert [${payload.alert.title}]`, payload);
    displaySseAlertBanner(payload.alert);
  });
}

function displaySseAlertBanner(alert) {
  const banner = document.getElementById('sse-alert-banner');
  const title = document.getElementById('sse-banner-title');
  const text = document.getElementById('sse-banner-text');

  title.innerText = alert.title;
  text.innerText = `— ${alert.message}`;

  // Color schemes based on level
  if (alert.level === 'danger') {
    banner.className = "bg-rose-600 text-white px-4 py-2 text-sm font-medium shadow-md transition-all duration-300";
  } else if (alert.level === 'warning') {
    banner.className = "bg-amber-600 text-white px-4 py-2 text-sm font-medium shadow-md transition-all duration-300";
  } else if (alert.level === 'success') {
    banner.className = "bg-emerald-600 text-white px-4 py-2 text-sm font-medium shadow-md transition-all duration-300";
  } else {
    banner.className = "bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2 text-sm font-medium shadow-md transition-all duration-300";
  }

  banner.classList.remove('hidden');
}

function dismissSseBanner() {
  document.getElementById('sse-alert-banner').classList.add('hidden');
}

async function handleSendSseBroadcast(e) {
  e.preventDefault();
  const title = document.getElementById('sse-broadcast-title').value.trim();
  const level = document.getElementById('sse-broadcast-level').value;
  const message = document.getElementById('sse-broadcast-message').value.trim();

  if (!message) return;

  const payload = { title, message, level };
  logTraffic('REST', 'OUT', 'POST /events/broadcast (Admin SSE Trigger)', payload);

  try {
    const res = await fetch('/events/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    logTraffic('REST', 'IN', 'POST /events/broadcast (200 OK)', result);
    showToastNotification(`SSE Alert dispatched to ${result.recipientsCount} active stream(s)!`, 'success');
  } catch (err) {
    console.error("SSE Broadcast failed:", err);
  }
}

// ============================================================================
// UI View Switcher & Helper Functions
// ============================================================================
function switchView(view) {
  state.activeView = view;
  const container = document.getElementById('views-container');
  const customerPanel = document.getElementById('customer-panel');
  const agentPanel = document.getElementById('agent-panel');

  const btnSplit = document.getElementById('view-btn-split');
  const btnCust = document.getElementById('view-btn-customer');
  const btnAgent = document.getElementById('view-btn-agent');

  // Reset button styles
  [btnSplit, btnCust, btnAgent].forEach(b => {
    b.className = "px-3 py-1.5 rounded-md font-medium transition text-slate-300 hover:text-white";
  });

  if (view === 'split') {
    btnSplit.className = "px-3 py-1.5 rounded-md font-medium transition text-white bg-indigo-600 shadow";
    container.className = "grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-300";
    customerPanel.classList.remove('hidden');
    agentPanel.classList.remove('hidden');
  } else if (view === 'customer') {
    btnCust.className = "px-3 py-1.5 rounded-md font-medium transition text-white bg-indigo-600 shadow";
    container.className = "grid grid-cols-1 gap-6 max-w-3xl mx-auto transition-all duration-300";
    customerPanel.classList.remove('hidden');
    agentPanel.classList.add('hidden');
  } else if (view === 'agent') {
    btnAgent.className = "px-3 py-1.5 rounded-md font-medium transition text-white bg-emerald-600 shadow";
    container.className = "grid grid-cols-1 gap-6 max-w-3xl mx-auto transition-all duration-300";
    customerPanel.classList.add('hidden');
    agentPanel.classList.remove('hidden');
  }
}

async function refreshOrdersSilently() {
  try {
    const res = await fetch('/api/v1/orders');
    const data = await res.json();
    if (data.status === 'success') {
      state.orders = data.data;
      renderAdminOrdersList(data.data);
      renderOrderSelectOptions(data.data);
      const current = data.data.find(o => o.id === state.currentOrderId);
      if (current) updateOrderTrackerDisplay(current);
    }
  } catch (e) {}
}

function showToastNotification(text, type = 'info') {
  const toast = document.createElement('div');
  const bg = type === 'danger' ? 'bg-rose-600' : type === 'success' ? 'bg-emerald-600' : 'bg-indigo-600';
  toast.className = `fixed bottom-4 right-4 ${bg} text-white px-4 py-2.5 rounded-lg shadow-xl text-xs z-50 animate-bounce flex items-center gap-2`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${escapeHtml(text)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

// ============================================================================
// Dynamic Color Theme Controller
// ============================================================================
function changeTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('awt_app_theme', themeName);

  const select = document.getElementById('theme-selector');
  if (select && select.value !== themeName) {
    select.value = themeName;
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('awt_app_theme') || 'cyber-neon';
  changeTheme(savedTheme);
}

// ============================================================================
// Initialization on Page Load
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  logTraffic('REST', 'IN', 'Initializing Order Tracking & Live Support Hub with Theme: ' + (localStorage.getItem('awt_app_theme') || 'cyber-neon'));
  await loadCatalog();
  await refreshOrders();
  initWebSocket();
  initSseStream();
});
