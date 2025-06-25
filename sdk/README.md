# NexusSDK v1.1.1 ⚡

**Production-Ready Cross-Chain Wallet SDK for Third-Party Applications**

[![NPM Version](https://img.shields.io/npm/v/@nexuspay/sdk)](https://www.npmjs.com/package/@nexuspay/sdk)
[![License](https://img.shields.io/npm/l/@nexuspay/sdk)](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/@nexuspay/sdk)](https://www.npmjs.com/package/@nexuspay/sdk)

Create real blockchain wallets for **any social identifier** on both **Ethereum** and **Solana** with a single API call. Perfect for gaming platforms, enterprise applications, NFT marketplaces, and DeFi protocols.

## 🚀 Quick Start

```bash
npm install @nexuspay/sdk
```

```typescript
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: 'your-api-key', // Get from https://backend-amber-zeta-94.vercel.app/
  environment: 'production',
  chains: ['ethereum', 'solana']
});

await sdk.initialize();

// Create real blockchain wallets instantly
const wallet = await sdk.createWallet({
  socialId: 'user@yourapp.com',
  socialType: 'email',
  chains: ['ethereum', 'solana'],
  paymaster: true // Your app pays gas fees
});

console.log('✅ Real wallets deployed!');
console.log('🔗 Ethereum:', wallet.addresses.ethereum);
console.log('⚡ Solana:', wallet.addresses.solana);
```

## ✨ Key Features

### 🔧 **Third-Party Ready**
- **Request Caching**: Automatic 5-minute caching for better performance
- **Batch Operations**: Create multiple wallets efficiently
- **Health Monitoring**: Built-in health checks and statistics
- **Webhook Support**: Safe identifier generation for webhook systems
- **Configuration Validation**: Ensure proper SDK setup

### ⚡ **Real Blockchain Deployment**
- **EVM Chains**: Smart contract wallets on Ethereum, Polygon, Arbitrum, Base, Optimism
- **SVM Chains**: Native account creation on Solana
- **Instant Deployment**: Wallets are immediately visible on block explorers
- **Unified Addresses**: Same address across all EVM chains

### 💰 **Flexible Gas Payment**
- **Paymaster ON**: Your app pays all gas fees (perfect for gaming/enterprise)
- **Paymaster OFF**: Users pay their own gas fees (great for DeFi/marketplaces)
- **Real-time Control**: Set gas payment per wallet creation

### 🎯 **Unlimited Social Types**
Create wallets for ANY identifier type:
```typescript
// Gaming
{ socialId: 'player_123', socialType: 'gamePlayerId' }
// Enterprise  
{ socialId: 'emp_jane_doe', socialType: 'employeeId' }
// NFT Communities
{ socialId: 'ape_holder_rare', socialType: 'nftCollectorId' }
// Custom Business Logic
{ socialId: 'premium_tier_3', socialType: 'customerTierId' }
```

## 🎮 Perfect For Gaming

```typescript
// Create wallets for 1000 players instantly
const playerWallets = await sdk.createWalletBatch([
  { socialId: 'player_001', socialType: 'gameId', chains: ['polygon'], paymaster: true },
  { socialId: 'player_002', socialType: 'gameId', chains: ['polygon'], paymaster: true },
  // ... more players
]);

// All gas fees sponsored by your game
console.log(`🎮 ${playerWallets.length} player wallets ready!`);
```

## 🏢 Enterprise Ready

```typescript
// Employee wallet system
const employeeWallet = await sdk.createWallet({
  socialId: 'emp_engineering_jane_doe_001',
  socialType: 'enterpriseEmployeeId',
  chains: ['ethereum', 'base'],
  paymaster: true, // Company sponsors all transactions
  metadata: {
    department: 'Engineering',
    clearanceLevel: 'L5',
    startDate: '2024-01-15'
  }
});

// Webhook integration
const webhookId = sdk.generateWebhookId(
  'emp_engineering_jane_doe_001', 
  'enterpriseEmployeeId'
);
```

## 🎨 NFT Marketplace Integration

```typescript
// Collector wallets with metadata
const collectorWallet = await sdk.createWallet({
  socialId: 'whale_collector_ultra_rare',
  socialType: 'nftCollectorTier',
  chains: ['ethereum'],
  paymaster: false, // Collectors pay their own gas
  metadata: {
    tier: 'Ultra Rare',
    collections: ['BoredApes', 'CryptoPunks'],
    totalValue: '500 ETH'
  }
});
```

## 📊 Third-Party Integration Features

### Health Monitoring
```typescript
const health = await sdk.healthCheck();
console.log('API Status:', health.status);
console.log('SDK Version:', health.sdk.version);
```

### Performance Analytics
```typescript
const stats = sdk.getStats();
console.log('Cache Hit Rate:', stats.cacheSize);
console.log('Supported Chains:', stats.supportedChains);
```

### Batch Operations
```typescript
// Efficient bulk operations
const results = await sdk.createWalletBatch(requests);
const wallets = await sdk.getWalletBatch(walletIds);
```

### Webhook Integration
```typescript
// Safe webhook identifiers
const webhookId = sdk.generateWebhookId(socialId, socialType);
const { socialId, socialType } = sdk.parseWebhookId(webhookId);
```

## 🌐 Production Endpoint

**Base URL**: `https://backend-amber-zeta-94.vercel.app`

### Get Your API Key
Visit [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/) to generate your production API key.

### Core Endpoints
- `POST /api/wallets/deploy` - Create and deploy wallets
- `GET /api/wallets/{socialId}` - Get wallet information  
- `GET /health` - API health check
- `POST /api/payments` - Cross-chain payments

## 🔧 Configuration Options

```typescript
const sdk = new NexusSDK({
  apiKey: 'your-api-key',           // Required: Get from production URL
  environment: 'production',        // 'production' | 'development'
  chains: ['ethereum', 'solana'],   // Supported chains to use
  endpoints: {
    api: 'https://backend-amber-zeta-94.vercel.app' // Production endpoint
  }
});
```

## 📚 Documentation

- **[Quick Start Guide](./DEVELOPER_QUICKSTART.md)** - Get started in 5 minutes
- **[Complete API Reference](./API_REFERENCE.md)** - All methods and endpoints
- **[GitHub Repository](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION)** - Source code and examples

## 🛠️ Framework Examples

### React Hook
```typescript
import { NexusSDK } from '@nexuspay/sdk';

function useWallet() {
  const [sdk] = useState(() => new NexusSDK({
    apiKey: process.env.REACT_APP_NEXUS_API_KEY,
    environment: 'production'
  }));

  useEffect(() => {
    sdk.initialize();
  }, []);

  return { sdk };
}
```

### Next.js API Route
```typescript
// pages/api/create-wallet.ts
const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY!,
  environment: 'production'
});

export default async function handler(req, res) {
  const wallet = await sdk.createWallet(req.body);
  res.json({ success: true, wallet });
}
```

### Express.js Integration
```typescript
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY,
  environment: 'production'
});

app.post('/wallets', async (req, res) => {
  const wallet = await sdk.createWallet(req.body);
  res.json(wallet);
});
```

## 🔐 Security & Best Practices

### ✅ Secure API Key Storage
```typescript
// ✅ Good: Server-side environment variable
const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY
});

// ❌ Bad: Client-side exposure
const sdk = new NexusSDK({
  apiKey: 'npay_your_key_here' // Never expose keys!
});
```

### ✅ Error Handling
```typescript
try {
  const wallet = await sdk.createWallet(options);
  return { success: true, wallet };
} catch (error) {
  if (error.message.includes('rate limit')) {
    return { error: 'Rate limited, try again later' };
  }
  return { error: 'Wallet creation failed' };
}
```

## 📈 Performance Features

- **Request Caching**: 5-minute cache for GET requests
- **Batch Operations**: Create multiple wallets efficiently  
- **Connection Pooling**: Optimized for high-throughput applications
- **Rate Limiting**: 1000 requests/minute in production

## 🌊 Supported Chains

### EVM Chains (Unified Addresses)
- **Ethereum** - Mainnet + Sepolia Testnet
- **Polygon** - Mainnet + Mumbai Testnet  
- **Arbitrum** - Mainnet + Goerli Testnet
- **Base** - Mainnet + Goerli Testnet
- **Optimism** - Mainnet + Goerli Testnet
- **Avalanche** - Mainnet + Fuji Testnet
- **BSC** - Mainnet + Testnet

### SVM Chains
- **Solana** - Mainnet + Devnet + Testnet

## 💡 Use Cases

### 🎮 Gaming Platforms
- Player wallet creation with game currency
- Guild treasury management
- NFT reward distribution
- Sponsored gas for better UX

### 🏢 Enterprise Applications
- Employee crypto payment systems
- Company treasury management
- Compliance-ready wallet tracking
- Department-specific wallet organization

### 🎨 NFT Marketplaces
- Collector wallet management
- Creator payout systems
- Royalty distribution
- Community membership wallets

### 💰 DeFi Protocols
- User wallet abstraction
- Protocol treasury management
- Yield farming automation
- Cross-chain liquidity management

## 📞 Support

- **Documentation**: Complete guides in this repository
- **API Key Generation**: [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/)
- **GitHub Issues**: [Report bugs or request features](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/issues)
- **NPM Package**: [@nexuspay/sdk](https://www.npmjs.com/package/@nexuspay/sdk)

## 📝 License

MIT License - see [LICENSE](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/LICENSE) for details.

---

**Ready to deploy real blockchain wallets in your app?** 🚀

Get your API key at [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/) and start building! 