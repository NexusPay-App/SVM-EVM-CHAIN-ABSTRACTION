/**
 * 🔥 NexusPay Project-Based Paymaster Usage Guide
 * 
 * This guide shows you EXACTLY how to control who pays gas fees:
 * - usePaymaster: true  = YOUR PROJECT PAYS (great for UX)
 * - usePaymaster: false = USER PAYS (traditional model)
 */

const { NexusSDK } = require('../src/index');

// Initialize SDK with your project API key
const nexus = new NexusSDK({
  apiKey: 'npay_proj_yourprojectid_api_yourapikey', // Your actual API key
  environment: 'production' // or 'development'
});

/**
 * 🎮 GAMING USE CASE: Sponsor ALL user transactions for better UX
 */
async function gamingAppExample() {
  console.log('🎮 Gaming App: Sponsoring ALL user transactions\n');

  try {
    // Player moves an NFT character
    await nexus.executeTransaction({
      chain: 'polygon',
      userWalletAddress: '0x123...', // Player's wallet
      transaction: {
        to: '0xGameContract',
        data: '0x...' // Move character function call
      },
      usePaymaster: true // 🔑 GAME PAYS GAS = Smooth UX!
    });

    // Player claims reward tokens  
    await nexus.executeTransaction({
      chain: 'polygon',
      userWalletAddress: '0x123...',
      transaction: {
        to: '0xRewardContract',
        data: '0x...' // Claim rewards function
      },
      usePaymaster: true // 🔑 GAME PAYS GAS = Player doesn't need tokens!
    });

    console.log('✅ All game actions completed - players never paid gas!');

  } catch (error) {
    console.error('Game transaction failed:', error);
  }
}

/**
 * 💰 DEFI USE CASE: Users pay their own gas (traditional model)
 */
async function defiAppExample() {
  console.log('💰 DeFi App: Users pay their own gas\n');

  try {
    // User swaps tokens on DEX
    await nexus.executeTransaction({
      chain: 'ethereum',
      userWalletAddress: '0x456...',
      transaction: {
        to: '0xUniswapRouter',
        data: '0x...' // Swap function call
      },
      usePaymaster: false // 🔑 USER PAYS GAS = Standard DeFi model
    });

    // User provides liquidity
    await nexus.executeTransaction({
      chain: 'ethereum',
      userWalletAddress: '0x456...',
      transaction: {
        to: '0xLiquidityPool',
        data: '0x...' // Add liquidity function
      },
      usePaymaster: false // 🔑 USER PAYS GAS = User controls their costs
    });

    console.log('✅ DeFi operations prepared - user will pay gas fees');

  } catch (error) {
    console.error('DeFi transaction failed:', error);
  }
}

/**
 * 🏢 ENTERPRISE USE CASE: Mixed model based on transaction type
 */
async function enterpriseAppExample() {
  console.log('🏢 Enterprise App: Smart paymaster usage\n');

  try {
    // Onboarding flow - company sponsors for better conversion
    await nexus.executeTransaction({
      chain: 'ethereum',
      userWalletAddress: '0x789...',
      transaction: {
        to: '0xOnboardingContract',
        data: '0x...' // Setup user profile
      },
      usePaymaster: true // 🔑 COMPANY PAYS = Smooth onboarding
    });

    // Regular operations - users pay their own gas
    await nexus.executeTransaction({
      chain: 'ethereum', 
      userWalletAddress: '0x789...',
      transaction: {
        to: '0xBusinessContract',
        value: '1000000000000000000' // 1 ETH business transaction
      },
      usePaymaster: false // 🔑 USER PAYS = Business transactions user-funded
    });

    // Emergency/support transactions - company sponsors
    await nexus.executeTransaction({
      chain: 'ethereum',
      userWalletAddress: '0x789...',
      transaction: {
        to: '0xRecoveryContract',
        data: '0x...' // Account recovery
      },
      usePaymaster: true // 🔑 COMPANY PAYS = Support operation
    });

    console.log('✅ Mixed model: Strategic paymaster usage');

  } catch (error) {
    console.error('Enterprise transaction failed:', error);
  }
}

/**
 * 📱 SOCIAL APP USE CASE: Sponsor social interactions, user pays transfers
 */
async function socialAppExample() {
  console.log('📱 Social App: Sponsor interactions, user pays transfers\n');

  try {
    // Posting content - app sponsors for engagement
    await nexus.executeTransaction({
      chain: 'polygon',
      userWalletAddress: '0xabc...',
      transaction: {
        to: '0xSocialContract',
        data: '0x...' // Post content function
      },
      usePaymaster: true // 🔑 APP PAYS = Encourage user activity
    });

    // Tipping another user - user pays (it's their money)
    await nexus.executeTransaction({
      chain: 'polygon',
      userWalletAddress: '0xabc...',
      transaction: {
        to: '0xdef...', // Recipient
        value: '100000000000000000' // 0.1 MATIC tip
      },
      usePaymaster: false // 🔑 USER PAYS = It's their money being sent
    });

    console.log('✅ Social app: Smart gas sponsorship strategy');

  } catch (error) {
    console.error('Social transaction failed:', error);
  }
}

/**
 * 🔍 UTILITY FUNCTIONS: Check paymaster status and balances
 */
async function paymasterUtilities() {
  console.log('🔍 Paymaster Utilities\n');

  try {
    // Check if your project can sponsor transactions
    const status = await nexus.getProjectPaymasterStatus();
    console.log('Paymaster Status:', status);

    // Check your paymaster balances
    const balances = await nexus.getPaymasterBalances();
    console.log('Paymaster Balances:', balances);

    // Estimate gas cost for a transaction
    const gasEstimate = await nexus.estimateTransactionGas('ethereum', {
      to: '0x123...',
      value: '1000000000000000'
    });
    console.log('Gas Estimate:', gasEstimate);

  } catch (error) {
    console.error('Utility check failed:', error);
  }
}

/**
 * 🎯 DECISION MATRIX: When to use paymaster vs user-paid
 */
function paymasterDecisionGuide() {
  console.log(`
🎯 PAYMASTER DECISION GUIDE

✅ USE PAYMASTER (usePaymaster: true) FOR:
- User onboarding flows 
- Gaming actions & interactions
- Social media posts/likes
- Free app features
- Account recovery/support
- Improving user experience
- Increasing conversion rates

❌ DON'T USE PAYMASTER (usePaymaster: false) FOR:
- Financial transfers (user's money)
- High-value transactions
- DeFi operations
- NFT purchases/sales
- User-initiated valuable actions
- When user should control costs

🧠 SMART STRATEGY:
- Start with paymaster for onboarding
- Switch to user-paid for value transactions
- Monitor costs vs conversion rates
- Adjust based on business model
  `);
}

/**
 * 🚀 React Component Example
 */
function reactComponentExample() {
  return `
// React Component with Paymaster Control
import { NexusSDK } from '@nexuspay/sdk';

function TransactionButton({ 
  type, // 'onboarding', 'transfer', 'game_action', etc.
  transaction,
  userAddress 
}) {
  const nexus = new NexusSDK({ apiKey: process.env.REACT_APP_NEXUS_API_KEY });
  
  // Smart paymaster logic based on transaction type
  const shouldUsePaymaster = (type) => {
    switch(type) {
      case 'onboarding':
      case 'game_action':
      case 'social_post':
        return true;  // Company sponsors these
      
      case 'transfer':
      case 'purchase':
      case 'defi_operation':
        return false; // User pays for these
      
      default:
        return false; // Default to user-paid
    }
  };
  
  const handleClick = async () => {
    const usePaymaster = shouldUsePaymaster(type);
    
    try {
      const result = await nexus.executeTransaction({
        chain: 'ethereum',
        userWalletAddress: userAddress,
        transaction,
        usePaymaster // 🔑 SMART PAYMASTER DECISION
      });
      
      if (usePaymaster) {
        console.log('✅ Transaction completed - sponsored by our app');
      } else {
        console.log('✅ Transaction signed - user paid gas');
      }
      
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };
  
  return (
    <button onClick={handleClick}>
      {type} {shouldUsePaymaster(type) ? '(Free)' : '(User Pays Gas)'}
    </button>
  );
}

// Usage Examples:
// <TransactionButton type="onboarding" transaction={...} userAddress="0x..." />
// <TransactionButton type="transfer" transaction={...} userAddress="0x..." />
// <TransactionButton type="game_action" transaction={...} userAddress="0x..." />
  `;
}

// Run all examples
async function runAllExamples() {
  console.log('🔥 NexusPay Project Paymaster Usage Guide\n');
  console.log('=' .repeat(60) + '\n');
  
  try {
    await nexus.initialize();
    
    await gamingAppExample();
    console.log('\n' + '-'.repeat(60) + '\n');
    
    await defiAppExample();
    console.log('\n' + '-'.repeat(60) + '\n');
    
    await enterpriseAppExample();
    console.log('\n' + '-'.repeat(60) + '\n');
    
    await socialAppExample();
    console.log('\n' + '-'.repeat(60) + '\n');
    
    await paymasterUtilities();
    console.log('\n' + '-'.repeat(60) + '\n');
    
    paymasterDecisionGuide();
    console.log('\n' + '-'.repeat(60) + '\n');
    
    console.log('📝 React Component Example:');
    console.log(reactComponentExample());
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Export for use in other files
module.exports = {
  gamingAppExample,
  defiAppExample,
  enterpriseAppExample,
  socialAppExample,
  paymasterUtilities,
  paymasterDecisionGuide
};

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples();
} 