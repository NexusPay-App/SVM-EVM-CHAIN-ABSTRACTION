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
    
    try {
      // Use the new deployment flow that creates and deploys in one step
      const response = await fetch(`${this.config.endpoints.api}/api/wallets/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          socialId,
          socialType,
          chains
        })
      });
      
      if (!response.ok) {
        throw new Error(`Wallet creation failed: ${response.status}`);
      }
      
      const deploymentResult = await response.json();
      
      // Format the response to match our WalletInfo structure
      const walletInfo: WalletInfo = {
        socialId,
        socialType,
        addresses: deploymentResult.addresses,
        balances: this.formatBalances(deploymentResult.addresses),
        gasTank: {
          enabled: gasTankConfig?.enabled || false,
          balances: this.initializeGasTankBalances(chains)
        },
        crossChainEnabled: true,
        createdAt: deploymentResult.timestamp || new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        deploymentStatus: {
          evm: deploymentResult.deployments?.evm || { isDeployed: false },
          svm: deploymentResult.deployments?.solana || { isDeployed: false }
        },
        isNew: deploymentResult.isNew || false
      };
      
      console.log('✅ Wallet created successfully');
      console.log(`📍 Unified EVM Address: ${deploymentResult.addresses.ethereum}`);
      console.log(`📍 Solana Address: ${deploymentResult.addresses.solana}`);
      
      return walletInfo;
      
    } catch (error) {
      console.error('❌ Wallet creation failed:', error);
      throw this.createError('WALLET_CREATION_FAILED', `Failed to create wallet: ${(error as Error).message}`);
    }
  }

  /**
   * Get private key for a wallet (tracked and logged)
   * 
   * @example
   * ```typescript
   * const keyData = await sdk.getPrivateKey({
   *   socialId: 'user@company.com',
   *   socialType: 'email',
   *   reason: 'Transaction signing',
   *   companyId: 'playearn-xyz'
   * });
   * ```
   */
  async getPrivateKey(params: {
    socialId: string;
    socialType?: string;
    reason: string;
    companyId?: string;
  }): Promise<{
    privateKey: string;
    address: string;
    trackingId: string;
    warning: string;
  }> {
    await this.ensureInitialized();
    
    const { socialId, socialType = 'email', reason, companyId } = params;
    
    try {
      const response = await fetch(`${this.config.endpoints.api}/api/wallets/${encodeURIComponent(socialId)}/private-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          socialType,
          reason,
          companyId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Private key request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log(`🔐 Private key retrieved for ${socialId} (tracked: ${result.trackingId})`);
      
      return {
        privateKey: result.privateKey,
        address: result.address,
        trackingId: result.trackingId,
        warning: result.warning
      };
      
    } catch (error) {
      console.error('❌ Private key request failed:', error);
      throw this.createError('PRIVATE_KEY_REQUEST_FAILED', `Failed to get private key: ${(error as Error).message}`);
    }
  }

  /**
   * Fund company gas tank for sponsored transactions
   * 
   * @example
   * ```typescript
   * const funding = await sdk.fundGasTank({
   *   companyId: 'playearn-xyz',
   *   amount: '10.0',
   *   chain: 'ethereum',
   *   paymentMethod: 'stripe'
   * });
   * ```
   */
  async fundGasTank(params: {
    companyId: string;
    amount: string;
    chain: SupportedChain;
    paymentMethod?: string;
  }): Promise<{
    success: boolean;
    fundingId: string;
    balance: string;
    txHash: string;
  }> {
    await this.ensureInitialized();
    
    const { companyId, amount, chain, paymentMethod = 'crypto' } = params;
    
    try {
      const response = await fetch(`${this.config.endpoints.api}/api/companies/${companyId}/gas-tank/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          amount,
          chain,
          paymentMethod
        })
      });
      
      if (!response.ok) {
        throw new Error(`Gas tank funding failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log(`💰 Gas tank funded: ${amount} ${chain.toUpperCase()} for ${companyId}`);
      
      return {
        success: result.success,
        fundingId: result.funding.fundingId,
        balance: result.gasTank.balance,
        txHash: result.funding.txHash
      };
      
    } catch (error) {
      console.error('❌ Gas tank funding failed:', error);
      throw this.createError('GAS_TANK_FUNDING_FAILED', `Failed to fund gas tank: ${(error as Error).message}`);
    }
  }

  /**
   * Get company gas tank status across all chains
   * 
   * @example
   * ```typescript
   * const gasTanks = await sdk.getGasTankStatus('playearn-xyz');
   * ```
   */
  async getGasTankStatus(companyId: string): Promise<{
    companyId: string;
    gasTanks: Record<SupportedChain, any>;
    totalValueUsd: string;
  }> {
    await this.ensureInitialized();
    
    try {
      const response = await fetch(`${this.config.endpoints.api}/api/companies/${companyId}/gas-tank`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Gas tank status request failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      return result;
      
    } catch (error) {
      console.error('❌ Gas tank status request failed:', error);
      throw this.createError('GAS_TANK_STATUS_FAILED', `Failed to get gas tank status: ${(error as Error).message}`);
    }
  }

  /**
   * Pay transaction fees for users (sponsored transactions)
   * 
   * @example
   * ```typescript
   * const payment = await sdk.payUserFees({
   *   companyId: 'playearn-xyz',
   *   userSocialId: 'gamer123@email.com',
   *   chain: 'ethereum',
   *   txHash: '0x...',
   *   amount: '0.005'
   * });
   * ```
   */
  async payUserFees(params: {
    companyId: string;
    userSocialId: string;
    socialType?: string;
    chain: SupportedChain;
    txHash: string;
    amount: string;
  }): Promise<{
    success: boolean;
    paymentId: string;
    remainingBalance: string;
  }> {
    await this.ensureInitialized();
    
    const { companyId, userSocialId, socialType = 'email', chain, txHash, amount } = params;
    
    try {
      const response = await fetch(`${this.config.endpoints.api}/api/companies/${companyId}/pay-fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify({
          userSocialId,
          socialType,
          chain,
          txHash,
          amount
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Fee payment failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log(`💸 Paid fees for user ${userSocialId}: ${amount} ${chain.toUpperCase()}`);
      
      return {
        success: result.success,
        paymentId: result.feePayment.paymentId,
        remainingBalance: result.remainingBalance
      };
      
    } catch (error) {
      console.error('❌ Fee payment failed:', error);
      throw this.createError('FEE_PAYMENT_FAILED', `Failed to pay user fees: ${(error as Error).message}`);
    }
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

  // Helper methods
  private formatBalances(addresses: Record<SupportedChain, string>): Record<SupportedChain, TokenBalance[]> {
    const balances: Record<SupportedChain, TokenBalance[]> = {} as any;
    
    Object.keys(addresses).forEach(chain => {
      balances[chain as SupportedChain] = [
        {
          symbol: chain === 'solana' ? 'SOL' : 'ETH',
          balance: '0',
          usdValue: '0',
          address: 'native'
        }
      ];
    });
    
    return balances;
  }

  private initializeGasTankBalances(chains: SupportedChain[]): GasTankBalance {
    const balances: Record<SupportedChain, string> = {} as any;
    
    chains.forEach(chain => {
      balances[chain] = '0';
    });
    
    return {
      totalBalance: '0',
      chainBalances: balances,
      lastRefill: new Date().toISOString(),
      autoRefill: false
    };
  }
} 