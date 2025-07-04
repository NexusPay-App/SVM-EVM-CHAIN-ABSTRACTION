const express = require('express');
const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const AuthMiddleware = require('../middleware/auth');
const PaymasterService = require('../services/paymasterService');
const { getSupportedChainIds } = require('../config/chains');
const ProjectAuthMiddleware = require('../middleware/project-auth');
const ProjectPaymaster = require('../models/ProjectPaymaster');
const crypto = require('crypto');
const WalletGenerator = require('../services/walletGenerator');

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

/**
 * @route POST /projects/:projectId/wallets
 * @desc Create user wallets for a project using project paymaster
 * @access Private (requires project API key)
 */
router.post('/:projectId/wallets', 
  ProjectAuthMiddleware.validateProjectAPIKey,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { socialId, socialType, chains = ['ethereum', 'arbitrum', 'solana'] } = req.body;

      // Validate required parameters
      if (!socialId || !socialType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'socialId and socialType are required'
          }
        });
      }

      // Validate chains
      if (!Array.isArray(chains) || chains.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CHAINS',
            message: 'At least one chain must be specified'
          }
        });
      }

      console.log(`🚀 Creating user wallets for ${socialId} on project ${projectId}`);

      // Get project paymasters to check funding
      const projectPaymasters = await ProjectPaymaster.find({
        project_id: projectId,
        deployment_status: 'deployed'
      });

      if (projectPaymasters.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_DEPLOYED_PAYMASTERS',
            message: 'No deployed paymasters found for this project. Please deploy paymasters first.'
          }
        });
      }

      // Create user wallets using project paymasters
      const wallets = {};
      const deploymentResults = [];

      for (const chain of chains) {
        try {
          console.log(`🔗 Deploying ${chain} wallet for ${socialId}...`);
          
          // Find paymaster for this chain
          const paymaster = projectPaymasters.find(pm => 
            pm.supported_chains.includes(chain)
          );

          if (!paymaster) {
            console.warn(`⚠️ No paymaster found for ${chain}`);
            continue;
          }

          // Generate deterministic wallet address
          const walletGenerator = require('../services/walletGenerator');
          const salt = crypto.createHash('sha256')
            .update(`${socialId}-${socialType}-${projectId}`)
            .digest('hex');

          let walletResult;
          if (chain === 'solana') {
            walletResult = await walletGenerator.generateSolanaUserWallet({
              socialId,
              socialType,
              salt,
              usePaymaster: true,
              projectId,
              paymasterAddress: paymaster.address
            });
          } else {
            walletResult = await walletGenerator.generateUserWallet({
              socialId,
              socialType,
              chain,
              salt,
              usePaymaster: true,
              projectId,
              paymasterAddress: paymaster.address
            });
          }

          if (walletResult.success) {
            wallets[chain] = {
              address: walletResult.address,
              chain: chain,
              category: chain === 'solana' ? 'svm' : 'evm',
              isDeployed: walletResult.isDeployed,
              deploymentTx: walletResult.txHash,
              paymasterUsed: paymaster.address,
              gasFeesPaid: walletResult.gasFees || 0
            };

            deploymentResults.push({
              chain,
              status: 'success',
              address: walletResult.address,
              txHash: walletResult.txHash,
              gasFees: walletResult.gasFees || 0
            });

            console.log(`✅ ${chain} wallet deployed: ${walletResult.address}`);
          } else {
            console.error(`❌ ${chain} wallet deployment failed:`, walletResult.error);
            deploymentResults.push({
              chain,
              status: 'failed',
              error: walletResult.error
            });
          }

        } catch (error) {
          console.error(`❌ ${chain} deployment error:`, error);
          deploymentResults.push({
            chain,
            status: 'error',
            error: error.message
          });
        }
      }

      // Check if any wallets were created
      if (Object.keys(wallets).length === 0) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'WALLET_CREATION_FAILED',
            message: 'Failed to create wallets on any chain'
          },
          details: deploymentResults
        });
      }

      // Calculate total gas fees paid by project paymaster
      const totalGasFees = deploymentResults
        .filter(r => r.status === 'success')
        .reduce((sum, r) => sum + (r.gasFees || 0), 0);

      console.log(`🎉 User wallets created successfully. Total gas fees: $${totalGasFees.toFixed(4)}`);

      res.status(201).json({
        success: true,
        message: 'User wallets created successfully',
        data: {
          projectId,
          socialId,
          socialType,
          wallets,
          project: {
            name: req.project.name,
            chains: req.project.chains
          },
          paymasterEnabled: true,
          gasFeesSpent: totalGasFees,
          deploymentResults
        }
      });

    } catch (error) {
      console.error('Wallet creation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'WALLET_CREATION_FAILED',
          message: error.message
        }
      });
    }
  }
);

/**
 * POST /api/projects/validate
 * Validate project name against API key (for SDK initialization)
 */
router.post('/validate', ProjectAuthMiddleware.validateProjectAPIKey, async (req, res) => {
  try {
    const { projectName, projectId } = req.body;

    if (!projectName || !projectId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Both projectName and projectId are required',
          suggestions: [
            'Include projectName in your request body',
            'Include projectId in your request body',
            'Check your SDK configuration'
          ]
        }
      });
    }

    // Check if the authenticated project matches the requested details
    if (req.project.id !== projectId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'PROJECT_ID_MISMATCH',
          message: 'Project ID does not match API key',
          details: `API key belongs to project ${req.project.id}, but request specifies ${projectId}`,
          suggestions: [
            'Verify your project ID is correct',
            'Check that you\'re using the right API key',
            'Regenerate your API key if needed'
          ]
        }
      });
    }

    if (req.project.name !== projectName) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'PROJECT_NAME_MISMATCH',
          message: 'Project name does not match API key',
          details: `API key belongs to project "${req.project.name}", but request specifies "${projectName}"`,
          suggestions: [
            `Use "${req.project.name}" as your project name`,
            'Check your project name in the dashboard',
            'Verify project name is spelled correctly (case-sensitive)',
            'Make sure you\'re using the correct API key'
          ]
        }
      });
    }

    // Return validation success with project info
    res.json({
      success: true,
      data: {
        projectName: req.project.name,
        projectId: req.project.id,
        chains: req.project.chains,
        validated: true
      }
    });

  } catch (error) {
    console.error('❌ Project validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Failed to validate project',
        suggestions: [
          'Check your API key is valid',
          'Verify your project exists',
          'Contact support if the problem persists'
        ]
      }
    });
  }
});

module.exports = router; 