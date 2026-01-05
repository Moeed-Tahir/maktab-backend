const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: [true, "Password is required"],
    },
    role: {
        type: String,
        enum: ["Teacher", "Student", "Parent", "Super Admin", "Admin","SubAdmin"],
        required: [true, "Role is required"],
    },
    otp: {
        type: String,
        default: null
    },
    otpExpiresAt: {
        type: Date,
        default: null
    },
    otpAttempts: {
        type: Number,
        default: 0,
        max: 5
    },
    lastOtpSentAt: {
        type: Date,
        default: null
    },
    isOtpVerified: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);