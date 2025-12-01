const express = require("express");
const router = express.Router();
const { createTeacher, deleteTeacher, getAllTeachers, getTeacherById, getTeacherDetail, getTeachersName, updateTeacher,getTeacherDashboardStat } = require("../controllers/TeacherController");

router.post("/createTeacher", createTeacher);
router.post("/deleteTeacher", deleteTeacher);
router.post("/getAllTeachers", getAllTeachers);
router.post("/getTeacherById", getTeacherById);
router.post("/getTeacherDetail", getTeacherDetail);
router.post("/getTeachersName", getTeachersName);
router.post("/updateTeacher", updateTeacher);
router.post("/getTeacherDashboardStat", getTeacherDashboardStat);

module.exports = router;
