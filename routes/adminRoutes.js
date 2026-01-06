const express = require("express");
const router = express.Router();
const {
  getAdminById,
  getAllAdmin,
  updateAdmin,
  createAdmin,
  getSubAdminById,
  deleteAdmin,
  createSubAdmin,
  getAllSubAdminAgainstAdmin,
  editSubAdminById,
  updateTheme,
  getAdminDashboardStats,
  getThemeByBranch
} = require("../controllers/AdminController");
const { uploadThemeFiles } = require("../utils/upload");
const { authenticate, authorizeAdmin } = require("../middleware/auth");

router.post("/createAdmin", createAdmin);
router.post("/getAllSubAdminAgainstAdmin", getAllSubAdminAgainstAdmin);
router.post("/getSubAdminById", getSubAdminById);

router.post("/getAdminById", getAdminById);
router.post("/getAllAdmin", getAllAdmin);
router.post("/updateAdmin", updateAdmin);
router.post("/deleteAdmin", deleteAdmin);
router.post("/createSubAdmin", createSubAdmin);
router.post("/editSubAdminById", editSubAdminById);
router.post("/updateTheme", uploadThemeFiles, updateTheme);
router.post("/getAdminDashboardStats", getAdminDashboardStats);

router.post("/getThemeByBranch", authenticate, authorizeAdmin, getThemeByBranch);

module.exports = router;
