#!/usr/bin/env node

/**
 * Check Funding Addresses
 * 
 * This script checks which deployer addresses are used for funding transactions
 * and shows their current balances so you know where to send faucet funds.
 */

async function checkFundingAddresses() {
  console.log('🔍 CHECKING DEPLOYER/FUNDING ADDRESSES');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  try {
    // Check with the backend API to get funding instructions
    const apiUrl = 'https://backend-amber-zeta-94.vercel.app';
    
    console.log('📡 Fetching deployer funding information from backend...');
    
    const response = await fetch(`${apiUrl}/api/deployer/funding`, {
      method: 'GET',
      headers: {
        'x-api-key': 'local-dev-key',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Backend Response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // If there's a deployer address, check its balance
    if (result.data && result.data.deployerAddress) {
      console.log('💳 ETHEREUM DEPLOYER FUNDING INFO:');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`📍 Deployer Address: ${result.data.deployerAddress}`);
      console.log(`🔗 Network: Sepolia Testnet`);
      console.log(`💰 Funding URL: ${result.data.fundingUrl || 'https://sepoliafaucet.com/'}`);
      
      // Check balance
      try {
        const ethResponse = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${result.data.deployerAddress}&tag=latest&apikey=YourApiKeyToken`);
        const ethResult = await ethResponse.json();
        
        if (ethResult.status === '1' && ethResult.result) {
          const balanceETH = parseFloat(ethResult.result) / 1000000000000000000;
          console.log(`💎 Current Balance: ${balanceETH} ETH`);
          
          if (balanceETH > 0.01) {
            console.log('✅ FUNDED! This deployer can deploy wallets');
          } else {
            console.log('❌ NEEDS FUNDING! Send at least 0.1 ETH for deployment gas');
          }
        } else {
          console.log('⚠️  Balance check failed - check manually');
        }
      } catch (error) {
        console.log(`⚠️  Balance check error: ${error.message}`);
      }
      
      console.log(`🔍 Explorer: https://sepolia.etherscan.io/address/${result.data.deployerAddress}`);
      console.log('');
    }

    // Check if there are specific environment variables or private keys mentioned
    if (result.data && result.data.envCommand) {
      console.log('🔧 ENVIRONMENT SETUP:');
      console.log('═══════════════════════════════════════════════════════');
      console.log('To enable actual deployments, set this environment variable:');
      console.log(`${result.data.envCommand}`);
      console.log('');
    }

  } catch (error) {
    console.log(`❌ Could not fetch from backend: ${error.message}`);
    console.log('');
    console.log('🔧 MANUAL CHECK APPROACH:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('The backend uses these patterns for deployer addresses:');
    console.log('');
    console.log('1. 📊 ETHEREUM DEPLOYERS:');
    console.log('   • Environment: DEPLOYER_PRIVATE_KEY');
    console.log('   • Environment: PRIMARY_DEPLOYER_KEY');  
    console.log('   • Environment: SECONDARY_DEPLOYER_KEY');
    console.log('   • Network: Sepolia Testnet');
    console.log('   • Faucet: https://sepoliafaucet.com/');
    console.log('');
    console.log('2. 🔗 SOLANA DEPLOYERS:');
    console.log('   • Environment: SOLANA_DEPLOYER_PRIVATE_KEY');
    console.log('   • Network: Devnet');
    console.log('   • Faucet: https://faucet.solana.com/');
    console.log('');
  }

  // Also show our test wallet addresses for reference
  console.log('📋 YOUR TEST WALLET ADDRESSES (already funded):');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔗 Ethereum Wallet:');
  console.log('   Address: 0x964AAaD2d33B328780B5b93c64FD85617238088a');
  console.log('   Explorer: https://sepolia.etherscan.io/address/0x964AAaD2d33B328780B5b93c64FD85617238088a');
  console.log('   Status: Your funded test wallet (can send from here)');
  console.log('');
  console.log('🔗 Solana Wallet:');
  console.log('   Address: 7acKJVBa1j5Y7gujkDC58QzMuTNvprrDYJ94VsxmFK8o');
  console.log('   Explorer: https://explorer.solana.com/address/7acKJVBa1j5Y7gujkDC58QzMuTNvprrDYJ94VsxmFK8o?cluster=devnet');
  console.log('   Status: Your funded test wallet (5.001 SOL available)');
  console.log('');
  
  console.log('💡 FUNDING STRATEGY:');
  console.log('═══════════════════════════════════════════════════════');
  console.log('For testing send/receive transactions:');
  console.log('');
  console.log('✅ Option A (Recommended): Use your already funded wallets');
  console.log('   • Ethereum: 0x964AAaD2d33B328780B5b93c64FD85617238088a');
  console.log('   • Solana: 7acKJVBa1j5Y7gujkDC58QzMuTNvprrDYJ94VsxmFK8o');
  console.log('   • These can send funds to other addresses');
  console.log('');
  console.log('⚙️  Option B: Fund the backend deployers');
  console.log('   • Get deployer addresses from the API above');
  console.log('   • Add faucet funds to those addresses');
  console.log('   • This enables creating NEW wallets with funds');
  console.log('');
  
  console.log('✅ FUNDING CHECK COMPLETE!');
}

checkFundingAddresses().catch(console.error); 