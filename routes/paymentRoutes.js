const express = require("express");
const router = express.Router();
const { getAllPaymentStats } = require("../controllers/PaymentController");

router.post("/getAllPaymentStats", getAllPaymentStats);

module.exports = router;
