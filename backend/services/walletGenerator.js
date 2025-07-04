const crypto = require('crypto');
const { ethers } = require('ethers');
const { Keypair } = require('@solana/web3.js');
const { derivePath } = require('ed25519-hd-key');

class WalletGenerator {
  constructor() {
    this.masterSeed = process.env.MASTER_SEED || 'default_development_seed_change_in_production';
  }

  /**
   * Generate deterministic paymaster wallet for a project and chain category
   * @param {string} projectId - Project ID
   * @param {string} chainCategory - 'evm' or 'svm' for shared paymasters
   * @returns {Object} - { address, privateKey }
   */
  generatePaymasterWallet(projectId, chainCategory) {
    // Create deterministic seed from project ID, chain category, and master seed
    const seedInput = `${projectId}-${chainCategory}-paymaster-${this.masterSeed}`;
    const seed = crypto.createHash('sha256').update(seedInput).digest();

    switch (chainCategory) {
      case 'evm':
        return this.generateEthereumWallet(seed);
      case 'svm':
        return this.generateSolanaWallet(seed);
      default:
        throw new Error(`Unsupported chain category: ${chainCategory}. Use 'evm' or 'svm'.`);
    }
  }

  /**
   * Generate paymaster wallet for specific chain (backwards compatibility)
   * @param {string} projectId - Project ID
   * @param {string} chain - Specific chain name (maps to category)
   * @returns {Object} - { address, privateKey }
   */
  generatePaymasterWalletForChain(projectId, chain) {
    const chainCategory = this.getChainCategory(chain);
    return this.generatePaymasterWallet(projectId, chainCategory);
  }

  /**
   * Generate user wallet for EVM chains (smart contract deployment)
   * @param {Object} params - { socialId, socialType, chain, salt, usePaymaster, projectId, paymasterAddress }
   * @returns {Object} - { success, address, isDeployed, txHash, gasFees }
   */
  async generateUserWallet(params) {
    try {
      const { socialId, socialType, chain, salt, usePaymaster, projectId, paymasterAddress } = params;
      
      console.log(`🔗 Generating EVM user wallet for ${socialId} on ${chain}...`);
      
      // Generate deterministic seed for this user
      const seedInput = `${socialId}-${socialType}-user-${projectId}-${salt}`;
      const seed = crypto.createHash('sha256').update(seedInput).digest();
      
      // Generate wallet from seed
      const wallet = this.generateEthereumWallet(seed);
      
      console.log(`✅ Generated EVM user wallet address: ${wallet.address}`);
      
      // For now, return the wallet address (would deploy smart contract in production)
      return {
        success: true,
        address: wallet.address,
        isDeployed: false, // Would be true after smart contract deployment
        txHash: null, // Would contain deployment transaction hash
        gasFees: 0 // Would contain actual gas fees paid by paymaster
      };
      
    } catch (error) {
      console.error('EVM user wallet generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate user wallet for Solana (program deployment)
   * @param {Object} params - { socialId, socialType, salt, usePaymaster, projectId, paymasterAddress }
   * @returns {Object} - { success, address, isDeployed, txHash, gasFees }
   */
  async generateSolanaUserWallet(params) {
    try {
      const { socialId, socialType, salt, usePaymaster, projectId, paymasterAddress } = params;
      
      console.log(`🌟 Generating Solana user wallet for ${socialId}...`);
      
      // Generate deterministic seed for this user
      const seedInput = `${socialId}-${socialType}-user-${projectId}-${salt}`;
      const seed = crypto.createHash('sha256').update(seedInput).digest();
      
      // Generate wallet from seed
      const wallet = this.generateSolanaWallet(seed);
      
      console.log(`✅ Generated Solana user wallet address: ${wallet.address}`);
      
      // For now, return the wallet address (would deploy program in production)
      return {
        success: true,
        address: wallet.address,
        isDeployed: false, // Would be true after program deployment
        txHash: null, // Would contain deployment transaction hash
        gasFees: 0 // Would contain actual fees paid by paymaster
      };
      
    } catch (error) {
      console.error('Solana user wallet generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get chain category from specific chain name
   * @param {string} chain - Specific chain name
   * @returns {string} - Chain category ('evm' or 'svm')
   */
  getChainCategory(chain) {
    const evmChains = ['ethereum', 'arbitrum', 'polygon', 'bsc', 'sepolia'];
    const svmChains = ['solana', 'eclipse'];
    
    if (evmChains.includes(chain)) return 'evm';
    if (svmChains.includes(chain)) return 'svm';
    
    throw new Error(`Unsupported chain: ${chain}`);
  }

  /**
   * Get currency symbol for chain
   * @param {string} chain - Chain name
   * @returns {string} - Currency symbol
   */
  getCurrencyForChain(chain) {
    const currencyMap = {
      ethereum: 'ETH',
      arbitrum: 'ETH',
      polygon: 'MATIC',
      bsc: 'BNB',
      solana: 'SOL',
      eclipse: 'SOL'
    };
    return currencyMap[chain] || 'ETH';
  }

  /**
   * Generate Ethereum-compatible wallet from seed (works on all EVM chains)
   * @param {Buffer} seed - 32-byte seed
   * @returns {Object} - { address, privateKey }
   */
  generateEthereumWallet(seed) {
    try {
      // Create wallet from seed hex string
      const privateKey = '0x' + seed.toString('hex');
      const wallet = new ethers.Wallet(privateKey);
      
      return {
        address: wallet.address,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      throw new Error(`Failed to generate EVM wallet: ${error.message}`);
    }
  }

  /**
   * Generate Solana-compatible wallet from seed (works on all SVM chains)
   * @param {Buffer} seed - 32-byte seed
   * @returns {Object} - { address, privateKey }
   */
  generateSolanaWallet(seed) {
    try {
      // Use HD derivation for Solana
      const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
      const keypair = Keypair.fromSeed(derivedSeed);
      
      return {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString('hex')
      };
    } catch (error) {
      throw new Error(`Failed to generate SVM wallet: ${error.message}`);
    }
  }

  /**
   * Validate wallet address for a given chain
   * @param {string} address - Wallet address
   * @param {string} chain - Chain type
   * @returns {boolean} - Whether address is valid
   */
  validateAddress(address, chain) {
    try {
      const category = this.getChainCategory(chain);
      
      switch (category) {
        case 'evm':
          return ethers.isAddress(address);
        case 'svm':
          // Basic Solana address validation (base58, 32 bytes)
          return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get supported chains by category
   * @param {string} chainCategory - 'evm' or 'svm'
   * @returns {Array} - Array of supported chain names
   */
  getSupportedChains(chainCategory) {
    const chainMap = {
      evm: ['ethereum', 'arbitrum', 'polygon', 'bsc'],
      svm: ['solana', 'eclipse']
    };
    
    return chainMap[chainCategory] || [];
  }

  /**
   * Get chain configuration
   * @param {string} chain - Chain name
   * @returns {Object} - Chain configuration
   */
  getChainConfig(chain) {
    const configs = {
      ethereum: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
        chainId: 11155111, // Sepolia for testing
        category: 'evm'
      },
      arbitrum: {
        name: 'Arbitrum Sepolia',
        symbol: 'ETH',
        decimals: 18,
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        chainId: 421614, // Arbitrum Sepolia
        category: 'evm'
      },
      polygon: {
        name: 'Polygon Mumbai',
        symbol: 'MATIC',
        decimals: 18,
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.matic.today',
        chainId: 80001, // Mumbai testnet
        category: 'evm'
      },
      bsc: {
        name: 'BSC Testnet',
        symbol: 'BNB',
        decimals: 18,
        rpcUrl: process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
        chainId: 97, // BSC testnet
        category: 'evm'
      },
      solana: {
        name: 'Solana Devnet',
        symbol: 'SOL',
        decimals: 9,
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        cluster: 'devnet',
        category: 'svm'
      },
      eclipse: {
        name: 'Eclipse Devnet',
        symbol: 'ETH',
        decimals: 18,
        rpcUrl: process.env.ECLIPSE_RPC_URL || 'https://staging-rpc.dev2.eclipsenetwork.xyz',
        category: 'svm'
      }
    };

    return configs[chain];
  }

  /**
   * Generate QR code data for funding addresses
   * @param {string} address - Wallet address
   * @param {string} chain - Chain type
   * @returns {string} - QR code URI
   */
  generateQRCodeData(address, chain) {
    const config = this.getChainConfig(chain);
    
    if (!config) {
      return address;
    }
    
    switch (config.category) {
      case 'evm':
        if (config.chainId) {
          return `ethereum:${address}@${config.chainId}`;
        }
        return `ethereum:${address}`;
      case 'svm':
        return `solana:${address}`;
      default:
        return address;
    }
  }

  /**
   * Get category information
   * @param {string} chainCategory - 'evm' or 'svm'
   * @returns {Object} - Category information
   */
  getCategoryInfo(chainCategory) {
    const categoryInfo = {
      evm: {
        name: 'Ethereum Virtual Machine',
        description: 'Shared paymaster for all EVM-compatible chains',
        supportedChains: this.getSupportedChains('evm'),
        nativeToken: 'ETH'
      },
      svm: {
        name: 'Solana Virtual Machine',
        description: 'Shared paymaster for all SVM-compatible chains', 
        supportedChains: this.getSupportedChains('svm'),
        nativeToken: 'SOL'
      }
    };
    
    return categoryInfo[chainCategory];
  }
}

module.exports = new WalletGenerator(); 