/**
 * NexusSDK - The ThirdWeb Killer with SVM-EVM Integration
 * 
 * @version 2.0.0
 * @description Unified SDK for EVM + SVM wallet infrastructure with cross-chain capabilities
 * @author NexusPlatform Team
 * 
 * @example
 * ```typescript
 * import { NexusSDK, Utils } from '@nexusplatform/sdk';
 * 
 * const sdk = new NexusSDK({
 *   apiKey: 'local-dev-key', // For local development
 *   chains: ['ethereum', 'polygon', 'solana'],
 *   features: {
 *     gasTank: true,
 *     crossChain: true,
 *     defiIntegrations: true
 *   },
 *   endpoints: {
 *     api: 'http://localhost:3001', // Your local backend
 *     websocket: 'ws://localhost:3001',
 *     indexer: 'http://localhost:3002'
 *   }
 * });
 * 
 * // Initialize the SDK
 * await sdk.initialize();
 * 
 * // Create social wallet
 * const wallet = await sdk.createWallet({
 *   socialId: 'user@company.com',
 *   socialType: 'email',
 *   chains: ['ethereum', 'solana']
 * });
 * 
 * // Send cross-chain payment
 * const tx = await sdk.sendPayment({
 *   from: { chain: 'solana', socialId: 'sender@email.com' },
 *   to: { chain: 'ethereum', address: '0x...' },
 *   amount: '100',
 *   token: 'USDC'
 * });
 * ```
 */

// ============================================================================
// CORE SDK EXPORTS
// ============================================================================

export { NexusSDK } from './core/NexusSDK';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Configuration Types
  NexusConfig,
  
  // Chain Types
  SupportedChain,
  EVMChain,
  SVMChain,
  SocialIdType,
  
  // Wallet Types
  CreateWalletParams,
  WalletInfo,
  
  // Transaction Types
  TransactionParams,
  TransactionResult,
  
  // Bridge Types
  BridgeParams,
  BridgeResult,
  
  // Recovery Types
  RecoveryParams,
  
  // Analytics Types
  AnalyticsData,
  
  // Error Types
  NexusError,
  
  // Event Types
  WalletEvent,
  
  // Config Types
  ChainConfig,
  PlatformConfig,
  ContractAddresses,
  
  // User Operation Types
  UserOperation,
  Guardian,
  PaymasterPolicy
} from './types';

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

/**
 * Supported chains configuration
 */
export const SUPPORTED_CHAINS = {
  EVM: [
    'ethereum',
    'polygon',
    'arbitrum',
    'base',
    'optimism',
    'avalanche',
    'bsc',
    'fantom',
    'gnosis',
    'celo',
    'moonbeam',
    'aurora'
  ] as const,
  SVM: ['solana'] as const
} as const;

/**
 * Default configuration templates for local development
 */
export const DEFAULT_CONFIGS = {
  /**
   * Local development configuration
   */
  LOCAL_DEVELOPMENT: {
    environment: 'development' as const,
    chains: ['ethereum', 'polygon', 'solana'] as const,
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      analytics: true,
      gasTank: true,
      tokenSwaps: true,
      defiIntegrations: true
    },
    endpoints: {
      api: 'http://localhost:3001',
      websocket: 'ws://localhost:3001',
      indexer: 'http://localhost:3002'
    }
  },
  
  /**
   * Ngrok tunneling configuration (for sharing with others)
   */
  NGROK_DEVELOPMENT: {
    environment: 'development' as const,
    chains: ['ethereum', 'polygon', 'solana'] as const,
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      analytics: true,
      gasTank: true,
      tokenSwaps: true,
      defiIntegrations: true
    },
    endpoints: {
      api: 'https://your-ngrok-url.ngrok.io',
      websocket: 'wss://your-ngrok-url.ngrok.io',
      indexer: 'https://your-ngrok-url.ngrok.io'
    }
  },
  
  /**
   * Free hosting configuration (Railway, Vercel, etc.)
   */
  FREE_HOSTING: {
    environment: 'staging' as const,
    chains: ['ethereum', 'polygon', 'arbitrum', 'base', 'solana'] as const,
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      analytics: true,
      gasTank: true,
      tokenSwaps: true,
      defiIntegrations: true
    },
    endpoints: {
      api: 'https://your-app.railway.app',
      websocket: 'wss://your-app.railway.app',
      indexer: 'https://your-indexer.vercel.app'
    }
  },
  
  /**
   * Minimal configuration for simple use cases
   */
  MINIMAL: {
    environment: 'development' as const,
    chains: ['ethereum', 'solana'] as const,
    features: {
      socialRecovery: false,
      gaslessTransactions: true,
      crossChain: true,
      analytics: false,
      gasTank: true,
      tokenSwaps: false,
      defiIntegrations: false
    },
    endpoints: {
      api: 'http://localhost:3001'
    }
  }
} as const;

/**
 * Common token addresses across chains (real addresses)
 */
export const COMMON_TOKENS = {
  ethereum: {
    USDC: '0xA0b86a33E6F2c3b0C32C78bD8b4D4a4eD2a46C87',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  polygon: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
  },
  solana: {
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    WBTC: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E'
  }
} as const;

/**
 * Utility functions
 */
export const Utils = {
  /**
   * Create a local development configuration
   */
  createLocalConfig: (apiKey: string = 'local-dev-key') => ({
    apiKey,
    ...DEFAULT_CONFIGS.LOCAL_DEVELOPMENT
  }),
  
  /**
   * Create an ngrok configuration
   */
  createNgrokConfig: (apiKey: string, ngrokUrl: string) => ({
    apiKey,
    ...DEFAULT_CONFIGS.NGROK_DEVELOPMENT,
    endpoints: {
      api: `https://${ngrokUrl}.ngrok.io`,
      websocket: `wss://${ngrokUrl}.ngrok.io`,
      indexer: `https://${ngrokUrl}.ngrok.io`
    }
  }),
  
  /**
   * Create a basic NexusSDK configuration
   */
  createConfig: (apiKey: string, options: Partial<typeof DEFAULT_CONFIGS.LOCAL_DEVELOPMENT> = {}) => ({
    apiKey,
    ...DEFAULT_CONFIGS.LOCAL_DEVELOPMENT,
    ...options
  }),
  
  /**
   * Check if a chain is EVM-compatible
   */
  isEVMChain: (chain: string): boolean => {
    return [...SUPPORTED_CHAINS.EVM].indexOf(chain) !== -1;
  },
  
  /**
   * Check if a chain is SVM-compatible
   */
  isSVMChain: (chain: string): boolean => {
    return [...SUPPORTED_CHAINS.SVM].indexOf(chain) !== -1;
  },
  
  /**
   * Get token address for a chain
   */
  getTokenAddress: (symbol: string, chain: keyof typeof COMMON_TOKENS): string | null => {
    const tokens = COMMON_TOKENS[chain];
    return tokens ? (tokens as any)[symbol] || null : null;
  }
} as const;

// ============================================================================
// FREE HOSTING RECOMMENDATIONS
// ============================================================================

/**
 * Free hosting options for your NexusSDK backend
 */
export const FREE_HOSTING_OPTIONS = {
  /**
   * Railway.app - Great for Node.js backends
   * Free tier: 500 hours/month, automatic deployments from GitHub
   */
  RAILWAY: {
    name: 'Railway',
    url: 'https://railway.app',
    pros: ['Easy Node.js deployment', 'PostgreSQL included', 'GitHub integration'],
    pricing: 'Free tier: 500 hours/month',
    setup: 'Connect GitHub repo, auto-deploy'
  },
  
  /**
   * Vercel - Perfect for Next.js frontends and serverless APIs
   * Free tier: Unlimited bandwidth, 100GB transfers
   */
  VERCEL: {
    name: 'Vercel',
    url: 'https://vercel.com',
    pros: ['Next.js optimized', 'Serverless functions', 'Global CDN'],
    pricing: 'Free tier: Unlimited projects',
    setup: 'Deploy from GitHub in 1 click'
  },
  
  /**
   * Supabase - Open source Firebase alternative
   * Free tier: 500MB database, 2GB transfers
   */
  SUPABASE: {
    name: 'Supabase',
    url: 'https://supabase.com',
    pros: ['PostgreSQL database', 'Real-time subscriptions', 'Auth built-in'],
    pricing: 'Free tier: 500MB database',
    setup: 'Create project, get API keys'
  },
  
  /**
   * Render - Simple deployment platform
   * Free tier: 750 hours/month for web services
   */
  RENDER: {
    name: 'Render',
    url: 'https://render.com',
    pros: ['Simple deployment', 'Auto-scaling', 'SSL certificates'],
    pricing: 'Free tier: 750 hours/month',
    setup: 'Connect repo, auto-deploy'
  }
} as const;

/**
 * Free domain options
 */
export const FREE_DOMAIN_OPTIONS = {
  /**
   * Freenom - Free domains (.tk, .ga, .cf)
   */
  FREENOM: {
    name: 'Freenom',
    url: 'https://freenom.com',
    domains: ['.tk', '.ga', '.cf', '.ml'],
    duration: 'Free for 1 year'
  },
  
  /**
   * GitHub Pages - Free subdomain
   */
  GITHUB_PAGES: {
    name: 'GitHub Pages',
    url: 'https://pages.github.com',
    domains: ['username.github.io'],
    duration: 'Free forever'
  },
  
  /**
   * Vercel - Free subdomain
   */
  VERCEL_SUBDOMAIN: {
    name: 'Vercel Subdomain',
    url: 'https://vercel.com',
    domains: ['your-app.vercel.app'],
    duration: 'Free forever'
  }
} as const;

// ============================================================================
// VERSION INFO
// ============================================================================

export const VERSION = '2.0.0';
export const SDK_NAME = 'NexusSDK';
export const DESCRIPTION = 'The ThirdWeb Killer with SVM-EVM Integration';

/**
 * Get SDK information
 */
export function getSDKInfo() {
  return {
    name: SDK_NAME,
    version: VERSION,
    description: DESCRIPTION,
    supportedChains: {
      evm: SUPPORTED_CHAINS.EVM,
      svm: SUPPORTED_CHAINS.SVM,
      total: SUPPORTED_CHAINS.EVM.length + SUPPORTED_CHAINS.SVM.length
    },
    features: [
      'Cross-chain Wallet Infrastructure',
      'Social Login Integration', 
      'Gas Tank (Gasless Transactions)',
      'Cross-chain Asset Bridge',
      'DeFi Integration',
      'Token Swaps',
      'Analytics & Insights',
      'Social Recovery',
      'Multi-chain Support'
    ],
    localDevelopment: true,
    freeHostingSupported: true,
    repository: 'https://github.com/your-username/nexus-sdk' // Update with your repo
  };
} 