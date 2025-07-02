const { ethers } = require('ethers');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const PaymasterBalance = require('../models/PaymasterBalance');
const ProjectPaymaster = require('../models/ProjectPaymaster');
const WalletGenerator = require('./walletGenerator');

class BalanceService {
  constructor() {
    this.providers = {};
    this.solanaConnection = null;
    this.priceCache = {};
    this.lastPriceUpdate = 0;
    this.PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    this.initializeProviders();
  }

  /**
   * Initialize blockchain providers
   */
  initializeProviders() {
    // Ethereum provider
    this.providers.ethereum = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    
    // Arbitrum provider
    this.providers.arbitrum = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
    
    // Add other EVM chains
    this.providers.polygon = new ethers.JsonRpcProvider('https://rpc-mumbai.matic.today');
    this.providers.bsc = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545');
    
    // Solana connection
    this.solanaConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    console.log('✅ Balance service providers initialized');
  }

  /**
   * Get current token prices (mock implementation)
   * In production, integrate with CoinGecko, CoinMarketCap, etc.
   */
  async getTokenPrices() {
    const now = Date.now();
    
    // Cache prices for 5 minutes
    if (now - this.lastPriceUpdate < 5 * 60 * 1000 && Object.keys(this.priceCache).length > 0) {
      return this.priceCache;
    }

    try {
      // Mock prices - in production, fetch from price API
      this.priceCache = {
        ethereum: 2000, // ETH price in USD
        arbitrum: 2000, // ETH price (same as Ethereum)
        polygon: 0.8,   // MATIC price in USD
        bsc: 300,       // BNB price in USD
        solana: 100,    // SOL price in USD
        eclipse: 100    // ETH price on Eclipse
      };
      
      this.lastPriceUpdate = now;
      return this.priceCache;
    } catch (error) {
      console.error('Failed to fetch token prices:', error);
      return this.priceCache || {};
    }
  }

  /**
   * Get balance for a specific address and chain
   * @param {string} address - Wallet address
   * @param {string} chain - Chain type
   * @returns {string} - Balance in wei/lamports
   */
  async getChainBalance(address, chain) {
    try {
      // Determine chain category
      const evmChains = ['ethereum', 'arbitrum', 'polygon', 'bsc'];
      const svmChains = ['solana', 'eclipse'];
      
      if (evmChains.includes(chain)) {
        return await this.getEthereumBalance(address, chain);
      } else if (svmChains.includes(chain)) {
        return await this.getSolanaBalance(address);
      } else {
        throw new Error(`Unsupported chain: ${chain}`);
      }
    } catch (error) {
      console.error(`Failed to get balance for ${address} on ${chain}:`, error);
      return '0';
    }
  }

  /**
   * Get EVM balance
   * @param {string} address - Wallet address
   * @param {string} chain - EVM chain name
   * @returns {string} - Balance in wei
   */
  async getEthereumBalance(address, chain) {
    const provider = this.providers[chain];
    if (!provider) {
      throw new Error(`No provider available for ${chain}`);
    }

    const balance = await provider.getBalance(address);
    return balance.toString();
  }

  /**
   * Get SVM balance
   * @param {string} address - Wallet address
   * @returns {string} - Balance in lamports
   */
  async getSolanaBalance(address) {
    if (!this.solanaConnection) {
      throw new Error('Solana connection not available');
    }

    const publicKey = new PublicKey(address);
    const balance = await this.solanaConnection.getBalance(publicKey);
    return balance.toString();
  }

  /**
   * Update balance for a specific paymaster and chain
   * @param {string} projectId - Project ID
   * @param {string} chain - Specific chain to update
   * @returns {Object} - Updated balance object
   */
  async updatePaymasterBalance(projectId, chain) {
    try {
      // Get shared paymaster for this project and chain
      const paymaster = await ProjectPaymaster.findByProjectAndChain(projectId, chain);
      if (!paymaster) {
        throw new Error(`No paymaster found for project ${projectId} on ${chain}`);
      }

      // Get current balance for the shared paymaster address
      const balanceWei = await this.getChainBalance(paymaster.address, chain);
      
      // Get current prices
      const prices = await this.getTokenPrices();
      const tokenPrice = prices[chain] || 0;

      // Find or create balance record for this specific chain
      let balance = await PaymasterBalance.findByProjectAndChain(projectId, chain);
      if (!balance) {
        balance = new PaymasterBalance({
          project_id: projectId,
          chain: chain,
          address: paymaster.address // Same address for all chains in the category
        });
      }

      // Update balance
      balance.updateBalance(balanceWei, tokenPrice);
      await balance.save();

      return balance.toJSON();
    } catch (error) {
      console.error(`Failed to update balance for ${projectId} on ${chain}:`, error);
      throw error;
    }
  }

  /**
   * Update all balances for a project (works with shared paymasters)
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of updated balance objects
   */
  async updateAllProjectBalances(projectId) {
    const paymasters = await ProjectPaymaster.findByProject(projectId);
    const balances = [];

    for (const paymaster of paymasters) {
      try {
        // For each shared paymaster, update balances for all supported chains
        if (paymaster.supported_chains && paymaster.supported_chains.length > 0) {
          for (const chain of paymaster.supported_chains) {
            try {
              const balance = await this.updatePaymasterBalance(projectId, chain);
              balances.push(balance);
            } catch (error) {
              console.error(`Failed to update balance for ${chain} in project ${projectId}:`, error);
            }
          }
        } else {
          // Handle legacy paymasters that might still use the old structure
          console.warn(`Paymaster ${paymaster.id} has no supported_chains. This may be an old record.`);
        }
      } catch (error) {
        console.error(`Failed to process paymaster ${paymaster.id}:`, error);
      }
    }

    return balances;
  }

  /**
   * Get formatted balances for a project
   * @param {string} projectId - Project ID
   * @returns {Object} - Formatted balance data
   */
  async getProjectBalances(projectId) {
    try {
      const balances = await PaymasterBalance.findByProject(projectId);
      const totalUsd = await PaymasterBalance.getTotalUsdValue(projectId);

      // Get paymaster deployment data
      const paymasters = await ProjectPaymaster.findByProject(projectId);
      const paymasterMap = {};
      for (const paymaster of paymasters) {
        for (const chain of paymaster.supported_chains || []) {
          paymasterMap[chain] = paymaster;
        }
      }

      // Format as array with chain property for dashboard compatibility
      const formattedBalances = balances.map(balance => {
        const paymaster = paymasterMap[balance.chain];
        return {
          chain: balance.chain,
          address: balance.address,
          balance: balance.balance_native,
          balance_native: balance.balance_native,
          balance_wei: balance.balance_wei,
          balance_usd: balance.balance_usd,
          symbol: this.getChainSymbol(balance.chain),
          last_updated: balance.last_updated,
          deployment_tx: paymaster ? paymaster.deployment_tx : null,
          contract_address: paymaster ? paymaster.contract_address : null,
          deployment_status: paymaster ? paymaster.deployment_status : 'unknown'
        };
      });

      return {
        balances: formattedBalances,
        total_usd: totalUsd.toFixed(2),
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to get project balances for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get chain symbol for display
   * @param {string} chain - Chain name
   * @returns {string} - Token symbol
   */
  getChainSymbol(chain) {
    const symbols = {
      ethereum: 'ETH',
      arbitrum: 'ETH',
      polygon: 'MATIC',
      bsc: 'BNB',
      solana: 'SOL',
      eclipse: 'ETH'
    };
    return symbols[chain] || 'TOKEN';
  }

  /**
   * Check for low balance alerts
   * @param {number} thresholdUsd - USD threshold for low balance alert
   * @returns {Array} - Array of low balance paymasters
   */
  async checkLowBalances(thresholdUsd = 10) {
    try {
      return await PaymasterBalance.findLowBalances(thresholdUsd);
    } catch (error) {
      console.error('Failed to check low balances:', error);
      return [];
    }
  }

  /**
   * Background job to update all paymaster balances (works with shared paymasters)
   */
  async updateAllBalances() {
    try {
      console.log('🔄 Starting balance update job...');
      
      // Get all shared paymasters
      const paymasters = await ProjectPaymaster.find({ status: 'active' });
      let updated = 0;
      let failed = 0;

      for (const paymaster of paymasters) {
        try {
          // For each shared paymaster, update balances for all its supported chains
          if (paymaster.supported_chains && paymaster.supported_chains.length > 0) {
            for (const chain of paymaster.supported_chains) {
              try {
                await this.updatePaymasterBalance(paymaster.project_id, chain);
                updated++;
              } catch (error) {
                console.error(`Failed to update balance for ${paymaster.project_id} on ${chain}:`, error);
                failed++;
              }
            }
          } else {
            // Skip paymasters without supported_chains (old records)
            console.warn(`Skipping paymaster ${paymaster.id} - no supported_chains (legacy record)`);
            failed++;
          }
        } catch (error) {
          console.error(`Failed to process paymaster ${paymaster.id}:`, error);
          failed++;
        }
      }

      console.log(`✅ Balance update completed. Updated: ${updated}, Failed: ${failed}`);
      
      // Check for low balances and send alerts
      const lowBalances = await this.checkLowBalances();
      if (lowBalances.length > 0) {
        console.log(`⚠️ Found ${lowBalances.length} paymasters with low balances`);
        
        // Log low balance details
        for (const balance of lowBalances) {
          console.log(`Low balance alert: Project ${balance.project_id}, Chain ${balance.chain}, Balance: $${balance.balance_usd}`);
        }
      }

    } catch (error) {
      console.error('❌ Balance update job failed:', error);
    }
  }
}

module.exports = new BalanceService(); 