# 🚀 NexusSDK Developer Quickstart v1.1.1

**Get started with cross-chain wallet creation in 5 minutes**

## 📦 Installation

```bash
npm install @nexuspay/sdk
```

## 🔑 Get Your API Key

Visit [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/) to generate your free API key.

## ⚡ Quick Start

```typescript
import { NexusSDK } from '@nexuspay/sdk';

// Initialize SDK
const sdk = new NexusSDK({
  apiKey: 'your-api-key-here',
  environment: 'production',
  chains: ['ethereum', 'solana']
});

// Connect and verify
await sdk.initialize();

// Create your first wallet
const wallet = await sdk.createWallet({
  socialId: 'user@yourapp.com',
  socialType: 'email',
  chains: ['ethereum', 'solana'],
  paymaster: true // Your app pays gas fees
});

console.log('🎉 Wallet created!');
console.log('Ethereum:', wallet.addresses.ethereum);
console.log('Solana:', wallet.addresses.solana);
```

## 🎯 Core Use Cases

### 1. Gaming Platform

```typescript
// Create wallets for game players
const gameWallet = await sdk.createWallet({
  socialId: 'player_12345',
  socialType: 'gamePlayerId',
  chains: ['ethereum', 'polygon'],
  paymaster: true,
  metadata: {
    level: 50,
    guild: 'DragonWarriors',
    achievements: ['First Blood', 'Legendary']
  }
});

// Check if player already has a wallet
const existingWallet = await sdk.getWallet('player_12345', 'gamePlayerId');
```

### 2. NFT Marketplace

```typescript
// Create wallets for NFT collectors
const nftWallet = await sdk.createWallet({
  socialId: 'collector_rare_apes',
  socialType: 'nftCollectorId',
  chains: ['ethereum'],
  paymaster: false, // User pays gas
  metadata: {
    collection: 'BoredApes',
    rarityTier: 'Ultra Rare',
    collectionSize: 25
  }
});
```

### 3. Enterprise Platform

```typescript
// Create wallets for employees
const empWallet = await sdk.createWallet({
  socialId: 'emp_jane_doe_12345',
  socialType: 'employeeId',
  chains: ['ethereum', 'base'],
  paymaster: true, // Company pays
  metadata: {
    department: 'Engineering',
    role: 'Senior Developer',
    clearanceLevel: 'L5'
  }
});
```

## 🔄 Batch Operations

### Efficient Bulk Wallet Creation

```typescript
// Create multiple wallets at once
const walletRequests = [
  { socialId: 'user1', socialType: 'gameId', chains: ['ethereum'], paymaster: true },
  { socialId: 'user2', socialType: 'gameId', chains: ['solana'], paymaster: false },
  { socialId: 'user3', socialType: 'gameId', chains: ['ethereum', 'solana'], paymaster: true }
];

const results = await sdk.createWalletBatch(walletRequests);
console.log(`Created ${results.filter(r => !r.error).length} wallets successfully`);
```

### Batch Status Check

```typescript
const walletIds = [
  { socialId: 'user1', socialType: 'gameId' },
  { socialId: 'user2', socialType: 'email' },
  { socialId: 'user3', socialType: 'employeeId' }
];

const wallets = await sdk.getWalletBatch(walletIds);
```

## 🏗️ Third-Party Integration

### Health Monitoring

```typescript
// Monitor API and SDK health
const health = await sdk.healthCheck();
console.log('API Status:', health.status);
console.log('SDK Version:', health.sdk.version);
console.log('Cache Size:', health.sdk.cacheSize);
```

### Webhook Integration

```typescript
// Generate safe webhook identifiers
const webhookId = sdk.generateWebhookId('user@app.com', 'email');

// Store this ID in your webhook system
// Later, parse it back when receiving webhooks
const { socialId, socialType } = sdk.parseWebhookId(webhookId);
```

### Configuration Validation

```typescript
// Validate your SDK setup
const validation = sdk.validateConfig();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
  // Handle invalid config
}
```

### Performance Monitoring

```typescript
// Get SDK statistics
const stats = sdk.getStats();
console.log('Supported chains:', stats.supportedChains);
console.log('Environment:', stats.environment);
console.log('Cache efficiency:', stats.cacheSize);
```

## 💰 Gas Payment Options

### Company-Sponsored (Paymaster ON)

```typescript
const wallet = await sdk.createWallet({
  socialId: 'premium_user',
  socialType: 'email',
  chains: ['ethereum'],
  paymaster: true // Your app pays all gas fees
});
// Best for: Gaming, Enterprise, Premium services
```

### User-Paid (Paymaster OFF)

```typescript
const wallet = await sdk.createWallet({
  socialId: 'basic_user',
  socialType: 'email',
  chains: ['ethereum'],
  paymaster: false // User pays their own gas
});
// Best for: DeFi, Public marketplaces, Community projects
```

## 🔧 Performance Optimization

### Caching Strategy

```typescript
// SDK automatically caches GET requests for 5 minutes
const wallet1 = await sdk.getWallet('user1', 'email'); // API call
const wallet2 = await sdk.getWallet('user1', 'email'); // Cached (faster)

// Force fresh data when needed
sdk.clearCache();
const freshWallet = await sdk.getWallet('user1', 'email'); // New API call
```

### Efficient Chain Selection

```typescript
// For gaming (fast, cheap transactions)
const gameWallet = await sdk.createWallet({
  socialId: 'gamer123',
  socialType: 'gameId',
  chains: ['polygon', 'base'], // Fast & cheap
  paymaster: true
});

// For DeFi (security focused)
const defiWallet = await sdk.createWallet({
  socialId: 'trader456',
  socialType: 'traderId',
  chains: ['ethereum'], // Most secure
  paymaster: false
});

// For cross-chain apps
const crossWallet = await sdk.createWallet({
  socialId: 'multichain_user',
  socialType: 'email',
  chains: ['ethereum', 'solana'], // Best of both worlds
  paymaster: true
});
```

## 🛡️ Error Handling

### Comprehensive Error Handling

```typescript
async function createWalletSafely(userId: string) {
  try {
    // Validate config first
    const validation = sdk.validateConfig();
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    // Create wallet
    const wallet = await sdk.createWallet({
      socialId: userId,
      socialType: 'email',
      chains: ['ethereum']
    });

    return { success: true, wallet };
  } catch (error) {
    console.error('Wallet creation failed:', error.message);
    
    // Handle specific errors
    if (error.message.includes('API key')) {
      return { success: false, error: 'Invalid API key' };
    }
    
    if (error.message.includes('rate limit')) {
      return { success: false, error: 'Rate limited, try again later' };
    }
    
    return { success: false, error: 'Unknown error occurred' };
  }
}
```

## 📱 Framework Examples

### React Integration

```typescript
import React, { useState, useEffect } from 'react';
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: process.env.REACT_APP_NEXUS_API_KEY,
  environment: 'production',
  chains: ['ethereum', 'solana']
});

function WalletCreator() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sdk.initialize();
  }, []);

  const createWallet = async (userId: string) => {
    setLoading(true);
    try {
      const newWallet = await sdk.createWallet({
        socialId: userId,
        socialType: 'email',
        chains: ['ethereum', 'solana'],
        paymaster: true
      });
      setWallet(newWallet);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => createWallet('user@app.com')} disabled={loading}>
        {loading ? 'Creating...' : 'Create Wallet'}
      </button>
      {wallet && (
        <div>
          <p>Ethereum: {wallet.addresses.ethereum}</p>
          <p>Solana: {wallet.addresses.solana}</p>
        </div>
      )}
    </div>
  );
}
```

### Next.js API Route

```typescript
// pages/api/create-wallet.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY!,
  environment: 'production',
  chains: ['ethereum', 'solana']
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await sdk.initialize();
    
    const { socialId, socialType, paymaster } = req.body;
    
    const wallet = await sdk.createWallet({
      socialId,
      socialType,
      chains: ['ethereum', 'solana'],
      paymaster
    });

    res.status(200).json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

### Node.js Express

```typescript
import express from 'express';
import { NexusSDK } from '@nexuspay/sdk';

const app = express();
app.use(express.json());

const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY!,
  environment: 'production',
  chains: ['ethereum', 'solana']
});

// Initialize SDK on startup
sdk.initialize().then(() => {
  console.log('NexusSDK initialized');
});

app.post('/api/wallets', async (req, res) => {
  try {
    const { socialId, socialType, chains, paymaster } = req.body;
    
    const wallet = await sdk.createWallet({
      socialId,
      socialType,
      chains: chains || ['ethereum', 'solana'],
      paymaster: paymaster !== false // Default to true
    });

    res.json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 🚀 Production Checklist

### Before Going Live

- [ ] **API Key**: Get production API key from [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/)
- [ ] **Environment**: Set `environment: 'production'`
- [ ] **Error Handling**: Implement comprehensive error handling
- [ ] **Rate Limiting**: Handle rate limit responses gracefully
- [ ] **Monitoring**: Set up health checks and monitoring
- [ ] **Caching**: Understand caching behavior for your use case
- [ ] **Gas Strategy**: Choose appropriate paymaster settings
- [ ] **Testing**: Test wallet creation on both EVM and SVM chains

### Security Best Practices

```typescript
// ✅ Good: Server-side API key
const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY, // Environment variable
  environment: 'production'
});

// ❌ Bad: Client-side API key exposure
const sdk = new NexusSDK({
  apiKey: 'npay_your_actual_key_here', // Never do this!
  environment: 'production'
});
```

## 📊 Monitoring & Analytics

### Basic Monitoring

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await sdk.healthCheck();
    res.json({
      status: 'ok',
      nexus: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// SDK statistics
app.get('/stats', (req, res) => {
  const stats = sdk.getStats();
  res.json(stats);
});
```

## 🔗 Next Steps

1. **Read API Reference**: Check [API_REFERENCE.md](./API_REFERENCE.md) for complete method documentation
2. **Explore Examples**: Look at [examples/](./examples/) for more use cases
3. **Join Community**: Get support and share feedback
4. **Production Deploy**: Follow the production checklist above

## 📚 Additional Resources

- **API Documentation**: [API_REFERENCE.md](./API_REFERENCE.md)
- **Live API**: [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/)
- **GitHub**: [Repository](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION)
- **NPM Package**: [@nexuspay/sdk](https://www.npmjs.com/package/@nexuspay/sdk)

---

**Need Help?** Open an issue on [GitHub](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/issues) or check our documentation. 