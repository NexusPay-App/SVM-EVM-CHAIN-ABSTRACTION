const { ethers } = require('ethers');
const { Connection, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const ProjectPaymaster = require('../models/ProjectPaymaster');
const PaymasterPayment = require('../models/PaymasterPayment');
const WalletGenerator = require('./walletGenerator');

class TransactionService {
  constructor() {
    this.providers = {};
    this.solanaConnection = null;
    this.initializeProviders();
  }

  initializeProviders() {
    try {
      // Initialize Ethereum providers with default fallbacks
      if (process.env.ETHEREUM_RPC_URL) {
        this.providers.ethereum = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
      } else {
        this.providers.ethereum = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      }

      if (process.env.ARBITRUM_RPC_URL) {
        this.providers.arbitrum = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
      } else {
        this.providers.arbitrum = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
      }

      // Solana connection
      if (process.env.SOLANA_RPC_URL) {
        this.solanaConnection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
      }

      console.log('✅ Transaction service providers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize transaction service providers:', error);
    }
  }

  /**
   * Execute transaction with project-based paymaster logic
   * @param {Object} params - Transaction parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.chain - Chain type
   * @param {string} params.userWalletAddress - User's wallet address
   * @param {Object} params.transaction - Transaction data
   * @param {boolean} params.usePaymaster - Whether to use paymaster for gas
   * @param {string} params.apiKey - Project API key for validation
   * @returns {Object} - Transaction result
   */
  async executeTransaction({
    projectId,
    chain,
    userWalletAddress,
    transaction,
    usePaymaster = false,
    apiKey
  }) {
    try {
      console.log(`🚀 Executing ${chain} transaction for project ${projectId}, paymaster: ${usePaymaster}`);

      // Validate project and API key
      await this.validateProjectAccess(projectId, apiKey);

      if (usePaymaster) {
        // Route through project's paymaster
        return await this.executeWithPaymaster({
          projectId,
          chain,
          userWalletAddress,
          transaction
        });
      } else {
        // User pays their own gas
        return await this.executeUserPaidTransaction({
          chain,
          userWalletAddress,
          transaction
        });
      }

    } catch (error) {
      console.error(`❌ Transaction execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute transaction with paymaster sponsoring gas
   * @param {Object} params - Paymaster transaction parameters
   */
  async executeWithPaymaster({ projectId, chain, userWalletAddress, transaction }) {
    try {
      // Get project's paymaster for this chain
      const paymaster = await ProjectPaymaster.findByProjectAndChain(projectId, chain);
      if (!paymaster || paymaster.deployment_status !== 'deployed') {
        throw new Error(`No deployed paymaster found for project ${projectId} on ${chain}`);
      }

      console.log(`💰 Using paymaster: ${paymaster.contract_address} for transaction`);

      let txResult;
      if (chain === 'solana') {
        txResult = await this.executeSolanaWithPaymaster(paymaster, userWalletAddress, transaction);
      } else {
        txResult = await this.executeEthereumWithPaymaster(paymaster, userWalletAddress, transaction);
      }

      // Record paymaster payment
      await this.recordPaymasterPayment({
        projectId,
        paymaster,
        userWalletAddress,
        txResult
      });

      return txResult;

    } catch (error) {
      console.error(`❌ Paymaster transaction failed:`, error);
      throw error;
    }
  }

  /**
   * Execute Ethereum/Arbitrum transaction with paymaster
   */
  async executeEthereumWithPaymaster(paymaster, userWalletAddress, transaction) {
    try {
      const provider = this.providers[paymaster.chain];
      if (!provider) {
        throw new Error(`No provider available for ${paymaster.chain}`);
      }

      // Get paymaster wallet for signing
      const paymasterPrivateKey = paymaster.decryptPrivateKey();
      const paymasterWallet = new ethers.Wallet(paymasterPrivateKey, provider);

      // For EIP-4337, we would construct a UserOperation here
      // For now, we'll simulate paymaster paying the gas
      const gasPrice = await provider.getGasPrice();
      const gasEstimate = await provider.estimateGas({
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || 0
      });

      const tx = {
        to: transaction.to,
        data: transaction.data,
        value: transaction.value || 0,
        gasLimit: gasEstimate.mul(120).div(100), // 20% buffer
        gasPrice: gasPrice,
        from: paymasterWallet.address // Paymaster pays gas
      };

      const txResponse = await paymasterWallet.sendTransaction(tx);
      const receipt = await txResponse.wait();

      return {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: gasPrice.toString(),
        gasCost: receipt.gasUsed.mul(gasPrice).toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed'
      };

    } catch (error) {
      console.error(`❌ Ethereum paymaster transaction failed:`, error);
      throw error;
    }
  }

  /**
   * Execute Solana transaction with paymaster
   */
  async executeSolanaWithPaymaster(paymaster, userWalletAddress, transaction) {
    try {
      if (!this.solanaConnection) {
        throw new Error('Solana connection not available');
      }

      // Get paymaster keypair
      const paymasterPrivateKey = paymaster.decryptPrivateKey();
      const privateKeyBytes = Buffer.from(paymasterPrivateKey.replace('0x', ''), 'hex');
      const paymasterKeypair = Keypair.fromSeed(privateKeyBytes.slice(0, 32));

      // Create transaction with paymaster as fee payer
      const tx = new Transaction();
      tx.feePayer = paymasterKeypair.publicKey; // Paymaster pays fees

      // Add user's instructions to transaction
      if (transaction.instructions) {
        transaction.instructions.forEach(instruction => {
          tx.add(instruction);
        });
      }

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.solanaConnection,
        tx,
        [paymasterKeypair], // Paymaster signs to pay fees
        { commitment: 'confirmed' }
      );

      const confirmedTx = await this.solanaConnection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      return {
        txHash: signature,
        blockNumber: confirmedTx?.slot || 0,
        gasUsed: confirmedTx?.meta?.fee || 0,
        gasPrice: '1', // SOL doesn't have gas price concept
        gasCost: (confirmedTx?.meta?.fee || 0).toString(),
        status: confirmedTx?.meta?.err ? 'failed' : 'confirmed'
      };

    } catch (error) {
      console.error(`❌ Solana paymaster transaction failed:`, error);
      throw error;
    }
  }

  /**
   * Execute transaction where user pays their own gas
   */
  async executeUserPaidTransaction({ chain, userWalletAddress, transaction }) {
    try {
      console.log(`👤 User ${userWalletAddress} paying own gas for ${chain} transaction`);

      // This would integrate with user's wallet (MetaMask, Phantom, etc.)
      // For now, we'll return instructions for the client to execute
      return {
        type: 'user_paid',
        chain,
        userWalletAddress,
        transaction,
        instructions: 'User must sign and broadcast this transaction from their wallet',
        estimatedGas: await this.estimateGas(chain, transaction)
      };

    } catch (error) {
      console.error(`❌ User-paid transaction preparation failed:`, error);
      throw error;
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(chain, transaction) {
    try {
      if (chain === 'solana') {
        // Solana fee estimation
        return {
          estimatedFee: 5000, // 5000 lamports ≈ 0.000005 SOL
          currency: 'SOL'
        };
      } else {
        // Ethereum/Arbitrum gas estimation
        const provider = this.providers[chain];
        if (!provider) {
          throw new Error(`No provider for ${chain}`);
        }

        const gasEstimate = await provider.estimateGas({
          to: transaction.to,
          data: transaction.data,
          value: transaction.value || 0
        });

        const gasPrice = await provider.getGasPrice();
        const gasCost = gasEstimate.mul(gasPrice);

        return {
          gasLimit: gasEstimate.toString(),
          gasPrice: gasPrice.toString(),
          estimatedCost: gasCost.toString(),
          currency: 'ETH'
        };
      }
    } catch (error) {
      console.error(`❌ Gas estimation failed for ${chain}:`, error);
      return null;
    }
  }

  /**
   * Record paymaster payment for analytics
   */
  async recordPaymasterPayment({ projectId, paymaster, userWalletAddress, txResult }) {
    try {
      const payment = new PaymasterPayment({
        project_id: projectId,
        paymaster_address: paymaster.contract_address || paymaster.address,
        chain: paymaster.chain,
        amount: ethers.formatEther(txResult.gasCost || '0'),
        amount_wei: txResult.gasCost || '0',
        gas_for_address: userWalletAddress,
        tx_hash: txResult.txHash,
        block_number: txResult.blockNumber,
        gas_price: txResult.gasPrice,
        gas_used: parseInt(txResult.gasUsed || '0'),
        operation_type: 'transaction_sponsor',
        status: txResult.status
      });

      await payment.save();
      console.log(`✅ Recorded paymaster payment: ${txResult.txHash}`);

    } catch (error) {
      console.error(`❌ Failed to record paymaster payment:`, error);
      // Don't throw here as the transaction already succeeded
    }
  }

  /**
   * Validate project access via API key
   */
  async validateProjectAccess(projectId, apiKey) {
    // This would validate the API key belongs to the project
    // Implementation depends on your API key validation system
    if (!apiKey || !apiKey.startsWith(`npay_${projectId}`)) {
      throw new Error('Invalid API key for project');
    }
    return true;
  }

  /**
   * Get project paymaster status
   */
  async getProjectPaymasterStatus(projectId) {
    try {
      const paymasters = await ProjectPaymaster.findByProject(projectId);
      
      const status = {};
      for (const paymaster of paymasters) {
        status[paymaster.chain] = {
          deployed: paymaster.deployment_status === 'deployed',
          contract_address: paymaster.contract_address,
          funding_address: paymaster.address,
          can_sponsor_transactions: paymaster.deployment_status === 'deployed'
        };
      }

      return status;
    } catch (error) {
      console.error(`❌ Failed to get paymaster status for ${projectId}:`, error);
      throw error;
    }
  }
}

module.exports = new TransactionService(); 