const nodemailer = require('nodemailer');
require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

const sendWelcomeEmail = async (user) => {
    const username = user.name || user.email.split('@')[0];
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #f5f5f5;
                }
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 10px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 40px 20px;
                    text-align: center;
                }
                .logo {
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .welcome-text {
                    font-size: 24px;
                    margin: 0;
                }
                .content {
                    padding: 40px 30px;
                }
                .greeting {
                    font-size: 18px;
                    margin-bottom: 20px;
                    color: #444;
                }
                .details-box {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    border-left: 4px solid #667eea;
                }
                .detail-item {
                    margin: 10px 0;
                    font-size: 16px;
                }
                .detail-label {
                    font-weight: 600;
                    color: #555;
                }
                .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 14px 32px;
                    text-decoration: none;
                    border-radius: 50px;
                    font-weight: 600;
                    font-size: 16px;
                    margin: 20px 0;
                    transition: transform 0.3s ease;
                }
                .cta-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3);
                }
                .login-note {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #666;
                }
                .footer {
                    background-color: #f8f9fa;
                    padding: 20px;
                    text-align: center;
                    color: #888;
                    font-size: 14px;
                }
                .social-links {
                    margin-top: 15px;
                }
                .social-link {
                    color: #667eea;
                    text-decoration: none;
                    margin: 0 10px;
                }
                @media (max-width: 600px) {
                    .content {
                        padding: 20px 15px;
                    }
                    .header {
                        padding: 30px 15px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <div class="logo">${process.env.APP_NAME || 'Your App'}</div>
                    <h1 class="welcome-text">Welcome Aboard!</h1>
                </div>
                
                <div class="content">
                    <p class="greeting">Hello <strong>${username}</strong>,</p>
                    <p>Welcome to ${process.env.APP_NAME || 'our platform'}! We're excited to have you join our community.</p>
                    
                    <div class="details-box">
                        <div class="detail-item">
                            <span class="detail-label">Email:</span> ${user.email}
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Role:</span> ${user.role}
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Account Created:</span> ${new Date().toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </div>
                    </div>
                    
                    <p>Your account has been successfully created and is ready to use. You can now access all the features available for your role.</p>
                    
                    <div style="text-align: center;">
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="cta-button">
                            Get Started - Login Now
                        </a>
                    </div>
                    
                    <div class="login-note">
                        <p><strong>Note:</strong> Use your registered email and password to login.</p>
                        <p>If you encounter any issues during login, please use the "Forgot Password" option or contact our support team.</p>
                    </div>
                    
                    <p>We're here to help you succeed. If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
                    
                    <p>Best regards,<br>
                    <strong>The ${process.env.APP_NAME || 'Platform'} Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>© ${new Date().getFullYear()} ${process.env.APP_NAME || 'Your App'}. All rights reserved.</p>
                    <p>This is an automated message, please do not reply to this email.</p>
                    
                    <div class="social-links">
                        <a href="#" class="social-link">Website</a> | 
                        <a href="#" class="social-link">Support</a> | 
                        <a href="#" class="social-link">Privacy Policy</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;

    const plainText = `
        Welcome to ${process.env.APP_NAME || 'our platform'}!
        
        Hello ${username},
        
        Your account has been successfully created with the following details:
        - Email: ${user.email}
        - Role: ${user.role}
        - Account Created: ${new Date().toLocaleDateString()}
        
        You can now login to your account at: ${process.env.APP_URL || 'http://localhost:3000'}/login
        
        Use your registered email and password to login.
        
        If you encounter any issues during login, please use the "Forgot Password" option or contact our support team.
        
        Best regards,
        The ${process.env.APP_NAME || 'Platform'} Team
    `;

    try {
        const mailOptions = {
            from: `"${process.env.APP_NAME || 'Your App'}" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `Welcome to ${process.env.APP_NAME || 'Our Platform'}!`,
            html: htmlContent,
            text: plainText
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent to ${user.email}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        throw new Error(`Welcome email sending failed: ${error.message}`);
    }
};

module.exports = { sendWelcomeEmail };