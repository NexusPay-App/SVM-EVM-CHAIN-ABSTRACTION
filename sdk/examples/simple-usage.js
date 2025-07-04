/**
 * NexusSDK Ultimate Usage Example
 * 
 * This example demonstrates the complete power of the NexusSDK:
 * - ANY social identifier support (not just hardcoded types)
 * - Cross-chain gasless transactions
 * - Token bridging and swapping
 * - Multi-token support
 * - Real-time analytics
 * 
 * THE ULTIMATE CROSS-CHAIN WALLET INFRASTRUCTURE
 */

import { NexusSDK, COMMON_SOCIAL_TYPES } from '@nexusplatform/sdk';

// Initialize SDK with ultimate flexibility
const sdk = new NexusSDK({
  apiKey: 'npay_proj_your_project_id_random_string_here',
  enableBridging: true,  // Enable cross-chain bridging
  enableGasless: true,   // Enable gasless transactions (default)
  timeout: 30000,        // 30 second timeout
});

async function demonstrateUltimateFeatures() {
  console.log('🚀 NexusSDK Ultimate Features Demo');
  console.log('===================================');

  try {
    // 1. FLEXIBLE SOCIAL TYPES - Support ANY identifier
    console.log('\n1. 📱 Creating wallets with ANY social identifier...');
    
    // Traditional social platforms
    const emailWallet = await sdk.createWallet({
      socialId: 'user@example.com',
      socialType: COMMON_SOCIAL_TYPES.EMAIL,
      chains: ['ethereum', 'arbitrum', 'solana'],
      enableGasless: true,
    });
    
    const twitterWallet = await sdk.createWallet({
      socialId: '@crypto_user',
      socialType: COMMON_SOCIAL_TYPES.TWITTER,
      chains: ['ethereum', 'solana'],
      enableGasless: true,
    });
    
    // Gaming identifiers
    const gameWallet = await sdk.createWallet({
      socialId: 'player123',
      socialType: COMMON_SOCIAL_TYPES.GAME_ID,
      chains: ['ethereum', 'arbitrum'],
      enableGasless: true,
    });
    
    // Enterprise identifiers
    const enterpriseWallet = await sdk.createWallet({
      socialId: 'EMP001',
      socialType: COMMON_SOCIAL_TYPES.EMPLOYEE_ID,
      chains: ['ethereum'],
      enableGasless: true,
    });
    
    // Web3 identifiers
    const ensWallet = await sdk.createWallet({
      socialId: 'vitalik.eth',
      socialType: COMMON_SOCIAL_TYPES.ENS,
      chains: ['ethereum', 'arbitrum'],
      enableGasless: true,
    });
    
    // Custom business logic identifiers
    const customWallet = await sdk.createWallet({
      socialId: 'nft_holder_coolcats_1234',
      socialType: 'nftHolder', // ANY custom type!
      chains: ['ethereum'],
      enableGasless: true,
    });
    
    console.log('✅ Created wallets with diverse social identifiers:');
    console.log(`   📧 Email: ${emailWallet.addresses.ethereum}`);
    console.log(`   🐦 Twitter: ${twitterWallet.addresses.ethereum}`);
    console.log(`   🎮 Game: ${gameWallet.addresses.ethereum}`);
    console.log(`   🏢 Enterprise: ${enterpriseWallet.addresses.ethereum}`);
    console.log(`   🌐 ENS: ${ensWallet.addresses.ethereum}`);
    console.log(`   🎨 Custom NFT: ${customWallet.addresses.ethereum}`);

    // 2. MULTI-TOKEN SUPPORT
    console.log('\n2. 🪙 Multi-token operations...');
    
    // Get token lists for different chains
    const ethereumTokens = await sdk.getTokenList('ethereum');
    const arbitrumTokens = await sdk.getTokenList('arbitrum');
    const solanaTokens = await sdk.getTokenList('solana');
    
    console.log(`✅ Found ${ethereumTokens.length} tokens on Ethereum`);
    console.log(`✅ Found ${arbitrumTokens.length} tokens on Arbitrum`);
    console.log(`✅ Found ${solanaTokens.length} tokens on Solana`);
    
    // Search for specific tokens
    const usdcTokens = await sdk.searchTokens('USDC');
    console.log(`✅ Found USDC on ${usdcTokens.length} chains`);
    
    // Get wallet balances across all chains
    const walletBalances = await sdk.getWalletBalances(emailWallet.id);
    console.log('✅ Wallet balances across all chains:');
    for (const [chain, balance] of Object.entries(walletBalances)) {
      console.log(`   ${chain}: $${balance.total_usd} (${balance.tokens.length} tokens)`);
    }

    // 3. GASLESS TRANSACTIONS (Default enabled)
    console.log('\n3. ⚡ Gasless transactions...');
    
    // Native token transfer (gasless)
    const nativeTransfer = await sdk.executeTransaction({
      chain: 'ethereum',
      userWalletAddress: emailWallet.addresses.ethereum,
      transaction: {
        to: twitterWallet.addresses.ethereum,
        value: '100000000000000000', // 0.1 ETH
      },
      usePaymaster: true, // Gasless (default)
    });
    
    console.log(`✅ Gasless native transfer: ${nativeTransfer.transactionHash}`);
    console.log(`   Gas saved: $${nativeTransfer.gasCost} (covered by paymaster)`);
    
    // Token transfer (gasless)
    const tokenTransfer = await sdk.transferTokens({
      chain: 'ethereum',
      fromAddress: emailWallet.addresses.ethereum,
      toAddress: gameWallet.addresses.ethereum,
      token: '0xA0b86a33E6417c99C5e49c84be1b2C9D0a6c5e3f', // USDC
      amount: '10000000', // 10 USDC
      usePaymaster: true, // Gasless
    });
    
    console.log(`✅ Gasless token transfer: ${tokenTransfer.transactionHash}`);
    
    // 4. CROSS-CHAIN BRIDGING
    console.log('\n4. 🌉 Cross-chain bridging...');
    
    // Bridge tokens from Ethereum to Arbitrum
    const bridgeResult = await sdk.bridgeTokens({
      fromChain: 'ethereum',
      toChain: 'arbitrum',
      token: 'native', // ETH
      amount: '50000000000000000', // 0.05 ETH
      fromAddress: emailWallet.addresses.ethereum,
      toAddress: emailWallet.addresses.arbitrum,
      usePaymaster: true, // Gasless bridging!
    });
    
    console.log(`✅ Bridge initiated: ${bridgeResult.bridgeId}`);
    console.log(`   From: ${bridgeResult.fromTx.transactionHash}`);
    console.log(`   Estimated time: ${bridgeResult.estimatedTime}s`);
    
    // Monitor bridge status
    const bridgeStatus = await sdk.getBridgeStatus(bridgeResult.bridgeId);
    console.log(`   Status: ${bridgeStatus.status} (${bridgeStatus.progress}%)`);
    
    // 5. TOKEN SWAPPING
    console.log('\n5. 🔄 Token swapping...');
    
    // Swap ETH for USDC on Ethereum
    const swapResult = await sdk.swapTokens({
      chain: 'ethereum',
      userAddress: emailWallet.addresses.ethereum,
      fromToken: 'native', // ETH
      toToken: '0xA0b86a33E6417c99C5e49c84be1b2C9D0a6c5e3f', // USDC
      amount: '100000000000000000', // 0.1 ETH
      slippage: 1.0, // 1% slippage
      usePaymaster: true, // Gasless swap!
    });
    
    console.log(`✅ Gasless swap completed: ${swapResult.transactionHash}`);
    console.log(`   Rate: 1 ETH = ${swapResult.exchangeRate} USDC`);
    console.log(`   Received: ${swapResult.toAmount} USDC`);
    
    // 6. ANALYTICS & MONITORING
    console.log('\n6. 📊 Analytics & monitoring...');
    
    // Get comprehensive analytics
    const analytics = await sdk.getAnalytics(30); // Last 30 days
    console.log('✅ Project analytics:');
    console.log(`   Total wallets created: ${analytics.total_wallets}`);
    console.log(`   Total transactions: ${analytics.total_transactions}`);
    console.log(`   Gas spent: $${analytics.total_gas_spent_usd}`);
    console.log(`   Gas saved: $${analytics.total_gas_saved_usd}`);
    console.log(`   Bridge volume: $${analytics.bridge_volume_usd}`);
    console.log(`   Swap volume: $${analytics.swap_volume_usd}`);
    console.log(`   Paymaster efficiency: ${analytics.paymaster_coverage_pct}%`);
    
    // Social type breakdown
    console.log('\n   Social type usage:');
    for (const [socialType, stats] of Object.entries(analytics.social_types)) {
      console.log(`     ${socialType}: ${stats.wallets_created} wallets, ${stats.transactions} txns`);
    }
    
    // Chain breakdown
    console.log('\n   Chain usage:');
    for (const [chain, stats] of Object.entries(analytics.chains)) {
      console.log(`     ${chain}: ${stats.transactions} txns, $${stats.gas_saved_usd} saved`);
    }
    
    // 7. PAYMASTER MONITORING
    console.log('\n7. 💰 Paymaster monitoring...');
    
    const paymasterBalances = await sdk.getPaymasterBalance();
    console.log('✅ Paymaster balances:');
    for (const balance of paymasterBalances) {
      console.log(`   ${balance.chain}: $${balance.usd_value} (${balance.estimated_transactions_remaining} txns remaining)`);
      if (balance.is_low_balance) {
        console.log(`     ⚠️  Low balance on ${balance.chain}!`);
      }
    }
    
    // Get funding addresses
    const fundingAddresses = await sdk.getPaymasterAddresses();
    console.log('\n✅ Paymaster funding addresses:');
    for (const [chain, address] of Object.entries(fundingAddresses.addresses)) {
      console.log(`   ${chain}: ${address}`);
    }
    
    // 8. HEALTH CHECK
    console.log('\n8. 🏥 System health check...');
    
    const health = await sdk.healthCheck();
    console.log(`✅ System status: ${health.status}`);
    console.log('   Chain status:');
    for (const [chain, status] of Object.entries(health.chains)) {
      console.log(`     ${chain}: ${status}`);
    }
    
    // 9. DEVELOPER UTILITIES
    console.log('\n9. 🛠️ Developer utilities...');
    
    console.log(`✅ Project ID: ${sdk.getProjectId()}`);
    console.log(`✅ Bridging enabled: ${sdk.isBridgingEnabled()}`);
    console.log(`✅ Gasless enabled: ${sdk.isGaslessEnabled()}`);
    
    const supportedChains = await sdk.getSupportedChains();
    console.log(`✅ Supported chains: ${supportedChains.join(', ')}`);
    
    console.log('\n🎉 Ultimate NexusSDK demo completed!');
    console.log('===================================');
    console.log('🚀 You now have the most powerful cross-chain wallet infrastructure!');
    console.log('💡 Key features demonstrated:');
    console.log('   ✨ ANY social identifier support');
    console.log('   ⚡ Universal gasless transactions');
    console.log('   🌉 Cross-chain bridging');
    console.log('   🔄 Token swapping');
    console.log('   📊 Comprehensive analytics');
    console.log('   💰 Paymaster monitoring');
    console.log('   🏥 System health checks');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.retryable) {
      console.log('🔄 This error is retryable - you can try again');
    }
  }
}

// React Example (commented out)
/*
// import React from 'react';
// import { NexusProvider, WalletConnect, useNexus } from '@nexusplatform/sdk/react';

// function App() {
//   return (
//     <NexusProvider 
//       config={{
//         apiKey: 'npay_proj_your_project_id_random_string_here',
//         enableBridging: true,
//         enableGasless: true,
//       }}
//     >
//       <MyDApp />
//     </NexusProvider>
//   );
// }

// function MyDApp() {
//   const { 
//     createWallet, 
//     bridgeTokens, 
//     swapTokens, 
//     getAnalytics,
//     isLoading,
//     error 
//   } = useNexus();

//   return (
//     <div>
//       <h1>Ultimate Cross-Chain DApp</h1>
//       
//       <WalletConnect
//         onWalletCreated={(wallet) => console.log('Wallet created:', wallet)}
//         onError={(error) => console.error('Error:', error)}
//         chains={['ethereum', 'arbitrum', 'solana']}
//         allowedSocialTypes={[
//           'email', 'twitter', 'discord', 'gameId', 'employeeId', 
//           'nftHolder', 'daoMember', 'customType'
//         ]}
//         customSocialTypes={[
//           { type: 'nftHolder', label: 'NFT Holder', placeholder: 'Enter NFT collection' },
//           { type: 'daoMember', label: 'DAO Member', placeholder: 'Enter DAO name' }
//         ]}
//         theme="auto"
//       />
//       
//       <div>
//         <button onClick={() => bridgeTokens({})}>
//           🌉 Bridge Tokens
//         </button>
//         <button onClick={() => swapTokens({})}>
//           🔄 Swap Tokens
//         </button>
//         <button onClick={() => getAnalytics()}>
//           📊 View Analytics
//         </button>
//       </div>
//       
//       {isLoading && <div>Loading...</div>}
//       {error && <div>Error: {error.message}</div>}
//     </div>
//   );
// }
*/

// Run the demo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { demonstrateUltimateFeatures };
} else {
  // Browser environment
  demonstrateUltimateFeatures();
} 