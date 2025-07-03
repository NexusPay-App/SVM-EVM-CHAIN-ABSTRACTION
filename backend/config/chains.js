const crypto = require('crypto');

/**
 * Centralized Chain Configuration System
 * This allows easy addition of new chains without changing core infrastructure
 */

const SUPPORTED_CHAINS = {
  // === EVM CHAINS === //
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    displayName: 'Ethereum Sepolia',
    type: 'EVM',
    chainId: 11155111,
    currency: 'ETH',
    decimals: 18,
    isTestnet: true,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerApiUrl: 'https://api-sepolia.etherscan.io/api',
    contracts: {
      entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Standard EntryPoint v0.6 (matches factory)
      walletFactory: '0x73c780a09d89b486e2859EA247f54C88C57d3B5C',
      paymaster: '0x790eA3268237CbF95B90f1174251a533152cD83D'
    },
    gasConfiguration: {
      gasPrice: '20000000000', // 20 gwei
      gasLimit: '500000',
      priorityFee: '2000000000' // 2 gwei
    },
    features: {
      accountAbstraction: true,
      paymasterSupport: true,
      crossChainBridge: true,
      nativeTokens: true
    }
  },

  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    displayName: 'Arbitrum Sepolia',
    type: 'EVM',
    chainId: 421614,
    currency: 'ETH',
    decimals: 18,
    isTestnet: true,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    explorerApiUrl: 'https://api-sepolia.arbiscan.io/api',
    contracts: {
      entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Standard EntryPoint v0.6 (matches factory)
      walletFactory: '0x6Fa4AD73b6cdA386B909689e4F30a94285Cd8c64',
      paymaster: '0x3B13AB5886E70532A3B92C53a53BD89e71645d1F'
    },
    gasConfiguration: {
      gasPrice: '100000000', // 0.1 gwei (L2 cheaper)
      gasLimit: '800000',
      priorityFee: '100000000' // 0.1 gwei
    },
    features: {
      accountAbstraction: true,
      paymasterSupport: true,
      crossChainBridge: true,
      nativeTokens: true,
      layer2: true
    }
  },

  // === SVM CHAINS === //
  solana: {
    id: 'solana',
    name: 'Solana',
    displayName: 'Solana Devnet',
    type: 'SVM',
    chainId: 'devnet',
    currency: 'SOL',
    decimals: 9,
    isTestnet: true,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    explorerApiUrl: 'https://api.devnet.solana.com',
    contracts: {
      // Solana program addresses will be added when deployed
      entryPoint: null,
      walletFactory: null,
      paymaster: null
    },
    gasConfiguration: {
      computeUnitPrice: '1000', // microlamports
      computeUnitLimit: '200000'
    },
    features: {
      accountAbstraction: true,
      paymasterSupport: true,
      crossChainBridge: true,
      nativeTokens: true,
      programAccounts: true
    }
  }
};

/**
 * Get configuration for a specific chain
 * @param {string} chainId - Chain identifier
 * @returns {Object|null} Chain configuration
 */
function getChainConfig(chainId) {
  return SUPPORTED_CHAINS[chainId] || null;
}

/**
 * Get all supported chains
 * @returns {Object} All chain configurations
 */
function getAllChains() {
  return SUPPORTED_CHAINS;
}

/**
 * Get all EVM chains
 * @returns {Object} EVM chain configurations
 */
function getEVMChains() {
  return Object.fromEntries(
    Object.entries(SUPPORTED_CHAINS).filter(([_, config]) => config.type === 'EVM')
  );
}

/**
 * Get all SVM chains
 * @returns {Object} SVM chain configurations
 */
function getSVMChains() {
  return Object.fromEntries(
    Object.entries(SUPPORTED_CHAINS).filter(([_, config]) => config.type === 'SVM')
  );
}

/**
 * Add a new chain configuration (for future extensibility)
 * @param {string} chainId - Chain identifier
 * @param {Object} config - Chain configuration
 */
function addChain(chainId, config) {
  // Validate required fields
  const required = ['name', 'type', 'chainId', 'currency', 'rpcUrl'];
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Set defaults
  const defaultConfig = {
    isTestnet: true,
    features: {
      accountAbstraction: true,
      paymasterSupport: true,
      crossChainBridge: false,
      nativeTokens: true
    },
    contracts: {
      entryPoint: null,
      walletFactory: null,
      paymaster: null
    }
  };

  SUPPORTED_CHAINS[chainId] = { ...defaultConfig, ...config, id: chainId };
  console.log(`✅ Added new chain: ${chainId} (${config.name})`);
}

/**
 * Generate deterministic wallet addresses across all chains
 * @param {string} socialId - Social identifier
 * @param {string} socialType - Type of social identifier
 * @returns {Object} Addresses for all supported chains
 */
async function generateCrossChainAddresses(socialId, socialType) {
  const addresses = {};
  
  // Generate single EVM address for ALL EVM chains
  const evmSeed = crypto.createHash('sha256').update(socialId + socialType + 'nexuspay-evm').digest();
  const evmPrivateKey = '0x' + evmSeed.toString('hex');
  
  // Create deterministic EVM address using CREATE2 simulation
  const evmAddressSeed = crypto.createHash('sha256')
    .update(socialId + socialType + 'nexuspay-evm-address')
    .digest();
  const evmAddress = '0x' + evmAddressSeed.slice(0, 20).toString('hex');
  
  // Assign SAME address to ALL EVM chains
  const evmChains = getEVMChains();
  for (const [chainId, config] of Object.entries(evmChains)) {
    addresses[chainId] = evmAddress; // Same address across all EVM chains
  }

  // Generate single SVM address for ALL SVM chains
  try {
    const { Keypair } = require('@solana/web3.js');
    const svmSeed = crypto.createHash('sha256')
      .update(socialId + socialType + 'nexuspay-svm')
      .digest();
    
    const svmKeypair = Keypair.fromSeed(svmSeed.slice(0, 32));
    const svmAddress = svmKeypair.publicKey.toString();
    
    // Assign SAME address to ALL SVM chains
    const svmChains = getSVMChains();
    for (const [chainId, config] of Object.entries(svmChains)) {
      addresses[chainId] = svmAddress; // Same address across all SVM chains
    }
  } catch (error) {
    console.warn('⚠️  Solana address generation requires @solana/web3.js');
    // Set null for all SVM chains if generation fails
    const svmChains = getSVMChains();
    for (const [chainId, config] of Object.entries(svmChains)) {
      addresses[chainId] = null;
    }
  }

  return addresses;
}

/**
 * Validate if a chain is supported
 * @param {string} chainId - Chain identifier
 * @returns {boolean} Whether chain is supported
 */
function isChainSupported(chainId) {
  return chainId in SUPPORTED_CHAINS;
}

/**
 * Get supported chain IDs
 * @returns {string[]} Array of supported chain IDs
 */
function getSupportedChainIds() {
  return Object.keys(SUPPORTED_CHAINS);
}

/**
 * Get chain configuration for API responses
 * @param {string} chainId - Chain identifier
 * @returns {Object} Public chain information
 */
function getPublicChainInfo(chainId) {
  const config = getChainConfig(chainId);
  if (!config) return null;

  return {
    id: config.id,
    name: config.name,
    displayName: config.displayName,
    type: config.type,
    chainId: config.chainId,
    currency: config.currency,
    explorerUrl: config.explorerUrl,
    isTestnet: config.isTestnet,
    features: config.features
  };
}

module.exports = {
  SUPPORTED_CHAINS,
  getChainConfig,
  getAllChains,
  getEVMChains,
  getSVMChains,
  addChain,
  generateCrossChainAddresses,
  isChainSupported,
  getSupportedChainIds,
  getPublicChainInfo
}; 