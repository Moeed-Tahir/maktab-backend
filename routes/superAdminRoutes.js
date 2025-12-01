const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controllers/SuperAdminController");

router.post("/getDashboardStats", getDashboardStats);

module.exports = router;
