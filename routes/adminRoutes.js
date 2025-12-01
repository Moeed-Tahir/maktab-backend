const express = require("express");
const router = express.Router();
const { getAdminById, getAllAdmin, updateAdmin, createAdmin,deleteAdmin } = require("../controllers/AdminController");

router.post("/createAdmin", createAdmin);
router.post("/getAdminById", getAdminById);
router.post("/getAllAdmin", getAllAdmin);
router.post("/updateAdmin", updateAdmin);
router.post("/deleteAdmin", deleteAdmin);

module.exports = router;
