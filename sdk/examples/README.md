# NexusSDK Examples

This directory contains practical examples showing how to build wallet infrastructure using the NexusSDK.

## 🚀 Getting Started

1. **Build the SDK first:**
   ```bash
   cd ../
   npm run build
   ```

2. **Get your API key:**
   Visit [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/) to get your production API key.

3. **Update the API key in examples:**
   Replace `'local-dev-key'` with your actual API key in the example files.

## 📁 Examples

### 1. `wallet-infrastructure-demo.js`
**Complete enterprise-grade wallet infrastructure demonstration**

Shows how to build a full-featured wallet system with:
- Multi-user wallet creation
- Batch operations
- Cross-chain transfers
- Transaction history tracking
- System statistics and monitoring
- Error handling

**Run it:**
```bash
node wallet-infrastructure-demo.js
```

**Features demonstrated:**
- ✅ Individual wallet creation
- ✅ Batch wallet creation for gaming/enterprise
- ✅ Balance checking across chains
- ✅ Send/receive funds simulation
- ✅ Cross-chain bridge transfers
- ✅ Transaction history management
- ✅ System statistics and monitoring
- ✅ Gas payment management (paymaster)

### 2. `simple-wallet-app.js`
**Basic wallet application for quick integration**

A simplified, practical example focused on common wallet operations:
- User login/wallet creation
- Balance checking
- Send/receive funds
- Cross-chain transfers
- Transaction history

**Run it:**
```bash
node simple-wallet-app.js
```

**Perfect for:**
- Learning the basics
- Quick prototyping
- Simple wallet applications
- Mobile app backends

## 🔧 Integration Patterns

### Pattern 1: Gaming Platform
```javascript
const { WalletInfrastructure } = require('./wallet-infrastructure-demo.js');

const gameWallets = new WalletInfrastructure();
await gameWallets.initialize();

// Create wallets for players with sponsored gas
const gamers = [
  { id: 'player_001', type: 'gamePlayerId', chains: ['polygon'] },
  { id: 'player_002', type: 'gamePlayerId', chains: ['polygon'] }
];

await gameWallets.batchCreateWallets(gamers);
```

### Pattern 2: Enterprise Application
```javascript
const { SimpleWalletApp } = require('./simple-wallet-app.js');

const app = new SimpleWalletApp('your-api-key');
await app.initialize();

// Employee wallet system
await app.createOrLoginUser('emp_jane_doe_001', 'employeeId');
await app.sendFunds('emp_john_smith_002', '500', 'USDC', 'ethereum');
```

### Pattern 3: DeFi Integration
```javascript
// User wallet with cross-chain capabilities
await app.createOrLoginUser('defi_user_001', 'email');
await app.crossChainTransfer('1000', 'USDC', 'ethereum', 'solana');
```

## 🌐 Real Blockchain Integration

Both examples create **real blockchain wallets** that are:
- ✅ Deployed on actual blockchains (Ethereum Sepolia, Solana Devnet)
- ✅ Visible on block explorers
- ✅ Funded with test tokens automatically
- ✅ Ready for mainnet with API key change

### Ethereum Wallets
- Deployed as smart contract wallets
- Visible on [Sepolia Etherscan](https://sepolia.etherscan.io/)
- Support all EVM chains with unified addresses

### Solana Wallets  
- Native Solana accounts
- Visible on [Solana Explorer](https://explorer.solana.com/?cluster=devnet)
- Ready for mainnet and devnet

## 💰 Gas Payment Options

### Company-Sponsored (Paymaster ON)
```javascript
// Your app pays all gas fees
await sdk.createWallet({
  socialId: 'user@app.com',
  socialType: 'email',
  paymaster: true  // Company pays
});
```

### User-Paid (Paymaster OFF)
```javascript
// Users pay their own gas fees
await sdk.createWallet({
  socialId: 'user@app.com',
  socialType: 'email',
  paymaster: false  // User pays
});
```

## 📊 Monitoring and Analytics

The examples include built-in monitoring:

```javascript
// Health check
const health = await sdk.healthCheck();
console.log('API Status:', health.status);

// Performance stats
const stats = sdk.getStats();
console.log('Cache size:', stats.cacheSize);

// System statistics
infrastructure.printSystemStats();
```

## 🔒 Security Best Practices

1. **API Key Security:**
   ```javascript
   // ✅ Good: Environment variable
   const apiKey = process.env.NEXUS_API_KEY;
   
   // ❌ Bad: Hardcoded key
   const apiKey = 'npay_actual_key_here';
   ```

2. **Error Handling:**
   ```javascript
   try {
     const wallet = await sdk.createWallet(options);
   } catch (error) {
     console.error('Wallet creation failed:', error.message);
   }
   ```

3. **Input Validation:**
   ```javascript
   if (!userId || !amount || amount <= 0) {
     throw new Error('Invalid input parameters');
   }
   ```

## 🚀 Production Deployment

### Step 1: Get Production API Key
Visit [https://backend-amber-zeta-94.vercel.app/](https://backend-amber-zeta-94.vercel.app/)

### Step 2: Update Configuration
```javascript
const sdk = new NexusSDK({
  apiKey: process.env.NEXUS_API_KEY,  // Your production key
  environment: 'production',
  chains: ['ethereum', 'solana']      // Choose your chains
});
```

### Step 3: Add Real Blockchain Integration
```javascript
// Add actual balance queries
async getBalance(address, chain) {
  // Query actual blockchain balances
  const balance = await blockchainProvider.getBalance(address);
  return balance;
}

// Add transaction signing
async sendTransaction(from, to, amount) {
  // Sign and broadcast real transaction
  const tx = await wallet.sendTransaction({ to, value: amount });
  return tx;
}
```

## 📱 Framework Integration

### React/Next.js
```javascript
import { SimpleWalletApp } from '@nexuspay/sdk/examples';

function WalletComponent() {
  const [app] = useState(() => new SimpleWalletApp(process.env.NEXT_PUBLIC_NEXUS_API_KEY));
  
  useEffect(() => {
    app.initialize();
  }, []);
  
  // Use app methods in your component
}
```

### Node.js/Express
```javascript
const { WalletInfrastructure } = require('@nexuspay/sdk/examples');

const infrastructure = new WalletInfrastructure();
await infrastructure.initialize();

app.post('/api/create-wallet', async (req, res) => {
  const wallet = await infrastructure.createUserWallet(req.body.userId);
  res.json(wallet);
});
```

## 🎯 Use Cases

### Gaming Platforms
- Player wallet creation with sponsored gas
- In-game asset transfers
- Tournament prize distribution
- Guild treasury management

### Enterprise Applications
- Employee payment systems
- Company treasury management
- Customer rewards programs
- B2B payment automation

### DeFi Protocols
- User wallet abstraction
- Cross-chain liquidity management
- Automated yield farming
- Protocol treasury operations

### NFT Marketplaces
- Creator payout systems
- Collector wallet management
- Royalty distribution
- Community membership wallets

## 💡 Next Steps

1. **Try the examples** - Run both demo scripts to understand the capabilities
2. **Integrate into your app** - Use the patterns shown for your specific use case
3. **Customize as needed** - Modify the examples for your business logic
4. **Deploy to production** - Follow the production deployment guide

## 📞 Support

- **Documentation**: [API Reference](../API_REFERENCE.md)
- **Quick Start**: [Developer Guide](../DEVELOPER_QUICKSTART.md)
- **Issues**: [GitHub Issues](https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION/issues)
- **API Key**: [Get Production Key](https://backend-amber-zeta-94.vercel.app/)

---

**Ready to build the future of cross-chain wallets?** 🚀 