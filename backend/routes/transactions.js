const express = require('express');
const ProjectAuthMiddleware = require('../middleware/project-auth');
const TransactionService = require('../services/transactionService');
const RealTransactionSender = require('../real-transaction-sender');

const router = express.Router();

/**
 * @route POST /api/transactions/send
 * @desc Send gasless transaction using project paymaster
 * @access Private (requires project API key)
 */
router.post('/send', 
  ProjectAuthMiddleware.validateProjectAPIKey,
  ProjectAuthMiddleware.requirePermission('transactions:send'),
  async (req, res) => {
    try {
      const { socialId, socialType, chain, to, value, gasless = true } = req.body;

      // Validate required parameters
      if (!socialId || !socialType || !chain || !to || !value) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'socialId, socialType, chain, to, and value are required',
            suggestions: [
              'Include all required parameters in your request',
              'Check the API documentation for parameter formats'
            ]
          }
        });
      }

      console.log(`🚀 Processing ${gasless ? 'gasless' : 'regular'} transaction:`, {
        socialId,
        socialType,
        chain,
        to,
        value,
        project: req.project.name
      });

      // Initialize real transaction sender
      const realSender = new RealTransactionSender();

      // Convert value to appropriate format
      let amount;
      let asset;
      
      if (chain === 'solana') {
        // Convert lamports to SOL
        amount = (parseFloat(value) / Math.pow(10, 9)).toString();
        asset = 'SOL';
      } else {
        // Convert wei to ETH
        amount = (parseFloat(value) / Math.pow(10, 18)).toString();
        asset = 'ETH';
      }

      // Send the transaction
      const result = await realSender.sendRealTransaction(
        socialId,
        socialType,
        chain,
        to,
        amount,
        asset
      );

      if (result.success) {
        console.log(`✅ Transaction sent successfully:`, result.hash);
        
        // Record analytics if available
        try {
          const AnalyticsService = require('../services/analyticsService');
          await AnalyticsService.recordTransaction({
            projectId: req.project.id,
            transactionType: 'token_transfer',
            chain,
            walletAddress: result.from,
            userIdentifier: socialId,
            socialType,
            txHash: result.hash,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed ? parseInt(result.gasUsed) : 0,
            gasPrice: result.gasPrice || '0',
            gasCost: result.gasCost || '0',
            gasCostUsd: 0, // Would calculate from price API
            currency: asset,
            paymasterPaid: gasless,
            status: result.status,
            confirmedAt: new Date()
          });
        } catch (analyticsError) {
          console.warn('Analytics recording failed:', analyticsError);
        }

        res.json({
          success: true,
          message: 'Transaction sent successfully',
          data: {
            txHash: result.hash,
            from: result.from,
            to: result.to,
            amount: result.amount,
            asset: result.asset,
            chain: result.chain,
            network: result.network,
            status: result.status,
            explorerUrl: result.explorerUrl,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed,
            gasPrice: result.gasPrice,
            timestamp: result.timestamp
          }
        });
      } else {
        console.error(`❌ Transaction failed:`, result.error);
        
        res.status(500).json({
          success: false,
          error: {
            code: 'TRANSACTION_FAILED',
            message: result.error || 'Transaction failed',
            suggestions: [
              'Check if the sender wallet has sufficient balance',
              'Verify the recipient address is valid',
              'Ensure the network is available',
              'Try again in a few moments'
            ]
          }
        });
      }

    } catch (error) {
      console.error('Transaction send error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TRANSACTION_SEND_ERROR',
          message: 'Failed to send transaction',
          details: error.message,
          suggestions: [
            'Check your parameters',
            'Verify the wallet has sufficient balance',
            'Try again in a few moments'
          ]
        }
      });
    }
  }
);

/**
 * @route POST /projects/:projectId/transactions/execute
 * @desc Execute transaction with optional paymaster sponsorship
 * @access Private (requires project API key)
 */
router.post('/:projectId/transactions/execute', 
  ProjectAuthMiddleware.validateProjectAPIKey,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { 
        chain, 
        userWalletAddress, 
        transaction, 
        usePaymaster = false 
      } = req.body;

      // Validate required parameters
      if (!chain || !userWalletAddress || !transaction) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'chain, userWalletAddress, and transaction are required'
          }
        });
      }

      // Execute transaction through TransactionService
      const result = await TransactionService.executeTransaction({
        projectId,
        chain,
        userWalletAddress,
        transaction,
        usePaymaster,
        apiKey: req.apiKey.key
      });

      res.json({
        success: true,
        message: usePaymaster ? 'Transaction executed with paymaster' : 'Transaction prepared for user execution',
        data: {
          projectId,
          chain,
          usePaymaster,
          result
        }
      });

    } catch (error) {
      console.error('Transaction execution error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TRANSACTION_EXECUTION_FAILED',
          message: error.message || 'Failed to execute transaction'
        }
      });
    }
  }
);

/**
 * @route GET /projects/:projectId/transactions/paymaster-status
 * @desc Get paymaster capabilities for project
 * @access Private (requires project API key)
 */
router.get('/:projectId/transactions/paymaster-status',
  ProjectAuthMiddleware.validateProjectAPIKey,
  async (req, res) => {
    try {
      const { projectId } = req.params;

      const status = await TransactionService.getProjectPaymasterStatus(projectId);

      res.json({
        success: true,
        data: {
          projectId,
          paymaster_status: status,
          can_sponsor_gas: Object.values(status).some(chain => chain.can_sponsor_transactions)
        }
      });

    } catch (error) {
      console.error('Paymaster status error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMASTER_STATUS_FAILED',
          message: 'Failed to get paymaster status'
        }
      });
    }
  }
);

/**
 * @route POST /projects/:projectId/transactions/estimate-gas
 * @desc Estimate gas cost for a transaction
 * @access Private (requires project API key)
 */
router.post('/:projectId/transactions/estimate-gas',
  ProjectAuthMiddleware.validateProjectAPIKey,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { chain, transaction } = req.body;

      if (!chain || !transaction) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'chain and transaction are required'
          }
        });
      }

      const gasEstimate = await TransactionService.estimateGas(chain, transaction);

      res.json({
        success: true,
        data: {
          projectId,
          chain,
          gasEstimate,
          note: 'If usePaymaster is true, this cost will be covered by your project paymaster'
        }
      });

    } catch (error) {
      console.error('Gas estimation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GAS_ESTIMATION_FAILED',
          message: 'Failed to estimate gas cost'
        }
      });
    }
  }
);

module.exports = router; 