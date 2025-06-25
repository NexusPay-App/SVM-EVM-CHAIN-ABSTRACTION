/**
 * NexusProvider - Main React context provider
 * 
 * Provides NexusSDK context to all child components
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NexusSDK } from '../../core/NexusSDK';
import { NexusConfig, WalletInfo, SupportedChain } from '../../types';

export interface NexusContextType {
  sdk: NexusSDK | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  currentWallet: WalletInfo | null;
  supportedChains: SupportedChain[];
  
  // Methods
  connectWallet: (socialId: string, socialType: string) => Promise<WalletInfo | null>;
  disconnectWallet: () => void;
  switchChain: (chain: SupportedChain) => Promise<void>;
}

const NexusContext = createContext<NexusContextType | undefined>(undefined);

export interface NexusProviderProps {
  config: NexusConfig;
  children: React.ReactNode;
}

/**
 * NexusProvider Component
 * 
 * @example
 * ```tsx
 * import { NexusProvider } from '@nexusplatform/sdk/react';
 * 
 * function App() {
 *   return (
 *     <NexusProvider
 *       config={{
 *         apiKey: process.env.NEXT_PUBLIC_NEXUS_API_KEY,
 *         chains: ['ethereum', 'polygon', 'solana'],
 *         features: {
 *           gasTank: true,
 *           crossChain: true,
 *           defiIntegrations: true
 *         }
 *       }}
 *     >
 *       <YourApp />
 *     </NexusProvider>
 *   );
 * }
 * ```
 */
export function NexusProvider({ config, children }: NexusProviderProps) {
  const [sdk, setSdk] = useState<NexusSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWallet, setCurrentWallet] = useState<WalletInfo | null>(null);

  useEffect(() => {
    async function initializeSDK() {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🚀 Initializing NexusSDK...');
        
        const nexusSDK = new NexusSDK(config);
        await nexusSDK.initialize();
        
        setSdk(nexusSDK);
        setIsInitialized(true);
        
        console.log('✅ NexusSDK initialized successfully');
        
        // Try to restore previous wallet session
        const savedWalletId = localStorage.getItem('nexus-wallet-id');
        if (savedWalletId) {
          try {
            const wallet = await nexusSDK.getWallet(savedWalletId);
            if (wallet) {
              setCurrentWallet(wallet);
              console.log('🔄 Restored wallet session:', savedWalletId);
            }
          } catch (error) {
            console.warn('Failed to restore wallet session:', error);
            localStorage.removeItem('nexus-wallet-id');
          }
        }
        
      } catch (err) {
        console.error('❌ Failed to initialize NexusSDK:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    initializeSDK();
  }, [config]);

  const connectWallet = async (socialId: string, socialType: string): Promise<WalletInfo | null> => {
    if (!sdk) {
      throw new Error('SDK not initialized');
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log(`🔐 Connecting wallet: ${socialType}:${socialId}`);

      // Check if wallet already exists
      let wallet = await sdk.getWallet(socialId);
      
      if (!wallet) {
        // Create new wallet
        wallet = await sdk.createWallet({
          socialId,
          socialType: socialType as any,
          chains: config.chains,
          paymaster: config.features?.gaslessTransactions ?? true
        });
      }

      setCurrentWallet(wallet);
      localStorage.setItem('nexus-wallet-id', socialId);
      
      console.log('✅ Wallet connected successfully');
      return wallet;
      
    } catch (err) {
      console.error('❌ Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = () => {
    setCurrentWallet(null);
    localStorage.removeItem('nexus-wallet-id');
    console.log('🔌 Wallet disconnected');
  };

  const switchChain = async (chain: SupportedChain): Promise<void> => {
    if (!currentWallet) {
      throw new Error('No wallet connected');
    }

    if (!currentWallet.addresses[chain]) {
      throw new Error(`Wallet not available on ${chain}`);
    }

    // Chain switching logic would go here
    console.log(`🔄 Switched to ${chain}`);
  };

  const contextValue: NexusContextType = {
    sdk,
    isInitialized,
    isLoading,
    error,
    currentWallet,
    supportedChains: config.chains,
    connectWallet,
    disconnectWallet,
    switchChain
  };

  return (
    <NexusContext.Provider value={contextValue}>
      {children}
    </NexusContext.Provider>
  );
}

/**
 * Hook to use NexusSDK context
 */
export function useNexusContext(): NexusContextType {
  const context = useContext(NexusContext);
  if (context === undefined) {
    throw new Error('useNexusContext must be used within a NexusProvider');
  }
  return context;
} 