const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const NETWORKS = [
  { name: 'sepolia', display: '🔷 Ethereum Sepolia', chainId: 11155111 },
  { name: 'arbitrumSepolia', display: '🔴 Arbitrum Sepolia', chainId: 421614 },
  { name: 'baseSepolia', display: '🔵 Base Sepolia', chainId: 84532 },
  { name: 'polygonMumbai', display: '🟣 Polygon Mumbai', chainId: 80001 }
];

async function deployToNetwork(network) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Starting deployment to ${network.display}...`);
    console.log('─'.repeat(60));
    
    const command = `./node_modules/.bin/hardhat run scripts/deploy.js --network ${network.name}`;
    const startTime = Date.now();
    
    exec(command, (error, stdout, stderr) => {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      
      if (error) {
        console.error(`❌ Deployment to ${network.display} failed:`);
        console.error(stderr);
        reject({ network, error: error.message, duration });
      } else {
        console.log(stdout);
        console.log(`✅ ${network.display} deployment completed in ${duration}s`);
        resolve({ network, success: true, duration, output: stdout });
      }
    });
  });
}

async function main() {
  console.log('🌟 NexusDeFi Multi-Chain Deployment Starting...\n');
  console.log('📋 Target Networks:');
  NETWORKS.forEach(network => {
    console.log(`   ${network.display} (Chain ID: ${network.chainId})`);
  });
  console.log('\n' + '='.repeat(80) + '\n');

  const results = [];
  const startTime = Date.now();

  // Deploy to each network sequentially
  for (const network of NETWORKS) {
    try {
      const result = await deployToNetwork(network);
      results.push(result);
    } catch (error) {
      results.push(error);
      console.log(`\n⚠️  Continuing with remaining networks despite ${network.display} failure...\n`);
    }
  }

  const endTime = Date.now();
  const totalDuration = ((endTime - startTime) / 1000 / 60).toFixed(2); // in minutes

  // Generate summary
  console.log('\n' + '='.repeat(80));
  console.log('🎯 MULTI-CHAIN DEPLOYMENT SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n📊 Results: ${successful.length}/${NETWORKS.length} networks deployed successfully`);
  console.log(`⏱️  Total time: ${totalDuration} minutes\n`);

  // Successful deployments
  if (successful.length > 0) {
    console.log('✅ SUCCESSFUL DEPLOYMENTS:');
    console.log('┌─────────────────────┬──────────────┬─────────────────┐');
    console.log('│ Network             │ Duration (s) │ Status          │');
    console.log('├─────────────────────┼──────────────┼─────────────────┤');
    successful.forEach(result => {
      const networkName = result.network.display.padEnd(19);
      const duration = result.duration.toString().padEnd(12);
      console.log(`│ ${networkName} │ ${duration} │ ✅ Success      │`);
    });
    console.log('└─────────────────────┴──────────────┴─────────────────┘\n');
  }

  // Failed deployments
  if (failed.length > 0) {
    console.log('❌ FAILED DEPLOYMENTS:');
    console.log('┌─────────────────────┬──────────────┬─────────────────┐');
    console.log('│ Network             │ Duration (s) │ Status          │');
    console.log('├─────────────────────┼──────────────┼─────────────────┤');
    failed.forEach(result => {
      const networkName = result.network.display.padEnd(19);
      const duration = (result.duration || 'N/A').toString().padEnd(12);
      console.log(`│ ${networkName} │ ${duration} │ ❌ Failed       │`);
    });
    console.log('└─────────────────────┴──────────────┴─────────────────┘\n');

    console.log('🔍 Failure Details:');
    failed.forEach(result => {
      console.log(`\n${result.network.display}:`);
      console.log(`   Error: ${result.error}`);
    });
    console.log('');
  }

  // Collect and display all contract addresses
  if (fs.existsSync('deployments')) {
    const deploymentFiles = fs.readdirSync('deployments').filter(f => f.endsWith('.json'));
    
    if (deploymentFiles.length > 0) {
      console.log('📋 CONTRACT ADDRESSES ACROSS ALL NETWORKS:');
      console.log('');
      
      const contractAddresses = {};
      
      deploymentFiles.forEach(file => {
        try {
          const deployment = JSON.parse(fs.readFileSync(path.join('deployments', file), 'utf8'));
          const networkName = file.replace('.json', '');
          contractAddresses[networkName] = deployment.contracts;
        } catch (error) {
          console.log(`⚠️  Could not read deployment file: ${file}`);
        }
      });

      // Display in a nice table format
      Object.keys(contractAddresses).forEach(network => {
        const networkInfo = NETWORKS.find(n => 
          network.includes(n.name) || network.includes(n.chainId.toString())
        );
        
        const displayName = networkInfo ? networkInfo.display : network;
        console.log(`${displayName}:`);
        console.log('├─ EntryPoint:     ', contractAddresses[network].entryPoint);
        console.log('├─ WalletFactory:  ', contractAddresses[network].walletFactory);
        console.log('├─ Paymaster:      ', contractAddresses[network].paymaster);
        console.log('└─ Test Wallet:    ', contractAddresses[network].testWallet);
        console.log('');
      });
    }
  }

  // Generate multi-chain config file
  if (successful.length > 0 && fs.existsSync('deployments')) {
    const multiChainConfig = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      totalNetworks: successful.length,
      networks: {}
    };

    const deploymentFiles = fs.readdirSync('deployments').filter(f => f.endsWith('.json'));
    deploymentFiles.forEach(file => {
      try {
        const deployment = JSON.parse(fs.readFileSync(path.join('deployments', file), 'utf8'));
        const networkKey = file.replace('.json', '');
        multiChainConfig.networks[networkKey] = {
          chainId: deployment.chainId,
          name: deployment.network,
          contracts: deployment.contracts,
          deployer: deployment.deployer,
          timestamp: deployment.timestamp
        };
      } catch (error) {
        console.log(`⚠️  Could not process ${file} for multi-chain config`);
      }
    });

    fs.writeFileSync('deployments/multi-chain-config.json', JSON.stringify(multiChainConfig, null, 2));
    console.log('💾 Multi-chain configuration saved to: deployments/multi-chain-config.json');
  }

  // Final recommendations
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. 🔍 Verify contracts on block explorers');
  console.log('2. 🧪 Test cross-chain wallet creation');
  console.log('3. ⚙️  Configure paymaster policies per network');
  console.log('4. 🎨 Build multi-chain demo UI');
  console.log('5. 📚 Update SDK with all contract addresses');

  if (failed.length > 0) {
    console.log('\n⚠️  RETRY FAILED DEPLOYMENTS:');
    failed.forEach(result => {
      console.log(`   ./node_modules/.bin/hardhat run scripts/deploy.js --network ${result.network.name}`);
    });
  }

  console.log('\n🌟 NexusDeFi Multi-Chain Infrastructure Deployment Complete! 🌟');
  
  // Exit with appropriate code
  process.exit(failed.length > 0 ? 1 : 0);
}

// Handle script execution
main()
  .then(() => {
    console.log('\n✨ Multi-chain deployment script completed!');
  })
  .catch((error) => {
    console.error('\n💥 Multi-chain deployment script failed:', error);
    process.exit(1);
  }); 