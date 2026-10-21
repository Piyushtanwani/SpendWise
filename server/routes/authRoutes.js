const express = require("express");
const router = express.Router();
const {
  register,
  login,
  googleAuth,
  sendOtp,
  verifyOtp,
  resetPasswordWithOtp,
  loginWithOtp,
  getMe,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

// Standard Auth
router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

// Google OAuth
router.post("/google", googleAuth);

// Email OTP Endpoints
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPasswordWithOtp);
router.post("/login-otp", loginWithOtp);

module.exports = router;
