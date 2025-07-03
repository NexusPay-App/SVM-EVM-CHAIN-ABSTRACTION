const express = require('express');
const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const AuthMiddleware = require('../middleware/auth');
const PaymasterService = require('../services/paymasterService');
const { getSupportedChainIds } = require('../config/chains');

const router = express.Router();

/**
 * @route POST /projects
 * @desc Create a new project
 * @access Private
 */
router.post('/', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { name, description, website, chains } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_NAME',
          message: 'Project name is required'
        }
      });
    }

    if (!chains || !Array.isArray(chains) || chains.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CHAINS',
          message: 'At least one blockchain must be selected'
        }
      });
    }

    // Validate supported chains
    const supportedChains = getSupportedChainIds();
    const invalidChains = chains.filter(chain => !supportedChains.includes(chain));
    if (invalidChains.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CHAINS',
          message: `Unsupported chains: ${invalidChains.join(', ')}`,
          details: `Supported chains: ${supportedChains.join(', ')}`
        }
      });
    }

    // Create project object (but don't save yet)
    const project = new Project({
      name: name.trim(),
      description: description ? description.trim() : undefined,
      website: website ? website.trim() : undefined,
      owner_id: userId,
      chains: [...new Set(chains)] // Remove duplicates
    });

    // IMPORTANT: Deploy paymasters FIRST before saving project
    console.log(`🔄 Creating paymasters for project ${project.id} on chains: ${chains.join(', ')}`);
    
    try {
      // Create and deploy paymasters for each selected chain
      const paymasters = await PaymasterService.createProjectPaymasters(project.id, chains);
      
      // Verify paymasters were created (deployed OR pending funding)
      const successfulStatuses = ['deployed', 'pending_funding'];
      const failedPaymasters = paymasters.filter(pm => !successfulStatuses.includes(pm.deployment_status));
      
      if (failedPaymasters.length > 0) {
        const failedCategories = failedPaymasters.map(pm => pm.chain_category);
        throw new Error(`Failed to create paymasters for: ${failedCategories.join(', ')}`);
      }
      
      // Count deployed vs pending funding
      const deployedCount = paymasters.filter(pm => pm.deployment_status === 'deployed').length;
      const pendingFundingCount = paymasters.filter(pm => pm.deployment_status === 'pending_funding').length;
      
      // Only save project if ALL paymasters deployed successfully
      await project.save();
      
      // Only save project if paymasters were created (even if not yet deployed)
      await project.save();
      
      console.log(`✅ Project created successfully with ${paymasters.length} paymasters`);
      console.log(`   Deployed: ${deployedCount}, Pending funding: ${pendingFundingCount}`);
      
      const responseMessage = pendingFundingCount > 0 
        ? 'Project created. Some paymasters need funding before deployment.'
        : 'Project and paymasters created successfully';
      
      res.status(201).json({
        success: true,
        message: responseMessage,
        data: {
          project: project.toJSON(),
          paymasters: {
            total: paymasters.length,
            deployed: deployedCount,
            pending_funding: pendingFundingCount
          },
          funding_required: pendingFundingCount > 0
        }
      });
      
    } catch (error) {
      console.error(`❌ Failed to create project paymasters:`, error);
      
      // Cleanup: Delete any partially created paymasters
      try {
        await PaymasterService.cleanupFailedProject(project.id);
        console.log(`🧹 Cleaned up failed paymasters for project ${project.id}`);
      } catch (cleanupError) {
        console.error('Failed to cleanup paymasters:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'PAYMASTER_DEPLOYMENT_FAILED',
          message: `Project creation failed: ${error.message}`,
          details: 'All paymasters must deploy successfully before project can be created'
        }
      });
    }

  } catch (error) {
    console.error('Project creation error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'PROJECT_EXISTS',
          message: 'A project with this name already exists'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'PROJECT_CREATION_FAILED',
        message: 'Failed to create project'
      }
    });
  }
});

/**
 * @route GET /projects
 * @desc Get user's projects
 * @access Private
 */
router.get('/', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const projects = await Project.findByOwner(userId);

    res.json({
      success: true,
      data: {
        projects: projects.map(project => project.toJSON())
      }
    });

  } catch (error) {
    console.error('Projects fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROJECTS_FETCH_FAILED',
        message: 'Failed to fetch projects'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId
 * @desc Get project details
 * @access Private
 */
router.get('/:projectId', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

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

    // Get API key count for this project
    const apiKeyCount = await ProjectAPIKey.countActiveByProject(projectId);

    res.json({
      success: true,
      data: {
        project: {
          ...project.toJSON(),
          api_key_count: apiKeyCount
        }
      }
    });

  } catch (error) {
    console.error('Project fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROJECT_FETCH_FAILED',
        message: 'Failed to fetch project'
      }
    });
  }
});

/**
 * @route PUT /projects/:projectId
 * @desc Update project
 * @access Private
 */
router.put('/:projectId', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { name, description, website, chains, settings } = req.body;

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

    // Update fields
    if (name && name.trim()) {
      project.name = name.trim();
      project.slug = undefined; // Will be regenerated
    }
    if (description !== undefined) {
      project.description = description ? description.trim() : undefined;
    }
    if (website !== undefined) {
      project.website = website ? website.trim() : undefined;
    }
    if (chains && Array.isArray(chains)) {
      const supportedChains = getSupportedChainIds();
      const invalidChains = chains.filter(chain => !supportedChains.includes(chain));
      if (invalidChains.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CHAINS',
            message: `Unsupported chains: ${invalidChains.join(', ')}`
          }
        });
      }
      project.chains = [...new Set(chains)];
    }
    if (settings) {
      if (settings.paymasterEnabled !== undefined) {
        project.settings.paymasterEnabled = settings.paymasterEnabled;
      }
      if (settings.webhookUrl !== undefined) {
        project.settings.webhookUrl = settings.webhookUrl;
      }
      if (settings.rateLimit !== undefined) {
        project.settings.rateLimit = settings.rateLimit;
      }
    }

    await project.save();

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: {
        project: project.toJSON()
      }
    });

  } catch (error) {
    console.error('Project update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROJECT_UPDATE_FAILED',
        message: 'Failed to update project'
      }
    });
  }
});

/**
 * @route DELETE /projects/:projectId
 * @desc Delete project (soft delete)
 * @access Private
 */
router.delete('/:projectId', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

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

    // Soft delete project
    project.status = 'deleted';
    await project.save();

    // Revoke all API keys for this project
    await ProjectAPIKey.updateMany(
      { project_id: projectId },
      { status: 'revoked' }
    );

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Project deletion error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROJECT_DELETION_FAILED',
        message: 'Failed to delete project'
      }
    });
  }
});

module.exports = router; 