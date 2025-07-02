const mongoose = require('mongoose');
const crypto = require('crypto');

const paymasterPaymentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `pp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  paymaster_address: {
    type: String,
    required: true,
    index: true
  },
  chain: {
    type: String,
    required: true,
    enum: ['ethereum', 'solana', 'arbitrum'],
    index: true
  },
  amount: {
    type: String, // Use string to avoid precision issues
    required: true
  },
  amount_wei: {
    type: String,
    required: true
  },
  gas_for_address: {
    type: String,
    required: true,
    index: true
  },
  tx_hash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  block_number: {
    type: Number
  },
  gas_price: {
    type: String
  },
  gas_used: {
    type: Number
  },
  usd_value: {
    type: Number,
    default: 0
  },
  operation_type: {
    type: String,
    enum: ['wallet_deploy', 'transaction_sponsor', 'contract_interaction'],
    default: 'transaction_sponsor'
  },
  user_operation_hash: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true,
  collection: 'paymaster_payments'
});

// Indexes for efficient querying
paymasterPaymentSchema.index({ project_id: 1, createdAt: -1 });
paymasterPaymentSchema.index({ paymaster_address: 1, createdAt: -1 });
paymasterPaymentSchema.index({ gas_for_address: 1, createdAt: -1 });
paymasterPaymentSchema.index({ chain: 1, status: 1 });

// Static method to find payments by project
paymasterPaymentSchema.statics.findByProject = function(projectId, limit = 50, offset = 0) {
  return this.find({ project_id: projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to find payments by paymaster address
paymasterPaymentSchema.statics.findByPaymaster = function(paymasterAddress, limit = 50) {
  return this.find({ paymaster_address: paymasterAddress })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get spending summary for project
paymasterPaymentSchema.statics.getSpendingSummary = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const summary = await this.aggregate([
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
        total_amount: { $sum: { $toDouble: '$amount' } },
        total_usd: { $sum: '$usd_value' },
        transaction_count: { $sum: 1 },
        avg_cost: { $avg: '$usd_value' }
      }
    }
  ]);
  
  return summary;
};

// Static method to get daily spending for charts
paymasterPaymentSchema.statics.getDailySpending = async function(projectId, days = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const dailySpending = await this.aggregate([
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
        total_usd: { $sum: '$usd_value' },
        transaction_count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ]);
  
  return dailySpending;
};

// Instance method to calculate USD value
paymasterPaymentSchema.methods.calculateUsdValue = function(tokenPriceUsd) {
  this.usd_value = parseFloat(this.amount) * tokenPriceUsd;
};

// Transform JSON output
paymasterPaymentSchema.methods.toJSON = function() {
  const paymentObject = this.toObject();
  delete paymentObject.__v;
  delete paymentObject._id;
  return paymentObject;
};

const PaymasterPayment = mongoose.model('PaymasterPayment', paymasterPaymentSchema);

module.exports = PaymasterPayment; 