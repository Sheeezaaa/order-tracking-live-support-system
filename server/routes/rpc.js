// server/routes/rpc.js
// JSON-RPC 2.0 Specification Compliant Endpoint (/rpc)

const express = require('express');
const router = express.Router();
const store = require('../data/store');

/**
 * Standard JSON-RPC 2.0 Error Codes
 */
const RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: "Parse error: Invalid JSON was received by the server." },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request: The JSON sent is not a valid Request object." },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found: The method does not exist or is not available." },
  INVALID_PARAMS: { code: -32602, message: "Invalid params: Invalid method parameter(s)." },
  INTERNAL_ERROR: { code: -32603, message: "Internal error: Internal JSON-RPC error." },
  APPLICATION_ERROR: { code: -32000, message: "Application error: Business rule violation." }
};

/**
 * Formats a successful JSON-RPC 2.0 response
 */
function makeSuccessResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id: id !== undefined ? id : null,
    result
  };
}

/**
 * Formats a JSON-RPC 2.0 error response
 */
function makeErrorResponse(id, errorDefinition, customMessage = null, data = null) {
  return {
    jsonrpc: "2.0",
    id: id !== undefined ? id : null,
    error: {
      code: errorDefinition.code,
      message: customMessage || errorDefinition.message,
      ...(data ? { data } : {})
    }
  };
}

/**
 * Method dispatcher for JSON-RPC 2.0
 */
const rpcMethods = {
  // Method: ping
  ping: async (params, req) => {
    return {
      status: "pong",
      serverTime: new Date().toISOString(),
      uptimeSeconds: process.uptime()
    };
  },

  // Method: cancelOrder
  cancelOrder: async (params, req) => {
    if (!params || !params.orderId) {
      throw {
        errorType: RPC_ERRORS.INVALID_PARAMS,
        message: "Parameter 'orderId' is required."
      };
    }

    const { orderId, reason } = params;
    const result = store.cancelOrder(orderId, reason || "Customer request through JSON-RPC");

    if (!result.success) {
      throw {
        errorType: RPC_ERRORS.APPLICATION_ERROR,
        message: result.error
      };
    }

    // Broadcast status change via WebSockets if io is present
    const io = req.app.get('io');
    if (io) {
      const updatedOrder = store.getOrderById(orderId);
      io.to(`order_${orderId}`).emit('order_status_updated', {
        protocol: "WebSockets",
        event: "order_status_updated",
        orderId,
        status: "CANCELLED",
        order: updatedOrder
      });
      io.emit('global_order_update', {
        orderId,
        status: "CANCELLED"
      });
    }

    return {
      success: true,
      message: `Order ${orderId} has been successfully cancelled via JSON-RPC 2.0.`,
      details: result
    };
  },

  // Method: updateShippingAddress
  updateShippingAddress: async (params, req) => {
    if (!params || !params.orderId || !params.newAddress) {
      throw {
        errorType: RPC_ERRORS.INVALID_PARAMS,
        message: "Parameters 'orderId' and 'newAddress' are required."
      };
    }

    const result = store.updateShippingAddress(params.orderId, params.newAddress);
    if (!result.success) {
      throw {
        errorType: RPC_ERRORS.APPLICATION_ERROR,
        message: result.error
      };
    }

    // Broadcast status change via WebSockets
    const io = req.app.get('io');
    if (io) {
      const updatedOrder = store.getOrderById(params.orderId);
      io.to(`order_${params.orderId}`).emit('order_status_updated', {
        protocol: "WebSockets",
        event: "order_status_updated",
        orderId: params.orderId,
        status: updatedOrder.status,
        order: updatedOrder
      });
    }

    return {
      success: true,
      message: `Shipping address for order ${params.orderId} updated.`,
      details: result
    };
  },

  // Method: calculateRefund
  calculateRefund: async (params, req) => {
    if (!params || !params.orderId) {
      throw {
        errorType: RPC_ERRORS.INVALID_PARAMS,
        message: "Parameter 'orderId' is required."
      };
    }

    const result = store.calculateRefund(params.orderId);
    if (!result.success) {
      throw {
        errorType: RPC_ERRORS.APPLICATION_ERROR,
        message: result.error
      };
    }

    return result;
  },

  // Method: getOrderSummary
  getOrderSummary: async (params, req) => {
    if (!params || !params.orderId) {
      throw {
        errorType: RPC_ERRORS.INVALID_PARAMS,
        message: "Parameter 'orderId' is required."
      };
    }

    const order = store.getOrderById(params.orderId);
    if (!order) {
      throw {
        errorType: RPC_ERRORS.APPLICATION_ERROR,
        message: `Order '${params.orderId}' not found.`
      };
    }

    return {
      orderId: order.id,
      customer: order.customerName,
      status: order.status,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt
    };
  }
};

/**
 * Handle a single RPC invocation
 */
async function processRpcCall(body, req) {
  // Validate basic JSON-RPC 2.0 envelope
  if (
    !body ||
    typeof body !== 'object' ||
    body.jsonrpc !== "2.0" ||
    typeof body.method !== 'string'
  ) {
    return makeErrorResponse(body ? body.id : null, RPC_ERRORS.INVALID_REQUEST);
  }

  const { id, method, params } = body;
  const handler = rpcMethods[method];

  if (!handler) {
    return makeErrorResponse(id, RPC_ERRORS.METHOD_NOT_FOUND, `Method '${method}' not found.`);
  }

  try {
    const result = await handler(params, req);
    return makeSuccessResponse(id, result);
  } catch (err) {
    if (err && err.errorType) {
      return makeErrorResponse(id, err.errorType, err.message, err.data);
    }
    return makeErrorResponse(id, RPC_ERRORS.INTERNAL_ERROR, err.message || "Internal error occurred.");
  }
}

/**
 * @route   POST /rpc
 * @desc    JSON-RPC 2.0 single & batch request handler
 */
router.post('/', async (req, res) => {
  const body = req.body;

  // Handle batch requests
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return res.json(makeErrorResponse(null, RPC_ERRORS.INVALID_REQUEST));
    }
    const responses = await Promise.all(body.map(item => processRpcCall(item, req)));
    return res.json(responses);
  }

  // Handle single request
  const response = await processRpcCall(body, req);
  res.json(response);
});

// Handle GET /rpc with descriptive info for browser visitors
router.get('/', (req, res) => {
  res.json({
    protocol: "JSON-RPC 2.0",
    endpoint: "POST /rpc",
    description: "Method-based RPC endpoint. Send POST requests with Content-Type: application/json.",
    sampleRequest: {
      jsonrpc: "2.0",
      method: "cancelOrder",
      params: { orderId: "ORD-9821", reason: "Customer request" },
      id: 1
    },
    availableMethods: [
      "ping",
      "cancelOrder",
      "updateShippingAddress",
      "calculateRefund",
      "getOrderSummary"
    ],
    webUi: "http://localhost:3000"
  });
});

module.exports = router;
