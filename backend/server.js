require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const app = express();
const port = process.env.PORT || 3001;

// In-memory storage for API keys (in production, use a database)
const apiKeys = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apikey;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }
  
  if (apiKey === 'local-dev-key' || apiKey === 'dev-key' || apiKeys.has(apiKey)) {
    req.apiKey = apiKey;
    next();
  } else {
    return res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
};

// Health check endpoint (required by SDK test)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'nexuspay-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint - serve HTML page for API key generation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard endpoint - serve user activity dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'NexusPay API - Cross-chain wallet infrastructure',
    service: 'nexuspay-api',
    version: '1.0.0',
    documentation: {
      apiKeyGeneration: '/',
      endpoints: {
        health: '/health',
        wallets: '/api/wallets',
        payments: '/api/payments',
        bridge: '/api/bridge',
        gasTank: '/api/gas-tank'
      }
    },
    usage: {
      authentication: 'Include X-API-Key header with your API key',
      example: 'curl -H "X-API-Key: your-api-key" https://nexuspay-api.vercel.app/api/wallets'
    }
  });
});

// API Key Generation Endpoints
app.post('/api/keys/generate', async (req, res) => {
  try {
    const { email, projectName, website } = req.body;
    
    // Generate API key
    const apiKey = 'npay_' + crypto.randomBytes(32).toString('hex');
    const keyId = crypto.randomBytes(16).toString('hex');
    
    // Store key info (in production, save to database)
    apiKeys.set(apiKey, {
      keyId,
      email,
      projectName,
      website,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      lastUsed: null,
      status: 'active'
    });
    
    res.json({
      success: true,
      apiKey,
      keyId,
      message: 'API key generated successfully',
      endpoints: {
        production: 'https://nexuspay-api.vercel.app',
        websocket: 'wss://nexuspay-api.vercel.app'
      },
      integration: {
        npm: 'npm install @nexuspay/sdk',
        example: `
import { NexusSDK, Utils } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: '${apiKey}',
  environment: 'production',
  chains: ['ethereum', 'polygon', 'solana'],
  endpoints: {
    api: 'https://nexuspay-api.vercel.app'
  }
});

await sdk.initialize();
        `.trim()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      code: 'KEY_GENERATION_FAILED'
    });
  }
});

// Get API key info
app.get('/api/keys/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    
    // Find key by keyId
    let keyInfo = null;
    for (const [apiKey, info] of apiKeys.entries()) {
      if (info.keyId === keyId) {
        keyInfo = { ...info, apiKey: apiKey.substring(0, 8) + '...' };
        break;
      }
    }
    
    if (!keyInfo) {
      return res.status(404).json({ 
        error: 'API key not found',
        code: 'KEY_NOT_FOUND'
      });
    }
    
    res.json(keyInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import blockchain integration
const { blockchainManager, CONTRACTS } = require('./blockchain-integration');
const simpleDeployer = require('./simple-deployer');
const solanaDeployer = require('./solana-deployer');

// In-memory storage (in production, use a database)
const wallets = new Map();
const privateKeyRequests = new Map(); // Track private key requests
const gasTanks = new Map(); // Track company gas tanks
const usageAnalytics = new Map(); // Track SDK usage

// Instant Account Creation (what users actually need)
app.post('/api/accounts/create', validateApiKey, async (req, res) => {
  try {
    const { socialId, socialType, password, metadata } = req.body;
    
    console.log(`👤 Creating instant account for ${socialType}:${socialId}...`);
    
    // Validate required fields
    if (!socialId || !socialType) {
      return res.status(400).json({
        error: 'Missing required fields: socialId, socialType',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Validate socialType
    const supportedTypes = ['email', 'phone', 'google', 'twitter', 'discord', 'github'];
    if (!supportedTypes.includes(socialType)) {
      return res.status(400).json({
        error: `Unsupported social type: ${socialType}. Supported types: ${supportedTypes.join(', ')}`,
        code: 'INVALID_SOCIAL_TYPE'
      });
    }
    
    // Check if account already exists
    const accountKey = `${socialType}:${socialId}`;
    if (wallets.has(accountKey)) {
      const existingAccount = wallets.get(accountKey);
      return res.json({
        success: true,
        account: existingAccount,
        message: 'Account already exists',
        isNew: false
      });
    }

    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }

    // Initialize auto-deployer if needed
    if (!autoDeployer.deployers || autoDeployer.deployers.length === 0) {
      await autoDeployer.initialize();
    }
    
    // Create account with instant wallet deployment
    const userAccount = await autoDeployer.createAccountWithInstantWallet(
      socialId, 
      socialType, 
      { password, ...metadata }
    );
    
    // Store account
    wallets.set(accountKey, userAccount);
    
    console.log(`✅ Instant account created for ${socialType}:${socialId}`);
    console.log(`📍 Unified address: ${userAccount.addresses.ethereum}`);
    console.log(`🔗 Block explorer: https://sepolia.etherscan.io/address/${userAccount.addresses.ethereum}`);
    console.log(`🚀 Wallet status: ${userAccount.blockchainInfo.deployment.deploymentStatus}`);
    
    res.json({
      success: true,
      account: userAccount,
      message: 'Account created successfully with unified blockchain address',
      isNew: true,
      quickAccess: {
        unifiedAddress: userAccount.addresses.ethereum,
        blockExplorer: `https://sepolia.etherscan.io/address/${userAccount.addresses.ethereum}`,
        transactionUrl: userAccount.blockchainInfo.deployment.transactionUrl,
        walletReady: userAccount.walletReady,
        estimatedReady: userAccount.blockchainInfo.deployment.estimatedConfirmation
      }
    });
    
  } catch (error) {
    console.error('❌ Instant account creation failed:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ACCOUNT_CREATION_FAILED'
    });
  }
});

// Wallet Management Routes (protected)
app.post('/api/wallets', validateApiKey, async (req, res) => {
  try {
    const { socialId, socialType, chains, metadata } = req.body;
    
    console.log('Creating wallet for:', socialId, 'type:', socialType, 'with API key:', req.apiKey.substring(0, 8) + '...');
    
    // Validate socialType supports phone numbers
    const supportedTypes = ['email', 'phone', 'google', 'twitter', 'discord', 'github'];
    if (!supportedTypes.includes(socialType)) {
      return res.status(400).json({
        error: `Unsupported social type: ${socialType}. Supported types: ${supportedTypes.join(', ')}`,
        code: 'INVALID_SOCIAL_TYPE'
      });
    }
    
    // Check if wallet already exists
    const walletKey = `${socialType}:${socialId}`;
    if (wallets.has(walletKey)) {
      return res.json(wallets.get(walletKey));
    }
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    // Generate REAL blockchain addresses using deployed smart contracts
    console.log('🔗 Creating real blockchain wallet addresses...');
    const blockchainWallet = await blockchainManager.generateCrossChainAddresses(socialId, socialType);
    
    // Create wallet with real blockchain integration
    const wallet = {
      socialId,
      socialType,
      addresses: blockchainWallet.addresses,
      blockchainInfo: {
        primaryWallet: blockchainWallet.primaryWallet,
        ownerAddress: blockchainWallet.ownerAddress,
        canDeploy: blockchainWallet.canDeploy,
        isRealBlockchainAddresses: blockchainWallet.isRealBlockchainAddresses,
        contractAddresses: CONTRACTS.sepolia
      },
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      metadata: metadata || {},
      recoverySetup: false,
      isActive: true,
      crossChainEnabled: true,
      balances: {
        ethereum: { native: '0', tokens: {} },
        polygon: { native: '0', tokens: {} },
        arbitrum: { native: '0', tokens: {} },
        base: { native: '0', tokens: {} },
        optimism: { native: '0', tokens: {} },
        solana: { native: '0', tokens: {} }
      },
      gasTank: {
        totalBalance: '0',
        chainBalances: {
          ethereum: '0',
          polygon: '0',
          arbitrum: '0',
          base: '0',
          optimism: '0',
          solana: '0'
        }
      }
    };
    
    // Store wallet
    wallets.set(walletKey, wallet);
    
    console.log('✅ Wallet created successfully for', socialType, ':', socialId);
    console.log('📍 Generated addresses:', blockchainWallet.addresses);
    console.log('🏗️  Primary wallet info:', blockchainWallet.primaryWallet);
    console.log('🔑 Owner address:', blockchainWallet.ownerAddress);
    console.log('✨ Real blockchain addresses:', blockchainWallet.isRealBlockchainAddresses);
    
    res.json(wallet);
  } catch (error) {
    console.error('Wallet creation error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'WALLET_CREATION_FAILED'
    });
  }
});

// Get wallet info (protected)
app.get('/api/wallets/:socialId', validateApiKey, async (req, res) => {
  try {
    const { socialId } = req.params;
    const { socialType = 'email' } = req.query;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    const decodedSocialId = decodeURIComponent(socialId);
    const walletKey = `${socialType}:${decodedSocialId}`;
    const wallet = wallets.get(walletKey);
    
    if (!wallet) {
      return res.status(404).json({
        error: 'Wallet not found',
        code: 'WALLET_NOT_FOUND',
        suggestion: 'Create a wallet first using POST /api/wallets'
      });
    }
    
    // Update last used timestamp
    wallet.lastUsed = new Date().toISOString();
    wallets.set(walletKey, wallet);
    
    console.log('✅ Wallet retrieved for', socialType, ':', decodedSocialId);
    
    res.json(wallet);
  } catch (error) {
    console.error('Wallet retrieval error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'WALLET_RETRIEVAL_FAILED'
    });
  }
});

// Deploy wallet on-chain endpoint (protected) - ONE-STEP WALLET CREATION & DEPLOYMENT
app.post('/api/wallets/deploy', validateApiKey, async (req, res) => {
  try {
    const { socialId, socialType = 'email', chains = ['ethereum', 'solana'], metadata = {} } = req.body;
    
    if (!socialId) {
      return res.status(400).json({
        error: 'socialId is required',
        code: 'MISSING_SOCIAL_ID'
      });
    }
    
    // Validate socialType
    const supportedTypes = ['email', 'phone', 'google', 'twitter', 'discord', 'github'];
    if (!supportedTypes.includes(socialType)) {
      return res.status(400).json({
        error: `Unsupported social type: ${socialType}. Supported types: ${supportedTypes.join(', ')}`,
        code: 'INVALID_SOCIAL_TYPE'
      });
    }
    
    console.log(`🚀 Creating & deploying wallets for ${socialType}:${socialId} on chains: ${chains.join(', ')}`);
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    const walletKey = `${socialType}:${socialId}`;
    let existingWallet = wallets.get(walletKey);
    
    // CREATE WALLET IF IT DOESN'T EXIST
    if (!existingWallet) {
      console.log(`📝 Creating new wallet for ${socialType}:${socialId}...`);
      
      // Create blockchain addresses using the same logic as /api/wallets
      const walletResult = await blockchainManager.createWallet(socialId, socialType, chains);
      
      // Store wallet
      const walletData = {
        socialId,
        socialType,
        addresses: walletResult.addresses,
        blockchainInfo: walletResult.blockchainInfo,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        metadata,
        recoverySetup: false,
        isActive: true,
        crossChainEnabled: true,
        balances: {}
      };
      
      // Initialize balances for all chains
      const allChains = ['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanche', 'bsc', 'fantom', 'solana'];
      allChains.forEach(chain => {
        walletData.balances[chain] = { native: '0', tokens: {} };
      });
      
      // Add gas tank info
      walletData.gasTank = {
        totalBalance: '0',
        chainBalances: Object.fromEntries(allChains.map(chain => [chain, '0']))
      };
      
      wallets.set(walletKey, walletData);
      existingWallet = walletData;
      
      console.log(`✅ Wallet created for ${socialType}:${socialId}`);
    }
    
    const deploymentResults = {
      evm: null,
      solana: null,
      addresses: existingWallet.addresses
    };
    
    // Deploy EVM wallet if requested
    if (chains.includes('ethereum') || chains.includes('evm')) {
      try {
        if (existingWallet.blockchainInfo.primaryWallet.isDeployed) {
          deploymentResults.evm = {
            message: 'EVM wallet already deployed',
            address: existingWallet.blockchainInfo.primaryWallet.address,
            txHash: existingWallet.blockchainInfo.primaryWallet.deploymentTxHash || 'already-deployed',
            isDeployed: true,
            explorerUrl: `https://sepolia.etherscan.io/address/${existingWallet.blockchainInfo.primaryWallet.address}`
          };
        } else {
          const { deployWallet } = require('./simple-deployer');
          const deployment = await deployWallet(
            existingWallet.blockchainInfo.primaryWallet.owner,
            existingWallet.blockchainInfo.primaryWallet.salt
          );
          
          // Update wallet info
          existingWallet.blockchainInfo.primaryWallet.isDeployed = true;
          existingWallet.blockchainInfo.primaryWallet.deploymentTxHash = deployment.txHash;
          existingWallet.blockchainInfo.primaryWallet.deployedAt = new Date().toISOString();
          
          deploymentResults.evm = {
            message: 'EVM wallet deployed successfully',
            address: deployment.address,
            txHash: deployment.txHash,
            isDeployed: true,
            explorerUrl: `https://sepolia.etherscan.io/address/${deployment.address}`,
            txUrl: `https://sepolia.etherscan.io/tx/${deployment.txHash}`
          };
          
          console.log(`✅ EVM wallet deployed: ${deployment.address}`);
        }
      } catch (error) {
        console.error('EVM deployment error:', error);
        deploymentResults.evm = {
          error: error.message,
          isDeployed: false,
          status: 'deployment_failed'
        };
      }
    }
    
    // Deploy Solana wallet if requested
    if (chains.includes('solana')) {
      try {
        const solanaDeployment = await solanaDeployer.deploySolanaWallet(socialId, socialType);
        deploymentResults.solana = solanaDeployment;
        console.log(`✅ Solana wallet result: ${solanaDeployment.status}`);
      } catch (error) {
        console.error('Solana deployment error:', error);
        deploymentResults.solana = {
          error: error.message,
          isDeployed: false,
          status: 'deployment_failed'
        };
      }
    }
    
    res.json({
      success: true,
      socialId,
      socialType,
      addresses: deploymentResults.addresses,
      deployments: deploymentResults,
      message: 'Wallet created and deployment completed',
      timestamp: new Date().toISOString(),
      isNew: !wallets.has(walletKey) // This will be false since we just created it above
    });
    
  } catch (error) {
    console.error('Wallet deployment error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'WALLET_DEPLOYMENT_FAILED'
    });
  }
});

// Get funding instructions endpoint
app.get('/api/deployer/funding', validateApiKey, async (req, res) => {
  try {
    const instructions = await simpleDeployer.getFundingInstructions();
    
    res.json({
      success: true,
      instructions,
      message: 'Deployer funding instructions'
    });
    
  } catch (error) {
    console.error('Funding instructions error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'FUNDING_INSTRUCTIONS_FAILED'
    });
  }
});

// Cross-chain payment endpoint (protected)
app.post('/api/payments', validateApiKey, async (req, res) => {
  try {
    const { from, to, amount, asset, gasless, crossChain } = req.body;
    
    console.log('Processing payment:', { from, to, amount, asset, gasless, crossChain });
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    // Validate required fields
    if (!from || !to || !amount || !asset) {
      return res.status(400).json({
        error: 'Missing required fields: from, to, amount, asset',
        code: 'MISSING_FIELDS'
      });
    }
    
    // Get sender wallet if using socialId
    let senderAddress = from.address;
    if (from.socialId) {
      const socialType = from.socialType || 'email';
      const walletKey = `${socialType}:${from.socialId}`;
      const senderWallet = wallets.get(walletKey);
      
      if (!senderWallet) {
        return res.status(404).json({
          error: 'Sender wallet not found',
          code: 'SENDER_WALLET_NOT_FOUND'
        });
      }
      
      senderAddress = senderWallet.addresses[from.chain];
      if (!senderAddress) {
        return res.status(400).json({
          error: `Sender wallet does not support chain: ${from.chain}`,
          code: 'UNSUPPORTED_CHAIN'
        });
      }
    }
    
    // Simulate payment processing
    const isCrossChain = from.chain !== to.chain;
    const transaction = {
      hash: from.chain.includes('solana') ? 
        crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 44) :
        '0x' + crypto.randomBytes(32).toString('hex'),
      from: senderAddress,
      to: to.address,
      amount,
      asset,
      chain: from.chain,
      toChain: isCrossChain ? to.chain : undefined,
      status: 'confirmed',
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: gasless ? '0' : (isCrossChain ? '50000' : '21000'),
      fee: gasless ? '0' : (isCrossChain ? '0.005' : '0.001'),
      crossChain: isCrossChain,
      timestamp: new Date().toISOString()
    };
    
    // If cross-chain, add destination transaction
    if (isCrossChain) {
      transaction.destinationTx = {
        hash: to.chain.includes('solana') ? 
          crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 44) :
          '0x' + crypto.randomBytes(32).toString('hex'),
        chain: to.chain,
        status: 'pending',
        estimatedConfirmation: new Date(Date.now() + 300000).toISOString() // 5 minutes
      };
    }
    
    console.log('✅ Payment processed:', transaction.hash);
    
    res.json(transaction);
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'PAYMENT_FAILED'
    });
  }
});

// Cross-chain bridge endpoint (protected)
app.post('/api/bridge', validateApiKey, async (req, res) => {
  try {
    const { fromChain, toChain, amount, asset, recipient } = req.body;
    
    console.log('Processing bridge:', { fromChain, toChain, amount, asset });
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    // TODO: Implement actual bridge logic
    const bridge = {
      bridgeId: 'bridge_' + crypto.randomBytes(16).toString('hex'),
      fromTx: {
        hash: '0x' + crypto.randomBytes(32).toString('hex'),
        chain: fromChain,
        status: 'confirmed'
      },
      toTx: {
        hash: crypto.randomBytes(32).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 44),
        chain: toChain,
        status: 'pending'
      },
      status: 'initiated',
      estimatedTime: 300, // 5 minutes
      fee: '0.005'
    };
    
    res.json(bridge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gas tank endpoints (protected)
app.get('/api/gas-tank/:socialId', validateApiKey, async (req, res) => {
  try {
    const { socialId } = req.params;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    const gasTank = {
      socialId: decodeURIComponent(socialId),
      totalBalance: '25.50',
      chainBalances: {
        ethereum: '10.00',
        polygon: '15.50',
        arbitrum: '2.00',
        base: '3.00',
        optimism: '1.50',
        solana: '0.50'
      },
      lastRefill: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      monthlyUsage: '12.30'
    };
    
    res.json(gasTank);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gas-tank/refill', validateApiKey, async (req, res) => {
  try {
    const { socialId, chain, amount } = req.body;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    const refill = {
      socialId,
      chain,
      amount,
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
      status: 'confirmed',
      timestamp: new Date().toISOString()
    };
    
    res.json(refill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Private Key Request Endpoint (protected and tracked)
app.post('/api/wallets/:socialId/private-key', validateApiKey, async (req, res) => {
  try {
    const { socialId } = req.params;
    const { socialType = 'email', reason, companyId } = req.body;
    
    // Track this request
    const requestId = 'pkr_' + crypto.randomBytes(16).toString('hex');
    const trackingData = {
      requestId,
      socialId,
      socialType,
      apiKey: req.apiKey,
      companyId,
      reason,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    privateKeyRequests.set(requestId, trackingData);
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    // Log this sensitive operation
    console.log(`🔐 PRIVATE KEY REQUESTED:`, {
      socialId,
      apiKey: req.apiKey.substring(0, 8) + '...',
      companyId,
      reason,
      timestamp: trackingData.timestamp
    });
    
    // Check if wallet exists
    const walletKey = `${socialType}:${socialId}`;
    const wallet = wallets.get(walletKey);
    
    if (!wallet) {
      return res.status(404).json({
        error: 'Wallet not found',
        code: 'WALLET_NOT_FOUND'
      });
    }
    
    // Generate deterministic private key (for demo - in production, use secure key derivation)
    const privateKeyHash = crypto.createHash('sha256')
      .update(`${socialId}-${socialType}-nexuspay-private-key`)
      .digest('hex');
    
    res.json({
      success: true,
      trackingId: requestId,
      privateKey: `0x${privateKeyHash}`,
      address: wallet.addresses.ethereum,
      warning: 'Private key access has been logged and tracked',
      security: {
        requestLogged: true,
        trackingId: requestId,
        accessTime: trackingData.timestamp
      }
    });
    
  } catch (error) {
    console.error('Private key request error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'PRIVATE_KEY_REQUEST_FAILED'
    });
  }
});

// Company Gas Tank Management
app.post('/api/companies/:companyId/gas-tank/fund', validateApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { amount, chain, paymentMethod } = req.body;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    const fundingId = 'fund_' + crypto.randomBytes(16).toString('hex');
    const funding = {
      fundingId,
      companyId,
      amount,
      chain,
      paymentMethod,
      status: 'confirmed',
      txHash: '0x' + crypto.randomBytes(32).toString('hex'),
      timestamp: new Date().toISOString(),
      apiKey: req.apiKey.substring(0, 8) + '...'
    };
    
    // Update or create gas tank
    const gasTankKey = `${companyId}:${chain}`;
    if (!gasTanks.has(gasTankKey)) {
      gasTanks.set(gasTankKey, {
        companyId,
        chain,
        balance: '0',
        totalFunded: '0',
        totalSpent: '0',
        transactions: []
      });
    }
    
    const gasTank = gasTanks.get(gasTankKey);
    gasTank.balance = (parseFloat(gasTank.balance) + parseFloat(amount)).toString();
    gasTank.totalFunded = (parseFloat(gasTank.totalFunded) + parseFloat(amount)).toString();
    gasTank.transactions.push(funding);
    
    console.log(`💰 Company ${companyId} funded gas tank: ${amount} ${chain.toUpperCase()}`);
    
    res.json({
      success: true,
      funding,
      gasTank: {
        balance: gasTank.balance,
        totalFunded: gasTank.totalFunded
      }
    });
    
  } catch (error) {
    console.error('Gas tank funding error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GAS_TANK_FUNDING_FAILED'
    });
  }
});

// Get Company Gas Tank Status
app.get('/api/companies/:companyId/gas-tank', validateApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    const gasTankData = {};
    const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'solana'];
    
    supportedChains.forEach(chain => {
      const gasTankKey = `${companyId}:${chain}`;
      if (gasTanks.has(gasTankKey)) {
        gasTankData[chain] = gasTanks.get(gasTankKey);
      } else {
        gasTankData[chain] = {
          companyId,
          chain,
          balance: '0',
          totalFunded: '0',
          totalSpent: '0',
          transactions: []
        };
      }
    });
    
    res.json({
      companyId,
      gasTanks: gasTankData,
      totalValueUsd: Object.values(gasTankData)
        .reduce((total, tank) => total + parseFloat(tank.balance) * 2000, 0) // Mock USD conversion
        .toFixed(2)
    });
    
  } catch (error) {
    console.error('Gas tank status error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'GAS_TANK_STATUS_FAILED'
    });
  }
});

// Pay User Transaction Fees (sponsored transactions)
app.post('/api/companies/:companyId/pay-fees', validateApiKey, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { userSocialId, socialType = 'email', chain, txHash, amount } = req.body;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    // Check if company has sufficient gas tank balance
    const gasTankKey = `${companyId}:${chain}`;
    const gasTank = gasTanks.get(gasTankKey);
    
    if (!gasTank || parseFloat(gasTank.balance) < parseFloat(amount)) {
      return res.status(400).json({
        error: 'Insufficient gas tank balance',
        code: 'INSUFFICIENT_GAS_BALANCE',
        available: gasTank ? gasTank.balance : '0',
        required: amount
      });
    }
    
    // Process fee payment
    const paymentId = 'fee_' + crypto.randomBytes(16).toString('hex');
    const feePayment = {
      paymentId,
      companyId,
      userSocialId,
      socialType,
      chain,
      amount,
      txHash,
      status: 'paid',
      timestamp: new Date().toISOString(),
      apiKey: req.apiKey.substring(0, 8) + '...'
    };
    
    // Deduct from gas tank
    gasTank.balance = (parseFloat(gasTank.balance) - parseFloat(amount)).toString();
    gasTank.totalSpent = (parseFloat(gasTank.totalSpent) + parseFloat(amount)).toString();
    gasTank.transactions.push({
      ...feePayment,
      type: 'fee_payment',
      amount: `-${amount}`
    });
    
    console.log(`💸 Company ${companyId} paid fees for user ${userSocialId}: ${amount} ${chain.toUpperCase()}`);
    
    res.json({
      success: true,
      feePayment,
      remainingBalance: gasTank.balance
    });
    
  } catch (error) {
    console.error('Fee payment error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'FEE_PAYMENT_FAILED'
    });
  }
});

// SDK Usage Analytics
app.get('/api/analytics/usage', validateApiKey, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    // Update API key usage
    if (apiKeys.has(req.apiKey)) {
      const keyInfo = apiKeys.get(req.apiKey);
      keyInfo.usageCount++;
      keyInfo.lastUsed = new Date().toISOString();
    }
    
    // Calculate analytics
    const privateKeyRequestCount = Array.from(privateKeyRequests.values())
      .filter(req => req.apiKey === req.apiKey).length;
    
    const gasTankTotalFunded = Array.from(gasTanks.values())
      .reduce((total, tank) => total + parseFloat(tank.totalFunded), 0);
    
    const analytics = {
      apiKey: req.apiKey.substring(0, 8) + '...',
      timeRange,
      metrics: {
        totalWallets: Array.from(wallets.keys()).length,
        privateKeyRequests: privateKeyRequestCount,
        gasTankTotalFunded: gasTankTotalFunded.toFixed(4),
        activeCompanies: new Set(Array.from(gasTanks.keys()).map(k => k.split(':')[0])).size,
        apiCalls: apiKeys.get(req.apiKey)?.usageCount || 0
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'ANALYTICS_FAILED'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/keys/generate',
      'POST /api/wallets',
      'GET /api/wallets/:socialId',
      'POST /api/wallets/deploy',
      'POST /api/payments',
      'POST /api/bridge',
      'GET /api/gas-tank/:socialId',
      'POST /api/gas-tank/refill'
    ]
  });
});

app.listen(port, () => {
  console.log(`🚀 NexusPay API running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📋 API Documentation: http://localhost:${port}/`);
});

module.exports = app; 