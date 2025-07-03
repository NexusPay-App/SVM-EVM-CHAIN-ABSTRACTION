const AnalyticsService = require('../services/analyticsService');
const ProjectTransactionLog = require('../models/ProjectTransactionLog');
const ProjectUserActivity = require('../models/ProjectUserActivity');

describe('Analytics Service Tests', () => {
  const testProjectId = 'proj_test_123';
  const testUserId = 'test@example.com';

  beforeEach(async () => {
    // Clean up test data before each test with increased timeout
    try {
      await Promise.all([
        ProjectTransactionLog.deleteMany({ project_id: testProjectId }),
        ProjectUserActivity.deleteMany({ project_id: testProjectId })
      ]);
    } catch (error) {
      console.warn('Database cleanup warning:', error.message);
    }
  }, 15000); // 15 second timeout

  afterAll(async () => {
    // Clean up test data after all tests
    try {
      await Promise.all([
        ProjectTransactionLog.deleteMany({ project_id: testProjectId }),
        ProjectUserActivity.deleteMany({ project_id: testProjectId })
      ]);
    } catch (error) {
      console.warn('Final cleanup warning:', error.message);
    }
  }, 15000); // 15 second timeout

  describe('Transaction Recording', () => {
    test('should record wallet creation transaction', async () => {
      const transactionData = {
        projectId: testProjectId,
        transactionType: 'wallet_creation',
        chain: 'ethereum',
        walletAddress: '0x1234567890123456789012345678901234567890',
        userIdentifier: testUserId,
        socialType: 'email',
        txHash: null,
        blockNumber: null,
        gasUsed: 0,
        gasPrice: '0',
        gasCost: '0',
        gasCostUsd: 0,
        currency: 'ETH',
        paymasterPaid: false,
        status: 'confirmed',
        confirmedAt: new Date()
      };

      const recordedTransaction = await AnalyticsService.recordTransaction(transactionData);
      
      expect(recordedTransaction).toBeDefined();
      expect(recordedTransaction.project_id).toBe(testProjectId);
      expect(recordedTransaction.transaction_type).toBe('wallet_creation');
      expect(recordedTransaction.user_identifier).toBe(testUserId);
    }, 20000); // 20 second timeout

    test('should record paymaster transaction', async () => {
      const transactionData = {
        projectId: testProjectId,
        transactionType: 'paymaster_payment',
        chain: 'ethereum',
        walletAddress: '0x1234567890123456789012345678901234567890',
        userIdentifier: testUserId,
        socialType: 'email',
        txHash: '0xabcdef1234567890',
        blockNumber: 123456,
        gasUsed: 21000,
        gasPrice: '20000000000',
        gasCost: '0.00042',
        gasCostUsd: 0.84,
        currency: 'ETH',
        paymasterPaid: true,
        paymasterAddress: '0x9876543210987654321098765432109876543210',
        status: 'confirmed',
        confirmedAt: new Date()
      };

      const recordedTransaction = await AnalyticsService.recordTransaction(transactionData);
      
      expect(recordedTransaction).toBeDefined();
      expect(recordedTransaction.paymaster_paid).toBe(true);
      expect(recordedTransaction.gas_used).toBe(21000);
      expect(recordedTransaction.gas_cost_usd).toBe(0.84);
    }, 20000); // 20 second timeout
  });

  describe('Analytics Queries', () => {
    beforeEach(async () => {
      // Create test data with timeout handling
      const transactions = [
        {
          projectId: testProjectId,
          transactionType: 'wallet_creation',
          chain: 'ethereum',
          walletAddress: '0x1111111111111111111111111111111111111111',
          userIdentifier: 'user1@test.com',
          socialType: 'email',
          gasCostUsd: 0,
          currency: 'ETH',
          paymasterPaid: false,
          status: 'confirmed',
          confirmedAt: new Date()
        },
        {
          projectId: testProjectId,
          transactionType: 'token_transfer',
          chain: 'ethereum',
          walletAddress: '0x1111111111111111111111111111111111111111',
          userIdentifier: 'user1@test.com',
          socialType: 'email',
          gasCostUsd: 2.5,
          currency: 'ETH',
          paymasterPaid: true,
          status: 'confirmed',
          confirmedAt: new Date()
        },
        {
          projectId: testProjectId,
          transactionType: 'wallet_creation',
          chain: 'solana',
          walletAddress: 'So11111111111111111111111111111111111111111',
          userIdentifier: 'user2@test.com',
          socialType: 'email',
          gasCostUsd: 0,
          currency: 'SOL',
          paymasterPaid: false,
          status: 'confirmed',
          confirmedAt: new Date()
        }
      ];

      try {
        // Record transactions in parallel for faster execution
        await Promise.all(transactions.map(tx => AnalyticsService.recordTransaction(tx)));
      } catch (error) {
        console.warn('Test data creation warning:', error.message);
      }
    }, 15000); // 15 second timeout

    test('should get project overview analytics', async () => {
      const overview = await AnalyticsService.getProjectOverview(testProjectId, 30);
      
      expect(overview).toBeDefined();
      expect(overview.overview).toBeDefined();
      expect(overview.overview.total_transactions).toBe(3);
      expect(overview.overview.total_unique_users).toBe(2);
      expect(overview.chains).toBeDefined();
      expect(overview.chains.ethereum).toBeDefined();
      expect(overview.chains.solana).toBeDefined();
    }, 20000);

    test('should get transaction history with pagination', async () => {
      const history = await AnalyticsService.getTransactionHistory(testProjectId, {
        page: 1,
        limit: 2
      });
      
      expect(history).toBeDefined();
      expect(history.transactions).toHaveLength(2);
      expect(history.pagination).toBeDefined();
      expect(history.pagination.total).toBe(3);
      expect(history.pagination.pages).toBe(2);
    }, 20000);

    test('should filter transactions by chain', async () => {
      const history = await AnalyticsService.getTransactionHistory(testProjectId, {
        chain: 'ethereum'
      });
      
      expect(history.transactions).toHaveLength(2);
      expect(history.transactions.every(tx => tx.chain === 'ethereum')).toBe(true);
    }, 20000);

    test('should get user analytics', async () => {
      const userAnalytics = await AnalyticsService.getUserAnalytics(testProjectId);
      
      expect(userAnalytics).toBeDefined();
      expect(userAnalytics.top_users).toBeDefined();
      expect(userAnalytics.top_users.length).toBeGreaterThan(0);
      expect(userAnalytics.chain_preferences).toBeDefined();
    }, 20000);

    test('should get cost analytics', async () => {
      const costAnalytics = await AnalyticsService.getCostAnalytics(testProjectId, 30);
      
      expect(costAnalytics).toBeDefined();
      expect(costAnalytics.costs).toBeDefined();
      expect(costAnalytics.costs.total_spent_usd).toBe(2.5);
      expect(costAnalytics.costs.paymaster_spent_usd).toBe(2.5);
      expect(costAnalytics.costs.user_paid_usd).toBe(0);
      expect(costAnalytics.forecast).toBeDefined();
    }, 20000);
  });

  describe('Export Functionality', () => {
    beforeEach(async () => {
      // Create test transaction with timeout handling
      try {
        await AnalyticsService.recordTransaction({
          projectId: testProjectId,
          transactionType: 'wallet_creation',
          chain: 'ethereum',
          walletAddress: '0x1234567890123456789012345678901234567890',
          userIdentifier: testUserId,
          socialType: 'email',
          gasCostUsd: 0,
          currency: 'ETH',
          paymasterPaid: false,
          status: 'confirmed',
          confirmedAt: new Date()
        });
      } catch (error) {
        console.warn('Export test data creation warning:', error.message);
      }
    }, 15000); // 15 second timeout

    test('should export transactions as CSV', async () => {
      const exportData = await AnalyticsService.exportAnalytics(testProjectId, {
        format: 'csv',
        type: 'transactions'
      });
      
      expect(exportData).toBeDefined();
      expect(exportData.format).toBe('csv');
      expect(exportData.contentType).toBe('text/csv');
      expect(exportData.data).toContain('transaction_id');
      expect(exportData.data).toContain('wallet_creation');
    }, 20000);

    test('should export transactions as JSON', async () => {
      const exportData = await AnalyticsService.exportAnalytics(testProjectId, {
        format: 'json',
        type: 'transactions'
      });
      
      expect(exportData).toBeDefined();
      expect(exportData.format).toBe('json');
      expect(exportData.contentType).toBe('application/json');
      
      const parsedData = JSON.parse(exportData.data);
      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('User Activity Tracking', () => {
    test('should update user activity on transaction', async () => {
      await AnalyticsService.recordTransaction({
        projectId: testProjectId,
        transactionType: 'wallet_creation',
        chain: 'ethereum',
        walletAddress: '0x1234567890123456789012345678901234567890',
        userIdentifier: testUserId,
        socialType: 'email',
        gasCostUsd: 0,
        currency: 'ETH',
        paymasterPaid: false,
        status: 'confirmed',
        confirmedAt: new Date()
      });

      const userActivity = await ProjectUserActivity.findOne({
        project_id: testProjectId,
        user_identifier: testUserId
      });

      expect(userActivity).toBeDefined();
      expect(userActivity.wallets_created).toBe(1);
      expect(userActivity.transactions_sent).toBe(1);
      expect(userActivity.chains_used).toContain('ethereum');
    }, 20000);

    test('should calculate engagement score', async () => {
      // Record multiple transactions for the same user
      const transactions = [
        { transactionType: 'wallet_creation', chain: 'ethereum' },
        { transactionType: 'token_transfer', chain: 'ethereum' },
        { transactionType: 'token_transfer', chain: 'solana' }
      ];

      for (const tx of transactions) {
        await AnalyticsService.recordTransaction({
          projectId: testProjectId,
          ...tx,
          walletAddress: '0x1234567890123456789012345678901234567890',
          userIdentifier: testUserId,
          socialType: 'email',
          gasCostUsd: 1.0,
          currency: 'ETH',
          paymasterPaid: true,
          status: 'confirmed',
          confirmedAt: new Date()
        });
      }

      const userActivity = await ProjectUserActivity.findOne({
        project_id: testProjectId,
        user_identifier: testUserId
      });

      expect(userActivity.engagement_score).toBeGreaterThan(0);
      expect(userActivity.chains_used.length).toBe(2); // ethereum and solana
    }, 30000); // Longer timeout for multiple transactions
  });
});

// Integration test for the analytics API endpoints
describe('Analytics API Integration', () => {
  // These tests would require a full Express app setup
  // and proper authentication mocking
  
  test.skip('should return analytics overview via API', async () => {
    // Mock request/response would go here
    // This would test the actual API endpoints
  });
  
  test.skip('should export data via API', async () => {
    // Mock request/response would go here
  });
});

console.log('✅ Analytics tests ready - run with: npm test analytics.test.js'); 