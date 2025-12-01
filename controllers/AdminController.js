const User = require("../models/User");
const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, address, phone, photo } = req.body;

    const existingUser = await User.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });

    if (existingUser || existingAdmin) {
      return res.status(400).json({
        message: "Admin with this email already exists"
      });
    }
    const hashedStudentPassword = await bcrypt.hash(password, 10);

    const newAdmin = await Admin.create({
      name,
      email,
      password:hashedStudentPassword,
      address,
      phone,
      photo,
    });

    const newUser = await User.create({
      email,
      password:hashedStudentPassword,
      role: "Admin",
    });

    return res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const getAllAdmin = async (req, res) => {
  try {
    const admins = await Admin.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Admins fetched successfully",
      admins: admins,
      count: admins.length
    });

  } catch (error) {
    console.error("Error fetching admins:", error);

    return res.status(500).json({
      message: "Failed to fetch admins",
      error: error.message
    });
  }
};

const getAdminById = async (req, res) => {
  try {
    const { id } = req.body;

    const admin = await Admin.findById(id).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found"
      });
    }

    return res.status(200).json({
      message: "Admin fetched successfully",
      admin
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const { id, name, address, phone, photo } = req.body;

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found"
      });
    }

    admin.name = name || admin.name;
    admin.address = address || admin.address;
    admin.phone = phone || admin.phone;
    admin.photo = photo || admin.photo;

    const updatedAdmin = await admin.save();

    return res.status(200).json({
      message: "Admin updated successfully",
      admin: {
        id: updatedAdmin._id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        phone: updatedAdmin.phone,
        address: updatedAdmin.address,
        photo: updatedAdmin.photo
      },
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.body;

    const admin = await Admin.findById(id);
    
    if (!admin) {
      return res.status(404).json({
        message: "Admin not found"
      });
    }

    await Admin.findByIdAndDelete(id);
    await User.findOneAndDelete({ email: admin.email });

    return res.status(200).json({
      message: "Admin deleted successfully",
      deletedAdmin: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      }
    });

  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({
      message: "Failed to delete admin",
      error: error.message
    });
  }
};

module.exports = {
  createAdmin,
  getAllAdmin,
  getAdminById,
  updateAdmin,
  deleteAdmin
};