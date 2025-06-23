/**
 * NexusSDK - The ThirdWeb Killer with SVM-EVM Integration
 * 
 * Unified interface for companies to build DApps on both ecosystems
 * Features: Gas Tank, DeFi primitives, Cross-chain bridge, Social wallets
 * 
 * @example
 * ```typescript
 * import { NexusSDK } from '@nexusplatform/sdk';
 * 
 * const sdk = new NexusSDK({
 *   apiKey: 'your-api-key',
 *   projectId: 'your-project',
 *   chains: ['ethereum', 'polygon', 'solana'],
 *   features: {
 *     gasTank: true,
 *     crossChain: true,
 *     defiIntegrations: true
 *   }
 * });
 * ```
 */

import { 
  NexusConfig, 
  CreateWalletParams, 
  WalletInfo, 
  TransactionParams,
  TransactionResult,
  BridgeParams,
  BridgeResult,
  RecoveryParams,
  AnalyticsData,
  UserAnalytics,
  SupportedChain,
  EVMChain,
  SVMChain,
  TokenInfo,
  TokenBalance,
  GasTankBalance,
  GasTankRefillParams,
  GasTankUsage,
  SwapParams,
  SwapResult,
  LendingPosition,
  YieldPosition,
  NexusError,
  ErrorCode,
  PaginationParams,
  FilterParams
} from '../types';

import { EVMManager } from '../managers/EVMManager';
import { SVMManager } from '../managers/SVMManager'; 
import { CrossChainBridge } from '../bridge/CrossChainBridge';
import { SocialRecovery } from '../recovery/SocialRecovery';
import { GasTankManager } from '../gastank/GasTankManager';
import { DeFiManager } from '../defi/DeFiManager';
import { TokenManager } from '../tokens/TokenManager';
import { AnalyticsManager } from '../analytics/AnalyticsManager';

/**
 * Main NexusSDK Class - The ThirdWeb Alternative with Superpowers
 * 
 * @example
 * ```typescript
 * import { NexusSDK } from '@nexusplatform/sdk';
 * 
 * const sdk = new NexusSDK({
 *   apiKey: 'your-api-key',
 *   projectId: 'your-project',
 *   chains: ['ethereum', 'polygon', 'solana'],
 *   features: {
 *     gasTank: true,
 *     crossChain: true,
 *     defiIntegrations: true
 *   }
 * });
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
export class NexusSDK {
  private config: NexusConfig;
  private evmManager: EVMManager;
  private svmManager: SVMManager;
  private bridge: CrossChainBridge;
  private recovery: SocialRecovery;
  private gasTank: GasTankManager;
  private defi: DeFiManager;
  private tokens: TokenManager;
  private analytics: AnalyticsManager;
  private initialized: boolean = false;

  constructor(config: NexusConfig) {
    this.validateConfig(config);
    this.config = config;
    
    console.log(`🚀 Initializing NexusSDK v2.0 - The ThirdWeb Killer`);
    console.log(`📊 Chains: ${config.chains.join(', ')}`);
    console.log(`⚡ Features: ${Object.keys(config.features || {}).join(', ')}`);
    
    // Initialize core managers
    this.evmManager = new EVMManager(config);
    this.svmManager = new SVMManager(config);
    this.tokens = new TokenManager(config);
    this.gasTank = new GasTankManager(config, this.evmManager, this.svmManager);
    this.bridge = new CrossChainBridge(config, this.evmManager, this.svmManager);
    this.recovery = new SocialRecovery(config);
    this.defi = new DeFiManager(config, this.evmManager, this.svmManager);
    this.analytics = new AnalyticsManager(config);
  }

  /**
   * Initialize the SDK - Must be called before using other methods
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('🔧 Initializing NexusSDK components...');
    
    try {
      // Initialize all managers in parallel
      await Promise.all([
        this.tokens.initialize(),
        this.evmManager.initialize(),
        this.svmManager.initialize(),
        this.gasTank.initialize(),
        this.defi.initialize()
      ]);
      
      this.initialized = true;
      console.log('✅ NexusSDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize NexusSDK:', error);
      throw new Error(`SDK initialization failed: ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // WALLET MANAGEMENT
  // ============================================================================

  /**
   * Create a new social wallet across specified chains
   * 
   * @example
   * ```typescript
   * const wallet = await sdk.createWallet({
   *   socialId: 'user@company.com',
   *   socialType: 'email',
   *   chains: ['ethereum', 'polygon', 'solana'],
   *   gasTankConfig: {
   *     enabled: true,
   *     autoRefill: true,
   *     refillThreshold: '0.01' // Refill when below 0.01 ETH/SOL
   *   }
   * });
   * ```
   */
  async createWallet(params: CreateWalletParams): Promise<WalletInfo> {
    await this.ensureInitialized();
    
    const { socialId, socialType, chains, gasTankConfig } = params;
    
    console.log(`🔐 Creating social wallet for ${socialType}: ${socialId}`);
    console.log(`🌐 Chains: ${chains.join(', ')}`);
    
    const addresses: Record<SupportedChain, string> = {} as any;
    const balances: Record<SupportedChain, TokenBalance[]> = {} as any;
    const gasTanks: Record<SupportedChain, GasTankBalance> = {} as any;
    
    // Create EVM wallets (same address across EVM chains using CREATE2)
    const evmChains = chains.filter(chain => chain !== 'solana') as EVMChain[];
    if (evmChains.length > 0) {
      const evmResult = await this.evmManager.createWallet(socialId, evmChains);
      evmChains.forEach(chain => {
        addresses[chain] = evmResult.address;
        balances[chain] = evmResult.balances[chain] || [];
      });
    }
    
    // Create SVM wallet (Solana using PDA)
    const svmChains = chains.filter(chain => chain === 'solana') as SVMChain[];
    if (svmChains.length > 0) {
      const svmResult = await this.svmManager.createWallet(socialId);
      addresses['solana'] = svmResult.address;
      balances['solana'] = svmResult.balances || [];
    }
    
    // Setup Gas Tanks if enabled
    if (gasTankConfig?.enabled && this.config.features?.gasTank) {
      for (const chain of chains) {
        const gasTankBalance = await this.gasTank.createGasTank(socialId, chain, {
          autoRefill: gasTankConfig.autoRefill || false,
          refillThreshold: gasTankConfig.refillThreshold || '0.01',
          refillAmount: gasTankConfig.refillAmount || '0.1'
        });
        gasTanks[chain] = gasTankBalance;
      }
    }
    
    const walletInfo: WalletInfo = {
      socialId,
      socialType,
      addresses,
      balances,
      gasTanks: Object.keys(gasTanks).length > 0 ? gasTanks : undefined,
      createdAt: new Date().toISOString(),
      recoverySetup: false,
      isActive: true,
      crossChainEnabled: this.config.features?.crossChain ?? false,
      gaslessEnabled: this.config.features?.gaslessTransactions ?? false,
      metadata: params.metadata
    };
    
    // Setup social recovery if requested
    if (params.recoveryOptions && this.config.features?.socialRecovery) {
      await this.recovery.setupRecovery(socialId, params.recoveryOptions);
      walletInfo.recoverySetup = true;
    }
    
    // Calculate total USD value
    const totalUsdValue = await this.calculateTotalUsdValue(balances);
    walletInfo.totalUsdValue = totalUsdValue;
    
    console.log(`✅ Social wallet created across ${chains.length} chains`);
    console.log(`💰 Total portfolio value: $${totalUsdValue}`);
    
    return walletInfo;
  }

  /**
   * Get wallet information with real-time balances
   */
  async getWallet(socialId: string, includeBalances: boolean = true): Promise<WalletInfo | null> {
    await this.ensureInitialized();
    
    try {
      const walletInfo = await this.analytics.getWalletInfo(socialId);
      if (!walletInfo) return null;
      
      if (includeBalances) {
        // Fetch real-time balances across all chains
        const balancePromises = Object.keys(walletInfo.addresses).map(async (chain) => {
          const address = walletInfo.addresses[chain as SupportedChain];
          return {
            chain: chain as SupportedChain,
            balances: await this.tokens.getTokenBalances(address, chain as SupportedChain)
          };
        });
        
        const balanceResults = await Promise.all(balancePromises);
        const balances: Record<SupportedChain, TokenBalance[]> = {} as any;
        
        balanceResults.forEach(result => {
          balances[result.chain] = result.balances;
        });
        
        walletInfo.balances = balances;
        walletInfo.totalUsdValue = await this.calculateTotalUsdValue(balances);
        
        // Update gas tank balances if enabled
        if (this.config.features?.gasTank && walletInfo.gasTanks) {
          const gasTankPromises = Object.keys(walletInfo.gasTanks).map(async (chain) => {
            return {
              chain: chain as SupportedChain,
              gasTank: await this.gasTank.getGasTankBalance(socialId, chain as SupportedChain)
            };
          });
          
          const gasTankResults = await Promise.all(gasTankPromises);
          const gasTanks: Record<SupportedChain, GasTankBalance> = {} as any;
          
          gasTankResults.forEach(result => {
            if (result.gasTank) {
              gasTanks[result.chain] = result.gasTank;
            }
          });
          
          walletInfo.gasTanks = gasTanks;
        }
      }
      
      return walletInfo;
    } catch (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }
  }

  // ============================================================================
  // PAYMENT & TRANSACTION METHODS
  // ============================================================================

  /**
   * Send payment (auto-detects if cross-chain bridge is needed)
   * 
   * @example
   * ```typescript
   * // Same chain payment
   * const tx = await sdk.sendPayment({
   *   from: { chain: 'ethereum', socialId: 'sender@email.com' },
   *   to: { chain: 'ethereum', address: '0x...' },
   *   amount: '100',
   *   token: 'USDC',
   *   gasSettings: { useGasTank: true }
   * });
   * 
   * // Cross-chain payment (auto-bridges)
   * const tx = await sdk.sendPayment({
   *   from: { chain: 'solana', socialId: 'sender@email.com' },
   *   to: { chain: 'ethereum', address: '0x...' },
   *   amount: '100',
   *   token: 'USDC'
   * });
   * ```
   */
  async sendPayment(params: TransactionParams): Promise<TransactionResult> {
    await this.ensureInitialized();
    
    const { from, to, amount, token = 'NATIVE' } = params;
    
    console.log(`💸 Sending ${amount} ${token} from ${from.chain} to ${to.chain}`);
    
    // Check if cross-chain payment
    if (from.chain !== to.chain) {
      console.log('🌉 Cross-chain payment detected, using bridge...');
      
      if (!this.config.features?.crossChain) {
        throw this.createError('BRIDGE_NOT_AVAILABLE', 'Cross-chain features not enabled');
      }
      
      // Convert to bridge params
      const bridgeParams: BridgeParams = {
        fromChain: from.chain,
        toChain: to.chain,
        amount,
        asset: token,
        recipient: to.address || (await this.getAddressFromSocialId(to.socialId!, to.chain)),
        socialId: from.socialId
      };
      
      const bridgeResult = await this.bridgeAssets(bridgeParams);
      
      // Return the source transaction with bridge metadata
      return {
        ...bridgeResult.fromTx,
        bridgeId: bridgeResult.bridgeId
      };
    }
    
    // Same chain payment
    if (from.chain === 'solana') {
      return await this.svmManager.sendTransaction(params);
    } else {
      return await this.evmManager.sendTransaction(params);
    }
  }

  /**
   * Bridge assets between EVM and SVM chains
   * This is your UNIQUE competitive advantage over ThirdWeb
   */
  async bridgeAssets(params: BridgeParams): Promise<BridgeResult> {
    await this.ensureInitialized();
    
    if (!this.config.features?.crossChain) {
      throw this.createError('BRIDGE_NOT_AVAILABLE', 'Cross-chain features not enabled');
    }
    
    console.log(`🌉 Bridging ${params.amount} ${params.asset} from ${params.fromChain} to ${params.toChain}`);
    
    const bridgeResult = await this.bridge.bridgeAssets(params);
    
    console.log(`✅ Bridge initiated: ${bridgeResult.bridgeId}`);
    return bridgeResult;
  }

  // ============================================================================
  // GAS TANK METHODS (UNIQUE FEATURE)
  // ============================================================================

  /**
   * Refill gas tank for gasless transactions
   * 
   * @example
   * ```typescript
   * // Refill with MetaMask
   * await sdk.refillGasTank({
   *   chain: 'ethereum',
   *   amount: '0.1',
   *   socialId: 'user@email.com',
   *   paymentMethod: 'metamask'
   * });
   * 
   * // Refill with external wallet transfer
   * await sdk.refillGasTank({
   *   chain: 'solana',
   *   amount: '0.5',
   *   socialId: 'user@email.com',
   *   paymentMethod: 'external_wallet'
   * });
   * ```
   */
  async refillGasTank(params: GasTankRefillParams): Promise<{ success: boolean; txHash?: string; message: string }> {
    await this.ensureInitialized();
    
    if (!this.config.features?.gasTank) {
      throw this.createError('GAS_TANK_EMPTY', 'Gas tank features not enabled');
    }
    
    console.log(`⛽ Refilling gas tank: ${params.amount} on ${params.chain}`);
    
    return await this.gasTank.refill(params);
  }

  /**
   * Get gas tank balance and usage statistics
   */
  async getGasTankInfo(socialId: string, chain?: SupportedChain): Promise<GasTankBalance[]> {
    await this.ensureInitialized();
    
    if (chain) {
      const balance = await this.gasTank.getGasTankBalance(socialId, chain);
      return balance ? [balance] : [];
    }
    
    // Get for all chains
    const chains = this.config.chains;
    const promises = chains.map(c => this.gasTank.getGasTankBalance(socialId, c));
    const results = await Promise.all(promises);
    
    return results.filter(Boolean) as GasTankBalance[];
  }

  /**
   * Get gas tank usage history
   */
  async getGasTankUsage(socialId: string, timeRange: string = '30d'): Promise<GasTankUsage[]> {
    await this.ensureInitialized();
    
    return await this.gasTank.getUsageHistory(socialId, timeRange);
  }

  // ============================================================================
  // DEFI METHODS
  // ============================================================================

  /**
   * Swap tokens on any supported chain
   * 
   * @example
   * ```typescript
   * // Swap on Ethereum
   * const swap = await sdk.swapTokens({
   *   fromToken: 'USDC',
   *   toToken: 'ETH',
   *   amount: '1000',
   *   chain: 'ethereum',
   *   socialId: 'user@email.com',
   *   slippage: 0.5,
   *   useGasTank: true
   * });
   * 
   * // Swap on Solana
   * const swap = await sdk.swapTokens({
   *   fromToken: 'USDC',
   *   toToken: 'SOL',
   *   amount: '100',
   *   chain: 'solana',
   *   socialId: 'user@email.com'
   * });
   * ```
   */
  async swapTokens(params: SwapParams): Promise<SwapResult> {
    await this.ensureInitialized();
    
    if (!this.config.features?.tokenSwaps) {
      throw this.createError('UNSUPPORTED_CHAIN', 'Token swap features not enabled');
    }
    
    console.log(`🔄 Swapping ${params.amount} ${params.fromToken} to ${params.toToken} on ${params.chain}`);
    
    return await this.defi.swapTokens(params);
  }

  /**
   * Get lending positions across all protocols
   */
  async getLendingPositions(socialId: string): Promise<LendingPosition[]> {
    await this.ensureInitialized();
    
    return await this.defi.getLendingPositions(socialId);
  }

  /**
   * Get yield farming positions
   */
  async getYieldPositions(socialId: string): Promise<YieldPosition[]> {
    await this.ensureInitialized();
    
    return await this.defi.getYieldPositions(socialId);
  }

  // ============================================================================
  // TOKEN METHODS
  // ============================================================================

  /**
   * Get supported tokens for a chain
   */
  async getSupportedTokens(chain: SupportedChain): Promise<TokenInfo[]> {
    await this.ensureInitialized();
    
    return await this.tokens.getSupportedTokens(chain);
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenAddress: string, chain: SupportedChain): Promise<TokenInfo | null> {
    await this.ensureInitialized();
    
    return await this.tokens.getTokenInfo(tokenAddress, chain);
  }

  /**
   * Get token balances for an address
   */
  async getTokenBalances(address: string, chain: SupportedChain): Promise<TokenBalance[]> {
    await this.ensureInitialized();
    
    return await this.tokens.getTokenBalances(address, chain);
  }

  // ============================================================================
  // ANALYTICS METHODS
  // ============================================================================

  /**
   * Get user analytics and insights
   */
  async getUserAnalytics(socialId: string, timeRange: string = '30d'): Promise<UserAnalytics> {
    await this.ensureInitialized();
    
    return await this.analytics.getUserAnalytics(socialId, timeRange);
  }

  /**
   * Get transaction history across all chains
   */
  async getTransactionHistory(
    socialId: string, 
    options?: {
      chain?: SupportedChain;
      pagination?: PaginationParams;
      filters?: FilterParams;
    }
  ): Promise<{ transactions: TransactionResult[]; totalCount: number; hasMore: boolean }> {
    await this.ensureInitialized();
    
    return await this.analytics.getTransactionHistory(socialId, options);
  }

  // ============================================================================
  // RECOVERY METHODS
  // ============================================================================

  /**
   * Recover wallet using social proof or guardians
   */
  async recoverWallet(params: RecoveryParams): Promise<WalletInfo> {
    await this.ensureInitialized();
    
    console.log(`🔍 Recovering wallet for: ${params.socialId}`);
    
    const recoveredWallet = await this.recovery.recoverWallet(params);
    
    console.log(`✅ Wallet recovered: ${Object.keys(recoveredWallet.addresses).length} chains`);
    return recoveredWallet;
  }

  /**
   * Setup social recovery guardians
   */
  async setupSocialRecovery(
    socialId: string, 
    guardians: string[], 
    threshold: number = 2
  ): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.config.features?.socialRecovery) {
      throw this.createError('UNAUTHORIZED', 'Social recovery not enabled');
    }
    
    await this.recovery.setupRecovery(socialId, { guardians, threshold });
    console.log(`🛡️ Social recovery setup for ${socialId} with ${guardians.length} guardians`);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get SDK configuration
   */
  getConfig(): NexusConfig {
    return { ...this.config };
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): SupportedChain[] {
    return [...this.config.chains];
  }

  /**
   * Check if bridge is available between chains
   */
  async isBridgeAvailable(fromChain: SupportedChain, toChain: SupportedChain): Promise<boolean> {
    if (!this.config.features?.crossChain) return false;
    return await this.bridge.isRouteAvailable(fromChain, toChain);
  }

  /**
   * Estimate bridge costs and time
   */
  async estimateBridge(params: Omit<BridgeParams, 'recipient'>): Promise<{
    fee: string;
    estimatedTime: number;
    available: boolean;
    route?: string;
  }> {
    await this.ensureInitialized();
    
    return await this.bridge.estimateBridge(params);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private validateConfig(config: NexusConfig): void {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    
    if (!config.chains || config.chains.length === 0) {
      throw new Error('At least one chain must be specified');
    }
    
    const validChains = [
      'ethereum', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanche',
      'bsc', 'fantom', 'gnosis', 'celo', 'moonbeam', 'aurora', 'solana'
    ];
    
    const invalidChains = config.chains.filter(chain => !validChains.includes(chain));
    if (invalidChains.length > 0) {
      throw new Error(`Unsupported chains: ${invalidChains.join(', ')}`);
    }
  }

  private async calculateTotalUsdValue(balances: Record<SupportedChain, TokenBalance[]>): Promise<string> {
    let total = 0;
    
    for (const chain of Object.keys(balances)) {
      const chainBalances = balances[chain as SupportedChain];
      for (const balance of chainBalances) {
        if (balance.usdValue) {
          total += parseFloat(balance.usdValue);
        }
      }
    }
    
    return total.toFixed(2);
  }

  private async getAddressFromSocialId(socialId: string, chain: SupportedChain): Promise<string> {
    const wallet = await this.getWallet(socialId, false);
    if (!wallet || !wallet.addresses[chain]) {
      throw this.createError('INVALID_ADDRESS', `No address found for ${socialId} on ${chain}`);
    }
    return wallet.addresses[chain];
  }

  private createError(code: ErrorCode, message: string, details?: any): NexusError {
    return {
      code,
      message,
      details,
      recoverable: code !== 'UNAUTHORIZED'
    };
  }
} 