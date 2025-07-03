const mongoose = require('mongoose');
const crypto = require('crypto');

const projectPaymasterSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `pm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  chain_category: {
    type: String,
    required: true,
    enum: ['evm', 'svm'], // Changed to categories instead of specific chains
    index: true
  },
  supported_chains: [{
    type: String,
    enum: ['ethereum', 'arbitrum', 'polygon', 'bsc', 'solana', 'eclipse']
  }],
  primary_deployment_chain: {
    type: String, // The chain where the contract is actually deployed
    required: true
  },
  address: {
    type: String,
    required: true,
    index: true
  },
  contract_address: {
    type: String, // Deployed contract address (different from funding address)
    index: true
  },
  deployment_tx: {
    type: String // Transaction hash of the deployment
  },
  entry_point_address: {
    type: String // EntryPoint contract address for EIP-4337
  },
  deployment_status: {
    type: String,
    enum: ['pending', 'pending_funding', 'deployed', 'failed'],
    default: 'pending'
  },
  private_key_encrypted: {
    encrypted: String,
    iv: String,
    authTag: String
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'project_paymasters'
});

// Compound unique index for project + chain_category
projectPaymasterSchema.index({ project_id: 1, chain_category: 1 }, { unique: true });

// Static method to find paymasters by project
projectPaymasterSchema.statics.findByProject = function(projectId) {
  return this.find({ project_id: projectId, status: 'active' });
};

// Static method to find paymaster by project and chain category
projectPaymasterSchema.statics.findByProjectAndCategory = function(projectId, chainCategory) {
  return this.findOne({ project_id: projectId, chain_category: chainCategory, status: 'active' });
};

// Static method to find paymaster for a specific chain (maps to category)
projectPaymasterSchema.statics.findByProjectAndChain = function(projectId, chain) {
  const chainCategory = this.getChainCategory(chain);
  return this.findByProjectAndCategory(projectId, chainCategory);
};

// Static method to get chain category from specific chain
projectPaymasterSchema.statics.getChainCategory = function(chain) {
  const evmChains = ['ethereum', 'arbitrum', 'polygon', 'bsc', 'sepolia'];
  const svmChains = ['solana', 'eclipse'];
  
  if (evmChains.includes(chain)) return 'evm';
  if (svmChains.includes(chain)) return 'svm';
  
  throw new Error(`Unsupported chain: ${chain}`);
};

// Static method to get supported chains by category
projectPaymasterSchema.statics.getChainsByCategory = function(chainCategory) {
  const chainMap = {
    evm: ['ethereum', 'arbitrum', 'polygon', 'bsc'],
    svm: ['solana', 'eclipse']
  };
  
  return chainMap[chainCategory] || [];
};

// Instance method to encrypt private key
projectPaymasterSchema.methods.encryptPrivateKey = function(privateKey) {
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync((process.env.ENCRYPTION_KEY || 'default-key') + this.project_id, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  this.private_key_encrypted = {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

// Instance method to decrypt private key
projectPaymasterSchema.methods.decryptPrivateKey = function() {
  if (!this.private_key_encrypted || !this.private_key_encrypted.encrypted) {
    throw new Error('No encrypted private key found');
  }
  
  const algorithm = 'aes-256-gcm';
  const key = crypto.scryptSync((process.env.ENCRYPTION_KEY || 'default-key') + this.project_id, 'salt', 32);
  const iv = Buffer.from(this.private_key_encrypted.iv, 'hex');
  const authTag = Buffer.from(this.private_key_encrypted.authTag, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(this.private_key_encrypted.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Transform JSON output
projectPaymasterSchema.methods.toJSON = function() {
  const paymasterObject = this.toObject();
  delete paymasterObject.__v;
  delete paymasterObject._id;
  delete paymasterObject.private_key_encrypted; // Never expose encrypted keys
  return paymasterObject;
};

const ProjectPaymaster = mongoose.model('ProjectPaymaster', projectPaymasterSchema);

module.exports = ProjectPaymaster; 