#!/usr/bin/env node

/**
 * Send Funds Test V2 - Using Correct Payment API
 * 
 * This script uses the correct /api/payments endpoint to send funds.
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

class SendFundsV2Tester {
  constructor() {
    this.sdk = null;
    this.results = [];
  }

  async initialize() {
    console.log('🚀 INITIALIZING SEND FUNDS TEST V2');
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
    
    const balances = { senders: {}, recipients: {} };

    // Check sender balances
    console.log('📊 SENDER WALLET BALANCES:');
    
    // Ethereum sender - try direct RPC first
    try {
      const rpcResponse = await fetch('https://ethereum-sepolia-rpc.publicnode.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [SENDER_WALLETS.EVM, 'latest'],
          id: 1
        })
      });
      
      const rpcResult = await rpcResponse.json();
      
      if (rpcResult.result) {
        const balanceWei = parseInt(rpcResult.result, 16);
        const balanceETH = balanceWei / 1000000000000000000;
        balances.senders.ethereum = balanceETH;
        console.log(`   EVM Sender: ${balanceETH} ETH`);
      } else {
        console.log(`   EVM Sender: RPC check failed`);
        balances.senders.ethereum = 0;
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

  async attemptPayment(fromChain, toChain, fromAddress, toAddress, amount, asset) {
    console.log(`💸 ATTEMPTING ${fromChain.toUpperCase()} → ${toChain.toUpperCase()} PAYMENT`);
    console.log('─────────────────────────────────────────────────────');
    console.log(`   From: ${fromAddress} (${fromChain})`);
    console.log(`   To: ${toAddress} (${toChain})`);
    console.log(`   Amount: ${amount} ${asset}`);
    console.log('');

    try {
      // Use the correct /api/payments endpoint format
      const paymentData = {
        from: {
          address: fromAddress,
          chain: fromChain
        },
        to: {
          address: toAddress,
          chain: toChain
        },
        amount: amount,
        asset: asset,
        gasless: false, // Set to true if you want gasless transactions
        crossChain: fromChain !== toChain
      };

      console.log('📤 Sending payment request:');
      console.log(JSON.stringify(paymentData, null, 2));
      console.log('');

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

      if (response.ok && result.hash) {
        console.log(`✅ ${fromChain.toUpperCase()} Payment Success!`);
        console.log(`   TX Hash: ${result.hash}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Block: ${result.blockNumber}`);
        console.log(`   Fee: ${result.fee} ${asset}`);
        
        const explorerUrl = fromChain.includes('solana') 
          ? `https://explorer.solana.com/tx/${result.hash}?cluster=devnet`
          : `https://sepolia.etherscan.io/tx/${result.hash}`;
        
        console.log(`   Explorer: ${explorerUrl}`);
        
        // If cross-chain, show destination info
        if (result.crossChain && result.destinationTx) {
          console.log(`   Destination TX: ${result.destinationTx.hash}`);
          console.log(`   Destination Status: ${result.destinationTx.status}`);
          console.log(`   Est. Completion: ${result.destinationTx.estimatedConfirmation}`);
        }
        
        return {
          success: true,
          chain: fromChain,
          toChain: toChain,
          transactionHash: result.hash,
          explorerUrl: explorerUrl,
          amount,
          asset,
          fee: result.fee,
          crossChain: result.crossChain,
          destinationTx: result.destinationTx
        };
      } else {
        console.log(`❌ ${fromChain.toUpperCase()} Payment Failed:`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${result.error || result.message || 'Unknown error'}`);
        
        return {
          success: false,
          chain: fromChain,
          error: result.error || result.message || `HTTP ${response.status}`,
          amount,
          asset
        };
      }

    } catch (error) {
      console.log(`❌ ${fromChain.toUpperCase()} Payment Request Failed:`);
      console.log(`   Error: ${error.message}`);
      
      return {
        success: false,
        chain: fromChain,
        error: error.message,
        amount,
        asset
      };
    }
  }

  async sendPayments(balances) {
    console.log('🚀 EXECUTING PAYMENT TRANSACTIONS');
    console.log('═══════════════════════════════════════════════════════');
    
    const transactions = [];

    // Attempt Ethereum payment
    if (balances.senders.ethereum > 0.001) {
      const ethTx = await this.attemptPayment(
        'ethereum',
        'ethereum', // Same chain for now
        SENDER_WALLETS.EVM,
        RECIPIENTS.EVM,
        '0.0005',
        'ETH'
      );
      transactions.push(ethTx);
    } else {
      console.log('❌ ETHEREUM: Insufficient balance for payment');
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

    // Attempt Solana payment
    if (balances.senders.solana > 0.002) {
      const solTx = await this.attemptPayment(
        'solana',
        'solana', // Same chain for now
        SENDER_WALLETS.SVM,
        RECIPIENTS.SVM,
        '0.001',
        'SOL'
      );
      transactions.push(solTx);
    } else {
      console.log('❌ SOLANA: Insufficient balance for payment');
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

    // Try a cross-chain payment (SOL to ETH) if Solana has enough balance
    if (balances.senders.solana > 0.005) {
      console.log('🌉 ATTEMPTING CROSS-CHAIN PAYMENT (SOL → ETH)');
      const crossChainTx = await this.attemptPayment(
        'solana',
        'ethereum',
        SENDER_WALLETS.SVM,
        RECIPIENTS.EVM,
        '0.002',
        'SOL'
      );
      transactions.push(crossChainTx);
    }

    return transactions;
  }

  async checkBalancesAfterSend() {
    console.log('🔍 CHECKING BALANCES AFTER SENDING');
    console.log('═══════════════════════════════════════════════════════');
    
    // Wait a moment for transactions to process
    console.log('⏳ Waiting 10 seconds for transactions to process...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check recipient balances
    console.log('📊 RECIPIENT WALLET BALANCES:');
    
    // Ethereum recipient
    try {
      const rpcResponse = await fetch('https://ethereum-sepolia-rpc.publicnode.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBalance',
          params: [RECIPIENTS.EVM, 'latest'],
          id: 1
        })
      });
      
      const rpcResult = await rpcResponse.json();
      
      if (rpcResult.result) {
        const balanceWei = parseInt(rpcResult.result, 16);
        const balanceETH = balanceWei / 1000000000000000000;
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
    console.log('📋 PAYMENT TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════');
    
    const successful = transactions.filter(tx => tx.success);
    const failed = transactions.filter(tx => !tx.success);
    
    console.log(`✅ Successful Payments: ${successful.length}`);
    console.log(`❌ Failed Payments: ${failed.length}`);
    console.log('');
    
    if (successful.length > 0) {
      console.log('🎉 SUCCESSFUL PAYMENTS:');
      successful.forEach((tx, index) => {
        console.log(`   ${index + 1}. ${tx.chain.toUpperCase()}: ${tx.amount} ${tx.asset}`);
        if (tx.transactionHash) {
          console.log(`      TX Hash: ${tx.transactionHash}`);
          console.log(`      Explorer: ${tx.explorerUrl}`);
          console.log(`      Fee: ${tx.fee} ${tx.asset}`);
          if (tx.crossChain) {
            console.log(`      Cross-Chain: ${tx.chain} → ${tx.toChain}`);
            if (tx.destinationTx) {
              console.log(`      Destination TX: ${tx.destinationTx.hash}`);
            }
          }
        }
        console.log('');
      });
    }
    
    if (failed.length > 0) {
      console.log('❌ FAILED PAYMENTS:');
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
    
    console.log('💡 NOTE: These are simulated transactions from the backend API.');
    console.log('   Real transactions would require private key access and gas fees.');
    console.log('');
    
    console.log('✅ SEND FUNDS TEST V2 COMPLETE!');
  }
}

// Main execution
async function runSendFundsTestV2() {
  console.log('💸 SEND FUNDS LIVE TEST V2');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🎯 Using correct /api/payments endpoint');
  console.log('🔥 Testing payment API functionality!');
  console.log('');
  
  const tester = new SendFundsV2Tester();
  
  try {
    // Initialize
    await tester.initialize();
    
    // Check balances before sending
    const balances = await tester.checkBalancesBeforeSend();
    
    // Send payments
    const transactions = await tester.sendPayments(balances);
    
    // Check balances after sending
    await tester.checkBalancesAfterSend();
    
    // Display results
    await tester.displayResults(transactions);
    
  } catch (error) {
    console.error('❌ Send funds test V2 failed:', error.message);
    console.log('');
    console.log('🔍 This could be due to:');
    console.log('   • Network connectivity issues');
    console.log('   • API endpoint changes');
    console.log('   • Rate limiting');
  }
}

// Run the test
runSendFundsTestV2().catch(console.error); 