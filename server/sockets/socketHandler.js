// server/sockets/socketHandler.js
// Socket.io handler for Real-time Order Status Updates & 1-on-1 Customer Support Chat

const store = require('../data/store');

module.exports = function configureSockets(io, broadcastSse) {
  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Track rooms this socket has joined
    socket.currentRooms = new Set();

    /**
     * Event: join_order
     * Customer or Agent joins a specific order room for real-time tracking & chat
     */
    socket.on('join_order', ({ orderId, role, username }) => {
      if (!orderId) return;

      const roomName = `order_${orderId}`;
      socket.join(roomName);
      socket.currentRooms.add(roomName);

      const order = store.getOrderById(orderId);
      const messages = store.getMessages(orderId);

      // Acknowledge join to current socket with current state & message history
      socket.emit('joined_order_room', {
        protocol: "WebSockets",
        event: "joined_order_room",
        orderId,
        order,
        messages,
        joinedAs: { username: username || "Guest", role: role || "customer" }
      });

      // Broadcast presence notice to the room
      socket.to(roomName).emit('user_presence', {
        protocol: "WebSockets",
        event: "user_presence",
        orderId,
        user: username || "Guest",
        role: role || "customer",
        action: "joined",
        timestamp: new Date().toISOString()
      });

      console.log(`[WebSocket] ${username || "User"} (${role}) joined ${roomName}`);
    });

    /**
     * Event: order_status_update
     * Support agent changes order status (e.g. PREPARING -> OUT_FOR_DELIVERY)
     */
    socket.on('order_status_update', ({ orderId, newStatus, note, updatedBy }) => {
      try {
        if (!orderId || !newStatus) return;

        const updatedOrder = store.updateOrderStatus(orderId, newStatus, note);
        if (!updatedOrder) {
          socket.emit('error_notification', { message: `Order ${orderId} not found.` });
          return;
        }

        const roomName = `order_${orderId}`;

        // 1. Broadcast to the specific order room (Customer & Assigned Agent)
        io.to(roomName).emit('order_status_updated', {
          protocol: "WebSockets",
          event: "order_status_updated",
          orderId,
          status: newStatus,
          order: updatedOrder,
          updatedBy: updatedBy || "Support Agent",
          timestamp: new Date().toISOString()
        });

        // 2. Broadcast globally to update all admin/agent order boards
        io.emit('global_order_update', {
          protocol: "WebSockets",
          event: "global_order_update",
          orderId,
          status: newStatus,
          updatedOrder
        });

        // 3. If significant status update, trigger an SSE broadcast alert
        if (["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(newStatus) && broadcastSse) {
          broadcastSse('system_alert', {
            protocol: "SSE",
            alert: {
              id: `alt-${Date.now()}`,
              level: newStatus === "DELIVERED" ? "success" : newStatus === "CANCELLED" ? "danger" : "info",
              title: `Order Update #${orderId}`,
              message: `Order ${orderId} marked as ${newStatus.replace(/_/g, ' ')}.`,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (err) {
        socket.emit('error_notification', { message: err.message });
      }
    });

    /**
     * Event: send_message
     * 1-on-1 chat exchange between customer and support agent
     */
    socket.on('send_message', ({ orderId, text, sender, role }) => {
      if (!orderId || !text || !text.trim()) return;

      const roomName = `order_${orderId}`;
      const savedMsg = store.addMessage(orderId, {
        sender: sender || "Anonymous",
        role: role || "customer",
        text: text.trim()
      });

      // Deliver message to everyone in the room (including sender)
      io.to(roomName).emit('receive_message', {
        protocol: "WebSockets",
        event: "receive_message",
        orderId,
        message: savedMsg
      });

      // Clear typing indicator
      socket.to(roomName).emit('user_typing', {
        protocol: "WebSockets",
        orderId,
        username: sender,
        isTyping: false
      });
    });

    /**
     * Event: typing
     * Live typing indicator
     */
    socket.on('typing', ({ orderId, username, isTyping }) => {
      if (!orderId) return;
      socket.to(`order_${orderId}`).emit('user_typing', {
        protocol: "WebSockets",
        event: "user_typing",
        orderId,
        username,
        isTyping: !!isTyping
      });
    });

    /**
     * Event: leave_order
     */
    socket.on('leave_order', ({ orderId, username, role }) => {
      if (!orderId) return;
      const roomName = `order_${orderId}`;
      socket.leave(roomName);
      socket.currentRooms.delete(roomName);

      socket.to(roomName).emit('user_presence', {
        protocol: "WebSockets",
        event: "user_presence",
        orderId,
        user: username || "Guest",
        role: role || "customer",
        action: "left",
        timestamp: new Date().toISOString()
      });
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });
};
