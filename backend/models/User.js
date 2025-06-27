const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  password_hash: {
    type: String,
    required: function() {
      return !this.google_id; // Password not required for Google OAuth users
    },
    minlength: 6
  },
  google_id: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    index: true
  },
  profile_picture: {
    type: String // URL to profile picture from Google
  },
  auth_provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  company: {
    type: String,
    trim: true,
    maxlength: 255
  },
  email_verified: {
    type: Boolean,
    default: function() {
      return this.auth_provider === 'google'; // Auto-verify Google users
    }
  },
  verification_token: {
    type: String,
    sparse: true, // Allows multiple null values
    index: true
  },
  verification_token_expires: {
    type: Date
  },
  password_reset_token: {
    type: String,
    sparse: true,
    index: true
  },
  password_reset_expires: {
    type: Date
  },
  last_login: {
    type: Date
  },
  login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'users'
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.locked_until && this.locked_until > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new) and it exists
  if (!this.isModified('password_hash') || !this.password_hash) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password_hash);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to generate verification token
userSchema.methods.generateVerificationToken = function() {
  this.verification_token = crypto.randomBytes(32).toString('hex');
  this.verification_token_expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  return this.verification_token;
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  this.password_reset_token = crypto.randomBytes(32).toString('hex');
  this.password_reset_expires = Date.now() + (1 * 60 * 60 * 1000); // 1 hour
  return this.password_reset_token;
};

// Instance method to handle failed login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.locked_until && this.locked_until < Date.now()) {
    return this.updateOne({
      $unset: { locked_until: 1 },
      $set: { login_attempts: 1 }
    });
  }
  
  const updates = { $inc: { login_attempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.login_attempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { locked_until: Date.now() + (2 * 60 * 60 * 1000) };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      login_attempts: 1,
      locked_until: 1
    }
  });
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find user by Google ID
userSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ google_id: googleId });
};

// Static method to find user by verification token
userSchema.statics.findByVerificationToken = function(token) {
  return this.findOne({
    verification_token: token,
    verification_token_expires: { $gt: Date.now() }
  });
};

// Static method to find user by password reset token
userSchema.statics.findByPasswordResetToken = function(token) {
  return this.findOne({
    password_reset_token: token,
    password_reset_expires: { $gt: Date.now() }
  });
};

// Transform JSON output (remove sensitive fields)
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  
  // Remove sensitive fields
  delete userObject.password_hash;
  delete userObject.verification_token;
  delete userObject.password_reset_token;
  delete userObject.login_attempts;
  delete userObject.locked_until;
  delete userObject.__v;
  
  return userObject;
};

// Create and export model
const User = mongoose.model('User', userSchema);

module.exports = User; 