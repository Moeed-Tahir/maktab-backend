const socketIO = require("socket.io");

let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join-user", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on("join-role", (role) => {
      socket.join(`role_${role}`);
      console.log(`User joined role room: ${role}`);
    });

    socket.on("mark-notification-read", async (data) => {
      try {
        const Notification = require("../models/Notification");
        await Notification.findByIdAndUpdate(data.notificationId, { isRead: true });
        socket.emit("notification-read", { success: true });
      } catch (error) {
        socket.emit("notification-error", { error: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};