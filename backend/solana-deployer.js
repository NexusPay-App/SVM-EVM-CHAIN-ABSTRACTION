const { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const crypto = require('crypto');

class SolanaWalletDeployer {
  constructor() {
    // Use devnet for testing (change to mainnet-beta for production)
    this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    this.deployer = null;
    this.isReady = false;
  }

  async initialize() {
    if (process.env.SOLANA_DEPLOYER_PRIVATE_KEY) {
      // Load deployer from private key
      const privateKeyBytes = Buffer.from(process.env.SOLANA_DEPLOYER_PRIVATE_KEY, 'hex');
      this.deployer = Keypair.fromSecretKey(privateKeyBytes);
    } else {
      // Generate a new deployer keypair
      this.deployer = Keypair.generate();
      console.log('🔑 Generated new Solana deployer keypair');
      console.log('📋 Public Key:', this.deployer.publicKey.toString());
      console.log('🔐 Private Key:', Buffer.from(this.deployer.secretKey).toString('hex'));
      console.log('💰 Fund this address at: https://faucet.solana.com/');
    }

    // Check balance
    const balance = await this.connection.getBalance(this.deployer.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Solana deployer balance: ${balanceSOL} SOL`);
    this.isReady = balance > 0.01 * LAMPORTS_PER_SOL; // Need at least 0.01 SOL
    
    if (this.isReady) {
      console.log('✅ Solana deployer ready');
    } else {
      console.log('⚠️  Solana deployer needs funding (minimum 0.01 SOL)');
    }
  }

  generateSolanaWallet(socialId, socialType) {
    // Generate deterministic keypair from social credentials
    const seed = crypto.createHash('sha256')
      .update(socialId + socialType + 'nexuspay-solana')
      .digest();
    
    // Use first 32 bytes as seed for Solana keypair
    const keypair = Keypair.fromSeed(seed.slice(0, 32));
    
    return {
      publicKey: keypair.publicKey.toString(),
      secretKey: Buffer.from(keypair.secretKey).toString('hex'),
      keypair
    };
  }

  async deploySolanaWallet(socialId, socialType) {
    await this.initialize();
    
    const walletInfo = this.generateSolanaWallet(socialId, socialType);
    const walletPublicKey = new PublicKey(walletInfo.publicKey);
    
    // Check if wallet already has funds/exists
    const balance = await this.connection.getBalance(walletPublicKey);
    
    if (balance > 0) {
      return {
        address: walletInfo.publicKey,
        balance: balance / LAMPORTS_PER_SOL,
        isDeployed: true,
        status: 'already_exists',
        explorerUrl: `https://explorer.solana.com/address/${walletInfo.publicKey}?cluster=devnet`
      };
    }

    if (!this.isReady) {
      return {
        address: walletInfo.publicKey,
        balance: 0,
        isDeployed: false,
        status: 'needs_funding',
        deployerAddress: this.deployer.publicKey.toString(),
        fundingUrl: 'https://faucet.solana.com/',
        explorerUrl: `https://explorer.solana.com/address/${walletInfo.publicKey}?cluster=devnet`
      };
    }

    try {
      // Create and fund the wallet with a small amount (0.001 SOL)
      const fundAmount = 0.001 * LAMPORTS_PER_SOL;
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.deployer.publicKey,
          toPubkey: walletPublicKey,
          lamports: fundAmount
        })
      );

      console.log(`🚀 Creating Solana wallet for ${socialType}:${socialId}...`);
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.deployer]
      );

      console.log(`✅ Solana wallet created: ${walletInfo.publicKey}`);
      console.log(`📋 Transaction: ${signature}`);

      return {
        address: walletInfo.publicKey,
        balance: fundAmount / LAMPORTS_PER_SOL,
        isDeployed: true,
        status: 'deployed',
        txHash: signature,
        explorerUrl: `https://explorer.solana.com/address/${walletInfo.publicKey}?cluster=devnet`,
        txUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      };

    } catch (error) {
      console.error('❌ Solana wallet deployment failed:', error.message);
      
      return {
        address: walletInfo.publicKey,
        balance: 0,
        isDeployed: false,
        status: 'deployment_failed',
        error: error.message,
        explorerUrl: `https://explorer.solana.com/address/${walletInfo.publicKey}?cluster=devnet`
      };
    }
  }
}

module.exports = new SolanaWalletDeployer();
