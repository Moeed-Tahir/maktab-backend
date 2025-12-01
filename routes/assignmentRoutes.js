const express = require("express");
const router = express.Router();
const { createAssignment, getAllAssignment, getAssignment, getAssignmentByStudentId,uploadSolution,getAssignmentAgainstTeacher,assignmentCheck,deleteAssignment,updateAssignment,getAssignmentById } = require("../controllers/AssignmentController");

router.post("/createAssignment", createAssignment);
router.post("/getAllAssignment", getAllAssignment);
router.post("/getAssignment", getAssignment);
router.post("/getAssignmentByStudentId", getAssignmentByStudentId);
router.post("/uploadSolution", uploadSolution);
router.post("/getAssignmentAgainstTeacher", getAssignmentAgainstTeacher);
router.post("/deleteAssignment", deleteAssignment);
router.post("/updateAssignment", updateAssignment);
router.post("/getAssignmentById", getAssignmentById);

module.exports = router;
