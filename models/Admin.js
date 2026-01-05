const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const PermissionSchema = new mongoose.Schema({
  manageStudents: { type: Boolean, default: false },
  manageParents: { type: Boolean, default: false },
  manageTeachers: { type: Boolean, default: false },
  manageClasses: { type: Boolean, default: false },
});

const subAdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    phone: {
      type: String,
    },

    photo: {
      type: String,
      default: "",
    },

    permissions: {
      type: [PermissionSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    phone: String,
    address: String,
    photo: String,

    websiteSettings: {
      themeColor: {
        type: String,
        default: "#000000",
      },
      secondaryColor: {
        type: String,
        default: "#ffffff",
      },
      logo: {
        type: String,
        default: "",
      },
      favicon: {
        type: String,
        default: "",
      },
      mainText: {
        type: String,
        default: "MaktabOs",
      },
    },

    branch: { type: String, required: true },

    subAdmins: [subAdminSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);