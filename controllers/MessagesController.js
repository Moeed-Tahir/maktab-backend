const Message = require("../models/Messages");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const Admin = require("../models/Admin");
const User = require("../models/User");
const NotificationService = require("../services/NotificationServices");

// const sendMessage = async (req, res) => {
//   try {
//     const {
//       sender,
//       senderModel,
//       receiver,
//       receiverModel,
//       subject,
//       message,
//       attachments,
//     } = req.body;

//     if (!sender || !senderModel || !receiver || !receiverModel || !message) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const validModels = ["Admin", "Teacher", "Student", "Parent", "User","SubAdmin"];
//     if (
//       !validModels.includes(senderModel) ||
//       !validModels.includes(receiverModel)
//     ) {
//       return res
//         .status(400)
//         .json({ message: "Invalid sender or receiver model" });
//     }

//     const newMessage = await Message.create({
//       sender,
//       senderModel,
//       receiver,
//       receiverModel,
//       subject,
//       message,
//       attachments,
//     });

//     let populatedMessage;

//     if (senderModel === "User" || receiverModel === "User") {
//       populatedMessage = await Message.findById(newMessage._id);

//       if (senderModel === "User") {
//         const senderUser = await User.findById(sender).select("email role");
//         populatedMessage.sender = {
//           _id: senderUser._id,
//           email: senderUser.email,
//           role: senderUser.role,
//           name: senderUser.role,
//         };
//       } else {
//         populatedMessage.sender = await getModelById(senderModel, sender);
//       }

//       if (receiverModel === "User") {
//         const receiverUser = await User.findById(receiver).select("email role");
//         populatedMessage.receiver = {
//           _id: receiverUser._id,
//           email: receiverUser.email,
//           role: receiverUser.role,
//           name: receiverUser.role,
//         };
//       } else {
//         populatedMessage.receiver = await getModelById(receiverModel, receiver);
//       }
//     } else {
//       populatedMessage = await Message.findById(newMessage._id)
//         .populate("sender", "fullName name email")
//         .populate("receiver", "fullName name email");
//     }

//     let senderName = "User";
//     if (populatedMessage.sender) {
//       senderName =
//         populatedMessage.sender.name ||
//         populatedMessage.sender.fullName ||
//         populatedMessage.sender.studentName ||
//         populatedMessage.sender.role ||
//         "User";
//     }

//     try {
//       await NotificationService.addToCombinedNotification(
//         receiver,
//         receiverModel,
//         {
//           title: "New Message Received",
//           message: `From ${senderName}: ${
//             subject || message.substring(0, 100)
//           }${message.length > 100 ? "..." : ""}`,
//           type: "message",
//           relatedEntity: {
//             entityType: "Message",
//             entityId: newMessage._id,
//             sender: sender,
//             senderModel: senderModel,
//           },
//           actionUrl: `/messages/conversation?sender=${sender}&senderModel=${senderModel}&receiver=${receiver}&receiverModel=${receiverModel}`,
//           priority: "high",
//         }
//       );
//       console.log(`✓ Notification sent to ${receiverModel} ${receiver}`);
//     } catch (notificationError) {
//       console.error("✗ Failed to send notification:", notificationError);
//     }

//     res.status(201).json({
//       message: "Message sent successfully",
//       data: populatedMessage,
//     });
//   } catch (error) {
//     console.error("Send Message Error:", error);
//     res.status(500).json({
//       message: "Server error while sending message",
//       error: error.message,
//     });
//   }
// };

const sendMessage = async (req, res) => {
  try {
    const {
      sender,
      senderModel,
      receiver,
      receiverModel,
      subject,
      message,
      attachments,
    } = req.body;

    // 1️⃣ Validate required fields
    if (!sender || !senderModel || !receiver || !receiverModel || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 2️⃣ Validate models
    const validModels = [
      "Admin",
      "Teacher",
      "Student",
      "Parent",
      "User",
      "SubAdmin",
    ];
    if (
      !validModels.includes(senderModel) ||
      !validModels.includes(receiverModel)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid sender or receiver model" });
    }

    // 3️⃣ Create the message
    const newMessage = await Message.create({
      sender,
      senderModel,
      receiver,
      receiverModel,
      subject,
      message,
      attachments,
    });

    // Helper function to get model details
    const getEntityDetails = async (model, id) => {
      if (model === "User") {
        const user = await User.findById(id).select("email role");
        return {
          _id: user._id,
          email: user.email,
          role: user.role,
          name: user.role,
        };
      }
      if (model === "SubAdmin") {
        // Find subAdmin inside parent Admin
        const parentAdmin = await Admin.findOne(
          { "subAdmins._id": id },
          { "subAdmins.$": 1 }
        );
        if (parentAdmin) {
          const sub = parentAdmin.subAdmins[0];
          return {
            _id: sub._id,
            name: sub.name,
            email: sub.email,
            role: "SubAdmin",
          };
        }
        return null;
      }
      // Other models
      return getModelById(model, id);
    };

    // 4️⃣ Populate sender and receiver
    const populatedMessage = await Message.findById(newMessage._id);
    populatedMessage.sender = await getEntityDetails(senderModel, sender);
    populatedMessage.receiver = await getEntityDetails(receiverModel, receiver);

    // 5️⃣ Determine sender name for notification
    const senderName =
      populatedMessage.sender?.name ||
      populatedMessage.sender?.fullName ||
      populatedMessage.sender?.studentName ||
      populatedMessage.sender?.role ||
      "User";

    // 6️⃣ Send notification
    try {
      await NotificationService.addToCombinedNotification(
        receiver,
        receiverModel,
        {
          title: "New Message Received",
          message: `From ${senderName}: ${
            subject || message.substring(0, 100)
          }${message.length > 100 ? "..." : ""}`,
          type: "message",
          relatedEntity: {
            entityType: "Message",
            entityId: newMessage._id,
            sender,
            senderModel,
          },
          actionUrl: `/messages/conversation?sender=${sender}&senderModel=${senderModel}&receiver=${receiver}&receiverModel=${receiverModel}`,
          priority: "high",
        }
      );
      console.log(`✓ Notification sent to ${receiverModel} ${receiver}`);
    } catch (notificationError) {
      console.error("✗ Failed to send notification:", notificationError);
    }

    // 7️⃣ Respond with populated message
    res.status(201).json({
      message: "Message sent successfully",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    res.status(500).json({
      message: "Server error while sending message",
      error: error.message,
    });
  }
};

const getModelById = async (modelType, id) => {
  switch (modelType) {
    case "Admin":
      return await Admin.findById(id).select("name email");
    case "Teacher":
      return await Teacher.findById(id).select("fullName email");
    case "Parent":
      return await Parent.findById(id).select("fullName email");
    case "Student":
      return await Student.findById(id).select("studentName email");
    case "User":
      const user = await User.findById(id).select("email role");
      return {
        _id: user._id,
        email: user.email,
        role: user.role,
        name: user.role,
      };
    default:
      return null;
  }
};

const populateMessages = async (messages) => {
  return await Promise.all(
    messages.map(async (message) => {
      const populatedMessage = message.toObject();

      if (message.senderModel === "User") {
        const senderUser = await User.findById(message.sender).select(
          "email role"
        );
        populatedMessage.sender = {
          _id: senderUser._id,
          email: senderUser.email,
          role: senderUser.role,
          name: senderUser.role,
        };
      }

      if (message.receiverModel === "User") {
        const receiverUser = await User.findById(message.receiver).select(
          "email role"
        );
        populatedMessage.receiver = {
          _id: receiverUser._id,
          email: receiverUser.email,
          role: receiverUser.role,
          name: receiverUser.role,
        };
      }

      return populatedMessage;
    })
  );
};

const getInbox = async (req, res) => {
  try {
    const { userId, userModel } = req.body;

    const messages = await Message.find({
      $or: [
        { receiver: userId, receiverModel: userModel },
        { sender: userId, senderModel: userModel },
      ],
    }).sort({ createdAt: -1 });

    const populatedMessages = await populateMessages(messages);

    res.status(200).json({ data: populatedMessages });
  } catch (error) {
    console.error("Get Inbox Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getConversation = async (req, res) => {
  try {
    const { user1Id, user1Model, user2Id, user2Model } = req.body;

    if (!user1Id || !user1Model || !user2Id || !user2Model) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const messages = await Message.find({
      $or: [
        {
          sender: user1Id,
          senderModel: user1Model,
          receiver: user2Id,
          receiverModel: user2Model,
        },
        {
          sender: user2Id,
          senderModel: user2Model,
          receiver: user1Id,
          receiverModel: user1Model,
        },
      ],
    }).sort({ createdAt: 1 });

    const populatedMessages = await populateMessages(messages);

    res.status(200).json({
      message: "Conversation retrieved successfully",
      data: populatedMessages,
      participants: {
        user1: { id: user1Id, model: user1Model },
        user2: { id: user2Id, model: user2Model },
      },
    });
  } catch (error) {
    console.error("Get Conversation Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getUserConversations = async (req, res) => {
  try {
    const { userId, userModel } = req.body;

    if (!userId || !userModel) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const allMessages = await Message.find({
      $or: [
        { sender: userId, senderModel: userModel },
        { receiver: userId, receiverModel: userModel },
      ],
    }).sort({ createdAt: -1 });

    const populatedMessages = await populateMessages(allMessages);

    const conversationsMap = new Map();

    populatedMessages.forEach((message) => {
      let participantId, participantModel, participantName;

      if (
        message.sender._id.toString() === userId &&
        message.senderModel === userModel
      ) {
        participantId = message.receiver._id.toString();
        participantModel = message.receiverModel;
        participantName =
          message.receiver.name ||
          message.receiver.role ||
          message.receiver.fullName ||
          `${message.receiverModel} User`;
      } else {
        participantId = message.sender._id.toString();
        participantModel = message.senderModel;
        participantName =
          message.sender.name ||
          message.sender.role ||
          message.sender.fullName ||
          `${message.senderModel} User`;
      }

      const participantKey = `${participantId}-${participantModel}`;

      if (!conversationsMap.has(participantKey)) {
        conversationsMap.set(participantKey, {
          participantId,
          participantModel,
          participantName,
          lastMessage: message.message,
          lastMessageTime: message.createdAt,
          unreadCount: 0,
          messages: [],
        });
      }

      const conversation = conversationsMap.get(participantKey);
      conversation.messages.push(message);

      if (message.receiver._id.toString() === userId && !message.isRead) {
        conversation.unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.status(200).json({
      message: "Conversations retrieved successfully",
      data: conversations,
    });
  } catch (error) {
    console.error("Get User Conversations Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.body;

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { isRead: true },
      { new: true }
    );

    if (!updatedMessage)
      return res.status(404).json({ message: "Message not found" });

    // Manually populate the updated message
    const populatedMessage = await populateMessages([updatedMessage]);

    res
      .status(200)
      .json({ message: "Message marked as read", data: populatedMessage[0] });
  } catch (error) {
    console.error("Mark As Read Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const markConversationAsRead = async (req, res) => {
  try {
    const { userId, userModel, participantId, participantModel } = req.body;

    if (!userId || !userModel || !participantId || !participantModel) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await Message.updateMany(
      {
        sender: participantId,
        senderModel: participantModel,
        receiver: userId,
        receiverModel: userModel,
        isRead: false,
      },
      { isRead: true }
    );

    res.status(200).json({
      message: "Conversation marked as read",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("Mark Conversation As Read Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.body;

    const deletedMessage = await Message.findByIdAndUpdate(
      messageId,
      { status: "deleted" },
      { new: true }
    );

    if (!deletedMessage)
      return res.status(404).json({ message: "Message not found" });

    res.status(200).json({ message: "Message deleted", data: deletedMessage });
  } catch (error) {
    console.error("Delete Message Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getUsersData = async (req, res) => {
  try {
    const { role, id } = req.body;
    console.log("role", role, "adminId", id);

    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    if (!id) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    let users = [];

    switch (role.toLowerCase()) {
      case "teacher":
        const teacherAdminExists = await Admin.findById(id);
        if (!teacherAdminExists) {
          return res.status(404).json({ message: "Admin not found" });
        }

        users = await Teacher.find({ createdBy: id }).select(
          "fullName email phone status"
        );

        if (users.length > 0) {
          users = await Promise.all(
            users.map(async (teacher) => {
              const students = await Student.find({
                classes: { $in: teacher.assignedClasses },
                createdBy: id,
              }).select("studentName email");

              return {
                ...teacher.toObject(),
                studentCount: students.length,
                assignedStudents: students,
              };
            })
          );
        }
        break;

      case "student":
        const studentAdminExists = await Admin.findById(id);
        if (!studentAdminExists) {
          return res.status(404).json({ message: "Admin not found" });
        }

        users = await Student.find({ createdBy: id })
          .select("studentName email phone address enrollDate classes parent")
          .populate({
            path: "parent",
            select: "fullName phone email",
          });
        break;

      case "parent":
        const parentAdminExists = await Admin.findById(id);
        if (!parentAdminExists) {
          return res.status(404).json({ message: "Admin not found" });
        }

        users = await Parent.find({ createdBy: id })
          .select("fullName email phone address identityNumber")
          .populate({
            path: "students",
            match: { createdBy: id },
            select: "studentName email phone classes",
            populate: {
              path: "classes",
              select: "name subject",
            },
          });
        break;

      case "admin":
        if (id === "super_admin_all_admins") {
          users = await Admin.find({})
            .select("name email phone address subAdmins createdAt lastLogin")
            .sort({ createdAt: -1 });
        } else {
          const adminExists = await Admin.findById(id);
          if (!adminExists) {
            return res.status(404).json({ message: "Admin not found" });
          }

          const admin = await Admin.findById(id).select(
            "name email phone address subAdmins"
          );
          if (admin) {
            users = [admin];
          } else {
            users = [];
          }
        }
        break;

      case "subadmin":
        const adminWithSubs = await Admin.findById(id);
        if (!adminWithSubs) {
          return res.status(404).json({ message: "Admin not found" });
        }

        users = adminWithSubs.subAdmins.map((sub) => ({
          subAdmin: {
            _id: sub._id,
            name: sub.name,
            email: sub.email,
            phone: sub.phone,
            photo: sub.photo,
            isActive: sub.isActive,
            permissions: sub.permissions,
          },
          parentAdmin: {
            _id: adminWithSubs._id,
            name: adminWithSubs.name,
            email: adminWithSubs.email,
          },
        }));
        break;

      case "superadmin":
        if (id === "get_superadmin") {
          users = await User.find({ role: "Super Admin" }).select(
            "name email role"
          );
          users = users.map((user) => ({
            _id: user._id,
            name: user.name || "Super Admin",
            email: user.email,
            role: user.role,
          }));
        } else {
          const superAdminExists = await User.findById(id);
          if (!superAdminExists) {
            return res.status(404).json({ message: "Super Admin not found" });
          }

          users = await User.find({ role: "Super Admin" }).select(
            "name email role"
          );
          users = users.map((user) => ({
            _id: user._id,
            name: user.name || "Super Admin",
            email: user.email,
            role: user.role,
          }));
        }
        break;

      default:
        return res.status(400).json({ message: "Invalid role provided" });
    }

    if (!users || !Array.isArray(users)) {
      users = [];
    }

    res.status(200).json({
      role,
      adminId: id,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Get Users Data Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  sendMessage,
  getInbox,
  getConversation,
  getUserConversations,
  markAsRead,
  markConversationAsRead,
  deleteMessage,
  getUsersData,
};
