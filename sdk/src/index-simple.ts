/**
 * NexusSDK v1.0.1 - Simplified Cross-Chain Wallet SDK
 * 
 * Production-ready SDK for real blockchain wallet creation
 */

export interface NexusConfig {
  apiKey: string;
  environment?: 'production' | 'development';
  chains?: string[];
  endpoints?: {
    api?: string;
  };
}

export interface WalletInfo {
  socialId: string;
  socialType: string;
  addresses: {
    [chain: string]: string;
  };
  metadata?: any;
  deploymentStatus?: {
    [chain: string]: 'deployed' | 'pending' | 'failed';
  };
}

/**
 * Simple NexusSDK class for cross-chain wallet creation
 */
export class NexusSDK {
  private config: NexusConfig;
  private initialized: boolean = false;

  constructor(config: NexusConfig) {
    this.config = {
      environment: 'production',
      endpoints: {
        api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
      },
      ...config,
      chains: config.chains || ['ethereum', 'solana']
    };
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${this.config.endpoints?.api}/health`, {
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`API connection failed: ${response.status}`);
      }
      
      this.initialized = true;
      console.log('✅ NexusSDK initialized successfully');
    } catch (error) {
      console.error('❌ NexusSDK initialization failed:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('NexusSDK not initialized. Call initialize() first.');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    this.ensureInitialized();
    
    const url = `${this.config.endpoints?.api}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create and deploy real blockchain wallets
   */
  async createWallet(options: {
    socialId: string;
    socialType?: string;
    chains?: string[];
    paymaster?: boolean;
    metadata?: any;
  }): Promise<WalletInfo> {
    console.log('🚀 Creating and deploying real blockchain wallet...');
    
    const response = await this.makeRequest('/api/wallets/deploy', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chains: options.chains || this.config.chains,
        metadata: options.metadata || {},
        paymaster: options.paymaster !== false
      }),
    });

    console.log('✅ REAL BLOCKCHAIN WALLETS DEPLOYED!');
    console.log('🔍 Addresses are now visible on block explorers');
    
    return response;
  }

  /**
   * Get wallet information
   */
  async getWallet(socialId: string, socialType: string = 'email'): Promise<WalletInfo> {
    const encodedSocialId = encodeURIComponent(socialId);
    return this.makeRequest(`/api/wallets/${encodedSocialId}?socialType=${socialType}`);
  }

  /**
   * Send cross-chain payment
   */
  async sendPayment(options: {
    from: { socialId: string; chain: string };
    to: { socialId: string; chain: string };
    amount: string;
    asset?: string;
    gasless?: boolean;
  }): Promise<any> {
    return this.makeRequest('/api/payments', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Bridge assets between chains
   */
  async bridgeAssets(options: {
    from: { chain: string; asset: string };
    to: { chain: string; asset: string };
    amount: string;
  }): Promise<any> {
    return this.makeRequest('/api/bridge', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Fund company gas tank
   */
  async fundGasTank(options: {
    companyId: string;
    amount: string;
    chain: string;
    token?: string;
  }): Promise<any> {
    return this.makeRequest(`/api/companies/${options.companyId}/gas-tank/fund`, {
      method: 'POST',
      body: JSON.stringify({
        amount: options.amount,
        chain: options.chain,
        token: options.token || 'ETH'
      }),
    });
  }

  /**
   * Get gas tank status
   */
  async getGasTankStatus(options: { companyId: string }): Promise<any> {
    return this.makeRequest(`/api/companies/${options.companyId}/gas-tank`);
  }

  /**
   * Get private key (tracked for compliance)
   */
  async getPrivateKey(options: {
    socialId: string;
    socialType?: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const params = new URLSearchParams({
      socialType: options.socialType || 'email',
      reason: options.reason || 'user_requested',
      ...(options.ipAddress && { ipAddress: options.ipAddress }),
      ...(options.userAgent && { userAgent: options.userAgent })
    });

    return this.makeRequest(`/api/wallets/${encodeURIComponent(options.socialId)}/private-key?${params}`);
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(options: { timeframe?: string } = {}): Promise<any> {
    const params = options.timeframe ? `?timeframe=${options.timeframe}` : '';
    return this.makeRequest(`/api/analytics/usage${params}`);
  }

  /**
   * Get SDK configuration
   */
  getConfig(): NexusConfig {
    return { ...this.config };
  }
}

// Common social types
export const COMMON_SOCIAL_TYPES = {
  EMAIL: 'email',
  PHONE: 'phone',
  GOOGLE: 'google',
  TWITTER: 'twitter',
  DISCORD: 'discord',
  GITHUB: 'github',
  GAME_ID: 'gameId',
  USER_ID: 'userId',
  PLAYER_TAG: 'playerTag',
  NFT_HOLDER: 'nftHolder',
  WALLET_ADDRESS: 'walletAddress'
} as const;

// Supported chains
export const SUPPORTED_CHAINS = {
  EVM: ['ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanche', 'bsc'] as const,
  SVM: ['solana'] as const
} as const;

// Utility functions
export const Utils = {
  createConfig: (apiKey: string, options: Partial<NexusConfig> = {}) => ({
    apiKey,
    environment: 'production' as const,
    chains: ['ethereum', 'solana'],
    endpoints: {
      api: 'https://nexuspay-5dhrqoe12-griffins-projects-4324ce43.vercel.app'
    },
    ...options
  }),
  
  isEVMChain: (chain: string): boolean => {
    return SUPPORTED_CHAINS.EVM.includes(chain as any);
  },
  
  isSVMChain: (chain: string): boolean => {
    return SUPPORTED_CHAINS.SVM.includes(chain as any);
  }
};

// Version info
export const VERSION = '1.0.1';
export const SDK_NAME = 'NexusSDK';

export default NexusSDK; 