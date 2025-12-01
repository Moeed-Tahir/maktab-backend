const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Event name is required"],
      trim: true,
      maxlength: [100, "Event name cannot exceed 100 characters"]
    },
    location: {
      type: String,
      required: [true, "Event location is required"],
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"]
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
      validate: {
        validator: function(value) {
          return value >= new Date().setHours(0, 0, 0, 0);
        },
        message: "Event date cannot be in the past"
      }
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time format (HH:MM)"]
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Please enter a valid time format (HH:MM)"],
      validate: {
        validator: function(value) {
          if (!this.startTime) return true;
          return value > this.startTime;
        },
        message: "End time must be after start time"
      }
    },
    organizer: {
      type: String,
      required: [true, "Organizer name is required"],
      trim: true,
      maxlength: [100, "Organizer name cannot exceed 100 characters"]
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"]
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    status: {
      type: String,
      enum: ["Upcoming", "Ongoing", "Completed", "Cancelled"],
      default: "Upcoming"
    }
  },
  { 
    timestamps: true 
  }
);

module.exports = mongoose.models.Event || mongoose.model("Event", eventSchema);