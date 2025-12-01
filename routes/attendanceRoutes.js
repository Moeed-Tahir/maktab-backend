const express = require("express");
const router = express.Router();
const { markAttendance } = require("../controllers/AttendanceController");

router.post("/markAttendance", markAttendance);

module.exports = router;
