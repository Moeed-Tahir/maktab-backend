const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { sendWelcomeEmail } = require("../services/emailServices");

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

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

userSchema.post("save", async function (doc, next) {
    try {
        if (this.isNew) {
            await sendWelcomeEmail({
                email: this.email,
                role: this.role
            });
        }
        next();
    } catch (error) {
        console.error("Failed to send welcome email:", error);
        next();
    }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);