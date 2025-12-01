const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },

    type: {
      type: String,
      enum: ["Assignment"],
      default: "Assignment",
    },

    subject: { type: String, required: true },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student"
    },

    totalMarks: { type: Number, required: true },
    dateAssigned: { type: Date, default: Date.now },
    dueDate: { type: Date },

    attachments: [
      {
        name: { type: String },
        url: { type: String },
        size: { type: Number },
        type: { type: String },
        fileName: { type: String },
      }
    ],

    solutions: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
        file: {
          name: { type: String },
          url: { type: String },
          size: { type: Number },
          type: { type: String },
          fileName: { type: String },
        },
        submittedAt: { type: Date, default: Date.now }
      }
    ]

  },
  { timestamps: true }
);

module.exports = mongoose.model("Assignment", assessmentSchema);