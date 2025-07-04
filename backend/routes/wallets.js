const express = require('express');
const router = express.Router();
const ProjectAuthMiddleware = require('../middleware/project-auth');
const WalletGenerator = require('../services/walletGenerator');

/**
 * POST /api/wallets/create
 * Simplified wallet creation for optimized SDK
 */
router.post('/create', 
  ProjectAuthMiddleware.validateProjectAPIKey,
  ProjectAuthMiddleware.requirePermission('wallets:create'),
  async (req, res) => {
    try {
      const { socialId, socialType, chains, enableGasless, projectName } = req.body;

      // Validate required parameters
      if (!socialId || !socialType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'socialId and socialType are required',
            suggestions: [
              'Include socialId in your request',
              'Include socialType in your request',
              'Check your SDK configuration'
            ]
          }
        });
      }

      // Validate project name if provided
      if (projectName && req.project.name !== projectName) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'PROJECT_NAME_MISMATCH',
            message: 'Project name does not match API key',
            details: `API key belongs to project "${req.project.name}", but request specifies "${projectName}"`,
            suggestions: [
              `Use "${req.project.name}" as your project name`,
              'Check your project name in the dashboard',
              'Verify you\'re using the correct API key'
            ]
          }
        });
      }

      // Default to all project chains if not specified
      const targetChains = chains || req.project.chains;

      console.log(`🚀 Creating wallet for ${socialId} (${socialType}) on project ${req.project.name}`);
      console.log(`📋 Target chains: ${targetChains.join(', ')}`);

      // Generate deterministic salt for consistent addresses
      const salt = require('crypto').createHash('sha256')
        .update(`${socialId}-${socialType}-${req.project.id}`)
        .digest('hex');

      const walletData = {
        id: `wallet_${Date.now()}_${salt.substring(0, 8)}`,
        socialId,
        socialType,
        project_id: req.project.id,
        addresses: {},
        status: 'deploying',
        deployment_status: {},
        gasless_enabled: enableGasless !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let totalGasFees = 0;
      const deploymentResults = [];

      // Create wallets on each chain
      for (const chain of targetChains) {
        try {
          let walletResult;

          if (chain === 'solana') {
            walletResult = await WalletGenerator.generateSolanaUserWallet({
              socialId,
              socialType,
              salt,
              usePaymaster: enableGasless !== false,
              projectId: req.project.id
            });
          } else {
            walletResult = await WalletGenerator.generateUserWallet({
              socialId,
              socialType,
              chain,
              salt,
              usePaymaster: enableGasless !== false,
              projectId: req.project.id
            });
          }

          if (walletResult.success) {
            walletData.addresses[chain] = walletResult.address;
            walletData.deployment_status[chain] = walletResult.deployed ? 'confirmed' : 'pending';
            
            if (walletResult.gasFee) {
              totalGasFees += parseFloat(walletResult.gasFee);
            }

            deploymentResults.push({
              chain,
              address: walletResult.address,
              deployed: walletResult.deployed,
              gasFee: walletResult.gasFee || '0'
            });

            console.log(`✅ ${chain} wallet: ${walletResult.address}`);
          } else {
            console.log(`❌ ${chain} wallet failed: ${walletResult.error}`);
            walletData.deployment_status[chain] = 'failed';
            
            deploymentResults.push({
              chain,
              error: walletResult.error,
              deployed: false
            });
          }
        } catch (error) {
          console.error(`❌ ${chain} wallet error:`, error);
          walletData.deployment_status[chain] = 'failed';
          
          deploymentResults.push({
            chain,
            error: error.message,
            deployed: false
          });
        }
      }

      // Check if any wallets were created successfully
      const successfulDeployments = deploymentResults.filter(r => r.address);
      if (successfulDeployments.length === 0) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'WALLET_CREATION_FAILED',
            message: 'Failed to create wallet on any chain',
            details: 'All chain deployments failed',
            suggestions: [
              'Check if your paymasters are funded',
              'Verify chain configurations',
              'Try again in a few moments',
              'Contact support if the problem persists'
            ]
          }
        });
      }

      // Update overall status
      walletData.status = successfulDeployments.length === targetChains.length ? 'deployed' : 'partial';

      // Return wallet data
      res.json({
        success: true,
        data: {
          ...walletData,
          deployment_results: deploymentResults,
          total_gas_fees: totalGasFees.toFixed(6),
          total_gas_fees_usd: (totalGasFees * 2000).toFixed(2) // Rough ETH price estimation
        }
      });

      console.log(`🎉 Wallet created successfully. Total gas fees: $${(totalGasFees * 2000).toFixed(4)}`);

    } catch (error) {
      console.error('❌ Wallet creation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'WALLET_CREATION_ERROR',
          message: 'Failed to create wallet',
          details: error.message,
          suggestions: [
            'Check your API key and permissions',
            'Verify project configuration',
            'Try again in a few moments',
            'Contact support if the problem persists'
          ]
        }
      });
    }
  }
);

/**
 * GET /api/wallets/social
 * Get wallet by social ID and type
 */
router.get('/social',
  ProjectAuthMiddleware.validateProjectAPIKey,
  ProjectAuthMiddleware.requirePermission('wallets:read'),
  async (req, res) => {
    try {
      const { socialId, socialType, projectName } = req.query;

      if (!socialId || !socialType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'socialId and socialType are required',
            suggestions: [
              'Include socialId in your query parameters',
              'Include socialType in your query parameters'
            ]
          }
        });
      }

      // Validate project name if provided
      if (projectName && req.project.name !== projectName) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'PROJECT_NAME_MISMATCH',
            message: 'Project name does not match API key',
            suggestions: [
              `Use "${req.project.name}" as your project name`,
              'Check your project name in the dashboard'
            ]
          }
        });
      }

      // Generate the same deterministic addresses that would be created
      const salt = require('crypto').createHash('sha256')
        .update(`${socialId}-${socialType}-${req.project.id}`)
        .digest('hex');

      const walletData = {
        id: `wallet_${socialId}_${socialType}`,
        socialId,
        socialType,
        project_id: req.project.id,
        addresses: {},
        status: 'deployed', // Assume deployed for simplicity
        deployment_status: {},
        gasless_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Generate addresses for all project chains
      for (const chain of req.project.chains) {
        try {
          let walletResult;

          if (chain === 'solana') {
            walletResult = await WalletGenerator.generateSolanaUserWallet({
              socialId,
              socialType,
              salt,
              usePaymaster: false, // Just generate address, don't deploy
              projectId: req.project.id
            });
          } else {
            walletResult = await WalletGenerator.generateUserWallet({
              socialId,
              socialType,
              chain,
              salt,
              usePaymaster: false, // Just generate address, don't deploy
              projectId: req.project.id
            });
          }

          if (walletResult.success) {
            walletData.addresses[chain] = walletResult.address;
            walletData.deployment_status[chain] = 'confirmed';
          }
        } catch (error) {
          console.error(`❌ Failed to generate ${chain} address:`, error);
        }
      }

      res.json({
        success: true,
        data: walletData
      });

    } catch (error) {
      console.error('❌ Get wallet error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_WALLET_ERROR',
          message: 'Failed to get wallet',
          details: error.message,
          suggestions: [
            'Check your parameters',
            'Verify the wallet exists',
            'Try again in a few moments'
          ]
        }
      });
    }
  }
);

module.exports = router; 