# 🎫 TICKET-007: Project Transaction Tracking

**Priority**: 🟡 Medium  
**Estimate**: 8 hours  
**Phase**: API & Analytics  
**Status**: ⏳ Pending  

**Assignee**: Backend Team  
**Dependencies**: TICKET-004  
**Blocks**: None  

---

## 📝 Description

Implement comprehensive transaction tracking and analytics per project. Track all wallet operations, gas usage, paymaster spending, and user behavior to provide detailed insights for project owners.

**Context**: Currently no proper tracking exists. Projects need analytics to understand usage, costs, and optimize their wallet infrastructure.

---

## 🎯 Acceptance Criteria

- [ ] All wallet transactions tracked per project
- [ ] Gas costs and paymaster spending calculated
- [ ] User wallet creation and usage analytics
- [ ] Real-time dashboard data available
- [ ] Historical reporting and analytics functional
- [ ] Export capabilities for billing/invoicing

---

## ✅ Tasks

### **Transaction Tracking Infrastructure**
- [ ] Create transaction_logs table for all wallet operations
- [ ] Track wallet creation, deployment, and usage events
- [ ] Monitor gas costs and paymaster spending
- [ ] Implement real-time event logging
- [ ] Add blockchain confirmation tracking

### **Analytics Endpoints**
- [ ] Implement `GET /projects/:projectId/analytics/overview`
- [ ] Implement `GET /projects/:projectId/analytics/transactions`
- [ ] Implement `GET /projects/:projectId/analytics/users`
- [ ] Implement `GET /projects/:projectId/analytics/costs`
- [ ] Implement `GET /projects/:projectId/analytics/export`

### **Cost Tracking**
- [ ] Calculate gas costs per transaction
- [ ] Track paymaster spending vs user-paid
- [ ] Monitor chain-specific costs (ETH, SOL, ARB)
- [ ] Generate cost breakdowns and forecasts
- [ ] Add billing-ready invoice data

### **User Behavior Analytics**
- [ ] Track unique wallet creators per project
- [ ] Monitor wallet usage patterns
- [ ] Analyze peak usage times
- [ ] Track API endpoint usage
- [ ] Generate user engagement metrics

---

## 🔌 API Endpoints

```javascript
// Project overview analytics
GET /projects/proj_abc123/analytics/overview
Response:
{
  "overview": {
    "total_wallets_created": 1250,
    "total_transactions": 3840,
    "total_gas_spent": "0.245 ETH",
    "paymaster_coverage": "85%",
    "active_users_30d": 320,
    "avg_transactions_per_user": 12.3,
    "last_updated": "2024-12-26T10:00:00Z"
  },
  "chains": {
    "ethereum": {
      "wallets": 650,
      "transactions": 2100,
      "gas_spent": "0.15 ETH",
      "avg_gas_price": "25 gwei"
    },
    "solana": {
      "wallets": 400,
      "transactions": 1200,
      "gas_spent": "0.05 SOL",
      "avg_transaction_cost": "0.000045 SOL"
    },
    "arbitrum": {
      "wallets": 200,
      "transactions": 540,
      "gas_spent": "0.02 ETH",
      "avg_gas_price": "0.1 gwei"
    }
  }
}

// Detailed transaction history
GET /projects/proj_abc123/analytics/transactions?page=1&limit=50&chain=ethereum
Response:
{
  "transactions": [
    {
      "id": "tx_123",
      "type": "wallet_creation",
      "chain": "ethereum",
      "wallet_address": "0x123...",
      "user_id": "user_xyz",
      "tx_hash": "0xabc...",
      "gas_used": 285000,
      "gas_price": "25000000000",
      "gas_cost": "0.007125",
      "paymaster_paid": true,
      "timestamp": "2024-12-26T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 3840,
    "pages": 77
  }
}

// Cost breakdown and forecasting
GET /projects/proj_abc123/analytics/costs?period=30d
Response:
{
  "costs": {
    "total_spent": "0.245 ETH",
    "paymaster_spent": "0.208 ETH",
    "user_paid": "0.037 ETH",
    "by_chain": {
      "ethereum": "0.15 ETH",
      "arbitrum": "0.02 ETH",
      "solana": "0.05 SOL"
    },
    "by_operation": {
      "wallet_creation": "0.185 ETH",
      "transactions": "0.060 ETH"
    }
  },
  "forecast": {
    "next_30d_estimate": "0.295 ETH",
    "based_on": "7-day trend",
    "confidence": "85%"
  }
}

// Export data for billing
GET /projects/proj_abc123/analytics/export?format=csv&period=billing_cycle
Response: CSV file with detailed transaction and cost data
```

---

## 💾 Database Schema

```sql
-- Transaction logs for all project operations
CREATE TABLE project_transaction_logs (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- wallet_creation, deployment, transfer, etc.
  chain VARCHAR(50) NOT NULL,
  wallet_address VARCHAR(255),
  user_identifier VARCHAR(255), -- socialId or user reference
  tx_hash VARCHAR(255),
  block_number BIGINT,
  gas_limit BIGINT,
  gas_used BIGINT,
  gas_price DECIMAL(20,8),
  gas_cost DECIMAL(20,8),
  currency VARCHAR(10), -- ETH, SOL, ARB
  paymaster_paid BOOLEAN DEFAULT false,
  paymaster_address VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, failed
  error_message TEXT,
  metadata TEXT, -- JSON with additional details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP
);

-- User activity tracking per project
CREATE TABLE project_user_activity (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  user_identifier VARCHAR(255) NOT NULL, -- socialId
  social_type VARCHAR(50),
  wallets_created INTEGER DEFAULT 0,
  transactions_sent INTEGER DEFAULT 0,
  last_active TIMESTAMP,
  first_active TIMESTAMP,
  total_gas_spent DECIMAL(20,8) DEFAULT 0,
  preferred_chain VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_identifier)
);

-- Daily aggregated analytics (for performance)
CREATE TABLE project_daily_analytics (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  chain VARCHAR(50) NOT NULL,
  wallets_created INTEGER DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  total_gas_spent DECIMAL(20,8) DEFAULT 0,
  paymaster_spent DECIMAL(20,8) DEFAULT 0,
  avg_gas_price DECIMAL(20,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, date, chain)
);

-- Cost tracking and billing data
CREATE TABLE project_cost_tracking (
  id VARCHAR(50) PRIMARY KEY,
  project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  chain VARCHAR(50) NOT NULL,
  total_transactions INTEGER DEFAULT 0,
  total_gas_cost DECIMAL(20,8) DEFAULT 0,
  paymaster_coverage_pct DECIMAL(5,2) DEFAULT 0,
  usd_value DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, billing_period_start, chain)
);
```

---

## 📊 Analytics Processing

### **Real-time Event Tracking**
```javascript
// Track wallet creation event
async function trackWalletCreation(projectId, walletData) {
  const logEntry = {
    id: generateId(),
    project_id: projectId,
    transaction_type: 'wallet_creation',
    chain: walletData.chain,
    wallet_address: walletData.address,
    user_identifier: walletData.socialId,
    tx_hash: walletData.txHash,
    gas_used: walletData.gasUsed,
    gas_price: walletData.gasPrice,
    gas_cost: calculateGasCost(walletData.gasUsed, walletData.gasPrice),
    paymaster_paid: walletData.paymasterEnabled,
    status: 'confirmed',
    created_at: new Date()
  };
  
  await insertTransactionLog(logEntry);
  await updateUserActivity(projectId, walletData.socialId);
  await updateDailyAnalytics(projectId, walletData.chain);
}

// Background job to update analytics
async function updateProjectAnalytics() {
  const projects = await getAllActiveProjects();
  
  for (const project of projects) {
    await updateDailyAnalytics(project.id);
    await updateCostTracking(project.id);
    await updateUserEngagementMetrics(project.id);
  }
}
```

### **Cost Calculation Engine**
```javascript
// Calculate total costs for a project
async function calculateProjectCosts(projectId, period = '30d') {
  const transactions = await getProjectTransactions(projectId, period);
  
  const costs = {
    total_spent: 0,
    paymaster_spent: 0,
    user_paid: 0,
    by_chain: {},
    by_operation: {}
  };
  
  for (const tx of transactions) {
    const costInEth = convertToETH(tx.gas_cost, tx.currency);
    costs.total_spent += costInEth;
    
    if (tx.paymaster_paid) {
      costs.paymaster_spent += costInEth;
    } else {
      costs.user_paid += costInEth;
    }
    
    costs.by_chain[tx.chain] = (costs.by_chain[tx.chain] || 0) + costInEth;
    costs.by_operation[tx.transaction_type] = (costs.by_operation[tx.transaction_type] || 0) + costInEth;
  }
  
  return costs;
}
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] Transaction logging accuracy
- [ ] Cost calculation correctness
- [ ] User activity aggregation
- [ ] Analytics query performance
- [ ] Export functionality

### **Integration Tests**
- [ ] End-to-end transaction tracking
- [ ] Real-time analytics updates
- [ ] Cross-chain cost aggregation
- [ ] Historical data accuracy
- [ ] Performance under high load

---

## 📈 Dashboard Integration

### **Real-time Metrics**
```javascript
// WebSocket updates for live dashboard
const sendRealtimeUpdate = (projectId, metric) => {
  const wsClients = getProjectWebSocketClients(projectId);
  
  wsClients.forEach(client => {
    client.send(JSON.stringify({
      type: 'analytics_update',
      metric: metric,
      timestamp: new Date()
    }));
  });
};

// Live metrics endpoint
app.get('/projects/:projectId/analytics/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const sendUpdate = () => {
    const metrics = getLiveMetrics(req.params.projectId);
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  };
  
  sendUpdate();
  const interval = setInterval(sendUpdate, 10000); // Every 10 seconds
  
  req.on('close', () => clearInterval(interval));
});
```

---

## 📊 Success Metrics

- [ ] Transaction logging latency < 100ms
- [ ] Analytics query response time < 500ms
- [ ] Cost calculation accuracy > 99.9%
- [ ] Real-time dashboard updates < 30 seconds
- [ ] Export generation < 10 seconds for 30-day data

---

## 🚀 Next Steps

**After completion**:
1. Create visual analytics dashboard
2. Add automated billing integration
3. Implement cost optimization recommendations
4. Add anomaly detection and alerting

---

## 📝 Notes

- Implement proper data retention policies
- Use database indexing for analytics performance
- Consider data warehouse for historical analytics
- Add privacy controls for user data
- Plan for regulatory compliance requirements 