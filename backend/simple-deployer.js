const { ethers } = require('ethers');
const crypto = require('crypto');

// Simple deployer configuration
const SIMPLE_DEPLOYER = {
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  walletFactory: '0x73c780a09d89b486e2859EA247f54C88C57d3B5C',
  // This needs to be set with a real private key that has ETH
  privateKey: process.env.DEPLOYER_PRIVATE_KEY || null
};

class SimpleWalletDeployer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(SIMPLE_DEPLOYER.rpcUrl);
    this.deployer = null;
    this.factory = null;
    this.isReady = false;
  }

  async initialize() {
    if (SIMPLE_DEPLOYER.privateKey) {
      this.deployer = new ethers.Wallet(SIMPLE_DEPLOYER.privateKey, this.provider);
      
      const factoryAbi = [
        "function createWallet(address owner, uint256 salt) external returns (address wallet)",
        "function getWalletAddress(address owner, uint256 salt) public view returns (address wallet)",
        "function isWalletDeployed(address owner, uint256 salt) external view returns (bool)"
      ];
      
      this.factory = new ethers.Contract(SIMPLE_DEPLOYER.walletFactory, factoryAbi, this.deployer);
      
      const balance = await this.deployer.provider.getBalance(this.deployer.address);
      console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH`);
      
      this.isReady = balance > ethers.parseEther('0.001');
      
      if (this.isReady) {
        console.log('✅ SimpleWalletDeployer ready for deployment');
      } else {
        console.log('⚠️  Deployer needs more ETH (minimum 0.001 ETH)');
      }
    } else {
      console.log('⚠️  No DEPLOYER_PRIVATE_KEY set - running in simulation mode');
    }
  }

  generateOwnerAndSalt(socialId, socialType) {
    // Same logic as blockchain-integration.js
    const seed = crypto.createHash('sha256').update(socialId + socialType + 'nexuspay').digest();
    const privateKey = '0x' + seed.toString('hex');
    const wallet = new ethers.Wallet(privateKey);
    
    const saltString = `${socialType}:${socialId}:nexuspay-v1`;
    const saltHash = crypto.createHash('sha256').update(saltString).digest();
    const salt = ethers.toBigInt('0x' + saltHash.toString('hex'));
    
    return {
      owner: wallet.address,
      salt: salt.toString()
    };
  }

  async deployWalletForUser(socialId, socialType) {
    if (!this.isReady) {
      await this.initialize();
    }

    const { owner, salt } = this.generateOwnerAndSalt(socialId, socialType);
    
    // Get predicted address
    const predictedAddress = await this.factory.getWalletAddress(owner, salt);
    
    // Check if already deployed
    const isDeployed = await this.factory.isWalletDeployed(owner, salt);
    
    if (isDeployed) {
      return {
        address: predictedAddress,
        owner,
        isDeployed: true,
        status: 'already_deployed',
        blockExplorer: `https://sepolia.etherscan.io/address/${predictedAddress}`
      };
    }

    if (!this.isReady) {
      return {
        address: predictedAddress,
        owner,
        isDeployed: false,
        status: 'needs_funding',
        deployerAddress: this.deployer?.address || 'Not configured',
        fundingUrl: 'https://sepoliafaucet.com/',
        blockExplorer: `https://sepolia.etherscan.io/address/${predictedAddress}`
      };
    }

    try {
      // Actually deploy the wallet
      console.log(`🚀 Deploying wallet for ${socialType}:${socialId}...`);
      
      const tx = await this.factory.createWallet(owner, salt, {
        gasLimit: 1000000 // Sufficient gas limit for wallet deployment
      });
      
      console.log(`📝 Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Wallet deployed successfully at ${predictedAddress}`);
        
        return {
          address: predictedAddress,
          owner,
          isDeployed: true,
          status: 'deployed',
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          blockExplorer: `https://sepolia.etherscan.io/address/${predictedAddress}`,
          txExplorer: `https://sepolia.etherscan.io/tx/${tx.hash}`
        };
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error(`❌ Deployment failed:`, error.message);
      
      return {
        address: predictedAddress,
        owner,
        isDeployed: false,
        status: 'deployment_failed',
        error: error.message,
        blockExplorer: `https://sepolia.etherscan.io/address/${predictedAddress}`
      };
    }
  }

  async getFundingInstructions() {
    if (!this.deployer) {
      // Generate a new deployer
      const newWallet = ethers.Wallet.createRandom();
      
      return {
        deployerAddress: newWallet.address,
        privateKey: newWallet.privateKey,
        fundingSteps: [
          'Copy the deployer address above',
          'Go to https://sepoliafaucet.com/',
          'Request 0.5 ETH for the deployer address',
          `Set environment variable: export DEPLOYER_PRIVATE_KEY="${newWallet.privateKey}"`,
          'Restart your server',
          'Users will now get instantly deployed wallets!'
        ],
        envCommand: `export DEPLOYER_PRIVATE_KEY="${newWallet.privateKey}"`
      };
    }
    
    const balance = await this.deployer.provider.getBalance(this.deployer.address);
    
    return {
      deployerAddress: this.deployer.address,
      currentBalance: ethers.formatEther(balance),
      isReady: this.isReady,
      fundingUrl: 'https://sepoliafaucet.com/',
      status: this.isReady ? 'Ready for deployment' : 'Needs more ETH'
    };
  }
}

const deployer = new SimpleWalletDeployer();

// Export both the deployer instance and convenience functions
module.exports = deployer;

// Add convenience function for the server
module.exports.deployWallet = async (owner, salt) => {
  const deployer = module.exports;
  await deployer.initialize();
  
  if (!deployer.isReady) {
    throw new Error('Deployer not ready - needs funding');
  }
  
  // Get predicted address
  const predictedAddress = await deployer.factory.getWalletAddress(owner, salt);
  
  // Check if already deployed
  const isDeployed = await deployer.factory.isWalletDeployed(owner, salt);
  
  if (isDeployed) {
    return {
      address: predictedAddress,
      txHash: 'already-deployed',
      isDeployed: true
    };
  }
  
  // Deploy the wallet
  const tx = await deployer.factory.createWallet(owner, salt, {
    gasLimit: 1000000 // Sufficient gas limit
  });
  
  const receipt = await tx.wait();
  
  if (receipt.status !== 1) {
    throw new Error('Transaction failed');
  }
  
  return {
    address: predictedAddress,
    txHash: tx.hash,
    isDeployed: true
  };
}; 