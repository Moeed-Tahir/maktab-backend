const express = require("express");
const router = express.Router();
const { getUserNotifications,markAsRead,getNotificationStats,markAllAsRead } = require("../controllers/Notification");

router.post("/getUserNotifications", getUserNotifications);
router.post("/markAsRead", markAsRead);
router.post("/getNotificationStats", getNotificationStats);
router.post("/markAllAsRead", markAllAsRead);

module.exports = router;
