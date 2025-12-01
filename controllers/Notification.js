const Notification = require("../models/Notification");

const getUserNotifications = async (req, res) => {
  try {
    console.log("This is Called")
    const { userId, userType, page = 1, limit = 20, unreadOnly = false } = req.body;

    // Find the user's combined notification object
    const notification = await Notification.findOne({
      recipient: userId,
      recipientModel: userType,
      isCombinedNotification: true
    });

    // If no notification object exists, return empty results
    if (!notification) {
      return res.json({
        notifications: [],
        totalPages: 1,
        currentPage: parseInt(page),
        total: 0
      });
    }

    // Get individual notifications from the combined object
    let individualNotifications = notification.notifications || [];

    // Apply unread filter if requested
    if (unreadOnly === 'true' || unreadOnly === true) {
      individualNotifications = individualNotifications.filter(notif => !notif.isRead);
    }

    // Sort by creation date (newest first)
    individualNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination to individual notifications
    const total = individualNotifications.length;
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedNotifications = individualNotifications.slice(startIndex, endIndex);

    // Format the response to match your frontend expectations
    const formattedNotifications = paginatedNotifications.map(notif => ({
      _id: notif._id,
      id: notif._id,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      status: notif.isRead ? 'read' : 'unread',
      isRead: notif.isRead,
      createdAt: notif.createdAt,
      date: notif.createdAt,
      occurred: notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : '',
      actionUrl: notif.actionUrl,
      priority: notif.priority,
      relatedEntity: notif.relatedEntity
    }));

    res.json({
      notifications: formattedNotifications,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({ error: "notificationId is required" });
    }

    // Find the parent notification that contains this item
    const parentNotification = await Notification.findOne({
      'notifications._id': notificationId
    });

    if (!parentNotification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Find and update the specific notification item
    const notificationItem = parentNotification.notifications.id(notificationId);
    if (!notificationItem) {
      return res.status(404).json({ error: "Notification item not found" });
    }

    // Mark the individual item as read
    notificationItem.isRead = true;

    // Recalculate the overall unread count
    parentNotification.unreadCount = parentNotification.notifications.filter(
      item => !item.isRead
    ).length;

    // If all items are read, mark the main notification as read
    if (parentNotification.unreadCount === 0) {
      parentNotification.isRead = true;
    }

    await parentNotification.save();

    // Return the updated notification item in the expected format
    res.json({
      _id: notificationItem._id,
      id: notificationItem._id,
      title: notificationItem.title,
      message: notificationItem.message,
      type: notificationItem.type,
      status: 'read',
      isRead: true,
      createdAt: notificationItem.createdAt,
      date: notificationItem.createdAt,
      occurred: notificationItem.createdAt ? new Date(notificationItem.createdAt).toLocaleDateString() : '',
      actionUrl: notificationItem.actionUrl,
      priority: notificationItem.priority,
      relatedEntity: notificationItem.relatedEntity
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: error.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const { userId, userType } = req.body;

    if (!userId || !userType) {
      return res.status(400).json({ error: "userId and userType are required" });
    }

    // Find the user's combined notification object
    const notification = await Notification.findOne({
      recipient: userId,
      recipientModel: userType,
      isCombinedNotification: true
    });

    if (!notification) {
      return res.json({ message: "No notifications found" });
    }

    // Mark all individual notifications as read
    notification.notifications.forEach(item => {
      item.isRead = true;
    });

    // Update the main notification object
    notification.unreadCount = 0;
    notification.isRead = true;
    notification.message = "0 unread notifications";

    await notification.save();

    res.json({ 
      message: "All notifications marked as read",
      unreadCount: 0
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ error: error.message });
  }
};

const getNotificationStats = async (req, res) => {
  try {
    const { userId, userType } = req.body;

    if (!userId || !userType) {
      return res.status(400).json({ error: "userId and userType are required" });
    }

    // Find the user's combined notification object
    const notification = await Notification.findOne({
      recipient: userId,
      recipientModel: userType,
      isCombinedNotification: true
    });

    if (!notification) {
      return res.json({
        unreadCount: 0,
        totalCount: 0
      });
    }

    const totalCount = notification.notifications.length;
    const unreadCount = notification.notifications.filter(item => !item.isRead).length;

    res.json({
      unreadCount,
      totalCount
    });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  getUserNotifications, 
  markAsRead, 
  markAllAsRead,
  getNotificationStats 
};