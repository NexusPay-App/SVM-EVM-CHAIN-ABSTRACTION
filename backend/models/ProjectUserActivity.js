const mongoose = require('mongoose');
const crypto = require('crypto');

const projectUserActivitySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `ua_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  project_id: {
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
  wallets_created: {
    type: Number,
    default: 0
  },
  transactions_sent: {
    type: Number,
    default: 0
  },
  total_gas_spent_usd: {
    type: Number,
    default: 0
  },
  paymaster_transactions: {
    type: Number,
    default: 0
  },
  user_paid_transactions: {
    type: Number,
    default: 0
  },
  chains_used: [{
    type: String,
    enum: ['ethereum', 'solana', 'arbitrum', 'polygon', 'bsc']
  }],
  preferred_chain: {
    type: String,
    enum: ['ethereum', 'solana', 'arbitrum', 'polygon', 'bsc']
  },
  wallet_addresses: [{
    chain: String,
    address: String,
    created_at: { type: Date, default: Date.now }
  }],
  first_active: {
    type: Date
  },
  last_active: {
    type: Date
  },
  activity_streak_days: {
    type: Number,
    default: 0
  },
  total_active_days: {
    type: Number,
    default: 0
  },
  engagement_score: {
    type: Number,
    default: 0 // Calculated score based on activity
  },
  transaction_types_used: [{
    type: String,
    enum: [
      'wallet_creation',
      'wallet_deployment',
      'token_transfer',
      'nft_transfer',
      'contract_interaction',
      'paymaster_payment',
      'cross_chain_transfer',
      'batch_transaction'
    ]
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed // Additional flexible data
  }
}, {
  timestamps: true,
  collection: 'project_user_activity'
});

// Compound unique index for project + user
projectUserActivitySchema.index({ project_id: 1, user_identifier: 1 }, { unique: true });

// Other useful indexes
projectUserActivitySchema.index({ project_id: 1, last_active: -1 });
projectUserActivitySchema.index({ project_id: 1, engagement_score: -1 });
projectUserActivitySchema.index({ project_id: 1, total_gas_spent_usd: -1 });
projectUserActivitySchema.index({ project_id: 1, transactions_sent: -1 });

// Static methods for analytics
projectUserActivitySchema.statics.getTopUsers = async function(projectId, metric = 'transactions_sent', limit = 50) {
  const sortOptions = {};
  sortOptions[metric] = -1;
  
  return await this.find({ project_id: projectId })
    .sort(sortOptions)
    .limit(limit)
    .lean();
};

projectUserActivitySchema.statics.getUserEngagementMetrics = async function(projectId) {
  return await this.aggregate([
    {
      $match: { project_id: projectId }
    },
    {
      $group: {
        _id: null,
        total_users: { $sum: 1 },
        active_users_7d: {
          $sum: {
            $cond: [
              { $gte: ['$last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        active_users_30d: {
          $sum: {
            $cond: [
              { $gte: ['$last_active', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        power_users: { // Users with >10 transactions
          $sum: {
            $cond: [
              { $gt: ['$transactions_sent', 10] },
              1,
              0
            ]
          }
        },
        avg_transactions_per_user: { $avg: '$transactions_sent' },
        avg_gas_spent_per_user: { $avg: '$total_gas_spent_usd' },
        avg_engagement_score: { $avg: '$engagement_score' },
        multi_chain_users: {
          $sum: {
            $cond: [
              { $gt: [{ $size: '$chains_used' }, 1] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        total_users: 1,
        active_users_7d: 1,
        active_users_30d: 1,
        power_users: 1,
        avg_transactions_per_user: { $round: ['$avg_transactions_per_user', 2] },
        avg_gas_spent_per_user: { $round: ['$avg_gas_spent_per_user', 4] },
        avg_engagement_score: { $round: ['$avg_engagement_score', 2] },
        multi_chain_users: 1,
        retention_rate_7d: {
          $round: [
            { $multiply: [
              { $divide: ['$active_users_7d', '$total_users'] },
              100
            ] },
            2
          ]
        },
        retention_rate_30d: {
          $round: [
            { $multiply: [
              { $divide: ['$active_users_30d', '$total_users'] },
              100
            ] },
            2
          ]
        }
      }
    }
  ]);
};

projectUserActivitySchema.statics.getChainPreferences = async function(projectId) {
  return await this.aggregate([
    {
      $match: { project_id: projectId }
    },
    {
      $unwind: '$chains_used'
    },
    {
      $group: {
        _id: '$chains_used',
        user_count: { $sum: 1 }
      }
    },
    {
      $project: {
        chain: '$_id',
        user_count: 1
      }
    },
    {
      $sort: { user_count: -1 }
    }
  ]);
};

projectUserActivitySchema.statics.getUserCohorts = async function(projectId) {
  const now = new Date();
  const cohorts = [
    { name: 'new_users_7d', days: 7 },
    { name: 'new_users_30d', days: 30 },
    { name: 'new_users_90d', days: 90 }
  ];
  
  const results = {};
  
  for (const cohort of cohorts) {
    const startDate = new Date(now.getTime() - cohort.days * 24 * 60 * 60 * 1000);
    
    const cohortData = await this.aggregate([
      {
        $match: {
          project_id: projectId,
          first_active: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_users: { $sum: 1 },
          avg_transactions: { $avg: '$transactions_sent' },
          avg_gas_spent: { $avg: '$total_gas_spent_usd' },
          retention_active: {
            $sum: {
              $cond: [
                { $gte: ['$last_active', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total_users: 1,
          avg_transactions: { $round: ['$avg_transactions', 2] },
          avg_gas_spent: { $round: ['$avg_gas_spent', 4] },
          retention_rate: {
            $round: [
              { $multiply: [
                { $divide: ['$retention_active', '$total_users'] },
                100
              ] },
              2
            ]
          }
        }
      }
    ]);
    
    results[cohort.name] = cohortData[0] || {
      total_users: 0,
      avg_transactions: 0,
      avg_gas_spent: 0,
      retention_rate: 0
    };
  }
  
  return results;
};

// Static method to update or create user activity
projectUserActivitySchema.statics.updateUserActivity = async function(projectId, userIdentifier, activityData) {
  const update = {
    $set: {
      last_active: new Date(),
      social_type: activityData.socialType
    },
    $inc: {},
    $addToSet: {}
  };
  
  // Set first_active only if not already set
  if (!await this.findOne({ project_id: projectId, user_identifier: userIdentifier })) {
    update.$set.first_active = new Date();
  }
  
  // Increment counters based on activity type
  if (activityData.transactionType === 'wallet_creation') {
    update.$inc.wallets_created = 1;
    
    // Add wallet address
    if (activityData.walletAddress && activityData.chain) {
      update.$addToSet['wallet_addresses'] = {
        chain: activityData.chain,
        address: activityData.walletAddress,
        created_at: new Date()
      };
    }
  }
  
  if (activityData.transactionSent) {
    update.$inc.transactions_sent = 1;
  }
  
  if (activityData.gasCostUsd) {
    update.$inc.total_gas_spent_usd = activityData.gasCostUsd;
  }
  
  if (activityData.paymasterPaid) {
    update.$inc.paymaster_transactions = 1;
  } else {
    update.$inc.user_paid_transactions = 1;
  }
  
  if (activityData.chain) {
    update.$addToSet.chains_used = activityData.chain;
  }
  
  if (activityData.transactionType) {
    update.$addToSet.transaction_types_used = activityData.transactionType;
  }
  
  const userActivity = await this.findOneAndUpdate(
    { 
      project_id: projectId, 
      user_identifier: userIdentifier 
    },
    update,
    { 
      upsert: true, 
      new: true 
    }
  );
  
  // Calculate and update engagement score
  userActivity.calculateEngagementScore();
  userActivity.updatePreferredChain();
  await userActivity.save();
  
  return userActivity;
};

// Instance method to calculate engagement score
projectUserActivitySchema.methods.calculateEngagementScore = function() {
  let score = 0;
  
  // Base activity points
  score += this.transactions_sent * 2;
  score += this.wallets_created * 5;
  
  // Multi-chain bonus
  if (this.chains_used && this.chains_used.length > 1) {
    score += this.chains_used.length * 10;
  }
  
  // Transaction type diversity bonus
  if (this.transaction_types_used && this.transaction_types_used.length > 2) {
    score += this.transaction_types_used.length * 3;
  }
  
  // Recency bonus
  const daysSinceLastActive = this.last_active ? 
    Math.floor((Date.now() - this.last_active.getTime()) / (1000 * 60 * 60 * 24)) : 999;
  
  if (daysSinceLastActive <= 1) score += 20;
  else if (daysSinceLastActive <= 7) score += 10;
  else if (daysSinceLastActive <= 30) score += 5;
  
  // Activity streak bonus
  score += Math.min(this.activity_streak_days * 2, 50);
  
  this.engagement_score = Math.min(score, 1000); // Cap at 1000
  return this.engagement_score;
};

// Instance method to update preferred chain
projectUserActivitySchema.methods.updatePreferredChain = function() {
  if (!this.chains_used || this.chains_used.length === 0) return;
  
  // Simple heuristic: most recently used chain
  // In a real implementation, you'd want to track transaction frequency per chain
  this.preferred_chain = this.chains_used[this.chains_used.length - 1];
};

// Transform JSON output
projectUserActivitySchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  delete obj._id;
  return obj;
};

const ProjectUserActivity = mongoose.model('ProjectUserActivity', projectUserActivitySchema);

module.exports = ProjectUserActivity; 