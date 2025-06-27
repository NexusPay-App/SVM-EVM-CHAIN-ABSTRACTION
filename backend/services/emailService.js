const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.config = {
      // Use environment variables or defaults for development
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };
    
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@nexuspay.com';
    this.fromName = process.env.FROM_NAME || 'NexusPay';
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  }

  async initialize() {
    try {
      // Skip email setup if no SMTP credentials (for development)
      if (!this.config.auth.user || !this.config.auth.pass) {
        console.log('⚠️ Email service: No SMTP credentials found, running in development mode');
        this.initialized = true;
        return;
      }

      this.transporter = nodemailer.createTransporter(this.config);
      
      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email service initialized successfully');
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      console.log('📧 Emails will be logged to console in development mode');
      this.initialized = true; // Allow to continue without email
    }
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const mailOptions = {
      from: `${this.fromName} <${this.fromEmail}>`,
      to,
      subject,
      html,
      text: text || this.htmlToText(html)
    };

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } else {
        // Development mode - log email instead of sending
        console.log('\n📧 EMAIL (Development Mode):');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content:\n${text || this.htmlToText(html)}`);
        console.log('---\n');
        return { success: true, messageId: 'dev-mode' };
      }
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${this.baseUrl}/auth/verify-email?token=${verificationToken}`;
    
    const subject = 'Verify Your NexusPay Account';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Account</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            background: #4F46E5; 
            color: white !important; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to NexusPay</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            <p>Thank you for signing up for NexusPay! To complete your account setup, please verify your email address by clicking the button below:</p>
            
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            
            <p>If the button above doesn't work, you can also copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            
            <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
            
            <p>If you didn't create an account with NexusPay, please ignore this email.</p>
            
            <p>Best regards,<br>The NexusPay Team</p>
          </div>
          <div class="footer">
            <p>© 2024 NexusPay. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${this.baseUrl}/auth/reset-password?token=${resetToken}`;
    
    const subject = 'Reset Your NexusPay Password';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            background: #DC2626; 
            color: white !important; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .warning { background: #FEF3C7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            <p>We received a request to reset your NexusPay account password. If you made this request, click the button below to reset your password:</p>
            
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            
            <p>If the button above doesn't work, you can also copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            
            <div class="warning">
              <strong>Security Notice:</strong>
              <ul>
                <li>This password reset link will expire in 1 hour</li>
                <li>The link can only be used once</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password will remain unchanged unless you click the link above</li>
              </ul>
            </div>
            
            <p>If you're having trouble with your account, please contact our support team.</p>
            
            <p>Best regards,<br>The NexusPay Team</p>
          </div>
          <div class="footer">
            <p>© 2024 NexusPay. All rights reserved.</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to NexusPay - Your Account is Ready!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to NexusPay</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            background: #10B981; 
            color: white !important; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .feature { margin: 15px 0; padding: 10px; background: white; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to NexusPay!</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            <p>Congratulations! Your NexusPay account has been verified and is now ready to use. You can now access all our multi-chain wallet infrastructure features.</p>
            
            <h3>What's Next?</h3>
            <div class="feature">
              <strong>📁 Create Your First Project</strong><br>
              Organize your applications and get project-specific API keys
            </div>
            <div class="feature">
              <strong>💳 Deploy Smart Wallets</strong><br>
              Create account abstraction wallets on Ethereum, Solana, and Arbitrum
            </div>
            <div class="feature">
              <strong>⛽ Set Up Paymasters</strong><br>
              Sponsor gas fees for your users across all supported chains
            </div>
            <div class="feature">
              <strong>📊 Monitor Analytics</strong><br>
              Track usage, costs, and performance across all your projects
            </div>
            
            <p style="text-align: center;">
              <a href="${this.baseUrl}/dashboard" class="button">Access Your Dashboard</a>
            </p>
            
            <h3>Need Help?</h3>
            <p>Check out our documentation and guides:</p>
            <ul>
              <li><a href="${this.baseUrl}/docs/quickstart">Quick Start Guide</a></li>
              <li><a href="${this.baseUrl}/docs/api">API Reference</a></li>
              <li><a href="${this.baseUrl}/examples">Code Examples</a></li>
            </ul>
            
            <p>Welcome aboard!<br>The NexusPay Team</p>
          </div>
          <div class="footer">
            <p>© 2024 NexusPay. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  // Helper method to convert HTML to plain text
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Test email connectivity
  async testConnection() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      return { success: false, message: 'Running in development mode (no SMTP configured)' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Create and export singleton instance
const emailService = new EmailService();

module.exports = emailService; 