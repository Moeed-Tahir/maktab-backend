const express = require("express");
const router = express.Router();
const { createEvent,deleteEvent,getEventById,getEvents,updateEvent } = require("../controllers/EventControllers");

router.post("/createEvent", createEvent);
router.post("/deleteEvent", deleteEvent);
router.post("/getEventById", getEventById);
router.post("/getEvents", getEvents);
router.post("/updateEvent", updateEvent);

module.exports = router;
