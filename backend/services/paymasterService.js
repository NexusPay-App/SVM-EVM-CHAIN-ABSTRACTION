const ProjectPaymaster = require('../models/ProjectPaymaster');
const PaymasterBalance = require('../models/PaymasterBalance');
const WalletGenerator = require('./walletGenerator');
const BalanceService = require('./balanceService');
const PaymasterDeployer = require('./paymasterDeployer');

class PaymasterService {
  /**
   * Create shared paymasters for a new project (1 EVM paymaster, 1 SVM paymaster)
   * @param {string} projectId - Project ID
   * @param {Array} chains - Array of requested chains
   * @returns {Array} - Array of created paymaster objects
   */
  async createProjectPaymasters(projectId, chains) {
    console.log(`🔄 Creating shared paymasters for project ${projectId} with chains: ${chains.join(', ')}`);
    
    // Group chains by category
    const chainCategories = this.groupChainsByCategory(chains);
    console.log(`📊 Chain categories needed:`, chainCategories);
    
    const createdPaymasters = [];

    for (const [category, categoryChains] of Object.entries(chainCategories)) {
      try {
        // Check if paymaster already exists for this project and category
        const existingPaymaster = await ProjectPaymaster.findByProjectAndCategory(projectId, category);
        if (existingPaymaster) {
          console.log(`⚠️ ${category.toUpperCase()} paymaster already exists for project ${projectId}`);
          
          // Update supported chains if new ones were added
          const updatedChains = [...new Set([...existingPaymaster.supported_chains, ...categoryChains])];
          if (updatedChains.length > existingPaymaster.supported_chains.length) {
            existingPaymaster.supported_chains = updatedChains;
            await existingPaymaster.save();
            console.log(`✅ Updated ${category.toUpperCase()} paymaster supported chains:`, updatedChains);
          }
          
          createdPaymasters.push(existingPaymaster.toJSON());
          continue;
        }

        // Select primary deployment chain (first chain in the category)
        const primaryChain = categoryChains[0];
        
        // Generate wallet for this category
        const walletData = WalletGenerator.generatePaymasterWallet(projectId, category);

        // Create shared paymaster record
        const paymaster = new ProjectPaymaster({
          project_id: projectId,
          chain_category: category,
          supported_chains: categoryChains,
          primary_deployment_chain: primaryChain,
          address: walletData.address
        });

        // Encrypt and store private key
        paymaster.encryptPrivateKey(walletData.privateKey);
        await paymaster.save();

        // Create balance records for each supported chain
        for (const chain of categoryChains) {
          const balance = new PaymasterBalance({
            project_id: projectId,
            chain: chain,
            address: walletData.address
          });
          await balance.save();
        }

        console.log(`✅ Created ${category.toUpperCase()} paymaster for project ${projectId}:`);
        console.log(`   Address: ${walletData.address}`);
        console.log(`   Supported chains: ${categoryChains.join(', ')}`);
        console.log(`   Primary deployment: ${primaryChain}`);
        
        // Deploy the actual paymaster contract on the primary chain
        try {
          await this.deploySharedPaymasterContract(paymaster, walletData.privateKey);
        } catch (deployError) {
          console.error(`❌ Failed to deploy ${category.toUpperCase()} paymaster contract:`, deployError);
          paymaster.deployment_status = 'failed';
          await paymaster.save();
        }

        createdPaymasters.push(paymaster.toJSON());

      } catch (error) {
        console.error(`❌ Failed to create ${category.toUpperCase()} paymaster for project ${projectId}:`, error);
        // Continue with other categories even if one fails
      }
    }

    // Initial balance update (async, don't wait)
    setTimeout(() => {
      this.updateProjectBalances(projectId);
    }, 5000);

    return createdPaymasters;
  }

  /**
   * Group chains by their category (EVM/SVM)
   * @param {Array} chains - Array of chain names
   * @returns {Object} - Object with categories as keys and chain arrays as values
   */
  groupChainsByCategory(chains) {
    const categories = {};
    
    for (const chain of chains) {
      try {
        const category = ProjectPaymaster.getChainCategory(chain);
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(chain);
      } catch (error) {
        console.warn(`⚠️ Unsupported chain: ${chain}`);
      }
    }
    
    return categories;
  }

  /**
   * Deploy shared paymaster contract on the primary chain
   * @param {Object} paymaster - Paymaster model instance
   * @param {string} privateKey - Private key for deployment
   */
  async deploySharedPaymasterContract(paymaster, privateKey) {
    try {
      console.log(`🚀 Deploying ${paymaster.chain_category.toUpperCase()} paymaster contract on ${paymaster.primary_deployment_chain}...`);
      
      let deploymentResult;
      
      if (paymaster.chain_category === 'svm') {
        deploymentResult = await PaymasterDeployer.deploySolanaPaymaster(paymaster.project_id, privateKey);
      } else if (paymaster.chain_category === 'evm') {
        deploymentResult = await PaymasterDeployer.deployEthereumPaymaster(
          paymaster.project_id, 
          paymaster.primary_deployment_chain, 
          privateKey
        );
      } else {
        throw new Error(`Unsupported chain category: ${paymaster.chain_category}`);
      }

      // Update paymaster with deployment info
      paymaster.contract_address = deploymentResult.contractAddress;
      paymaster.deployment_tx = deploymentResult.deploymentTx;
      paymaster.entry_point_address = deploymentResult.entryPointAddress;
      paymaster.deployment_status = 'deployed';
      
      await paymaster.save();
      
      console.log(`✅ Successfully deployed ${paymaster.chain_category.toUpperCase()} paymaster:`);
      console.log(`   Contract: ${deploymentResult.contractAddress}`);
      console.log(`   Supports: ${paymaster.supported_chains.join(', ')}`);
      
      return deploymentResult;
      
    } catch (error) {
      console.error(`❌ Failed to deploy shared paymaster contract:`, error);
      paymaster.deployment_status = 'failed';
      await paymaster.save();
      throw error;
    }
  }

  /**
   * Update balances for a project
   * @param {string} projectId - Project ID
   */
  async updateProjectBalances(projectId) {
    try {
      await BalanceService.updateAllProjectBalances(projectId);
    } catch (error) {
      console.error(`Failed to update balances for project ${projectId}:`, error);
    }
  }

  /**
   * Get paymaster addresses for a project
   * @param {string} projectId - Project ID
   * @returns {Object} - Object with chain addresses (shared addresses for category chains)
   */
  async getProjectPaymasterAddresses(projectId) {
    const paymasters = await ProjectPaymaster.findByProject(projectId);
    
    const addresses = {};
    for (const paymaster of paymasters) {
      // Map each supported chain to the shared paymaster address
      for (const chain of paymaster.supported_chains) {
        addresses[chain] = paymaster.address;
      }
    }

    return addresses;
  }

  /**
   * Check if project has paymasters for all requested chains
   * @param {string} projectId - Project ID
   * @param {Array} chains - Required chains
   * @returns {boolean} - True if all chains are covered by paymasters
   */
  async hasAllPaymasters(projectId, chains) {
    const paymasters = await ProjectPaymaster.findByProject(projectId);
    
    // Get all supported chains from existing paymasters
    const supportedChains = [];
    for (const paymaster of paymasters) {
      supportedChains.push(...paymaster.supported_chains);
    }
    
    // Check if all requested chains are supported
    return chains.every(chain => supportedChains.includes(chain));
  }

  /**
   * Add support for new chains (updates existing paymasters)
   * @param {string} projectId - Project ID
   * @param {Array} newChains - New chains to add support for
   * @returns {Array} - Updated paymaster objects
   */
  async addChainSupport(projectId, newChains) {
    console.log(`🔄 Adding support for new chains: ${newChains.join(', ')}`);
    
    const updatedPaymasters = [];
    const chainCategories = this.groupChainsByCategory(newChains);
    
    for (const [category, categoryChains] of Object.entries(chainCategories)) {
      const existingPaymaster = await ProjectPaymaster.findByProjectAndCategory(projectId, category);
      
      if (existingPaymaster) {
        // Add new chains to existing paymaster
        const currentChains = existingPaymaster.supported_chains;
        const updatedChains = [...new Set([...currentChains, ...categoryChains])];
        
        if (updatedChains.length > currentChains.length) {
          existingPaymaster.supported_chains = updatedChains;
          await existingPaymaster.save();
          
          // Create balance records for new chains
          for (const chain of categoryChains) {
            if (!currentChains.includes(chain)) {
              const balance = new PaymasterBalance({
                project_id: projectId,
                chain: chain,
                address: existingPaymaster.address
              });
              await balance.save();
            }
          }
          
          console.log(`✅ Updated ${category.toUpperCase()} paymaster with new chains: ${categoryChains.join(', ')}`);
        }
        
        updatedPaymasters.push(existingPaymaster.toJSON());
      } else {
        // Create new paymaster for this category
        const newPaymasters = await this.createProjectPaymasters(projectId, categoryChains);
        updatedPaymasters.push(...newPaymasters);
      }
    }
    
    return updatedPaymasters;
  }

  /**
   * Get paymaster wallet for signing transactions (works for any chain in the category)
   * @param {string} projectId - Project ID
   * @param {string} chain - Chain type
   * @returns {Object} - { address, privateKey, category }
   */
  async getPaymasterWallet(projectId, chain) {
    const paymaster = await ProjectPaymaster.findByProjectAndChain(projectId, chain);
    if (!paymaster) {
      throw new Error(`No paymaster found for project ${projectId} on ${chain}`);
    }

    const privateKey = paymaster.decryptPrivateKey();
    return {
      address: paymaster.address,
      privateKey: privateKey,
      category: paymaster.chain_category,
      supportedChains: paymaster.supported_chains
    };
  }

  /**
   * Check paymaster health and send alerts if needed
   * @param {string} projectId - Project ID (optional, checks all if not provided)
   */
  async checkPaymasterHealth(projectId = null) {
    try {
      const query = projectId ? { project_id: projectId } : {};
      const lowBalances = await PaymasterBalance.find({
        ...query,
        balance_usd: { $lt: 10 } // Less than $10
      });

      for (const balance of lowBalances) {
        console.log(`⚠️ Low balance alert: ${balance.chain} paymaster for project ${balance.project_id} has ${balance.balance_native} ${balance.chain.toUpperCase()}`);
        // Here you could implement email alerts, Slack notifications, etc.
      }

    } catch (error) {
      console.error('Failed to check paymaster health:', error);
    }
  }

  /**
   * Get paymaster statistics for a project
   * @param {string} projectId - Project ID
   * @returns {Object} - Stats object
   */
  async getPaymasterStats(projectId) {
    try {
      const paymasters = await ProjectPaymaster.findByProject(projectId);
      const balances = await PaymasterBalance.find({ project_id: projectId });

      const stats = {
        total_paymasters: paymasters.length,
        categories: {},
        total_balance_usd: 0,
        chains_supported: 0
      };

      // Group by categories
      for (const paymaster of paymasters) {
        const category = paymaster.chain_category;
        if (!stats.categories[category]) {
          stats.categories[category] = {
            address: paymaster.address,
            supported_chains: paymaster.supported_chains,
            deployment_status: paymaster.deployment_status,
            contract_address: paymaster.contract_address
          };
        }
      }

      // Calculate total balance
      for (const balance of balances) {
        stats.total_balance_usd += parseFloat(balance.balance_usd || 0);
      }

      // Count total unique chains
      const allChains = new Set();
      for (const paymaster of paymasters) {
        paymaster.supported_chains.forEach(chain => allChains.add(chain));
      }
      stats.chains_supported = allChains.size;

      return stats;

    } catch (error) {
      console.error('Failed to get paymaster stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Retry failed deployments for a project
   * @param {string} projectId - Project ID
   * @returns {Array} - Array of retry results
   */
  async retryFailedDeployments(projectId) {
    try {
      const failedPaymasters = await ProjectPaymaster.find({ 
        project_id: projectId, 
        deployment_status: 'failed' 
      });

      const results = [];
      
      for (const paymaster of failedPaymasters) {
        try {
          const privateKey = paymaster.decryptPrivateKey();
          await this.deploySharedPaymasterContract(paymaster, privateKey);
          results.push({ category: paymaster.chain_category, success: true });
        } catch (error) {
          results.push({ category: paymaster.chain_category, success: false, error: error.message });
        }
      }

      return results;

    } catch (error) {
      console.error('Failed to retry deployments:', error);
      return [{ success: false, error: error.message }];
    }
  }

  /**
   * Clean up failed project (delete paymasters and balances)
   * @param {string} projectId - Project ID
   */
  async cleanupFailedProject(projectId) {
    try {
      console.log(`🧹 Cleaning up paymasters for failed project ${projectId}...`);
      
      // Delete paymaster records
      const deletedPaymasters = await ProjectPaymaster.deleteMany({ project_id: projectId });
      console.log(`   Deleted ${deletedPaymasters.deletedCount} paymaster records`);
      
      // Delete balance records
      const deletedBalances = await PaymasterBalance.deleteMany({ project_id: projectId });
      console.log(`   Deleted ${deletedBalances.deletedCount} balance records`);
      
      console.log(`✅ Cleanup completed for project ${projectId}`);
      
    } catch (error) {
      console.error('Failed to cleanup failed project:', error);
      throw error;
    }
  }
}

module.exports = new PaymasterService(); 