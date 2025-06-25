#!/usr/bin/env node

/**
 * Check Deployer Address Balance and Visibility
 * 
 * Specifically checking the deployer address: 0x64c914D699744b2E2b4F7A9D436d80855ACd63f5
 */

const DEPLOYER_ADDRESS = '0x64c914D699744b2E2b4F7A9D436d80855ACd63f5';

async function checkDeployerStatus() {
  console.log('🔍 CHECKING DEPLOYER ADDRESS STATUS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Deployer Address: ${DEPLOYER_ADDRESS}`);
  console.log(`🔗 Network: Sepolia Testnet`);
  console.log('');

  // Method 1: Check via Etherscan API
  console.log('📡 METHOD 1: Etherscan API Check');
  console.log('─────────────────────────────────────────────────────');
  
  try {
    const etherscanResponse = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${DEPLOYER_ADDRESS}&tag=latest&apikey=YourApiKeyToken`, {
      method: 'GET',
      headers: {
        'User-Agent': 'NexusSDK-DeployerCheck/1.0'
      }
    });
    
    const etherscanResult = await etherscanResponse.json();
    
    console.log('Raw Etherscan Response:');
    console.log(JSON.stringify(etherscanResult, null, 2));
    console.log('');
    
    if (etherscanResult.status === '1' && etherscanResult.result) {
      const balanceWei = etherscanResult.result;
      const balanceETH = parseFloat(balanceWei) / 1000000000000000000;
      
      console.log(`✅ Etherscan API Success:`);
      console.log(`   Balance (Wei): ${balanceWei}`);
      console.log(`   Balance (ETH): ${balanceETH}`);
      
      if (balanceETH > 0) {
        console.log(`   🎉 FUNDED! Deployer has ${balanceETH} ETH`);
      } else {
        console.log(`   ⚠️  No funds detected via API`);
      }
    } else {
      console.log(`❌ Etherscan API Error:`);
      console.log(`   Status: ${etherscanResult.status}`);
      console.log(`   Message: ${etherscanResult.message || 'Unknown error'}`);
      console.log(`   Result: ${etherscanResult.result}`);
    }
  } catch (error) {
    console.log(`❌ Etherscan API Request Failed: ${error.message}`);
  }
  
  console.log('');

  // Method 2: Check via alternative RPC
  console.log('📡 METHOD 2: Direct RPC Check');
  console.log('─────────────────────────────────────────────────────');
  
  try {
    const rpcResponse = await fetch('https://ethereum-sepolia-rpc.publicnode.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [DEPLOYER_ADDRESS, 'latest'],
        id: 1
      })
    });
    
    const rpcResult = await rpcResponse.json();
    
    console.log('Raw RPC Response:');
    console.log(JSON.stringify(rpcResult, null, 2));
    console.log('');
    
    if (rpcResult.result) {
      const balanceWei = parseInt(rpcResult.result, 16);
      const balanceETH = balanceWei / 1000000000000000000;
      
      console.log(`✅ RPC Success:`);
      console.log(`   Balance (Wei): ${balanceWei}`);
      console.log(`   Balance (ETH): ${balanceETH}`);
      
      if (balanceETH > 0) {
        console.log(`   🎉 FUNDED! Deployer has ${balanceETH} ETH`);
      } else {
        console.log(`   ⚠️  No funds detected via RPC`);
      }
    } else {
      console.log(`❌ RPC Error: ${rpcResult.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`❌ RPC Request Failed: ${error.message}`);
  }
  
  console.log('');

  // Method 3: Check transaction history (if any)
  console.log('📡 METHOD 3: Transaction History Check');
  console.log('─────────────────────────────────────────────────────');
  
  try {
    const txResponse = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=txlist&address=${DEPLOYER_ADDRESS}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=YourApiKeyToken`);
    const txResult = await txResponse.json();
    
    console.log('Transaction History Response:');
    console.log(`Status: ${txResult.status}`);
    console.log(`Message: ${txResult.message}`);
    
    if (txResult.status === '1' && txResult.result && txResult.result.length > 0) {
      console.log(`✅ Found ${txResult.result.length} transaction(s):`);
      
      txResult.result.slice(0, 3).forEach((tx, index) => {
        console.log(`   ${index + 1}. Hash: ${tx.hash}`);
        console.log(`      From: ${tx.from}`);
        console.log(`      To: ${tx.to}`);
        console.log(`      Value: ${parseInt(tx.value) / 1000000000000000000} ETH`);
        console.log(`      Block: ${tx.blockNumber}`);
        console.log(`      Status: ${tx.txreceipt_status === '1' ? 'Success' : 'Failed'}`);
        console.log('');
      });
    } else {
      console.log(`⚠️  No transactions found for this address`);
      console.log(`   This could mean:`);
      console.log(`   • Address hasn't been used yet`);
      console.log(`   • Transactions are still pending`);
      console.log(`   • Address was recently created`);
    }
  } catch (error) {
    console.log(`❌ Transaction history check failed: ${error.message}`);
  }
  
  console.log('');

  // Summary and recommendations
  console.log('📋 SUMMARY & RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🔍 Deployer Address: ${DEPLOYER_ADDRESS}`);
  console.log(`🔗 Explorer Links:`);
  console.log(`   • Etherscan: https://sepolia.etherscan.io/address/${DEPLOYER_ADDRESS}`);
  console.log(`   • Alternative: https://sepolia.otterscan.io/address/${DEPLOYER_ADDRESS}`);
  console.log('');
  
  console.log('🎯 If address is not visible on explorer:');
  console.log('   1. The address might be newly generated and unused');
  console.log('   2. Transactions to it might still be pending');
  console.log('   3. You might need to wait a few minutes for indexing');
  console.log('   4. Try the alternative explorer links above');
  console.log('');
  
  console.log('💡 Next steps:');
  console.log('   • Wait 5-10 minutes after sending funds');
  console.log('   • Check both explorer links');
  console.log('   • If still not visible, we can generate a new deployer address');
  console.log('   • Or proceed with your already funded wallets for testing');
  console.log('');
  
  console.log('✅ DEPLOYER CHECK COMPLETE!');
}

checkDeployerStatus().catch(console.error); 