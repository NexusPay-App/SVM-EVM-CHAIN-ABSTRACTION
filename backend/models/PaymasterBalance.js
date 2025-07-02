const mongoose = require('mongoose');
const crypto = require('crypto');

const paymasterBalanceSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `pb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'arbitrum', 'polygon', 'bsc', 'solana', 'eclipse'],
    index: true
  },
  address: {
    type: String,
    required: true,
    index: true
  },
  balance_native: {
    type: String,
    required: true,
    default: '0'
  },
  balance_wei: {
    type: String,
    required: true,
    default: '0'
  },
  balance_usd: {
    type: String,
    default: '0.00'
  },
  token_price_usd: {
    type: Number,
    default: 0
  },
  last_updated: {
    type: Date,
    default: Date.now
  },
  last_tx_hash: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'paymaster_balances'
});

// Compound unique index for project + chain (each chain tracks balance separately)
paymasterBalanceSchema.index({ project_id: 1, chain: 1 }, { unique: true });

// Index for balance monitoring
paymasterBalanceSchema.index({ last_updated: 1 });

// Static method to find balances by project
paymasterBalanceSchema.statics.findByProject = function(projectId) {
  return this.find({ project_id: projectId });
};

// Static method to find balance by project and chain
paymasterBalanceSchema.statics.findByProjectAndChain = function(projectId, chain) {
  return this.findOne({ project_id: projectId, chain: chain });
};

// Static method to get total USD value for project
paymasterBalanceSchema.statics.getTotalUsdValue = async function(projectId) {
  const balances = await this.find({ project_id: projectId });
  return balances.reduce((total, balance) => total + parseFloat(balance.balance_usd || 0), 0);
};

// Static method to find low balance paymasters
paymasterBalanceSchema.statics.findLowBalances = function(thresholdUsd = 10) {
  return this.find({ 
    $expr: { 
      $lt: [{ $toDouble: "$balance_usd" }, thresholdUsd] 
    } 
  });
};

// Instance method to update balance
paymasterBalanceSchema.methods.updateBalance = function(balanceWei, tokenPriceUsd) {
  this.balance_wei = balanceWei.toString();
  
  // Convert to readable format based on chain
  if (this.chain === 'solana' || this.chain === 'eclipse') {
    this.balance_native = (parseFloat(balanceWei) / 1e9).toFixed(9); // SOL has 9 decimals
  } else {
    this.balance_native = (parseFloat(balanceWei) / 1e18).toFixed(6); // ETH/ARB have 18 decimals, show 6 for readability
  }
  
  this.token_price_usd = tokenPriceUsd;
  const usdValue = parseFloat(this.balance_native) * tokenPriceUsd;
  this.balance_usd = usdValue.toFixed(2);
  this.last_updated = new Date();
};

// Instance method to check if balance is low
paymasterBalanceSchema.methods.isLowBalance = function(thresholdUsd = 10) {
  return parseFloat(this.balance_usd) < thresholdUsd;
};

// Transform JSON output
paymasterBalanceSchema.methods.toJSON = function() {
  const balanceObject = this.toObject();
  delete balanceObject.__v;
  delete balanceObject._id;
  return balanceObject;
};

const PaymasterBalance = mongoose.model('PaymasterBalance', paymasterBalanceSchema);

module.exports = PaymasterBalance; 