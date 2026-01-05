const User = require("../models/User");
const Admin = require("../models/Admin");
const Parent = require("../models/Parent");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payments");

const bcrypt = require("bcryptjs");

const createAdmin = async (req, res) => {
  try {
    const { name, email, password, address, phone, photo, branch } = req.body;

    if (!name || !email || !password || !branch) {
      return res.status(400).json({
        success: false,
        message: "Name, Email, Password and Branch are required",
      });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      address,
      phone,
      photo,
      branch,
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
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
      count: admins.length,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);

    return res.status(500).json({
      message: "Failed to fetch admins",
      error: error.message,
    });
  }
};

const getAdminById = async (req, res) => {
  try {
    const { id } = req.body;

    const admin = await Admin.findById(id).select("-password");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      message: "Admin fetched successfully",
      admin,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const { id, name, address, phone, photo } = req.body;

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
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
        photo: updatedAdmin.photo,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.body;

    const admin = await Admin.findById(id);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    await Admin.findByIdAndDelete(id);
    await User.findOneAndDelete({ email: admin.email });

    return res.status(200).json({
      message: "Admin deleted successfully",
      deletedAdmin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error("Error deleting admin:", error);
    return res.status(500).json({
      message: "Failed to delete admin",
      error: error.message,
    });
  }
};

const createSubAdmin = async (req, res) => {
  try {
    const { adminId, name, email, password, phone, permissions, photo } =
      req.body;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Parent Admin not found" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Sub Admin with this email already exists" });
    }

    const subAdminExists = admin.subAdmins.some((sa) => sa.email === email);
    if (subAdminExists) {
      return res
        .status(400)
        .json({ message: "Sub Admin already exists under this Admin" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    admin.subAdmins.push({
      name,
      email,
      password: hashedPassword,
      phone,
      permissions: [permissions], // <--- important fix
      photo,
    });

    await admin.save();

    await User.create({
      email,
      password: hashedPassword,
      role: "SubAdmin",
    });

    return res.status(201).json({
      message: "Sub Admin created successfully",
      subAdmin: { name, email, phone, permissions, photo },
    });
  } catch (error) {
    console.error("Error creating sub admin:", error);
    return res.status(500).json({
      message: "Failed to create Sub Admin",
      error: error.message,
    });
  }
};

const getAllSubAdminAgainstAdmin = async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message: "Admin ID is required",
      });
    }

    const admin = await Admin.findById(adminId).select("-password").lean();

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const subAdmins = admin.subAdmins || [];

    return res.status(200).json({
      message: "Sub Admins fetched successfully",
      adminId: adminId,
      subAdmins: subAdmins,
      count: subAdmins.length,
    });
  } catch (error) {
    console.error("Error fetching sub admins:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid Admin ID format",
      });
    }

    return res.status(500).json({
      message: "Failed to fetch sub admins",
      error: error.message,
    });
  }
};

const getSubAdminById = async (req, res) => {
  try {
    const { adminId, subAdminId } = req.body;

    if (!adminId || !subAdminId) {
      return res.status(400).json({
        message: "Both adminId and subAdminId are required",
      });
    }

    const admin = await Admin.findById(adminId).select("-password").lean();

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const subAdmin = admin.subAdmins.find(
      (sa) => sa._id.toString() === subAdminId
    );

    if (!subAdmin) {
      return res.status(404).json({
        message: "Sub Admin not found",
      });
    }

    return res.status(200).json({
      message: "Sub Admin fetched successfully",
      adminId: adminId,
      subAdmin: subAdmin,
    });
  } catch (error) {
    console.error("Error fetching sub admin:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ID format",
      });
    }

    return res.status(500).json({
      message: "Failed to fetch sub admin",
      error: error.message,
    });
  }
};

const editSubAdminById = async (req, res) => {
  try {
    const {
      adminId,
      subAdminId,
      name,
      email,
      phone,
      permissions,
      photo,
      password,
    } = req.body;
    console.log("permissions", permissions);

    if (!adminId || !subAdminId) {
      return res.status(400).json({
        message: "Both adminId and subAdminId are required",
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const subAdminIndex = admin.subAdmins.findIndex(
      (sa) => sa._id.toString() === subAdminId
    );

    if (subAdminIndex === -1) {
      return res.status(404).json({
        message: "Sub Admin not found",
      });
    }

    if (email && email !== admin.subAdmins[subAdminIndex].email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
      admin.subAdmins[subAdminIndex].email = email;
    }

    if (name) admin.subAdmins[subAdminIndex].name = name;
    if (phone) admin.subAdmins[subAdminIndex].phone = phone;
    if (permissions && Array.isArray(permissions)) {
      admin.subAdmins[subAdminIndex].permissions = permissions;
    }
    if (photo) admin.subAdmins[subAdminIndex].photo = photo;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      admin.subAdmins[subAdminIndex].password = hashedPassword;

      await User.findOneAndUpdate(
        { email: admin.subAdmins[subAdminIndex].email },
        { password: hashedPassword }
      );
    }

    await admin.save();

    await User.findOneAndUpdate(
      { email: admin.subAdmins[subAdminIndex].email },
      { email, role: "SubAdmin" }
    );

    return res.status(200).json({
      message: "Sub Admin updated successfully",
      subAdmin: admin.subAdmins[subAdminIndex],
    });
  } catch (error) {
    console.error("Error editing sub admin:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ID format",
      });
    }

    return res.status(500).json({
      message: "Failed to edit sub admin",
      error: error.message,
    });
  }
};

const updateTheme = async (req, res) => {
  try {
    const { adminId, themeColor, secondaryColor, logo, favicon, mainText } =
      req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "Admin ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Admin ID format",
      });
    }

    const updateData = {};

    if (themeColor) updateData["websiteSettings.themeColor"] = themeColor;
    if (secondaryColor)
      updateData["websiteSettings.secondaryColor"] = secondaryColor;
    if (logo !== undefined) updateData["websiteSettings.logo"] = logo;
    if (favicon !== undefined) updateData["websiteSettings.favicon"] = favicon;
    if (mainText !== undefined)
      updateData["websiteSettings.mainText"] = mainText;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No website settings provided for update",
      });
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { $set: updateData },
      {
        new: true,
        runValidators: true,
      }
    ).select("websiteSettings name email _id");

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Website settings updated successfully",
      data: {
        adminId: updatedAdmin._id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        websiteSettings: updatedAdmin.websiteSettings,
      },
    });
  } catch (error) {
    console.error("Error updating website settings:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getAdminDashboardStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: "adminId is required",
      });
    }

    const parsedYear = parseInt(year);

    /* -------------------- BASIC COUNTS (ADMIN SCOPED) -------------------- */

    const totalParents = await Parent.countDocuments({ createdBy: adminId });
    const totalStudents = await Student.countDocuments({ createdBy: adminId });
    const totalTeachers = await Teacher.countDocuments({ createdBy: adminId });
    const totalInvoices = await Invoice.countDocuments({ createdBy: adminId });

    /* -------------------- ADMIN PARENTS IDS -------------------- */

    const adminParents = await Parent.find(
      { createdBy: adminId },
      { _id: 1 }
    ).lean();

    const parentIds = adminParents.map((p) => p._id);

    /* -------------------- TOTAL PAID -------------------- */

    const totalPaidAgg = await Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          parent: { $in: parentIds },
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$amount" },
        },
      },
    ]);

    const totalPaidAmount = totalPaidAgg[0]?.totalPaid || 0;

    /* -------------------- TOTAL UNPAID -------------------- */

    const unpaidAgg = await Invoice.aggregate([
      {
        $match: {
          parent: { $in: parentIds },
          status: { $ne: "paid" },
        },
      },
      {
        $group: {
          _id: null,
          totalUnpaid: {
            $sum: { $subtract: ["$totalAmount", "$paidAmount"] },
          },
        },
      },
    ]);

    const totalUnpaidAmount = unpaidAgg[0]?.totalUnpaid || 0;

    /* -------------------- MONTHLY PAYMENTS -------------------- */

    const monthlyPaymentsRaw = await Payment.aggregate([
      {
        $match: {
          status: "succeeded",
          parent: { $in: parentIds },
          paymentDate: {
            $gte: new Date(`${parsedYear}-01-01`),
            $lte: new Date(`${parsedYear}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$paymentDate" },
          totalPaid: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const totalYearlyPaid =
      monthlyPaymentsRaw.reduce((sum, m) => sum + m.totalPaid, 0) || 1;

    const yearlyPayments = months.map((month, idx) => {
      const monthData = monthlyPaymentsRaw.find((m) => m._id === idx + 1);
      const paid = monthData?.totalPaid || 0;

      return {
        month,
        value: parseFloat(((paid / totalYearlyPaid) * 100).toFixed(2)),
        totalPaid: paid,
      };
    });

    /* -------------------- CURRENT / LAST MONTH -------------------- */

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;

    const currentMonthIncome =
      monthlyPaymentsRaw.find((m) => m._id === currentMonth)?.totalPaid || 0;

    const lastMonthIncome =
      monthlyPaymentsRaw.find((m) => m._id === lastMonth)?.totalPaid || 0;

    /* -------------------- TOP PAYING PARENTS (ADMIN ONLY) -------------------- */

    const topPayingParents = await Payment.aggregate([
      {
        $match: {
          parent: { $in: parentIds },
        },
      },
      {
        $group: {
          _id: "$parent",
          totalPaid: { $sum: "$amount" },
          lastPaymentDate: { $max: "$paymentDate" },
        },
      },
      { $sort: { totalPaid: -1 } },
      { $limit: 4 },
      {
        $lookup: {
          from: "parents",
          localField: "_id",
          foreignField: "_id",
          as: "parent",
        },
      },
      { $unwind: "$parent" },
      {
        $project: {
          name: "$parent.fullName",
          date: "$lastPaymentDate",
          amount: "$totalPaid",
        },
      },
    ]);

    /* -------------------- TOP OUTSTANDING PARENTS -------------------- */

    const topOutstandingParents = await Invoice.aggregate([
      {
        $match: {
          parent: { $in: parentIds },
        },
      },
      {
        $group: {
          _id: "$parent",
          unpaid: {
            $sum: { $subtract: ["$totalAmount", "$paidAmount"] },
          },
          lastInvoice: { $max: "$createdAt" },
        },
      },
      { $sort: { unpaid: -1 } },
      { $limit: 4 },
      {
        $lookup: {
          from: "parents",
          localField: "_id",
          foreignField: "_id",
          as: "parent",
        },
      },
      { $unwind: "$parent" },
      {
        $project: {
          name: "$parent.fullName",
          date: "$lastInvoice",
          amount: "$unpaid",
        },
      },
    ]);

    /* -------------------- RESPONSE -------------------- */

    return res.status(200).json({
      success: true,
      stats: {
        totalParents,
        totalStudents,
        totalTeachers,
        totalInvoices,
        totalPaidAmount,
        totalUnpaidAmount,
        paidPercentage:
          totalPaidAmount &&
          (
            (totalPaidAmount / (totalPaidAmount + totalUnpaidAmount)) *
            100
          ).toFixed(2),
        unpaidPercentage:
          totalUnpaidAmount &&
          (
            (totalUnpaidAmount / (totalPaidAmount + totalUnpaidAmount)) *
            100
          ).toFixed(2),
        lastMonthIncome,
        currentMonthIncome,
      },
      yearlyPayments,
      topPayingParents,
      topOutstandingParents,
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getThemeByBranch = async (req, res) => {
  try {
    const { branch } = req.body;

    if (!branch) {
      return res.status(400).json({ success: false, message: "Branch is required" });
    }

    const admin = await Admin.findOne({ branch }).select("websiteSettings -_id");

    if (!admin) {
      return res.status(404).json({ success: false, message: "Theme not found for this branch" });
    }

    return res.status(200).json({ success: true, theme: admin.websiteSettings });
  } catch (error) {
    console.error("Error fetching theme:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createAdmin,
  getAllAdmin,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  createSubAdmin,
  getAllSubAdminAgainstAdmin,
  getSubAdminById,
  editSubAdminById,
  editSubAdminById,
  updateTheme,
  getAdminDashboardStats,
  getThemeByBranch
};
