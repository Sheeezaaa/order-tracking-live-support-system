// server/data/store.js
// In-memory data store for Catalog, Orders, Chat Sessions, and System Alerts

const catalog = [
  {
    id: "prod-1",
    name: "Apple MacBook Pro 16\" M3 Max",
    category: "Laptops",
    price: 3499.00,
    stock: 14,
    description: "Liquid Retina XDR display, 36GB Unified Memory, 1TB SSD storage.",
    badge: "Bestseller"
  },
  {
    id: "prod-2",
    name: "Sony WH-1000XM5 Wireless Headphones",
    category: "Audio",
    price: 399.99,
    stock: 35,
    description: "Industry-leading noise canceling with Auto NC Optimizer, 30-hour battery life.",
    badge: "Popular"
  },
  {
    id: "prod-3",
    name: "Dell UltraSharp 32\" 4K USB-C Hub Monitor",
    category: "Peripherals",
    price: 849.50,
    stock: 22,
    description: "IPS Black technology with 2000:1 contrast ratio, 90W power delivery.",
    badge: "Sale"
  },
  {
    id: "prod-4",
    name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
    category: "Accessories",
    price: 199.00,
    stock: 40,
    description: "75% QMK/VIA custom mechanical keyboard with CNC aluminum body.",
    badge: "Staff Pick"
  },
  {
    id: "prod-5",
    name: "Logitech MX Master 3S Ergonomic Mouse",
    category: "Accessories",
    price: 99.99,
    stock: 58,
    description: "Quiet clicks and 8K DPI any-surface tracking with MagSpeed wheel.",
    badge: "Top Rated"
  }
];

// Initial seeded orders
let orders = [
  {
    id: "ORD-9821",
    customerName: "Alex Morgan",
    customerEmail: "alex.morgan@example.com",
    items: [
      { productId: "prod-2", name: "Sony WH-1000XM5 Wireless Headphones", quantity: 1, price: 399.99 },
      { productId: "prod-5", name: "Logitech MX Master 3S Ergonomic Mouse", quantity: 1, price: 99.99 }
    ],
    totalAmount: 499.98,
    status: "CONFIRMED", // PLACED -> CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED (or CANCELLED)
    shippingAddress: "742 Evergreen Terrace, Springfield, OR",
    notes: "Leave at front porch if not answering.",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    history: [
      { status: "PLACED", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), note: "Order placed by customer via REST API" },
      { status: "CONFIRMED", timestamp: new Date(Date.now() - 1800000).toISOString(), note: "Payment verified, order confirmed by fulfillment team" }
    ]
  },
  {
    id: "ORD-4105",
    customerName: "Sarah Connor",
    customerEmail: "s.connor@cyberdyne.org",
    items: [
      { productId: "prod-1", name: "Apple MacBook Pro 16\" M3 Max", quantity: 1, price: 3499.00 }
    ],
    totalAmount: 3499.00,
    status: "PREPARING",
    shippingAddress: "100 Tech Boulevard, Suite 400, Austin, TX",
    notes: "Signature required upon delivery.",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
    history: [
      { status: "PLACED", timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), note: "Order placed by customer via REST API" },
      { status: "CONFIRMED", timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), note: "Order verified" },
      { status: "PREPARING", timestamp: new Date(Date.now() - 900000).toISOString(), note: "Items picked and packed in warehouse" }
    ]
  }
];

// Chat messages keyed by orderId
const chats = {
  "ORD-9821": [
    {
      id: "msg-1",
      orderId: "ORD-9821",
      sender: "Alex Morgan",
      role: "customer",
      text: "Hello! Could you verify when this order will be shipped?",
      timestamp: new Date(Date.now() - 1200000).toISOString()
    },
    {
      id: "msg-2",
      orderId: "ORD-9821",
      sender: "Agent Sarah (Support)",
      role: "agent",
      text: "Hi Alex! Your headphones and mouse are in the staging area. We anticipate dispatch within 2 hours.",
      timestamp: new Date(Date.now() - 900000).toISOString()
    }
  ]
};

// System alerts for SSE stream
let alerts = [
  {
    id: "alt-1",
    level: "info",
    title: "System Online",
    message: "Real-time communication gateway active (REST, Socket.io, JSON-RPC, SSE).",
    timestamp: new Date().toISOString()
  }
];

// Helper methods
const store = {
  // Catalog
  getCatalog: () => [...catalog],
  getProductById: (id) => catalog.find(p => p.id === id),

  // Orders
  getOrders: () => [...orders],
  getOrderById: (id) => orders.find(o => o.id === id),
  
  createOrder: ({ customerName, customerEmail, items, shippingAddress, notes }) => {
    // Generate order ID
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const id = `ORD-${randomNum}`;

    let totalAmount = 0;
    const resolvedItems = [];

    for (const item of items) {
      const prod = catalog.find(p => p.id === item.productId);
      if (!prod) {
        throw new Error(`Product '${item.productId}' not found in catalog.`);
      }
      const qty = parseInt(item.quantity, 10) || 1;
      const price = prod.price;
      totalAmount += price * qty;
      resolvedItems.push({
        productId: prod.id,
        name: prod.name,
        quantity: qty,
        price
      });
    }

    const now = new Date().toISOString();
    const newOrder = {
      id,
      customerName: customerName || "Anonymous Customer",
      customerEmail: customerEmail || "customer@example.com",
      items: resolvedItems,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: "PLACED",
      shippingAddress: shippingAddress || "Default Delivery Address, NY",
      notes: notes || "Standard dispatch",
      createdAt: now,
      updatedAt: now,
      history: [
        { status: "PLACED", timestamp: now, note: "Order placed via REST API" }
      ]
    };

    orders.unshift(newOrder);
    chats[id] = [];
    return newOrder;
  },

  updateOrderStatus: (id, newStatus, note = "") => {
    const order = orders.find(o => o.id === id);
    if (!order) return null;
    
    const validStatuses = ["PLACED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const now = new Date().toISOString();
    order.status = newStatus;
    order.updatedAt = now;
    order.history.push({
      status: newStatus,
      timestamp: now,
      note: note || `Order updated to ${newStatus}`
    });

    return order;
  },

  cancelOrder: (id, reason = "Customer requested cancellation") => {
    const order = orders.find(o => o.id === id);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status === "DELIVERED") {
      return { success: false, error: "Cannot cancel an already delivered order" };
    }

    if (order.status === "CANCELLED") {
      return { success: false, error: "Order is already cancelled" };
    }

    const now = new Date().toISOString();
    order.status = "CANCELLED";
    order.updatedAt = now;
    order.cancellationReason = reason;
    order.history.push({
      status: "CANCELLED",
      timestamp: now,
      note: `Cancelled via JSON-RPC: ${reason}`
    });

    return {
      success: true,
      orderId: order.id,
      status: "CANCELLED",
      refundEligible: true,
      refundAmount: order.totalAmount,
      reason,
      cancelledAt: now
    };
  },

  updateShippingAddress: (id, newAddress) => {
    const order = orders.find(o => o.id === id);
    if (!order) {
      return { success: false, error: "Order not found" };
    }
    if (order.status === "OUT_FOR_DELIVERY" || order.status === "DELIVERED") {
      return { success: false, error: `Cannot change address when order is ${order.status}` };
    }

    const oldAddress = order.shippingAddress;
    order.shippingAddress = newAddress;
    order.updatedAt = new Date().toISOString();
    order.history.push({
      status: order.status,
      timestamp: order.updatedAt,
      note: `Address updated from "${oldAddress}" to "${newAddress}" via JSON-RPC`
    });

    return {
      success: true,
      orderId: order.id,
      newAddress,
      updatedAt: order.updatedAt
    };
  },

  calculateRefund: (id) => {
    const order = orders.find(o => o.id === id);
    if (!order) {
      return { success: false, error: "Order not found" };
    }

    let refundRate = 1.0;
    let restockingFee = 0;

    if (order.status === "PREPARING") {
      restockingFee = 15.00;
    } else if (order.status === "OUT_FOR_DELIVERY") {
      restockingFee = 35.00;
    }

    const refundAmount = Math.max(0, order.totalAmount - restockingFee);
    return {
      success: true,
      orderId: order.id,
      originalAmount: order.totalAmount,
      status: order.status,
      restockingFee,
      estimatedRefundAmount: Math.round(refundAmount * 100) / 100,
      currency: "USD",
      calculatedAt: new Date().toISOString()
    };
  },

  // Chat
  getMessages: (orderId) => {
    if (!chats[orderId]) chats[orderId] = [];
    return chats[orderId];
  },

  addMessage: (orderId, { sender, role, text }) => {
    if (!chats[orderId]) chats[orderId] = [];
    const msg = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId,
      sender: sender || "User",
      role: role || "customer",
      text,
      timestamp: new Date().toISOString()
    };
    chats[orderId].push(msg);
    return msg;
  },

  // Alerts
  getAlerts: () => [...alerts],
  addAlert: ({ level = "info", title, message }) => {
    const newAlert = {
      id: `alt-${Date.now()}`,
      level,
      title: title || "System Broadcast",
      message,
      timestamp: new Date().toISOString()
    };
    alerts.unshift(newAlert);
    if (alerts.length > 30) alerts = alerts.slice(0, 30);
    return newAlert;
  }
};

module.exports = store;
