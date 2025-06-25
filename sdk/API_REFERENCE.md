# NexusSDK API Reference v1.1.1

**Production Endpoint**: `https://backend-amber-zeta-94.vercel.app`  
**Version**: 1.1.1  
**Last Updated**: December 2024

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Core Methods](#core-methods)
- [Batch Operations](#batch-operations)
- [Third-Party Integration](#third-party-integration)
- [Utility Methods](#utility-methods)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)

## Installation

```bash
npm install @nexuspay/sdk
```

## Quick Start

```typescript
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
  apiKey: 'your-api-key', // Get from https://backend-amber-zeta-94.vercel.app/
  environment: 'production',
  chains: ['ethereum', 'solana']
});

await sdk.initialize();

// Create wallet with paymaster
const wallet = await sdk.createWallet({
  socialId: 'user@company.com',
  socialType: 'email',
  chains: ['ethereum', 'solana'],
  paymaster: true // Company pays gas fees
});
```

## Configuration

### NexusConfig Interface

```typescript
interface NexusConfig {
  apiKey: string;                    // Required: Your API key
  environment?: 'production' | 'development';
  chains?: SupportedChain[];        // Default: ['ethereum', 'polygon', 'solana']
  endpoints?: {
    api?: string;                   // Default: https://backend-amber-zeta-94.vercel.app
  };
}
```

### Supported Chains

- **EVM**: `ethereum`, `polygon`, `arbitrum`, `base`, `optimism`, `avalanche`, `bsc`, `fantom`
- **SVM**: `solana`

## Core Methods

### initialize()

Initialize the SDK and verify API connection.

```typescript
await sdk.initialize();
```

**Returns**: `Promise<void>`

### createWallet(options)

Create and deploy real blockchain wallets.

```typescript
const wallet = await sdk.createWallet({
  socialId: 'user123',
  socialType: 'gameUserId',
  chains: ['ethereum', 'solana'],
  paymaster: true, // true = company pays gas, false = user pays
  metadata: {
    level: 50,
    guild: 'DragonWarriors'
  }
});
```

**Parameters**:
- `socialId` (string): Any unique identifier
- `socialType` (string): Custom identifier type (email, gameId, employeeId, etc.)
- `chains` (array): Chains to deploy on
- `paymaster` (boolean): Gas payment method
- `metadata` (object): Optional custom data

**Returns**: Real blockchain wallet with addresses and deployment info

### getWallet(socialId, socialType)

Retrieve wallet information (cached for performance).

```typescript
const wallet = await sdk.getWallet('user123', 'gameUserId');
```

**Parameters**:
- `socialId` (string): The social identifier
- `socialType` (string): The social identifier type

**Returns**: `Promise<WalletInfo>`

### sendPayment(options)

Send cross-chain payments.

```typescript
const tx = await sdk.sendPayment({
  from: { socialId: 'sender@email.com', chain: 'ethereum' },
  to: { address: '0x...', chain: 'polygon' },
  amount: '100',
  asset: 'USDC',
  gasless: true
});
```

## Batch Operations

### createWalletBatch(wallets)

Create multiple wallets efficiently.

```typescript
const results = await sdk.createWalletBatch([
  { socialId: 'user1', socialType: 'gameId', chains: ['ethereum'], paymaster: true },
  { socialId: 'user2', socialType: 'gameId', chains: ['solana'], paymaster: false },
  { socialId: 'user3', socialType: 'gameId', chains: ['ethereum', 'solana'], paymaster: true }
]);
```

**Returns**: Array of wallet creation results or error objects

### getWalletBatch(walletIds)

Check multiple wallet statuses efficiently.

```typescript
const wallets = await sdk.getWalletBatch([
  { socialId: 'user1', socialType: 'gameId' },
  { socialId: 'user2', socialType: 'email' },
  { socialId: 'user3', socialType: 'employeeId' }
]);
```

**Returns**: Array of wallet info or error objects

## Third-Party Integration

### healthCheck()

Monitor SDK and API health.

```typescript
const health = await sdk.healthCheck();
console.log(health.sdk.version); // '1.1.1'
console.log(health.status);      // 'ok'
```

### generateWebhookId(socialId, socialType)

Generate safe identifiers for webhook systems.

```typescript
const webhookId = sdk.generateWebhookId('user@company.com', 'email');
// Returns: base64 encoded identifier
```

### parseWebhookId(webhookId)

Parse webhook identifiers back to original values.

```typescript
const { socialId, socialType } = sdk.parseWebhookId(webhookId);
```

### validateConfig()

Validate SDK configuration.

```typescript
const validation = sdk.validateConfig();
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
}
```

## Utility Methods

### clearCache()

Clear request cache for fresh data.

```typescript
sdk.clearCache();
```

### getStats()

Get SDK statistics for monitoring.

```typescript
const stats = sdk.getStats();
console.log(stats.cacheSize);
console.log(stats.supportedChains);
```

### getConfig()

Get current SDK configuration.

```typescript
const config = sdk.getConfig();
```

## Error Handling

```typescript
try {
  const wallet = await sdk.createWallet({
    socialId: 'user123',
    socialType: 'email',
    chains: ['ethereum']
  });
} catch (error) {
  console.error('Wallet creation failed:', error.message);
}
```

## API Endpoints

### Production Base URL
`https://backend-amber-zeta-94.vercel.app`

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |
| POST | `/api/wallets/deploy` | Create and deploy wallets |
| GET | `/api/wallets/{socialId}` | Get wallet info |
| POST | `/api/payments` | Send payments |
| POST | `/api/bridge` | Bridge assets |

### Authentication

All requests require an API key in the header:

```http
X-API-Key: your-api-key
```

Get your API key at: https://backend-amber-zeta-94.vercel.app/

### Request Format

```typescript
{
  "socialId": "user123",
  "socialType": "gameUserId",
  "chains": ["ethereum", "solana"],
  "paymaster": true,
  "metadata": {
    "custom": "data"
  }
}
```

### Response Format

```typescript
{
  "success": true,
  "socialId": "user123",
  "socialType": "gameUserId",
  "addresses": {
    "ethereum": "0x...",
    "solana": "..."
  },
  "deployments": {
    "evm": {
      "isDeployed": true,
      "explorerUrl": "https://sepolia.etherscan.io/address/0x...",
      "gasPayment": "company-sponsored"
    },
    "solana": {
      "isDeployed": true,
      "explorerUrl": "https://explorer.solana.com/address/...?cluster=devnet",
      "gasPayment": "company-sponsored"
    }
  },
  "paymaster": true,
  "gasPaymentMethod": "company-sponsored"
}
```

## Rate Limits

- **Production**: 1000 requests/minute per API key
- **Burst**: Up to 50 requests in 10 seconds

## Caching

The SDK automatically caches GET requests for 5 minutes to improve performance. Use `clearCache()` to force fresh data.

## Support

- **Documentation**: https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION
- **API Key**: https://backend-amber-zeta-94.vercel.app/
- **Issues**: https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/issues

---

**Version**: 1.1.1  
**Last Updated**: June 2025 