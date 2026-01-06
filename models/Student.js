const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true, trim: true },
    phone: { type: String },
    address: { type: String, required: true },
    addToWaitList: { type: Boolean, default: false },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    enrollDate: { type: Date, default: Date.now },
    fee: { type: Number, default: 0 },
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Parent" },
    role: { type: String, default: "student" },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    branch: { type: String, required: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Student || mongoose.model("Student", studentSchema);
