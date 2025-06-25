#!/usr/bin/env node

/**
 * Simple Send & Receive Tokens Demo
 * 
 * This example demonstrates the core send/receive functionality for digital assets:
 * - Send ERC20 tokens on Ethereum
 * - Send SPL tokens on Solana
 * - Check token balances
 * - Real blockchain transactions
 */

import { NexusSDK } from '../dist/index.js';

class SendReceiveDemo {
  constructor() {
    this.sdk = null;
    this.sender = 'sender@example.com';
    this.receiver = 'receiver@example.com';
  }

  async initialize() {
    console.log('Initializing Send/Receive Demo...');
    
    this.sdk = new NexusSDK({
      apiKey: 'local-dev-key',
      environment: 'production',
      chains: ['ethereum', 'solana'],
      endpoints: {
        api: 'https://backend-amber-zeta-94.vercel.app'
      }
    });

    await this.sdk.initialize();
    console.log('SDK ready for token transfers\n');
  }

  async setupWallets() {
    console.log('Setting up wallets...');
    
    // Create sender wallet
    const senderWallet = await this.sdk.createWallet({
      socialId: this.sender,
      socialType: 'email',
      chains: ['ethereum', 'solana'],
      paymaster: true
    });
    
    // Create receiver wallet
    const receiverWallet = await this.sdk.createWallet({
      socialId: this.receiver,
      socialType: 'email',
      chains: ['ethereum', 'solana'],
      paymaster: true
    });
    
    console.log('Sender addresses:');
    console.log(`  Ethereum: ${senderWallet.addresses.ethereum}`);
    console.log(`  Solana: ${senderWallet.addresses.solana}`);
    
    console.log('Receiver addresses:');
    console.log(`  Ethereum: ${receiverWallet.addresses.ethereum}`);
    console.log(`  Solana: ${receiverWallet.addresses.solana}`);
    console.log('');
    
    return { senderWallet, receiverWallet };
  }

  async checkTokenBalances() {
    console.log('Checking token balances...');
    
    // Check sender balances
    try {
      const senderTokens = await this.sdk.getTokenBalances(this.sender);
      console.log('Sender tokens:');
      if (senderTokens.success && senderTokens.tokens.length > 0) {
        senderTokens.tokens.forEach(token => {
          console.log(`  ${token.symbol || token.address}: ${token.balance} (${token.chain})`);
        });
      } else {
        console.log('  No tokens found');
      }
    } catch (error) {
      console.log(`  Error checking sender tokens: ${error.message}`);
    }
    
    // Check receiver balances
    try {
      const receiverTokens = await this.sdk.getTokenBalances(this.receiver);
      console.log('Receiver tokens:');
      if (receiverTokens.success && receiverTokens.tokens.length > 0) {
        receiverTokens.tokens.forEach(token => {
          console.log(`  ${token.symbol || token.address}: ${token.balance} (${token.chain})`);
        });
      } else {
        console.log('  No tokens found');
      }
    } catch (error) {
      console.log(`  Error checking receiver tokens: ${error.message}`);
    }
    
    console.log('');
  }

  async sendERC20Token(receiverAddress) {
    console.log('Sending ERC20 Token (Ethereum)...');
    
    try {
      const result = await this.sdk.transferToken({
        from: {
          socialId: this.sender,
          socialType: 'email',
          chain: 'ethereum'
        },
        to: {
          address: receiverAddress,
          chain: 'ethereum'
        },
        tokenAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789', // LINK on Sepolia
        amount: '0.1',
        decimals: 18,
        gasless: true
      });
      
      if (result.success) {
        console.log(`SUCCESS: Token sent!`);
        console.log(`  Transaction: ${result.hash}`);
        console.log(`  From: ${result.from}`);
        console.log(`  To: ${result.to}`);
        console.log(`  Amount: ${result.amount} tokens`);
        console.log(`  Explorer: ${result.explorerUrl}`);
        return true;
      } else {
        console.log(`FAILED: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
      return false;
    }
  }

  async sendSPLToken(receiverAddress) {
    console.log('Sending SPL Token (Solana)...');
    
    try {
      const result = await this.sdk.transferToken({
        from: {
          socialId: this.sender,
          socialType: 'email',
          chain: 'solana'
        },
        to: {
          address: receiverAddress,
          chain: 'solana'
        },
        tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
        amount: '1.0',
        decimals: 6,
        gasless: true
      });
      
      if (result.success) {
        console.log(`SUCCESS: Token sent!`);
        console.log(`  Transaction: ${result.hash}`);
        console.log(`  From: ${result.from}`);
        console.log(`  To: ${result.to}`);
        console.log(`  Amount: ${result.amount} tokens`);
        console.log(`  Explorer: ${result.explorerUrl}`);
        return true;
      } else {
        console.log(`FAILED: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
      return false;
    }
  }

  async demonstrateSendReceive() {
    const { senderWallet, receiverWallet } = await this.setupWallets();
    
    console.log('=== BEFORE TRANSFERS ===');
    await this.checkTokenBalances();
    
    console.log('=== SENDING TOKENS ===');
    
    // Send ERC20 token
    const ethSuccess = await this.sendERC20Token(receiverWallet.addresses.ethereum);
    console.log('');
    
    // Send SPL token
    const solSuccess = await this.sendSPLToken(receiverWallet.addresses.solana);
    console.log('');
    
    console.log('=== AFTER TRANSFERS ===');
    await this.checkTokenBalances();
    
    console.log('=== TRANSFER SUMMARY ===');
    console.log(`ERC20 Transfer: ${ethSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`SPL Transfer: ${solSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    if (ethSuccess || solSuccess) {
      console.log('\nReal blockchain transactions completed!');
      console.log('Check the explorer URLs to verify on-chain.');
    } else {
      console.log('\nTransfers failed. This could be due to:');
      console.log('- Insufficient token balances');
      console.log('- Network connectivity issues');
      console.log('- Missing dependencies');
    }
  }
}

// Main execution
async function runSendReceiveDemo() {
  console.log('SEND & RECEIVE TOKENS DEMO');
  console.log('==========================');
  console.log('Demonstrating real blockchain token transfers\n');
  
  const demo = new SendReceiveDemo();
  
  try {
    await demo.initialize();
    await demo.demonstrateSendReceive();
    
  } catch (error) {
    console.error('Demo failed:', error.message);
  }
}

// Run the demo
runSendReceiveDemo().catch(console.error); 