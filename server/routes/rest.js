// server/routes/rest.js
// RESTful API endpoints for Resource Management (Catalog & Orders)

const express = require('express');
const router = express.Router();
const store = require('../data/store');

/**
 * @route   GET /api/v1/catalog
 * @desc    Retrieve product catalog
 */
router.get('/catalog', (req, res) => {
  const catalog = store.getCatalog();
  res.json({
    protocol: "REST",
    status: "success",
    count: catalog.length,
    data: catalog
  });
});

/**
 * @route   GET /api/v1/catalog/:id
 * @desc    Retrieve product details by ID
 */
router.get('/catalog/:id', (req, res) => {
  const product = store.getProductById(req.params.id);
  if (!product) {
    return res.status(404).json({
      protocol: "REST",
      status: "error",
      message: `Product with ID '${req.params.id}' not found.`
    });
  }
  res.json({
    protocol: "REST",
    status: "success",
    data: product
  });
});

/**
 * @route   GET /api/v1/orders
 * @desc    Retrieve all orders (optional ?status= filter)
 */
router.get('/orders', (req, res) => {
  let orders = store.getOrders();
  const { status, email } = req.query;

  if (status) {
    orders = orders.filter(o => o.status.toUpperCase() === status.toUpperCase());
  }
  if (email) {
    orders = orders.filter(o => o.customerEmail.toLowerCase() === email.toLowerCase());
  }

  res.json({
    protocol: "REST",
    status: "success",
    count: orders.length,
    data: orders
  });
});

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Retrieve single order by ID
 */
router.get('/orders/:id', (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({
      protocol: "REST",
      status: "error",
      message: `Order '${req.params.id}' was not found.`
    });
  }
  res.json({
    protocol: "REST",
    status: "success",
    data: order
  });
});

/**
 * @route   POST /api/v1/orders
 * @desc    Create a new order
 */
router.post('/orders', (req, res) => {
  try {
    const { customerName, customerEmail, items, shippingAddress, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        protocol: "REST",
        status: "error",
        message: "Order must contain at least one item in 'items' array."
      });
    }

    const order = store.createOrder({
      customerName,
      customerEmail,
      items,
      shippingAddress,
      notes
    });

    // Notify connected WebSockets if io instance is attached
    const io = req.app.get('io');
    if (io) {
      io.emit('order_created', {
        protocol: "WebSockets",
        event: "order_created",
        order
      });
    }

    res.status(201).json({
      protocol: "REST",
      status: "success",
      message: "Order successfully created.",
      data: order
    });
  } catch (err) {
    res.status(400).json({
      protocol: "REST",
      status: "error",
      message: err.message
    });
  }
});

/**
 * @route   GET /api/v1/orders/:id/messages
 * @desc    Get order chat message history
 */
router.get('/orders/:id/messages', (req, res) => {
  const messages = store.getMessages(req.params.id);
  res.json({
    protocol: "REST",
    status: "success",
    orderId: req.params.id,
    count: messages.length,
    data: messages
  });
});

module.exports = router;
