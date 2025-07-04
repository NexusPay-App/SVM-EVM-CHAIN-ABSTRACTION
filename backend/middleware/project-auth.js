const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const UsageTracker = require('./usageTracker');

class ProjectAuthMiddleware {
  /**
   * Enhanced project API key validation with bulletproof error handling
   */
  static async validateProjectAPIKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apikey;
      
      // Step 1: Check if API key is provided
      if (!apiKey) {
        return ProjectAuthMiddleware.sendError(res, 'MISSING_API_KEY', 
          'API key required', 
          'Include X-API-Key header or apikey query parameter');
      }

      // Step 2: Handle development keys
      if (ProjectAuthMiddleware.isDevKey(apiKey)) {
        req.apiKey = apiKey;
        req.isDevKey = true;
        return next();
      }

      // Step 3: Parse and validate API key format
      const keyInfo = ProjectAuthMiddleware.parseAPIKey(apiKey);
      if (!keyInfo.valid) {
        return ProjectAuthMiddleware.sendError(res, 'INVALID_API_KEY_FORMAT', 
          'Invalid API key format', 
          'API key must be in format: npay_proj_[project_id]_[key_id]_[type]_[hash]');
      }

      // Step 4: Find and validate API key in database
      const dbAPIKey = await ProjectAPIKey.findByKey(apiKey);
      if (!dbAPIKey) {
        return ProjectAuthMiddleware.sendError(res, 'INVALID_API_KEY', 
          'Invalid or revoked API key',
          'The API key does not exist or has been revoked');
      }

      // Step 5: Check API key status and expiration
      const keyValidation = ProjectAuthMiddleware.validateAPIKeyStatus(dbAPIKey);
      if (!keyValidation.valid) {
        return ProjectAuthMiddleware.sendError(res, keyValidation.code, 
          keyValidation.message, keyValidation.details);
      }

      // Step 6: Verify project ID consistency 
      if (dbAPIKey.project_id !== keyInfo.projectId) {
        return ProjectAuthMiddleware.sendError(res, 'PROJECT_MISMATCH', 
          'API key project mismatch',
          `API key belongs to project ${dbAPIKey.project_id}, but request claims ${keyInfo.projectId}`);
      }

      // Step 7: Get and validate project
      const project = await Project.findOne({
        id: keyInfo.projectId,
        status: 'active'
      });

      if (!project) {
        return ProjectAuthMiddleware.sendError(res, 'PROJECT_NOT_FOUND', 
          'Project not found or inactive',
          `Project ${keyInfo.projectId} does not exist or is not active`);
      }

      // Step 8: Check IP whitelist for production keys
      const ipValidation = ProjectAuthMiddleware.validateIPAccess(req, dbAPIKey);
      if (!ipValidation.valid) {
        return ProjectAuthMiddleware.sendError(res, ipValidation.code, 
          ipValidation.message, ipValidation.details);
      }

      // Step 9: Track usage and add context
      await ProjectAuthMiddleware.trackUsageAndAddContext(req, dbAPIKey, project);

      next();

    } catch (error) {
      console.error('🔥 API key validation error:', error);
      return ProjectAuthMiddleware.sendError(res, 'API_KEY_VALIDATION_FAILED', 
        'Internal validation error', 
        'Please check your API key and try again');
    }
  }

  /**
   * Check if API key has required permission
   */
  static requirePermission(permission) {
    return (req, res, next) => {
      // Skip permission check for dev keys
      if (req.isDevKey) {
        return next();
      }

      if (!req.permissions || !req.permissions.includes(permission)) {
        return ProjectAuthMiddleware.sendError(res, 'INSUFFICIENT_PERMISSIONS', 
          `Permission '${permission}' required for this action`,
          `Available permissions: ${req.permissions ? req.permissions.join(', ') : 'none'}`);
      }

      next();
    };
  }

  /**
   * Enhanced API key parsing with better validation
   */
  static parseAPIKey(apiKey) {
    try {
      // Expected format: npay_proj_[project_id]_[key_id]_[type]_[hash]
      const parts = apiKey.split('_');
      
      if (parts.length < 6 || parts[0] !== 'npay' || parts[1] !== 'proj') {
        return { valid: false, error: 'Invalid API key format' };
      }

      // Extract project ID (everything between proj_ and the last 3 parts)
      const projectIdParts = parts.slice(2, -3);
      const projectId = projectIdParts.join('_');
      
      const keyId = parts[parts.length - 3];
      const type = parts[parts.length - 2];
      const hash = parts[parts.length - 1];

      if (!projectId || !keyId || !type || !hash) {
        return { valid: false, error: 'Missing API key components' };
      }

      return {
        valid: true,
        projectId,
        keyId,
        type,
        hash,
        fullKey: apiKey
      };
    } catch (error) {
      return { valid: false, error: 'API key parsing failed' };
    }
  }

  /**
   * Check if API key is a development key
   */
  static isDevKey(apiKey) {
    const devKeys = ['local-dev-key', 'dev-key', 'development-key'];
    return devKeys.includes(apiKey);
  }

  /**
   * Validate API key status and expiration
   */
  static validateAPIKeyStatus(dbAPIKey) {
    // Check expiration
    if (dbAPIKey.expiresAt && new Date() > dbAPIKey.expiresAt) {
      return {
        valid: false,
        code: 'API_KEY_EXPIRED',
        message: 'API key has expired',
        details: `Key expired on ${dbAPIKey.expiresAt.toISOString()}`
      };
    }

    // Check status
    if (!['active', 'rotated'].includes(dbAPIKey.status)) {
      return {
        valid: false,
        code: 'API_KEY_REVOKED',
        message: 'API key has been revoked',
        details: `Key status: ${dbAPIKey.status}`
      };
    }

    return { valid: true };
  }

  /**
   * Validate IP access for production keys
   */
  static validateIPAccess(req, dbAPIKey) {
    // Skip IP validation for non-production keys or environments
    if (dbAPIKey.keyType !== 'production' || process.env.NODE_ENV !== 'production') {
      return { valid: true };
    }

    const clientIP = req.ip || 
                    req.connection?.remoteAddress || 
                    req.headers['x-forwarded-for']?.split(',')[0] ||
                    req.headers['x-real-ip'] ||
                    '127.0.0.1';

    if (!dbAPIKey.isIPAllowed(clientIP)) {
      return {
        valid: false,
        code: 'IP_NOT_WHITELISTED',
        message: 'Request from unauthorized IP address',
        details: `IP ${clientIP} is not whitelisted for this production API key`
      };
    }

    return { valid: true };
  }

  /**
   * Track API key usage and add context to request
   */
  static async trackUsageAndAddContext(req, dbAPIKey, project) {
    try {
      // Track API key usage
      await dbAPIKey.incrementUsage();

      // Add comprehensive context to request
      req.apiKey = req.headers['x-api-key'] || req.query.apikey;
      req.apiKeyRecord = dbAPIKey;
      req.project = project;
      req.permissions = dbAPIKey.permissions;
      req.projectId = project.id;
      req.projectName = project.name;
      req.projectOwner = project.owner_id;
      req.projectChains = project.chains;
      
      // Add developer-friendly metadata
      req.authContext = {
        projectId: project.id,
        projectName: project.name,
        keyType: dbAPIKey.keyType,
        permissions: dbAPIKey.permissions,
        chains: project.chains,
        authenticated: true
      };

    } catch (error) {
      console.error('❌ Failed to track usage:', error);
      // Don't fail the request if usage tracking fails
    }
  }

  /**
   * Send consistent error responses
   */
  static sendError(res, code, message, details = null) {
    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    };

    if (details) {
      errorResponse.error.details = details;
    }

    // Add developer-friendly suggestions
    errorResponse.error.suggestions = ProjectAuthMiddleware.getErrorSuggestions(code);

    const statusCode = ProjectAuthMiddleware.getStatusCode(code);
    return res.status(statusCode).json(errorResponse);
  }

  /**
   * Get appropriate HTTP status code for error
   */
  static getStatusCode(code) {
    const statusCodes = {
      'MISSING_API_KEY': 401,
      'INVALID_API_KEY_FORMAT': 401,
      'INVALID_API_KEY': 401,
      'API_KEY_EXPIRED': 401,
      'API_KEY_REVOKED': 401,
      'PROJECT_MISMATCH': 401,
      'PROJECT_NOT_FOUND': 401,
      'IP_NOT_WHITELISTED': 403,
      'INSUFFICIENT_PERMISSIONS': 403,
      'API_KEY_VALIDATION_FAILED': 500
    };

    return statusCodes[code] || 500;
  }

  /**
   * Get developer-friendly error suggestions
   */
  static getErrorSuggestions(code) {
    const suggestions = {
      'MISSING_API_KEY': [
        'Add X-API-Key header to your request',
        'Include apikey query parameter',
        'Check your SDK configuration'
      ],
      'INVALID_API_KEY_FORMAT': [
        'Verify your API key format',
        'Copy the full API key from your dashboard',
        'Check for any truncation or modification'
      ],
      'INVALID_API_KEY': [
        'Verify your API key is correct',
        'Check if the key has been revoked',
        'Generate a new API key from your dashboard'
      ],
      'API_KEY_EXPIRED': [
        'Generate a new API key from your dashboard',
        'Check your key expiration settings'
      ],
      'PROJECT_MISMATCH': [
        'Verify your project ID matches your API key',
        'Use the correct API key for your project',
        'Check your project configuration'
      ],
      'PROJECT_NOT_FOUND': [
        'Verify your project exists and is active',
        'Check your project ID spelling',
        'Contact support if project was accidentally deleted'
      ],
      'IP_NOT_WHITELISTED': [
        'Add your IP to the whitelist in your dashboard',
        'Use a development API key for testing',
        'Contact your network administrator'
      ],
      'INSUFFICIENT_PERMISSIONS': [
        'Update your API key permissions in the dashboard',
        'Use an API key with broader permissions',
        'Contact your project administrator'
      ]
    };

    return suggestions[code] || ['Contact support for assistance'];
  }

  /**
   * Middleware for project name validation (for SDK simplification)
   */
  static async validateProjectName(req, res, next) {
    try {
      const projectName = req.body.projectName || req.query.projectName;
      
      if (!projectName) {
        return ProjectAuthMiddleware.sendError(res, 'MISSING_PROJECT_NAME', 
          'Project name required', 
          'Include projectName in your request');
      }

      // If we already have project from API key validation, verify name matches
      if (req.project) {
        if (req.project.name !== projectName) {
          return ProjectAuthMiddleware.sendError(res, 'PROJECT_NAME_MISMATCH', 
            'Project name does not match API key',
            `API key belongs to project "${req.project.name}", but request specifies "${projectName}"`);
        }
      }

      req.requestedProjectName = projectName;
      next();

    } catch (error) {
      console.error('🔥 Project name validation error:', error);
      return ProjectAuthMiddleware.sendError(res, 'PROJECT_NAME_VALIDATION_FAILED', 
        'Failed to validate project name');
    }
  }
}

module.exports = ProjectAuthMiddleware; 