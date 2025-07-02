require('dotenv').config();
const { ethers } = require('ethers');
const PaymasterPayment = require('./models/PaymasterPayment');
const mongoose = require('mongoose');

async function monitorDeployerWallets() {
  const evmDeployerKey = process.env.EVM_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY; // Backward compatibility
  const svmDeployerKey = process.env.SVM_DEPLOYER_PRIVATE_KEY;
  
  if (!evmDeployerKey && !svmDeployerKey) {
    console.log('❌ No deployer wallets configured');
    console.log('📋 Run the following to set up deployer wallets:');
    console.log('   node setup-company-deployers.js');
    return;
  }

  try {
    // Connect to MongoDB for deployment statistics
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexuspay');
    
    console.log('🏢 NexusPay Company Deployer Wallets Monitor');
    console.log('==========================================\n');
    
    let totalUsdValue = 0;
    let ethBalance = 0; // Initialize ethBalance for later use
    let evmWalletAddress = null;
    
    // Monitor EVM Deployer
    if (evmDeployerKey) {
      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const wallet = new ethers.Wallet(evmDeployerKey, provider);
      const balance = await provider.getBalance(wallet.address);
      ethBalance = parseFloat(ethers.formatEther(balance));
      evmWalletAddress = wallet.address;
      const usdValue = ethBalance * 2500; // Rough ETH price
      totalUsdValue += usdValue;
      
      console.log('🔷 EVM Deployer (Ethereum, Arbitrum, Polygon, BSC):');
      console.log(`   Address: ${wallet.address}`);
      console.log(`   Balance: ${ethBalance.toFixed(6)} ETH`);
      console.log(`   USD Value: ~$${usdValue.toFixed(2)}`);
      console.log(`   Block Explorer: https://sepolia.etherscan.io/address/${wallet.address}\n`);
    }
    
    // Monitor SVM Deployer
    if (svmDeployerKey) {
      try {
        const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
        const bs58 = require('bs58');
        
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const keypair = Keypair.fromSecretKey(bs58.decode(svmDeployerKey));
        const balance = await connection.getBalance(keypair.publicKey);
        const solBalance = balance / 1e9; // Convert lamports to SOL
        const usdValue = solBalance * 100; // Rough SOL price
        totalUsdValue += usdValue;
        
        console.log('🟣 SVM Deployer (Solana, Eclipse):');
        console.log(`   Address: ${keypair.publicKey.toString()}`);
        console.log(`   Balance: ${solBalance.toFixed(6)} SOL`);
        console.log(`   USD Value: ~$${usdValue.toFixed(2)}`);
        console.log(`   Block Explorer: https://explorer.solana.com/address/${keypair.publicKey.toString()}?cluster=devnet\n`);
      } catch (svmError) {
        console.log('🟣 SVM Deployer: ❌ Could not check balance');
        console.log(`   Error: ${svmError.message}\n`);
      }
    }
    
    console.log('💰 Combined Portfolio:');
    console.log(`   Total USD Value: ~$${totalUsdValue.toFixed(2)}\n`);
    
    // Calculate deployment capacity (only if EVM deployer is configured)  
    if (ethBalance > 0) {
      const deploymentCost = 0.15; // ETH per deployment
      const remainingDeployments = Math.floor(ethBalance / deploymentCost);
      
      console.log('🚀 Deployment Capacity:');
      console.log(`   Cost per deployment: ${deploymentCost} ETH`);
      console.log(`   Remaining deployments: ${remainingDeployments}`);
      console.log(`   Days remaining: ~${Math.floor(remainingDeployments / 10)} (at 10 deployments/day)\n`);
    }
    
    // Get recent deployment statistics
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPayments = await PaymasterPayment.find({
      operation_type: 'wallet_deploy',
      createdAt: { $gte: last30Days }
    }).sort({ createdAt: -1 });
    
    console.log('📊 Recent Deployment Stats (Last 30 Days):');
    console.log(`   Total deployments: ${recentPayments.length}`);
    
    if (recentPayments.length > 0) {
      const totalCost = recentPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const avgCost = totalCost / recentPayments.length;
      
      console.log(`   Total cost: ${totalCost.toFixed(6)} ETH`);
      console.log(`   Average cost: ${avgCost.toFixed(6)} ETH per deployment`);
      console.log(`   Daily average: ${(recentPayments.length / 30).toFixed(1)} deployments/day\n`);
    } else {
      console.log('   No recent deployments found\n');
    }
    
    // Balance status and alerts
    console.log('🚨 Status & Alerts:');
    if (ethBalance === 0) {
      console.log('   ℹ️  No EVM deployer configured');
    } else if (ethBalance < 0.01) {
      console.log('   🚨 CRITICAL: Deployer wallet is almost empty!');
      console.log('   ⚡ Action Required: Fund immediately to avoid deployment failures');
    } else if (ethBalance < 0.05) {
      console.log('   ⚠️  WARNING: Deployer wallet is getting low');
      console.log('   💡 Recommended: Add funds in the next few days');
    } else if (ethBalance < 0.1) {
      console.log('   ⚠️  CAUTION: Monitor balance more frequently');
    } else {
      console.log('   ✅ Balance is healthy');
    }
    
    console.log('\n💡 Funding Instructions:');
    console.log('========================');
    console.log('1. Get Sepolia ETH from: https://sepoliafaucet.com');
    if (evmWalletAddress) {
      console.log(`2. Send ETH to: ${evmWalletAddress}`);
    }
    console.log('3. Recommended funding: 0.2-0.5 ETH for sustained operations');
    
    console.log('\n📈 Cost Analysis:');
    console.log('=================');
    const deploymentCost = 0.15; // ETH per deployment
    console.log(`• Customer acquisition cost: ~$${(deploymentCost * 2500).toFixed(2)} per developer`);
    console.log('• Zero friction onboarding for developers');
    console.log('• Developers fund ongoing operations themselves');
    console.log('• Excellent business model: Pay for acquisition, developers sustain operations');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Failed to monitor deployer wallet:', error);
  }
}

monitorDeployerWallets(); 