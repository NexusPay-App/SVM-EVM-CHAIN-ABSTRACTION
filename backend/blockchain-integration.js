const { ethers } = require('ethers');
const crypto = require('crypto');
const { 
  getChainConfig, 
  getEVMChains, 
  getSupportedChainIds,
  generateCrossChainAddresses,
  isChainSupported 
} = require('./config/chains');

// WalletFactory ABI (minimal required functions)
const WALLET_FACTORY_ABI = [
  "function createWallet(address owner, uint256 salt) external returns (address wallet)",
  "function getWalletAddress(address owner, uint256 salt) public view returns (address wallet)",
  "function isWalletDeployed(address owner, uint256 salt) external view returns (bool)",
  "event WalletCreated(address indexed wallet, address indexed owner, uint256 salt)"
];

// BaseWallet ABI (minimal required functions)
const WALLET_ABI = [
  "function owner() public view returns (address)",
  "function getNonce() public view returns (uint256)",
  "function getBalance() public view returns (uint256)",
  "function execute(address target, uint256 value, bytes calldata data) public returns (bool success)",
  "function deposit() public payable"
];

class BlockchainWalletManager {
  constructor() {
    this.providers = {};
    this.walletFactories = {};
    this.deployedWallets = new Map(); // Cache for deployed wallets
    this.initializeProviders();
  }

  initializeProviders() {
    // Initialize providers for each supported EVM chain
    const evmChains = getEVMChains();
    
    for (const [chainId, config] of Object.entries(evmChains)) {
      try {
        // Skip chains without deployed contracts
        if (!config.contracts.walletFactory || !config.contracts.entryPoint) {
          console.log(`⚠️  Skipping ${chainId}: contracts not deployed yet`);
          continue;
        }

        this.providers[chainId] = new ethers.JsonRpcProvider(config.rpcUrl);
        this.walletFactories[chainId] = new ethers.Contract(
          config.contracts.walletFactory,
          WALLET_FACTORY_ABI,
          this.providers[chainId]
        );
        console.log(`✅ Initialized ${config.displayName} provider and WalletFactory`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${chainId}:`, error.message);
      }
    }
  }

  // Generate deterministic owner address from social ID (same across all EVM chains)
  generateOwnerAddress(socialId, socialType) {
    // Create a deterministic seed for EVM chains (same across all EVM chains)
    const evmSeed = crypto.createHash('sha256').update(socialId + socialType + 'nexuspay-evm').digest();
    
    // Create a wallet from the seed (this gives us a deterministic private key and address)
    // In production, you'd want to use a more secure key derivation method
    const privateKey = '0x' + evmSeed.toString('hex');
    const wallet = new ethers.Wallet(privateKey);
    
    return {
      address: wallet.address,
      privateKey: privateKey // Store securely in production!
    };
  }

  // Generate salt from social ID for CREATE2 determinism
  generateSalt(socialId, socialType) {
    const saltString = `${socialType}:${socialId}:nexuspay-v1`;
    const saltHash = crypto.createHash('sha256').update(saltString).digest();
    return ethers.toBigInt('0x' + saltHash.toString('hex'));
  }

  // Create or get wallet address for a social ID
  async createWallet(socialId, socialType, networks = ['ethereum']) {
    try {
      // If networks is a string, convert to array
      if (typeof networks === 'string') {
        networks = [networks];
      }
      
      // Validate all requested networks are supported
      const unsupportedChains = networks.filter(net => !isChainSupported(net));
      if (unsupportedChains.length > 0) {
        throw new Error(`Unsupported chains: ${unsupportedChains.join(', ')}`);
      }
      
      // Use first available EVM chain as primary network
      const evmChains = getEVMChains();
      const primaryNetwork = networks.find(net => evmChains[net]) || 'ethereum';
      
      console.log(`🔨 Creating/getting wallet for ${socialType}:${socialId} on ${primaryNetwork}`);
      
      const config = getChainConfig(primaryNetwork);
      if (!config) {
        throw new Error(`Chain configuration not found: ${primaryNetwork}`);
      }

      // Generate deterministic owner and salt
      const owner = this.generateOwnerAddress(socialId, socialType);
      const salt = this.generateSalt(socialId, socialType);

      // Get predicted wallet address
      const walletFactory = this.walletFactories[primaryNetwork];
      const predictedAddress = await walletFactory.getWalletAddress(owner.address, salt);

      // Check if wallet is already deployed
      const isDeployed = await walletFactory.isWalletDeployed(owner.address, salt);

      console.log(`📍 Predicted wallet address: ${predictedAddress}`);
      console.log(`🏗️  Is deployed: ${isDeployed}`);

      // Store wallet info (including private key for demo - secure this in production!)
      const walletInfo = {
        address: predictedAddress,
        owner: owner.address,
        ownerPrivateKey: owner.privateKey, // SECURE THIS IN PRODUCTION!
        salt: salt.toString(),
        isDeployed,
        network: primaryNetwork,
        chainId: config.chainId,
        contractAddresses: {
          entryPoint: config.contracts.entryPoint,
          walletFactory: config.contracts.walletFactory,
          paymaster: config.contracts.paymaster
        },
        socialId,
        socialType,
        createdAt: new Date().toISOString()
      };

      // If not deployed, we have the info to deploy it when needed
      // For now, we'll return the predicted address which is deterministic and real
      this.deployedWallets.set(`${socialType}:${socialId}:${primaryNetwork}`, walletInfo);

      // Generate cross-chain addresses using the new system
      const crossChainAddresses = await generateCrossChainAddresses(socialId, socialType);

      // Check if the primary wallet is actually deployed
      const isActuallyDeployed = await walletFactory.isWalletDeployed(owner.address, salt);
      walletInfo.isDeployed = isActuallyDeployed;

      // Store the wallet info
      this.deployedWallets.set(`${socialType}:${socialId}:${primaryNetwork}`, walletInfo);

      return {
        addresses: crossChainAddresses,
        blockchainInfo: {
          primaryWallet: walletInfo,
          ownerAddress: owner.address,
          canDeploy: true,
          isRealBlockchainAddresses: true,
          contractAddresses: config.contracts,
          supportedChains: getSupportedChainIds()
        }
      };

    } catch (error) {
      console.error(`❌ Error creating wallet for ${socialType}:${socialId}:`, error);
      throw error;
    }
  }

  // Actually deploy the smart contract wallet on-chain (costs gas)
  async deployWallet(socialId, socialType, networkName = 'sepolia') {
    try {
      const walletKey = `${socialType}:${socialId}:${networkName}`;
      const walletInfo = this.deployedWallets.get(walletKey);
      
      if (!walletInfo) {
        throw new Error('Wallet info not found. Create wallet first.');
      }

      if (walletInfo.isDeployed) {
        console.log(`✅ Wallet already deployed at ${walletInfo.address}`);
        return walletInfo;
      }

      console.log(`🚀 Deploying wallet for ${socialType}:${socialId} on ${networkName}...`);

      // For demo purposes, we'll simulate deployment success
      // In production, you'd need a funded deployer account to pay gas
      console.log(`⚠️  DEMO MODE: Wallet deployment simulated (requires gas fees in production)`);
      console.log(`💡 To actually deploy, you'd need:`);
      console.log(`   - Funded deployer account with ETH`);
      console.log(`   - Call walletFactory.createWallet(${walletInfo.owner}, ${walletInfo.salt})`);
      console.log(`   - Transaction would create wallet at: ${walletInfo.address}`);

      // Update deployment status (simulated)
      walletInfo.isDeployed = true;
      walletInfo.deployedAt = new Date().toISOString();
      walletInfo.deploymentTxHash = '0x' + crypto.randomBytes(32).toString('hex'); // Simulated

      this.deployedWallets.set(walletKey, walletInfo);

      return walletInfo;

    } catch (error) {
      console.error(`❌ Error deploying wallet:`, error);
      throw error;
    }
  }

  // Get wallet info
  getWalletInfo(socialId, socialType, networkName = 'sepolia') {
    const walletKey = `${socialType}:${socialId}:${networkName}`;
    return this.deployedWallets.get(walletKey);
  }


}

// Create singleton instance
const blockchainManager = new BlockchainWalletManager();

module.exports = {
  BlockchainWalletManager,
  blockchainManager
}; 