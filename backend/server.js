require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3001;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String }, // Optional for Google OAuth users
  googleId: { type: String }, // For Google OAuth users
  profilePicture: { type: String },
  apiKeys: [{
    keyId: String,
    projectName: String,
    website: String,
    createdAt: { type: Date, default: Date.now },
    usageCount: { type: Number, default: 0 },
    lastUsed: Date
  }],
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

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

// JWT Authentication Middleware
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

// API key validation (now requires user authentication)
const validateApiKey = async (req, res, next) => {
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

  try {
    // Find user with this API key
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
        { googleId: googleUser.id }
      ]
    });

    if (!user) {
      // Create new user
      user = new User({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.id,
        profilePicture: googleUser.picture
      });
      await user.save();
    } else {
      // Update existing user
      user.googleId = googleUser.id;
      user.profilePicture = googleUser.picture;
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.send(`
      <script>
        window.opener.postMessage({ 
      success: true,
          user: {
            id: '${user._id}',
            email: '${user.email}',
            name: '${user.name}',
            profilePicture: '${user.profilePicture || ''}'
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
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        apiKeys: user.apiKeys.map(key => ({
          keyId: key.keyId,
          projectName: key.projectName,
          website: key.website,
          createdAt: key.createdAt,
          usageCount: key.usageCount,
          lastUsed: key.lastUsed
        }))
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// API key generation (requires authentication)
app.post('/api/keys/generate', authenticateToken, async (req, res) => {
  try {
    const { projectName, website } = req.body;
    
    if (!projectName) {
      return res.status(400).json({
        error: 'Project name is required',
        code: 'MISSING_FIELDS'
      });
    }

    // Generate secure API key
    const apiKey = 'npay_' + crypto.randomBytes(32).toString('hex');
    
    // Find user and add API key
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.apiKeys.push({
      keyId: apiKey,
      projectName,
      website: website || '',
      createdAt: new Date(),
      usageCount: 0
    });

    await user.save();
    
    res.json({
      success: true,
      apiKey,
      message: 'API key generated successfully',
      keyInfo: {
        projectName,
        website: website || '',
        createdAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate API key',
      code: 'GENERATION_FAILED'
    });
  }
});

// Basic wallet endpoint (requires API key)
app.post('/api/wallets', validateApiKey, (req, res) => {
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

// For local development
if (require.main === module) {
app.listen(port, () => {
  console.log(`🚀 NexusPay API running on port ${port}`);
});
}

// For Vercel
module.exports = app; 
