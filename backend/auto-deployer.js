const { ethers } = require('ethers');
const { blockchainManager, CONTRACTS } = require('./blockchain-integration');

// Auto-deployer configuration with multiple funding sources
const AUTO_DEPLOYER_CONFIG = {
  // Multiple deployer accounts for load balancing
  deployers: [
    {
      name: 'primary',
      privateKey: process.env.PRIMARY_DEPLOYER_KEY || null,
      minBalance: ethers.parseEther('0.1')
    },
    {
      name: 'secondary', 
      privateKey: process.env.SECONDARY_DEPLOYER_KEY || null,
      minBalance: ethers.parseEther('0.05')
    }
  ],
  
  // Gas settings
  gasSettings: {
    maxFeePerGas: ethers.parseUnits('20', 'gwei'),
    maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
    gasLimit: 150000 // Enough for wallet deployment
  },
  
  // Auto-funding settings (for production)
  autoFunding: {
    enabled: false, // Enable in production with proper funding source
    minThreshold: ethers.parseEther('0.01'),
    refillAmount: ethers.parseEther('0.1')
  }
};

class AutoDeployer {
  constructor() {
    this.providers = {};
    this.deployers = [];
    this.walletFactories = {};
    this.deploymentQueue = [];
    this.isProcessing = false;
    this.deploymentStats = {
      total: 0,
      successful: 0,
      failed: 0,
      pending: 0
    };
  }

  async initialize(networkName = 'sepolia') {
    try {
      console.log('🚀 Initializing Auto-Deployer...');
      
      const config = CONTRACTS[networkName];
      if (!config) {
        throw new Error(`Unsupported network: ${networkName}`);
      }

      // Initialize provider
      this.providers[networkName] = new ethers.JsonRpcProvider(config.rpcUrl);
      
      // Initialize deployer accounts
      for (const deployerConfig of AUTO_DEPLOYER_CONFIG.deployers) {
        if (deployerConfig.privateKey) {
          try {
            const wallet = new ethers.Wallet(deployerConfig.privateKey, this.providers[networkName]);
            const balance = await wallet.provider.getBalance(wallet.address);
            
            const deployer = {
              name: deployerConfig.name,
              wallet,
              balance,
              isActive: balance >= deployerConfig.minBalance,
              address: wallet.address
            };
            
            this.deployers.push(deployer);
            
            console.log(`✅ ${deployerConfig.name} deployer: ${wallet.address}`);
            console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);
            console.log(`🟢 Active: ${deployer.isActive}`);
            
          } catch (error) {
            console.error(`❌ Failed to initialize ${deployerConfig.name} deployer:`, error.message);
          }
        }
      }

      if (this.deployers.length === 0) {
        console.log('⚠️  No funded deployers available. Creating demo deployer...');
        await this.createDemoDeployer(networkName);
      }

      // Initialize wallet factory contracts
      const factoryAbi = [
        "function createWallet(address owner, uint256 salt) external returns (address wallet)",
        "function getWalletAddress(address owner, uint256 salt) public view returns (address wallet)",
        "function isWalletDeployed(address owner, uint256 salt) external view returns (bool)",
        "event WalletCreated(address indexed wallet, address indexed owner, uint256 salt)"
      ];

      for (const deployer of this.deployers) {
        if (deployer.isActive) {
          this.walletFactories[`${networkName}_${deployer.name}`] = new ethers.Contract(
            config.walletFactory,
            factoryAbi,
            deployer.wallet
          );
        }
      }

      console.log('✅ Auto-Deployer initialized successfully');
      console.log(`📊 Active deployers: ${this.deployers.filter(d => d.isActive).length}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Auto-Deployer:', error);
      return false;
    }
  }

  async createDemoDeployer(networkName) {
    // Create a demo deployer with a random private key
    // In production, this would be funded through your payment system
    const randomWallet = ethers.Wallet.createRandom();
    const demoWallet = randomWallet.connect(this.providers[networkName]);
    
    console.log('🎭 Demo deployer created (unfunded):');
    console.log(`   Address: ${demoWallet.address}`);
    console.log(`   Private Key: ${randomWallet.privateKey}`);
    console.log('💡 To fund this deployer:');
    console.log(`   1. Send 0.1 ETH to: ${demoWallet.address}`);
    console.log(`   2. Set DEMO_DEPLOYER_KEY=${randomWallet.privateKey}`);
    console.log(`   3. Restart the server`);
    
    // Store for potential funding
    this.demoDeployer = {
      address: demoWallet.address,
      privateKey: randomWallet.privateKey,
      fundingUrl: `https://sepoliafaucet.com/`,
      instructions: [
        'Get testnet ETH from faucet',
        'Send 0.1 ETH to the demo deployer address',
        'Set environment variable and restart'
      ]
    };
  }

  async deployWalletInstantly(socialId, socialType, networkName = 'sepolia') {
    try {
      console.log(`⚡ Instant deployment for ${socialType}:${socialId}...`);
      
      // Get wallet info
      const walletInfo = blockchainManager.getWalletInfo(socialId, socialType, networkName);
      if (!walletInfo) {
        throw new Error('Wallet info not found. Create wallet first.');
      }

      // Check if already deployed
      const activeDeployer = this.deployers.find(d => d.isActive);
      if (!activeDeployer) {
        return this.handleNoDeployerAvailable(walletInfo);
      }

      const factoryKey = `${networkName}_${activeDeployer.name}`;
      const walletFactory = this.walletFactories[factoryKey];
      
      const isDeployed = await walletFactory.isWalletDeployed(
        walletInfo.owner,
        walletInfo.salt
      );

      if (isDeployed) {
        console.log('✅ Wallet already deployed!');
        return {
          ...walletInfo,
          isDeployed: true,
          deploymentStatus: 'already_deployed',
          blockExplorer: `https://sepolia.etherscan.io/address/${walletInfo.address}`
        };
      }

      // Deploy instantly
      console.log('🚀 Deploying wallet on-chain...');
      
      const tx = await walletFactory.createWallet(
        walletInfo.owner,
        walletInfo.salt,
        {
          ...AUTO_DEPLOYER_CONFIG.gasSettings,
          gasLimit: AUTO_DEPLOYER_CONFIG.gasSettings.gasLimit
        }
      );

      console.log(`📝 Deployment transaction: ${tx.hash}`);
      console.log('⏳ Waiting for confirmation...');

      // Don't wait for confirmation - return immediately with pending status
      this.trackDeployment(tx, walletInfo);

      return {
        ...walletInfo,
        isDeployed: false,
        deploymentStatus: 'pending',
        deploymentTxHash: tx.hash,
        blockExplorer: `https://sepolia.etherscan.io/address/${walletInfo.address}`,
        transactionUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
        estimatedConfirmation: new Date(Date.now() + 30000).toISOString(), // 30 seconds
        message: 'Wallet deployment transaction sent! Address will be active in ~30 seconds.'
      };

    } catch (error) {
      console.error('❌ Instant deployment failed:', error);
      
      // Return fallback info
      return this.handleDeploymentFailure(error, socialId, socialType);
    }
  }

  async trackDeployment(tx, walletInfo) {
    try {
      this.deploymentStats.pending++;
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Wallet deployed successfully: ${walletInfo.address}`);
        this.deploymentStats.successful++;
        this.deploymentStats.pending--;
        
        // Update wallet info in storage if needed
        // You could emit events here for real-time updates
        
      } else {
        console.error(`❌ Deployment failed: ${walletInfo.address}`);
        this.deploymentStats.failed++;
        this.deploymentStats.pending--;
      }
      
      this.deploymentStats.total++;
      
    } catch (error) {
      console.error('❌ Deployment tracking error:', error);
      this.deploymentStats.failed++;
      this.deploymentStats.pending--;
    }
  }

  handleNoDeployerAvailable(walletInfo) {
    console.log('⚠️  No funded deployers available');
    
    return {
      ...walletInfo,
      isDeployed: false,
      deploymentStatus: 'no_deployer',
      message: 'Wallet address generated but deployment requires funding',
      fundingInstructions: this.demoDeployer ? {
        demoDeployer: this.demoDeployer.address,
        fundingUrl: this.demoDeployer.fundingUrl,
        instructions: this.demoDeployer.instructions,
        privateKey: this.demoDeployer.privateKey
      } : null,
      blockExplorer: `https://sepolia.etherscan.io/address/${walletInfo.address}`,
      note: 'Address is valid and will work once deployed'
    };
  }

  handleDeploymentFailure(error, socialId, socialType) {
    const walletInfo = blockchainManager.getWalletInfo(socialId, socialType);
    
    return {
      ...walletInfo,
      isDeployed: false,
      deploymentStatus: 'failed',
      error: error.message,
      message: 'Deployment failed but address is still valid',
      blockExplorer: `https://sepolia.etherscan.io/address/${walletInfo.address}`,
      retryAvailable: true
    };
  }

  async getDeploymentStatus() {
    return {
      ...this.deploymentStats,
      deployers: this.deployers.map(d => ({
        name: d.name,
        address: d.address,
        balance: ethers.formatEther(d.balance),
        isActive: d.isActive
      })),
      demoDeployer: this.demoDeployer
    };
  }

  // User-friendly signup flow
  async createAccountWithInstantWallet(socialId, socialType, userMetadata = {}) {
    try {
      console.log(`👤 Creating account for ${socialType}:${socialId}...`);
      
      // Step 1: Generate cross-chain addresses
      const blockchainWallet = await blockchainManager.generateCrossChainAddresses(socialId, socialType);
      
      // Step 2: Attempt instant deployment
      const deploymentResult = await this.deployWalletInstantly(socialId, socialType);
      
      // Step 3: Create complete user account
      const userAccount = {
        socialId,
        socialType,
        addresses: blockchainWallet.addresses,
        blockchainInfo: {
          ...blockchainWallet,
          deployment: deploymentResult
        },
        metadata: userMetadata,
        createdAt: new Date().toISOString(),
        status: 'active',
        walletReady: deploymentResult.deploymentStatus === 'already_deployed' || 
                     deploymentResult.deploymentStatus === 'pending'
      };
      
      console.log(`✅ Account created for ${socialType}:${socialId}`);
      console.log(`📍 Primary address: ${blockchainWallet.addresses.ethereum}`);
      console.log(`🚀 Deployment status: ${deploymentResult.deploymentStatus}`);
      
      return userAccount;
      
    } catch (error) {
      console.error('❌ Account creation failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const autoDeployer = new AutoDeployer();

module.exports = {
  AutoDeployer,
  autoDeployer
}; 