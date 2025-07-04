/**
 * NexusProvider - Ultra-Simple Cross-Chain Wallet Provider
 * Provides access to simplified SDK features with React state management
 */

import React, { createContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { NexusSDK, SimpleNexusConfig } from '../../core/NexusSDK.js';
import {
  NexusError,
  Wallet,
  TransactionResult,
  WalletBalances,
  BridgeResult,
  PaymasterBalance,
  AnalyticsOverview,
  SupportedChain,
} from '../../types/index.js';

// Simplified provider props
export interface NexusProviderProps {
  config: SimpleNexusConfig;
  children: ReactNode;
}

// Simplified hook return type
export interface UseNexusReturn {
  sdk: NexusSDK | null;
  isLoading: boolean;
  error: NexusError | null;
  
  // Simplified wallet operations
  createWallet: (socialId: string, socialType: string, chains?: SupportedChain[]) => Promise<Wallet>;
  getWallet: (socialId: string, socialType: string) => Promise<Wallet>;
  getWalletBalances: (socialId: string, socialType: string) => Promise<WalletBalances>;
  
  // Simplified transaction operations
  sendTransaction: (data: {
    socialId: string;
    socialType: string;
    chain: SupportedChain;
    to: string;
    value?: string;
    data?: string;
  }) => Promise<TransactionResult>;
  
  transferTokens: (data: {
    socialId: string;
    socialType: string;
    chain: SupportedChain;
    to: string;
    amount: string;
    token?: string;
  }) => Promise<TransactionResult>;
  
  // Simplified cross-chain operations
  bridgeTokens: (data: {
    socialId: string;
    socialType: string;
    fromChain: SupportedChain;
    toChain: SupportedChain;
    amount: string;
    token?: string;
  }) => Promise<BridgeResult>;
  
  // Analytics
  getAnalytics: (days?: number) => Promise<AnalyticsOverview>;
  getPaymasterBalances: () => Promise<PaymasterBalance[]>;
  
  // Utility
  clearError: () => void;
}

// Create the context
export const NexusContext = createContext<UseNexusReturn | undefined>(undefined);

export const NexusProvider: React.FC<NexusProviderProps> = ({ config, children }) => {
  // State management
  const [sdk, setSdk] = useState<NexusSDK | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NexusError | null>(null);

  // Initialize SDK
  useEffect(() => {
    try {
      const sdkInstance = new NexusSDK(config);
      setSdk(sdkInstance);
    } catch (err) {
      setError({
        code: 'SDK_INIT_ERROR',
        message: err instanceof Error ? err.message : 'Failed to initialize SDK',
      });
    }
  }, [config]);

  // Error handling
  const handleError = useCallback((err: any) => {
    const nexusError: NexusError = {
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message || 'An unknown error occurred',
      details: err.details,
      statusCode: err.statusCode,
      retryable: err.retryable || false,
      suggestions: err.suggestions || [],
    };
    setError(nexusError);
    return nexusError;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Wrapper for async operations
  const withLoading = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (!sdk) {
      throw new Error('SDK not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      return result;
    } catch (err) {
      const nexusError = handleError(err);
      throw nexusError;
    } finally {
      setIsLoading(false);
    }
  }, [sdk, handleError]);

  // ==================== SIMPLIFIED WALLET OPERATIONS ====================

  const createWallet = useCallback(
    async (socialId: string, socialType: string, chains?: SupportedChain[]): Promise<Wallet> => {
      return withLoading(() => sdk!.createWallet({ socialId, socialType, chains }));
    },
    [sdk, withLoading]
  );

  const getWallet = useCallback(
    async (socialId: string, socialType: string): Promise<Wallet> => {
      return withLoading(() => sdk!.getWallet(socialId, socialType));
    },
    [sdk, withLoading]
  );

  const getWalletBalances = useCallback(
    async (socialId: string, socialType: string): Promise<WalletBalances> => {
      return withLoading(() => sdk!.getWalletBalances(socialId, socialType));
    },
    [sdk, withLoading]
  );

  // ==================== SIMPLIFIED TRANSACTION OPERATIONS ====================

  const sendTransaction = useCallback(
    async (data: {
      socialId: string;
      socialType: string;
      chain: SupportedChain;
      to: string;
      value?: string;
      data?: string;
    }): Promise<TransactionResult> => {
      return withLoading(() => sdk!.sendTransaction(data));
    },
    [sdk, withLoading]
  );

  const transferTokens = useCallback(
    async (data: {
      socialId: string;
      socialType: string;
      chain: SupportedChain;
      to: string;
      amount: string;
      token?: string;
    }): Promise<TransactionResult> => {
      return withLoading(() => sdk!.transferTokens(data));
    },
    [sdk, withLoading]
  );

  // ==================== SIMPLIFIED CROSS-CHAIN OPERATIONS ====================

  const bridgeTokens = useCallback(
    async (data: {
      socialId: string;
      socialType: string;
      fromChain: SupportedChain;
      toChain: SupportedChain;
      amount: string;
      token?: string;
    }): Promise<BridgeResult> => {
      return withLoading(() => sdk!.bridgeTokens(data));
    },
    [sdk, withLoading]
  );

  // ==================== ANALYTICS & MONITORING ====================

  const getAnalytics = useCallback(
    async (days?: number): Promise<AnalyticsOverview> => {
      return withLoading(() => sdk!.getAnalytics(days));
    },
    [sdk, withLoading]
  );

  const getPaymasterBalances = useCallback(
    async (): Promise<PaymasterBalance[]> => {
      return withLoading(() => sdk!.getPaymasterBalances());
    },
    [sdk, withLoading]
  );

  // ==================== CONTEXT VALUE ====================

  const contextValue: UseNexusReturn = {
    sdk,
    isLoading,
    error,
    createWallet,
    getWallet,
    getWalletBalances,
    sendTransaction,
    transferTokens,
    bridgeTokens,
    getAnalytics,
    getPaymasterBalances,
    clearError,
  };

  return (
    <NexusContext.Provider value={contextValue}>
      {children}
    </NexusContext.Provider>
  );
};

export default NexusProvider; 