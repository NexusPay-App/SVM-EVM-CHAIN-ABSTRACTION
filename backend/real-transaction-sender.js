const { ethers } = require('ethers');
const crypto = require('crypto');

// Import Solana dependencies
let Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction;
try {
  const solanaWeb3 = require('@solana/web3.js');
  Connection = solanaWeb3.Connection;
  Keypair = solanaWeb3.Keypair;
  PublicKey = solanaWeb3.PublicKey;
  Transaction = solanaWeb3.Transaction;
  SystemProgram = solanaWeb3.SystemProgram;
  LAMPORTS_PER_SOL = solanaWeb3.LAMPORTS_PER_SOL;
  sendAndConfirmTransaction = solanaWeb3.sendAndConfirmTransaction;
} catch (error) {
  console.warn('⚠️  Solana dependencies not available for real transactions');
}

class RealTransactionSender {
  constructor() {
    // Initialize providers
    this.ethProvider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    this.solConnection = new Connection('https://api.devnet.solana.com', 'confirmed');
  }

  // Generate the same deterministic private key as blockchain-integration.js
  generatePrivateKey(socialId, socialType, chain = 'ethereum') {
    if (chain === 'solana') {
      const seed = crypto.createHash('sha256')
        .update(socialId + socialType + 'nexuspay-solana')
        .digest();
      return Keypair.fromSeed(seed.slice(0, 32));
    } else {
      // Ethereum/EVM chains
      const seed = crypto.createHash('sha256').update(socialId + socialType + 'nexuspay').digest();
      const privateKey = '0x' + seed.toString('hex');
      return new ethers.Wallet(privateKey, this.ethProvider);
    }
  }

  // Send real Ethereum transaction
  async sendEthereumTransaction(socialId, socialType, toAddress, amountETH) {
    try {
      console.log(`🔥 SENDING REAL ETHEREUM TRANSACTION`);
      console.log(`   Social ID: ${socialId}`);
      console.log(`   To: ${toAddress}`);
      console.log(`   Amount: ${amountETH} ETH`);

      // Get the wallet with private key
      const wallet = this.generatePrivateKey(socialId, socialType, 'ethereum');
      
      console.log(`   From: ${wallet.address}`);

      // Check balance first
      const balance = await wallet.provider.getBalance(wallet.address);
      const balanceETH = parseFloat(ethers.formatEther(balance));
      
      console.log(`   Current Balance: ${balanceETH} ETH`);

      if (balanceETH < parseFloat(amountETH) + 0.001) { // Need extra for gas
        throw new Error(`Insufficient balance. Have ${balanceETH} ETH, need ${parseFloat(amountETH) + 0.001} ETH`);
      }

      // Create transaction
      const tx = {
        to: toAddress,
        value: ethers.parseEther(amountETH),
        gasLimit: 21000,
      };

      // Get current gas price
      const feeData = await wallet.provider.getFeeData();
      tx.gasPrice = feeData.gasPrice;

      console.log(`   Gas Price: ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
      console.log(`   Estimated Fee: ${ethers.formatEther(feeData.gasPrice * BigInt(21000))} ETH`);

      // Send transaction
      console.log(`🚀 Broadcasting transaction...`);
      const txResponse = await wallet.sendTransaction(tx);
      
      console.log(`✅ Transaction sent!`);
      console.log(`   TX Hash: ${txResponse.hash}`);
      console.log(`   Waiting for confirmation...`);

      // Wait for confirmation
      const receipt = await txResponse.wait();

      console.log(`🎉 Transaction confirmed!`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed}`);
      console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);

      return {
        success: true,
        hash: txResponse.hash,
        from: wallet.address,
        to: toAddress,
        amount: amountETH,
        asset: 'ETH',
        chain: 'ethereum',
        network: 'sepolia',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: feeData.gasPrice.toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        explorerUrl: `https://sepolia.etherscan.io/tx/${txResponse.hash}`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Ethereum transaction failed:`, error.message);
      return {
        success: false,
        error: error.message,
        chain: 'ethereum'
      };
    }
  }

  // Send real Solana transaction
  async sendSolanaTransaction(socialId, socialType, toAddress, amountSOL) {
    try {
      console.log(`🔥 SENDING REAL SOLANA TRANSACTION`);
      console.log(`   Social ID: ${socialId}`);
      console.log(`   To: ${toAddress}`);
      console.log(`   Amount: ${amountSOL} SOL`);

      // Get the wallet keypair
      const fromKeypair = this.generatePrivateKey(socialId, socialType, 'solana');
      
      console.log(`   From: ${fromKeypair.publicKey.toString()}`);

      // Check balance first
      const balance = await this.solConnection.getBalance(fromKeypair.publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      
      console.log(`   Current Balance: ${balanceSOL} SOL`);

      const sendAmount = parseFloat(amountSOL);
      if (balanceSOL < sendAmount + 0.001) { // Need extra for fees
        throw new Error(`Insufficient balance. Have ${balanceSOL} SOL, need ${sendAmount + 0.001} SOL`);
      }

      // Create transaction
      const toPublicKey = new PublicKey(toAddress);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: sendAmount * LAMPORTS_PER_SOL,
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.solConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      console.log(`🚀 Broadcasting transaction...`);

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.solConnection,
        transaction,
        [fromKeypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed',
        }
      );

      console.log(`✅ Transaction confirmed!`);
      console.log(`   Signature: ${signature}`);

      // Get transaction details
      const txDetails = await this.solConnection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      return {
        success: true,
        hash: signature,
        from: fromKeypair.publicKey.toString(),
        to: toAddress,
        amount: amountSOL,
        asset: 'SOL',
        chain: 'solana',
        network: 'devnet',
        blockNumber: txDetails?.slot || null,
        fee: (txDetails?.meta?.fee || 5000) / LAMPORTS_PER_SOL,
        status: 'confirmed',
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Solana transaction failed:`, error.message);
      return {
        success: false,
        error: error.message,
        chain: 'solana'
      };
    }
  }

  // Main function to send real transactions
  async sendRealTransaction(socialId, socialType, chain, toAddress, amount, asset) {
    console.log(`\n🔥 SENDING REAL BLOCKCHAIN TRANSACTION`);
    console.log(`═══════════════════════════════════════════════════════`);

    if (chain === 'ethereum' && asset === 'ETH') {
      return await this.sendEthereumTransaction(socialId, socialType, toAddress, amount);
    } else if (chain === 'solana' && asset === 'SOL') {
      return await this.sendSolanaTransaction(socialId, socialType, toAddress, amount);
    } else {
      return {
        success: false,
        error: `Unsupported chain/asset combination: ${chain}/${asset}`,
        chain
      };
    }
  }

  // Get wallet balance
  async getWalletBalance(socialId, socialType, chain) {
    try {
      if (chain === 'ethereum') {
        const wallet = this.generatePrivateKey(socialId, socialType, 'ethereum');
        const balance = await wallet.provider.getBalance(wallet.address);
        return {
          address: wallet.address,
          balance: ethers.formatEther(balance),
          asset: 'ETH'
        };
      } else if (chain === 'solana') {
        const keypair = this.generatePrivateKey(socialId, socialType, 'solana');
        const balance = await this.solConnection.getBalance(keypair.publicKey);
        return {
          address: keypair.publicKey.toString(),
          balance: (balance / LAMPORTS_PER_SOL).toString(),
          asset: 'SOL'
        };
      }
    } catch (error) {
      console.error(`❌ Balance check failed for ${chain}:`, error.message);
      return {
        error: error.message,
        chain
      };
    }
  }
}

module.exports = RealTransactionSender; 