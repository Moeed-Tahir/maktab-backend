const User = require("../models/User");
const { generateToken } = require("../services/JwtToken");
const bcrypt = require("bcryptjs");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const Admin = require("../models/Admin");
const Teacher = require("../models/Teacher");

const register = async (req, res) => {
  try {
    const { email, password, role } = req.body; // Express automatically parses JSON if using body-parser / express.json()

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ email, password, role });

    return res.status(201).json({
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (user.role !== role)
      return res.status(403).json({ message: `User is not a ${role}` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    let roleId = null;

    switch (role.toLowerCase()) {
      case 'teacher': 
        const teacher = await Teacher.findOne({ user: user._id });
        roleId = teacher ? teacher._id : null;
        break;
      case 'student':
        const student = await Student.findOne({ user: user._id });
        roleId = student ? student._id : null;
        break;
      case 'parent':
        const parent = await Parent.findOne({ user: user._id });
        roleId = parent ? parent._id : null;
        break;
      case 'admin': 
        const admin = await Admin.findOne({ user: user._id });
        roleId = admin ? admin._id : null;
        break;
      default:
        roleId = user._id;
    }

    if (!roleId) {
      return res.status(404).json({ message: `${role} profile not found` });
    }

    console.log("roleId", roleId);

    return res.status(200).json({
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      id: roleId,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = { register, login }