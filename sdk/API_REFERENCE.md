# NexusSDK API Reference

> Complete API documentation for NexusSDK cross-chain wallet infrastructure.

## Table of Contents

- [Core Classes](#core-classes)
- [Configuration](#configuration)
- [Types & Interfaces](#types--interfaces)
- [Utility Functions](#utility-functions)
- [Constants](#constants)
- [Error Handling](#error-handling)

## Core Classes

### `NexusSDK`

The main SDK class for interacting with cross-chain wallet functionality.

#### Constructor

```typescript
new NexusSDK(config: NexusConfig)
```

**Parameters:**
- `config`: Configuration object containing API key, chains, and endpoints

**Example:**
```typescript
import { NexusSDK, Utils } from '@nexuspay/sdk';

const sdk = new NexusSDK(Utils.createLocalConfig('your-api-key'));
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the SDK with the provided configuration.

**Returns:** `Promise<void>`

**Example:**
```typescript
await sdk.initialize();
```

---

##### `createWallet(params: CreateWalletParams): Promise<WalletInfo>`

Create a new multi-chain wallet with social identity.

**Parameters:**
```typescript
interface CreateWalletParams {
  socialId: string;
  socialType: SocialIdType;
  chains: SupportedChain[];
  metadata?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    [key: string]: any;
  };
  recoveryOptions?: {
    guardians?: string[];
    threshold?: number;
    backupMethods?: string[];
  };
}
```

**Returns:** `Promise<WalletInfo>`

**Example:**
```typescript
const wallet = await sdk.createWallet({
  socialId: 'user@example.com',
  socialType: 'email',
  chains: ['ethereum', 'polygon', 'solana'],
  metadata: {
    name: 'John Doe',
    email: 'user@example.com'
  },
  recoveryOptions: {
    guardians: ['guardian1@email.com'],
    threshold: 1
  }
});
```

**Response:**
```typescript
{
  socialId: 'user@example.com',
  socialType: 'email',
  addresses: {
    ethereum: '0x742d35cc6577babc4c416c1c1a7e36ec94c2f52a',
    polygon: '0x742d35cc6577babc4c416c1c1a7e36ec94c2f52a',
    solana: 'GKvqsuNcnwWqPzzuhLmGi4rzzh55FhJtGizkhHaEJqiV'
  },
  createdAt: '2024-01-15T10:30:00Z',
  recoverySetup: true,
  isActive: true,
  crossChainEnabled: true
}
```

---

##### `getWallet(socialId: string): Promise<WalletInfo>`

Retrieve wallet information by social ID.

**Parameters:**
- `socialId`: The social identifier (email, phone, etc.)

**Returns:** `Promise<WalletInfo>`

**Example:**
```typescript
const wallet = await sdk.getWallet('user@example.com');
console.log(wallet.addresses);
```

---

##### `sendPayment(params: TransactionParams): Promise<TransactionResult>`

Send payments within or across chains.

**Parameters:**
```typescript
interface TransactionParams {
  from: {
    chain: SupportedChain;
    socialId?: string;
    address?: string;
  };
  to: {
    chain: SupportedChain;
    address: string;
  };
  amount: string;
  asset?: string;
  data?: string;
  gasless?: boolean;
  metadata?: any;
}
```

**Returns:** `Promise<TransactionResult>`

**Examples:**

*Same-chain payment:*
```typescript
const payment = await sdk.sendPayment({
  from: {
    chain: 'ethereum',
    socialId: 'user@example.com'
  },
  to: {
    chain: 'ethereum',
    address: '0x742d35cc6577babc4c416c1c1a7e36ec94c2f52a'
  },
  amount: '0.1',
  gasless: true
});
```

*Cross-chain payment:*
```typescript
const crossPayment = await sdk.sendPayment({
  from: {
    chain: 'ethereum',
    socialId: 'user@example.com'
  },
  to: {
    chain: 'solana',
    address: 'GKvqsuNcnwWqPzzuhLmGi4rzzh55FhJtGizkhHaEJqiV'
  },
  amount: '100',
  asset: 'USDC'
});
```

**Response:**
```typescript
{
  hash: '0x1234567890abcdef...',
  from: '0x742d35cc6577babc4c416c1c1a7e36ec94c2f52a',
  to: '0x123...',
  amount: '0.1',
  chain: 'ethereum',
  status: 'confirmed',
  blockNumber: 18500000,
  gasUsed: '21000',
  fee: '0.000315',
  timestamp: '2024-01-15T10:35:00Z'
}
```

---

##### `bridgeAssets(params: BridgeParams): Promise<BridgeResult>`

Bridge assets between different chains.

**Parameters:**
```typescript
interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  asset: string;
  recipient: string;
  socialId?: string;
}
```

**Returns:** `Promise<BridgeResult>`

**Example:**
```typescript
const bridge = await sdk.bridgeAssets({
  fromChain: 'ethereum',
  toChain: 'solana',
  amount: '1000',
  asset: 'USDC',
  recipient: 'GKvqsuNcnwWqPzzuhLmGi4rzzh55FhJtGizkhHaEJqiV',
  socialId: 'user@example.com'
});
```

**Response:**
```typescript
{
  bridgeId: 'bridge_abc123',
  fromTx: {
    hash: '0x1234...',
    chain: 'ethereum',
    status: 'confirmed'
  },
  toTx: {
    hash: 'def456...',
    chain: 'solana',
    status: 'pending'
  },
  status: 'pending',
  estimatedTime: 300, // seconds
  fee: '2.50'
}
```

---

##### `getGasTankBalance(socialId: string): Promise<GasTankInfo>`

Get gas tank balance for gasless transactions.

**Parameters:**
- `socialId`: The social identifier

**Returns:** `Promise<GasTankInfo>`

**Example:**
```typescript
const gasTank = await sdk.getGasTankBalance('user@example.com');
console.log(`Balance: ${gasTank.totalBalance} USD`);
```

**Response:**
```typescript
{
  socialId: 'user@example.com',
  totalBalance: '25.50',
  chainBalances: {
    ethereum: '10.00',
    polygon: '15.50',
    solana: '0.00'
  },
  lastRefill: '2024-01-15T09:00:00Z',
  monthlyUsage: '12.30'
}
```

---

##### `refillGasTank(params: RefillParams): Promise<RefillResult>`

Refill gas tank for sponsored transactions.

**Parameters:**
```typescript
interface RefillParams {
  socialId: string;
  amount: string;
  chain: SupportedChain;
  paymentMethod: 'wallet' | 'external';
}
```

**Returns:** `Promise<RefillResult>`

**Example:**
```typescript
const refill = await sdk.refillGasTank({
  socialId: 'user@example.com',
  amount: '50.00',
  chain: 'ethereum',
  paymentMethod: 'wallet'
});
```

---

##### `getSDKInfo(): SDKInfo`

Get information about the SDK version and configuration.

**Returns:** `SDKInfo`

**Example:**
```typescript
const info = sdk.getSDKInfo();
console.log(`SDK Version: ${info.version}`);
```

## Configuration

### `NexusConfig`

Main configuration interface for the SDK.

```typescript
interface NexusConfig {
  apiKey: string;
  projectId?: string;
  environment?: 'development' | 'staging' | 'production';
  chains: SupportedChain[];
  features?: {
    socialRecovery?: boolean;
    gaslessTransactions?: boolean;
    crossChain?: boolean;
    analytics?: boolean;
  };
  endpoints?: {
    api?: string;
    websocket?: string;
  };
}
```

### `ChainConfig`

Configuration for individual blockchain networks.

```typescript
interface ChainConfig {
  chainId: number | string;
  name: string;
  type: 'EVM' | 'SVM';
  rpcUrl: string;
  explorerUrl: string;
  contracts: ContractAddresses;
  gasToken: string;
  isTestnet: boolean;
}
```

## Types & Interfaces

### Core Types

```typescript
// Supported blockchain networks
type SupportedChain = 
  | 'ethereum' | 'polygon' | 'arbitrum' | 'base' | 'optimism'
  | 'avalanche' | 'bsc' | 'fantom' | 'gnosis' | 'celo'
  | 'moonbeam' | 'aurora' | 'solana';

// Social identity types
type SocialIdType = 'email' | 'phone' | 'ens' | 'twitter' | 'discord' | 'telegram';

// Chain categories
type EVMChain = Exclude<SupportedChain, 'solana'>;
type SVMChain = 'solana';
```

### Wallet Types

```typescript
interface WalletInfo {
  socialId: string;
  socialType: SocialIdType;
  addresses: Record<SupportedChain, string>;
  createdAt: string;
  lastUsed?: string;
  metadata?: any;
  recoverySetup: boolean;
  isActive: boolean;
  crossChainEnabled: boolean;
}

interface Guardian {
  id: string;
  type: SocialIdType;
  address?: string;
  publicKey?: string;
  isActive: boolean;
  addedAt: string;
}
```

### Transaction Types

```typescript
interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  amount: string;
  chain: SupportedChain;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  fee?: string;
  timestamp: string;
}

interface UserOperation {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}
```

### Bridge Types

```typescript
interface BridgeResult {
  bridgeId: string;
  fromTx: TransactionResult;
  toTx?: TransactionResult;
  status: 'initiated' | 'pending' | 'completed' | 'failed';
  estimatedTime: number;
  fee: string;
}
```

### Error Types

```typescript
interface NexusError {
  code: string;
  message: string;
  details?: any;
  chain?: SupportedChain;
  socialId?: string;
}
```

## Utility Functions

### `Utils.createLocalConfig(apiKey: string): NexusConfig`

Create a configuration for local development.

**Parameters:**
- `apiKey`: Your API key

**Returns:** `NexusConfig` configured for localhost:3001

### `Utils.createNgrokConfig(apiKey: string, ngrokUrl: string): NexusConfig`

Create a configuration for ngrok development.

**Parameters:**
- `apiKey`: Your API key
- `ngrokUrl`: Your ngrok subdomain

**Returns:** `NexusConfig` configured for ngrok tunnel

### `Utils.createConfig(apiKey: string, options?: Partial<NexusConfig>): NexusConfig`

Create a custom configuration.

**Parameters:**
- `apiKey`: Your API key
- `options`: Optional configuration overrides

**Returns:** `NexusConfig` with custom settings

## Constants

### `SUPPORTED_CHAINS`

Object containing all supported blockchain networks.

```typescript
const SUPPORTED_CHAINS = {
  EVM: [
    'ethereum', 'polygon', 'arbitrum', 'base', 'optimism',
    'avalanche', 'bsc', 'fantom', 'gnosis', 'celo',
    'moonbeam', 'aurora'
  ],
  SVM: ['solana']
};
```

### `DEFAULT_CONFIGS`

Pre-built configuration templates.

```typescript
const DEFAULT_CONFIGS = {
  LOCAL_DEVELOPMENT: { /* ... */ },
  NGROK_DEVELOPMENT: { /* ... */ }
};
```

### `COMMON_TOKENS`

Common token contract addresses across chains.

```typescript
const COMMON_TOKENS = {
  ethereum: {
    USDC: '0xA0b86a33E6F2c3b0C32C78bD8b4D4a4eD2a46C87',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    // ...
  },
  solana: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    // ...
  }
};
```

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `WALLET_EXISTS` | Wallet already exists for social ID | Use getWallet() instead |
| `INVALID_CHAIN` | Unsupported chain specified | Check SUPPORTED_CHAINS |
| `INSUFFICIENT_BALANCE` | Not enough funds for transaction | Add funds or use gasless |
| `RATE_LIMIT_EXCEEDED` | Too many API requests | Implement retry with backoff |
| `INVALID_SOCIAL_ID` | Invalid social identifier format | Check email/phone format |
| `BRIDGE_NOT_SUPPORTED` | Chain combination not supported | Check supported bridge pairs |
| `GAS_TANK_EMPTY` | No gas tank balance for gasless tx | Refill gas tank |

### Error Handling Patterns

```typescript
import { NexusError } from '@nexuspay/sdk';

try {
  const result = await sdk.someMethod(params);
} catch (error: NexusError) {
  switch (error.code) {
    case 'WALLET_EXISTS':
      // Handle existing wallet
      break;
    case 'INSUFFICIENT_BALANCE':
      // Prompt user to add funds
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Implement retry logic
      setTimeout(() => retry(), 1000);
      break;
    default:
      console.error('Unexpected error:', error.message);
  }
}
```

### Retry Logic Example

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const wallet = await withRetry(() => 
  sdk.createWallet(params)
);
```

---

**For additional examples and tutorials, see the [main README](./README.md) and [Developer Quickstart](./DEVELOPER_QUICKSTART.md).** 