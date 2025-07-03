require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import new models and middleware
const AuthMiddleware = require('./middleware/auth');
const ProjectAuthMiddleware = require('./middleware/project-auth');
const UsageTracker = require('./middleware/usageTracker');
const RateLimiter = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const projectAPIKeyRoutes = require('./routes/project-api-keys');
const paymasterRoutes = require('./routes/paymaster');
const transactionRoutes = require('./routes/transactions');
const chainRoutes = require('./routes/chains');

// Import models (User model now comes from models/User.js)
const User = require('./models/User');

const app = express();
const port = process.env.PORT || 3001;

// Set encryption key if not set
if (!process.env.ENCRYPTION_KEY) {
  process.env.ENCRYPTION_KEY = 'development_encryption_key_change_in_production';
  console.log('⚠️ Using default encryption key - set ENCRYPTION_KEY in production');
}

// Set master seed if not set
if (!process.env.MASTER_SEED) {
  process.env.MASTER_SEED = 'development_master_seed_change_in_production';
  console.log('⚠️ Using default master seed - set MASTER_SEED in production');
}

// MongoDB Connection
const dbConnection = require('./database/connection');
dbConnection.connect().then(() => {
  console.log('✅ Connected to MongoDB via connection manager');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  
  // Fallback to direct connection for development
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(() => {
    console.log('✅ Connected to MongoDB (fallback)');
  }).catch(fallbackErr => {
    console.error('❌ MongoDB fallback connection error:', fallbackErr);
  });
});

// User model is now imported from models/User.js

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));

// Add security headers to fix Cross-Origin-Opener-Policy
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add usage tracking for API endpoints (after express.json)
app.use('/api', UsageTracker.trackAPIUsage());

// Use the new authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', projectAPIKeyRoutes);
app.use('/api/projects', paymasterRoutes);
app.use('/api/projects', transactionRoutes);
app.use('/api/chains', chainRoutes);

// Legacy JWT Authentication Middleware (for backward compatibility)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Project-based API key validation (new system)
const validateApiKey = ProjectAuthMiddleware.validateProjectAPIKey;

// Legacy API key validation (for backward compatibility with old keys)
const validateLegacyApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apikey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }
  
  // Allow dev keys for testing
  if (apiKey === 'local-dev-key' || apiKey === 'dev-key') {
    req.apiKey = apiKey;
    return next();
  }

  // Check if this is a new project-based API key
  if (apiKey.startsWith('npay_proj_')) {
    return ProjectAuthMiddleware.validateProjectAPIKey(req, res, next);
  }

  try {
    // Legacy: Find user with this API key in old format
    const user = await User.findOne({ 'apiKeys.keyId': apiKey });
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    // Update usage stats
    const apiKeyObj = user.apiKeys.find(key => key.keyId === apiKey);
    apiKeyObj.usageCount += 1;
    apiKeyObj.lastUsed = new Date();
    await user.save();

    req.apiKey = apiKey;
    req.user = user;
    req.isLegacyKey = true;
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Debug endpoint for Vercel deployment issues
app.get('/debug/env', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    mongoUriPreview: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : null,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdPreview: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...' : null,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasJwtSecret: !!process.env.JWT_SECRET,
    mongoConnectionState: mongoose.connection.readyState,
    mongoStates: { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'nexuspay-api',
    version: '2.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard (requires authentication)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Auth popup
app.get('/auth-popup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth-popup.html'));
});

// Documentation
app.get('/documentation', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'documentation.html'));
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Email, password, and name are required'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      email,
      name,
      password: hashedPassword
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Failed to create account'
    });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed'
    });
  }
});

// Google OAuth routes - DYNAMIC URL
app.get('/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  const redirectUri = `${baseUrl}/auth/google/callback`;
  
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=profile email&` +
    `access_type=offline`;
  
  res.redirect(googleAuthUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.send(`
        <script>
          window.opener.postMessage({ success: false, error: 'No authorization code received' }, '*');
          window.close();
        </script>
      `);
    }

    // Exchange code for token and get user info
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/auth/google/callback`;
    
    // Add detailed logging for debugging
    console.log('OAuth Callback Debug:');
    console.log('- x-forwarded-proto:', req.get('x-forwarded-proto'));
    console.log('- req.protocol:', req.protocol);
    console.log('- host:', host);
    console.log('- final redirectUri:', redirectUri);
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    
    // Add detailed logging for debugging
    console.log('Token response status:', tokenResponse.status);
    console.log('Token data received:', JSON.stringify(tokenData, null, 2));
    
    if (!tokenData.access_token) {
      console.error('No access token in response. Full response:', tokenData);
      throw new Error(`Failed to get access token: ${tokenData.error || 'Unknown error'}`);
    }

    // Get user info from Google
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`);
    const googleUser = await userResponse.json();

    // Check if user exists in our database
    let user = await User.findOne({ 
      $or: [
        { email: googleUser.email },
        { google_id: googleUser.id }
      ]
    });

    if (!user) {
      // Create new user
      user = new User({
        email: googleUser.email,
        name: googleUser.name,
        google_id: googleUser.id,
        profile_picture: googleUser.picture,
        auth_provider: 'google'
      });
      await user.save();
    } else {
      // Update existing user
      user.google_id = googleUser.id;
      user.profile_picture = googleUser.picture;
      user.last_login = new Date();
      await user.save();
    }

    // Generate JWT
    const token = AuthMiddleware.generateToken(user);

    res.send(`
      <script>
        window.opener.postMessage({ 
      success: true,
          user: {
            id: '${user.id}',
            email: '${user.email}',
            name: '${user.name}',
            profilePicture: '${user.profile_picture || ''}'
          },
          token: '${token}',
          redirectTo: 'dashboard'
        }, '*');
        window.close();
      </script>
    `);
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.send(`
      <script>
        window.opener.postMessage({ success: false, error: 'Authentication failed' }, '*');
        window.close();
      </script>
    `);
  }
});

// Get user profile (authenticated)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id }).select('-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: user.toJSON(),
      message: 'This endpoint is deprecated. Please use the new auth system: GET /api/auth/me'
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// DEPRECATED: Legacy API key generation - Use project-based API keys instead
app.post('/api/keys/generate', authenticateToken, async (req, res) => {
  res.status(400).json({
    success: false,
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint is deprecated. Please create a project first, then generate API keys for the project.',
      details: 'Use POST /api/projects to create a project, then POST /api/projects/:projectId/api-keys to generate API keys',
      migration_guide: {
        step1: 'Create a project: POST /api/projects',
        step2: 'Generate API key: POST /api/projects/:projectId/api-keys',
        max_keys_per_project: 3
      }
    }
});  });
const apiKeyRateLimit = RateLimiter.createAPIKeyRateLimit();

app.post('/api/projects/:projectId/wallets', 
  apiKeyRateLimit,
  ProjectAuthMiddleware.validateProjectAPIKey, 
  ProjectAuthMiddleware.requirePermission('wallets:create'), 
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { socialId, socialType, chains, paymasterEnabled } = req.body;
      
      // Use project context from middleware
      console.log(`Creating wallet for project: ${req.project.name} (${projectId})`);
      
      // Validate input
      if (!socialId || !socialType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'socialId and socialType are required'
          }
        });
      }

      const WalletGenerator = require('./services/walletGenerator');
      
      // Generate wallet for the specified chains
      const walletChains = chains || req.project.chains;
      const wallets = {};
      
      for (const chain of walletChains) {
        try {
          const chainCategory = WalletGenerator.getChainCategory(chain);
          const wallet = WalletGenerator.generatePaymasterWallet(socialId, chainCategory);
          wallets[chain] = {
            address: wallet.address,
            chain: chain,
            category: chainCategory
          };
        } catch (error) {
          console.error(`Failed to generate wallet for ${chain}:`, error);
        }
      }
      
      res.json({
        success: true,
        message: 'Wallets created successfully',
        data: {
          projectId,
          socialId,
          socialType,
          wallets,
          paymasterEnabled: paymasterEnabled !== false && req.project.settings?.paymasterEnabled,
          project: {
            name: req.project.name,
            chains: req.project.chains
          }
        }
      });
      
    } catch (error) {
      console.error('Wallet creation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'WALLET_CREATION_FAILED',
          message: 'Failed to create wallet'
        }
      });
    }
  }
);

// Legacy wallet endpoint (for backward compatibility)
app.post('/api/wallets', validateLegacyApiKey, (req, res) => {
  res.json({
    success: true,
    message: 'Wallet endpoint working',
    wallet: {
      address: '0x' + crypto.randomBytes(20).toString('hex'),
      chain: 'ethereum'
    },
    user: req.user ? {
      id: req.user._id,
      email: req.user.email
    } : null
  });
});

// Debug endpoint for Vercel deployment issues
app.get('/debug/env', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGODB_URI,
    mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasJwtSecret: !!process.env.JWT_SECRET,
    mongoConnectionState: mongoose.connection.readyState,
    mongoConnectionStates: {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    }
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Initialize background services for paymaster monitoring
const BalanceService = require('./services/balanceService');
const PaymasterService = require('./services/paymasterService');
const PaymasterMonitor = require('./services/paymasterMonitor');

// Set up background monitoring (enhanced with automated alerts)
const startBackgroundJobs = () => {
  // Start the new automated monitoring system
  PaymasterMonitor.start();
  
  console.log('✅ Background paymaster monitoring activated');
};

// For local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 NexusPay API running on port ${port}`);
    console.log(`💰 Paymaster system initialized`);
    
    // Start background jobs for local development
    startBackgroundJobs();
  });
}

// For Vercel - background jobs are handled separately in production
module.exports = app; 
