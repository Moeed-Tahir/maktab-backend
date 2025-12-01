const express = require("express");
const router = express.Router();
const { createTimetable, getAllTimetables,deleteTimeTable,getTimetableById,updateTimetableById } = require("../controllers/TimeTableController");

router.post("/createTimetable", createTimetable);
router.post("/getAllTimetables", getAllTimetables);
router.post("/deleteTimeTable", deleteTimeTable);
router.post("/getTimetableById", getTimetableById);
router.post("/updateTimetableById", updateTimetableById);

module.exports = router;
