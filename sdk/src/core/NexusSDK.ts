/**
 * NexusSDK v1.0.1 - Cross-Chain Wallet Infrastructure
 * 
 * SDK for real blockchain wallet creation and deployment
 */

import { 
  NexusConfig, 
  WalletInfo, 
  SupportedChain,
  SocialIdType
} from '../types';

// Simple interfaces for API endpoints
interface WalletOptions {
  socialId: string;
  socialType?: SocialIdType;
  chains?: SupportedChain[];
  metadata?: any;
  paymaster?: boolean; // true = company pays gas, false = user pays gas
}

interface PaymentOptions {
  from: any;
  to: any;
  amount: string;
  asset?: string;
  gasless?: boolean;
}

interface TokenTransferOptions {
  from: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
  };
  to: {
    address: string;
    chain: SupportedChain;
  };
  tokenAddress: string;
  amount: string;
  decimals?: number;
  gasless?: boolean;
}

interface NFTTransferOptions {
  from: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
  };
  to: {
    address: string;
    chain: SupportedChain;
  };
  nftContract: string;
  tokenId: string;
  gasless?: boolean;
}

interface TokenMintOptions {
  socialId: string;
  socialType?: SocialIdType;
  chain: SupportedChain;
  tokenContract: string;
  amount: string;
  metadata?: any;
}

interface NFTMintOptions {
  socialId: string;
  socialType?: SocialIdType;
  chain: SupportedChain;
  nftContract: string;
  tokenURI: string;
  metadata?: any;
}

/**
 * Main NexusSDK class - Your gateway to cross-chain wallet infrastructure
 */
export class NexusSDK {
  private config: NexusConfig;
  private initialized: boolean = false;
  private requestCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(config: NexusConfig) {
    this.config = {
      environment: 'production',
      endpoints: {
        api: 'https://backend-amber-zeta-94.vercel.app'
      },
      ...config,
      chains: config.chains || ['ethereum', 'polygon', 'solana']
    };
  }

  async initialize(): Promise<void> {
    try {
      // Test API connection
      const response = await fetch(`${this.config.endpoints?.api}/health`, {
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`API connection failed: ${response.status}`);
      }
      
      this.initialized = true;
      console.log('NexusSDK initialized successfully');
    } catch (error) {
      console.error('NexusSDK initialization failed:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('NexusSDK not initialized. Call initialize() first.');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}, cacheable: boolean = false): Promise<any> {
    this.ensureInitialized();
    
    // Check cache for GET requests
    const cacheKey = `${endpoint}:${JSON.stringify(options.body || {})}`;
    if (cacheable && options.method !== 'POST' && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
      this.requestCache.delete(cacheKey);
    }
    
    const url = `${this.config.endpoints?.api}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'User-Agent': `NexusSDK/1.0.1`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Cache successful GET requests
    if (cacheable && options.method !== 'POST') {
      this.requestCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }

  /**
   * Create a wallet and deploy it to blockchain
   * ✅ Creates real blockchain wallets visible on block explorers
   * @param options.paymaster - true: company pays gas fees, false: user pays gas fees
   */
  async createWallet(options: WalletOptions): Promise<any> {
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

    return response;
  }

  /**
   * Create wallet with predicted addresses only (not deployed)
   * ⚠️ These addresses won't show up on block explorers until deployed
   */
  async createPredictedWallet(options: WalletOptions): Promise<WalletInfo> {
    const response = await this.makeRequest('/api/wallets', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chains: options.chains || this.config.chains,
        metadata: options.metadata || {}
      }),
    });

    return response;
  }

  /**
   * Deploy existing predicted wallet to blockchain
   */
  async deployWallet(options: WalletOptions): Promise<any> {
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

    return response;
  }

  /**
   * Get wallet information (cached for efficiency)
   */
  async getWallet(socialId: string, socialType: string = 'email'): Promise<WalletInfo> {
    const encodedSocialId = encodeURIComponent(socialId);
    return this.makeRequest(`/api/wallets/${encodedSocialId}?socialType=${socialType}`, {}, true);
  }

  /**
   * Batch create multiple wallets efficiently
   */
  async createWalletBatch(wallets: WalletOptions[]): Promise<any[]> {
    const promises = wallets.map(wallet => this.createWallet(wallet));
    const results = await Promise.allSettled(promises);
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { error: result.reason.message }
    );
  }

  /**
   * Check multiple wallet statuses efficiently
   */
  async getWalletBatch(walletIds: Array<{socialId: string, socialType?: string}>): Promise<any[]> {
    const promises = walletIds.map(({ socialId, socialType = 'email' }) => 
      this.getWallet(socialId, socialType).catch(error => ({ error: error.message, socialId, socialType }))
    );
    
    return Promise.all(promises);
  }

  /**
   * Send cross-chain payment
   */
  async sendPayment(options: PaymentOptions): Promise<any> {
    return this.makeRequest('/api/payments', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Bridge assets between chains
   */
  async bridgeAssets(options: any): Promise<any> {
    return this.makeRequest('/api/bridge', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Get private key (tracked for compliance)
   */
  async getPrivateKey(options: {
    socialId: string;
    socialType?: SocialIdType;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    return this.makeRequest(`/api/wallets/${encodeURIComponent(options.socialId)}/private-key`, {
      method: 'POST',
      body: JSON.stringify({
        socialType: options.socialType || 'email',
        reason: options.reason || 'user_requested',
        ipAddress: options.ipAddress,
        userAgent: options.userAgent
      }),
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
   * Pay user transaction fees (sponsored transactions)
   */
  async payUserFees(options: {
    companyId: string;
    userSocialId: string;
    chain?: string;
    amount?: string;
    txHash?: string;
    transactionType?: string;
    estimatedGas?: string;
  }): Promise<any> {
    return this.makeRequest(`/api/companies/${options.companyId}/pay-fees`, {
      method: 'POST',
      body: JSON.stringify({
        userSocialId: options.userSocialId,
        chain: options.chain,
        amount: options.amount,
        txHash: options.txHash,
        transactionType: options.transactionType,
        estimatedGas: options.estimatedGas
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
   * Get usage analytics
   */
  async getUsageAnalytics(options: { timeframe?: string } = {}): Promise<any> {
    const params = options.timeframe ? `?timeframe=${options.timeframe}` : '';
    return this.makeRequest(`/api/analytics/usage${params}`);
  }

  /**
   * Get wallet balances across all chains
   */
  async getWalletBalances(socialId: string, socialType: string = 'email'): Promise<any> {
    const encodedSocialId = encodeURIComponent(socialId);
    return this.makeRequest(`/api/wallets/${encodedSocialId}/balances?socialType=${socialType}`);
  }

  /**
   * Get SDK configuration
   */
  getConfig(): NexusConfig {
    return { ...this.config };
  }

  /**
   * Clear request cache (useful for third-party apps)
   */
  clearCache(): void {
    this.requestCache.clear();
    console.log('🧹 SDK cache cleared');
  }

  /**
   * Health check for third-party monitoring
   */
  async healthCheck(): Promise<any> {
    try {
      const health = await this.makeRequest('/health', {}, true);
      return {
        ...health,
        sdk: {
          version: '1.0.1',
          cacheSize: this.requestCache.size,
          initialized: this.initialized
        }
      };
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Generate webhook-safe wallet identifier for third-party integrations
   */
  generateWebhookId(socialId: string, socialType: string): string {
    return Buffer.from(`${socialType}:${socialId}`).toString('base64');
  }

  /**
   * Parse webhook identifier back to social credentials
   */
  parseWebhookId(webhookId: string): { socialId: string; socialType: string } {
    try {
      const decoded = Buffer.from(webhookId, 'base64').toString('utf-8');
      const [socialType, socialId] = decoded.split(':');
      return { socialId, socialType };
    } catch (error) {
      throw new Error('Invalid webhook ID format');
    }
  }

  /**
   * Validate configuration for third-party apps
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.config.apiKey) {
      errors.push('API key is required');
    }
    
    if (!this.config.endpoints?.api) {
      errors.push('API endpoint is required');
    }
    
    if (!this.config.chains || this.config.chains.length === 0) {
      errors.push('At least one chain must be specified');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get SDK statistics for monitoring
   */
  getStats(): any {
    return {
      version: '1.0.1',
      initialized: this.initialized,
      cacheSize: this.requestCache.size,
      supportedChains: this.config.chains,
      environment: this.config.environment,
      endpoint: this.config.endpoints?.api
    };
  }

  // =============================================================================
  // TOKEN & NFT FUNCTIONALITY
  // =============================================================================

  /**
   * Transfer ERC20/SPL tokens between wallets
   * Supports cross-chain token transfers
   */
  async transferToken(options: TokenTransferOptions): Promise<any> {
    const response = await this.makeRequest('/api/tokens/transfer', {
      method: 'POST',
      body: JSON.stringify({
        from: {
          socialId: options.from.socialId,
          socialType: options.from.socialType || 'email',
          chain: options.from.chain
        },
        to: {
          address: options.to.address,
          chain: options.to.chain
        },
        tokenAddress: options.tokenAddress,
        amount: options.amount,
        decimals: options.decimals || 18,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }

  /**
   * Transfer NFTs (ERC721/ERC1155/Metaplex) between wallets
   */
  async transferNFT(options: NFTTransferOptions): Promise<any> {
    const response = await this.makeRequest('/api/nfts/transfer', {
      method: 'POST',
      body: JSON.stringify({
        from: {
          socialId: options.from.socialId,
          socialType: options.from.socialType || 'email',
          chain: options.from.chain
        },
        to: {
          address: options.to.address,
          chain: options.to.chain
        },
        nftContract: options.nftContract,
        tokenId: options.tokenId,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }

  /**
   * Get all tokens owned by a wallet
   */
  async getTokenBalances(socialId: string, socialType: string = 'email', chain?: SupportedChain): Promise<any> {
    const response = await this.makeRequest('/api/tokens/balances', {
      method: 'POST',
      body: JSON.stringify({
        socialId,
        socialType,
        chain
      }),
    }, true);

    return response;
  }

  /**
   * Get all NFTs owned by a wallet
   */
  async getNFTs(socialId: string, socialType: string = 'email', chain?: SupportedChain): Promise<any> {
    const response = await this.makeRequest('/api/nfts/list', {
      method: 'POST',
      body: JSON.stringify({
        socialId,
        socialType,
        chain
      }),
    }, true);

    return response;
  }

  /**
   * Mint new tokens to a wallet
   */
  async mintTokens(options: TokenMintOptions): Promise<any> {
    const response = await this.makeRequest('/api/tokens/mint', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        tokenContract: options.tokenContract,
        amount: options.amount,
        metadata: options.metadata
      }),
    });

    return response;
  }

  /**
   * Mint new NFT to a wallet
   */
  async mintNFT(options: NFTMintOptions): Promise<any> {
    const response = await this.makeRequest('/api/nfts/mint', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        nftContract: options.nftContract,
        tokenURI: options.tokenURI,
        metadata: options.metadata
      }),
    });

    return response;
  }

  /**
   * Get token information and metadata
   */
  async getTokenInfo(tokenAddress: string, chain: SupportedChain): Promise<any> {
    const response = await this.makeRequest('/api/tokens/info', {
      method: 'POST',
      body: JSON.stringify({
        tokenAddress,
        chain
      }),
    }, true);

    return response;
  }

  /**
   * Get NFT metadata and details
   */
  async getNFTMetadata(nftContract: string, tokenId: string, chain: SupportedChain): Promise<any> {
    const response = await this.makeRequest('/api/nfts/metadata', {
      method: 'POST',
      body: JSON.stringify({
        nftContract,
        tokenId,
        chain
      }),
    }, true);

    return response;
  }

  /**
   * Swap tokens using DEX aggregators
   */
  async swapTokens(options: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
    fromToken: string;
    toToken: string;
    amount: string;
    slippage?: number;
    gasless?: boolean;
  }): Promise<any> {
    const response = await this.makeRequest('/api/tokens/swap', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        fromToken: options.fromToken,
        toToken: options.toToken,
        amount: options.amount,
        slippage: options.slippage || 1,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }

  /**
   * Approve token spending for smart contracts
   */
  async approveToken(options: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
    tokenAddress: string;
    spenderAddress: string;
    amount: string;
    gasless?: boolean;
  }): Promise<any> {
    const response = await this.makeRequest('/api/tokens/approve', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        tokenAddress: options.tokenAddress,
        spenderAddress: options.spenderAddress,
        amount: options.amount,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }

  /**
   * List NFT on marketplace
   */
  async listNFT(options: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
    nftContract: string;
    tokenId: string;
    price: string;
    marketplace: string;
    gasless?: boolean;
  }): Promise<any> {
    const response = await this.makeRequest('/api/nfts/list', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        nftContract: options.nftContract,
        tokenId: options.tokenId,
        price: options.price,
        marketplace: options.marketplace,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }

  /**
   * Get transaction history for tokens and NFTs
   */
  async getTransactionHistory(socialId: string, socialType: string = 'email', options?: {
    chain?: SupportedChain;
    asset?: 'native' | 'tokens' | 'nfts' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const response = await this.makeRequest('/api/transactions/history', {
      method: 'POST',
      body: JSON.stringify({
        socialId,
        socialType,
        chain: options?.chain,
        asset: options?.asset || 'all',
        limit: options?.limit || 50,
        offset: options?.offset || 0
      }),
    }, true);

    return response;
  }

  /**
   * Deploy new ERC20/SPL token contract
   */
  async deployToken(options: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    metadata?: any;
    gasless?: boolean;
  }): Promise<any> {
    const response = await this.makeRequest('/api/tokens/deploy', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        name: options.name,
        symbol: options.symbol,
        decimals: options.decimals,
        totalSupply: options.totalSupply,
        metadata: options.metadata,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }

  /**
   * Deploy new NFT collection contract
   */
  async deployNFTCollection(options: {
    socialId: string;
    socialType?: SocialIdType;
    chain: SupportedChain;
    name: string;
    symbol: string;
    baseURI?: string;
    metadata?: any;
    gasless?: boolean;
  }): Promise<any> {
    const response = await this.makeRequest('/api/nfts/deploy', {
      method: 'POST',
      body: JSON.stringify({
        socialId: options.socialId,
        socialType: options.socialType || 'email',
        chain: options.chain,
        name: options.name,
        symbol: options.symbol,
        baseURI: options.baseURI,
        metadata: options.metadata,
        gasless: options.gasless !== false
      }),
    });

    return response;
  }
} 