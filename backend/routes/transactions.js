const express = require('express');
const ProjectAuthMiddleware = require('../middleware/project-auth');
const TransactionService = require('../services/transactionService');

const router = express.Router();

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