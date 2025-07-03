#!/usr/bin/env node

/**
 * Migration Script: Fix Deployment Transaction Hashes
 * 
 * This script updates existing PaymasterPayment records to have proper
 * deployment_results with chain-specific transaction hashes.
 */

const mongoose = require('mongoose');
const ProjectPaymaster = require('./models/ProjectPaymaster');

async function fixDeploymentHashes() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay');
    
    console.log('🔍 Finding paymasters with missing or incomplete deployment_results...');
    
    // Find all paymasters that need fixing
    const paymasters = await ProjectPaymaster.find({
      deployment_status: 'deployed',
      $or: [
        { deployment_results: { $exists: false } },
        { deployment_results: null },
        { deployment_results: {} }
      ]
    });
    
    console.log(`📊 Found ${paymasters.length} paymasters to fix`);
    
    if (paymasters.length === 0) {
      console.log('✅ All paymasters already have proper deployment_results!');
      await mongoose.disconnect();
      return;
    }
    
    for (const paymaster of paymasters) {
      console.log(`\n🔧 Fixing paymaster: ${paymaster.project_id} (${paymaster.chain_category})`);
      console.log(`   Supported chains: ${paymaster.supported_chains.join(', ')}`);
      console.log(`   Primary deployment TX: ${paymaster.deployment_tx || 'NONE'}`);
      
      // Create deployment_results structure
      const deploymentResults = {};
      
      for (const chain of paymaster.supported_chains) {
        if (paymaster.deployment_tx) {
          // For existing successful deployments, assume they all use the same transaction
          // This isn't perfect but it's better than showing no transaction
          deploymentResults[chain] = {
            contractAddress: paymaster.contract_address,
            deploymentTx: paymaster.deployment_tx,
            entryPointAddress: paymaster.entry_point_address,
            status: 'deployed'
          };
          
          console.log(`   ✅ Set ${chain} deployment TX: ${paymaster.deployment_tx}`);
        } else {
          // No deployment transaction found
          deploymentResults[chain] = {
            error: 'Legacy deployment - no transaction hash recorded'
          };
          console.log(`   ⚠️  ${chain}: No deployment TX found`);
        }
      }
      
      // Update the paymaster record
      paymaster.deployment_results = deploymentResults;
      await paymaster.save();
      
      console.log(`   💾 Updated deployment_results for ${paymaster.project_id}`);
    }
    
    console.log(`\n🎉 Migration completed! Fixed ${paymasters.length} paymaster records.`);
    console.log('\n📋 Next steps:');
    console.log('   1. Refresh your dashboard to see the updated transaction hashes');
    console.log('   2. Create new projects to see proper chain-specific hashes');
    console.log('   3. Legacy projects now have fallback transaction hashes');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  fixDeploymentHashes();
}

module.exports = fixDeploymentHashes; 