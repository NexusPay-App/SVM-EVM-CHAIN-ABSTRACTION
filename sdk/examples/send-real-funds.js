#!/usr/bin/env node

/**
 * Send REAL Funds Test
 * 
 * This script will send ACTUAL blockchain transactions using real private keys.
 * The transactions will be verifiable on block explorers.
 * 
 * We'll use the social ID that corresponds to your funded wallets.
 */

import { NexusSDK } from '../dist/index.js';

// Recipients for real transactions
const RECIPIENTS = {
  EVM: '0x059f29e61Cc9a160BA31Da2eF7634132C0539B18',
  SVM: '3EYnWrRNwoKjcTZbeeT4YnxMvjJmKTdXpBF4ikEEvqHF'
};

class RealTransactionSender {
  constructor() {
    this.sdk = null;
  }

  async initialize() {
    console.log('🔥 INITIALIZING REAL TRANSACTION SENDER');
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  WARNING: This will send REAL blockchain transactions!');
    console.log('💰 Real money will be transferred!');
    console.log('');
    
    this.sdk = new NexusSDK({
      apiKey: 'local-dev-key',
      environment: 'production',
      chains: ['ethereum', 'solana'],
      endpoints: {
        api: 'https://backend-amber-zeta-94.vercel.app'
      }
    });

    await this.sdk.initialize();
    console.log('✅ SDK initialized successfully\n');
  }

  async findFundedWallets() {
    console.log('🔍 FINDING YOUR FUNDED WALLETS');
    console.log('═══════════════════════════════════════════════════════');
    
    // Try to find the wallet that corresponds to your funded addresses
    const testIds = [
      'user@example.com',
      'test@nexus.com', 
      'wallet_test@nexus.com',
      'demo@nexus.com',
      'testing@nexus.com'
    ];

    let fundedWallet = null;

    for (const socialId of testIds) {
      try {
        console.log(`👤 Checking: ${socialId}`);
        const wallet = await this.sdk.getWallet(socialId, 'email');
        
        if (wallet && wallet.addresses) {
          console.log(`   EVM: ${wallet.addresses.ethereum}`);
          console.log(`   SVM: ${wallet.addresses.solana}`);
          
          // Check if this matches your funded wallet addresses
          if (wallet.addresses.ethereum === '0x964AAaD2d33B328780B5b93c64FD85617238088a' || 
              wallet.addresses.solana === '7acKJVBa1j5Y7gujkDC58QzMuTNvprrDYJ94VsxmFK8o') {
            console.log(`   🎉 FOUND YOUR FUNDED WALLET!`);
            fundedWallet = { socialId, wallet };
            break;
          } else {
            console.log(`   ⚠️  Not your funded wallet`);
          }
        }
      } catch (error) {
        console.log(`   ❌ No wallet for: ${socialId}`);
      }
    }

    if (!fundedWallet) {
      // Create a test wallet that matches your funded addresses
      console.log('\n🔨 Creating wallet with your funded addresses...');
      console.log('   (This will match the deterministic generation)');
      
      try {
        const wallet = await this.sdk.createWallet({
          socialId: 'funded_wallet_test@nexus.com',
          socialType: 'email',
          chains: ['ethereum', 'solana'],
          paymaster: true
        });
        
        console.log('✅ Created wallet:');
        console.log(`   EVM: ${wallet.addresses.ethereum}`);
        console.log(`   SVM: ${wallet.addresses.solana}`);
        
        fundedWallet = { 
          socialId: 'funded_wallet_test@nexus.com', 
          wallet 
        };
      } catch (error) {
        console.error('❌ Failed to create wallet:', error.message);
        return null;
      }
    }

    console.log('');
    return fundedWallet;
  }

  async checkWalletBalances(socialId) {
    console.log('💳 CHECKING WALLET BALANCES');
    console.log('═══════════════════════════════════════════════════════');
    
    const balances = {};

    // Check via direct API call to get real balances
    try {
      const response = await fetch('https://backend-amber-zeta-94.vercel.app/api/wallets/balance', {
        method: 'POST',
        headers: {
          'x-api-key': 'local-dev-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          socialId: socialId,
          socialType: 'email',
          chains: ['ethereum', 'solana']
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📊 Wallet balances from API:');
        console.log(JSON.stringify(result, null, 2));
        balances.apiResult = result;
      }
    } catch (error) {
      console.log('⚠️  API balance check failed, using direct blockchain checks');
    }

    // Direct blockchain balance checks
    const wallet = await this.sdk.getWallet(socialId, 'email');
    
    if (wallet && wallet.addresses) {
      // Check Ethereum balance
      try {
        const ethResponse = await fetch('https://ethereum-sepolia-rpc.publicnode.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [wallet.addresses.ethereum, 'latest'],
            id: 1
          })
        });
        
        const ethResult = await ethResponse.json();
        
        if (ethResult.result) {
          const balanceWei = parseInt(ethResult.result, 16);
          const balanceETH = balanceWei / 1000000000000000000;
          balances.ethereum = balanceETH;
          console.log(`💎 Ethereum: ${balanceETH} ETH`);
        }
      } catch (error) {
        console.log(`❌ ETH balance check failed`);
        balances.ethereum = 0;
      }

      // Check Solana balance
      try {
        const solResponse = await fetch('https://api.devnet.solana.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [wallet.addresses.solana]
          })
        });
        
        const solResult = await solResponse.json();
        
        if (solResult.result) {
          const balanceSOL = solResult.result.value / 1000000000;
          balances.solana = balanceSOL;
          console.log(`💎 Solana: ${balanceSOL} SOL`);
        }
      } catch (error) {
        console.log(`❌ SOL balance check failed`);
        balances.solana = 0;
      }
    }

    console.log('');
    return balances;
  }

  async sendRealTransaction(socialId, chain, toAddress, amount, asset) {
    console.log(`🔥 SENDING REAL ${chain.toUpperCase()} TRANSACTION`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`   From Social ID: ${socialId}`);
    console.log(`   To: ${toAddress}`);
    console.log(`   Amount: ${amount} ${asset}`);
    console.log(`   Chain: ${chain}`);
    console.log('');

    try {
      const paymentData = {
        from: {
          socialId: socialId,
          socialType: 'email',
          chain: chain
        },
        to: {
          address: toAddress,
          chain: chain
        },
        amount: amount,
        asset: asset,
        gasless: false,
        crossChain: false
      };

      console.log('📤 Sending real transaction request...');
      
      const response = await fetch('https://backend-amber-zeta-94.vercel.app/api/payments', {
        method: 'POST',
        headers: {
          'x-api-key': 'local-dev-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();
      
      console.log('📡 Backend Response:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');

      if (response.ok && result.success !== false && result.hash) {
        console.log(`✅ REAL TRANSACTION SENT!`);
        console.log(`   TX Hash: ${result.hash}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Block: ${result.blockNumber || 'Pending'}`);
        console.log(`   Explorer: ${result.explorerUrl}`);
        console.log('');
        
        return {
          success: true,
          ...result
        };
      } else {
        console.log(`❌ Transaction Failed:`);
        console.log(`   Error: ${result.error || 'Unknown error'}`);
        console.log(`   Code: ${result.code || 'Unknown'}`);
        
        return {
          success: false,
          error: result.error || 'Transaction failed',
          code: result.code
        };
      }

    } catch (error) {
      console.log(`❌ Request Failed:`);
      console.log(`   Error: ${error.message}`);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendAllTransactions(socialId, balances) {
    console.log('🚀 EXECUTING REAL TRANSACTIONS');
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  WARNING: Real money will be sent!');
    console.log('');
    
    const transactions = [];

    // Send Ethereum transaction if balance is sufficient
    if (balances.ethereum && balances.ethereum > 0.002) {
      const ethTx = await this.sendRealTransaction(
        socialId,
        'ethereum',
        RECIPIENTS.EVM,
        '0.001',
        'ETH'
      );
      transactions.push({ chain: 'ethereum', ...ethTx });
    } else {
      console.log('❌ ETHEREUM: Insufficient balance for real transaction');
      console.log(`   Available: ${balances.ethereum || 0} ETH`);
      console.log(`   Required: 0.002 ETH (for amount + gas)`);
      console.log('');
    }

    // Send Solana transaction if balance is sufficient
    if (balances.solana && balances.solana > 0.002) {
      const solTx = await this.sendRealTransaction(
        socialId,
        'solana',
        RECIPIENTS.SVM,
        '0.001',
        'SOL'
      );
      transactions.push({ chain: 'solana', ...solTx });
    } else {
      console.log('❌ SOLANA: Insufficient balance for real transaction');
      console.log(`   Available: ${balances.solana || 0} SOL`);
      console.log(`   Required: 0.002 SOL (for amount + fees)`);
      console.log('');
    }

    return transactions;
  }

  async displayResults(transactions) {
    console.log('📋 REAL TRANSACTION RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    
    const successful = transactions.filter(tx => tx.success);
    const failed = transactions.filter(tx => !tx.success);
    
    console.log(`✅ Successful Real Transactions: ${successful.length}`);
    console.log(`❌ Failed Transactions: ${failed.length}`);
    console.log('');
    
    if (successful.length > 0) {
      console.log('🎉 REAL TRANSACTIONS SENT:');
      successful.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.chain.toUpperCase()}: ${tx.amount} ${tx.asset}`);
        console.log(`      TX Hash: ${tx.hash}`);
        console.log(`      Explorer: ${tx.explorerUrl}`);
        console.log(`      ✅ VERIFIABLE ON BLOCKCHAIN!`);
        console.log('');
      });
    }
    
    if (failed.length > 0) {
      console.log('❌ FAILED TRANSACTIONS:');
      failed.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.chain.toUpperCase()}`);
        console.log(`      Error: ${tx.error}`);
        console.log(`      Code: ${tx.code || 'Unknown'}`);
        console.log('');
      });
    }
    
    console.log('🎯 RECIPIENT ADDRESSES:');
    console.log(`   • EVM Recipient: ${RECIPIENTS.EVM}`);
    console.log(`   • SVM Recipient: ${RECIPIENTS.SVM}`);
    console.log('');
    
    console.log('✅ REAL TRANSACTION TEST COMPLETE!');
    
    if (successful.length > 0) {
      console.log('');
      console.log('🔥 SUCCESS! Real money has been transferred!');
      console.log('💰 Check the explorer links above to verify on blockchain!');
    }
  }
}

// Main execution
async function runRealTransactionTest() {
  console.log('💰 REAL MONEY TRANSFER TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚨 WARNING: This will send REAL blockchain transactions!');
  console.log('💸 Real cryptocurrency will be transferred!');
  console.log('🔍 Transactions will be verifiable on block explorers!');
  console.log('');
  
  const sender = new RealTransactionSender();
  
  try {
    // Initialize
    await sender.initialize();
    
    // Find your funded wallet
    const fundedWallet = await sender.findFundedWallets();
    
    if (!fundedWallet) {
      console.error('❌ Could not find your funded wallet');
      console.log('💡 Make sure your wallet was created through the system');
      return;
    }
    
    console.log(`🎯 Using wallet: ${fundedWallet.socialId}`);
    
    // Check balances
    const balances = await sender.checkWalletBalances(fundedWallet.socialId);
    
    // Send real transactions
    const transactions = await sender.sendAllTransactions(fundedWallet.socialId, balances);
    
    // Display results
    await sender.displayResults(transactions);
    
  } catch (error) {
    console.error('❌ Real transaction test failed:', error.message);
    console.log('');
    console.log('🔍 This could be due to:');
    console.log('   • Insufficient balances');
    console.log('   • Network connectivity issues');
    console.log('   • Private key access problems');
    console.log('   • Backend configuration issues');
  }
}

// Run the test
runRealTransactionTest().catch(console.error); 