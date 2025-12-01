const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const cron = require("node-cron");
const http = require("http");
const { Server } = require("socket.io");
const { processPendingPayments, processRecurringPayments } = require("./controllers/ParentController");
const Message = require("./models/Messages");

// Import routes
const authRoutes = require("./routes/authRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const classRoutes = require("./routes/classRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const parentRoutes = require("./routes/parentRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const studentRoutes = require("./routes/studentRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const timetableRoutes = require("./routes/timetableRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const gradeRoutes = require("./routes/gradeRoutes");
const messagesRoutes = require("./routes/messagesRoutes");
const eventRoutes = require("./routes/eventRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const { assignmentCheck } = require("./controllers/AssignmentController");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Routes
app.use("/api", authRoutes);
app.use("/api", teacherRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", adminRoutes);
app.use("/api", classRoutes);
app.use("/api", invoiceRoutes);
app.use("/api", parentRoutes);
app.use("/api", paymentRoutes);
app.use("/api", studentRoutes);
app.use("/api", superAdminRoutes);
app.use("/api", timetableRoutes);
app.use("/api", assignmentRoutes);
app.use("/api", gradeRoutes);
app.use("/api", messagesRoutes);
app.use("/api", eventRoutes);
app.use("/api", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Server is running...");
});

cron.schedule("0 0 * * *", () => { 
  console.log("Running invoice payment deduction job...");
  processPendingPayments();
});

cron.schedule("0 0 * * *", () => {
  console.log("Running recurring payment deduction job...");
  processRecurringPayments();
});

cron.schedule("0 0 * * *", () => {
  console.log("Running assignment check job...");
  assignmentCheck();
});



io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room: ${roomId}`);
  });

  socket.on("userConnected", async ({ userId, userModel }) => {
    try {
      const unreadMessages = await Message.find({
        receiver: userId,
        receiverModel: userModel,
        isRead: false,
      }).sort({ createdAt: 1 });

      unreadMessages.forEach((msg) => {
        socket.emit("receiveMessage", msg);
      });
    } catch (err) {
      console.error("Unread Message Error:", err);
    }
  });

  socket.on("sendMessage", async (data) => {
    try {
      const newMessage = await Message.create(data);

      io.to(data.roomId).emit("receiveMessage", newMessage);

    } catch (err) {
      console.error("SendMessage Error:", err);
    }
  });

  socket.on("markAsRead", async ({ messageId }) => {
    try {
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { isRead: true },
        { new: true }
      );

      if (updatedMessage) {
        io.to(updatedMessage.receiver.toString()).emit("messageRead", updatedMessage);
      }
    } catch (err) {
      console.error("MarkAsRead Error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
