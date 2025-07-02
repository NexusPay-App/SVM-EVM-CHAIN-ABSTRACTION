const mongoose = require('mongoose');

const apiKeyUsageSchema = new mongoose.Schema({
  usageId: {
    type: String,
    required: true,
    unique: true,
    default: () => `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  apiKeyId: {
    type: String,
    required: true,
    index: true
  },
  projectId: {
    type: String,
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  statusCode: {
    type: Number,
    required: true
  },
  responseTimeMs: {
    type: Number,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  errorMessage: String,
  requestSize: Number,
  responseSize: Number
}, {
  timestamps: true,
  collection: 'api_key_usage'
});

// Indexes for efficient querying
apiKeyUsageSchema.index({ apiKeyId: 1, createdAt: -1 });
apiKeyUsageSchema.index({ projectId: 1, createdAt: -1 });
apiKeyUsageSchema.index({ createdAt: -1 });

// Static methods for analytics
apiKeyUsageSchema.statics.getUsageStats = async function(apiKeyId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        apiKeyId: apiKeyId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        requests: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTimeMs' },
        errors: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

apiKeyUsageSchema.statics.getHourlyStats = async function(apiKeyId, hours = 24) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);
  
  const pipeline = [
    {
      $match: {
        apiKeyId: apiKeyId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        },
        requests: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTimeMs' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

apiKeyUsageSchema.statics.getEndpointStats = async function(apiKeyId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const pipeline = [
    {
      $match: {
        apiKeyId: apiKeyId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          endpoint: '$endpoint',
          method: '$method'
        },
        requests: { $sum: 1 },
        avgResponseTime: { $avg: '$responseTimeMs' },
        errors: {
          $sum: {
            $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { requests: -1 }
    }
  ];
  
  return await this.aggregate(pipeline);
};

apiKeyUsageSchema.statics.trackUsage = async function(data) {
  const usage = new this({
    apiKeyId: data.apiKeyId,
    projectId: data.projectId,
    endpoint: data.endpoint,
    method: data.method,
    statusCode: data.statusCode,
    responseTimeMs: data.responseTimeMs,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    errorMessage: data.errorMessage,
    requestSize: data.requestSize,
    responseSize: data.responseSize
  });
  
  return await usage.save();
};

const APIKeyUsage = mongoose.model('APIKeyUsage', apiKeyUsageSchema);
module.exports = APIKeyUsage; 