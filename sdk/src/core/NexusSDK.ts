/**
 * NexusSDK - Main SDK class
 * 
 * The ThirdWeb alternative with SVM-EVM integration
 * Provides unified interface for companies to build on both ecosystems
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
  SupportedChain,
  EVMChain,
  SVMChain 
} from '../types';

import { EVMWalletManager } from '../evm/EVMWalletManager';
import { SVMWalletManager } from '../svm/SVMWalletManager'; 
import { CrossChainBridge } from '../bridge/CrossChainBridge';
import { SocialRecovery } from '../recovery/SocialRecovery';

export class NexusSDK {
  private config: NexusConfig;
  private evmManager: EVMWalletManager;
  private svmManager: SVMWalletManager;
  private bridge: CrossChainBridge;
  private recovery: SocialRecovery;

  constructor(config: NexusConfig) {
    this.config = config;
    
    // Initialize managers
    this.evmManager = new EVMWalletManager(config);
    this.svmManager = new SVMWalletManager(config);
    this.bridge = new CrossChainBridge(config, this.evmManager, this.svmManager);
    this.recovery = new SocialRecovery(config);
  }

  /**
   * Create a new wallet linked to social identity
   * Works across all specified chains (EVM + SVM)
   * 
   * @example
   * ```typescript
   * const wallet = await sdk.createWallet({
   *   socialId: 'user@company.com',
   *   socialType: 'email',
   *   chains: ['ethereum', 'polygon', 'solana']
   * });
   * ```
   */
  async createWallet(params: CreateWalletParams): Promise<WalletInfo> {
    const { socialId, socialType, chains } = params;
    
    console.log(`🔐 Creating wallet for ${socialType}: ${socialId}`);
    
    const addresses: Record<SupportedChain, string> = {} as any;
    
    // Create EVM wallets (same address across EVM chains)
    const evmChains = chains.filter(chain => chain !== 'solana') as EVMChain[];
    if (evmChains.length > 0) {
      const evmAddress = await this.evmManager.createWallet(socialId, evmChains);
      evmChains.forEach(chain => {
        addresses[chain] = evmAddress;
      });
    }
    
    // Create SVM wallet (Solana)
    const svmChains = chains.filter(chain => chain === 'solana') as SVMChain[];
    if (svmChains.length > 0) {
      const svmAddress = await this.svmManager.createWallet(socialId);
      addresses['solana'] = svmAddress;
    }
    
    const walletInfo: WalletInfo = {
      socialId,
      socialType,
      addresses,
      createdAt: new Date().toISOString(),
      recoverySetup: false,
      isActive: true,
      crossChainEnabled: this.config.features?.crossChain ?? false,
      metadata: params.metadata
    };
    
    // Setup recovery if requested
    if (params.recoveryOptions && this.config.features?.socialRecovery) {
      await this.recovery.setupRecovery(socialId, params.recoveryOptions);
      walletInfo.recoverySetup = true;
    }
    
    console.log(`✅ Wallet created across ${chains.length} chains`);
    return walletInfo;
  }

  /**
   * Recover wallet using social identity
   * 
   * @example
   * ```typescript
   * const wallet = await sdk.recoverWallet({
   *   socialId: 'user@company.com',
   *   socialType: 'email',
   *   recoveryMethod: 'social',
   *   proof: { socialProof: verificationCode }
   * });
   * ```
   */
  async recoverWallet(params: RecoveryParams): Promise<WalletInfo> {
    console.log(`🔍 Recovering wallet for: ${params.socialId}`);
    
    const recoveredWallet = await this.recovery.recoverWallet(params);
    
    console.log(`✅ Wallet recovered: ${Object.keys(recoveredWallet.addresses).length} chains`);
    return recoveredWallet;
  }

  /**
   * Execute transaction on any supported chain
   * 
   * @example
   * ```typescript
   * // Send on Ethereum
   * const tx = await sdk.sendTransaction({
   *   from: { chain: 'ethereum', socialId: 'sender@email.com' },
   *   to: { chain: 'ethereum', address: '0x...' },
   *   amount: '1.0'
   * });
   * 
   * // Send on Solana
   * const tx = await sdk.sendTransaction({
   *   from: { chain: 'solana', socialId: 'sender@email.com' },
   *   to: { chain: 'solana', address: 'ABC...' },
   *   amount: '1.0'
   * });
   * ```
   */
  async sendTransaction(params: TransactionParams): Promise<TransactionResult> {
    const { from, to } = params;
    
    if (from.chain === 'solana') {
      return await this.svmManager.sendTransaction(params);
    } else {
      return await this.evmManager.sendTransaction(params);
    }
  }

  /**
   * Bridge assets between EVM and SVM chains
   * This is the UNIQUE feature that sets you apart from ThirdWeb
   * 
   * @example
   * ```typescript
   * // Bridge from Solana to Ethereum (fast tx -> deep liquidity)
   * const bridge = await sdk.bridgeAssets({
   *   fromChain: 'solana',
   *   toChain: 'ethereum', 
   *   amount: '100',
   *   asset: 'USDC',
   *   recipient: '0x...'
   * });
   * 
   * // Bridge from Ethereum to Solana (expensive -> cheap)
   * const bridge = await sdk.bridgeAssets({
   *   fromChain: 'ethereum',
   *   toChain: 'solana',
   *   amount: '1000', 
   *   asset: 'USDC',
   *   recipient: 'ABC...'
   * });
   * ```
   */
  async bridgeAssets(params: BridgeParams): Promise<BridgeResult> {
    console.log(`🌉 Bridging ${params.amount} ${params.asset} from ${params.fromChain} to ${params.toChain}`);
    
    if (!this.config.features?.crossChain) {
      throw new Error('Cross-chain features not enabled');
    }
    
    const bridgeResult = await this.bridge.bridgeAssets(params);
    
    console.log(`✅ Bridge initiated: ${bridgeResult.bridgeId}`);
    return bridgeResult;
  }

  /**
   * Get wallet information by social ID
   * 
   * @example
   * ```typescript
   * const wallet = await sdk.getWallet('user@email.com');
   * console.log(wallet.addresses.ethereum); // 0x...
   * console.log(wallet.addresses.solana);   // ABC...
   * ```
   */
  async getWallet(socialId: string): Promise<WalletInfo | null> {
    try {
      return await this.recovery.getWalletBySocialId(socialId);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get transaction history for a wallet
   */
  async getTransactionHistory(socialId: string, chain?: SupportedChain): Promise<TransactionResult[]> {
    const wallet = await this.getWallet(socialId);
    if (!wallet) {
      throw new Error(`Wallet not found for social ID: ${socialId}`);
    }

    const transactions: TransactionResult[] = [];
    
    if (chain) {
      // Get history for specific chain
      if (chain === 'solana') {
        transactions.push(...await this.svmManager.getTransactionHistory(wallet.addresses[chain]));
      } else {
        transactions.push(...await this.evmManager.getTransactionHistory(wallet.addresses[chain], chain as EVMChain));
      }
    } else {
      // Get history for all chains
      for (const [chainName, address] of Object.entries(wallet.addresses)) {
        try {
          if (chainName === 'solana') {
            transactions.push(...await this.svmManager.getTransactionHistory(address));
          } else {
            transactions.push(...await this.evmManager.getTransactionHistory(address, chainName as EVMChain));
          }
        } catch (error) {
          console.warn(`Failed to get transactions for ${chainName}:`, error);
        }
      }
    }
    
    return transactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get platform analytics (for company dashboards)
   * Similar to ThirdWeb's analytics
   */
  async getAnalytics(timeRange: string = '30d'): Promise<AnalyticsData> {
    // This would integrate with your backend API
    const response = await fetch(`${this.config.endpoints?.api}/analytics`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return await response.json();
  }

  /**
   * Check if cross-chain bridge is available
   */
  async isBridgeAvailable(fromChain: SupportedChain, toChain: SupportedChain): Promise<boolean> {
    return this.bridge.isRouteSupported(fromChain, toChain);
  }

  /**
   * Estimate bridge fees and time
   */
  async estimateBridge(params: Omit<BridgeParams, 'recipient'>): Promise<{
    fee: string;
    estimatedTime: number;
    available: boolean;
  }> {
    return await this.bridge.estimateBridge(params);
  }

  /**
   * Setup social recovery for existing wallet
   */
  async setupSocialRecovery(socialId: string, guardians: string[], threshold: number = 2): Promise<void> {
    if (!this.config.features?.socialRecovery) {
      throw new Error('Social recovery not enabled');
    }
    
    await this.recovery.setupRecovery(socialId, { guardians, threshold });
  }

  /**
   * Enable/disable gasless transactions for a wallet
   */
  async setGaslessEnabled(socialId: string, enabled: boolean): Promise<void> {
    if (!this.config.features?.gaslessTransactions) {
      throw new Error('Gasless transactions not enabled');
    }
    
    const wallet = await this.getWallet(socialId);
    if (!wallet) {
      throw new Error(`Wallet not found: ${socialId}`);
    }
    
    // Update paymaster policies for EVM chains
    for (const chain of Object.keys(wallet.addresses)) {
      if (chain !== 'solana') {
        await this.evmManager.setGaslessEnabled(wallet.addresses[chain as EVMChain], enabled);
      }
    }
    
    // Update for Solana
    if (wallet.addresses.solana) {
      await this.svmManager.setGaslessEnabled(wallet.addresses.solana, enabled);
    }
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): SupportedChain[] {
    return this.config.chains;
  }

  /**
   * Get SDK configuration
   */
  getConfig(): NexusConfig {
    return { ...this.config };
  }
} 