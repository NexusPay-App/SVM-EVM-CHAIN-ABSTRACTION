#!/usr/bin/env node

/**
 * Send Funds Test - Real Transaction Execution
 * 
 * This script will attempt to send real funds from your funded wallets
 * to your specified recipient addresses.
 * 
 * FROM (Your funded wallets):
 * - EVM: 0x964AAaD2d33B328780B5b93c64FD85617238088a
 * - SVM: 7acKJVBa1j5Y7gujkDC58QzMuTNvprrDYJ94VsxmFK8o
 * 
 * TO (Your recipient addresses):
 * - EVM: 0x059f29e61Cc9a160BA31Da2eF7634132C0539B18
 * - SVM: 3EYnWrRNwoKjcTZbeeT4YnxMvjJmKTdXpBF4ikEEvqHF
 */

import { NexusSDK } from '../dist/index.js';

// Your funded wallet addresses
const SENDER_WALLETS = {
  EVM: '0x964AAaD2d33B328780B5b93c64FD85617238088a',
  SVM: '7acKJVBa1j5Y7gujkDC58QzMuTNvprrDYJ94VsxmFK8o'
};

// Your recipient addresses
const RECIPIENTS = {
  EVM: '0x059f29e61Cc9a160BA31Da2eF7634132C0539B18',
  SVM: '3EYnWrRNwoKjcTZbeeT4YnxMvjJmKTdXpBF4ikEEvqHF'
};

class SendFundsTester {
  constructor() {
    this.sdk = null;
    this.results = [];
  }

  async initialize() {
    console.log('🚀 INITIALIZING SEND FUNDS TEST');
    console.log('═══════════════════════════════════════════════════════');
    
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

  async checkBalancesBeforeSend() {
    console.log('💳 CHECKING BALANCES BEFORE SENDING');
    console.log('═══════════════════════════════════════════════════════');
    
    const balances = {
      senders: {},
      recipients: {}
    };

    // Check sender balances
    console.log('📊 SENDER WALLET BALANCES:');
    
    // Ethereum sender
    try {
      const ethResponse = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${SENDER_WALLETS.EVM}&tag=latest&apikey=YourApiKeyToken`);
      const ethResult = await ethResponse.json();
      
      if (ethResult.result) {
        const balanceETH = parseFloat(ethResult.result) / 1000000000000000000;
        balances.senders.ethereum = balanceETH;
        console.log(`   EVM Sender: ${balanceETH} ETH`);
      }
    } catch (error) {
      console.log(`   EVM Sender: Balance check failed`);
      balances.senders.ethereum = 0;
    }

    // Solana sender
    try {
      const solResponse = await fetch('https://api.devnet.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [SENDER_WALLETS.SVM]
        })
      });
      
      const solResult = await solResponse.json();
      
      if (solResult.result) {
        const balanceSOL = solResult.result.value / 1000000000;
        balances.senders.solana = balanceSOL;
        console.log(`   SVM Sender: ${balanceSOL} SOL`);
      }
    } catch (error) {
      console.log(`   SVM Sender: Balance check failed`);
      balances.senders.solana = 0;
    }

    console.log('');
    return balances;
  }

  async attemptSendTransaction(chain, fromAddress, toAddress, amount, asset) {
    console.log(`💸 ATTEMPTING ${chain.toUpperCase()} TRANSACTION`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`   From: ${fromAddress}`);
    console.log(`   To: ${toAddress}`);
    console.log(`   Amount: ${amount} ${asset}`);
    console.log('');

    try {
      // Call the backend API to attempt sending
      const response = await fetch('https://backend-amber-zeta-94.vercel.app/api/transactions/send', {
        method: 'POST',
        headers: {
          'x-api-key': 'local-dev-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chain: chain,
          from: fromAddress,
          to: toAddress,
          amount: amount,
          asset: asset,
          network: chain === 'ethereum' ? 'sepolia' : 'devnet'
        })
      });

      const result = await response.json();
      
      console.log('📡 Backend Response:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');

      if (result.success) {
        console.log(`✅ ${chain.toUpperCase()} Transaction Success!`);
        if (result.data.transactionHash) {
          console.log(`   TX Hash: ${result.data.transactionHash}`);
          
          const explorerUrl = chain === 'ethereum' 
            ? `https://sepolia.etherscan.io/tx/${result.data.transactionHash}`
            : `https://explorer.solana.com/tx/${result.data.transactionHash}?cluster=devnet`;
          
          console.log(`   Explorer: ${explorerUrl}`);
        }
        
        return {
          success: true,
          chain,
          transactionHash: result.data.transactionHash,
          explorerUrl: explorerUrl,
          amount,
          asset
        };
      } else {
        console.log(`❌ ${chain.toUpperCase()} Transaction Failed:`);
        console.log(`   Error: ${result.error || result.message || 'Unknown error'}`);
        
        return {
          success: false,
          chain,
          error: result.error || result.message || 'Unknown error',
          amount,
          asset
        };
      }

    } catch (error) {
      console.log(`❌ ${chain.toUpperCase()} Transaction Request Failed:`);
      console.log(`   Error: ${error.message}`);
      
      return {
        success: false,
        chain,
        error: error.message,
        amount,
        asset
      };
    }
  }

  async sendTransactions(balances) {
    console.log('🚀 EXECUTING SEND TRANSACTIONS');
    console.log('═══════════════════════════════════════════════════════');
    
    const transactions = [];

    // Attempt Ethereum transaction
    if (balances.senders.ethereum > 0.001) {
      const ethTx = await this.attemptSendTransaction(
        'ethereum',
        SENDER_WALLETS.EVM,
        RECIPIENTS.EVM,
        '0.0005',
        'ETH'
      );
      transactions.push(ethTx);
    } else {
      console.log('❌ ETHEREUM: Insufficient balance for transaction');
      console.log(`   Available: ${balances.senders.ethereum} ETH`);
      console.log(`   Required: 0.001 ETH (for amount + gas)`);
      console.log('');
      
      transactions.push({
        success: false,
        chain: 'ethereum',
        error: 'Insufficient balance',
        amount: '0.0005',
        asset: 'ETH'
      });
    }

    // Attempt Solana transaction
    if (balances.senders.solana > 0.002) {
      const solTx = await this.attemptSendTransaction(
        'solana',
        SENDER_WALLETS.SVM,
        RECIPIENTS.SVM,
        '0.001',
        'SOL'
      );
      transactions.push(solTx);
    } else {
      console.log('❌ SOLANA: Insufficient balance for transaction');
      console.log(`   Available: ${balances.senders.solana} SOL`);
      console.log(`   Required: 0.002 SOL (for amount + fees)`);
      console.log('');
      
      transactions.push({
        success: false,
        chain: 'solana',
        error: 'Insufficient balance',
        amount: '0.001',
        asset: 'SOL'
      });
    }

    return transactions;
  }

  async checkBalancesAfterSend() {
    console.log('🔍 CHECKING BALANCES AFTER SENDING');
    console.log('═══════════════════════════════════════════════════════');
    
    // Wait a moment for transactions to process
    console.log('⏳ Waiting 30 seconds for transactions to process...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check recipient balances
    console.log('📊 RECIPIENT WALLET BALANCES:');
    
    // Ethereum recipient
    try {
      const ethResponse = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${RECIPIENTS.EVM}&tag=latest&apikey=YourApiKeyToken`);
      const ethResult = await ethResponse.json();
      
      if (ethResult.result) {
        const balanceETH = parseFloat(ethResult.result) / 1000000000000000000;
        console.log(`   EVM Recipient: ${balanceETH} ETH`);
      }
    } catch (error) {
      console.log(`   EVM Recipient: Balance check failed`);
    }

    // Solana recipient
    try {
      const solResponse = await fetch('https://api.devnet.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [RECIPIENTS.SVM]
        })
      });
      
      const solResult = await solResponse.json();
      
      if (solResult.result) {
        const balanceSOL = solResult.result.value / 1000000000;
        console.log(`   SVM Recipient: ${balanceSOL} SOL`);
      }
    } catch (error) {
      console.log(`   SVM Recipient: Balance check failed`);
    }

    console.log('');
  }

  async displayResults(transactions) {
    console.log('📋 SEND FUNDS TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    
    const successful = transactions.filter(tx => tx.success);
    const failed = transactions.filter(tx => !tx.success);
    
    console.log(`✅ Successful Transactions: ${successful.length}`);
    console.log(`❌ Failed Transactions: ${failed.length}`);
    console.log('');
    
    if (successful.length > 0) {
      console.log('🎉 SUCCESSFUL TRANSACTIONS:');
      successful.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.chain.toUpperCase()}: ${tx.amount} ${tx.asset}`);
        if (tx.transactionHash) {
          console.log(`      TX Hash: ${tx.transactionHash}`);
          console.log(`      Explorer: ${tx.explorerUrl}`);
        }
        console.log('');
      });
    }
    
    if (failed.length > 0) {
      console.log('❌ FAILED TRANSACTIONS:');
      failed.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.chain.toUpperCase()}: ${tx.amount} ${tx.asset}`);
        console.log(`      Error: ${tx.error}`);
        console.log('');
      });
    }
    
    console.log('🔗 USEFUL LINKS:');
    console.log(`   • EVM Sender: https://sepolia.etherscan.io/address/${SENDER_WALLETS.EVM}`);
    console.log(`   • EVM Recipient: https://sepolia.etherscan.io/address/${RECIPIENTS.EVM}`);
    console.log(`   • SVM Sender: https://explorer.solana.com/address/${SENDER_WALLETS.SVM}?cluster=devnet`);
    console.log(`   • SVM Recipient: https://explorer.solana.com/address/${RECIPIENTS.SVM}?cluster=devnet`);
    console.log('');
    
    console.log('✅ SEND FUNDS TEST COMPLETE!');
  }
}

// Main execution
async function runSendFundsTest() {
  console.log('💸 SEND FUNDS LIVE TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎯 Attempting to send real funds from your wallets');
  console.log('🔥 This will execute actual blockchain transactions!');
  console.log('');
  
  const tester = new SendFundsTester();
  
  try {
    // Initialize
    await tester.initialize();
    
    // Check balances before sending
    const balances = await tester.checkBalancesBeforeSend();
    
    // Send transactions
    const transactions = await tester.sendTransactions(balances);
    
    // Check balances after sending
    await tester.checkBalancesAfterSend();
    
    // Display results
    await tester.displayResults(transactions);
    
  } catch (error) {
    console.error('❌ Send funds test failed:', error.message);
    console.log('');
    console.log('🔍 This could be due to:');
    console.log('   • Backend API not supporting direct transaction sending');
    console.log('   • Private keys not being accessible for signing');
    console.log('   • Network connectivity issues');
    console.log('   • Insufficient gas/fees');
  }
}

// Run the test
runSendFundsTest().catch(console.error); 