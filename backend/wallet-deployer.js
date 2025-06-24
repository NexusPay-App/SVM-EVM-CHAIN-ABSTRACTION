const { ethers } = require('ethers');
const { blockchainManager, CONTRACTS } = require('./blockchain-integration');

// Deployer configuration
const DEPLOYER_CONFIG = {
  // This would be a funded account in production
  // For demo, we'll show how it would work
  privateKey: process.env.DEPLOYER_PRIVATE_KEY || '0x' + '0'.repeat(64), // Placeholder
  minGasBalance: ethers.parseEther('0.01'), // Minimum ETH needed for deployment
};

class WalletDeployer {
  constructor() {
    this.provider = null;
    this.deployer = null;
    this.walletFactory = null;
    this.isInitialized = false;
  }

  async initialize(networkName = 'sepolia') {
    try {
      const config = CONTRACTS[networkName];
      if (!config) {
        throw new Error(`Unsupported network: ${networkName}`);
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      // Initialize deployer wallet (would need real private key with ETH)
      if (DEPLOYER_CONFIG.privateKey !== '0x' + '0'.repeat(64)) {
        this.deployer = new ethers.Wallet(DEPLOYER_CONFIG.privateKey, this.provider);
        
        // Check deployer balance
        const balance = await this.deployer.provider.getBalance(this.deployer.address);
        console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH`);
        
        if (balance < DEPLOYER_CONFIG.minGasBalance) {
          console.warn(`⚠️  Low deployer balance. Need at least ${ethers.formatEther(DEPLOYER_CONFIG.minGasBalance)} ETH`);
        }
      } else {
        console.log('⚠️  No deployer private key configured. Deployment will be simulated.');
      }

      // Initialize wallet factory contract
      const factoryAbi = [
        "function createWallet(address owner, uint256 salt) external returns (address wallet)",
        "function getWalletAddress(address owner, uint256 salt) public view returns (address wallet)",
        "function isWalletDeployed(address owner, uint256 salt) external view returns (bool)",
        "event WalletCreated(address indexed wallet, address indexed owner, uint256 salt)"
      ];

      this.walletFactory = new ethers.Contract(
        config.walletFactory,
        factoryAbi,
        this.deployer || this.provider
      );

      this.isInitialized = true;
      console.log('✅ WalletDeployer initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize WalletDeployer:', error);
      throw error;
    }
  }

  async deployWallet(socialId, socialType, networkName = 'sepolia') {
    try {
      if (!this.isInitialized) {
        await this.initialize(networkName);
      }

      console.log(`🚀 Deploying wallet for ${socialType}:${socialId} on ${networkName}...`);

      // Get wallet info from blockchain manager
      const walletInfo = blockchainManager.getWalletInfo(socialId, socialType, networkName);
      if (!walletInfo) {
        throw new Error('Wallet info not found. Create wallet first.');
      }

      // Check if already deployed
      const isDeployed = await this.walletFactory.isWalletDeployed(
        walletInfo.owner,
        walletInfo.salt
      );

      if (isDeployed) {
        console.log('✅ Wallet already deployed!');
        return {
          ...walletInfo,
          isDeployed: true,
          deploymentStatus: 'already_deployed'
        };
      }

      // Check if we have a real deployer
      if (!this.deployer || DEPLOYER_CONFIG.privateKey === '0x' + '0'.repeat(64)) {
        console.log('⚠️  SIMULATION MODE: No funded deployer account configured');
        console.log('💡 To actually deploy, you need:');
        console.log(`   1. Set DEPLOYER_PRIVATE_KEY environment variable`);
        console.log(`   2. Fund the deployer account with ETH for gas`);
        console.log(`   3. Call: walletFactory.createWallet("${walletInfo.owner}", ${walletInfo.salt})`);
        console.log(`   4. Wallet will be deployed at: ${walletInfo.address}`);
        
        return {
          ...walletInfo,
          isDeployed: false,
          deploymentStatus: 'simulation_only',
          deploymentInstructions: {
            requiredGas: '~0.005 ETH',
            factoryAddress: CONTRACTS[networkName].walletFactory,
            functionCall: `createWallet("${walletInfo.owner}", ${walletInfo.salt})`,
            predictedAddress: walletInfo.address
          }
        };
      }

      // Estimate gas for deployment
      const gasEstimate = await this.walletFactory.createWallet.estimateGas(
        walletInfo.owner,
        walletInfo.salt
      );

      const gasPrice = await this.provider.getFeeData();
      const estimatedCost = gasEstimate * gasPrice.gasPrice;

      console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      console.log(`💰 Estimated cost: ${ethers.formatEther(estimatedCost)} ETH`);

      // Check deployer balance
      const deployerBalance = await this.deployer.provider.getBalance(this.deployer.address);
      if (deployerBalance < estimatedCost) {
        throw new Error(`Insufficient balance. Need ${ethers.formatEther(estimatedCost)} ETH, have ${ethers.formatEther(deployerBalance)} ETH`);
      }

      // Deploy the wallet
      console.log('🔨 Sending deployment transaction...');
      const tx = await this.walletFactory.createWallet(
        walletInfo.owner,
        walletInfo.salt,
        {
          gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        }
      );

      console.log(`📝 Transaction sent: ${tx.hash}`);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log('✅ Wallet deployed successfully!');
        console.log(`🔗 Transaction: https://sepolia.etherscan.io/tx/${tx.hash}`);
        console.log(`🏠 Wallet address: https://sepolia.etherscan.io/address/${walletInfo.address}`);

        return {
          ...walletInfo,
          isDeployed: true,
          deploymentStatus: 'deployed',
          deploymentTxHash: tx.hash,
          deploymentBlockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          deployedAt: new Date().toISOString()
        };
      } else {
        throw new Error('Deployment transaction failed');
      }

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  async getDeploymentInstructions(socialId, socialType, networkName = 'sepolia') {
    const walletInfo = blockchainManager.getWalletInfo(socialId, socialType, networkName);
    if (!walletInfo) {
      throw new Error('Wallet info not found. Create wallet first.');
    }

    const config = CONTRACTS[networkName];
    
    return {
      title: 'Manual Wallet Deployment Instructions',
      walletAddress: walletInfo.address,
      ownerAddress: walletInfo.owner,
      salt: walletInfo.salt,
      steps: [
        {
          step: 1,
          description: 'Get ETH for gas fees',
          details: 'You need ~0.005 ETH on Sepolia testnet for deployment',
          faucets: [
            'https://sepoliafaucet.com/',
            'https://faucet.quicknode.com/ethereum/sepolia'
          ]
        },
        {
          step: 2,
          description: 'Connect to WalletFactory contract',
          contractAddress: config.walletFactory,
          etherscanUrl: `https://sepolia.etherscan.io/address/${config.walletFactory}#writeContract`
        },
        {
          step: 3,
          description: 'Call createWallet function',
          functionName: 'createWallet',
          parameters: {
            owner: walletInfo.owner,
            salt: walletInfo.salt
          }
        },
        {
          step: 4,
          description: 'Verify deployment',
          verificationUrl: `https://sepolia.etherscan.io/address/${walletInfo.address}`,
          expectedResult: 'Smart contract should appear at the predicted address'
        }
      ],
      contractInteraction: {
        contractAddress: config.walletFactory,
        functionSignature: `createWallet(address,uint256)`,
        parameters: [walletInfo.owner, walletInfo.salt],
        estimatedGas: '~100,000 gas',
        estimatedCost: '~0.005 ETH'
      }
    };
  }
}

// Create singleton instance
const walletDeployer = new WalletDeployer();

module.exports = {
  WalletDeployer,
  walletDeployer
}; 