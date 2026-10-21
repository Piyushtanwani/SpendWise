const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: [true, "OTP code is required"],
    },
    purpose: {
      type: String,
      enum: ["reset_password", "verify_email", "login"],
      default: "reset_password",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // Document expires and is automatically removed by MongoDB after 10 minutes (600 seconds)
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("Otp", otpSchema);
