# NexusSDK v2.0 - Enterprise Cross-Chain Wallet Infrastructure

> **Production-ready wallet infrastructure** with unified addresses, gas tank management, private key tracking, and complete usage analytics.

## 🚀 Enterprise Features

### ✅ **Unified Addresses**
- **Same EVM address** across Ethereum, Polygon, Arbitrum, Base, Optimism, etc.
- **Separate Solana addresses** for SVM ecosystem
- **One-step deployment** - create and deploy wallets instantly

### ✅ **Gas Tank Management**
- **Company funding** - Fund gas tanks for sponsored transactions
- **Multi-chain support** - Manage gas across all networks
- **Real-time tracking** - Monitor usage and costs

### ✅ **Private Key Tracking**
- **Complete audit trail** - Every private key request logged
- **Compliance ready** - Track who, when, why, and where
- **Security monitoring** - Real-time access alerts

### ✅ **Usage Analytics**
- **Real-time dashboard** - Monitor user activity
- **Cost tracking** - Track gas spending and optimization
- **Company metrics** - Wallet creation, usage patterns

## 📦 Quick Start

```bash
npm install @nexuspay/sdk
```

```typescript
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: 'your-api-key',
  chains: ['ethereum', 'polygon', 'solana'],
  endpoints: {
    api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
  }
});

// Create unified wallet
const wallet = await sdk.createWallet({
  socialId: 'user@company.com',
  socialType: 'email',
  chains: ['ethereum', 'polygon', 'solana']
});

// Fund company gas tank
await sdk.fundGasTank({
  companyId: 'your-company',
  amount: '10.0',
  chain: 'ethereum'
});

// Pay user transaction fees
await sdk.payUserFees({
  companyId: 'your-company',
  userSocialId: 'user@company.com',
  chain: 'ethereum',
  txHash: '0x...',
  amount: '0.005'
});
```

## 🌐 Production Endpoints

### API Endpoint
```
🔗 Production API: https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app
🏥 Health Check: https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app/health
🔑 Generate API Key: https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app/api/keys/generate
```

### Live Dashboard
```
📊 Production Dashboard: https://dashboard-nexuspay.vercel.app
📈 Real-time Analytics: Monitor all your users and gas tanks
🔐 Security Logs: Track private key access requests
```

### Development
```
🏠 Local API: http://localhost:3001
📊 Local Dashboard: http://localhost:3001/dashboard
```

## 🎮 Perfect for Gaming Companies

**PlayEarn Example:**
```typescript
class PlayEarnPlatform {
  private sdk = new NexusSDK({ 
    apiKey: 'your-key',
    endpoints: {
      api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
    }
  });
  
  // User signup with unified wallet
  async onUserSignup(email: string) {
    return await this.sdk.createWallet({
      socialId: email,
      socialType: 'email',
      chains: ['ethereum', 'polygon', 'solana']
    });
  }
  
  // Company pays all user transaction fees
  async payoutRewards(userEmail: string, txHash: string) {
    return await this.sdk.payUserFees({
      companyId: 'playearn-xyz',
      userSocialId: userEmail,
      chain: 'ethereum',
      txHash,
      amount: '0.005'
    });
  }
}
```

## 📊 Live Dashboard

Monitor your users in real-time:

```
🌐 Production Dashboard: https://dashboard-nexuspay.vercel.app
📊 Metrics:
  - Total wallets created
  - Private key access logs
  - Gas tank balances
  - Cross-chain activity
  - Company usage analytics
```

## 🔧 Core Methods

### `createWallet(params)`
Create unified wallet with instant deployment across all chains.

### `getPrivateKey(params)`
Get private key with complete tracking and audit trail.

### `fundGasTank(params)`
Fund company gas tank for sponsored transactions.

### `payUserFees(params)`
Pay transaction fees for users seamlessly.

### `getGasTankStatus(companyId)`
Get real-time gas tank status across all chains.

## 🚀 Getting Started

### 1. Generate API Key
```bash
curl -X POST https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app/api/keys/generate \
  -H "Content-Type: application/json" \
  -d '{"email":"you@company.com","projectName":"Your Project"}'
```

### 2. Install SDK
```bash
npm install @nexuspay/sdk
```

### 3. Initialize
```typescript
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: 'npay_your-generated-key',
  endpoints: {
    api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
  }
});
```

### 4. Monitor Usage
Visit the live dashboard: https://dashboard-nexuspay.vercel.app

## 🎯 Use Cases

- **Gaming Platforms**: Sponsor all user transactions
- **DeFi Applications**: Unified experience across chains  
- **Enterprise Apps**: Company-managed wallet infrastructure
- **Compliance**: Complete audit trail and monitoring

## 🌟 Why Choose NexusSDK?

✅ **Production Ready** - Real blockchain deployments  
✅ **Enterprise Grade** - Gas tanks, tracking, analytics  
✅ **Developer Friendly** - Simple API, TypeScript support  
✅ **Cross-Chain Native** - EVM + Solana out of the box  
✅ **Cost Efficient** - Unified addresses reduce deployment costs  
✅ **Compliance Ready** - Complete logging and audit trails  

---

**🚀 Get Started:** [Generate API Key](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app/api/keys/generate) | 📊 [Live Dashboard](https://dashboard-nexuspay.vercel.app) | 📖 [API Documentation](./API_REFERENCE.md) 