const express = require("express");
const router = express.Router();
const {
  addToWaitlist,
  createStudent,
  getAllStudent,
  getAllWaitlistStudent,
  getStudentById,
  getStudentNamesWithIds,
  removeFromStudentWaitlist,
  getStudentDashboardStats,
  updateStudentById,
  deleteStudent,
  getParentChildById
} = require("../controllers/StudentController");

router.post("/createStudent", createStudent);
router.post("/deleteStudent", deleteStudent);
router.post("/addToWaitlist", addToWaitlist);
router.post("/removeFromStudentWaitlist", removeFromStudentWaitlist);
router.post("/getAllStudent", getAllStudent);
router.post("/getAllWaitlistStudent", getAllWaitlistStudent);
router.post("/getStudentById", getStudentById);
router.post("/getStudentNamesWithIds", getStudentNamesWithIds);
router.post("/getStudentDashboardStats", getStudentDashboardStats);
router.post("/getStudentDashboardStats", getStudentDashboardStats);
router.post("/updateStudentById", updateStudentById);
router.post("/getParentChildById", getParentChildById);

module.exports = router;
