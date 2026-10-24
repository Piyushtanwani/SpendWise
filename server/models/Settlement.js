const mongoose = require("mongoose");

const settlementSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required"],
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Settlement amount must be greater than 0"],
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rejected"],
      default: "pending",
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

settlementSchema.index({ sender: 1, recipient: 1, status: 1 });

module.exports = mongoose.model("Settlement", settlementSchema);
