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
        enum: ["Teacher", "Student", "Parent","Super Admin","Admin"],
        required: [true, "Role is required"],
    },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
