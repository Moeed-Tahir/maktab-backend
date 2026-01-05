const User = require("../models/User");
const { generateToken } = require("../services/JwtToken");
const bcrypt = require("bcryptjs");
const Student = require("../models/Student");
const Parent = require("../models/Parent");
const Admin = require("../models/Admin");
const Teacher = require("../models/Teacher");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

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
    console.log("Login attempt:", { email, role });

    if (!email || !password || !role) {
      console.log("Missing fields in request body");
      return res.status(400).json({ message: "Email, password, and role are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    console.log("User fetched from DB:", user);

    if (!user) {
      console.log("No user found with this email");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.role.toLowerCase() !== role.toLowerCase()) {
      console.log(`User role mismatch. Expected: ${role}, Found: ${user.role}`);
      return res.status(403).json({ message: `User is not a ${role}` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("Password did not match");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    let roleId = null;
    let permissions = [];
    let adminId = null;

    switch (role.toLowerCase()) {
      case "teacher":
        const teacher = await Teacher.findOne({ user: user._id });
        console.log("Teacher profile fetched:", teacher);
        roleId = teacher ? teacher._id : null;
        break;

      case "student":
        const student = await Student.findOne({ user: user._id });
        console.log("Student profile fetched:", student);
        roleId = student ? student._id : null;
        break;

      case "parent":
        const parent = await Parent.findOne({ user: user._id });
        console.log("Parent profile fetched:", parent);
        roleId = parent ? parent._id : null;
        break;

      case "admin":
        const admin = await Admin.findOne({ email: user.email });
        console.log("Admin profile fetched:", admin);
        roleId = admin ? admin._id : null;
        break;

      case "subadmin":
        const parentAdmin = await Admin.findOne({
          "subAdmins.email": user.email,
        });
        console.log("Parent admin for subadmin fetched:", parentAdmin);

        if (parentAdmin) {
          const subAdmin = parentAdmin.subAdmins.find(
            (sa) => sa.email === user.email
          );
          console.log("Subadmin found:", subAdmin);
          roleId = subAdmin ? subAdmin._id : null;
          permissions = subAdmin ? subAdmin.permissions : [];
          adminId = parentAdmin._id;
        }
        break;

      default:
        roleId = user._id;
    }

    if (!roleId) {
      console.log(`${role} profile not found`);
      return res.status(404).json({ message: `${role} profile not found` });
    }

    const response = {
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
      id: roleId,
    };

    if (role.toLowerCase() === "subadmin") {
      response.permissions = permissions;
      response.adminId = adminId;
    }

    console.log("Login successful, response:", response);
    return res.status(200).json(response);

  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    if (user.lastOtpSentAt && now - user.lastOtpSentAt < 2 * 60 * 1000) {
      const timeLeft = Math.ceil(
        (2 * 60 * 1000 - (now - user.lastOtpSentAt)) / 1000
      );
      return res.status(429).json({
        message: `Please wait ${timeLeft} seconds before requesting another OTP`,
      });
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    user.otpAttempts = 0;
    user.isOtpVerified = false;
    user.lastOtpSentAt = now;

    await user.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔒 Password Reset OTP",
      html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f7fa;
          padding: 20px;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 30px;
          text-align: center;
          color: white;
        }
        
        .logo {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .logo-icon {
          font-size: 28px;
        }
        
        .header h1 {
          font-size: 28px;
          font-weight: 500;
          margin: 0;
          opacity: 0.95;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .otp-container {
          background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
          border: 1px solid #e1e8f0;
        }
        
        .otp-title {
          color: #5a67d8;
          font-size: 18px;
          font-weight: 500;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .otp-code {
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 8px;
          color: #2d3748;
          background: white;
          padding: 20px;
          border-radius: 10px;
          margin: 15px 0;
          font-family: 'Courier New', monospace;
          border: 2px dashed #cbd5e0;
          user-select: all;
        }
        
        .expiry-notice {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #e53e3e;
          font-weight: 500;
          margin-top: 20px;
          padding: 12px;
          background: rgba(229, 62, 62, 0.05);
          border-radius: 8px;
        }
        
        .info-box {
          background: #ebf8ff;
          border-left: 4px solid #4299e1;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        
        .info-box h3 {
          color: #2c5282;
          margin-bottom: 10px;
          font-size: 16px;
        }
        
        .steps {
          margin: 30px 0;
        }
        
        .step {
          display: flex;
          align-items: flex-start;
          margin-bottom: 20px;
          gap: 15px;
        }
        
        .step-number {
          background: #667eea;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .footer {
          text-align: center;
          padding: 25px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
          color: #6c757d;
          font-size: 14px;
        }
        
        .footer p {
          margin: 5px 0;
        }
        
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          margin: 20px 0;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        @media (max-width: 600px) {
          .content {
            padding: 30px 20px;
          }
          
          .otp-code {
            font-size: 32px;
            letter-spacing: 6px;
            padding: 15px;
          }
          
          .header {
            padding: 30px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo">
            <span class="logo-icon">🔒</span>
            <span>SecureAuth</span>
          </div>
          <h1>Password Reset OTP</h1>
        </div>
        
        <div class="content">
          <p style="font-size: 16px; color: #4a5568; margin-bottom: 25px;">
            Hello, we received a request to reset your password. Use the OTP below to verify your identity:
          </p>
          
          <div class="otp-container">
            <div class="otp-title">
              <span>⏱️</span>
              <span>Your One-Time Password</span>
            </div>
            <div class="otp-code">${otp}</div>
            <p style="color: #718096; font-size: 14px; margin-bottom: 10px;">
              Enter this code in your verification screen
            </p>
            
            <div class="expiry-notice">
              <span>⏰</span>
              <span>Expires in: <strong>5 minutes</strong></span>
            </div>
          </div>
          
          <div class="info-box">
            <h3>📋 Important Instructions:</h3>
            <ul style="color: #4a5568; padding-left: 20px;">
              <li>This OTP is valid for one use only</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Contact support immediately if you suspect unauthorized activity</li>
            </ul>
          </div>
          
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <div>
                <strong>Copy the OTP</strong>
                <p style="color: #718096; font-size: 14px; margin-top: 5px;">Copy the 6-digit code above</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div>
                <strong>Paste in verification field</strong>
                <p style="color: #718096; font-size: 14px; margin-top: 5px;">Return to the app/website and paste the code</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <div>
                <strong>Set new password</strong>
                <p style="color: #718096; font-size: 14px; margin-top: 5px;">Create a strong, unique password</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="#" class="button">Go to Password Reset</a>
          </div>
        </div>
        
        <div class="footer">
          <p>🛡️ This is an automated security message from SecureAuth</p>
          <p>For security reasons, never share your OTP or password</p>
          <p style="margin-top: 15px; color: #a0aec0; font-size: 12px;">
            If you need help, contact our support team at support@yourapp.com
          </p>
          <p style="color: #a0aec0; font-size: 12px; margin-top: 10px;">
            © ${new Date().getFullYear()} Your Company Name. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "OTP sent to your email successfully",
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: error.message });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.otp || !user.otpExpiresAt) {
      return res.status(400).json({ message: "OTP not found or expired" });
    }

    if (new Date() > user.otpExpiresAt) {
      user.otp = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      await user.save();

      return res.status(400).json({ message: "OTP has expired" });
    }

    if (user.otpAttempts >= 5) {
      return res.status(400).json({
        message: "Too many failed attempts. Please request a new OTP",
      });
    }

    if (user.otp !== otp.trim()) {
      user.otpAttempts += 1;
      await user.save();

      const attemptsLeft = 5 - user.otpAttempts;
      return res.status(400).json({
        message: `Invalid OTP. ${attemptsLeft} attempts remaining`,
      });
    }

    user.isOtpVerified = true;
    await user.save();

    return res.status(200).json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        message: "Email, OTP, and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isOtpVerified || user.otp !== otp.trim()) {
      return res.status(400).json({
        message: "OTP verification required before resetting password",
      });
    }

    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    user.isOtpVerified = false;
    user.lastOtpSentAt = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const now = new Date();
    if (user.lastOtpSentAt && now - user.lastOtpSentAt < 2 * 60 * 1000) {
      const timeLeft = Math.ceil(
        (2 * 60 * 1000 - (now - user.lastOtpSentAt)) / 1000
      );
      return res.status(429).json({
        message: `Please wait ${timeLeft} seconds before requesting another OTP`,
      });
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    user.otpAttempts = 0;
    user.isOtpVerified = false;
    user.lastOtpSentAt = now;

    await user.save();

    const mailOptionsResent = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🔄 Password Reset OTP (Resent)",
      html: `
    <!-- Same HTML as above, but add this at the top of content section: -->
    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
      <div style="display: flex; align-items: center; gap: 10px; color: #856404;">
        <span style="font-size: 18px;">🔄</span>
        <div>
          <strong>New OTP Generated</strong>
          <p style="margin: 5px 0 0 0; font-size: 14px;">Your previous OTP has been invalidated. Use this new code instead.</p>
        </div>
      </div>
    </div>
    <!-- Then continue with the rest of the same HTML template -->
  `,
    };

    await transporter.sendMail(mailOptionsResent);

    return res.status(200).json({
      message: "OTP resent successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  resendOTP,
};
