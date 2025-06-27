const express = require('express');
const passport = require('../config/passport');
const User = require('../models/User');
const AuthMiddleware = require('../middleware/auth');
const emailService = require('../services/emailService');

const router = express.Router();

/**
 * @route POST /auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', [
  AuthMiddleware.authRateLimit,
  AuthMiddleware.validateRegistration
], async (req, res) => {
  try {
    const { email, password, name, company } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
          details: 'Please use a different email address or try logging in'
        }
      });
    }

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password_hash: password, // Will be hashed by pre-save middleware
      name: name.trim(),
      company: company ? company.trim() : undefined
    });

    // Generate verification token
    const verificationToken = user.generateVerificationToken();
    
    // Save user
    await user.save();

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
    }

    // Generate JWT token
    const token = AuthMiddleware.generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: user.toJSON(),
        token,
        email_sent: emailResult.success
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to create account',
        details: 'Please try again later'
      }
    });
  }
});

/**
 * @route POST /auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', [
  AuthMiddleware.authRateLimit,
  AuthMiddleware.validateLogin
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to failed login attempts',
          details: 'Please try again later or reset your password'
        }
      });
    }

    // Check if account is suspended
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended',
          details: 'Please contact support for assistance'
        }
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment failed login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Reset login attempts on successful login
    if (user.login_attempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate JWT token
    const token = AuthMiddleware.generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed',
        details: 'Please try again later'
      }
    });
  }
});

/**
 * @route GET /auth/verify-email
 * @desc Verify user email
 * @access Public
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Verification token is required'
        }
      });
    }

    // Find user by verification token
    const user = await User.findByVerificationToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired verification token'
        }
      });
    }

    // Verify email
    user.email_verified = true;
    user.verification_token = undefined;
    user.verification_token_expires = undefined;
    await user.save();

    // Send welcome email
    const emailResult = await emailService.sendWelcomeEmail(user);
    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_FAILED',
        message: 'Email verification failed',
        details: 'Please try again later'
      }
    });
  }
});

/**
 * @route POST /auth/resend-verification
 * @desc Resend verification email
 * @access Private
 */
router.post('/resend-verification', [
  AuthMiddleware.authRateLimit,
  AuthMiddleware.authenticateToken
], async (req, res) => {
  try {
    const user = req.user;

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_VERIFIED',
          message: 'Email is already verified'
        }
      });
    }

    // Generate new verification token
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(user, verificationToken);

    res.json({
      success: true,
      message: 'Verification email sent',
      data: {
        email_sent: emailResult.success
      }
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESEND_FAILED',
        message: 'Failed to resend verification email'
      }
    });
  }
});

/**
 * @route POST /auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password', [
  AuthMiddleware.passwordResetRateLimit
], async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Valid email address is required'
        }
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    
    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user && user.status === 'active') {
      // Generate password reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Send password reset email
      const emailResult = await emailService.sendPasswordResetEmail(user, resetToken);
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
      }
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESET_REQUEST_FAILED',
        message: 'Failed to process password reset request'
      }
    });
  }
});

/**
 * @route POST /auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Reset token is required'
        }
      });
    }

    // Validate password
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be at least 8 characters long'
        }
      });
    }

    // Find user by reset token
    const user = await User.findByPasswordResetToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token'
        }
      });
    }

    // Reset password
    user.password_hash = password; // Will be hashed by pre-save middleware
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    
    // Reset any account locks
    user.login_attempts = 0;
    user.locked_until = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESET_FAILED',
        message: 'Password reset failed'
      }
    });
  }
});

/**
 * @route GET /auth/me
 * @desc Get current user info
 * @access Private
 */
router.get('/me', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_FETCH_FAILED',
        message: 'Failed to fetch user information'
      }
    });
  }
});

/**
 * @route PUT /auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { name, company } = req.body;
    const user = req.user;

    // Validate input
    if (name && name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_NAME',
          message: 'Name must be at least 2 characters long'
        }
      });
    }

    // Update fields
    if (name) user.name = name.trim();
    if (company !== undefined) user.company = company ? company.trim() : undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update profile'
      }
    });
  }
});

/**
 * @route POST /auth/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = req.user;

    // Validate input
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PASSWORDS',
          message: 'Both current and new passwords are required'
        }
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'New password must be at least 8 characters long'
        }
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(current_password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is incorrect'
        }
      });
    }

    // Update password
    user.password_hash = new_password; // Will be hashed by pre-save middleware
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: 'Failed to change password'
      }
    });
  }
});

// Google OAuth routes (only if Google OAuth is configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  // Initiate Google OAuth
  router.get('/google', (req, res, next) => {
    // Check if this is a popup request
    const isPopup = req.query.popup === 'true';
    
    // Store popup state in session for callback
    if (isPopup) {
      req.session.oauthPopup = true;
    }
    
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      // Add popup parameter to state for callback
      state: isPopup ? 'popup=true' : undefined
    })(req, res, next);
  });

  // Google OAuth callback
  router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
      try {
        // Generate JWT token for the authenticated user
        const token = AuthMiddleware.generateToken(req.user);
        
        // Update last login
        req.user.last_login = new Date();
        await req.user.save();

        // Check if this was a popup request
        const isPopup = req.session.oauthPopup || req.query.state === 'popup=true';
        
        if (isPopup) {
          // Clear popup state from session
          delete req.session.oauthPopup;
          
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Authentication Successful</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                }
                .success-message {
                  text-align: center;
                  padding: 40px;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 10px;
                  backdrop-filter: blur(10px);
                }
              </style>
            </head>
            <body>
              <div class="success-message">
                <h2>✅ Authentication Successful!</h2>
                <p>Redirecting you back to the application...</p>
              </div>
              <script>
                // Send success message to parent window
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'auth_success',
                    token: '${token}',
                    user: ${JSON.stringify(req.user)}
                  }, '*');
                  window.close();
                } else {
                  // Fallback: redirect to dashboard
                  localStorage.setItem('nexuspay_token', '${token}');
                  localStorage.setItem('nexuspay_user', '${JSON.stringify(req.user)}');
                  window.location.href = '/dashboard';
                }
              </script>
            </body>
            </html>
          `);
        } else {
          // Regular redirect for non-popup authentication
          const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${token}`;
          res.redirect(redirectUrl);
        }
        
      } catch (error) {
        console.error('Google OAuth callback error:', error);
        res.redirect('/auth/error');
      }
    }
  );
} else {
  // Placeholder routes when Google OAuth is not configured
  router.get('/google', (req, res) => {
    res.status(503).json({
      success: false,
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured on this server',
        solution: 'Contact administrator or use email/password authentication'
      }
    });
  });

  router.get('/google/callback', (req, res) => {
    res.status(503).json({
      success: false,
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured on this server'
      }
    });
  });
}

module.exports = router; 