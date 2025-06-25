#!/usr/bin/env node

/**
 * Check for existing wallets that might have been funded
 */

import { NexusSDK } from '../dist/index.js';

async function checkExistingWallets() {
  console.log('🔍 SEARCHING FOR EXISTING FUNDED WALLETS');
  console.log('═══════════════════════════════════════════════════════');

  const sdk = new NexusSDK({
    apiKey: 'local-dev-key',
    environment: 'production',
    chains: ['ethereum', 'solana'],
    endpoints: {
      api: 'https://backend-amber-zeta-94.vercel.app'
    }
  });

  await sdk.initialize();

  // Try common user IDs we might have used
  const userIds = [
    'user@example.com',
    'transaction_tester_user@nexus.com',
    'balance_test_user@nexus.com',
    'test@example.com',
    'demo@nexus.com',
    'wallet_test@nexus.com',
    'nexus_test_user@example.com'
  ];

  console.log('🔍 Checking potential wallet user IDs...\n');

  for (const userId of userIds) {
    try {
      console.log(`👤 Checking: ${userId}`);
      const wallet = await sdk.getWallet(userId, 'email');
      
      if (wallet && wallet.addresses) {
        console.log('✅ FOUND WALLET!');
        console.log(`   EVM: ${wallet.addresses.ethereum}`);
        console.log(`   SVM: ${wallet.addresses.solana}`);
        
        // Check if this wallet has balances
        console.log('💳 Checking balances...');
        
        // Check Ethereum
        try {
          const ethResponse = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${wallet.addresses.ethereum}&tag=latest&apikey=YourApiKeyToken`);
          const ethResult = await ethResponse.json();
          
          if (ethResult.status === '1' && ethResult.result) {
            const balanceETH = parseFloat(ethResult.result) / 1000000000000000000;
            console.log(`   ETH Balance: ${balanceETH} ETH`);
            
            if (balanceETH > 0) {
              console.log('   🎉 THIS WALLET HAS ETH! Perfect for testing!');
            }
          }
        } catch (error) {
          console.log(`   ⚠️  ETH balance check failed`);
        }
        
        // Check Solana
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
            console.log(`   SOL Balance: ${balanceSOL} SOL`);
            
            if (balanceSOL > 0) {
              console.log('   🎉 THIS WALLET HAS SOL! Perfect for testing!');
            }
          }
        } catch (error) {
          console.log(`   ⚠️  SOL balance check failed`);
        }
        
        console.log('');
      }
    } catch (error) {
      console.log(`   ❌ No wallet found for: ${userId}`);
    }
  }
  
  console.log('✅ Search complete!');
  console.log('');
  console.log('💡 If no funded wallets were found, you can:');
  console.log('   1. Create a new wallet with the balance test script');
  console.log('   2. Fund it with faucets');
  console.log('   3. Run the balance test again');
}

checkExistingWallets().catch(console.error); 