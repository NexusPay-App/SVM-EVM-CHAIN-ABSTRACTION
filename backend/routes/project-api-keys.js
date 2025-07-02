const express = require('express');
const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const AuthMiddleware = require('../middleware/auth');
const UsageTracker = require('../middleware/usageTracker');

const router = express.Router();

/**
 * @route POST /projects/:projectId/api-keys
 * @desc Create API key for project (max 3 per project)
 * @access Private
 */
router.post('/:projectId/api-keys', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, type, permissions, ip_whitelist } = req.body;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'API key name is required'
        }
      });
    }

    // Check API key limit (max 3 per project)
    const existingKeyCount = await ProjectAPIKey.countActiveByProject(projectId);
    if (existingKeyCount >= 3) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'API_KEY_LIMIT_EXCEEDED',
          message: 'Maximum of 3 API keys per project allowed',
          details: 'Please delete an existing API key before creating a new one'
        }
      });
    }

    // Validate type
    const validTypes = ['dev', 'production', 'restricted'];
    const keyType = type || 'production';
    if (!validTypes.includes(keyType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: `Invalid API key type. Allowed: ${validTypes.join(', ')}`
        }
      });
    }

    // Generate API key
    const apiKey = ProjectAPIKey.generateAPIKey(projectId, keyType);

    // Create API key record
    const newApiKey = new ProjectAPIKey({
      projectId: projectId,
      keyName: name.trim(),
      keyType: keyType,
      permissions: permissions || ['wallets:create', 'wallets:deploy', 'wallets:read'],
      createdBy: userId
    });

    // Add IP whitelist if provided
    if (ip_whitelist && Array.isArray(ip_whitelist)) {
      ip_whitelist.forEach(entry => {
        if (typeof entry === 'string') {
          newApiKey.addIPToWhitelist(entry, '');
        } else if (entry.ip) {
          newApiKey.addIPToWhitelist(entry.ip, entry.description || '');
        }
      });
    }

    // Encrypt and store the key
    newApiKey.encryptAndStoreKey(apiKey);
    await newApiKey.save();

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        api_key: {
          ...newApiKey.toJSON(),
          key: apiKey // Only show the actual key once
        }
      },
      warning: 'Save this key securely - it won\'t be shown again'
    });

  } catch (error) {
    console.error('API key creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_CREATION_FAILED',
        message: 'Failed to create API key'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/api-keys
 * @desc Get project API keys
 * @access Private
 */
router.get('/:projectId/api-keys', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKeys = await ProjectAPIKey.findByProject(projectId);

    res.json({
      success: true,
      data: {
        api_keys: apiKeys.map(key => key.toJSON()),
        total: apiKeys.length,
        limit: 3
      }
    });

  } catch (error) {
    console.error('API keys fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEYS_FETCH_FAILED',
        message: 'Failed to fetch API keys'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/api-keys/:keyId
 * @desc Get API key details and usage
 * @access Private
 */
router.get('/:projectId/api-keys/:keyId', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        api_key: apiKey.toJSON()
      }
    });

  } catch (error) {
    console.error('API key fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_FETCH_FAILED',
        message: 'Failed to fetch API key'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/api-keys/:keyId/reveal
 * @desc Get the full API key value (for copying)
 * @access Private
 */
router.get('/:projectId/api-keys/:keyId/reveal', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Decrypt and return the full API key
    const fullKey = apiKey.decryptKey();

    res.json({
      success: true,
      data: {
        key: fullKey,
        name: apiKey.keyName,
        type: apiKey.keyType
      }
    });

  } catch (error) {
    console.error('API key reveal error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_REVEAL_FAILED',
        message: 'Failed to reveal API key'
      }
    });
  }
});

/**
 * @route PUT /projects/:projectId/api-keys/:keyId
 * @desc Update API key
 * @access Private
 */
router.put('/:projectId/api-keys/:keyId', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const { name, permissions } = req.body;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Update fields
    if (name && name.trim()) {
      apiKey.keyName = name.trim();
    }
    if (permissions && Array.isArray(permissions)) {
      apiKey.permissions = permissions;
    }

    await apiKey.save();

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: {
        api_key: apiKey.toJSON()
      }
    });

  } catch (error) {
    console.error('API key update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_UPDATE_FAILED',
        message: 'Failed to update API key'
      }
    });
  }
});

/**
 * @route DELETE /projects/:projectId/api-keys/:keyId
 * @desc Delete API key
 * @access Private
 */
router.delete('/:projectId/api-keys/:keyId', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Soft delete (revoke) the API key
    apiKey.status = 'revoked';
    await apiKey.save();

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });

  } catch (error) {
    console.error('API key deletion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_DELETION_FAILED',
        message: 'Failed to delete API key'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/api-keys/:keyId/rotate
 * @desc Rotate API key (generate new key, old key expires in 24h)
 * @access Private
 */
router.post('/:projectId/api-keys/:keyId/rotate', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Generate new API key
    const newKey = ProjectAPIKey.generateAPIKey(projectId, apiKey.keyType);
    
    // Create new API key record
    const newApiKey = new ProjectAPIKey({
      projectId: projectId,
      keyName: `${apiKey.keyName} (Rotated)`,
      keyType: apiKey.keyType,
      permissions: apiKey.permissions,
      createdBy: userId
    });

    // Encrypt and store the new key
    newApiKey.encryptAndStoreKey(newKey);
    await newApiKey.save();

    // Mark old key as expired (24h grace period)
    apiKey.status = 'rotated';
    apiKey.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await apiKey.save();

    res.json({
      success: true,
      message: 'API key rotated successfully',
      data: {
        new_key: newKey,
        new_key_id: newApiKey.keyId,
        old_key_expires: apiKey.expiresAt,
        grace_period_hours: 24
      },
      warning: 'Update your applications within 24 hours'
    });

  } catch (error) {
    console.error('API key rotation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'API_KEY_ROTATION_FAILED',
        message: 'Failed to rotate API key'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/api-keys/:keyId/usage
 * @desc Get API key usage analytics
 * @access Private
 */
router.get('/:projectId/api-keys/:keyId/usage', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const { days = 7 } = req.query;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Get detailed analytics from UsageTracker
    const analytics = await UsageTracker.getDetailedAnalytics(keyId, {
      days: parseInt(days) || 7,
      includeHourly: req.query.include_hourly === 'true',
      includeEndpoints: req.query.include_endpoints !== 'false'
    });

    // Rate limit info (basic implementation)
    const rateLimit = 1000; // requests per hour
    const rateLimitRemaining = rateLimit; // simplified for now

    res.json({
      success: true,
      data: {
        usage: {
          ...analytics,
          rate_limit_per_hour: rateLimit,
          rate_limit_remaining: rateLimitRemaining,
          last_used: apiKey.lastUsedAt,
          created_at: apiKey.createdAt
        }
      }
    });

  } catch (error) {
    console.error('API key usage fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USAGE_FETCH_FAILED',
        message: 'Failed to fetch API key usage'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/api-keys/:keyId/whitelist
 * @desc Add IP to API key whitelist
 * @access Private
 */
router.post('/:projectId/api-keys/:keyId/whitelist', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId } = req.params;
    const { ip, description } = req.body;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Validate IP format (basic validation)
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IP',
          message: 'Valid IP address or CIDR range required'
        }
      });
    }

    // Add IP to whitelist
    apiKey.addIPToWhitelist(ip, description || '');
    await apiKey.save();

    res.json({
      success: true,
      message: 'IP added to whitelist successfully',
      data: {
        api_key: apiKey.toJSON()
      }
    });

  } catch (error) {
    console.error('IP whitelist add error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WHITELIST_ADD_FAILED',
        message: 'Failed to add IP to whitelist'
      }
    });
  }
});

/**
 * @route DELETE /projects/:projectId/api-keys/:keyId/whitelist/:ip
 * @desc Remove IP from API key whitelist
 * @access Private
 */
router.delete('/:projectId/api-keys/:keyId/whitelist/:ip', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId, keyId, ip } = req.params;
    const userId = req.user.id;

    // Validate project ownership
    const project = await Project.findByIdAndOwner(projectId, userId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found or access denied'
        }
      });
    }

    const apiKey = await ProjectAPIKey.findOne({
      keyId: keyId,
      projectId: projectId,
      status: 'active'
    });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'API_KEY_NOT_FOUND',
          message: 'API key not found'
        }
      });
    }

    // Remove IP from whitelist
    const removed = apiKey.removeIPFromWhitelist(decodeURIComponent(ip));
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'IP_NOT_FOUND',
          message: 'IP not found in whitelist'
        }
      });
    }

    await apiKey.save();

    res.json({
      success: true,
      message: 'IP removed from whitelist successfully',
      data: {
        api_key: apiKey.toJSON()
      }
    });

  } catch (error) {
    console.error('IP whitelist remove error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WHITELIST_REMOVE_FAILED',
        message: 'Failed to remove IP from whitelist'
      }
    });
  }
});

module.exports = router; 