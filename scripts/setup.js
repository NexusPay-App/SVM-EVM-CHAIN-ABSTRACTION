const fs = require('fs');
const { ethers } = require('hardhat');

async function checkEnvironment() {
  console.log('🔍 NexusDeFi Environment Check\n');
  
  const checks = [];
  
  // Check if .env file exists
  const envExists = fs.existsSync('.env');
  checks.push({
    name: '.env file',
    status: envExists,
    message: envExists ? '✅ Found' : '❌ Missing - Create .env file with your keys'
  });
  
  if (envExists) {
    require('dotenv').config();
    
    // Check required environment variables
    const requiredVars = ['PRIVATE_KEY', 'INFURA_KEY'];
    const optionalVars = ['ETHERSCAN_API_KEY', 'ARBISCAN_API_KEY', 'BASESCAN_API_KEY', 'POLYGONSCAN_API_KEY'];
    
    requiredVars.forEach(varName => {
      const exists = !!process.env[varName];
      checks.push({
        name: varName,
        status: exists,
        message: exists ? '✅ Set' : '❌ Missing - Required for deployment'
      });
    });
    
    optionalVars.forEach(varName => {
      const exists = !!process.env[varName];
      checks.push({
        name: varName,
        status: exists,
        message: exists ? '✅ Set' : '⚠️  Optional - Needed for contract verification'
      });
    });
    
    // Check wallet balance if private key is available
    if (process.env.PRIVATE_KEY) {
      try {
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
        checks.push({
          name: 'Wallet Address',
          status: true,
          message: `✅ ${wallet.address}`
        });
      } catch (error) {
        checks.push({
          name: 'Private Key',
          status: false,
          message: '❌ Invalid private key format'
        });
      }
    }
  }
  
  // Display results
  console.log('📋 Environment Check Results:');
  console.log('┌─────────────────────┬─────────────────────────────────────────┐');
  console.log('│ Component           │ Status                                  │');
  console.log('├─────────────────────┼─────────────────────────────────────────┤');
  
  checks.forEach(check => {
    const name = check.name.padEnd(19);
    const message = check.message.padEnd(39);
    console.log(`│ ${name} │ ${message} │`);
  });
  
  console.log('└─────────────────────┴─────────────────────────────────────────┘\n');
  
  const allRequired = checks.filter(c => c.message.includes('Required')).every(c => c.status);
  
  if (allRequired) {
    console.log('🎉 Environment setup complete! Ready to deploy.\n');
    
    console.log('🚀 Quick Deployment Commands:');
    console.log('├─ Single network:  npm run deploy:sepolia');
    console.log('├─ All networks:    npm run deploy:all');
    console.log('└─ Test locally:    npm test\n');
    
    console.log('🌐 Available Networks:');
    console.log('├─ 🔷 Ethereum Sepolia:  npm run deploy:sepolia');
    console.log('├─ 🔴 Arbitrum Sepolia:  npm run deploy:arbitrum');
    console.log('├─ 🔵 Base Sepolia:      npm run deploy:base');
    console.log('└─ 🟣 Polygon Mumbai:    npm run deploy:polygon');
    
  } else {
    console.log('⚠️  Environment setup incomplete. Please fix the issues above.\n');
    
    console.log('📝 Setup Instructions:');
    console.log('1. Create .env file in contracts/evm/ directory');
    console.log('2. Add your PRIVATE_KEY (without 0x prefix)');
    console.log('3. Add your INFURA_KEY from https://infura.io');
    console.log('4. Get test tokens from faucets (see DEPLOYMENT_GUIDE.md)');
    console.log('5. Run this script again to verify setup\n');
  }
  
  return allRequired;
}

async function main() {
  console.log('🌟 NexusDeFi Setup & Environment Checker\n');
  
  const isReady = await checkEnvironment();
  
  if (isReady) {
    console.log('✨ Your environment is ready for deployment!');
    console.log('📖 See DEPLOYMENT_GUIDE.md for detailed instructions.');
  } else {
    console.log('🔧 Please complete the environment setup first.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup check failed:', error);
    process.exit(1);
  }); 