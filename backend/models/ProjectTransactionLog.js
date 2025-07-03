const mongoose = require('mongoose');
const crypto = require('crypto');

const projectTransactionLogSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  transaction_type: {
    type: String,
    required: true,
    enum: [
      'wallet_creation',
      'wallet_deployment', 
      'token_transfer',
      'nft_transfer',
      'contract_interaction',
      'paymaster_payment',
      'cross_chain_transfer',
      'batch_transaction'
    ],
    index: true
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'solana', 'arbitrum', 'polygon', 'bsc'],
    index: true
  },
  wallet_address: {
    type: String,
    required: true,
    index: true
  },
  user_identifier: {
    type: String,
    required: true,
    index: true // socialId
  },
  social_type: {
    type: String,
    required: true,
    enum: ['email', 'phone', 'ens', 'discord', 'twitter', 'telegram']
  },
  tx_hash: {
    type: String,
    index: true
  },
  block_number: {
    type: Number
  },
  gas_limit: {
    type: Number
  },
  gas_used: {
    type: Number
  },
  gas_price: {
    type: String // Store as string to avoid precision issues
  },
  gas_cost: {
    type: String // Total gas cost in native currency (ETH, SOL, etc.)
  },
  gas_cost_usd: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    enum: ['ETH', 'SOL', 'MATIC', 'BNB', 'ARB'],
    required: true
  },
  paymaster_paid: {
    type: Boolean,
    default: false,
    index: true
  },
  paymaster_address: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'dropped'],
    default: 'pending',
    index: true
  },
  error_message: {
    type: String
  },
  transaction_details: {
    to_address: String,
    from_address: String,
    amount: String,
    token_contract: String,
    token_symbol: String,
    token_type: { type: String, enum: ['native', 'erc20', 'erc721', 'erc1155', 'spl', 'spl_nft'] },
    method_name: String,
    contract_address: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed // Flexible JSON for additional data
  },
  confirmed_at: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'project_transaction_logs'
});

// Compound indexes for efficient querying
projectTransactionLogSchema.index({ project_id: 1, createdAt: -1 });
projectTransactionLogSchema.index({ project_id: 1, chain: 1, createdAt: -1 });
projectTransactionLogSchema.index({ project_id: 1, user_identifier: 1, createdAt: -1 });
projectTransactionLogSchema.index({ project_id: 1, transaction_type: 1, createdAt: -1 });
projectTransactionLogSchema.index({ project_id: 1, paymaster_paid: 1, createdAt: -1 });
projectTransactionLogSchema.index({ wallet_address: 1, createdAt: -1 });
projectTransactionLogSchema.index({ tx_hash: 1 });

// Static methods for analytics
projectTransactionLogSchema.statics.getProjectOverview = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const pipeline = [
    {
      $match: {
        project_id: projectId,
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total_transactions: { $sum: 1 },
        unique_wallets: { $addToSet: '$wallet_address' },
        unique_users: { $addToSet: '$user_identifier' },
        total_gas_cost_usd: { $sum: '$gas_cost_usd' },
        paymaster_transactions: {
          $sum: { $cond: ['$paymaster_paid', 1, 0] }
        },
        user_paid_transactions: {
          $sum: { $cond: ['$paymaster_paid', 0, 1] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total_transactions: 1,
        total_wallets_created: { $size: '$unique_wallets' },
        total_unique_users: { $size: '$unique_users' },
        total_gas_cost_usd: { $round: ['$total_gas_cost_usd', 4] },
        paymaster_coverage_pct: {
          $round: [
            { $multiply: [
              { $divide: ['$paymaster_transactions', '$total_transactions'] },
              100
            ] },
            2
          ]
        },
        paymaster_transactions: 1,
        user_paid_transactions: 1
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    total_transactions: 0,
    total_wallets_created: 0,
    total_unique_users: 0,
    total_gas_cost_usd: 0,
    paymaster_coverage_pct: 0,
    paymaster_transactions: 0,
    user_paid_transactions: 0
  };
};

projectTransactionLogSchema.statics.getChainBreakdown = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
        project_id: projectId,
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$chain',
        total_transactions: { $sum: 1 },
        unique_wallets: { $addToSet: '$wallet_address' },
        unique_users: { $addToSet: '$user_identifier' },
        total_gas_cost_usd: { $sum: '$gas_cost_usd' },
        avg_gas_cost_usd: { $avg: '$gas_cost_usd' },
        paymaster_transactions: {
          $sum: { $cond: ['$paymaster_paid', 1, 0] }
        },
        paymaster_gas_cost_usd: {
          $sum: { $cond: ['$paymaster_paid', '$gas_cost_usd', 0] }
        }
      }
    },
    {
      $project: {
        chain: '$_id',
        total_transactions: 1,
        total_wallets: { $size: '$unique_wallets' },
        total_users: { $size: '$unique_users' },
        total_gas_cost_usd: { $round: ['$total_gas_cost_usd', 4] },
        avg_gas_cost_usd: { $round: ['$avg_gas_cost_usd', 6] },
        paymaster_transactions: 1,
        paymaster_coverage_pct: {
          $round: [
            { 
              $cond: [
                { $gt: ['$total_gas_cost_usd', 0] },
                { $multiply: [
                  { $divide: ['$paymaster_gas_cost_usd', '$total_gas_cost_usd'] },
                  100
                ] },
                0
              ]
            },
            2
          ]
        }
      }
    },
    {
      $sort: { total_transactions: -1 }
    }
  ]);
};

projectTransactionLogSchema.statics.getDailyMetrics = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
        project_id: projectId,
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          chain: '$chain'
        },
        transactions_count: { $sum: 1 },
        unique_users: { $addToSet: '$user_identifier' },
        total_gas_cost_usd: { $sum: '$gas_cost_usd' },
        paymaster_transactions: {
          $sum: { $cond: ['$paymaster_paid', 1, 0] }
        }
      }
    },
    {
      $project: {
        date: '$_id.date',
        chain: '$_id.chain',
        transactions_count: 1,
        unique_users_count: { $size: '$unique_users' },
        total_gas_cost_usd: { $round: ['$total_gas_cost_usd', 4] },
        paymaster_transactions: 1,
        user_paid_transactions: { $subtract: ['$transactions_count', '$paymaster_transactions'] }
      }
    },
    {
      $sort: { date: 1, chain: 1 }
    }
  ]);
};

projectTransactionLogSchema.statics.getUserActivity = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
        project_id: projectId,
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$user_identifier',
        social_type: { $first: '$social_type' },
        transactions_count: { $sum: 1 },
        wallets_created: {
          $sum: { $cond: [{ $eq: ['$transaction_type', 'wallet_creation'] }, 1, 0] }
        },
        total_gas_spent_usd: { $sum: '$gas_cost_usd' },
        chains_used: { $addToSet: '$chain' },
        first_transaction: { $min: '$createdAt' },
        last_transaction: { $max: '$createdAt' },
        paymaster_usage: {
          $sum: { $cond: ['$paymaster_paid', 1, 0] }
        }
      }
    },
    {
      $project: {
        user_identifier: '$_id',
        social_type: 1,
        transactions_count: 1,
        wallets_created: 1,
        total_gas_spent_usd: { $round: ['$total_gas_spent_usd', 4] },
        chains_used: 1,
        chains_count: { $size: '$chains_used' },
        first_transaction: 1,
        last_transaction: 1,
        paymaster_usage: 1,
        paymaster_usage_pct: {
          $round: [
            { $multiply: [
              { $divide: ['$paymaster_usage', '$transactions_count'] },
              100
            ] },
            2
          ]
        }
      }
    },
    {
      $sort: { transactions_count: -1 }
    },
    {
      $limit: 100 // Top 100 users
    }
  ]);
};

projectTransactionLogSchema.statics.getTransactionsByType = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
        project_id: projectId,
        status: 'confirmed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$transaction_type',
        count: { $sum: 1 },
        total_gas_cost_usd: { $sum: '$gas_cost_usd' },
        avg_gas_cost_usd: { $avg: '$gas_cost_usd' },
        paymaster_coverage: {
          $sum: { $cond: ['$paymaster_paid', 1, 0] }
        },
        paymaster_gas_cost_usd: {
          $sum: { $cond: ['$paymaster_paid', '$gas_cost_usd', 0] }
        }
      }
    },
    {
      $project: {
        transaction_type: '$_id',
        count: 1,
        total_gas_cost_usd: { $round: ['$total_gas_cost_usd', 4] },
        avg_gas_cost_usd: { $round: ['$avg_gas_cost_usd', 6] },
        paymaster_coverage: 1,
        paymaster_coverage_pct: {
          $round: [
            { 
              $cond: [
                { $gt: ['$total_gas_cost_usd', 0] },
                { $multiply: [
                  { $divide: ['$paymaster_gas_cost_usd', '$total_gas_cost_usd'] },
                  100
                ] },
                0
              ]
            },
            2
          ]
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Static method to record a transaction
projectTransactionLogSchema.statics.recordTransaction = async function(transactionData) {
  const log = new this({
    project_id: transactionData.projectId,
    transaction_type: transactionData.transactionType,
    chain: transactionData.chain,
    wallet_address: transactionData.walletAddress,
    user_identifier: transactionData.userIdentifier,
    social_type: transactionData.socialType,
    tx_hash: transactionData.txHash,
    block_number: transactionData.blockNumber,
    gas_limit: transactionData.gasLimit,
    gas_used: transactionData.gasUsed,
    gas_price: transactionData.gasPrice,
    gas_cost: transactionData.gasCost,
    gas_cost_usd: transactionData.gasCostUsd,
    currency: transactionData.currency,
    paymaster_paid: transactionData.paymasterPaid || false,
    paymaster_address: transactionData.paymasterAddress,
    status: transactionData.status || 'pending',
    error_message: transactionData.errorMessage,
    transaction_details: transactionData.transactionDetails,
    metadata: transactionData.metadata,
    confirmed_at: transactionData.confirmedAt
  });
  
  return await log.save();
};

// Transform JSON output
projectTransactionLogSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  delete obj._id;
  return obj;
};

const ProjectTransactionLog = mongoose.model('ProjectTransactionLog', projectTransactionLogSchema);

module.exports = ProjectTransactionLog; 