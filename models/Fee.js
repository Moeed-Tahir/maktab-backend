const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      default: "Tuition Fee Payment",
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    stripeCustomerId: {
      type: String,
    },
    paymentIntentId: {
      type: String,
    },
    paymentMethodId: {
      type: String,
    },
    paymentDate: {
      type: Date,
    },
    receiptUrl: {
      type: String,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Fee || mongoose.model("Fee", feeSchema);
