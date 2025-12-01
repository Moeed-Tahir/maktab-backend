const express = require("express");
const router = express.Router();
const { createClass, getAllClasses, getAllClassesName, getClassByID, updateClass,deleteClass } = require("../controllers/ClassController");

router.post("/createClass", createClass);
router.post("/getAllClasses", getAllClasses);
router.post("/getAllClassesName", getAllClassesName);
router.post("/getClassByID", getClassByID);
router.post("/updateClass", updateClass);
router.post("/deleteClass", deleteClass);

module.exports = router;
