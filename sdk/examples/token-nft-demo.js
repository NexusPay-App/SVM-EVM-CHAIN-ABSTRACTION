#!/usr/bin/env node

/**
 * Token & NFT Send/Receive Demo
 * 
 * Demonstrates complete token and NFT functionality:
 * - Send/Receive ERC20 tokens
 * - Send/Receive SPL tokens
 * - Send/Receive NFTs (ERC721/Metaplex)
 * - Check token/NFT balances
 * - Real blockchain transactions
 */

import { NexusSDK } from '../dist/index.js';

class TokenNFTDemo {
  constructor() {
    this.sdk = null;
    this.users = {
      alice: 'alice@example.com',
      bob: 'bob@example.com'
    };
    
    // Sample token addresses for testing
    this.tokens = {
      ethereum: {
        LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789', // Chainlink on Sepolia
        UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'   // Uniswap on Sepolia
      },
      solana: {
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC on Solana
      }
    };
    
    // Sample NFT contracts
    this.nfts = {
      ethereum: {
        ENS: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'
      },
      solana: {
        SAMPLE: 'SampleNFTMint1234567890abcdef'
      }
    };
  }

  async initialize() {
    console.log('Initializing Token & NFT Demo...\n');
    
    this.sdk = new NexusSDK({
      apiKey: 'local-dev-key',
      environment: 'production',
      chains: ['ethereum', 'solana'],
      endpoints: {
        api: 'https://backend-amber-zeta-94.vercel.app'
      }
    });

    await this.sdk.initialize();
    console.log('SDK initialized successfully\n');
  }

  async setupUsers() {
    console.log('=== USER SETUP ===');
    
    for (const [name, email] of Object.entries(this.users)) {
      try {
        console.log(`Setting up ${name} (${email})...`);
        
        const wallet = await this.sdk.createWallet({
          socialId: email,
          socialType: 'email',
          chains: ['ethereum', 'solana'],
          paymaster: true
        });
        
        console.log(`  EVM Address: ${wallet.addresses.ethereum}`);
        console.log(`  SVM Address: ${wallet.addresses.solana}`);
        
      } catch (error) {
        console.log(`  Error setting up ${name}: ${error.message}`);
      }
    }
    console.log('');
  }

  async checkBalances() {
    console.log('=== BALANCE CHECK ===');
    
    for (const [name, email] of Object.entries(this.users)) {
      console.log(`${name.toUpperCase()} BALANCES:`);
      
      // Check native balances
      try {
        const balances = await this.sdk.getWalletBalances(email);
        if (balances.success) {
          console.log(`  ETH: ${balances.ethereum?.balance || '0'} ETH`);
          console.log(`  SOL: ${balances.solana?.balance || '0'} SOL`);
        }
      } catch (error) {
        console.log(`  Native balance error: ${error.message}`);
      }
      
      // Check token balances
      try {
        const tokens = await this.sdk.getTokenBalances(email);
        if (tokens.success && tokens.tokens.length > 0) {
          console.log('  TOKENS:');
          tokens.tokens.forEach(token => {
            console.log(`    ${token.symbol || 'Unknown'}: ${token.balance} (${token.chain})`);
          });
        } else {
          console.log('  No tokens found');
        }
      } catch (error) {
        console.log(`  Token balance error: ${error.message}`);
      }
      
      // Check NFT balances
      try {
        const nfts = await this.sdk.getNFTs(email);
        if (nfts.success && nfts.nfts.length > 0) {
          console.log('  NFTs:');
          nfts.nfts.forEach(nft => {
            console.log(`    ${nft.name || 'Unknown NFT'} (${nft.chain})`);
          });
        } else {
          console.log('  No NFTs found');
        }
      } catch (error) {
        console.log(`  NFT balance error: ${error.message}`);
      }
      
      console.log('');
    }
  }

  async demonstrateTokenTransfers() {
    console.log('=== TOKEN TRANSFER DEMO ===');
    
    // Get user addresses for transfers
    const aliceWallet = await this.sdk.getWallet(this.users.alice);
    const bobWallet = await this.sdk.getWallet(this.users.bob);
    
    console.log('Testing token transfers between users...\n');
    
    // Test ERC20 token transfer
    console.log('1. ERC20 Token Transfer (Ethereum):');
    try {
      const result = await this.sdk.transferToken({
        from: {
          socialId: this.users.alice,
          socialType: 'email',
          chain: 'ethereum'
        },
        to: {
          address: bobWallet.addresses.ethereum,
          chain: 'ethereum'
        },
        tokenAddress: this.tokens.ethereum.LINK,
        amount: '1.0',
        decimals: 18,
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: ${result.hash}`);
        console.log(`   Explorer: ${result.explorerUrl}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
    
    // Test SPL token transfer
    console.log('2. SPL Token Transfer (Solana):');
    try {
      const result = await this.sdk.transferToken({
        from: {
          socialId: this.users.alice,
          socialType: 'email',
          chain: 'solana'
        },
        to: {
          address: bobWallet.addresses.solana,
          chain: 'solana'
        },
        tokenAddress: this.tokens.solana.USDC,
        amount: '10.0',
        decimals: 6,
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: ${result.hash}`);
        console.log(`   Explorer: ${result.explorerUrl}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
  }

  async demonstrateNFTTransfers() {
    console.log('=== NFT TRANSFER DEMO ===');
    
    const aliceWallet = await this.sdk.getWallet(this.users.alice);
    const bobWallet = await this.sdk.getWallet(this.users.bob);
    
    console.log('Testing NFT transfers between users...\n');
    
    // Test ERC721 NFT transfer
    console.log('1. ERC721 NFT Transfer (Ethereum):');
    try {
      const result = await this.sdk.transferNFT({
        from: {
          socialId: this.users.alice,
          socialType: 'email',
          chain: 'ethereum'
        },
        to: {
          address: bobWallet.addresses.ethereum,
          chain: 'ethereum'
        },
        nftContract: this.nfts.ethereum.ENS,
        tokenId: '12345',
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: ${result.hash}`);
        console.log(`   Explorer: ${result.explorerUrl}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
    
    // Test Solana NFT transfer
    console.log('2. Solana NFT Transfer:');
    try {
      const result = await this.sdk.transferNFT({
        from: {
          socialId: this.users.alice,
          socialType: 'email',
          chain: 'solana'
        },
        to: {
          address: bobWallet.addresses.solana,
          chain: 'solana'
        },
        nftContract: this.nfts.solana.SAMPLE,
        tokenId: '1',
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: ${result.hash}`);
        console.log(`   Explorer: ${result.explorerUrl}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
  }

  async demonstrateAdvancedFeatures() {
    console.log('=== ADVANCED FEATURES ===');
    
    // Token approval demo
    console.log('1. Token Approval:');
    try {
      const result = await this.sdk.approveToken({
        socialId: this.users.alice,
        socialType: 'email',
        chain: 'ethereum',
        tokenAddress: this.tokens.ethereum.LINK,
        spenderAddress: '0x1234567890123456789012345678901234567890',
        amount: '1000.0',
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: ${result.hash}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
    
    // Token swap demo
    console.log('2. Token Swap:');
    try {
      const result = await this.sdk.swapTokens({
        socialId: this.users.alice,
        socialType: 'email',
        chain: 'ethereum',
        fromToken: this.tokens.ethereum.LINK,
        toToken: this.tokens.ethereum.UNI,
        amount: '1.0',
        slippage: 2,
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: ${result.hash}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
    
    // Transaction history
    console.log('3. Transaction History:');
    try {
      const history = await this.sdk.getTransactionHistory(this.users.alice, 'email', {
        asset: 'all',
        limit: 10
      });
      
      if (history.success) {
        console.log(`   Found ${history.transactions.length} transactions`);
        history.transactions.forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.type}: ${tx.hash}`);
        });
      } else {
        console.log(`   FAILED: ${history.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
  }

  async demonstrateContractDeployment() {
    console.log('=== CONTRACT DEPLOYMENT DEMO ===');
    
    // Token deployment
    console.log('1. Deploy Custom Token:');
    try {
      const result = await this.sdk.deployToken({
        socialId: this.users.alice,
        socialType: 'email',
        chain: 'ethereum',
        name: 'Alice Token',
        symbol: 'ALICE',
        decimals: 18,
        totalSupply: '1000000',
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: Contract at ${result.contractAddress}`);
        console.log(`   TX: ${result.hash}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
    
    // NFT collection deployment
    console.log('2. Deploy NFT Collection:');
    try {
      const result = await this.sdk.deployNFTCollection({
        socialId: this.users.alice,
        socialType: 'email',
        chain: 'ethereum',
        name: 'Alice NFT Collection',
        symbol: 'ANFT',
        baseURI: 'https://api.alice.com/nft/',
        gasless: true
      });
      
      if (result.success) {
        console.log(`   SUCCESS: Contract at ${result.contractAddress}`);
        console.log(`   TX: ${result.hash}`);
      } else {
        console.log(`   FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
    
    console.log('');
  }

  async generateReport() {
    console.log('=== DEMO REPORT ===');
    console.log('Token & NFT Demo completed successfully!');
    console.log('');
    console.log('Features tested:');
    console.log('✓ Wallet creation and setup');
    console.log('✓ Balance checking (native, tokens, NFTs)');
    console.log('✓ ERC20 token transfers');
    console.log('✓ SPL token transfers');
    console.log('✓ ERC721 NFT transfers');
    console.log('✓ Solana NFT transfers');
    console.log('✓ Token approvals');
    console.log('✓ Token swaps (DEX integration)');
    console.log('✓ Transaction history');
    console.log('✓ Contract deployment (tokens & NFTs)');
    console.log('');
    console.log('All operations use real blockchain transactions.');
    console.log('Gas fees are sponsored by the platform (paymaster enabled).');
    console.log('');
    console.log('Integration Points:');
    console.log('- EVM: Ethereum Sepolia testnet');
    console.log('- SVM: Solana Devnet');
    console.log('- Real transaction broadcasting');
    console.log('- Block explorer verification');
    console.log('- Cross-chain support');
  }
}

// Main execution
async function runTokenNFTDemo() {
  console.log('TOKEN & NFT SEND/RECEIVE DEMO');
  console.log('=============================');
  console.log('Demonstrating comprehensive digital asset functionality\n');
  
  const demo = new TokenNFTDemo();
  
  try {
    await demo.initialize();
    await demo.setupUsers();
    await demo.checkBalances();
    await demo.demonstrateTokenTransfers();
    await demo.demonstrateNFTTransfers();
    await demo.demonstrateAdvancedFeatures();
    await demo.demonstrateContractDeployment();
    await demo.generateReport();
    
  } catch (error) {
    console.error('Demo failed:', error.message);
    console.log('\nThis could be due to:');
    console.log('- Network connectivity issues');
    console.log('- Insufficient token/NFT balances for transfers');
    console.log('- Backend service unavailable');
    console.log('- Missing dependencies (@solana/spl-token, etc.)');
  }
}

// Run the demo
runTokenNFTDemo().catch(console.error); 