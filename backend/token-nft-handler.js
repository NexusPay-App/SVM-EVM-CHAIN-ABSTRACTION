const { ethers } = require('ethers');
const crypto = require('crypto');

// Import Solana dependencies
let Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction;
let TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction;
try {
  const solanaWeb3 = require('@solana/web3.js');
  const splToken = require('@solana/spl-token');
  
  Connection = solanaWeb3.Connection;
  Keypair = solanaWeb3.Keypair;
  PublicKey = solanaWeb3.PublicKey;
  Transaction = solanaWeb3.Transaction;
  SystemProgram = solanaWeb3.SystemProgram;
  LAMPORTS_PER_SOL = solanaWeb3.LAMPORTS_PER_SOL;
  sendAndConfirmTransaction = solanaWeb3.sendAndConfirmTransaction;
  
  TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID;
  createTransferInstruction = splToken.createTransferInstruction;
  getAssociatedTokenAddress = splToken.getAssociatedTokenAddress;
  createAssociatedTokenAccountInstruction = splToken.createAssociatedTokenAccountInstruction;
} catch (error) {
  console.warn('Solana dependencies not available for token/NFT operations');
}

// Sample ERC20 ABI for token operations
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// Sample ERC721 ABI for NFT operations
const ERC721_ABI = [
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)'
];

class TokenNFTHandler {
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

  // =============================================================================
  // TOKEN OPERATIONS
  // =============================================================================

  async transferToken(options) {
    try {
      const { from, to, tokenAddress, amount, decimals = 18 } = options;

      if (from.chain !== to.chain) {
        throw new Error('Cross-chain token transfers not supported');
      }

      if (from.chain === 'ethereum') {
        return await this.transferERC20Token(from, to, tokenAddress, amount, decimals);
      } else if (from.chain === 'solana') {
        return await this.transferSPLToken(from, to, tokenAddress, amount);
      } else {
        throw new Error(`Unsupported chain: ${from.chain}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        operation: 'token_transfer'
      };
    }
  }

  async transferERC20Token(from, to, tokenAddress, amount, decimals) {
    const wallet = this.generatePrivateKey(from.socialId, from.socialType, 'ethereum');
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const transferAmount = ethers.parseUnits(amount, decimals);

    const balance = await tokenContract.balanceOf(wallet.address);
    if (balance < transferAmount) {
      throw new Error(`Insufficient token balance. Have ${ethers.formatUnits(balance, decimals)}, need ${amount}`);
    }

    const tx = await tokenContract.transfer(to.address, transferAmount);
    const receipt = await tx.wait();

    return {
      success: true,
      hash: tx.hash,
      from: wallet.address,
      to: to.address,
      amount: amount,
      asset: tokenAddress,
      chain: 'ethereum',
      network: 'sepolia',
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
      timestamp: new Date().toISOString(),
      operation: 'erc20_transfer'
    };
  }

  async transferSPLToken(from, to, tokenAddress, amount) {
    if (!TOKEN_PROGRAM_ID) {
      throw new Error('SPL Token library not available');
    }

    const fromKeypair = this.generatePrivateKey(from.socialId, from.socialType, 'solana');
    const toPublicKey = new PublicKey(to.address);
    const mintPublicKey = new PublicKey(tokenAddress);

    const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, fromKeypair.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);

    const transaction = new Transaction();

    // Check if destination token account exists, create if not
    try {
      await this.solConnection.getAccountInfo(toTokenAccount);
    } catch (error) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey,
          toTokenAccount,
          toPublicKey,
          mintPublicKey
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromKeypair.publicKey,
        amount * Math.pow(10, 9) // Assuming 9 decimals, should be dynamic
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.solConnection,
      transaction,
      [fromKeypair]
    );

    return {
      success: true,
      hash: signature,
      from: fromKeypair.publicKey.toString(),
      to: to.address,
      amount: amount,
      asset: tokenAddress,
      chain: 'solana',
      network: 'devnet',
      status: 'confirmed',
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      timestamp: new Date().toISOString(),
      operation: 'spl_transfer'
    };
  }

  async getTokenBalances(socialId, socialType, chain) {
    try {
      const tokens = [];

      if (!chain || chain === 'ethereum') {
        const ethTokens = await this.getEthereumTokenBalances(socialId, socialType);
        tokens.push(...ethTokens);
      }

      if (!chain || chain === 'solana') {
        const solTokens = await this.getSolanaTokenBalances(socialId, socialType);
        tokens.push(...solTokens);
      }

      return {
        success: true,
        tokens,
        count: tokens.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        tokens: []
      };
    }
  }

  async getEthereumTokenBalances(socialId, socialType) {
    const wallet = this.generatePrivateKey(socialId, socialType, 'ethereum');
    
    const popularTokens = [
      {
        address: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
        symbol: 'LINK',
        name: 'Chainlink Token',
        decimals: 18
      },
      {
        address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        symbol: 'UNI',
        name: 'Uniswap',
        decimals: 18
      }
    ];

    const tokens = [];

    for (const token of popularTokens) {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, this.ethProvider);
        const balance = await contract.balanceOf(wallet.address);
        
        if (balance > 0) {
          tokens.push({
            chain: 'ethereum',
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance: ethers.formatUnits(balance, token.decimals),
            balanceRaw: balance.toString()
          });
        }
      } catch (error) {
        // Skip tokens that fail to load
      }
    }

    return tokens;
  }

  async getSolanaTokenBalances(socialId, socialType) {
    if (!TOKEN_PROGRAM_ID) {
      return [];
    }

    const keypair = this.generatePrivateKey(socialId, socialType, 'solana');
    
    try {
      const tokenAccounts = await this.solConnection.getParsedTokenAccountsByOwner(
        keypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokens = [];
      for (const accountInfo of tokenAccounts.value) {
        const parsedData = accountInfo.account.data.parsed;
        const tokenAmount = parsedData.info.tokenAmount;
        
        if (parseFloat(tokenAmount.uiAmount) > 0) {
          tokens.push({
            chain: 'solana',
            address: parsedData.info.mint,
            decimals: tokenAmount.decimals,
            balance: tokenAmount.uiAmount.toString(),
            balanceRaw: tokenAmount.amount
          });
        }
      }
      
      return tokens;
    } catch (error) {
      return [];
    }
  }

  // =============================================================================
  // NFT OPERATIONS
  // =============================================================================

  async transferNFT(options) {
    try {
      const { from, to, nftContract, tokenId } = options;

      if (from.chain !== to.chain) {
        throw new Error('Cross-chain NFT transfers not supported');
      }

      if (from.chain === 'ethereum') {
        return await this.transferERC721NFT(from, to, nftContract, tokenId);
      } else if (from.chain === 'solana') {
        return await this.transferSolanaNFT(from, to, nftContract, tokenId);
      } else {
        throw new Error(`Unsupported chain: ${from.chain}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        operation: 'nft_transfer'
      };
    }
  }

  async transferERC721NFT(from, to, nftContract, tokenId) {
    const wallet = this.generatePrivateKey(from.socialId, from.socialType, 'ethereum');
    const nftContractInstance = new ethers.Contract(nftContract, ERC721_ABI, wallet);

    const owner = await nftContractInstance.ownerOf(tokenId);
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(`NFT not owned by sender. Owner: ${owner}, Sender: ${wallet.address}`);
    }

    const tx = await nftContractInstance.safeTransferFrom(wallet.address, to.address, tokenId);
    const receipt = await tx.wait();

    return {
      success: true,
      hash: tx.hash,
      from: wallet.address,
      to: to.address,
      nftContract: nftContract,
      tokenId: tokenId,
      chain: 'ethereum',
      network: 'sepolia',
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      explorerUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
      timestamp: new Date().toISOString(),
      operation: 'erc721_transfer'
    };
  }

  async transferSolanaNFT(from, to, nftContract, tokenId) {
    if (!TOKEN_PROGRAM_ID) {
      throw new Error('Solana NFT library not available');
    }

    const fromKeypair = this.generatePrivateKey(from.socialId, from.socialType, 'solana');
    const toPublicKey = new PublicKey(to.address);
    const mintPublicKey = new PublicKey(nftContract);

    const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, fromKeypair.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);

    const transaction = new Transaction();

    try {
      await this.solConnection.getAccountInfo(toTokenAccount);
    } catch (error) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromKeypair.publicKey,
          toTokenAccount,
          toPublicKey,
          mintPublicKey
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromKeypair.publicKey,
        1 // NFTs have amount of 1
      )
    );

    const signature = await sendAndConfirmTransaction(
      this.solConnection,
      transaction,
      [fromKeypair]
    );

    return {
      success: true,
      hash: signature,
      from: fromKeypair.publicKey.toString(),
      to: to.address,
      nftContract: nftContract,
      tokenId: tokenId,
      chain: 'solana',
      network: 'devnet',
      status: 'confirmed',
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      timestamp: new Date().toISOString(),
      operation: 'solana_nft_transfer'
    };
  }

  async getNFTs(socialId, socialType, chain) {
    try {
      const nfts = [];

      if (!chain || chain === 'ethereum') {
        const ethNFTs = await this.getEthereumNFTs(socialId, socialType);
        nfts.push(...ethNFTs);
      }

      if (!chain || chain === 'solana') {
        const solNFTs = await this.getSolanaNFTs(socialId, socialType);
        nfts.push(...solNFTs);
      }

      return {
        success: true,
        nfts,
        count: nfts.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        nfts: []
      };
    }
  }

  async getEthereumNFTs(socialId, socialType) {
    // Real NFT indexing would require services like Alchemy or Moralis
    // For now, return empty array until indexing service is integrated
    return [];
  }

  async getSolanaNFTs(socialId, socialType) {
    if (!TOKEN_PROGRAM_ID) {
      return [];
    }

    const keypair = this.generatePrivateKey(socialId, socialType, 'solana');
    
    try {
      const tokenAccounts = await this.solConnection.getParsedTokenAccountsByOwner(
        keypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const nfts = [];
      for (const accountInfo of tokenAccounts.value) {
        const parsedData = accountInfo.account.data.parsed;
        const tokenAmount = parsedData.info.tokenAmount;
        
        // NFTs typically have decimals = 0 and amount = 1
        if (tokenAmount.decimals === 0 && tokenAmount.uiAmount === 1) {
          nfts.push({
            chain: 'solana',
            mint: parsedData.info.mint,
            owner: keypair.publicKey.toString()
          });
        }
      }
      
      return nfts;
    } catch (error) {
      return [];
    }
  }

  async deployToken(options) {
    throw new Error('Token deployment requires contract compilation and deployment infrastructure');
  }

  async deployNFTCollection(options) {
    throw new Error('NFT collection deployment requires contract compilation and deployment infrastructure');
  }

  async getTransactionHistory(socialId, socialType, options = {}) {
    // Transaction history requires indexing service integration
    return {
      success: true,
      transactions: [],
      total: 0,
      limit: options.limit || 50,
      offset: options.offset || 0,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = TokenNFTHandler; 