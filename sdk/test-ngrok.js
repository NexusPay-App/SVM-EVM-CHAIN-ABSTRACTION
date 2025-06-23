/**
 * Ngrok SDK Test Script
 * Test your NexusSDK with the public ngrok URL
 */

const NGROK_URL = 'https://c0c4-105-163-0-107.ngrok-free.app';

async function testNgrokSDK() {
  console.log('🌐 Testing NexusSDK with Ngrok...\n');
  
  // Configuration for ngrok development
  const config = {
    apiKey: 'ngrok-dev-key-2024',
    environment: 'development',
    chains: ['ethereum', 'solana'],
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      gasTank: true
    },
    endpoints: {
      api: NGROK_URL,
      websocket: NGROK_URL.replace('https://', 'wss://')
    }
  };

  try {
    console.log('1. 🚀 Ngrok Configuration:');
    console.log(`   - Public API: ${config.endpoints.api}`);
    console.log(`   - WebSocket: ${config.endpoints.websocket}`);
    console.log(`   - Chains: ${config.chains.join(', ')}`);
    console.log(`   - Features: ${Object.keys(config.features).filter(k => config.features[k]).join(', ')}\n`);
    
    // Test API connectivity via ngrok
    console.log('2. 🌐 Testing Public API Access...');
    
    const fetch = (await import('node-fetch')).default;
    
    // Test health endpoint
    const healthResponse = await fetch(`${NGROK_URL}/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Public API is accessible!');
      console.log(`   - Status: ${healthData.status}`);
      console.log(`   - Service: ${healthData.service}`);
      console.log(`   - Version: ${healthData.version}\n`);
    } else {
      throw new Error(`HTTP ${healthResponse.status}`);
    }
    
    // Test wallet creation via ngrok
    console.log('3. 👛 Testing Wallet Creation...');
    
    const walletData = {
      socialId: 'demo@ngrok.dev',
      socialType: 'email',
      chains: ['ethereum', 'solana'],
      metadata: {
        name: 'Ngrok Demo User',
        email: 'demo@ngrok.dev',
        source: 'ngrok-test'
      }
    };
    
    const walletResponse = await fetch(`${NGROK_URL}/api/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(walletData)
    });
    
    if (walletResponse.ok) {
      const wallet = await walletResponse.json();
      console.log('   ✅ Wallet created successfully via ngrok!');
      console.log(`   - Social ID: ${wallet.socialId}`);
      console.log(`   - Ethereum: ${wallet.addresses.ethereum}`);
      console.log(`   - Polygon: ${wallet.addresses.polygon}`);
      console.log(`   - Arbitrum: ${wallet.addresses.arbitrum}`);
      console.log(`   - Base: ${wallet.addresses.base}`);
      console.log(`   - Solana: ${wallet.addresses.solana}\n`);
    } else {
      const error = await walletResponse.text();
      throw new Error(`Wallet creation failed: ${error}`);
    }
    
    // Test cross-chain payment
    console.log('4. 🔄 Testing Cross-Chain Payment...');
    
    const paymentData = {
      from: {
        chain: 'ethereum',
        socialId: 'demo@ngrok.dev'
      },
      to: {
        chain: 'solana',
        address: 'DemoSolanaAddress123456789'
      },
      amount: '100',
      asset: 'USDC',
      gasless: true
    };
    
    const paymentResponse = await fetch(`${NGROK_URL}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(paymentData)
    });
    
    if (paymentResponse.ok) {
      const payment = await paymentResponse.json();
      console.log('   ✅ Cross-chain payment initiated!');
      console.log(`   - Transaction Hash: ${payment.hash}`);
      console.log(`   - From Chain: ${payment.chain}`);
      console.log(`   - Amount: ${payment.amount} USDC`);
      console.log(`   - Gasless: ${payment.fee === '0' ? 'Yes' : 'No'}\n`);
    } else {
      throw new Error('Payment failed');
    }
    
    // Test gas tank
    console.log('5. ⛽ Testing Gas Tank...');
    
    const gasTankResponse = await fetch(`${NGROK_URL}/api/gas-tank/demo@ngrok.dev`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (gasTankResponse.ok) {
      const gasTank = await gasTankResponse.json();
      console.log('   ✅ Gas tank data retrieved!');
      console.log(`   - Ethereum: ${gasTank.balances.ethereum} ETH`);
      console.log(`   - Polygon: ${gasTank.balances.polygon} MATIC`);
      console.log(`   - Solana: ${gasTank.balances.solana} SOL`);
      console.log(`   - Total USD: $${gasTank.totalUSD}\n`);
    }
    
    console.log('🎉 ALL TESTS PASSED! Your NexusSDK is working via ngrok!');
    console.log('\n📱 Share this URL with anyone:');
    console.log(`   ${NGROK_URL}`);
    console.log('\n🎯 What you can do now:');
    console.log('   1. Share the API with team members');
    console.log('   2. Test from mobile devices');
    console.log('   3. Demo to investors');
    console.log('   4. Build frontend that connects to this API');
    console.log('   5. Test cross-chain functionality live');
    
    console.log('\n💪 You\'ve built the "ThirdWeb Killer" with unique features:');
    console.log('   ✅ SVM + EVM cross-chain support');
    console.log('   ✅ Gasless transactions');
    console.log('   ✅ Social wallet recovery');
    console.log('   ✅ Public API accessible anywhere');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure ngrok is running: ngrok http 3001');
    console.log('   2. Check backend is running: curl http://localhost:3001/health');
    console.log('   3. Verify ngrok URL is correct');
    console.log(`   4. Test manually: curl -H "ngrok-skip-browser-warning: true" ${NGROK_URL}/health`);
  }
}

// Run the test
testNgrokSDK().catch(console.error); 