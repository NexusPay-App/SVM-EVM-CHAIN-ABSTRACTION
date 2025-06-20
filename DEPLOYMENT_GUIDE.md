# NexusDeFi Multi-Chain Deployment Guide

## 🚀 Deploy to 4 Major Testnets

**Supported Networks:**
- 🔷 **Ethereum Sepolia** (Chain ID: 11155111)
- 🔴 **Arbitrum Sepolia** (Chain ID: 421614) 
- 🔵 **Base Sepolia** (Chain ID: 84532)
- 🟣 **Polygon Mumbai** (Chain ID: 80001)

### Prerequisites

1. **Node.js & npm** installed
2. **Test ETH** for all networks
3. **API keys** for RPC providers and block explorers

### Step 1: Environment Setup

Create a `.env` file in the `contracts/evm/` directory:

```bash
# Private Key (without 0x prefix)
PRIVATE_KEY=your_private_key_without_0x_prefix

# RPC Provider Keys
INFURA_KEY=your_infura_project_id
ALCHEMY_KEY=your_alchemy_api_key

# Block Explorer API Keys
ETHERSCAN_API_KEY=your_etherscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

### Step 2: Get Test Tokens

#### 🔷 Ethereum Sepolia ETH:
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Alchemy Faucet**: https://sepoliafaucet.com/
- **QuickNode Faucet**: https://faucet.quicknode.com/ethereum/sepolia
- **Infura Faucet**: https://www.infura.io/faucet/sepolia

#### 🔴 Arbitrum Sepolia ETH:
- **Official Faucet**: https://faucet.arbitrum.io/
- **Alchemy Faucet**: https://www.alchemy.com/faucets/arbitrum-sepolia
- **QuickNode Faucet**: https://faucet.quicknode.com/arbitrum/sepolia

#### 🔵 Base Sepolia ETH:
- **Official Faucet**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- **Alchemy Faucet**: https://www.alchemy.com/faucets/base-sepolia
- **QuickNode Faucet**: https://faucet.quicknode.com/base/sepolia

#### 🟣 Polygon Mumbai MATIC:
- **Official Faucet**: https://faucet.polygon.technology/
- **Alchemy Faucet**: https://mumbaifaucet.com/
- **QuickNode Faucet**: https://faucet.quicknode.com/polygon/mumbai

### Step 3: Deploy to All Networks

#### Deploy to Ethereum Sepolia:
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

#### Deploy to Arbitrum Sepolia:
```bash
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

#### Deploy to Base Sepolia:
```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

#### Deploy to Polygon Mumbai:
```bash
npx hardhat run scripts/deploy.js --network polygonMumbai
```

#### 🚀 Deploy to ALL networks at once:
```bash
# Run all deployments sequentially
npm run deploy:all
```

### Step 4: Verify Deployment

Each deployment will:
- ✅ Deploy EntryPoint, WalletFactory, and Paymaster
- ✅ Verify all configurations
- ✅ Create a test wallet
- ✅ Fund the paymaster with 0.1 ETH
- ✅ Save deployment info to `deployments/{network}.json`

## 📋 Required API Keys

### 1. RPC Providers

**Infura (Recommended):**
- Sign up: https://infura.io/
- Supports: Ethereum, Arbitrum, Base, Polygon
- Create project → Copy Project ID

**Alchemy (Alternative):**
- Sign up: https://alchemy.com/
- Supports: Ethereum, Arbitrum, Base, Polygon
- Create app → Copy API Key

### 2. Block Explorer APIs (For Verification)

| Network | Explorer | API Key URL |
|---------|----------|-------------|
| 🔷 Ethereum | Etherscan | https://etherscan.io/apis |
| 🔴 Arbitrum | Arbiscan | https://arbiscan.io/apis |
| 🔵 Base | Basescan | https://basescan.org/apis |
| 🟣 Polygon | Polygonscan | https://polygonscan.com/apis |

## 📊 Expected Deployment Costs

| Network | Total Gas | Est. Cost (USD) | Native Token |
|---------|-----------|-----------------|--------------|
| 🔷 Ethereum Sepolia | ~7.5M | $15-40 | SepoliaETH |
| 🔴 Arbitrum Sepolia | ~7.5M | $2-8 | ETH |
| 🔵 Base Sepolia | ~7.5M | $3-12 | ETH |
| 🟣 Polygon Mumbai | ~7.5M | $1-5 | MATIC |
| **TOTAL ALL NETWORKS** | **~30M** | **$21-65** | - |

*Costs vary based on network congestion and gas prices*

## 🎯 Multi-Chain Architecture Benefits

**Why Deploy to All 4 Networks?**

1. **🔷 Ethereum** - Maximum security & liquidity
2. **🔴 Arbitrum** - Low fees, high throughput L2
3. **🔵 Base** - Coinbase ecosystem, growing adoption
4. **🟣 Polygon** - Fastest, cheapest transactions

**Cross-Chain Features:**
- ✅ Same contract addresses across networks (CREATE2)
- ✅ Unified wallet experience
- ✅ Cross-chain gas sponsorship
- ✅ Multi-network asset management

## 🔍 Troubleshooting

### Network-Specific Issues:

**Arbitrum Sepolia:**
- Use lower gas prices (0.1 gwei)
- Ensure you have ETH, not ARB tokens

**Base Sepolia:**
- May need Coinbase Wallet for some faucets
- Check Base network status if RPC fails

**Polygon Mumbai:**
- Use MATIC for gas, not ETH
- Try alternative RPC if Infura fails

### Common Solutions:

**"Insufficient funds"**
- Get test tokens from multiple faucets
- Wait 24 hours between faucet requests

**"Network unreachable"**
- Check API key quotas
- Try alternative RPC endpoints

**"Nonce too high"**
- Reset account nonce in MetaMask
- Wait for pending transactions

## 📱 Post-Deployment Checklist

After deploying to all networks:

1. **📋 Save All Addresses** - Store in config file
2. **🔍 Verify Contracts** - On all block explorers  
3. **🧪 Test Cross-Chain** - Create wallets on each network
4. **⚙️ Configure Paymasters** - Set policies per network
5. **🎨 Build Demo UI** - Show multi-chain capabilities

## 🌐 Block Explorers

| Network | Explorer | URL |
|---------|----------|-----|
| 🔷 Ethereum Sepolia | Etherscan | https://sepolia.etherscan.io |
| 🔴 Arbitrum Sepolia | Arbiscan | https://sepolia.arbiscan.io |
| 🔵 Base Sepolia | Basescan | https://sepolia.basescan.org |
| 🟣 Polygon Mumbai | Polygonscan | https://mumbai.polygonscan.com |

---

**🎯 Ready to deploy NexusDeFi across 4 major networks? Let's build the future of multi-chain DeFi! 🚀** 