const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  parent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Parent", 
    required: true 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Student" 
  },
  invoiceNumber: { 
    type: String, 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: "USD" 
  },
  paymentMethod: {
    paymentMethodId: { type: String },
    cardBrand: { type: String },
    last4: { type: String },
    expMonth: { type: Number },
    expYear: { type: Number }
  },
  stripePaymentIntentId: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["succeeded", "failed", "processing"], 
    default: "succeeded" 
  },
  paymentDate: { 
    type: Date, 
    default: Date.now 
  },
  description: { 
    type: String 
  },
  metadata: { 
    type: Object 
  }
}, { timestamps: true });

module.exports = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);