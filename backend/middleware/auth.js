const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const emailValidationService = require('../services/emailValidationService');

// JWT secret from environment or default for development
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthMiddleware {
  // Generate JWT token
  static generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'nexuspay-api',
      audience: 'nexuspay-users'
    });
  }

  // Verify JWT token
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        audience: 'nexuspay-users',
        issuer: 'nexuspay-api'
      });
      
      // Check if user still exists and is active
      const user = await User.findOne({ id: decoded.id, status: 'active' });
      if (!user) {
        throw new Error('User not found or inactive');
      }
      
      return { user, decoded };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Middleware to protect routes
  static async authenticateToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token required',
            solution: 'Include Authorization: Bearer <token> header'
          }
        });
      }

      const { user } = await AuthMiddleware.verifyToken(token);
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: error.message,
          solution: 'Please login again to get a new token'
        }
      });
    }
  }

  // Middleware to check if user is verified
  static requireVerification(req, res, next) {
    if (!req.user.email_verified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification required',
          details: 'Please verify your email address before accessing this resource'
        }
      });
    }
    next();
  }

  // Rate limiting for authentication endpoints
  static authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later',
        retryAfter: '15 minutes'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limiting for password reset
  static passwordResetRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 password reset requests per hour
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many password reset attempts',
        details: 'Please try again in 1 hour'
      }
    }
  });

  // Middleware to validate user input with real email validation
  static async validateRegistration(req, res, next) {
    const { email, password, name } = req.body || {};
    const errors = [];

    // Basic field validation
    if (!email) {
      errors.push('Email address is required');
    }
    if (!password) {
      errors.push('Password is required');
    }
    if (!name || name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    // If basic validation fails, return early
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors
        }
      });
    }

    try {
      // Real email validation
      console.log(`🔍 Validating email: ${email}`);
      const emailValidation = await emailValidationService.quickValidate(email);
      
      if (!emailValidation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_EMAIL',
            message: `Email validation failed: ${emailValidation.reason}`,
            details: {
              email: email,
              reason: emailValidation.reason,
              suggestion: 'Please use a valid, permanent email address'
            }
          }
        });
      }

      // Password validation
      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      }

      if (password && !/(?=.*[a-z])/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      if (password && !/(?=.*[A-Z])/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      if (password && !/(?=.*\d)/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      if (password && !/(?=.*[!@#$%^&*])/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*)');
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors
          }
        });
      }

      console.log(`✅ Email validation passed for: ${email}`);
      next();

    } catch (error) {
      console.error('Email validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_VALIDATION_ERROR',
          message: 'Unable to validate email address',
          details: 'Please try again or contact support if the issue persists'
        }
      });
    }
  }

  // Middleware to validate login input
  static validateLogin(req, res, next) {
    const { email, password } = req.body || {};
    const errors = [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email address is required');
    }

    if (!password) {
      errors.push('Password is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors
        }
      });
    }

    next();
  }

  /**
   * Check if user has required permissions
   */
  static requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this action'
          }
        });
      }

      // In the future, implement role-based permissions
      // For now, all authenticated users have basic permissions
      if (permission === 'basic' || req.user.role === 'admin') {
        return next();
      }

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' required for this action`
        }
      });
    };
  }
}

module.exports = AuthMiddleware; 