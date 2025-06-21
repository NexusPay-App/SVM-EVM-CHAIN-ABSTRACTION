/**
 * Core types for NexusSDK
 */

export type SupportedChain = 
  | 'ethereum'
  | 'polygon' 
  | 'arbitrum'
  | 'base'
  | 'optimism'
  | 'avalanche'
  | 'solana';

export type SocialIdType = 'email' | 'phone' | 'ens' | 'twitter' | 'discord' | 'telegram';

export interface NexusConfig {
  apiKey: string;
  projectId?: string;
  environment?: 'development' | 'staging' | 'production';
  chains: SupportedChain[];
  features?: {
    socialRecovery?: boolean;
    gaslessTransactions?: boolean;
    crossChain?: boolean;
    analytics?: boolean;
  };
  endpoints?: {
    api?: string;
    websocket?: string;
  };
}

export interface CreateWalletParams {
  socialId: string;
  socialType: SocialIdType;
  chains: SupportedChain[];
  metadata?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    [key: string]: any;
  };
  recoveryOptions?: {
    guardians?: string[];
    threshold?: number;
    backupMethods?: string[];
  };
}

export interface WalletInfo {
  socialId: string;
  socialType: SocialIdType;
  addresses: Record<SupportedChain, string>;
  createdAt: string;
  lastUsed?: string;
  metadata?: any;
  recoverySetup: boolean;
  isActive: boolean;
  crossChainEnabled: boolean;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  amount: string;
  chain: SupportedChain;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  fee?: string;
  timestamp: string;
} 