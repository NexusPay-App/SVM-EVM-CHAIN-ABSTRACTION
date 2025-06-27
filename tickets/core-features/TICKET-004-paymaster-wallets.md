# 🎫 TICKET-004: Project Paymaster Wallets

**Priority**: 🔴 High  
**Estimate**: 10 hours  
**Phase**: Core Features  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-003  
**Blocks**: TICKET-007  

---

## 📝 Description

Auto-create dedicated paymaster wallets for each project to manage gas sponsorship. Each project gets its own wallet that can be funded to pay gas fees for user transactions.

**Context**: Currently there's a global paymaster system. We need project-specific paymasters for better cost tracking and management.

---

## 🎯 Acceptance Criteria

- [ ] Each project automatically gets a paymaster wallet on creation
- [ ] Wallet supports ETH, SOL, ARB funding
- [ ] Real-time balance tracking across all chains
- [ ] Transaction history for gas sponsorship
- [ ] Funding notifications and alerts
- [ ] Spending limits and auto-alerts implemented

---

## ✅ Tasks

### **Paymaster Wallet Creation**
- [ ] Auto-generate paymaster wallet on project creation
- [ ] Create deterministic addresses for each chain
- [ ] Store wallet addresses in project_paymasters table
- [ ] Generate private keys securely (encrypted storage)

### **Funding System**
- [ ] Implement `POST /projects/:projectId/paymaster/fund`
- [ ] Support funding via crypto deposit addresses
- [ ] Add funding via payment processor (Stripe/similar)
- [ ] Create funding transaction tracking

### **Balance Management**
- [ ] Real-time balance checking across ETH, SOL, ARB
- [ ] Implement `GET /projects/:projectId/paymaster/balance`
- [ ] Add low balance alerts (< 0.01 ETH equivalent)
- [ ] Create balance history tracking

### **Transaction Tracking**
- [ ] Log all gas payments made by paymaster
- [ ] Link gas payments to specific user wallets
- [ ] Calculate cost per transaction
- [ ] Generate spending reports

---

## 🔌 API Endpoints

```javascript
// Get paymaster balance
GET /projects/proj_abc123/paymaster/balance
Response:
{
  "balances": {
    "ethereum": {
      "address": "0x123...",
      "balance": "0.05", 
      "usd_value": "125.00"
    },
    "solana": {
      "address": "G1RD...",
      "balance": "0.1",
      "usd_value": "15.00"
    },
    "arbitrum": {
      "address": "0x123...",
      "balance": "0.02",
      "usd_value": "50.00"
    }
  },
  "total_usd": "190.00",
  "last_updated": "2024-12-26T10:00:00Z"
}

// Fund paymaster wallet
POST /projects/proj_abc123/paymaster/fund
{
  "chain": "ethereum",
  "amount": "0.1",
  "method": "crypto" // or "card"
}

// Get paymaster addresses for manual funding
GET /projects/proj_abc123/paymaster/addresses
Response:
{
  "addresses": {
    "ethereum": "0x123...",
    "solana": "G1RD...", 
    "arbitrum": "0x123..."
  },
  "qr_codes": {
    "ethereum": "data:image/png;base64,..."
  }
}

// Get spending history
GET /projects/proj_abc123/paymaster/transactions
Response:
{
  "transactions": [
    {
      "id": "tx_123",
      "chain": "ethereum",
      "amount": "0.001",
      "gas_for": "user_wallet_address",
      "tx_hash": "0xabc...",
      "timestamp": "2024-12-26T10:00:00Z"
    }
  ]
}
```

---

## 💾 Database Schema

```sql
-- Project paymaster wallets
CREATE TABLE project_paymasters (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  chain VARCHAR(50) NOT NULL,
  address VARCHAR(255) NOT NULL,
  private_key_encrypted TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, chain)
);

-- Paymaster funding transactions
CREATE TABLE paymaster_funding (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  chain VARCHAR(50) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  tx_hash VARCHAR(255),
  method VARCHAR(50) NOT NULL, -- crypto, card, bank
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, failed
  user_id VARCHAR(50) REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gas payments made by paymaster
CREATE TABLE paymaster_payments (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  paymaster_address VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  gas_for_address VARCHAR(255) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  block_number BIGINT,
  gas_price DECIMAL(20,8),
  gas_used BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Balance tracking (cached for performance)
CREATE TABLE paymaster_balances (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  chain VARCHAR(50) NOT NULL,
  address VARCHAR(255) NOT NULL,
  balance DECIMAL(20,8) NOT NULL,
  usd_value DECIMAL(10,2),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, chain)
);
```

---

## 🔐 Security Implementation

### **Private Key Management**
```javascript
// Encrypt private keys before storage
const crypto = require('crypto');

function encryptPrivateKey(privateKey, projectId) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY + projectId, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptPrivateKey(encryptedData, projectId) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY + projectId, 'salt', 32);
  const decipher = crypto.createDecipher(algorithm, key);
  
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] Paymaster wallet generation for each chain
- [ ] Private key encryption/decryption
- [ ] Balance calculation accuracy
- [ ] Transaction cost tracking
- [ ] Alert threshold triggers

### **Integration Tests**  
- [ ] Project creation → paymaster auto-generation
- [ ] Funding flow → balance update → spending
- [ ] Cross-chain balance aggregation
- [ ] Low balance alert triggering
- [ ] Gas payment execution and tracking

---

## 🚀 Implementation Notes

### **Wallet Generation Strategy**
```javascript
// Generate deterministic paymaster addresses
function generatePaymasterWallet(projectId, chain) {
  const seed = crypto.createHash('sha256')
    .update(`${projectId}-${chain}-paymaster-${process.env.MASTER_SEED}`)
    .digest();
    
  if (chain === 'solana') {
    return generateSolanaWallet(seed);
  } else {
    return generateEthereumWallet(seed); // Works for ETH, ARB
  }
}
```

### **Balance Monitoring**
```javascript
// Background job to update balances every 5 minutes
async function updatePaymasterBalances() {
  const paymasters = await getAllActivePaymasters();
  
  for (const paymaster of paymasters) {
    const balance = await getChainBalance(paymaster.address, paymaster.chain);
    await updateBalanceCache(paymaster.project_id, paymaster.chain, balance);
    
    // Check for low balance alerts
    if (balance < LOW_BALANCE_THRESHOLD) {
      await sendLowBalanceAlert(paymaster.project_id, paymaster.chain, balance);
    }
  }
}
```

---

## 📊 Success Metrics

- [ ] Paymaster creation time < 3 seconds
- [ ] Balance updates within 5 minutes of funding
- [ ] Gas payment success rate > 99%
- [ ] Alert delivery < 2 minutes for low balance
- [ ] Transaction cost tracking accuracy > 99.9%

---

## 🚀 Next Steps

**After completion**:
1. Integrate with transaction tracking (TICKET-007)
2. Add billing and invoicing system
3. Create paymaster analytics dashboard
4. Implement auto-refill from payment methods

---

## 📝 Notes

- Use deterministic key generation for reproducibility
- Implement proper key rotation strategy
- Monitor gas prices for cost optimization
- Add multi-signature support for high-value paymasters
- Consider layer 2 solutions for cheaper gas 