const mongoose = require("mongoose");

const contactUsSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,

        },
        email: {
            type: String,
            required: true,
        },
        interest: {
            type: String,
            default: "",
        },
        address: {
            type: String,
            default: "",
        },
        experience: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.models.ContactUs || mongoose.model("ContactUs", contactUsSchema);
