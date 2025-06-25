#!/usr/bin/env node

/**
 * Simple Wallet Application Example
 * 
 * A practical example showing how to build a basic wallet application
 * with send/receive functionality using the NexusSDK.
 * 
 * This example focuses on real-world implementation patterns.
 */

// Import using ES modules since SDK is compiled as ES modules
import { NexusSDK } from '../dist/index.js';

class SimpleWalletApp {
  constructor(apiKey) {
    this.sdk = new NexusSDK({
      apiKey: apiKey,
      environment: 'production',
      chains: ['ethereum', 'solana'],
      endpoints: {
        api: 'https://backend-amber-zeta-94.vercel.app'
      }
    });
    
    this.currentUser = null;
    this.currentWallet = null;
  }

  async initialize() {
    console.log('🚀 Initializing Simple Wallet App...');
    
    try {
      await this.sdk.initialize();
      const health = await this.sdk.healthCheck();
      
      console.log('✅ App initialized successfully');
      console.log(`   API Status: ${health.status}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      return false;
    }
  }

  async createOrLoginUser(userId, userType = 'email') {
    console.log(`👤 Creating/Login user: ${userId}`);
    
    try {
      // Try to get existing wallet first
      let wallet;
      try {
        wallet = await this.sdk.getWallet(userId, userType);
        console.log('✅ Found existing wallet');
      } catch (error) {
        // Wallet doesn't exist, create new one
        console.log('📝 Creating new wallet...');
        wallet = await this.sdk.createWallet({
          socialId: userId,
          socialType: userType,
          chains: ['ethereum', 'solana'],
          paymaster: true // Company pays gas fees
        });
        console.log('✅ New wallet created');
      }

      this.currentUser = userId;
      this.currentWallet = wallet;

      console.log('🏠 Wallet Addresses:');
      Object.entries(wallet.addresses || {}).forEach(([chain, address]) => {
        if (address) {
          console.log(`   ${chain}: ${address}`);
        }
      });

      return wallet;
    } catch (error) {
      console.error(`❌ Failed to create/login user:`, error.message);
      return null;
    }
  }

  async getBalance() {
    if (!this.currentUser || !this.currentWallet) {
      console.log('❌ No user logged in');
      return null;
    }

    console.log(`💰 Checking balance for ${this.currentUser}...`);
    
    try {
      // In a real app, you would query actual blockchain balances
      // For demo purposes, we'll show funded test balances
      const balances = {
        ethereum: {
          ETH: '1.5',
          USDC: '1000.0',
          DAI: '500.0'
        },
        solana: {
          SOL: '25.0',
          USDC: '2000.0'
        }
      };

      console.log('✅ Current Balances:');
      Object.entries(balances).forEach(([chain, tokens]) => {
        console.log(`   ${chain.toUpperCase()}:`);
        Object.entries(tokens).forEach(([token, amount]) => {
          console.log(`     ${token}: ${amount}`);
        });
      });

      return balances;
    } catch (error) {
      console.error('❌ Failed to get balance:', error.message);
      return null;
    }
  }

  async sendFunds(recipientId, amount, token = 'ETH', chain = 'ethereum') {
    if (!this.currentUser || !this.currentWallet) {
      console.log('❌ No user logged in');
      return null;
    }

    console.log(`💸 Sending ${amount} ${token} to ${recipientId} on ${chain}...`);
    
    try {
      // Get or create recipient wallet
      let recipientWallet;
      try {
        recipientWallet = await this.sdk.getWallet(recipientId, 'email');
      } catch (error) {
        console.log('📝 Creating wallet for recipient...');
        recipientWallet = await this.sdk.createWallet({
          socialId: recipientId,
          socialType: 'email',
          chains: [chain],
          paymaster: true
        });
      }

      // Simulate transaction (in real app, this would sign and broadcast)
      const transaction = {
        id: `tx_${Date.now()}`,
        from: this.currentWallet.addresses[chain],
        to: recipientWallet.addresses[chain],
        amount: amount,
        token: token,
        chain: chain,
        status: 'completed',
        timestamp: new Date().toISOString(),
        gasPayment: 'company-sponsored'
      };

      console.log('✅ Transaction completed');
      console.log(`   TX ID: ${transaction.id}`);
      console.log(`   From: ${transaction.from}`);
      console.log(`   To: ${transaction.to}`);
      console.log(`   Amount: ${amount} ${token}`);
      console.log(`   Chain: ${chain}`);
      console.log(`   Gas: Sponsored by app`);

      return transaction;
    } catch (error) {
      console.error('❌ Failed to send funds:', error.message);
      return null;
    }
  }

  async receiveFunds(fromUserId, amount, token = 'ETH', chain = 'ethereum') {
    if (!this.currentUser || !this.currentWallet) {
      console.log('❌ No user logged in');
      return null;
    }

    console.log(`📥 Receiving ${amount} ${token} from ${fromUserId} on ${chain}...`);
    
    try {
      // Simulate receiving transaction
      const transaction = {
        id: `rx_${Date.now()}`,
        from: fromUserId,
        to: this.currentWallet.addresses[chain],
        amount: amount,
        token: token,
        chain: chain,
        status: 'completed',
        timestamp: new Date().toISOString(),
        type: 'received'
      };

      console.log('✅ Funds received');
      console.log(`   TX ID: ${transaction.id}`);
      console.log(`   From: ${transaction.from}`);
      console.log(`   Amount: ${amount} ${token}`);
      console.log(`   Chain: ${chain}`);

      return transaction;
    } catch (error) {
      console.error('❌ Failed to receive funds:', error.message);
      return null;
    }
  }

  async crossChainTransfer(amount, token = 'USDC', fromChain = 'ethereum', toChain = 'solana') {
    if (!this.currentUser || !this.currentWallet) {
      console.log('❌ No user logged in');
      return null;
    }

    console.log(`🌉 Cross-chain transfer: ${amount} ${token} from ${fromChain} to ${toChain}...`);
    
    try {
      // Simulate cross-chain bridge
      const bridgeTransaction = {
        id: `bridge_${Date.now()}`,
        from: {
          address: this.currentWallet.addresses[fromChain],
          chain: fromChain
        },
        to: {
          address: this.currentWallet.addresses[toChain],
          chain: toChain
        },
        amount: amount,
        token: token,
        status: 'completed',
        timestamp: new Date().toISOString(),
        bridgeFee: '0.1',
        estimatedTime: '2-5 minutes'
      };

      console.log('✅ Cross-chain transfer completed');
      console.log(`   Bridge ID: ${bridgeTransaction.id}`);
      console.log(`   From: ${bridgeTransaction.from.address} (${fromChain})`);
      console.log(`   To: ${bridgeTransaction.to.address} (${toChain})`);
      console.log(`   Amount: ${amount} ${token}`);
      console.log(`   Bridge Fee: ${bridgeTransaction.bridgeFee} ${token}`);

      return bridgeTransaction;
    } catch (error) {
      console.error('❌ Failed cross-chain transfer:', error.message);
      return null;
    }
  }

  async getTransactionHistory() {
    if (!this.currentUser) {
      console.log('❌ No user logged in');
      return [];
    }

    console.log(`📜 Transaction history for ${this.currentUser}:`);
    
    // In a real app, this would query blockchain transaction history
    const mockHistory = [
      {
        id: 'tx_001',
        type: 'sent',
        amount: '100',
        token: 'USDC',
        to: 'bob@example.com',
        chain: 'ethereum',
        timestamp: '2024-12-01T10:00:00Z'
      },
      {
        id: 'tx_002',
        type: 'received',
        amount: '50',
        token: 'ETH',
        from: 'alice@example.com',
        chain: 'ethereum',
        timestamp: '2024-12-01T11:30:00Z'
      },
      {
        id: 'bridge_001',
        type: 'bridge',
        amount: '200',
        token: 'USDC',
        fromChain: 'ethereum',
        toChain: 'solana',
        timestamp: '2024-12-01T12:15:00Z'
      }
    ];

    mockHistory.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx.type.toUpperCase()}: ${tx.amount} ${tx.token}`);
      if (tx.type === 'sent') {
        console.log(`   To: ${tx.to} on ${tx.chain}`);
      } else if (tx.type === 'received') {
        console.log(`   From: ${tx.from} on ${tx.chain}`);
      } else if (tx.type === 'bridge') {
        console.log(`   Bridge: ${tx.fromChain} → ${tx.toChain}`);
      }
      console.log(`   Time: ${new Date(tx.timestamp).toLocaleString()}`);
      console.log('');
    });

    return mockHistory;
  }

  logout() {
    console.log(`👋 Logging out ${this.currentUser}`);
    this.currentUser = null;
    this.currentWallet = null;
  }
}

// Demo usage
async function demonstrateWalletApp() {
  console.log('📱 SIMPLE WALLET APPLICATION DEMO\n');
  
  const app = new SimpleWalletApp('local-dev-key'); // Replace with your API key
  
  // Initialize app
  const initialized = await app.initialize();
  if (!initialized) {
    console.error('Failed to initialize app');
    return;
  }

  console.log('\n--- USER ALICE SESSION ---');
  
  // User Alice logs in
  await app.createOrLoginUser('alice@myapp.com', 'email');
  
  // Check balance
  await app.getBalance();
  
  // Send funds to Bob
  await app.sendFunds('bob@myapp.com', '100', 'USDC', 'ethereum');
  
  // Perform cross-chain transfer
  await app.crossChainTransfer('200', 'USDC', 'ethereum', 'solana');
  
  // View transaction history
  await app.getTransactionHistory();
  
  // Logout
  app.logout();

  console.log('\n--- USER BOB SESSION ---');
  
  // User Bob logs in
  await app.createOrLoginUser('bob@myapp.com', 'email');
  
  // Check balance
  await app.getBalance();
  
  // Receive funds simulation
  await app.receiveFunds('alice@myapp.com', '100', 'USDC', 'ethereum');
  
  // Send funds to Charlie
  await app.sendFunds('charlie@myapp.com', '50', 'ETH', 'ethereum');
  
  console.log('\n🎉 WALLET APP DEMO COMPLETED!');
  console.log('\n💡 This demo showed:');
  console.log('   ✅ User login/wallet creation');
  console.log('   ✅ Balance checking');
  console.log('   ✅ Sending funds between users');
  console.log('   ✅ Receiving funds');
  console.log('   ✅ Cross-chain transfers');
  console.log('   ✅ Transaction history');
  console.log('   ✅ Multi-user support');
  console.log('\n🚀 Ready to integrate into your app!');
}

// Export for use as module
export { SimpleWalletApp };

// Run demo if called directly  
// Check if this is the main module in ES modules
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateWalletApp().catch(console.error);
} 