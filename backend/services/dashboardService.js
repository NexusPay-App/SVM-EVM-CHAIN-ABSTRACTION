const Project = require('../models/Project');
const ProjectAPIKey = require('../models/ProjectAPIKey');
const ProjectPaymaster = require('../models/ProjectPaymaster');
const PaymasterBalance = require('../models/PaymasterBalance');
const ProjectTransactionLog = require('../models/ProjectTransactionLog');
const ProjectUserActivity = require('../models/ProjectUserActivity');

class DashboardService {
  
  /**
   * Get complete dashboard data for a user in a SINGLE ultra-fast aggregation query
   */
  static async getDashboardData(userId, options = {}) {
    try {
      const startTime = Date.now();
      
      // Get user projects with minimal fields for speed
      const projects = await Project.find({ owner_id: userId })
        .select('id name description chains createdAt website')
        .sort({ createdAt: -1 })
        .lean(); // Use lean() for faster queries
      
      if (projects.length === 0) {
        return {
          user: { id: userId, stats: { total_projects: 0, total_api_keys: 0, active_paymasters: 0, total_balance: 0, total_balance_usd: 0 } },
          projects: [],
          analytics: { transactions: 0, volume: 0, success_rate: 0 },
          performance: { query_time_ms: Date.now() - startTime, cached: false, optimized: true }
        };
      }

      const projectIds = projects.map(p => p.id);
      
      // Ultra-fast aggregation to get ALL data in 3 parallel queries instead of many
      const [apiKeysResult, balancesResult, statsResult] = await Promise.all([
        // Single aggregation for all API keys
        ProjectAPIKey.aggregate([
          { $match: { project_id: { $in: projectIds }, status: 'active' } },
          {
            $group: {
              _id: '$project_id',
              keys: {
                $push: {
                  id: '$keyId',
                  name: '$name',
                  key_preview: '$keyPreview',
                  type: '$keyType',
                  permissions: '$permissions',
                  created_at: '$createdAt',
                  last_used_at: '$lastUsedAt',
                  usage_count: '$usageCount'
                }
              },
              count: { $sum: 1 }
            }
          }
        ]),
        
        // Single aggregation for all balances
        PaymasterBalance.aggregate([
          { $match: { project_id: { $in: projectIds } } },
          {
            $group: {
              _id: '$project_id',
              balances: {
                $push: {
                  chain: '$chain',
                  address: '$address',
                  balance: '$balance',
                  symbol: '$symbol',
                  balance_usd: '$balance_usd',
                  status: '$status',
                  last_updated: '$last_updated'
                }
              },
              total_usd: { $sum: '$balance_usd' }
            }
          }
        ]),
        
        // Get overall stats in one query
        ProjectTransactionLog.aggregate([
          { $match: { project_id: { $in: projectIds } } },
          {
            $group: {
              _id: null,
              total_transactions: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
              total_volume: { $sum: '$amount' }
            }
          }
        ])
      ]);

      const duration = Date.now() - startTime;
      
      // Process results into lookup objects for O(1) access
      const apiKeysByProject = {};
      let totalApiKeys = 0;
      apiKeysResult.forEach(item => {
        apiKeysByProject[item._id] = item.keys;
        totalApiKeys += item.count;
      });

      const balancesByProject = {};
      let totalBalanceUSD = 0;
      balancesResult.forEach(item => {
        balancesByProject[item._id] = item.balances;
        totalBalanceUSD += item.total_usd || 0;
      });

      const stats = statsResult[0] || { total_transactions: 0, successful: 0, total_volume: 0 };
      
      // Structure the response for optimal frontend consumption
      const dashboardData = {
        user: {
          id: userId,
          stats: {
            total_projects: projects.length,
            total_api_keys: totalApiKeys,
            active_paymasters: balancesResult.length, // Quick count from balances
            total_balance: totalBalanceUSD,
            total_balance_usd: totalBalanceUSD
          }
        },
        projects: projects.map(project => ({
          ...project,
          api_keys: apiKeysByProject[project.id] || [],
          api_keys_count: apiKeysByProject[project.id]?.length || 0,
          balances: balancesByProject[project.id] || [],
          total_balance: balancesByProject[project.id]?.reduce((sum, b) => sum + (b.balance_usd || 0), 0) || 0
        })),
        analytics: {
          transactions: stats.total_transactions,
          volume: stats.total_volume,
          success_rate: stats.total_transactions > 0 ? (stats.successful / stats.total_transactions) * 100 : 0
        },
        performance: {
          query_time_ms: duration,
          cached: false,
          optimized: true,
          queries_used: 4 // Much fewer than before
        }
      };

      console.log(`⚡ Ultra-fast dashboard loaded in ${duration}ms (${projectIds.length} projects, ${totalApiKeys} API keys)`);
      return dashboardData;
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      throw error;
    }
  }

  /**
   * Get all API keys for user's projects
   */
  static async getUserAPIKeys(userId) {
    try {
      // Get all user projects first
      const projects = await Project.find({ owner_id: userId }).select('id');
      const projectIds = projects.map(p => p.id);
      
      if (projectIds.length === 0) {
        return { totalCount: 0, byProject: {} };
      }

      // Get all API keys for these projects
      const apiKeys = await ProjectAPIKey.find({
        project_id: { $in: projectIds },
        status: 'active'
      }).lean();

      const byProject = {};
      let totalCount = 0;

      apiKeys.forEach(key => {
        if (!byProject[key.project_id]) {
          byProject[key.project_id] = [];
        }
        byProject[key.project_id].push({
          id: key.keyId,
          project_id: key.project_id,
          name: key.name,
          key_preview: key.keyPreview,
          type: key.keyType,
          permissions: key.permissions || ['wallets:create', 'wallets:deploy', 'wallets:read'],
          created_at: key.createdAt,
          last_used_at: key.lastUsedAt,
          usage_count: key.usageCount || 0,
          status: key.status
        });
        totalCount++;
      });

      return { totalCount, byProject };
    } catch (error) {
      console.error('API keys fetch error:', error);
      return { totalCount: 0, byProject: {} };
    }
  }

  /**
   * Get all paymaster data for user's projects
   */
  static async getUserPaymasters(userId) {
    try {
      const projects = await Project.find({ owner_id: userId }).select('id');
      const projectIds = projects.map(p => p.id);
      
      if (projectIds.length === 0) {
        return { totalActive: 0, byProject: {} };
      }

      const paymasters = await ProjectPaymaster.find({
        project_id: { $in: projectIds },
        status: { $in: ['active', 'deployed', 'deploying'] }
      }).lean();

      const byProject = {};
      let totalActive = 0;

      paymasters.forEach(paymaster => {
        if (!byProject[paymaster.project_id]) {
          byProject[paymaster.project_id] = [];
        }
        byProject[paymaster.project_id].push({
          id: paymaster._id,
          project_id: paymaster.project_id,
          chain: paymaster.chain,
          address: paymaster.address,
          status: paymaster.status,
          deployment_tx: paymaster.deployment_tx,
          created_at: paymaster.createdAt
        });
        if (paymaster.status === 'active' || paymaster.status === 'deployed') {
          totalActive++;
        }
      });

      return { totalActive, byProject };
    } catch (error) {
      console.error('Paymasters fetch error:', error);
      return { totalActive: 0, byProject: {} };
    }
  }

  /**
   * Get all balance data for user's projects
   */
  static async getUserBalances(userId) {
    try {
      const projects = await Project.find({ owner_id: userId }).select('id');
      const projectIds = projects.map(p => p.id);
      
      if (projectIds.length === 0) {
        return { totalBalance: 0, totalBalanceUSD: 0, byProject: {}, projectTotals: {} };
      }

      const balances = await PaymasterBalance.find({
        project_id: { $in: projectIds }
      }).lean();

      const byProject = {};
      const projectTotals = {};
      let totalBalance = 0;
      let totalBalanceUSD = 0;

      balances.forEach(balance => {
        if (!byProject[balance.project_id]) {
          byProject[balance.project_id] = [];
        }
        
        const balanceData = {
          id: balance._id,
          project_id: balance.project_id,
          chain: balance.chain,
          address: balance.address,
          balance: balance.balance,
          symbol: balance.symbol,
          balance_usd: balance.balance_usd || 0,
          last_updated: balance.last_updated,
          status: balance.status
        };

        byProject[balance.project_id].push(balanceData);
        
        if (!projectTotals[balance.project_id]) {
          projectTotals[balance.project_id] = 0;
        }
        projectTotals[balance.project_id] += balance.balance_usd || 0;
        totalBalanceUSD += balance.balance_usd || 0;
      });

      return { totalBalance, totalBalanceUSD, byProject, projectTotals };
    } catch (error) {
      console.error('Balances fetch error:', error);
      return { totalBalance: 0, totalBalanceUSD: 0, byProject: {}, projectTotals: {} };
    }
  }

  /**
   * Get recent activity for user's projects
   */
  static async getRecentActivity(userId, limit = 10) {
    try {
      const projects = await Project.find({ owner_id: userId }).select('id');
      const projectIds = projects.map(p => p.id);
      
      if (projectIds.length === 0) {
        return { byProject: {} };
      }

      const activities = await ProjectUserActivity.find({
        project_id: { $in: projectIds }
      })
      .sort({ createdAt: -1 })
      .limit(limit * projectIds.length)
      .lean();

      const byProject = {};
      
      activities.forEach(activity => {
        if (!byProject[activity.project_id]) {
          byProject[activity.project_id] = [];
        }
        if (byProject[activity.project_id].length < limit) {
          byProject[activity.project_id].push({
            id: activity._id,
            project_id: activity.project_id,
            action: activity.action,
            details: activity.details,
            created_at: activity.createdAt
          });
        }
      });

      return { byProject };
    } catch (error) {
      console.error('Recent activity fetch error:', error);
      return { byProject: {} };
    }
  }

  /**
   * Get analytics summary for user
   */
  static async getAnalyticsSummary(userId) {
    try {
      const projects = await Project.find({ owner_id: userId }).select('id');
      const projectIds = projects.map(p => p.id);
      
      if (projectIds.length === 0) {
        return { transactions: 0, volume: 0, success_rate: 0 };
      }

      const [transactionStats] = await Promise.all([
        ProjectTransactionLog.aggregate([
          { $match: { project_id: { $in: projectIds } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              successful: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] } },
              total_amount: { $sum: '$amount' }
            }
          }
        ])
      ]);

      const stats = transactionStats[0] || { total: 0, successful: 0, total_amount: 0 };
      
      return {
        transactions: stats.total,
        volume: stats.total_amount,
        success_rate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0
      };
    } catch (error) {
      console.error('Analytics summary fetch error:', error);
      return { transactions: 0, volume: 0, success_rate: 0 };
    }
  }

  /**
   * Get project details with all associated data
   */
  static async getProjectDetails(projectId, userId) {
    try {
      const project = await Project.findOne({ id: projectId, owner_id: userId });
      
      if (!project) {
        return null;
      }

      const [apiKeys, paymasters, balances, recentActivity] = await Promise.all([
        ProjectAPIKey.find({ project_id: projectId, status: 'active' }).lean(),
        ProjectPaymaster.find({ project_id: projectId }).lean(),
        PaymasterBalance.find({ project_id: projectId }).lean(),
        ProjectUserActivity.find({ project_id: projectId }).sort({ createdAt: -1 }).limit(10).lean()
      ]);

      return {
        ...project.toJSON(),
        api_keys: apiKeys.map(key => ({
          id: key.keyId,
          name: key.name,
          key_preview: key.keyPreview,
          type: key.keyType,
          permissions: key.permissions || [],
          created_at: key.createdAt,
          last_used_at: key.lastUsedAt,
          usage_count: key.usageCount || 0
        })),
        paymasters: paymasters.map(pm => ({
          id: pm._id,
          chain: pm.chain,
          address: pm.address,
          status: pm.status,
          deployment_tx: pm.deployment_tx,
          created_at: pm.createdAt
        })),
        balances: balances.map(balance => ({
          chain: balance.chain,
          address: balance.address,
          balance: balance.balance,
          symbol: balance.symbol,
          balance_usd: balance.balance_usd || 0,
          last_updated: balance.last_updated,
          status: balance.status
        })),
        recent_activity: recentActivity.map(activity => ({
          id: activity._id,
          action: activity.action,
          details: activity.details,
          created_at: activity.createdAt
        }))
      };
    } catch (error) {
      console.error('Project details fetch error:', error);
      throw error;
    }
  }
}

module.exports = DashboardService; 