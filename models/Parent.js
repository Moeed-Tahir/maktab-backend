const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    stripeCustomerId: { type: String },
    defaultPaymentMethodId: { type: String },
    paymentMethods: [
      {
        paymentMethodId: { type: String },
        cardBrand: { type: String },
        last4: { type: String },
        expMonth: { type: Number },
        expYear: { type: Number },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

const recurringPaymentSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    nextPaymentDate: { type: Date },
    frequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly"],
      default: "monthly",
    },
  },
  { _id: false }
);

const parentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    spouse: { type: String },
    spousePhone: { type: String },
    emergencyPhone: { type: String },
    addToWaitList: { type: Boolean, default: false },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, default: "parent" },
    identityNumber: { type: String, required: true, unique: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cardDetail: { type: cardSchema, default: {} },
    recurringPayment: { type: recurringPaymentSchema, default: {} },
    branch: { type: String, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Parent || mongoose.model("Parent", parentSchema);
