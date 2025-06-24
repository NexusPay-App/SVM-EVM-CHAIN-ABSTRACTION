# NexusSDK Developer Quickstart

> Get up and running with cross-chain wallet functionality in under 5 minutes.

## What is NexusSDK?

NexusSDK enables developers to build applications with:
- **Multi-chain wallets** that work on both Ethereum-based chains and Solana
- **Gasless transactions** via sponsored gas tanks
- **Cross-chain asset bridging** between EVM and Solana
- **Social recovery** using email/phone/social accounts
- **Account abstraction** with smart contract wallets

## Installation

```bash
npm install @nexuspay/sdk
```

## 5-Minute Setup

### 1. Basic Configuration

```typescript
import { NexusSDK, Utils } from '@nexuspay/sdk';

// For development (connects to localhost:3001)
const sdk = new NexusSDK(Utils.createLocalConfig('dev-key'));
await sdk.initialize();
```

### 2. Create a Multi-Chain Wallet

```typescript
const wallet = await sdk.createWallet({
  socialId: 'user@example.com',
  socialType: 'email',
  chains: ['ethereum', 'polygon', 'solana']
});

console.log('Addresses created:');
console.log('Ethereum:', wallet.addresses.ethereum);
console.log('Polygon:', wallet.addresses.polygon);  
console.log('Solana:', wallet.addresses.solana);
```

### 3. Send a Cross-Chain Payment

```typescript
// Send USDC from Ethereum to Solana
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
  gasless: true // No gas fees for user!
});

console.log('Payment sent:', payment.hash);
```

### 4. Bridge Assets Between Chains

```typescript
const bridge = await sdk.bridgeAssets({
  fromChain: 'ethereum',
  toChain: 'solana',
  amount: '1000',
  asset: 'USDC',
  recipient: wallet.addresses.solana,
  socialId: 'user@example.com'
});

console.log('Bridge initiated:', bridge.bridgeId);
```

## Common Patterns

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { NexusSDK, Utils } from '@nexuspay/sdk';

function useNexusWallet() {
  const [sdk, setSdk] = useState<NexusSDK | null>(null);
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    const initSDK = async () => {
      const nexusSDK = new NexusSDK(Utils.createLocalConfig('your-key'));
      await nexusSDK.initialize();
      setSdk(nexusSDK);
    };
    initSDK();
  }, []);

  const createWallet = async (email: string) => {
    if (!sdk) return;
    const newWallet = await sdk.createWallet({
      socialId: email,
      socialType: 'email',
      chains: ['ethereum', 'solana']
    });
    setWallet(newWallet);
    return newWallet;
  };

  return { sdk, wallet, createWallet };
}
```

### Error Handling

```typescript
try {
  const payment = await sdk.sendPayment(params);
} catch (error) {
  switch (error.code) {
    case 'INSUFFICIENT_BALANCE':
      console.log('User needs more funds');
      break;
    case 'CHAIN_NOT_SUPPORTED':
      console.log('Invalid chain specified');
      break;
    case 'RATE_LIMIT_EXCEEDED':
      console.log('Too many requests, slow down');
      break;
    default:
      console.error('Unexpected error:', error.message);
  }
}
```

## Environment Setup

### Local Development

```typescript
// Connects to backend running on localhost:3001
const config = Utils.createLocalConfig('dev-key');
```

### Production with Custom API

```typescript
const config = Utils.createConfig('your-api-key', {
  environment: 'production',
  endpoints: {
    api: 'https://your-api.com'
  },
  chains: ['ethereum', 'polygon', 'solana']
});
```

### Ngrok Development

```typescript
// For testing with ngrok tunnels
const config = Utils.createNgrokConfig('dev-key', 'your-subdomain');
```

## Key Features Overview

| Feature | Description | Example |
|---------|-------------|---------|
| **Multi-chain Wallets** | Single identity, multiple addresses | Create wallet on ETH + SOL |
| **Gasless Transactions** | Users don't pay gas fees | `gasless: true` |
| **Cross-chain Payments** | Send assets between different chains | ETH → SOL payment |
| **Asset Bridging** | Move tokens between ecosystems | Bridge USDC ETH → SOL |
| **Social Recovery** | Email/phone wallet recovery | Guardian-based recovery |

## Supported Chains

**EVM Chains:**
- Ethereum, Polygon, Arbitrum, Base, Optimism
- Avalanche, BSC, Fantom, Gnosis, Celo

**SVM Chains:**
- Solana

## Next Steps

1. **Read the full [README.md](./README.md)** for complete API reference
2. **Check [examples/](./examples/)** for integration samples
3. **Review [test-npm.js](./test-npm.js)** for working examples
4. **See [NPM_PUBLISH_GUIDE.md](./NPM_PUBLISH_GUIDE.md)** for publishing

## Questions?

- **GitHub**: [Issues](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/issues)
- **Email**: hello@nexuspay.dev

---

**Happy building! 🚀** 