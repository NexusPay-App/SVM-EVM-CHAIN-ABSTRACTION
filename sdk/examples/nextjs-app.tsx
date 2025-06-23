/**
 * Next.js Example Application using NexusSDK
 * 
 * This example shows how to build a DApp with cross-chain functionality
 * using the NexusSDK - the ThirdWeb killer with Solana integration
 */

import React, { useState, useEffect } from 'react';
import { NexusSDK, Utils, DEFAULT_CONFIGS } from '@nexusplatform/sdk';

// Example component showing how to use the NexusSDK
export function NexusApp() {
  const [sdk, setSdk] = useState<NexusSDK | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    async function initializeSDK() {
      try {
        // Create SDK configuration
        const config = Utils.createConfig(
          process.env.NEXT_PUBLIC_NEXUS_API_KEY || 'demo-key',
          {
            chains: ['ethereum', 'polygon', 'solana'],
            features: {
              gasTank: true,
              crossChain: true,
              defiIntegrations: true,
              tokenSwaps: true
            }
          }
        );

        const nexusSDK = new NexusSDK(config);
        await nexusSDK.initialize();
        
        setSdk(nexusSDK);
        console.log('✅ NexusSDK initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize SDK:', error);
      }
    }

    initializeSDK();
  }, []);

  // Connect wallet with social login
  const connectWallet = async (socialId: string, socialType: string) => {
    if (!sdk) return;

    setIsLoading(true);
    try {
      // Check if wallet exists or create new one
      let userWallet = await sdk.getWallet(socialId);
      
      if (!userWallet) {
        userWallet = await sdk.createWallet({
          socialId,
          socialType: socialType as any,
          chains: ['ethereum', 'polygon', 'solana'],
          gasTankConfig: {
            enabled: true,
            autoRefill: true,
            refillThreshold: '0.01'
          }
        });
      }

      setWallet(userWallet);
      console.log('✅ Wallet connected:', userWallet);
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send cross-chain payment
  const sendCrossChainPayment = async () => {
    if (!sdk || !wallet) return;

    setIsLoading(true);
    try {
      const tx = await sdk.sendPayment({
        from: { 
          chain: 'solana', 
          socialId: wallet.socialId 
        },
        to: { 
          chain: 'ethereum', 
          address: '0x742d35cc6672c5c00c5a4edecfd6a6f13a5e6b3a' 
        },
        amount: '100',
        token: 'USDC',
        gasSettings: {
          useGasTank: true
        }
      });

      setTransactions(prev => [tx, ...prev]);
      console.log('✅ Cross-chain payment sent:', tx);
    } catch (error) {
      console.error('❌ Payment failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Swap tokens on Solana
  const swapTokens = async () => {
    if (!sdk || !wallet) return;

    setIsLoading(true);
    try {
      const swap = await sdk.swapTokens({
        fromToken: 'SOL',
        toToken: 'USDC',
        amount: '1',
        chain: 'solana',
        socialId: wallet.socialId,
        slippage: 0.5,
        useGasTank: true
      });

      console.log('✅ Token swap completed:', swap);
    } catch (error) {
      console.error('❌ Swap failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refill gas tank
  const refillGasTank = async () => {
    if (!sdk || !wallet) return;

    setIsLoading(true);
    try {
      const result = await sdk.refillGasTank({
        chain: 'ethereum',
        amount: '0.1',
        socialId: wallet.socialId,
        paymentMethod: 'metamask'
      });

      console.log('✅ Gas tank refilled:', result);
    } catch (error) {
      console.error('❌ Gas tank refill failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!sdk) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing NexusSDK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            NexusSDK Demo
          </h1>
          <p className="text-gray-600">
            The ThirdWeb killer with cross-chain superpowers
          </p>
        </header>

        {!wallet ? (
          <WalletConnectDemo onConnect={connectWallet} isLoading={isLoading} />
        ) : (
          <div className="space-y-8">
            {/* Wallet Info */}
            <WalletInfoCard wallet={wallet} />
            
            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionCard
                title="Cross-Chain Payment"
                description="Send USDC from Solana to Ethereum"
                action={sendCrossChainPayment}
                isLoading={isLoading}
                icon="🌉"
              />
              
              <ActionCard
                title="Token Swap"
                description="Swap SOL to USDC on Solana"
                action={swapTokens}
                isLoading={isLoading}
                icon="🔄"
              />
              
              <ActionCard
                title="Refill Gas Tank"
                description="Add ETH for gasless transactions"
                action={refillGasTank}
                isLoading={isLoading}
                icon="⛽"
              />
            </div>

            {/* Transaction History */}
            {transactions.length > 0 && (
              <TransactionHistoryCard transactions={transactions} />
            )}

            {/* Features Showcase */}
            <FeaturesShowcase />
          </div>
        )}
      </div>
    </div>
  );
}

// Demo Components

function WalletConnectDemo({ onConnect, isLoading }: any) {
  const [socialId, setSocialId] = useState('demo@nexusplatform.io');
  const [socialType, setSocialType] = useState('email');

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Connect Your Wallet</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Social Login Type
          </label>
          <select
            value={socialType}
            onChange={(e) => setSocialType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="twitter">Twitter</option>
            <option value="discord">Discord</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Social ID
          </label>
          <input
            type="text"
            value={socialId}
            onChange={(e) => setSocialId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your social ID"
          />
        </div>

        <button
          onClick={() => onConnect(socialId, socialType)}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    </div>
  );
}

function WalletInfoCard({ wallet }: any) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Wallet Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium text-gray-700 mb-2">Social ID</h3>
          <p className="text-gray-900">{wallet.socialId}</p>
          <p className="text-sm text-gray-500">{wallet.socialType}</p>
        </div>
        
        <div>
          <h3 className="font-medium text-gray-700 mb-2">Total Value</h3>
          <p className="text-2xl font-bold text-green-600">
            ${wallet.totalUsdValue || '0.00'}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-medium text-gray-700 mb-3">Chain Addresses</h3>
        <div className="space-y-2">
          {Object.entries(wallet.addresses).map(([chain, address]) => (
            <div key={chain} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium capitalize">{chain}</span>
              <span className="text-sm text-gray-600 font-mono">
                {typeof address === 'string' ? `${address.slice(0, 8)}...${address.slice(-6)}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCard({ title, description, action, isLoading, icon }: any) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-4">{description}</p>
        <button
          onClick={action}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Execute'}
        </button>
      </div>
    </div>
  );
}

function TransactionHistoryCard({ transactions }: any) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
      
      <div className="space-y-3">
        {transactions.map((tx: any, index: number) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="font-medium">{tx.amount} {tx.token?.symbol || 'NATIVE'}</p>
              <p className="text-sm text-gray-600">{tx.chain}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono">{tx.hash.slice(0, 10)}...</p>
              <p className="text-xs text-gray-500">{tx.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeaturesShowcase() {
  const features = [
    { name: 'Cross-Chain Bridge', description: 'Bridge assets between EVM and SVM' },
    { name: 'Gas Tank', description: 'Gasless transactions across all chains' },
    { name: 'Social Recovery', description: 'Recover wallets with social proof' },
    { name: 'DeFi Integration', description: 'Built-in swap and lending support' },
    { name: 'Multi-Chain Support', description: '12+ EVM chains + Solana' },
    { name: 'Developer Friendly', description: 'Easy-to-use TypeScript SDK' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Why Choose NexusSDK?</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <div key={index} className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">{feature.name}</h3>
            <p className="text-sm text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          🚀 <strong>ThirdWeb but better:</strong> Full EVM + SVM support with cross-chain superpowers
        </p>
      </div>
    </div>
  );
}

export default NexusApp; 