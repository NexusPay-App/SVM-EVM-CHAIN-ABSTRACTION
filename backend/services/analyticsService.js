const ProjectTransactionLog = require('../models/ProjectTransactionLog');
const ProjectUserActivity = require('../models/ProjectUserActivity');
const PaymasterPayment = require('../models/PaymasterPayment');
const { Parser } = require('json2csv');

class AnalyticsService {
  /**
   * Get comprehensive project overview analytics
   * @param {string} projectId - Project ID
   * @param {number} days - Days to look back (default: 30)
   * @returns {Object} - Complete overview analytics
   */
  async getProjectOverview(projectId, days = 30) {
    try {
      // Get overview from transaction logs
      const overview = await ProjectTransactionLog.getProjectOverview(projectId, days);
      
      // Get chain breakdown
      const chainBreakdown = await ProjectTransactionLog.getChainBreakdown(projectId, days);
      
      // Get user engagement metrics
      const userEngagement = await ProjectUserActivity.getUserEngagementMetrics(projectId);
      const engagementData = userEngagement[0] || {};
      
      // Get transaction type breakdown
      const transactionTypes = await ProjectTransactionLog.getTransactionsByType(projectId, days);
      
      // Calculate additional metrics
      const avgTransactionsPerUser = overview.total_unique_users > 0 ? 
        (overview.total_transactions / overview.total_unique_users).toFixed(2) : '0';
      
      const avgGasCostPerTransaction = overview.total_transactions > 0 ? 
        (overview.total_gas_cost_usd / overview.total_transactions).toFixed(6) : '0';
      
      return {
        overview: {
          total_wallets_created: overview.total_wallets_created,
          total_transactions: overview.total_transactions,
          total_unique_users: overview.total_unique_users,
          total_gas_spent_usd: overview.total_gas_cost_usd,
          paymaster_coverage_pct: overview.paymaster_coverage_pct,
          active_users_30d: engagementData.active_users_30d || 0,
          active_users_7d: engagementData.active_users_7d || 0,
          avg_transactions_per_user: parseFloat(avgTransactionsPerUser),
          avg_gas_cost_per_transaction: parseFloat(avgGasCostPerTransaction),
          power_users: engagementData.power_users || 0,
          multi_chain_users: engagementData.multi_chain_users || 0,
          last_updated: new Date().toISOString(),
          period_days: days
        },
        chains: this.formatChainBreakdown(chainBreakdown),
        transaction_types: this.formatTransactionTypes(transactionTypes),
        user_engagement: {
          total_users: engagementData.total_users || 0,
          retention_rate_7d: engagementData.retention_rate_7d || 0,
          retention_rate_30d: engagementData.retention_rate_30d || 0,
          avg_engagement_score: engagementData.avg_engagement_score || 0
        }
      };
    } catch (error) {
      console.error('Analytics overview error:', error);
      throw new Error(`Failed to generate analytics overview: ${error.message}`);
    }
  }

  /**
   * Get detailed transaction history with pagination
   * @param {string} projectId - Project ID
   * @param {Object} options - Query options
   * @returns {Object} - Paginated transaction history
   */
  async getTransactionHistory(projectId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        chain,
        transactionType,
        status = 'confirmed',
        userIdentifier,
        startDate,
        endDate
      } = options;

      const skip = (page - 1) * limit;
      
      // Build query
      const query = { 
        project_id: projectId,
        status: status 
      };
      
      if (chain) query.chain = chain;
      if (transactionType) query.transaction_type = transactionType;
      if (userIdentifier) query.user_identifier = userIdentifier;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      // Get transactions with pagination
      const [transactions, totalCount] = await Promise.all([
        ProjectTransactionLog.find(query)
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip)
          .lean(),
        ProjectTransactionLog.countDocuments(query)
      ]);

      return {
        transactions: transactions.map(tx => ({
          id: tx.id,
          type: tx.transaction_type,
          chain: tx.chain,
          wallet_address: tx.wallet_address,
          user_id: tx.user_identifier,
          social_type: tx.social_type,
          tx_hash: tx.tx_hash,
          gas_used: tx.gas_used,
          gas_price: tx.gas_price,
          gas_cost_usd: tx.gas_cost_usd,
          paymaster_paid: tx.paymaster_paid,
          status: tx.status,
          timestamp: tx.createdAt,
          confirmed_at: tx.confirmed_at,
          transaction_details: tx.transaction_details
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          has_next: skip + transactions.length < totalCount,
          has_prev: page > 1
        }
      };
    } catch (error) {
      console.error('Transaction history error:', error);
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }
  }

  /**
   * Get user analytics and behavior patterns
   * @param {string} projectId - Project ID
   * @param {Object} options - Query options
   * @returns {Object} - User analytics data
   */
  async getUserAnalytics(projectId, options = {}) {
    try {
      const { days = 30, limit = 100, sortBy = 'transactions_sent' } = options;
      
      // Get top users by specified metric
      const topUsers = await ProjectUserActivity.getTopUsers(projectId, sortBy, limit);
      
      // Get user cohort analysis
      const cohorts = await ProjectUserActivity.getUserCohorts(projectId);
      
      // Get chain preferences
      const chainPreferences = await ProjectUserActivity.getChainPreferences(projectId);
      
      // Get recent user activity from transaction logs
      const recentActivity = await ProjectTransactionLog.getUserActivity(projectId, days);
      
      return {
        top_users: topUsers.map(user => ({
          user_id: user.user_identifier,
          social_type: user.social_type,
          wallets_created: user.wallets_created,
          transactions_sent: user.transactions_sent,
          total_gas_spent_usd: user.total_gas_spent_usd,
          chains_used: user.chains_used,
          preferred_chain: user.preferred_chain,
          engagement_score: user.engagement_score,
          first_active: user.first_active,
          last_active: user.last_active,
          paymaster_usage_pct: user.paymaster_transactions > 0 ? 
            ((user.paymaster_transactions / user.transactions_sent) * 100).toFixed(2) : 0
        })),
        cohort_analysis: cohorts,
        chain_preferences: chainPreferences,
        recent_activity: recentActivity.slice(0, 50), // Top 50 most active recent users
        summary: {
          total_analyzed_users: topUsers.length,
          analysis_period_days: days,
          sort_metric: sortBy
        }
      };
    } catch (error) {
      console.error('User analytics error:', error);
      throw new Error(`Failed to get user analytics: ${error.message}`);
    }
  }

  /**
   * Get cost analysis and forecasting
   * @param {string} projectId - Project ID
   * @param {number} days - Analysis period
   * @returns {Object} - Cost analytics and forecasts
   */
  async getCostAnalytics(projectId, days = 30) {
    try {
      // Get transaction-based costs
      const transactionCosts = await ProjectTransactionLog.getChainBreakdown(projectId, days);
      
      // Get paymaster payment data for comparison
      const paymasterSummary = await PaymasterPayment.getSpendingSummary(projectId, days);
      
      // Get daily spending trends
      const dailySpending = await ProjectTransactionLog.getDailyMetrics(projectId, days);
      
      // Calculate total costs by chain
      const costsByChain = {};
      let totalSpentUsd = 0;
      let paymasterSpentUsd = 0;
      let userPaidUsd = 0;
      
      for (const chain of transactionCosts) {
        costsByChain[chain.chain] = {
          total_transactions: chain.total_transactions,
          total_gas_cost_usd: chain.total_gas_cost_usd,
          avg_gas_cost_usd: chain.avg_gas_cost_usd,
          paymaster_coverage_pct: chain.paymaster_coverage_pct
        };
        
        totalSpentUsd += chain.total_gas_cost_usd;
        paymasterSpentUsd += (chain.total_gas_cost_usd * chain.paymaster_coverage_pct / 100);
      }
      
      userPaidUsd = totalSpentUsd - paymasterSpentUsd;
      
      // Calculate 7-day trend for forecasting
      const last7Days = dailySpending.slice(-7);
      const avg7DaySpending = last7Days.length > 0 ? 
        last7Days.reduce((sum, day) => sum + day.total_gas_cost_usd, 0) / last7Days.length : 0;
      
      // Simple linear forecast for next 30 days
      const next30DayForecast = avg7DaySpending * 30;
      const confidenceLevel = last7Days.length >= 7 ? 85 : Math.max(50, last7Days.length * 10);
      
      return {
        costs: {
          total_spent_usd: parseFloat(totalSpentUsd.toFixed(4)),
          paymaster_spent_usd: parseFloat(paymasterSpentUsd.toFixed(4)),
          user_paid_usd: parseFloat(userPaidUsd.toFixed(4)),
          paymaster_coverage_pct: totalSpentUsd > 0 ? 
            parseFloat(((paymasterSpentUsd / totalSpentUsd) * 100).toFixed(2)) : 0,
          by_chain: costsByChain,
          period_days: days
        },
        forecast: {
          next_30d_estimate_usd: parseFloat(next30DayForecast.toFixed(4)),
          based_on: `${last7Days.length}-day average`,
          confidence_pct: confidenceLevel,
          daily_avg_spending: parseFloat(avg7DaySpending.toFixed(6))
        },
        trends: {
          daily_spending: dailySpending.map(day => ({
            date: day.date,
            chain: day.chain,
            total_spent_usd: day.total_gas_cost_usd,
            transactions: day.transactions_count,
            unique_users: day.unique_users_count
          }))
        }
      };
    } catch (error) {
      console.error('Cost analytics error:', error);
      throw new Error(`Failed to get cost analytics: ${error.message}`);
    }
  }

  /**
   * Export analytics data in various formats
   * @param {string} projectId - Project ID
   * @param {Object} options - Export options
   * @returns {Object} - Export data and metadata
   */
  async exportAnalytics(projectId, options = {}) {
    try {
      const { 
        format = 'csv', 
        type = 'transactions', 
        period = 'billing_cycle',
        startDate,
        endDate 
      } = options;

      let data = [];
      let filename = '';
      
      // Determine date range
      let queryStartDate, queryEndDate;
      if (period === 'billing_cycle') {
        // Current month billing cycle
        const now = new Date();
        queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
        queryEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else {
        queryStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        queryEndDate = endDate ? new Date(endDate) : new Date();
      }

      switch (type) {
        case 'transactions':
          data = await this.getTransactionExportData(projectId, queryStartDate, queryEndDate);
          filename = `transactions_${projectId}_${this.formatDate(queryStartDate)}_to_${this.formatDate(queryEndDate)}`;
          break;
          
        case 'users':
          data = await this.getUserExportData(projectId);
          filename = `users_${projectId}_${this.formatDate(new Date())}`;
          break;
          
        case 'costs':
          data = await this.getCostExportData(projectId, queryStartDate, queryEndDate);
          filename = `costs_${projectId}_${this.formatDate(queryStartDate)}_to_${this.formatDate(queryEndDate)}`;
          break;
          
        default:
          throw new Error(`Unsupported export type: ${type}`);
      }

      if (format === 'csv') {
        const parser = new Parser();
        const csv = parser.parse(data);
        
        return {
          format: 'csv',
          filename: `${filename}.csv`,
          data: csv,
          contentType: 'text/csv',
          records: data.length,
          generated_at: new Date().toISOString()
        };
      } else if (format === 'json') {
        return {
          format: 'json',
          filename: `${filename}.json`,
          data: JSON.stringify(data, null, 2),
          contentType: 'application/json',
          records: data.length,
          generated_at: new Date().toISOString()
        };
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Export analytics error:', error);
      throw new Error(`Failed to export analytics: ${error.message}`);
    }
  }

  /**
   * Record a new transaction for analytics tracking
   * @param {Object} transactionData - Transaction data to record
   * @returns {Object} - Recorded transaction log
   */
  async recordTransaction(transactionData) {
    try {
      // Record in transaction log
      const transactionLog = await ProjectTransactionLog.recordTransaction(transactionData);
      
      // Update user activity aggregation
      await ProjectUserActivity.updateUserActivity(
        transactionData.projectId,
        transactionData.userIdentifier,
        {
          socialType: transactionData.socialType,
          transactionType: transactionData.transactionType,
          transactionSent: true,
          gasCostUsd: transactionData.gasCostUsd,
          paymasterPaid: transactionData.paymasterPaid,
          chain: transactionData.chain,
          walletAddress: transactionData.walletAddress
        }
      );
      
      console.log(`✅ Recorded transaction: ${transactionLog.id} for project ${transactionData.projectId}`);
      
      return transactionLog;
    } catch (error) {
      console.error('Record transaction error:', error);
      throw new Error(`Failed to record transaction: ${error.message}`);
    }
  }

  // Helper methods
  formatChainBreakdown(chainData) {
    const formatted = {};
    for (const chain of chainData) {
      formatted[chain.chain] = {
        wallets: chain.total_wallets,
        transactions: chain.total_transactions,
        users: chain.total_users,
        gas_spent_usd: chain.total_gas_cost_usd,
        avg_gas_cost: chain.avg_gas_cost_usd,
        paymaster_coverage_pct: chain.paymaster_coverage_pct
      };
    }
    return formatted;
  }

  formatTransactionTypes(typeData) {
    const formatted = {};
    for (const type of typeData) {
      formatted[type.transaction_type] = {
        count: type.count,
        total_gas_cost_usd: type.total_gas_cost_usd,
        avg_gas_cost_usd: type.avg_gas_cost_usd,
        paymaster_coverage_pct: type.paymaster_coverage_pct
      };
    }
    return formatted;
  }

  async getTransactionExportData(projectId, startDate, endDate) {
    const transactions = await ProjectTransactionLog.find({
      project_id: projectId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 }).lean();

    return transactions.map(tx => ({
      transaction_id: tx.id,
      date: tx.createdAt.toISOString(),
      type: tx.transaction_type,
      chain: tx.chain,
      user_id: tx.user_identifier,
      social_type: tx.social_type,
      wallet_address: tx.wallet_address,
      tx_hash: tx.tx_hash,
      gas_used: tx.gas_used,
      gas_cost_usd: tx.gas_cost_usd,
      paymaster_paid: tx.paymaster_paid ? 'Yes' : 'No',
      status: tx.status
    }));
  }

  async getUserExportData(projectId) {
    const users = await ProjectUserActivity.find({ project_id: projectId }).lean();

    return users.map(user => ({
      user_id: user.user_identifier,
      social_type: user.social_type,
      wallets_created: user.wallets_created,
      transactions_sent: user.transactions_sent,
      total_gas_spent_usd: user.total_gas_spent_usd,
      chains_used: user.chains_used.join(', '),
      first_active: user.first_active?.toISOString(),
      last_active: user.last_active?.toISOString(),
      engagement_score: user.engagement_score
    }));
  }

  async getCostExportData(projectId, startDate, endDate) {
    const costs = await ProjectTransactionLog.find({
      project_id: projectId,
      status: 'confirmed',
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 }).lean();

    return costs.map(cost => ({
      date: cost.createdAt.toISOString(),
      chain: cost.chain,
      transaction_type: cost.transaction_type,
      gas_cost_usd: cost.gas_cost_usd,
      paymaster_paid: cost.paymaster_paid ? 'Yes' : 'No',
      user_id: cost.user_identifier
    }));
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
}

module.exports = new AnalyticsService(); 