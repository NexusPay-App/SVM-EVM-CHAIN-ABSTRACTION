const mongoose = require('mongoose');
const crypto = require('crypto');

// Force clean slate
if (mongoose.models.ProjectAPIKey) {
  delete mongoose.models.ProjectAPIKey;
}

// Simple, clean schema - no complex nested objects that could cause issues
const apiKeySchema = new mongoose.Schema({
  keyId: {
    type: String,
    required: true,
    unique: true,
    default: () => `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  encryptedKey: String,
  keyIv: String,
  keyAuthTag: String,
  keyPreview: {
    type: String,
    required: true
  },
  keyType: {
    type: String,
    enum: ['dev', 'production', 'restricted'],
    default: 'production'
  },
  permissions: [String],
  ipWhitelist: [{
    ip: String,
    description: String,
    addedAt: { type: Date, default: Date.now }
  }],
  createdBy: {
    type: String,
    required: true
  },
  lastUsedAt: Date,
  usageCount: {
    type: Number,
    default: 0
  },
  expiresAt: Date,
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired', 'rotated'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'api_keys_v2'
});

// Static methods
apiKeySchema.statics.generateAPIKey = function(projectId, type) {
  const keyId = crypto.randomBytes(4).toString('hex');
  const hash = crypto.randomBytes(16).toString('hex');
  return `npay_proj_${projectId}_${keyId}_${type}_${hash}`;
};

apiKeySchema.statics.encryptKey = function(key, projectId) {
  const algorithm = 'aes-256-gcm';
  const secretKey = (process.env.ENCRYPTION_KEY || 'default-key') + projectId;
  const keyBuffer = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

apiKeySchema.statics.createPreview = function(key) {
  if (key.length < 12) return key;
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
};

apiKeySchema.statics.findByProject = function(projectId) {
  return this.find({ 
    project_id: projectId, 
    status: 'active' 
  }).sort({ createdAt: -1 });
};

apiKeySchema.statics.countActiveByProject = function(projectId) {
  return this.countDocuments({ 
    project_id: projectId, 
    status: 'active' 
  });
};

apiKeySchema.statics.parseAPIKey = function(apiKey) {
  const parts = apiKey.split('_');
  if (parts.length < 5 || parts[0] !== 'npay' || parts[1] !== 'proj') {
    throw new Error('Invalid API key format');
  }
  
  return {
    projectId: parts[2],
    keyId: parts[3],
    type: parts[4],
    hash: parts.slice(5).join('_')
  };
};

apiKeySchema.statics.findByKey = async function(apiKey) {
  // For now, use the temporary stored key for lookup
  // In production, you'd hash the key and store the hash
  const keys = await this.find({ status: 'active' });
  
  for (const key of keys) {
    try {
      const decryptedKey = key.decryptKey();
      if (decryptedKey === apiKey) {
        return key;
      }
    } catch (error) {
      // Skip keys that can't be decrypted
      continue;
    }
  }
  
  return null;
};

// Instance methods
apiKeySchema.methods.encryptAndStoreKey = function(key) {
  const encrypted = this.constructor.encryptKey(key, this.project_id);
  this.encryptedKey = encrypted.encrypted;
  this.keyIv = encrypted.iv;
  this.keyAuthTag = encrypted.authTag;
  this.keyPreview = this.constructor.createPreview(key);
  // Store the original key temporarily for reveal (in production, only store encrypted)
  this._originalKey = key;
};

apiKeySchema.methods.decryptKey = function() {
  // For now, return the stored original key
  // In production, implement proper decryption
  if (this._originalKey) {
    return this._originalKey;
  }
  
  // Fallback decryption implementation
  if (!this.encryptedKey || !this.keyIv || !this.keyAuthTag) {
    throw new Error('No encrypted key data found');
  }
  
  const algorithm = 'aes-256-gcm';
  const secretKey = (process.env.ENCRYPTION_KEY || 'default-key') + this.project_id;
  const keyBuffer = crypto.scryptSync(secretKey, 'salt', 32);
  const iv = Buffer.from(this.keyIv, 'hex');
  const authTag = Buffer.from(this.keyAuthTag, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(this.encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

apiKeySchema.methods.incrementUsage = async function() {
  this.usageCount = (this.usageCount || 0) + 1;
  this.lastUsedAt = new Date();
  await this.save();
};

apiKeySchema.methods.isIPAllowed = function(clientIP) {
  // If no IP whitelist is set, allow all IPs
  if (!this.ipWhitelist || this.ipWhitelist.length === 0) {
    return true;
  }
  
  // Check if client IP matches any whitelisted IP/CIDR
  return this.ipWhitelist.some(entry => {
    const whitelistedIP = entry.ip;
    
    // Exact IP match
    if (clientIP === whitelistedIP) {
      return true;
    }
    
    // CIDR range check (basic implementation)
    if (whitelistedIP.includes('/')) {
      return this.isIPInCIDR(clientIP, whitelistedIP);
    }
    
    return false;
  });
};

apiKeySchema.methods.isIPInCIDR = function(ip, cidr) {
  // Basic CIDR validation - for production, use a proper IP library
  try {
    const [network, prefixLength] = cidr.split('/');
    const networkParts = network.split('.').map(Number);
    const ipParts = ip.split('.').map(Number);
    
    if (networkParts.length !== 4 || ipParts.length !== 4) {
      return false;
    }
    
    const prefix = parseInt(prefixLength);
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    
    const networkInt = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const ipInt = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    
    return (networkInt & mask) === (ipInt & mask);
  } catch (error) {
    console.error('CIDR validation error:', error);
    return false;
  }
};

apiKeySchema.methods.addIPToWhitelist = function(ip, description = '') {
  if (!this.ipWhitelist) {
    this.ipWhitelist = [];
  }
  
  // Check if IP already exists
  const existingIP = this.ipWhitelist.find(entry => entry.ip === ip);
  if (existingIP) {
    existingIP.description = description;
    existingIP.addedAt = new Date();
  } else {
    this.ipWhitelist.push({
      ip: ip,
      description: description,
      addedAt: new Date()
    });
  }
};

apiKeySchema.methods.removeIPFromWhitelist = function(ip) {
  if (!this.ipWhitelist) {
    return false;
  }
  
  const index = this.ipWhitelist.findIndex(entry => entry.ip === ip);
  if (index > -1) {
    this.ipWhitelist.splice(index, 1);
    return true;
  }
  
  return false;
};

apiKeySchema.methods.toJSON = function() {
  const obj = this.toObject();
  // Map back to expected field names for API compatibility
  return {
    id: obj.keyId,
    project_id: obj.project_id,
    name: obj.name,
    key_preview: obj.keyPreview,
    type: obj.keyType,
    permissions: obj.permissions || ['wallets:create', 'wallets:deploy', 'wallets:read'],
    ip_whitelist: obj.ipWhitelist || [],
    created_by: obj.createdBy,
    last_used_at: obj.lastUsedAt,
    usage_count: obj.usageCount,
    expires_at: obj.expiresAt,
    status: obj.status,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

const ProjectAPIKey = mongoose.model('ProjectAPIKey', apiKeySchema);
module.exports = ProjectAPIKey; 