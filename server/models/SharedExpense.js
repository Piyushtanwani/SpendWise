const mongoose = require("mongoose");

const splitParticipantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Participant share cannot be negative"],
    },
  },
  { _id: false }
);

const sharedExpenseSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    splitType: {
      type: String,
      enum: ["equal", "exact"],
      default: "equal",
    },
    splits: {
      type: [splitParticipantSchema],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length >= 2;
        },
        message: "A shared expense must include at least 2 participants",
      },
    },
  },
  { timestamps: true }
);

sharedExpenseSchema.index({ "splits.user": 1, date: -1 });
sharedExpenseSchema.index({ payer: 1, date: -1 });

module.exports = mongoose.model("SharedExpense", sharedExpenseSchema);
