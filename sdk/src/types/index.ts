/**
 * Core types for NexusPlatform SDK
 */

// Supported blockchain networks
export type SupportedChain = 
  | 'ethereum'
  | 'polygon' 
  | 'arbitrum'
  | 'base'
  | 'optimism'
  | 'avalanche'
  | 'solana';

// Chain categories
export type EVMChain = Exclude<SupportedChain, 'solana'>;
export type SVMChain = 'solana';

// Social identity types
export type SocialIdType = 'email' | 'phone' | 'ens' | 'twitter' | 'discord' | 'telegram';

// Base configuration
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

// Wallet creation parameters
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

// Wallet information
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

// Transaction parameters
export interface TransactionParams {
  from: {
    chain: SupportedChain;
    socialId?: string;
    address?: string;
  };
  to: {
    chain: SupportedChain;
    address: string;
  };
  amount: string;
  asset?: string;
  data?: string;
  gasless?: boolean;
  metadata?: any;
}

// Transaction result
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

// Cross-chain bridge parameters
export interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  asset: string;
  recipient: string;
  socialId?: string;
}

// Bridge result
export interface BridgeResult {
  bridgeId: string;
  fromTx: TransactionResult;
  toTx?: TransactionResult;
  status: 'initiated' | 'pending' | 'completed' | 'failed';
  estimatedTime: number;
  fee: string;
}

// Recovery parameters
export interface RecoveryParams {
  socialId: string;
  socialType: SocialIdType;
  recoveryMethod: 'guardians' | 'social' | 'backup';
  proof: {
    guardianSignatures?: string[];
    socialProof?: any;
    backupData?: any;
  };
  newOwner?: string;
}

// Analytics data
export interface AnalyticsData {
  wallets: {
    total: number;
    active: number;
    byChain: Record<SupportedChain, number>;
  };
  transactions: {
    total: number;
    volume: string;
    byChain: Record<SupportedChain, number>;
  };
  crossChain: {
    bridges: number;
    volume: string;
  };
  timeRange: string;
}

// Error types
export interface NexusError {
  code: string;
  message: string;
  details?: any;
  chain?: SupportedChain;
  socialId?: string;
}

// Event types
export interface WalletEvent {
  type: 'created' | 'funded' | 'transaction' | 'recovered' | 'frozen';
  walletId: string;
  socialId: string;
  chain: SupportedChain;
  data: any;
  timestamp: string;
}

// Contract addresses per chain
export interface ContractAddresses {
  entryPoint: string;
  walletFactory: string;
  paymaster: string;
  bridge?: string;
}

export interface ChainConfig {
  chainId: number | string;
  name: string;
  type: 'EVM' | 'SVM';
  rpcUrl: string;
  explorerUrl: string;
  contracts: ContractAddresses;
  gasToken: string;
  isTestnet: boolean;
}

// Platform configuration
export interface PlatformConfig {
  chains: Record<SupportedChain, ChainConfig>;
  features: {
    socialRecovery: boolean;
    gaslessTransactions: boolean;
    crossChain: boolean;
    multiSig: boolean;
  };
  limits: {
    walletsPerUser: number;
    dailyTransactionLimit: string;
    crossChainCooldown: number;
  };
}

// User operation (account abstraction)
export interface UserOperation {
  sender: string;
  nonce: number;
  initCode: string;
  callData: string;
  callGasLimit: number;
  verificationGasLimit: number;
  preVerificationGas: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

// Social recovery guardian
export interface Guardian {
  id: string;
  type: SocialIdType;
  address?: string;
  publicKey?: string;
  isActive: boolean;
  addedAt: string;
}

// Paymaster policy
export interface PaymasterPolicy {
  enabled: boolean;
  sponsorGas: boolean;
  dailyLimit: string;
  perTransactionLimit: string;
  allowedContracts?: string[];
  blockedContracts?: string[];
} 