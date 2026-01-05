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

router.post("/createAdmin", createAdmin);
router.post("/getAllSubAdminAgainstAdmin", getAllSubAdminAgainstAdmin);
router.post("/getSubAdminById", getSubAdminById);

router.post("/getAdminById", getAdminById);
router.post("/getAllAdmin", getAllAdmin);
router.post("/updateAdmin", updateAdmin);
router.post("/deleteAdmin", deleteAdmin);
router.post("/createSubAdmin", createSubAdmin);
router.post("/editSubAdminById", editSubAdminById);
router.post("/updateTheme", updateTheme);
router.post("/getAdminDashboardStats", getAdminDashboardStats);
router.post("/getThemeByBranch", getThemeByBranch);

module.exports = router;
