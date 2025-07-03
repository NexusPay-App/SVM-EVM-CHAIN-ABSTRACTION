const express = require('express');
const Project = require('../models/Project');
const AuthMiddleware = require('../middleware/auth');
const AnalyticsService = require('../services/analyticsService');

const router = express.Router();

/**
 * @route GET /projects/:projectId/analytics/overview
 * @desc Get comprehensive project analytics overview
 * @access Private
 */
router.get('/:projectId/analytics/overview', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Get comprehensive analytics overview
    const analytics = await AnalyticsService.getProjectOverview(projectId, parseInt(days));

    res.json({
      success: true,
      data: {
        project_id: projectId,
        project_name: project.name,
        analytics: analytics,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_OVERVIEW_FAILED',
        message: 'Failed to fetch analytics overview'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/analytics/transactions
 * @desc Get detailed transaction history with filtering and pagination
 * @access Private
 */
router.get('/:projectId/analytics/transactions', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 50,
      chain,
      type: transactionType,
      status = 'confirmed',
      user_id: userIdentifier,
      start_date: startDate,
      end_date: endDate
    } = req.query;
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

    // Get transaction history with filters
    const transactionHistory = await AnalyticsService.getTransactionHistory(projectId, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 per page
      chain,
      transactionType,
      status,
      userIdentifier,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: {
        project_id: projectId,
        ...transactionHistory
      }
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTION_HISTORY_FAILED',
        message: 'Failed to fetch transaction history'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/analytics/users
 * @desc Get user behavior analytics and engagement metrics
 * @access Private
 */
router.get('/:projectId/analytics/users', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      days = 30,
      limit = 100,
      sort_by: sortBy = 'transactions_sent'
    } = req.query;
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

    // Validate sort_by parameter
    const validSortOptions = ['transactions_sent', 'total_gas_spent_usd', 'engagement_score', 'wallets_created'];
    const sortOption = validSortOptions.includes(sortBy) ? sortBy : 'transactions_sent';

    // Get user analytics
    const userAnalytics = await AnalyticsService.getUserAnalytics(projectId, {
      days: parseInt(days),
      limit: Math.min(parseInt(limit), 500), // Max 500 users
      sortBy: sortOption
    });

    res.json({
      success: true,
      data: {
        project_id: projectId,
        project_name: project.name,
        ...userAnalytics
      }
    });

  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_ANALYTICS_FAILED',
        message: 'Failed to fetch user analytics'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/analytics/costs
 * @desc Get cost breakdown, forecasting, and spending analytics
 * @access Private
 */
router.get('/:projectId/analytics/costs', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { period = 30 } = req.query;
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

    // Get cost analytics with forecasting
    const costAnalytics = await AnalyticsService.getCostAnalytics(projectId, parseInt(period));

    res.json({
      success: true,
      data: {
        project_id: projectId,
        project_name: project.name,
        ...costAnalytics
      }
    });

  } catch (error) {
    console.error('Cost analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'COST_ANALYTICS_FAILED',
        message: 'Failed to fetch cost analytics'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/analytics/export
 * @desc Export analytics data in CSV or JSON format
 * @access Private
 */
router.get('/:projectId/analytics/export', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      format = 'csv',
      type = 'transactions',
      period = 'billing_cycle',
      start_date: startDate,
      end_date: endDate
    } = req.query;
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

    // Validate parameters
    const validFormats = ['csv', 'json'];
    const validTypes = ['transactions', 'users', 'costs'];
    
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `Invalid format. Supported formats: ${validFormats.join(', ')}`
        }
      });
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: `Invalid export type. Supported types: ${validTypes.join(', ')}`
        }
      });
    }

    // Generate export
    const exportData = await AnalyticsService.exportAnalytics(projectId, {
      format,
      type,
      period,
      startDate,
      endDate
    });

    // Set appropriate headers for download
    res.setHeader('Content-Type', exportData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the file content
    res.send(exportData.data);

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_FAILED',
        message: 'Failed to export analytics data'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/analytics/live
 * @desc Get real-time analytics metrics (Server-Sent Events)
 * @access Private
 */
router.get('/:projectId/analytics/live', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial data
    const sendUpdate = async () => {
      try {
        const liveMetrics = await AnalyticsService.getProjectOverview(projectId, 1); // Last 24 hours
        
        const data = {
          project_id: projectId,
          timestamp: new Date().toISOString(),
          metrics: {
            transactions_24h: liveMetrics.overview.total_transactions,
            gas_spent_24h_usd: liveMetrics.overview.total_gas_spent_usd,
            active_users_24h: liveMetrics.overview.active_users_7d, // Approximation
            paymaster_coverage: liveMetrics.overview.paymaster_coverage_pct
          }
        };

        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error('Live metrics error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to fetch metrics' })}\n\n`);
      }
    };

    // Send initial update
    await sendUpdate();

    // Set up periodic updates every 30 seconds
    const interval = setInterval(sendUpdate, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });

    req.on('end', () => {
      clearInterval(interval);
    });

  } catch (error) {
    console.error('Live analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIVE_ANALYTICS_FAILED',
        message: 'Failed to setup live analytics stream'
      }
    });
  }
});

/**
 * @route POST /projects/:projectId/analytics/track
 * @desc Manually record a transaction for analytics (internal use)
 * @access Private
 */
router.post('/:projectId/analytics/track', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const transactionData = req.body;
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

    // Validate required fields
    const requiredFields = ['transactionType', 'chain', 'walletAddress', 'userIdentifier', 'socialType'];
    const missingFields = requiredFields.filter(field => !transactionData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: `Missing required fields: ${missingFields.join(', ')}`
        }
      });
    }

    // Record the transaction
    const recordedTransaction = await AnalyticsService.recordTransaction({
      ...transactionData,
      projectId
    });

    res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully',
      data: {
        transaction_id: recordedTransaction.id,
        project_id: projectId,
        recorded_at: recordedTransaction.createdAt
      }
    });

  } catch (error) {
    console.error('Manual track error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRACK_FAILED',
        message: 'Failed to record transaction'
      }
    });
  }
});

/**
 * @route GET /projects/:projectId/analytics/summary
 * @desc Get quick analytics summary for dashboard widgets
 * @access Private
 */
router.get('/:projectId/analytics/summary', AuthMiddleware.authenticateToken, async (req, res) => {
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

    // Get quick summary metrics
    const [overview7d, overview30d] = await Promise.all([
      AnalyticsService.getProjectOverview(projectId, 7),
      AnalyticsService.getProjectOverview(projectId, 30)
    ]);

    const summary = {
      quick_stats: {
        transactions_7d: overview7d.overview.total_transactions,
        transactions_30d: overview30d.overview.total_transactions,
        gas_spent_7d_usd: overview7d.overview.total_gas_spent_usd,
        gas_spent_30d_usd: overview30d.overview.total_gas_spent_usd,
        active_users_7d: overview7d.overview.active_users_7d,
        active_users_30d: overview30d.overview.active_users_30d,
        paymaster_coverage_7d: overview7d.overview.paymaster_coverage_pct,
        paymaster_coverage_30d: overview30d.overview.paymaster_coverage_pct
      },
      trends: {
        transactions_growth: this.calculateGrowth(overview7d.overview.total_transactions, overview30d.overview.total_transactions),
        gas_spending_growth: this.calculateGrowth(overview7d.overview.total_gas_spent_usd, overview30d.overview.total_gas_spent_usd),
        user_growth: this.calculateGrowth(overview7d.overview.active_users_7d, overview30d.overview.active_users_30d)
      },
      top_chains: Object.entries(overview30d.chains || {})
        .sort(([,a], [,b]) => b.transactions - a.transactions)
        .slice(0, 3)
        .map(([chain, data]) => ({ chain, transactions: data.transactions }))
    };

    res.json({
      success: true,
      data: {
        project_id: projectId,
        ...summary,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUMMARY_FAILED',
        message: 'Failed to fetch analytics summary'
      }
    });
  }
});

// Helper function for growth calculation
router.calculateGrowth = function(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat(((current - previous) / previous * 100).toFixed(2));
};

module.exports = router; 