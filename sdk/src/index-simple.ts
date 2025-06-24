/**
 * NexusSDK - Cross-chain wallet infrastructure with SVM-EVM Integration
 * 
 * @version 1.0.0
 * @description Simplified SDK for EVM + SVM wallet infrastructure with gasless transactions and asset bridging
 * @author NexusPay Team
 */

// ============================================================================
// CORE TYPES EXPORT
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
 * Default configuration templates for development
 */
export const DEFAULT_CONFIGS = {
  LOCAL_DEVELOPMENT: {
    environment: 'development' as const,
    chains: ['ethereum', 'polygon', 'solana'] as const,
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      analytics: true
    },
    endpoints: {
      api: 'http://localhost:3001',
      websocket: 'ws://localhost:3001'
    }
  },
  
  PRODUCTION: {
    environment: 'production' as const,
    chains: ['ethereum', 'polygon', 'solana'] as const,
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      analytics: true
    },
    endpoints: {
      api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app',
      websocket: 'wss://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
    }
  },
  
  NGROK_DEVELOPMENT: {
    environment: 'development' as const,
    chains: ['ethereum', 'polygon', 'solana'] as const,
    features: {
      socialRecovery: true,
      gaslessTransactions: true,
      crossChain: true,
      analytics: true
    },
    endpoints: {
      api: 'https://your-ngrok-url.ngrok.io',
      websocket: 'wss://your-ngrok-url.ngrok.io'
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
   * Create a production configuration
   */
  createProductionConfig: (apiKey: string) => ({
    apiKey,
    ...DEFAULT_CONFIGS.PRODUCTION
  }),
  
  /**
   * Create an ngrok configuration
   */
  createNgrokConfig: (apiKey: string, ngrokUrl: string) => ({
    apiKey,
    ...DEFAULT_CONFIGS.NGROK_DEVELOPMENT,
    endpoints: {
      api: `https://${ngrokUrl}.ngrok.io`,
      websocket: `wss://${ngrokUrl}.ngrok.io`
    }
  }),
  
  /**
   * Create a basic NexusSDK configuration
   */
  createConfig: (apiKey: string, options: Partial<typeof DEFAULT_CONFIGS.LOCAL_DEVELOPMENT> = {}) => ({
    apiKey,
    ...DEFAULT_CONFIGS.LOCAL_DEVELOPMENT,
    ...options
  })
} as const;

// ============================================================================
// SIMPLIFIED NEXUS SDK CLASS
// ============================================================================

/**
 * Simplified NexusSDK class for initial npm release
 */
export class NexusSDK {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  /**
   * Initialize the SDK
   */
  async initialize(): Promise<void> {
    console.log('NexusSDK initialized with config:', this.config);
  }
  
  /**
   * Create a new wallet
   */
  async createWallet(params: any): Promise<any> {
    const response = await fetch(`${this.config.endpoints.api}/api/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Get wallet by social ID
   */
  async getWallet(socialId: string, socialType: string = 'email'): Promise<any> {
    const url = new URL(`${this.config.endpoints.api}/api/wallets/${encodeURIComponent(socialId)}`);
    url.searchParams.append('socialType', socialType);
    
    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Send payment
   */
  async sendPayment(params: any): Promise<any> {
    const response = await fetch(`${this.config.endpoints.api}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Bridge assets between chains
   */
  async bridgeAssets(params: any): Promise<any> {
    const response = await fetch(`${this.config.endpoints.api}/api/bridge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Get gas tank balance
   */
  async getGasTankBalance(socialId: string): Promise<any> {
    const response = await fetch(`${this.config.endpoints.api}/api/gas-tank/${encodeURIComponent(socialId)}`, {
      headers: {
        'X-API-Key': this.config.apiKey
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Refill gas tank
   */
  async refillGasTank(params: any): Promise<any> {
    const response = await fetch(`${this.config.endpoints.api}/api/gas-tank/refill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  /**
   * Get SDK information
   */
  getSDKInfo() {
    return {
      name: '@nexuspay/sdk',
      version: '1.0.0',
      description: 'Cross-chain wallet SDK supporting both EVM and Solana (SVM) networks',
      supportedChains: SUPPORTED_CHAINS,
      features: [
        'Multi-chain wallets',
        'Gasless transactions',
        'Cross-chain payments',
        'Asset bridging',
        'Social recovery'
      ],
      endpoints: this.config.endpoints,
      environment: this.config.environment
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get SDK information
 */
export function getSDKInfo() {
  return {
    name: '@nexuspay/sdk',
    version: '1.0.0',
    description: 'Cross-chain wallet SDK supporting both EVM and Solana (SVM) networks',
    author: 'NexusPay Team',
    repository: 'https://github.com/NexusPay-App/SVM-EVM-CHAIN-ABSTRACTION',
    supportedChains: SUPPORTED_CHAINS,
    features: [
      'Multi-chain wallets (EVM + Solana)',
      'Gasless transactions via paymaster',
      'Cross-chain payments',
      'Asset bridging between chains',
      'Social recovery system',
      'Account abstraction'
    ]
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default NexusSDK; 