const express = require("express");
const router = express.Router();
const { deleteMessage, getInbox, markAsRead, getUsersData, sendMessage, getConversation, getUserConversations, markConversationAsRead } = require("../controllers/MessagesController");

router.post("/deleteMessage", deleteMessage);
router.post("/getInbox", getInbox);
router.post("/markAsRead", markAsRead);
router.post("/getUsersData", getUsersData);
router.post("/sendMessage", sendMessage);
router.post("/getConversation", getConversation);
router.post("/getUserConversations", getUserConversations);
router.post("/markConversationAsRead", markConversationAsRead);

module.exports = router;
