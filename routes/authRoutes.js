const express = require("express");
const router = express.Router();
const { login, register,forgotPassword,resendOTP,resetPassword,verifyOTP } = require("../controllers/AuthControllers");

router.post("/login", login);
router.post("/register", register);
router.post("/forgot-password", forgotPassword);
router.post("/resend-otp", resendOTP);
router.post("/reset-password", resetPassword);
router.post("/verify-otp", verifyOTP);
module.exports = router;
