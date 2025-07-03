const express = require('express');
const ProjectPaymaster = require('../models/ProjectPaymaster');
const PaymasterBalance = require('../models/PaymasterBalance');
const PaymasterPayment = require('../models/PaymasterPayment');
const Project = require('../models/Project');
const AuthMiddleware = require('../middleware/auth');
const WalletGenerator = require('../services/walletGenerator');
const BalanceService = require('../services/balanceService');
const PaymasterService = require('../services/paymasterService');

const router = express.Router();

/**
 * @route GET /projects/:projectId/paymaster/balance
 * @desc Get paymaster balances for a project
 * @access Private
 */
router.get('/:projectId/paymaster/balance', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Get current balances
    const balanceData = await BalanceService.getProjectBalances(projectId);

    res.json({
      success: true,
      data: balanceData
    });

  } catch (error) {
    console.error('Paymaster balance fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BALANCE_FETCH_FAILED',
        message: 'Failed to fetch paymaster balances'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/paymaster/refresh-balance
 * @desc Refresh paymaster balances for a project
 * @access Private
 */
router.post('/:projectId/paymaster/refresh-balance', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Update all balances for this project
    await BalanceService.updateAllProjectBalances(projectId);

    // Get updated balances
    const balanceData = await BalanceService.getProjectBalances(projectId);

    res.json({
      success: true,
      message: 'Balances refreshed successfully',
      data: balanceData
    });

  } catch (error) {
    console.error('Balance refresh error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BALANCE_REFRESH_FAILED',
        message: 'Failed to refresh balances'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/paymaster/addresses
 * @desc Get paymaster funding addresses and QR codes
 * @access Private
 */
router.get('/:projectId/paymaster/addresses', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Get all paymasters for this project
    const paymasters = await ProjectPaymaster.findByProject(projectId);

    const addresses = {};
    const qrCodes = {};

    for (const paymaster of paymasters) {
      // Map each supported chain to the shared paymaster address
      for (const chain of paymaster.supported_chains) {
        addresses[chain] = paymaster.address;
        qrCodes[chain] = WalletGenerator.generateQRCodeData(paymaster.address, chain);
      }
    }

    res.json({
      success: true,
      data: {
        addresses,
        qr_codes: qrCodes,
        funding_instructions: {
          ethereum: 'Send ETH to this address to fund your Ethereum paymaster',
          arbitrum: 'Send ETH to this address to fund your Arbitrum paymaster',
          solana: 'Send SOL to this address to fund your Solana paymaster'
        }
      }
    });

  } catch (error) {
    console.error('Paymaster addresses fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ADDRESSES_FETCH_FAILED',
        message: 'Failed to fetch paymaster addresses'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/paymaster/transactions
 * @desc Get paymaster spending history
 * @access Private
 */
router.get('/:projectId/paymaster/transactions', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 50, offset = 0, chain } = req.query;
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

    // Build query
    const query = { project_id: projectId };
    if (chain) {
      query.chain = chain;
    }

    // Get transactions
    const transactions = await PaymasterPayment.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Get total count for pagination
    const totalCount = await PaymasterPayment.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions: transactions.map(tx => tx.toJSON()),
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: totalCount > parseInt(offset) + parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Paymaster transactions fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTIONS_FETCH_FAILED',
        message: 'Failed to fetch paymaster transactions'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/paymaster/analytics
 * @desc Get paymaster spending analytics
 * @access Private
 */
router.get('/:projectId/paymaster/analytics', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { days = 30 } = req.query;
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

    // Get spending summary
    const spendingSummary = await PaymasterPayment.getSpendingSummary(projectId, parseInt(days));
    
    // Get daily spending for charts
    const dailySpending = await PaymasterPayment.getDailySpending(projectId, parseInt(days));

    // Calculate total spending
    const totalSpending = spendingSummary.reduce((total, chain) => total + (chain.total_usd || 0), 0);
    const totalTransactions = spendingSummary.reduce((total, chain) => total + (chain.transaction_count || 0), 0);

    res.json({
      success: true,
      data: {
        summary: {
          total_spent_usd: totalSpending.toFixed(2),
          total_transactions: totalTransactions,
          average_cost_per_transaction: totalTransactions > 0 ? (totalSpending / totalTransactions).toFixed(4) : '0.0000',
          period_days: parseInt(days)
        },
        by_chain: spendingSummary,
        daily_spending: dailySpending
      }
    });

  } catch (error) {
    console.error('Paymaster analytics fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_FETCH_FAILED',
        message: 'Failed to fetch paymaster analytics'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/paymaster/status
 * @desc Get paymaster status and health
 * @access Private
 */
router.get('/:projectId/paymaster/status', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Get all paymasters for this project
    const paymasters = await ProjectPaymaster.findByProject(projectId);
    const balances = await PaymasterBalance.findByProject(projectId);

    // Check for low balances
    const lowBalances = balances.filter(balance => balance.isLowBalance());

    // Get recent transaction activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransactions = await PaymasterPayment.countDocuments({
      project_id: projectId,
      createdAt: { $gte: oneDayAgo }
    });

    // Count deployment statuses
    const deployedCount = paymasters.filter(p => p.deployment_status === 'deployed').length;
    const pendingCount = paymasters.filter(p => p.deployment_status === 'pending').length;
    const failedCount = paymasters.filter(p => p.deployment_status === 'failed').length;

    const status = {
      paymasters_total: paymasters.length,
      paymasters_deployed: deployedCount,
      paymasters_pending: pendingCount,
      paymasters_failed: failedCount,
      chains_supported: paymasters.map(p => p.chain),
      low_balance_alerts: lowBalances.length,
      recent_transactions_24h: recentTransactions,
      health_status: failedCount > 0 ? 'error' : (lowBalances.length === 0 ? 'healthy' : 'warning'),
      last_activity: balances.length > 0 ? Math.max(...balances.map(b => new Date(b.last_updated).getTime())) : null,
      contract_addresses: paymasters.reduce((acc, p) => {
        if (p.contract_address) {
          acc[p.chain] = p.contract_address;
        }
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: {
        status,
        low_balance_chains: lowBalances.map(b => ({
          chain: b.chain,
          balance_usd: parseFloat(b.balance_usd || 0).toFixed(2),
          address: b.address
        })),
        deployment_details: paymasters.map(p => ({
          chain: p.chain,
          status: p.deployment_status,
          contract_address: p.contract_address,
          deployment_tx: p.deployment_tx,
          funding_address: p.address
        }))
      }
    });

  } catch (error) {
    console.error('Paymaster status fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FETCH_FAILED',
        message: 'Failed to fetch paymaster status'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/paymaster/retry-deployment
 * @desc Retry failed paymaster deployments
 * @access Private
 */
router.post('/:projectId/paymaster/retry-deployment', AuthMiddleware.authenticateToken, async (req, res) => {
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

    const results = await PaymasterService.retryFailedDeployments(projectId);

    res.json({
      success: true,
      message: 'Retry deployment completed',
      data: {
        results,
        summary: {
          total_attempted: results.length,
          successful: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      }
    });

  } catch (error) {
    console.error('Retry deployment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETRY_DEPLOYMENT_FAILED',
        message: 'Failed to retry deployments'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/paymaster/fund
 * @desc Fund a paymaster contract
 * @access Private
 */
router.post('/:projectId/paymaster/fund', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { chain, amount } = req.body;
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

    if (!chain || !amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Chain and amount are required'
        }
      });
    }

    // Get paymaster for this chain
    const paymaster = await ProjectPaymaster.findByProjectAndChain(projectId, chain);
    if (!paymaster || paymaster.deployment_status !== 'deployed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PAYMASTER_NOT_DEPLOYED',
          message: 'Paymaster contract not deployed for this chain'
        }
      });
    }

    // For now, return funding instructions
    // In a full implementation, you'd integrate with a payment processor
    res.json({
      success: true,
      message: 'Funding instructions generated',
      data: {
        chain,
        amount,
        contract_address: paymaster.contract_address,
        funding_address: paymaster.address,
        instructions: `Send ${amount} ${chain === 'solana' ? 'SOL' : 'ETH'} to ${paymaster.address} to fund the paymaster`,
        note: 'Automated funding via payment processors will be available soon'
      }
    });

  } catch (error) {
    console.error('Fund paymaster error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FUND_PAYMASTER_FAILED',
        message: 'Failed to initiate paymaster funding'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/paymaster/deploy
 * @desc Retry paymaster deployment after funding
 * @access Private
 */
router.post('/:projectId/paymaster/deploy', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Find paymasters that need deployment
    const paymasters = await ProjectPaymaster.find({ 
      project_id: projectId, 
      deployment_status: 'pending_funding' 
    });

    if (paymasters.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_PENDING_PAYMASTERS',
          message: 'No paymasters are waiting for funding. All are either deployed or failed.'
        }
      });
    }

    console.log(`🔄 Retrying deployment for ${paymasters.length} paymasters in project ${projectId}`);

    const results = [];
    for (const paymaster of paymasters) {
      try {
        console.log(`🔄 Retrying ${paymaster.chain_category.toUpperCase()} paymaster deployment...`);
        
        // Get wallet private key for deployment
        const privateKey = paymaster.decryptPrivateKey();
        
        // Attempt deployment again
        await PaymasterService.deploySharedPaymasterContract(paymaster, privateKey);
        
        results.push({
          category: paymaster.chain_category,
          status: 'deployed',
          address: paymaster.address,
          supported_chains: paymaster.supported_chains
        });
        
      } catch (error) {
        console.log(`⏳ ${paymaster.chain_category.toUpperCase()} paymaster still waiting for funding:`, error.message);
        
        results.push({
          category: paymaster.chain_category,
          status: 'pending_funding',
          address: paymaster.address,
          supported_chains: paymaster.supported_chains,
          error: error.message,
          funding_required: paymaster.chain_category === 'evm' ? '0.002 ETH' : '0.01 SOL'
        });
      }
    }

    const deployedCount = results.filter(r => r.status === 'deployed').length;
    const stillPendingCount = results.filter(r => r.status === 'pending_funding').length;

    res.json({
      success: true,
      message: `Deployment retry completed. ${deployedCount} deployed, ${stillPendingCount} still need funding.`,
      data: {
        results,
        deployed: deployedCount,
        pending_funding: stillPendingCount,
        total: results.length
      }
    });

  } catch (error) {
    console.error('Retry deployment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETRY_DEPLOYMENT_FAILED',
        message: 'Failed to retry paymaster deployment'
      }
    });
  }
});

module.exports = router; 