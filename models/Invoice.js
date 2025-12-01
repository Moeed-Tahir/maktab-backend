const mongoose = require("mongoose");

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
});

const invoiceSchema = new mongoose.Schema({
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  invoiceNumber: { type: String, required: true, unique: true },
  items: [lineItemSchema],
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  status: { type: String, enum: ["pending", "paid", "overdue"], default: "pending" },
  paymentMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent.cardDetail.paymentMethods",
  },
  stripePaymentIntentId: { type: String },
  dueDate: { type: Date },
  paidAt: { type: Date },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);
