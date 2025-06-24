# 🚀 NexusPay SDK - Cross-Chain Wallet Infrastructure

[![NPM Version](https://img.shields.io/npm/v/@nexuspay/sdk.svg)](https://npmjs.com/package/@nexuspay/sdk)
[![GitHub Repository](https://img.shields.io/badge/GitHub-NexusPay%2FSVM--EVM--CHAIN--ABSTRACTION-blue)](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION)
[![License](https://img.shields.io/npm/l/@nexuspay/sdk.svg)](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-nexuspay.dev-green)](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app)

> **The most powerful cross-chain wallet SDK supporting both EVM and Solana (SVM) networks with gasless transactions, account abstraction, and seamless asset bridging.**

## 🌟 What Makes NexusPay Different?

NexusPay is the **first SDK** to offer native support for both **EVM** (Ethereum Virtual Machine) and **SVM** (Solana Virtual Machine) networks in a single, unified interface. Unlike other wallet SDKs that focus only on Ethereum-based chains, NexusPay bridges the gap between the two largest blockchain ecosystems.

### 🔥 Key Features

- **🌐 True Cross-Chain**: Native support for 12+ EVM chains + Solana
- **⛽ Gasless Transactions**: Users never worry about gas fees
- **🔐 Account Abstraction**: Social logins, email-based recovery
- **🌉 Cross-Chain Bridge**: Move assets between Ethereum and Solana
- **🎯 Developer-First**: Simple API, comprehensive docs, TypeScript support
- **📱 React Components**: Ready-to-use UI components for React apps
- **🚀 Production Ready**: Battle-tested smart contracts, enterprise-grade security

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [API Key Generation](#-api-key-generation)
- [Basic Usage](#-basic-usage)
- [Advanced Features](#-advanced-features)
- [React Integration](#-react-integration)
- [Supported Networks](#-supported-networks)
- [API Reference](#-api-reference)
- [Examples](#-examples)
- [Contributing](#-contributing)
- [Links & Resources](#-links--resources)

## ⚡ Quick Start

Get up and running with NexusPay in under 5 minutes:

### 1. Get Your API Key

Visit [**NexusPay API Console**](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app) to generate your free API key:

```
📧 Email: your-email@domain.com
📝 Project Name: My Awesome DApp
🌐 Website: https://mydapp.com
```

### 2. Install the SDK

```bash
npm install @nexuspay/sdk
# or
yarn add @nexuspay/sdk
```

### 3. Initialize and Create Your First Wallet

```javascript
import { NexusSDK, Utils } from '@nexuspay/sdk';

// Initialize with your API key
const sdk = new NexusSDK({
  apiKey: 'npay_your_api_key_here',
  environment: 'production',
  chains: ['ethereum', 'polygon', 'solana'],
  endpoints: {
    api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
  }
});

await sdk.initialize();

// Create a multi-chain wallet with social login
const wallet = await sdk.createWallet({
  socialId: 'user@example.com',
  socialType: 'email',
  chains: ['ethereum', 'polygon', 'solana'],
  metadata: {
    name: 'John Doe',
    email: 'user@example.com'
  }
});

console.log('🎉 Wallet created!');
console.log('Ethereum:', wallet.addresses.ethereum);
console.log('Polygon:', wallet.addresses.polygon);
console.log('Solana:', wallet.addresses.solana);
```

### 4. Send Your First Cross-Chain Payment

```javascript
// Send USDC from Ethereum to Solana (gasless!)
const payment = await sdk.sendPayment({
  from: {
    chain: 'ethereum',
    socialId: 'user@example.com'
  },
  to: {
    chain: 'solana',
    address: 'GKvqsuNcnwWqPzzuhLmGi4rzzh55FhJtGizkhHaEJqiV'
  },
  amount: '100',
  asset: 'USDC',
  gasless: true // No gas fees for your users!
});

console.log('💸 Payment sent:', payment.hash);
```

**That's it!** You now have a working cross-chain wallet that supports both Ethereum and Solana ecosystems.

## 📦 Installation

### NPM/Yarn Installation

```bash
# Using NPM
npm install @nexuspay/sdk

# Using Yarn
yarn add @nexuspay/sdk

# Using PNPM
pnpm add @nexuspay/sdk
```

### CDN Installation (Browser)

```html
<script src="https://unpkg.com/@nexuspay/sdk@latest/dist/index.umd.js"></script>
<script>
  const { NexusSDK, Utils } = NexusPay;
  // Your code here
</script>
```

## 🔑 API Key Generation

### Step 1: Visit the API Console

Go to [**NexusPay API Console**](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app)

### Step 2: Generate Your Key

Fill out the form:
- **Email Address**: Your contact email
- **Project Name**: Name of your application
- **Website URL**: Your project's website (optional)

### Step 3: Save Your Key

```javascript
// Your generated API key will look like this:
const API_KEY = 'npay_762d168c41075dd9c61e8ca7df57b2b53a4f72abd227d2324c4b2128857f3fe7';

// Keep it secure! Never commit to git or expose publicly
```

⚠️ **Important**: Save your API key securely. You won't be able to see it again!

## 🎯 Basic Usage

### Configuration

```javascript
import { NexusSDK, Utils } from '@nexuspay/sdk';

// Production configuration
const config = {
  apiKey: 'npay_your_api_key_here',
  environment: 'production', // or 'development'
  chains: ['ethereum', 'polygon', 'arbitrum', 'base', 'solana'],
  features: {
    socialRecovery: true,
    gaslessTransactions: true,
    crossChain: true,
    analytics: true
  },
  endpoints: {
    api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app',
    websocket: 'wss://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
  }
};

const sdk = new NexusSDK(config);
await sdk.initialize();
```

### Wallet Management

```javascript
// Create a new multi-chain wallet
const wallet = await sdk.createWallet({
  socialId: 'user@example.com',
  socialType: 'email', // 'email', 'google', 'twitter', 'discord'
  chains: ['ethereum', 'polygon', 'solana'],
  metadata: {
    name: 'User Name',
    email: 'user@example.com',
    avatar: 'https://example.com/avatar.jpg'
  }
});

// Retrieve existing wallet
const existingWallet = await sdk.getWallet('user@example.com');

// Get wallet balance across all chains
const balances = await sdk.getWalletBalances('user@example.com');
console.log('Total USD balance:', balances.totalUSD);
```

### Payments & Transfers

```javascript
// Same-chain payment
const payment = await sdk.sendPayment({
  from: {
    chain: 'ethereum',
    socialId: 'user@example.com'
  },
  to: {
    chain: 'ethereum',
    address: '0x742d35Cc6638C0532925a3b8D097B5447c4C7a4D'
  },
  amount: '50',
  asset: 'USDC',
  gasless: true
});

// Cross-chain payment (Ethereum → Solana)
const crossChainPayment = await sdk.sendPayment({
  from: {
    chain: 'ethereum',
    socialId: 'user@example.com'
  },
  to: {
    chain: 'solana',
    address: 'GKvqsuNcnwWqPzzuhLmGi4rzzh55FhJtGizkhHaEJqiV'
  },
  amount: '100',
  asset: 'USDC',
  gasless: true,
  crossChain: true
});
```

### Asset Bridging

```javascript
// Bridge assets between chains
const bridge = await sdk.bridgeAssets({
  fromChain: 'ethereum',
  toChain: 'solana',
  amount: '1000',
  asset: 'USDC',
  recipient: wallet.addresses.solana,
  socialId: 'user@example.com'
});

console.log('Bridge ID:', bridge.bridgeId);
console.log('Estimated time:', bridge.estimatedTime + 's');

// Track bridge status
const status = await sdk.getBridgeStatus(bridge.bridgeId);
console.log('Status:', status.status); // 'pending', 'completed', 'failed'
```

## 🚀 Advanced Features

### Gas Tank Management

```javascript
// Add funds to gas tank (prepaid gas for gasless transactions)
await sdk.addToGasTank({
  socialId: 'user@example.com',
  amount: '50', // $50 USD worth of gas
  chains: ['ethereum', 'polygon', 'solana']
});

// Check gas tank balance
const gasTank = await sdk.getGasTankBalance('user@example.com');
console.log('Total gas balance:', gasTank.totalBalance);
console.log('Per chain:', gasTank.chainBalances);
```

### Social Recovery

```javascript
// Set up social recovery
await sdk.setupSocialRecovery({
  socialId: 'user@example.com',
  guardians: [
    { email: 'guardian1@example.com', type: 'email' },
    { email: 'guardian2@example.com', type: 'email' },
    { phone: '+1234567890', type: 'sms' }
  ],
  threshold: 2 // Require 2 out of 3 guardians to recover
});

// Initiate recovery process
const recovery = await sdk.initiateRecovery({
  socialId: 'user@example.com',
  newDevice: 'device-fingerprint-here'
});
```

### Analytics & Monitoring

```javascript
// Get wallet analytics
const analytics = await sdk.getWalletAnalytics('user@example.com');
console.log('Total transactions:', analytics.totalTransactions);
console.log('Cross-chain activity:', analytics.crossChainActivity);
console.log('Gas savings:', analytics.gasSavings);

// Track custom events
await sdk.trackEvent({
  socialId: 'user@example.com',
  event: 'nft_purchased',
  data: {
    collection: 'coolnfts',
    price: '0.5',
    chain: 'ethereum'
  }
});
```

## ⚛️ React Integration

### Install React Components

```bash
npm install @nexuspay/sdk
```

### Provider Setup

```tsx
import { NexusProvider } from '@nexuspay/sdk/react';

function App() {
  const config = {
    apiKey: 'npay_your_api_key_here',
    environment: 'production',
    chains: ['ethereum', 'polygon', 'solana'],
    endpoints: {
      api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
    }
  };

  return (
    <NexusProvider config={config}>
      <YourApp />
    </NexusProvider>
  );
}
```

### Use React Hooks

```tsx
import { useNexus } from '@nexuspay/sdk/react';

function WalletComponent() {
  const { sdk, isConnected, wallet, connect, disconnect } = useNexus();

  const handleConnect = async () => {
    await connect({
      socialId: 'user@example.com',
      socialType: 'email'
    });
  };

  const handlePayment = async () => {
    await sdk.sendPayment({
      from: { chain: 'ethereum', socialId: 'user@example.com' },
      to: { chain: 'solana', address: 'recipient-address' },
      amount: '10',
      asset: 'USDC',
      gasless: true
    });
  };

  return (
    <div>
      {isConnected ? (
        <div>
          <p>Connected: {wallet.socialId}</p>
          <button onClick={handlePayment}>Send Payment</button>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={handleConnect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Pre-built Components

```tsx
import { WalletConnect } from '@nexuspay/sdk/react';

function App() {
  return (
    <div>
      <WalletConnect
        onConnect={(wallet) => console.log('Connected:', wallet)}
        onDisconnect={() => console.log('Disconnected')}
        chains={['ethereum', 'polygon', 'solana']}
        theme="dark" // or "light"
      />
    </div>
  );
}
```

## 🌐 Supported Networks

### EVM Networks (12+)

| Network | Chain ID | Testnet Support | Mainnet Support |
|---------|----------|-----------------|-----------------|
| Ethereum | 1 | ✅ Sepolia | ✅ |
| Polygon | 137 | ✅ Mumbai | ✅ |
| Arbitrum | 42161 | ✅ Goerli | ✅ |
| Base | 8453 | ✅ Testnet | ✅ |
| Optimism | 10 | ✅ Goerli | ✅ |
| Avalanche | 43114 | ✅ Fuji | ✅ |
| BSC | 56 | ✅ Testnet | ✅ |
| Fantom | 250 | ✅ Testnet | ✅ |

### SVM Networks

| Network | Environment | Status |
|---------|-------------|--------|
| Solana | Mainnet-beta | ✅ |
| Solana | Devnet | ✅ |
| Solana | Testnet | ✅ |

## 📚 API Reference

### Core Classes

#### `NexusSDK`

Main SDK class for interacting with the NexusPay API.

```typescript
interface NexusSDKConfig {
  apiKey: string;
  environment: 'production' | 'development';
  chains: string[];
  features?: {
    socialRecovery?: boolean;
    gaslessTransactions?: boolean;
    crossChain?: boolean;
    analytics?: boolean;
  };
  endpoints: {
    api: string;
    websocket?: string;
  };
}

class NexusSDK {
  constructor(config: NexusSDKConfig);
  
  // Core methods
  async initialize(): Promise<void>;
  async createWallet(params: CreateWalletParams): Promise<Wallet>;
  async getWallet(socialId: string): Promise<Wallet>;
  async sendPayment(params: PaymentParams): Promise<Payment>;
  async bridgeAssets(params: BridgeParams): Promise<Bridge>;
  
  // Gas tank
  async addToGasTank(params: GasTankParams): Promise<void>;
  async getGasTankBalance(socialId: string): Promise<GasTankBalance>;
  
  // Utilities
  getSDKInfo(): SDKInfo;
  isInitialized(): boolean;
}
```

#### `Utils`

Utility functions for configuration and helpers.

```typescript
class Utils {
  static createProductionConfig(apiKey: string): NexusSDKConfig;
  static createDevelopmentConfig(apiKey: string): NexusSDKConfig;
  static validateAddress(address: string, chain: string): boolean;
  static formatAmount(amount: string, decimals: number): string;
}
```

### Error Handling

```javascript
try {
  const wallet = await sdk.createWallet(params);
} catch (error) {
  switch (error.code) {
    case 'INVALID_API_KEY':
      console.error('Check your API key');
      break;
    case 'WALLET_EXISTS':
      console.error('Wallet already exists for this social ID');
      break;
    case 'INSUFFICIENT_BALANCE':
      console.error('Not enough balance for transaction');
      break;
    default:
      console.error('Unexpected error:', error.message);
  }
}
```

## 💡 Examples

### Next.js App

```tsx
// pages/_app.tsx
import { NexusProvider } from '@nexuspay/sdk/react';

export default function App({ Component, pageProps }) {
  return (
    <NexusProvider config={{
      apiKey: process.env.NEXT_PUBLIC_NEXUSPAY_API_KEY,
      environment: 'production',
      chains: ['ethereum', 'polygon', 'solana'],
      endpoints: {
        api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
      }
    }}>
      <Component {...pageProps} />
    </NexusProvider>
  );
}

// components/WalletDashboard.tsx
import { useNexus } from '@nexuspay/sdk/react';

export default function WalletDashboard() {
  const { sdk, wallet, isConnected } = useNexus();
  
  const [balances, setBalances] = useState(null);
  
  useEffect(() => {
    if (isConnected && wallet) {
      sdk.getWalletBalances(wallet.socialId).then(setBalances);
    }
  }, [isConnected, wallet]);
  
  return (
    <div>
      {isConnected ? (
        <div>
          <h2>Your Wallet</h2>
          <p>Total Balance: ${balances?.totalUSD || '0.00'}</p>
          <div>
            {Object.entries(wallet.addresses).map(([chain, address]) => (
              <div key={chain}>
                <strong>{chain}:</strong> {address}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => /* connect logic */}>
          Connect Wallet
        </button>
      )}
    </div>
  );
}
```

### Node.js Backend

```javascript
// server.js
const { NexusSDK, Utils } = require('@nexuspay/sdk');

const sdk = new NexusSDK(Utils.createProductionConfig(process.env.NEXUSPAY_API_KEY));

async function createUserWallet(userId, email) {
  try {
    await sdk.initialize();
    
    const wallet = await sdk.createWallet({
      socialId: email,
      socialType: 'email',
      chains: ['ethereum', 'polygon', 'solana'],
      metadata: { userId, email }
    });
    
    return wallet;
  } catch (error) {
    console.error('Failed to create wallet:', error);
    throw error;
  }
}

// Express route
app.post('/api/create-wallet', async (req, res) => {
  try {
    const { userId, email } = req.body;
    const wallet = await createUserWallet(userId, email);
    res.json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 🛠️ Development & Testing

### Local Development

```bash
# Clone the repository
git clone https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION.git
cd SVM-EVM-CHAIN-ABSTRACTION

# Install dependencies
npm install

# Build the SDK
cd sdk
npm run build

# Run tests
npm test
```

### Testing Your Integration

```javascript
// test-integration.js
const { NexusSDK, Utils } = require('@nexuspay/sdk');

async function testIntegration() {
  const sdk = new NexusSDK(Utils.createProductionConfig('your-api-key'));
  
  try {
    await sdk.initialize();
    console.log('✅ SDK initialized');
    
    const wallet = await sdk.createWallet({
      socialId: 'test@example.com',
      socialType: 'email',
      chains: ['ethereum', 'solana']
    });
    console.log('✅ Wallet created:', wallet.addresses);
    
    console.log('🎉 Integration test passed!');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

testIntegration();
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Make your changes and add tests
5. Run tests: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/LICENSE) file for details.

## 🔗 Links & Resources

### 🔧 Developer Resources
- **📦 NPM Package**: [npmjs.com/package/@nexuspay/sdk](https://npmjs.com/package/@nexuspay/sdk)
- **🔑 API Key Console**: [nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app)
- **📚 API Documentation**: [GitHub API Reference](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/sdk/API_REFERENCE.md)
- **⚡ Quick Start Guide**: [Developer Quickstart](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/sdk/DEVELOPER_QUICKSTART.md)

### 📱 Repository & Source Code
- **🏠 Main Repository**: [github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION)
- **🐛 Issues & Bug Reports**: [GitHub Issues](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/discussions)
- **🔄 Pull Requests**: [GitHub PRs](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/pulls)

### 📖 Documentation
- **📋 README**: [Main README](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/README.md)
- **🚀 SDK README**: [SDK Documentation](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/sdk/README.md)
- **🔧 API Reference**: [Complete API Docs](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/sdk/API_REFERENCE.md)
- **⚡ Quick Start**: [5-Minute Setup](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/sdk/DEVELOPER_QUICKSTART.md)

### 🌟 Examples & Templates
- **⚛️ React Example**: [sdk/examples/nextjs-app.tsx](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/blob/main/sdk/examples/nextjs-app.tsx)
- **🔧 Node.js Example**: [Test Scripts](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/tree/main/sdk)
- **📱 Integration Examples**: [SDK Examples](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/tree/main/sdk/examples)

### 💼 Production & Deployment
- **🌐 Production API**: [nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app)
- **📈 Status Page**: Coming Soon
- **🔐 Security**: [Security Policy](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/security)

---

<div align="center">

**Built with ❤️ by the NexusPay Team**

[🌐 Website](https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app) • [📚 Docs](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION) • [💬 Discord](https://discord.gg/nexuspay) • [🐦 Twitter](https://twitter.com/nexuspay)

*Making cross-chain interactions simple, secure, and seamless.*

</div> 