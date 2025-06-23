/**
 * Core types for NexusSDK - Enhanced for DeFi and Gas Tank functionality
 */

// ============================================================================
// CHAIN & NETWORK TYPES
// ============================================================================

export type EVMChain = 
  | 'ethereum'
  | 'polygon' 
  | 'arbitrum'
  | 'base'
  | 'optimism'
  | 'avalanche'
  | 'bsc'
  | 'fantom'
  | 'gnosis'
  | 'celo'
  | 'moonbeam'
  | 'aurora';

export type SVMChain = 'solana';

export type SupportedChain = EVMChain | SVMChain;

export type SocialIdType = 'email' | 'phone' | 'ens' | 'sns' | 'twitter' | 'discord' | 'telegram' | 'google';

// ============================================================================
// TOKEN & ASSET TYPES
// ============================================================================

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  logoUrl?: string;
  coingeckoId?: string;
  isNative?: boolean;
  chain: SupportedChain;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  balanceFormatted: string;
  usdValue?: string;
  lastUpdated: string;
}

export interface GasTankBalance {
  chain: SupportedChain;
  nativeToken: TokenBalance;
  sponsoredTransactions: number;
  monthlyLimit: number;
  lastRefill: string;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

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
    gasTank?: boolean;
    tokenSwaps?: boolean;
    defiIntegrations?: boolean;
  };
  endpoints?: {
    api?: string;
    websocket?: string;
    indexer?: string;
  };
  gasPolicy?: {
    sponsorLimit?: number; // Monthly transaction limit per user
    maxGasPrice?: string; // Max gas price to sponsor
    sponsoredChains?: SupportedChain[];
  };
  ui?: {
    theme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  };
}

// ============================================================================
// WALLET TYPES
// ============================================================================

export interface CreateWalletParams {
  socialId: string;
  socialType: SocialIdType;
  chains: SupportedChain[];
  metadata?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    country?: string;
    timezone?: string;
    [key: string]: any;
  };
  recoveryOptions?: {
    guardians?: string[];
    threshold?: number;
    backupMethods?: ('email' | 'phone' | 'social')[];
  };
  gasTankConfig?: {
    autoRefill?: boolean;
    refillThreshold?: string; // Minimum balance before refill
    refillAmount?: string;   // Amount to refill
    enabled?: boolean;
  };
}

export interface WalletInfo {
  socialId: string;
  socialType: SocialIdType;
  addresses: Record<SupportedChain, string>;
  balances?: Record<SupportedChain, TokenBalance[]>;
  gasTanks?: Record<SupportedChain, GasTankBalance>;
  createdAt: string;
  lastUsed?: string;
  metadata?: any;
  recoverySetup: boolean;
  isActive: boolean;
  crossChainEnabled: boolean;
  gaslessEnabled: boolean;
  totalUsdValue?: string;
  riskScore?: number; // 0-100, for fraud prevention
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface TransactionParams {
  from: {
    chain: SupportedChain;
    socialId?: string;
    address?: string;
  };
  to: {
    chain: SupportedChain;
    address?: string;
    socialId?: string;
  };
  amount: string;
  token?: string; // Token symbol or address
  gasSettings?: {
    useGasTank?: boolean;
    maxGasPrice?: string;
    gasLimit?: string;
    priorityFee?: string;
  };
  metadata?: {
    description?: string;
    category?: 'payment' | 'swap' | 'defi' | 'nft' | 'bridge' | 'other';
    tags?: string[];
  };
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  amount: string;
  token?: TokenInfo;
  chain: SupportedChain;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  blockNumber?: number;
  gasUsed?: string;
  gasPaid?: string;
  gasSponsored?: boolean;
  fee?: string;
  timestamp: string;
  bridgeId?: string; // For cross-chain transactions
  receipt?: any;
  error?: string;
}

// ============================================================================
// BRIDGE TYPES
// ============================================================================

export interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  asset: string;
  recipient: string;
  socialId?: string;
  slippage?: number; // 0.1 = 0.1%
  deadline?: number; // Unix timestamp
}

export interface BridgeResult {
  bridgeId: string;
  fromTx: TransactionResult;
  toTx?: TransactionResult;
  status: 'initiated' | 'confirmed_source' | 'processing' | 'confirmed_destination' | 'failed';
  estimatedTime: number; // seconds
  actualTime?: number;
  fees: {
    bridge: string;
    gas: string;
    total: string;
  };
  route?: {
    path: string[];
    protocol: string;
  };
}

// ============================================================================
// DEFI TYPES
// ============================================================================

export interface SwapParams {
  fromToken: string;
  toToken: string;
  amount: string;
  chain: SupportedChain;
  socialId?: string;
  slippage?: number;
  deadline?: number;
  useGasTank?: boolean;
}

export interface SwapResult {
  hash: string;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  rate: string;
  slippage: string;
  fees: {
    protocol: string;
    gas: string;
    total: string;
  };
  route: {
    protocol: string;
    path: TokenInfo[];
    share: number; // Percentage if split
  }[];
  status: 'pending' | 'confirmed' | 'failed';
}

export interface LendingPosition {
  protocol: string;
  chain: SupportedChain;
  asset: TokenInfo;
  supplied: string;
  borrowed?: string;
  apy: string;
  healthFactor?: string;
  lastUpdated: string;
}

export interface YieldPosition {
  protocol: string;
  chain: SupportedChain;
  poolId: string;
  poolName: string;
  assets: TokenInfo[];
  deposited: string;
  shares: string;
  apy: string;
  rewards?: {
    token: TokenInfo;
    amount: string;
  }[];
  lastUpdated: string;
}

// ============================================================================
// GAS TANK TYPES
// ============================================================================

export interface GasTankRefillParams {
  chain: SupportedChain;
  amount: string;
  socialId: string;
  paymentMethod: 'metamask' | 'external_wallet' | 'credit_card' | 'bank_transfer';
  autoRefill?: boolean;
}

export interface GasTankUsage {
  chain: SupportedChain;
  date: string;
  transactionsSponsored: number;
  gasUsed: string;
  usdValue: string;
  savedFees: string;
}

// ============================================================================
// RECOVERY TYPES
// ============================================================================

export interface RecoveryParams {
  socialId: string;
  socialType: SocialIdType;
  recoveryMethod: 'social' | 'guardians' | 'backup';
  proof: {
    socialProof?: string;
    guardianSignatures?: string[];
    backupData?: any;
  };
  newCredentials?: {
    email?: string;
    phone?: string;
  };
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AnalyticsData {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  gasSponsored: string;
  topChains: { chain: SupportedChain; volume: string }[];
  topTokens: { token: TokenInfo; volume: string }[];
  bridgeVolume: string;
  crossChainTransactions: number;
  timeRange: string;
}

export interface UserAnalytics {
  socialId: string;
  totalTransactions: number;
  totalVolume: string;
  favoriteChains: SupportedChain[];
  favoriteTokens: string[];
  gasSponsored: string;
  crossChainActivity: {
    bridges: number;
    volume: string;
  };
  defiActivity: {
    swaps: number;
    lending: LendingPosition[];
    yield: YieldPosition[];
  };
  monthlyActivity: {
    month: string;
    transactions: number;
    volume: string;
  }[];
}

// ============================================================================
// REACT COMPONENT TYPES
// ============================================================================

export interface NexusProviderProps {
  config: NexusConfig;
  children: any; // React.ReactNode - will be properly typed when React is imported
}

export interface WalletConnectProps {
  chains?: SupportedChain[];
  onConnect?: (walletInfo: WalletInfo) => void;
  onDisconnect?: () => void;
  className?: string;
  showBalance?: boolean;
  showGasTank?: boolean;
}

export interface PaymentButtonProps {
  to: string;
  amount: string;
  token?: string;
  chain?: SupportedChain;
  description?: string;
  onSuccess?: (result: TransactionResult) => void;
  onError?: (error: Error) => void;
  className?: string;
  disabled?: boolean;
}

export interface GasTankWidgetProps {
  socialId?: string;
  chain?: SupportedChain;
  onRefill?: (result: any) => void;
  className?: string;
  showUsage?: boolean;
}

export interface BridgeWidgetProps {
  onBridge?: (result: BridgeResult) => void;
  className?: string;
  defaultFromChain?: SupportedChain;
  defaultToChain?: SupportedChain;
}

export interface SwapWidgetProps {
  chain?: SupportedChain;
  defaultFromToken?: string;
  defaultToToken?: string;
  onSwap?: (result: SwapResult) => void;
  className?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface NexusError {
  code: string;
  message: string;
  details?: any;
  chain?: SupportedChain;
  recoverable?: boolean;
}

export type ErrorCode = 
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_ADDRESS'
  | 'NETWORK_ERROR'
  | 'TRANSACTION_FAILED'
  | 'BRIDGE_NOT_AVAILABLE'
  | 'GAS_TANK_EMPTY'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED_CHAIN'
  | 'INVALID_TOKEN';

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  chains?: SupportedChain[];
  tokens?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  minAmount?: string;
  maxAmount?: string;
} 