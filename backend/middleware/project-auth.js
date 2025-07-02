const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const UsageTracker = require('./usageTracker');

class ProjectAuthMiddleware {
  /**
   * Validate project-based API key and add project context to request
   */
  static async validateProjectAPIKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apikey;
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key required',
            details: 'Include X-API-Key header or apikey query parameter'
          }
        });
      }

      // Allow dev keys for testing
      if (apiKey === 'local-dev-key' || apiKey === 'dev-key') {
        req.apiKey = apiKey;
        req.isDevKey = true;
        return next();
      }

      // Parse API key to extract project ID
      let keyInfo;
      try {
        keyInfo = ProjectAPIKey.parseAPIKey(apiKey);
      } catch (parseError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Invalid API key format',
            details: 'API key must be in format: npay_proj_xxx_type_xxx'
          }
        });
      }

      // Find the API key in database by decrypting and matching
      const dbAPIKey = await ProjectAPIKey.findByKey(apiKey);
      if (!dbAPIKey) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or revoked API key'
          }
        });
      }

      // Check if key is expired
      if (dbAPIKey.expiresAt && new Date() > dbAPIKey.expiresAt) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'API_KEY_EXPIRED',
            message: 'API key has expired'
          }
        });
      }

      // Check if key status is active or in grace period (rotated)
      if (!['active', 'rotated'].includes(dbAPIKey.status)) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'API_KEY_REVOKED',
            message: 'API key has been revoked'
          }
        });
      }

      // Check IP whitelist (skip for dev keys and development)
      if (dbAPIKey.keyType === 'production' && process.env.NODE_ENV === 'production') {
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
        
        if (!dbAPIKey.isIPAllowed(clientIP)) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'IP_NOT_WHITELISTED',
              message: 'Request from unauthorized IP address',
              details: `IP ${clientIP} is not in the whitelist for this production API key`
            }
          });
        }
      }

      // Verify project ID matches
      if (dbAPIKey.projectId !== keyInfo.projectId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'PROJECT_MISMATCH',
            message: 'API key does not belong to the specified project'
          }
        });
      }

      // Get project details
      const project = await Project.findOne({
        id: keyInfo.projectId,
        status: 'active'
      });

      if (!project) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found or inactive'
          }
        });
      }

      // Track API key usage
      await dbAPIKey.incrementUsage();

      // Add context to request
      req.apiKey = apiKey;
      req.apiKeyRecord = dbAPIKey;
      req.project = project;
      req.permissions = dbAPIKey.permissions;
      req.projectId = project.id;

      next();

    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_VALIDATION_FAILED',
          message: 'Failed to validate API key'
        }
      });
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
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Permission '${permission}' required for this action`,
            details: `Available permissions: ${req.permissions ? req.permissions.join(', ') : 'none'}`
          }
        });
      }

      next();
    };
  }
}

module.exports = ProjectAuthMiddleware; 