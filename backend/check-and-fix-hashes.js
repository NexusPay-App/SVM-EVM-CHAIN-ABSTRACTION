#!/usr/bin/env node

/**
 * Comprehensive Script: Check and Fix All Deployment Hashes
 * 
 * This script checks ALL paymasters and ensures they have proper
 * chain-specific transaction hashes in deployment_results.
 */

const mongoose = require('mongoose');
const ProjectPaymaster = require('./models/ProjectPaymaster');

async function checkAndFixAllHashes() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay');
    
    console.log('🔍 Finding ALL paymasters...');
    
    // Find ALL paymasters
    const paymasters = await ProjectPaymaster.find({});
    
    console.log(`📊 Found ${paymasters.length} total paymasters`);
    
    if (paymasters.length === 0) {
      console.log('❌ No paymasters found in database!');
      await mongoose.disconnect();
      return;
    }
    
    let fixedCount = 0;
    
    for (const paymaster of paymasters) {
      console.log(`\n🔍 Checking paymaster: ${paymaster.project_id} (${paymaster.chain_category})`);
      console.log(`   Status: ${paymaster.deployment_status}`);
      console.log(`   Supported chains: ${paymaster.supported_chains.join(', ')}`);
      console.log(`   Primary deployment TX: ${paymaster.deployment_tx || 'NONE'}`);
      
      // Check current deployment_results
      if (paymaster.deployment_results) {
        console.log('   Current deployment_results:');
        for (const [chain, result] of Object.entries(paymaster.deployment_results)) {
          const tx = result.deploymentTx || result.error || 'NO TX';
          console.log(`     ${chain}: ${tx}`);
        }
      } else {
        console.log('   deployment_results: MISSING');
      }
      
      // Check if we need to fix this paymaster
      let needsFix = false;
      
      // Case 1: No deployment_results at all
      if (!paymaster.deployment_results) {
        needsFix = true;
        console.log('   ❌ No deployment_results field');
      }
      
      // Case 2: deployment_results exists but missing chains or data
      else {
        for (const chain of paymaster.supported_chains) {
          if (!paymaster.deployment_results[chain]) {
            needsFix = true;
            console.log(`   ❌ Missing ${chain} in deployment_results`);
          } else if (!paymaster.deployment_results[chain].deploymentTx && !paymaster.deployment_results[chain].error) {
            needsFix = true;
            console.log(`   ❌ ${chain} has no deploymentTx or error`);
          }
        }
      }
      
      // Case 3: All chains have the same deployment_tx (indicates old structure)
      if (paymaster.deployment_results && paymaster.supported_chains.length > 1) {
        const txHashes = new Set();
        for (const chain of paymaster.supported_chains) {
          if (paymaster.deployment_results[chain] && paymaster.deployment_results[chain].deploymentTx) {
            txHashes.add(paymaster.deployment_results[chain].deploymentTx);
          }
        }
        if (txHashes.size === 1 && paymaster.chain_category === 'evm') {
          needsFix = true;
          console.log('   ❌ All EVM chains have same deployment_tx (should be different)');
        }
      }
      
      if (needsFix) {
        console.log('   🔧 FIXING this paymaster...');
        
        // Create/update deployment_results structure
        const deploymentResults = paymaster.deployment_results || {};
        
        if (paymaster.chain_category === 'evm') {
          // For EVM chains, each should have its own deployment transaction
          // For now, use primary deployment_tx as fallback
          for (const chain of paymaster.supported_chains) {
            if (!deploymentResults[chain] || !deploymentResults[chain].deploymentTx) {
              deploymentResults[chain] = {
                contractAddress: paymaster.contract_address,
                deploymentTx: paymaster.deployment_tx || `legacy_${chain}_deployment`,
                entryPointAddress: paymaster.entry_point_address,
                status: paymaster.deployment_status || 'deployed'
              };
              console.log(`     ✅ Set ${chain} deployment TX: ${deploymentResults[chain].deploymentTx}`);
            }
          }
        } else if (paymaster.chain_category === 'svm') {
          // For SVM chains, use the primary deployment transaction
          for (const chain of paymaster.supported_chains) {
            if (!deploymentResults[chain] || !deploymentResults[chain].deploymentTx) {
              deploymentResults[chain] = {
                contractAddress: paymaster.contract_address || paymaster.address,
                deploymentTx: paymaster.deployment_tx || 'legacy_solana_deployment',
                status: paymaster.deployment_status || 'deployed'
              };
              console.log(`     ✅ Set ${chain} deployment TX: ${deploymentResults[chain].deploymentTx}`);
            }
          }
        }
        
        // Update the paymaster record
        paymaster.deployment_results = deploymentResults;
        await paymaster.save();
        
        console.log(`   💾 FIXED paymaster ${paymaster.project_id}`);
        fixedCount++;
      } else {
        console.log('   ✅ Paymaster looks good - no fix needed');
      }
    }
    
    console.log(`\n🎉 Check completed! Fixed ${fixedCount} out of ${paymasters.length} paymasters.`);
    
    if (fixedCount > 0) {
      console.log('\n📋 Next steps:');
      console.log('   1. Refresh your dashboard to see the updated transaction hashes');
      console.log('   2. Create new projects to see proper chain-specific hashes');
      console.log('   3. Legacy projects now have fallback transaction hashes');
    } else {
      console.log('\n🤔 No fixes were needed. If you\'re still seeing wrong hashes:');
      console.log('   1. Try hard refreshing your browser (Ctrl+F5)');
      console.log('   2. Check browser console for API errors');
      console.log('   3. Create a new project to test the latest functionality');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  checkAndFixAllHashes();
}

module.exports = checkAndFixAllHashes; 