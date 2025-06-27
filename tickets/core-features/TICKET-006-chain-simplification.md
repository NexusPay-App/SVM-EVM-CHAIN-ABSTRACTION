# 🎫 TICKET-006: Multi-Chain Simplification

**Priority**: 🟡 Medium  
**Estimate**: 8 hours  
**Phase**: Core Features  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-001  
**Blocks**: None  

---

## 📝 Description

Focus on only 3 chains: Ethereum (Sepolia), Solana (Devnet), and Arbitrum (Sepolia). Remove support for other chains that aren't properly deployed and causing customer confusion.

**Context**: Currently claims to support 9 chains but only 2 are actually deployed. This misleads users and complicates the codebase.

---

## 🎯 Acceptance Criteria

- [ ] Only ETH, SOL, ARB supported and documented
- [ ] All 3 chains fully deployed and tested on testnets
- [ ] SDK updated to support only 3 chains
- [ ] Documentation reflects chain changes
- [ ] Smart contracts deployed to Arbitrum Sepolia
- [ ] Cross-chain functionality working across all 3 chains

---

## ✅ Tasks

### **Smart Contract Deployment**
- [ ] Deploy EntryPoint to Arbitrum Sepolia
- [ ] Deploy WalletFactory to Arbitrum Sepolia  
- [ ] Deploy Paymaster to Arbitrum Sepolia
- [ ] Verify all contracts on Arbiscan
- [ ] Test wallet creation and deployment on Arbitrum
- [ ] Fund Arbitrum paymaster for testing

### **Backend Configuration Update**
- [ ] Remove chains: polygon, base, optimism, avalanche, bsc, fantom
- [ ] Update CONTRACTS configuration to only include ETH, SOL, ARB
- [ ] Update blockchain-integration.js for 3-chain support
- [ ] Update cross-chain address generation logic
- [ ] Test wallet creation across all 3 chains

### **API Response Cleanup**  
- [ ] Update wallet creation responses to only show 3 chains
- [ ] Remove unsupported chains from all API endpoints
- [ ] Update chain validation logic
- [ ] Fix misleading same-address responses
- [ ] Add proper chain-specific addresses

### **SDK Updates**
- [ ] Update supported chains list in SDK
- [ ] Remove chain configurations for unsupported chains
- [ ] Update TypeScript types and interfaces
- [ ] Update examples and documentation
- [ ] Test SDK integration with 3 chains

---

## 🔧 Implementation Plan

### **1. Deploy Arbitrum Contracts**
```bash
cd contracts/evm

# Deploy to Arbitrum Sepolia
npm run deploy:arbitrum

# Verify contracts
npm run verify:arbitrum

# Test wallet creation
npm run test:features:arbitrum
```

### **2. Update Backend Configuration**
```javascript
// contracts/evm/contracts-config.js - NEW SIMPLIFIED VERSION
const CONTRACTS = {
  sepolia: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    currency: 'ETH',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    entryPoint: '0x76b734753322a29A1c8bf2c791DcD84d4F0A5ed0',
    walletFactory: '0x73c780a09d89b486e2859EA247f54C88C57d3B5C',
    paymaster: '0x790eA3268237CbF95B90f1174251a533152cD83D'
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    currency: 'ETH',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    entryPoint: 'TBD_AFTER_DEPLOYMENT',
    walletFactory: 'TBD_AFTER_DEPLOYMENT', 
    paymaster: 'TBD_AFTER_DEPLOYMENT'
  },
  solana: {
    chainId: 'devnet',
    name: 'Solana Devnet',
    currency: 'SOL',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com'
  }
};

// Remove all other chains
```

### **3. Update Cross-Chain Logic**
```javascript
// backend/blockchain-integration.js - SIMPLIFIED VERSION
async generateCrossChainAddresses(socialId, socialType) {
  const addresses = {};
  
  // EVM chains use same deterministic logic but different factories
  const owner = this.generateOwnerAddress(socialId, socialType);
  const salt = this.generateSalt(socialId, socialType);

  // Ethereum Sepolia
  const ethFactory = this.walletFactories['sepolia'];
  const ethAddress = await ethFactory.getWalletAddress(owner.address, salt);
  addresses.ethereum = ethAddress;

  // Arbitrum Sepolia (same address due to CREATE2 determinism)
  const arbFactory = this.walletFactories['arbitrumSepolia']; 
  const arbAddress = await arbFactory.getWalletAddress(owner.address, salt);
  addresses.arbitrum = arbAddress;

  // Solana (different key derivation)
  const solanaWallet = await this.generateSolanaWallet(socialId, socialType);
  addresses.solana = solanaWallet.address;

  return { addresses };
}
```

---

## 📋 Contract Deployment Checklist

### **Pre-Deployment**
- [ ] Verify PRIVATE_KEY environment variable set
- [ ] Check deployer wallet has ARB ETH for gas
- [ ] Confirm Arbitrum Sepolia RPC endpoint working
- [ ] Test contract compilation

### **Deployment Steps**
```bash
# 1. Compile contracts
npm run compile

# 2. Deploy to Arbitrum Sepolia
npm run deploy:arbitrumSepolia

# 3. Verify on Arbiscan
npm run verify:arbitrumSepolia

# 4. Test basic functionality
node scripts/test-arbitrum-deployment.js
```

### **Post-Deployment**
- [ ] Update contract addresses in backend configuration
- [ ] Test wallet creation on Arbitrum
- [ ] Fund paymaster with test ETH
- [ ] Verify contracts on Arbiscan explorer
- [ ] Test cross-chain wallet creation

---

## 🧪 Testing Requirements

### **Contract Testing**
- [ ] Deploy test wallet on Arbitrum
- [ ] Verify wallet ownership and entry point
- [ ] Test paymaster gas sponsorship
- [ ] Verify CREATE2 address determinism
- [ ] Test wallet execution functionality

### **Integration Testing**
- [ ] Test API wallet creation for all 3 chains
- [ ] Verify unique addresses per chain
- [ ] Test paymaster deployment across chains
- [ ] Validate block explorer links
- [ ] Test SDK integration with 3 chains

### **Migration Testing**
- [ ] Existing users still get correct addresses
- [ ] No breaking changes to current functionality
- [ ] Proper error messages for unsupported chains
- [ ] Documentation reflects new chain support

---

## 📊 Expected Results

### **Before (Misleading)**
```javascript
// Claims 9 chains but only 2 work
{
  "ethereum": "0x123...",     // ✅ Real (Sepolia)
  "polygon": "0x123...",      // ❌ Fake (same address)
  "arbitrum": "0x123...",     // ❌ Fake (same address) 
  "base": "0x123...",         // ❌ Fake (same address)
  "optimism": "0x123...",     // ❌ Fake (same address)
  "avalanche": "0x123...",    // ❌ Fake (same address)
  "bsc": "0x123...",          // ❌ Fake (same address)
  "fantom": "0x123...",       // ❌ Fake (same address)
  "solana": "G1RD..."         // ✅ Real (Devnet)
}
```

### **After (Honest & Functional)**
```javascript
// 3 chains, all real and working
{
  "ethereum": "0x123...",     // ✅ Real (Sepolia testnet)
  "arbitrum": "0x456...",     // ✅ Real (Arbitrum Sepolia)
  "solana": "G1RD..."         // ✅ Real (Solana Devnet)
}
```

---

## 🔗 Chain Information

### **Supported Chains Post-Cleanup**
```javascript
const SUPPORTED_CHAINS = {
  ethereum: {
    name: 'Ethereum',
    testnet: 'Sepolia',
    chainId: 11155111,
    currency: 'ETH',
    type: 'EVM',
    explorer: 'https://sepolia.etherscan.io'
  },
  arbitrum: {
    name: 'Arbitrum',
    testnet: 'Arbitrum Sepolia', 
    chainId: 421614,
    currency: 'ETH',
    type: 'EVM',
    explorer: 'https://sepolia.arbiscan.io'
  },
  solana: {
    name: 'Solana',
    testnet: 'Devnet',
    chainId: 'devnet',
    currency: 'SOL', 
    type: 'SVM',
    explorer: 'https://explorer.solana.com'
  }
};
```

---

## 📊 Success Metrics

- [ ] All 3 chains have working smart contracts deployed
- [ ] Wallet creation success rate > 99% on all chains
- [ ] Block explorer links all working
- [ ] No customer confusion about supported chains
- [ ] SDK integration working across all chains

---

## 🚀 Next Steps

**After completion**:
1. Update all documentation to reflect 3-chain support
2. Create chain-specific tutorials and examples  
3. Plan mainnet deployment strategy
4. Consider adding more chains only after proper deployment

---

## 📝 Notes

- Focus on quality over quantity of chains
- Ensure all supported chains are production-ready
- Clear communication about testnet vs mainnet
- Plan for easy addition of new chains in future
- Monitor gas costs and optimize for each chain 