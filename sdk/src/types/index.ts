/**
 * NexusSDK Types - Ultimate Flexible Cross-Chain Wallet Infrastructure
 * Support for ANY social identifier and comprehensive token/bridging functionality
 */

// Supported blockchain networks
export type SupportedChain = 'ethereum' | 'arbitrum' | 'solana';

// Completely flexible social type - developers can use ANY identifier
export type SocialType = string; // ANY social identifier: email, twitter, gameId, NFT address, etc.

// Common social type examples (not restrictive)
export const COMMON_SOCIAL_TYPES = {
  // Traditional
  EMAIL: 'email',
  PHONE: 'phone',
  USERNAME: 'username',
  
  // Social Platforms
  TWITTER: 'twitter',
  DISCORD: 'discord',
  TELEGRAM: 'telegram',
  GITHUB: 'github',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  LINKEDIN: 'linkedin',
  
  // Gaming & Web3
  GAME_ID: 'gameId',
  PLAYER_TAG: 'playerTag',
  STEAM_ID: 'steamId',
  EPIC_ID: 'epicId',
  XBOX_GAMERTAG: 'xboxGamertag',
  PSN_ID: 'psnId',
  
  // Business & Enterprise
  EMPLOYEE_ID: 'employeeId',
  CUSTOMER_ID: 'customerId',
  MEMBER_ID: 'memberId',
  SUBSCRIPTION_ID: 'subscriptionId',
  
  // Web3 & Crypto
  ENS: 'ens',
  WALLET_ADDRESS: 'walletAddress',
  NFT_HOLDER: 'nftHolder',
  TOKEN_HOLDER: 'tokenHolder',
  DAO_MEMBER: 'daoMember',
  
  // Custom Business Logic
  USER_UUID: 'userUuid',
  API_KEY_HASH: 'apiKeyHash',
  SESSION_ID: 'sessionId',
  DEVICE_ID: 'deviceId',
  
  // Any custom type developers want
  CUSTOM: 'custom'
} as const;

// Core SDK Configuration
export interface NexusConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  enableBridging?: boolean; // Enable cross-chain bridging
  enableGasless?: boolean; // Enable gasless transactions (default: true)
}

// Error Handling
export interface NexusError {
  code: string;
  message: string;
  details?: string;
  statusCode?: number;
  chain?: SupportedChain;
  retryable?: boolean;
  suggestions?: string[]; // Developer-friendly error suggestions
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: NexusError;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  owner_id: string;
  chains: SupportedChain[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  settings: {
    paymasterEnabled: boolean;
    bridgingEnabled: boolean;
    webhookUrl?: string;
    rateLimit: number;
    allowedSocialTypes: string[]; // Flexible social types
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  website?: string;
  chains: SupportedChain[];
  allowedSocialTypes?: string[]; // Optional restriction on social types
}

// Enhanced Wallet Types
export interface Wallet {
  id: string;
  addresses: Record<SupportedChain, string>;
  status: 'created' | 'deploying' | 'deployed' | 'failed';
  deployment_status: Record<SupportedChain, 'pending' | 'confirmed' | 'failed'>;
  socialId: string;
  socialType: string; // Completely flexible
  project_id: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    name?: string;
    avatar?: string;
    customData?: Record<string, any>;
  };
  balances?: WalletBalances; // Token balances across chains
  gasless_enabled: boolean;
}

export interface CreateWalletRequest {
  socialId: string;
  socialType: string; // ANY social type
  chains: SupportedChain[];
  metadata?: {
    name?: string;
    avatar?: string;
    customData?: Record<string, any>;
  };
  enableGasless?: boolean; // Default: true
}

// Token & Balance Types
export interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  usd_value: string;
  contract_address?: string;
  logo_url?: string;
}

export interface WalletBalances {
  [chain: string]: {
    native: TokenBalance; // ETH, SOL, etc.
    tokens: TokenBalance[]; // ERC20, SPL tokens
    total_usd: string;
  };
}

export interface Token {
  symbol: string;
  name: string;
  decimals: number;
  contract_address: string;
  chain: SupportedChain;
  logo_url?: string;
  is_native: boolean;
  is_popular: boolean;
}

// Enhanced Transaction Types
export interface TransactionRequest {
  chain: SupportedChain;
  userWalletAddress: string;
  transaction: {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
  };
  usePaymaster?: boolean; // Default: true (gasless)
  token?: {
    contract_address?: string;
    amount: string;
    recipient?: string;
  };
}

export interface TransactionResult {
  transactionHash: string;
  gasUsed: string;
  gasCost: string;
  paymasterUsed: boolean;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  timestamp: string;
  explorerUrl: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  totalCost: string;
  usdCost: string;
  paymasterCovered: boolean;
}

// Cross-Chain Bridging Types
export interface BridgeRequest {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  token: string; // Contract address or 'native'
  amount: string;
  fromAddress: string;
  toAddress: string;
  usePaymaster?: boolean; // Default: true
}

export interface BridgeResult {
  bridgeId: string;
  fromTx: TransactionResult;
  toTx?: TransactionResult; // Pending until bridge completion
  status: 'initiated' | 'bridging' | 'completed' | 'failed';
  estimatedTime: number; // seconds
  bridgeFee: string;
  exchangeRate?: string;
}

export interface BridgeStatus {
  bridgeId: string;
  status: 'initiated' | 'bridging' | 'completed' | 'failed';
  fromTx: TransactionResult;
  toTx?: TransactionResult;
  progress: number; // 0-100
  estimatedTimeRemaining: number; // seconds
}

// Token Transfer Types
export interface TokenTransferRequest {
  chain: SupportedChain;
  fromAddress: string;
  toAddress: string;
  token: string; // Contract address or 'native'
  amount: string;
  usePaymaster?: boolean; // Default: true
}

export interface SwapRequest {
  chain: SupportedChain;
  userAddress: string;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number; // Default: 1%
  usePaymaster?: boolean; // Default: true
}

export interface SwapResult {
  transactionHash: string;
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  slippage: number;
  fee: string;
  paymasterUsed: boolean;
}

// Paymaster Types
export interface PaymasterBalance {
  chain: SupportedChain;
  balance: string;
  usd_value: string;
  is_low_balance: boolean;
  funding_address: string;
  contract_address?: string;
  estimated_transactions_remaining: number;
}

export interface PaymasterAddresses {
  addresses: Record<SupportedChain, string>;
  qr_codes: Record<SupportedChain, string>;
  funding_instructions: Record<SupportedChain, string>;
}

export interface PaymasterTransaction {
  id: string;
  chain: SupportedChain;
  transaction_hash: string;
  amount: string;
  gas_used: string;
  gas_price: string;
  usd_cost: string;
  wallet_address: string;
  transaction_type: 'transfer' | 'swap' | 'bridge' | 'contract_call';
  created_at: string;
}

// Analytics Types
export interface AnalyticsOverview {
  total_wallets: number;
  total_transactions: number;
  total_gas_spent_usd: string;
  total_gas_saved_usd: string; // Thanks to paymaster
  active_users_7d: number;
  active_users_30d: number;
  paymaster_coverage_pct: number;
  bridge_volume_usd: string;
  swap_volume_usd: string;
  chains: Record<SupportedChain, ChainAnalytics>;
  social_types: Record<string, SocialTypeAnalytics>;
}

export interface ChainAnalytics {
  chain: SupportedChain;
  transactions: number;
  gas_spent_usd: string;
  gas_saved_usd: string;
  active_users: number;
  bridge_volume_usd: string;
  swap_volume_usd: string;
  popular_tokens: Token[];
}

export interface SocialTypeAnalytics {
  social_type: string;
  wallets_created: number;
  transactions: number;
  gas_spent_usd: string;
  most_active_users: number;
}

export interface UserAnalytics {
  user_id: string;
  social_type: string;
  wallets_created: number;
  transactions_sent: number;
  bridges_completed: number;
  swaps_completed: number;
  total_gas_spent_usd: string;
  total_gas_saved_usd: string;
  favorite_chains: SupportedChain[];
  last_activity: string;
}

export interface CostAnalytics {
  total_spent_usd: string;
  total_saved_usd: string;
  average_cost_per_transaction: string;
  paymaster_efficiency: number; // % of gas costs covered
  by_chain: Record<SupportedChain, {
    spent_usd: string;
    saved_usd: string;
    transaction_count: number;
    efficiency: number;
  }>;
  forecast_30d: string;
  break_even_point: string;
}

// React Types
export interface WalletConnectProps {
  onWalletCreated?: (wallet: Wallet) => void;
  onError?: (error: NexusError) => void;
  chains?: SupportedChain[];
  allowedSocialTypes?: string[]; // Restrict which social types to show
  customSocialTypes?: { type: string; label: string; placeholder: string }[]; // Custom social types
  className?: string;
  theme?: 'light' | 'dark' | 'auto';
} 