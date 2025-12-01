const express = require("express");
const router = express.Router();
const { createGrade, getGrades, getGradesByStudentId,getGradeById,updateGradeById } = require("../controllers/GradeController");

router.post("/createGrade", createGrade);
router.post("/getGrades", getGrades);
router.post("/getGradesByStudentId", getGradesByStudentId);
router.post("/getGradeById", getGradeById);
router.post("/updateGradeById", updateGradeById);

module.exports = router;
