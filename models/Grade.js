const mongoose = require("mongoose");

const gradeSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    marksObtained: {
      type: Number,
      required: true,
    },
    feedback: { type: String },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
    },
    grade: {
      type: String,
      enum: ["A+", "A", "B+", "B", "C", "D", "F"],
    },
    status: {
      type: String,
      enum: ["Pending", "Graded", "Reviewed"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Grade || mongoose.model("Grade", gradeSchema);
