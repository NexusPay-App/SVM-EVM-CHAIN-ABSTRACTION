const cron = require('node-cron');
const PaymasterBalance = require('../models/PaymasterBalance');
const BalanceService = require('./balanceService');
const emailService = require('./emailService');

class PaymasterMonitor {
  constructor() {
    this.isRunning = false;
    this.LOW_BALANCE_THRESHOLD_USD = 10;
    this.CRITICAL_BALANCE_THRESHOLD_USD = 2;
  }

  /**
   * Start background monitoring jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Paymaster monitor already running');
      return;
    }

    console.log('🔄 Starting paymaster monitoring services...');

    // Update all balances every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.updateAllBalances();
    });

    // Check for low balances every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      await this.checkLowBalances();
    });

    // Health check every hour
    cron.schedule('0 * * * *', async () => {
      await this.performHealthCheck();
    });

    this.isRunning = true;
    console.log('✅ Paymaster monitoring started');
  }

  /**
   * Stop monitoring services
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 Paymaster monitoring stopped');
  }

  /**
   * Update all project balances
   */
  async updateAllBalances() {
    try {
      console.log('🔄 Updating all paymaster balances...');
      await BalanceService.updateAllBalances();
    } catch (error) {
      console.error('❌ Failed to update balances:', error);
    }
  }

  /**
   * Check for low balances and send alerts
   */
  async checkLowBalances() {
    try {
      const lowBalances = await PaymasterBalance.findLowBalances(this.LOW_BALANCE_THRESHOLD_USD);
      const criticalBalances = await PaymasterBalance.findLowBalances(this.CRITICAL_BALANCE_THRESHOLD_USD);

      for (const balance of criticalBalances) {
        await this.sendCriticalBalanceAlert(balance);
      }

      for (const balance of lowBalances) {
        if (!criticalBalances.find(cb => cb.id === balance.id)) {
          await this.sendLowBalanceAlert(balance);
        }
      }

      if (lowBalances.length > 0) {
        console.log(`⚠️ Found ${lowBalances.length} low balance paymasters`);
      }

    } catch (error) {
      console.error('❌ Failed to check low balances:', error);
    }
  }

  /**
   * Perform health check on all paymasters
   */
  async performHealthCheck() {
    try {
      console.log('🔍 Performing paymaster health check...');
      
      // Count deployment statuses
      const projectPaymasters = await require('../models/ProjectPaymaster').find({});
      const deployed = projectPaymasters.filter(p => p.deployment_status === 'deployed').length;
      const failed = projectPaymasters.filter(p => p.deployment_status === 'failed').length;
      const pending = projectPaymasters.filter(p => p.deployment_status === 'pending').length;

      console.log(`📊 Paymaster Health Summary:`);
      console.log(`   ✅ Deployed: ${deployed}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`   ⏳ Pending: ${pending}`);

      // Alert if too many failures
      if (failed > 0) {
        console.log(`⚠️ WARNING: ${failed} failed paymaster deployments detected`);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * Send low balance alert
   */
  async sendLowBalanceAlert(balance) {
    try {
      const alertData = {
        projectId: balance.project_id,
        chain: balance.chain,
        address: balance.address,
        balanceNative: balance.balance_native,
        balanceUsd: balance.balance_usd,
        severity: 'low'
      };

      console.log(`⚠️ LOW BALANCE ALERT: ${balance.chain} paymaster for project ${balance.project_id} has $${balance.balance_usd}`);
      
      // Here you could integrate with email/Slack/Discord notifications
      // await emailService.sendLowBalanceAlert(alertData);

    } catch (error) {
      console.error('Failed to send low balance alert:', error);
    }
  }

  /**
   * Send critical balance alert
   */
  async sendCriticalBalanceAlert(balance) {
    try {
      const alertData = {
        projectId: balance.project_id,
        chain: balance.chain,
        address: balance.address,
        balanceNative: balance.balance_native,
        balanceUsd: balance.balance_usd,
        severity: 'critical'
      };

      console.log(`🚨 CRITICAL BALANCE ALERT: ${balance.chain} paymaster for project ${balance.project_id} has only $${balance.balance_usd}!`);
      
      // Critical alerts could trigger immediate notifications
      // await emailService.sendCriticalBalanceAlert(alertData);

    } catch (error) {
      console.error('Failed to send critical balance alert:', error);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      running: this.isRunning,
      thresholds: {
        low_balance_usd: this.LOW_BALANCE_THRESHOLD_USD,
        critical_balance_usd: this.CRITICAL_BALANCE_THRESHOLD_USD
      }
    };
  }
}

module.exports = new PaymasterMonitor(); 