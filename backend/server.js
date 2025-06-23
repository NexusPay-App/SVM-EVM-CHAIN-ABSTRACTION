const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint (required by SDK test)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'nexus-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NexusDeFi Backend is running!',
    service: 'nexus-api',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      wallets: '/api/wallets',
      payments: '/api/payments',
      bridge: '/api/bridge'
    }
  });
});

// Wallet Management Routes
app.post('/api/wallets', async (req, res) => {
  try {
    const { socialId, socialType, chains, metadata } = req.body;
    
    console.log('Creating wallet for:', socialId);
    
    // TODO: Implement actual wallet creation with your smart contracts
    // For now, return mock data that matches your SDK expectations
    const wallet = {
      socialId,
      socialType,
      addresses: {
        ethereum: '0x' + Math.random().toString(16).substr(2, 40),
        polygon: '0x' + Math.random().toString(16).substr(2, 40),
        arbitrum: '0x' + Math.random().toString(16).substr(2, 40),
        base: '0x' + Math.random().toString(16).substr(2, 40),
        solana: Math.random().toString(36).substr(2, 44)
      },
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      metadata: metadata || {},
      recoverySetup: false,
      isActive: true,
      crossChainEnabled: true
    };
    
    res.json(wallet);
  } catch (error) {
    console.error('Wallet creation error:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'WALLET_CREATION_FAILED'
    });
  }
});

// Get wallet info
app.get('/api/wallets/:socialId', async (req, res) => {
  try {
    const { socialId } = req.params;
    
    // TODO: Implement actual wallet lookup
    const wallet = {
      socialId: decodeURIComponent(socialId),
      socialType: 'email',
      addresses: {
        ethereum: '0x' + Math.random().toString(16).substr(2, 40),
        polygon: '0x' + Math.random().toString(16).substr(2, 40),
        arbitrum: '0x' + Math.random().toString(16).substr(2, 40),
        base: '0x' + Math.random().toString(16).substr(2, 40),
        solana: Math.random().toString(36).substr(2, 44)
      },
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      recoverySetup: true,
      isActive: true,
      crossChainEnabled: true
    };
    
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cross-chain payment endpoint
app.post('/api/payments', async (req, res) => {
  try {
    const { from, to, amount, asset, gasless } = req.body;
    
    console.log('Processing payment:', { from: from.chain, to: to.chain, amount, asset });
    
    // TODO: Implement actual payment processing
    const transaction = {
      hash: '0x' + Math.random().toString(16).substr(2, 64),
      from: from.address || '0x' + Math.random().toString(16).substr(2, 40),
      to: to.address,
      amount,
      chain: from.chain,
      status: 'pending',
      gasUsed: gasless ? '0' : '21000',
      fee: gasless ? '0' : '0.001',
      timestamp: new Date().toISOString()
    };
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cross-chain bridge endpoint
app.post('/api/bridge', async (req, res) => {
  try {
    const { fromChain, toChain, amount, asset, recipient } = req.body;
    
    console.log('Processing bridge:', { fromChain, toChain, amount, asset });
    
    // TODO: Implement actual bridge logic
    const bridge = {
      bridgeId: 'bridge_' + Math.random().toString(36).substr(2, 16),
      fromTx: {
        hash: '0x' + Math.random().toString(16).substr(2, 64),
        chain: fromChain,
        status: 'confirmed'
      },
      toTx: {
        hash: Math.random().toString(36).substr(2, 44),
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

// Gas tank endpoints
app.get('/api/gas-tank/:socialId', async (req, res) => {
  try {
    const { socialId } = req.params;
    
    const gasTank = {
      socialId: decodeURIComponent(socialId),
      balances: {
        ethereum: '0.05',
        polygon: '0.1',
        arbitrum: '0.02',
        base: '0.03',
        solana: '0.01'
      },
      totalUSD: '25.50'
    };
    
    res.json(gasTank);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gas-tank/refill', async (req, res) => {
  try {
    const { socialId, chain, amount } = req.body;
    
    const refill = {
      socialId,
      chain,
      amount,
      txHash: '0x' + Math.random().toString(16).substr(2, 64),
      status: 'confirmed',
      timestamp: new Date().toISOString()
    };
    
    res.json(refill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    code: 'INTERNAL_SERVER_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

app.listen(port, () => {
  console.log(`🚀 NexusDeFi Backend listening at http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 Ready for ngrok tunneling!`);
}); 