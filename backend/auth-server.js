/**
 * Authentication Sub-Server Module
 * Handles user authentication, Google OAuth, and database connections
 * Can be imported into any Express app
 */

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');

// Database and authentication imports
const dbConnection = require('./database/connection');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');

class AuthServer {
  constructor(options = {}) {
    this.options = {
      sessionSecret: options.sessionSecret || process.env.SESSION_SECRET || 'nexuspay-auth-secret',
      mongoUri: options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay',
      corsOrigin: options.corsOrigin || process.env.FRONTEND_URL || 'http://localhost:3000',
      enableSecurity: options.enableSecurity !== false, // Default to true
      ...options
    };
    
    this.initialized = false;
    this.router = express.Router();
  }

  /**
   * Initialize the authentication system
   * Must be called before using the middleware
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️  Auth server already initialized');
      return;
    }

    try {
      console.log('🔐 Initializing NexusPay Authentication System...');
      
      // Connect to MongoDB
      await dbConnection.connect();
      console.log('✅ Database connected');

      this.initialized = true;
      console.log('✅ Authentication system initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize authentication system:', error);
      throw error;
    }
  }

  /**
   * Get middleware to add authentication to an Express app
   * @param {Object} app - Express app instance
   */
  setupMiddleware(app) {
    if (!this.initialized) {
      throw new Error('Auth server must be initialized before setting up middleware');
    }

    console.log('🔧 Setting up authentication middleware...');

    // Enhanced security headers (optional)
    if (this.options.enableSecurity) {
      app.use(helmet({
        contentSecurityPolicy: false, // Allow the main app to handle CSP
        crossOriginEmbedderPolicy: false // Don't interfere with main app
      }));
    }

    // Session configuration for Passport (only if not already configured)
    if (!app.get('trust proxy')) {
      app.use(session({
        secret: this.options.sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: this.options.mongoUri,
          collectionName: 'auth_sessions'
        }),
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      }));
    }

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Add authentication routes
    app.use('/auth', authRoutes);

    console.log('✅ Authentication middleware configured');
  }

  /**
   * Add authentication-aware endpoints to health check
   */
  addHealthCheck(app) {
    const originalHealthHandler = app._router?.stack?.find(
      layer => layer.route?.path === '/health'
    )?.route?.stack?.[0]?.handle;

    app.get('/health', async (req, res) => {
      try {
        const dbHealth = await dbConnection.healthCheck();
        
        const healthData = {
          status: 'ok',
          service: 'nexuspay-api',
          version: '2.0.0',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          features: {
            authentication: this.initialized,
            google_oauth: !!process.env.GOOGLE_CLIENT_ID,
            email_service: !!process.env.SMTP_USER,
            user_accounts: true,
            projects: false // Will be enabled in TICKET-003
          },
          database: dbHealth
        };

        // If there was an original health handler, merge its data
        if (originalHealthHandler) {
          const originalRes = { json: (data) => Object.assign(healthData, data) };
          await originalHealthHandler(req, originalRes);
        }

        res.json(healthData);
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message,
          database: { status: 'error', error: error.message }
        });
      }
    });
  }

  /**
   * Get database connection for use in main app
   */
  getDatabase() {
    return dbConnection;
  }

  /**
   * Get authentication middleware for protecting routes
   */
  getAuthMiddleware() {
    const AuthMiddleware = require('./middleware/auth');
    return AuthMiddleware;
  }

  /**
   * Get user model for use in main app
   */
  getUserModel() {
    return require('./models/User');
  }

  /**
   * Gracefully shutdown authentication system
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down authentication system...');
      await dbConnection.disconnect();
      console.log('✅ Authentication system shutdown complete');
    } catch (error) {
      console.error('❌ Error during authentication shutdown:', error);
    }
  }

  /**
   * Test the authentication system
   */
  async test() {
    try {
      const User = this.getUserModel();
      const emailService = require('./services/emailService');

      console.log('\n🧪 Testing Authentication System...');
      
      // Test database
      const dbHealth = await dbConnection.healthCheck();
      console.log('✅ Database:', dbHealth.status);

      // Test user model
      const testUser = new User({
        email: 'test@nexuspay.com',
        password_hash: 'TestPassword123!',
        name: 'Test User'
      });
      
      await testUser.validate();
      console.log('✅ User model validation passed');

      // Test email service
      await emailService.initialize();
      console.log('✅ Email service initialized');

      // Test Google OAuth config
      const hasGoogleOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      console.log('✅ Google OAuth:', hasGoogleOAuth ? 'Configured' : 'Not configured (optional)');

      return {
        database: dbHealth.status === 'connected',
        userModel: true,
        emailService: true,
        googleOAuth: hasGoogleOAuth
      };

    } catch (error) {
      console.error('❌ Authentication test failed:', error);
      return false;
    }
  }
}

// Create singleton instance
const authServer = new AuthServer();

// Export both the class and instance
module.exports = {
  AuthServer,
  authServer,
  
  // Convenience exports
  getAuthMiddleware: () => authServer.getAuthMiddleware(),
  getUserModel: () => authServer.getUserModel(),
  getDatabase: () => authServer.getDatabase()
}; 