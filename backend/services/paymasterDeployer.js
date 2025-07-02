const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const bs58 = require('bs58');
const WalletGenerator = require('./walletGenerator');

// Helper functions to handle different ethers.js versions
const parseEther = (value) => {
  return ethers.utils ? ethers.utils.parseEther(value) : ethers.parseEther(value);
};

const formatEther = (value) => {
  return ethers.utils ? ethers.utils.formatEther(value) : ethers.formatEther(value);
};

const formatUnits = (value, unit) => {
  return ethers.utils ? ethers.utils.formatUnits(value, unit) : ethers.formatUnits(value, unit);
};

const keccak256 = (value) => {
  return ethers.utils ? ethers.utils.keccak256(value) : ethers.keccak256(value);
};

const toUtf8Bytes = (value) => {
  return ethers.utils ? ethers.utils.toUtf8Bytes(value) : ethers.toUtf8Bytes(value);
};

const BigNumber = ethers.BigNumber || ethers.utils?.BigNumber;

class PaymasterDeployer {
  constructor() {
    this.providers = {};
    this.solanaConnection = null;
    this.initializeProviders();
    this.loadContractABIs();
  }

  initializeProviders() {
    try {
      // Ethereum provider - use reliable public endpoint
      const ethereumRPC = process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
      this.providers.ethereum = new ethers.JsonRpcProvider(ethereumRPC);
      console.log(`✅ Ethereum provider: ${ethereumRPC}`);

      // Arbitrum provider - use public endpoint for Arbitrum Sepolia
      const arbitrumRPC = process.env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
      this.providers.arbitrum = new ethers.JsonRpcProvider(arbitrumRPC);
      console.log(`✅ Arbitrum provider: ${arbitrumRPC}`);

      // Solana connection - use QuickNode free tier (more reliable than api.devnet.solana.com)
      const solanaRPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      this.solanaConnection = new Connection(solanaRPC, 'confirmed');
      console.log(`✅ Solana provider: ${solanaRPC}`);

      console.log('✅ Paymaster deployer providers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize paymaster deployer providers:', error);
    }
  }

  loadContractABIs() {
    try {
      // Load contract ABIs from compiled contracts
      const paymasterPath = path.join(__dirname, '../../contracts/evm/artifacts/contracts/Paymaster.sol/Paymaster.json');
      const entryPointPath = path.join(__dirname, '../../contracts/evm/artifacts/contracts/EntryPoint.sol/EntryPoint.json');
      const factoryPath = path.join(__dirname, '../contracts/evm/artifacts/contracts/PaymasterFactory.sol/PaymasterFactory.json');
      
      if (fs.existsSync(paymasterPath)) {
        this.paymasterABI = JSON.parse(fs.readFileSync(paymasterPath, 'utf8'));
        console.log('✅ Loaded Paymaster ABI');
      } else {
        console.warn('⚠️ Paymaster ABI not found, using fallback');
        this.paymasterABI = this.getFallbackPaymasterABI();
      }

      if (fs.existsSync(entryPointPath)) {
        this.entryPointABI = JSON.parse(fs.readFileSync(entryPointPath, 'utf8'));
        console.log('✅ Loaded EntryPoint ABI');
      } else {
        console.warn('⚠️ EntryPoint ABI not found, using fallback');
        this.entryPointABI = this.getFallbackEntryPointABI();
      }

      if (fs.existsSync(factoryPath)) {
        this.factoryABI = JSON.parse(fs.readFileSync(factoryPath, 'utf8'));
        console.log('✅ Loaded PaymasterFactory ABI');
      } else {
        console.warn('⚠️ PaymasterFactory ABI not found, using fallback');
        this.factoryABI = this.getFallbackFactoryABI();
      }

      // Load factory deployment addresses
      this.loadFactoryAddresses();
    } catch (error) {
      console.error('❌ Failed to load contract ABIs:', error);
      this.paymasterABI = this.getFallbackPaymasterABI();
      this.entryPointABI = this.getFallbackEntryPointABI();
      this.factoryABI = this.getFallbackFactoryABI();
    }
  }

  loadFactoryAddresses() {
    try {
      this.factoryAddresses = {};
      const deploymentsDir = path.join(__dirname, '../../contracts/evm/deployments');
      
      // Load factory addresses for each chain
      const chainIds = {
        'ethereum': '11155111', // Sepolia
        'arbitrum': '421614',   // Arbitrum Sepolia
        'polygon': '80001',     // Mumbai
        'bsc': '97'            // BSC Testnet
      };

      for (const [chain, chainId] of Object.entries(chainIds)) {
        const factoryFile = path.join(deploymentsDir, `factory-${chainId}.json`);
        if (fs.existsSync(factoryFile)) {
          const deployment = JSON.parse(fs.readFileSync(factoryFile, 'utf8'));
          this.factoryAddresses[chain] = deployment.factory;
          console.log(`✅ Loaded factory address for ${chain}: ${deployment.factory}`);
        } else {
          console.warn(`⚠️ Factory deployment not found for ${chain} (${factoryFile})`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load factory addresses:', error);
      this.factoryAddresses = {};
    }
  }

  /**
   * Deploy ultra-low-cost paymaster using factory (minimal proxy)
   * @param {string} projectId - Project ID
   * @param {string} chain - Chain type (ethereum, arbitrum)
   * @param {string} ownerPrivateKey - Private key of the owner
   * @returns {Object} - Deployment result
   */
  async deployEthereumPaymaster(projectId, chain, ownerPrivateKey) {
    try {
      const provider = this.providers[chain];
      if (!provider) {
        throw new Error(`No provider available for ${chain}`);
      }

      // Get factory address for this chain
      const factoryAddress = this.factoryAddresses[chain];
      if (!factoryAddress) {
        throw new Error(`No factory deployed for ${chain}. Please deploy factory first.`);
      }

      // Create wallet from private key (this is the paymaster wallet)
      const paymasterWallet = new ethers.Wallet(ownerPrivateKey, provider);
      
      // Get company deployer wallet (factory owner)
      const deployerPrivateKey = process.env.EVM_DEPLOYER_PRIVATE_KEY;
      if (!deployerPrivateKey) {
        throw new Error('EVM_DEPLOYER_PRIVATE_KEY not found in environment');
      }
      const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
      
      console.log(`🏭 Deploying ultra-low-cost paymaster proxy for project ${projectId}...`);
      console.log(`   Factory address: ${factoryAddress}`);
      console.log(`   Paymaster owner: ${paymasterWallet.address}`);
      console.log(`   Deploying via company deployer: ${deployerWallet.address}`);
      
      // Check if paymaster wallet has enough ETH for minimal proxy deployment (~0.002 ETH)
      const balance = await provider.getBalance(paymasterWallet.address);
      const requiredBalance = parseEther('0.002'); // Only 0.002 ETH for proxy deployment!
      
      if (balance.lt && balance.lt(requiredBalance) || balance < requiredBalance) {
        console.log(`💸 Funding paymaster wallet for proxy deployment (${formatEther(requiredBalance)} ETH)...`);
        
        try {
          await this.fundFromDeployerAccount(paymasterWallet.address, chain, '0.002');
          
          // Wait for funding transaction
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const newBalance = await provider.getBalance(paymasterWallet.address);
          console.log(`💰 Funded balance: ${formatEther(newBalance)} ETH`);
          
          if ((newBalance.lt && newBalance.lt(requiredBalance)) || newBalance < requiredBalance) {
            throw new Error(`Still insufficient balance: ${formatEther(newBalance)} ETH`);
          }
        } catch (fundingError) {
          throw new Error(`Funding failed: ${fundingError.message}`);
        }
      }
      
      // Connect to factory contract using deployer (factory owner)
      const factory = new ethers.Contract(factoryAddress, this.factoryABI.abi, deployerWallet);
      
      // Generate deterministic salt for CREATE2
      const salt = keccak256(toUtf8Bytes(`${projectId}_${Date.now()}`));
      
      // Estimate gas for proxy creation
      const estimatedGas = await factory.createPaymaster.estimateGas(
        projectId,
        paymasterWallet.address,
        salt
      );
      
      const gasPrice20Gwei = BigNumber ? BigNumber.from('20000000000') : BigInt('20000000000');
      const gasCostEstimate = estimatedGas.mul ? estimatedGas.mul(gasPrice20Gwei) : BigInt(estimatedGas) * gasPrice20Gwei;
      console.log(`🎯 Estimated gas for proxy: ${estimatedGas.toString()} (~$${(parseFloat(formatEther(gasCostEstimate.toString())) * 2500).toFixed(2)})`);
      
      // Deploy minimal proxy paymaster using company deployer
      const tx = await factory.createPaymaster(
        projectId,
        paymasterWallet.address,
        salt,
        {
          gasLimit: estimatedGas.mul ? estimatedGas.mul(120).div(100) : Math.ceil(Number(estimatedGas) * 1.2) // 20% buffer
        }
      );

      const receipt = await tx.wait();
      
      // Get paymaster address from factory
      const paymasterAddress = await factory.getPaymaster(projectId);
      
      console.log(`✅ Ultra-low-cost paymaster deployed!`);
      console.log(`   Proxy address: ${paymasterAddress}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      
      const totalCost = receipt.gasUsed.mul ? receipt.gasUsed.mul(receipt.gasPrice || receipt.effectiveGasPrice) : BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice || receipt.effectiveGasPrice);
      console.log(`   Total cost: ${formatEther(totalCost.toString())} ETH`);
      
      // Get EntryPoint address
      const entryPointAddress = this.getEntryPointAddress(chain);
      
      return {
        contractAddress: paymasterAddress,
        deploymentTx: tx.hash,
        entryPointAddress: entryPointAddress,
        factoryAddress: factoryAddress,
        gasUsed: receipt.gasUsed.toString(),
        gasCost: formatEther(totalCost.toString()),
        status: 'deployed'
      };

    } catch (error) {
      console.error(`❌ Failed to deploy ultra-low-cost paymaster for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Deploy Solana paymaster program
   * @param {string} projectId - Project ID
   * @param {string} ownerPrivateKey - Private key of the owner (the paymaster wallet private key)
   * @returns {Object} - Deployment result
   */
  async deploySolanaPaymaster(projectId, ownerPrivateKey) {
    try {
      if (!this.solanaConnection) {
        throw new Error('Solana connection not available');
      }

      // Convert hex private key to Solana keypair (the actual paymaster wallet)
      const privateKeyBytes = Buffer.from(ownerPrivateKey.replace('0x', ''), 'hex');
      const paymasterKeypair = Keypair.fromSeed(privateKeyBytes.slice(0, 32));
      const paymasterAddress = paymasterKeypair.publicKey.toString();
      
      console.log(`🚀 Deploying Solana paymaster for project ${projectId}...`);
      console.log(`   Paymaster address: ${paymasterAddress}`);
      
      // Check if paymaster account already exists
      const accountInfo = await this.solanaConnection.getAccountInfo(paymasterKeypair.publicKey);
      
      if (!accountInfo) {
        console.log(`💰 Creating new Solana account for paymaster...`);
        
        // Use our company SVM deployer to fund the paymaster account creation
        try {
          await this.fundFromSVMDeployer(paymasterAddress, 0.01); // Fund with 0.01 SOL for account creation
          console.log(`✅ Funded paymaster account creation from SVM deployer`);
        } catch (fundingError) {
          console.error(`❌ Failed to fund paymaster from SVM deployer:`, fundingError);
          throw new Error(`SVM paymaster deployment failed: ${fundingError.message}`);
        }
        
        // Wait a moment for the funding transaction to be confirmed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify the account now has funds
        const balance = await this.solanaConnection.getBalance(paymasterKeypair.publicKey);
        console.log(`💰 Paymaster account balance: ${balance / 1e9} SOL`);
        
        if (balance < 1e6) { // Less than 0.001 SOL
          throw new Error(`Paymaster account still has insufficient balance: ${balance / 1e9} SOL`);
        }
      } else {
        console.log(`✅ Paymaster account already exists: ${paymasterAddress}`);
      }
      
      // For Solana, the "deployment" is successful once the account is funded and active
      // In a full implementation, you'd deploy an actual Solana program here
      
      const deploymentTx = 'solana_account_created'; // Placeholder for deployment transaction
      
      console.log(`✅ Solana paymaster deployed successfully: ${paymasterAddress}`);

      return {
        contractAddress: paymasterAddress,
        deploymentTx: deploymentTx,
        programId: SystemProgram.programId.toString(),
        status: 'deployed'
      };

    } catch (error) {
      console.error(`❌ Failed to deploy Solana paymaster for ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Stake paymaster in EntryPoint (required for EIP-4337)
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {string} chain - Chain type
   * @param {Object} wallet - Ethers wallet
   */
  async stakePaymaster(paymasterAddress, chain, wallet) {
    try {
      const entryPointAddress = this.getEntryPointAddress(chain);
      const entryPoint = new ethers.Contract(entryPointAddress, this.entryPointABI.abi, wallet);
      
      // Add stake for the paymaster (minimum 0.1 ETH)
      const stakeAmount = parseEther('0.1');
      const unstakeDelay = 86400; // 1 day in seconds
      
      const stakeTx = await entryPoint.addStake(unstakeDelay, {
        value: stakeAmount,
        gasLimit: 500000
      });
      
      await stakeTx.wait();
      console.log(`✅ Paymaster staked in EntryPoint: ${stakeTx.hash}`);
      
    } catch (error) {
      console.error('❌ Failed to stake paymaster:', error);
      // Don't throw here as the paymaster can still work without staking in some cases
    }
  }

  /**
   * Fund a deployed paymaster contract
   * @param {string} paymasterAddress - Paymaster contract address
   * @param {string} chain - Chain type
   * @param {string} amount - Amount to fund (in ETH/SOL)
   * @param {string} fundingPrivateKey - Private key for funding
   */
  async fundPaymaster(paymasterAddress, chain, amount, fundingPrivateKey) {
    try {
      if (chain === 'solana') {
        return await this.fundSolanaPaymaster(paymasterAddress, amount, fundingPrivateKey);
      } else {
        return await this.fundEthereumPaymaster(paymasterAddress, chain, amount, fundingPrivateKey);
      }
    } catch (error) {
      console.error(`❌ Failed to fund paymaster on ${chain}:`, error);
      throw error;
    }
  }

  async fundEthereumPaymaster(paymasterAddress, chain, amount, fundingPrivateKey) {
    const provider = this.providers[chain];
    const wallet = new ethers.Wallet(fundingPrivateKey, provider);
    
    const tx = await wallet.sendTransaction({
      to: paymasterAddress,
      value: parseEther(amount.toString()),
      gasLimit: 21000
    });
    
    await tx.wait();
    console.log(`✅ Funded ${chain} paymaster with ${amount} ETH: ${tx.hash}`);
    
    return tx.hash;
  }

  async fundSolanaPaymaster(paymasterAddress, amount, fundingPrivateKey) {
    const privateKeyBytes = Buffer.from(fundingPrivateKey.replace('0x', ''), 'hex');
    const payer = Keypair.fromSeed(privateKeyBytes.slice(0, 32));
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(paymasterAddress),
        lamports: amount * 1e9 // Convert SOL to lamports
      })
    );

    const signature = await this.solanaConnection.sendTransaction(transaction, [payer]);
    await this.solanaConnection.confirmTransaction(signature);
    
    console.log(`✅ Funded Solana paymaster with ${amount} SOL: ${signature}`);
    return signature;
  }

  /**
   * Get EntryPoint address for a chain
   * @param {string} chain - Chain type
   * @returns {string} - EntryPoint address
   */
  getEntryPointAddress(chain) {
    // Standard EIP-4337 EntryPoint addresses
    const entryPoints = {
      ethereum: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Official EntryPoint v0.6
      arbitrum: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', // Same on Arbitrum
      sepolia: '0x2B08ED54b4c5a3769aBABC55b27d5991D1E4E896',  // Our deployed EntryPoint
    };
    
    return entryPoints[chain] || entryPoints.ethereum;
  }

  /**
   * Fallback Paymaster ABI (minimal implementation)
   */
  getFallbackPaymasterABI() {
    return {
      abi: [
        {
          "inputs": [
            {"internalType": "address", "name": "_entryPoint", "type": "address"},
            {"internalType": "address", "name": "_owner", "type": "address"}
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [
            {"internalType": "UserOperation", "name": "userOp", "type": "tuple"},
            {"internalType": "bytes32", "name": "userOpHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "maxCost", "type": "uint256"}
          ],
          "name": "validatePaymasterUserOp",
          "outputs": [
            {"internalType": "bytes", "name": "context", "type": "bytes"},
            {"internalType": "uint256", "name": "validationData", "type": "uint256"}
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "deposit",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "getDeposit",
          "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      bytecode: "0x608060405234801561001057600080fd5b50604051610abc38038061..." // Truncated for brevity
    };
  }

  /**
   * Fallback EntryPoint ABI (minimal implementation)
   */
  getFallbackEntryPointABI() {
    return {
      abi: [
        {
          "inputs": [{"internalType": "uint32", "name": "unstakeDelay", "type": "uint32"}],
          "name": "addStake",
          "outputs": [],
          "stateMutability": "payable",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
          "name": "getDepositInfo",
          "outputs": [
            {"internalType": "uint256", "name": "deposit", "type": "uint256"},
            {"internalType": "bool", "name": "staked", "type": "bool"},
            {"internalType": "uint112", "name": "stake", "type": "uint112"},
            {"internalType": "uint32", "name": "unstakeDelay", "type": "uint32"},
            {"internalType": "uint48", "name": "withdrawTime", "type": "uint48"}
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    };
  }

  /**
   * Fallback PaymasterFactory ABI (minimal implementation)
   */
  getFallbackFactoryABI() {
    return {
      abi: [
        {
          "inputs": [
            {"internalType": "string", "name": "projectId", "type": "string"},
            {"internalType": "address", "name": "paymasterOwner", "type": "address"},
            {"internalType": "bytes32", "name": "salt", "type": "bytes32"}
          ],
          "name": "createPaymaster",
          "outputs": [{"internalType": "address", "name": "paymasterAddress", "type": "address"}],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [{"internalType": "string", "name": "projectId", "type": "string"}],
          "name": "getPaymaster",
          "outputs": [{"internalType": "address", "name": "", "type": "address"}],
          "stateMutability": "view",
          "type": "function"
        },
        {
          "inputs": [
            {"internalType": "string", "name": "projectId", "type": "string"},
            {"internalType": "bytes32", "name": "salt", "type": "bytes32"}
          ],
          "name": "predictPaymasterAddress",
          "outputs": [{"internalType": "address", "name": "", "type": "address"}],
          "stateMutability": "view",
          "type": "function"
        }
      ]
    };
  }

  /**
   * Request testnet funding from company deployer wallets
   * @param {string} address - Address to fund
   * @param {string} chain - Chain type (ethereum, arbitrum, solana)
   */
  async requestTestnetETH(address, chain) {
    try {
      console.log(`🚰 Attempting to fund ${address} on ${chain}...`);
      
      // Determine if this is an EVM or SVM chain
      const evmChains = ['ethereum', 'arbitrum', 'polygon', 'bsc', 'sepolia'];
      const svmChains = ['solana', 'eclipse'];
      
      if (evmChains.includes(chain)) {
        // Use EVM deployer
        const evmDeployerKey = process.env.EVM_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY; // Backward compatibility
        if (evmDeployerKey) {
          console.log(`💰 Using pre-funded EVM deployer account...`);
          await this.fundFromDeployerAccount(address, chain);
          return;
        }
        
        // No EVM deployer key found
        console.log(`
📋 EVM DEPLOYER FUNDING REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  No EVM_DEPLOYER_PRIVATE_KEY found in environment variables.
    
🎯 To deploy EVM paymasters automatically:

1️⃣  Set up EVM deployer account (RECOMMENDED)
   • Run: node setup-company-deployers.js
   • Fund the EVM deployer wallet: 0.01-0.02 ETH
   • Set EVM_DEPLOYER_PRIVATE_KEY in .env
   • This enables automatic paymaster deployment for ${chain}

2️⃣  Manual funding (temporary)
   • Send 0.002 ETH to: ${address}
   • ${chain === 'ethereum' ? 'Sepolia Faucets: https://sepoliafaucet.com' : 'Use appropriate testnet faucet'}
   • Then retry project creation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
        
        throw new Error(`No EVM deployer configured. Set EVM_DEPLOYER_PRIVATE_KEY or fund ${address} manually.`);
        
      } else if (svmChains.includes(chain)) {
        // Use SVM deployer
        const svmDeployerKey = process.env.SVM_DEPLOYER_PRIVATE_KEY;
        if (svmDeployerKey) {
          console.log(`💰 Using pre-funded SVM deployer account...`);
          await this.fundFromSVMDeployer(address);
          return;
        }
        
        // No SVM deployer key found
        console.log(`
📋 SVM DEPLOYER FUNDING REQUIRED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  No SVM_DEPLOYER_PRIVATE_KEY found in environment variables.
    
🎯 To deploy SVM paymasters automatically:

1️⃣  Set up SVM deployer account (RECOMMENDED)
   • Run: node setup-company-deployers.js
   • Fund the SVM deployer wallet: 2-5 SOL
   • Set SVM_DEPLOYER_PRIVATE_KEY in .env
   • This enables automatic paymaster deployment for ${chain}

2️⃣  Manual funding (temporary)
   • Send 0.01 SOL to: ${address}
   • Solana Devnet Faucet: https://faucet.solana.com
   • Then retry project creation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
        
        throw new Error(`No SVM deployer configured. Set SVM_DEPLOYER_PRIVATE_KEY or fund ${address} manually.`);
        
      } else {
        throw new Error(`Unsupported chain: ${chain}. Supported chains: ${[...evmChains, ...svmChains].join(', ')}`);
      }
      
    } catch (error) {
      console.error(`❌ Funding failed for ${chain}:`, error.message);
      throw error;
    }
  }

  /**
   * Use a pre-funded deployer to send ETH (EVM chains)
   */
  async fundFromDeployerAccount(targetAddress, chain, amount = '0.002') {
    try {
      const deployerPrivateKey = process.env.EVM_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY; // Backward compatibility
      if (!deployerPrivateKey) {
        throw new Error('No EVM deployer private key configured. Set EVM_DEPLOYER_PRIVATE_KEY in .env');
      }
      
      const provider = this.providers[chain];
      const deployerWallet = new ethers.Wallet(deployerPrivateKey, provider);
      
      // Check deployer balance first
      const deployerBalance = await provider.getBalance(deployerWallet.address);
      const fundingAmount = parseEther(amount);
      
      if ((deployerBalance.lt && deployerBalance.lt(fundingAmount)) || deployerBalance < fundingAmount) {
        throw new Error(`EVM deployer ${deployerWallet.address} has insufficient balance: ${formatEther(deployerBalance)} ETH`);
      }
      
      console.log(`💸 Sending ${amount} ETH from EVM deployer ${deployerWallet.address}...`);
      
      const tx = await deployerWallet.sendTransaction({
        to: targetAddress,
        value: fundingAmount,
        gasLimit: 21000
      });
      
      await tx.wait();
      console.log(`✅ Funded ${targetAddress} with ${amount} ETH on ${chain}: ${tx.hash}`);
      
      return tx.hash;
      
    } catch (error) {
      console.error(`❌ EVM deployer funding failed:`, error);
      throw error;
    }
  }

  /**
   * Use a pre-funded deployer to send SOL (SVM chains)
   */
  async fundFromSVMDeployer(targetAddress, amount = '0.01') {
    try {
      const deployerPrivateKey = process.env.SVM_DEPLOYER_PRIVATE_KEY;
      if (!deployerPrivateKey) {
        throw new Error('No SVM deployer private key configured. Set SVM_DEPLOYER_PRIVATE_KEY in .env');
      }

      // Decode the base58 private key for Solana
      const bs58 = require('bs58');
      const { Connection, Keypair, Transaction, SystemProgram, PublicKey } = require('@solana/web3.js');
      
      const deployerKeypair = Keypair.fromSecretKey(bs58.decode(deployerPrivateKey));
      
      // Check deployer balance first
      const deployerBalance = await this.solanaConnection.getBalance(deployerKeypair.publicKey);
      const fundingAmount = amount * 1e9; // Convert SOL to lamports
      
      if (deployerBalance < fundingAmount) {
        throw new Error(`SVM deployer ${deployerKeypair.publicKey.toString()} has insufficient balance: ${deployerBalance / 1e9} SOL`);
      }
      
      console.log(`💸 Sending ${amount} SOL from SVM deployer ${deployerKeypair.publicKey.toString()}...`);
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: deployerKeypair.publicKey,
          toPubkey: new PublicKey(targetAddress),
          lamports: fundingAmount
        })
      );
      
      const signature = await this.solanaConnection.sendTransaction(transaction, [deployerKeypair]);
      await this.solanaConnection.confirmTransaction(signature, 'confirmed');
      
      console.log(`✅ Funded ${targetAddress} with ${amount} SOL: ${signature}`);
      
      return signature;
      
    } catch (error) {
      console.error(`❌ SVM deployer funding failed:`, error);
      throw error;
    }
  }
}

module.exports = new PaymasterDeployer(); 