const mongoose = require('mongoose');
const crypto = require('crypto');

const projectSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `proj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  slug: {
    type: String,
    unique: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function(url) {
        if (!url) return true; // Optional field
        return /^https?:\/\/.+/.test(url);
      },
      message: 'Website must be a valid URL'
    }
  },
  owner_id: {
    type: String,
    required: true,
    index: true
  },
  chains: [{
    type: String,
    enum: ['ethereum', 'solana', 'arbitrum'],
    required: true
  }],
  settings: {
    paymasterEnabled: {
      type: Boolean,
      default: true
    },
    webhookUrl: {
      type: String,
      validate: {
        validator: function(url) {
          if (!url) return true;
          return /^https?:\/\/.+/.test(url);
        },
        message: 'Webhook URL must be a valid URL'
      }
    },
    rateLimit: {
      type: Number,
      default: 1000,
      min: 100,
      max: 10000
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'projects'
});

// Generate URL-friendly slug with duplicate handling
projectSchema.pre('save', async function(next) {
  if (this.isModified('name') || !this.slug) {
    const baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check for existing slugs and append number if needed
    while (true) {
      const existingProject = await this.constructor.findOne({ 
        slug: slug,
        _id: { $ne: this._id } // Exclude current document when updating
      });
      
      if (!existingProject) {
        this.slug = slug;
        break;
      }
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }
  next();
});

// Static method to find projects by owner
projectSchema.statics.findByOwner = function(ownerId) {
  return this.find({ owner_id: ownerId, status: 'active' });
};

// Static method to find project by ID and owner
projectSchema.statics.findByIdAndOwner = function(projectId, ownerId) {
  return this.findOne({ id: projectId, owner_id: ownerId, status: 'active' });
};

// Instance method to check if user owns project
projectSchema.methods.isOwnedBy = function(userId) {
  return this.owner_id === userId;
};

// Transform JSON output
projectSchema.methods.toJSON = function() {
  const projectObject = this.toObject();
  delete projectObject.__v;
  delete projectObject._id;
  return projectObject;
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project; 