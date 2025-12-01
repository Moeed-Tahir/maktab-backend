const bcrypt = require("bcryptjs");
const User = require("../models/User");
const dbConnect = require("./dbConnect");

const seedSuperAdmin = async () => {
  try {
    await dbConnect();
    const existingAdmin = await User.findOne({ email: "superadmin11@gmail.com" });
    if (existingAdmin) {
      console.log("✅ Super Admin already exists");
      return;
    }
    
    await User.create({
      email: "superadmin@gmail.com",
      password: "superadmin@11",
      role: "Super Admin",
    });

  } catch (error) {
    console.error("❌ Error creating Super Admin:", error);
  }
};

module.exports = seedSuperAdmin;
