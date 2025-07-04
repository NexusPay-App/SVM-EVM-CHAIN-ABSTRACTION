/**
 * NexusSDK - Ultimate Cross-Chain Wallet Infrastructure
 * SIMPLE & POWERFUL: Initialize with just projectName + apiKey
 */

import { 
  NexusConfig, 
  NexusError,
  APIResponse,
  Wallet,
  CreateWalletRequest,
  TransactionRequest,
  TransactionResult,
  GasEstimate,
  PaymasterBalance,
  PaymasterAddresses,
  PaymasterTransaction,
  AnalyticsOverview,
  UserAnalytics,
  CostAnalytics,
  WalletBalances,
  Token,
  TokenTransferRequest,
  BridgeRequest,
  BridgeResult,
  BridgeStatus,
  SwapRequest,
  SwapResult,
  SupportedChain,
} from '../types/index.js';

/**
 * Ultra-Simple SDK Configuration
 * Only 2 required parameters: projectName + apiKey
 */
export interface SimpleNexusConfig {
  projectName: string;           // Your project name from dashboard
  apiKey: string;               // Your API key from dashboard
  baseURL?: string;             // Optional: custom backend URL
  timeout?: number;             // Optional: request timeout (default: 30s)
  enableBridging?: boolean;     // Optional: enable cross-chain bridging (default: true)
  enableGasless?: boolean;      // Optional: enable gasless transactions (default: true)
}

export class NexusSDK {
  private config: SimpleNexusConfig;
  private projectId: string;
  private baseURL: string;
  private defaultTimeout: number;
  private initialized: boolean = false;

  constructor(config: SimpleNexusConfig) {
    // Validate required parameters
    if (!config.projectName || !config.apiKey) {
      throw new Error('❌ NexusSDK requires projectName and apiKey. Get them from your dashboard.');
    }

    this.config = {
      enableBridging: true,
      enableGasless: true,
      ...config,
    };

    // Auto-extract project ID from API key
    this.projectId = this.extractProjectId(config.apiKey);
    this.baseURL = config.baseURL || 'https://backend-amber-zeta-94.vercel.app';
    this.defaultTimeout = config.timeout || 30000;

    console.log('🚀 NexusSDK initialized');
    console.log(`📁 Project: ${config.projectName}`);
    console.log(`🔑 Project ID: ${this.projectId}`);
    console.log(`💳 Gasless: ${this.config.enableGasless ? 'Enabled' : 'Disabled'}`);
    console.log(`🌉 Bridging: ${this.config.enableBridging ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Auto-extract project ID from API key with enhanced validation
   */
  private extractProjectId(apiKey: string): string {
    if (!apiKey.startsWith('npay_proj_')) {
      throw new Error('❌ Invalid API key format. Must start with "npay_proj_"');
    }

    // Format: npay_proj_[project_id]_[key_id]_[type]_[hash]
    const parts = apiKey.split('_');
    if (parts.length < 6) {
      throw new Error('❌ Invalid API key format. Key appears to be truncated or corrupted.');
    }

    // Extract project ID (everything between proj_ and the last 3 parts)
    const projectIdParts = parts.slice(2, -3);
    const projectId = projectIdParts.join('_');

    if (!projectId) {
      throw new Error('❌ Unable to extract project ID from API key.');
    }

    return projectId;
  }

  /**
   * Enhanced API request with bulletproof error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout?: number
  ): Promise<APIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || this.defaultTimeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Enhanced error handling with suggestions
        const error = {
          code: errorData.error?.code || 'API_ERROR',
          message: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          retryable: response.status >= 500 || response.status === 429,
          suggestions: errorData.error?.suggestions || [],
          details: errorData.error?.details || undefined,
        };

        // Add SDK-specific error suggestions
        if (error.code === 'PROJECT_NAME_MISMATCH') {
          error.suggestions = [
            `Your API key belongs to a different project than "${this.config.projectName}"`,
            'Check your project name in the dashboard',
            'Verify you\'re using the correct API key for this project',
            'Make sure project name matches exactly (case-sensitive)'
          ];
        }

        return { success: false, error };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      return {
        success: false,
        error: {
          code: isAbortError ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: isAbortError ? 'Request timed out' : 'Network request failed',
          details: error instanceof Error ? error.message : String(error),
          retryable: true,
          suggestions: isAbortError ? 
            ['Increase timeout in SDK config', 'Check your internet connection'] :
            ['Check your internet connection', 'Verify the backend URL is correct']
        },
      };
    }
  }

  /**
   * Validate project name against API key (called automatically)
   */
  private async validateProjectConnection(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await this.makeRequest<{ projectName: string; projectId: string }>(
        `/v1/projects/validate`,
        {
          method: 'POST',
          body: JSON.stringify({ 
            projectName: this.config.projectName,
            projectId: this.projectId 
          }),
        }
      );

      if (!response.success) {
        throw new Error(`❌ Project validation failed: ${response.error?.message}`);
      }

      this.initialized = true;
      console.log('✅ Project validation successful');
    } catch (error) {
      console.error('❌ Project validation failed:', error);
      throw error;
    }
  }

  // ==================== WALLET OPERATIONS ====================

  /**
   * Create wallet with just socialId and socialType
   * Everything else is auto-configured
   */
  async createWallet(data: {
    socialId: string;
    socialType: string;
    chains?: SupportedChain[];
    enableGasless?: boolean;
  }): Promise<Wallet> {
    await this.validateProjectConnection();

    const response = await this.makeRequest<Wallet>('/v1/wallets/create', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        projectName: this.config.projectName,
        enableGasless: data.enableGasless !== false,
        chains: data.chains || ['ethereum', 'arbitrum', 'solana'], // Default to all chains
      }),
    });

    if (!response.success) {
      throw new Error(`❌ Failed to create wallet: ${response.error?.message}`);
    }

    console.log('✅ Wallet created successfully');
    return response.data!;
  }

  /**
   * Get wallet by social ID (simplified)
   */
  async getWallet(socialId: string, socialType: string): Promise<Wallet> {
    await this.validateProjectConnection();

    const response = await this.makeRequest<Wallet>(
      `/v1/wallets/social?socialId=${encodeURIComponent(socialId)}&socialType=${encodeURIComponent(socialType)}&projectName=${encodeURIComponent(this.config.projectName)}`
    );

    if (!response.success) {
      throw new Error(`❌ Failed to get wallet: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * Get wallet balances across all chains
   */
  async getWalletBalances(socialId: string, socialType: string): Promise<WalletBalances> {
    const wallet = await this.getWallet(socialId, socialType);
    
    const response = await this.makeRequest<WalletBalances>(`/v1/wallets/${wallet.id}/balances`);

    if (!response.success) {
      throw new Error(`❌ Failed to get wallet balances: ${response.error?.message}`);
    }

    return response.data!;
  }

  // ==================== TRANSACTION OPERATIONS ====================

  /**
   * Execute gasless transaction (simplified)
   */
  async sendTransaction(data: {
    socialId: string;
    socialType: string;
    chain: SupportedChain;
    to: string;
    value?: string;
    data?: string;
    usePaymaster?: boolean;
  }): Promise<TransactionResult> {
    await this.validateProjectConnection();

    const wallet = await this.getWallet(data.socialId, data.socialType);
    const userWalletAddress = wallet.addresses[data.chain];

    if (!userWalletAddress) {
      throw new Error(`❌ Wallet not deployed on ${data.chain}`);
    }

    const response = await this.makeRequest<TransactionResult>(
      `/v1/projects/${this.projectId}/transactions/execute`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectName: this.config.projectName,
          chain: data.chain,
          userWalletAddress,
          transaction: {
            to: data.to,
            value: data.value || '0',
            data: data.data || undefined,
          },
          usePaymaster: data.usePaymaster !== false, // Default to gasless
        }),
      }
    );

    if (!response.success) {
      throw new Error(`❌ Transaction failed: ${response.error?.message}`);
    }

    console.log('✅ Transaction sent successfully');
    return response.data!;
  }

  /**
   * Transfer tokens (simplified)
   */
  async transferTokens(data: {
    socialId: string;
    socialType: string;
    chain: SupportedChain;
    to: string;
    amount: string;
    token?: string; // 'native' or token address
    usePaymaster?: boolean;
  }): Promise<TransactionResult> {
    const token = data.token || 'native';
    
    // For native tokens, send directly
    if (token === 'native') {
      return this.sendTransaction({
        socialId: data.socialId,
        socialType: data.socialType,
        chain: data.chain,
        to: data.to,
        value: data.amount,
        usePaymaster: data.usePaymaster,
      });
    }

    // For ERC-20 tokens, encode transfer
    const transferData = this.encodeTokenTransfer(data.to, data.amount);
    return this.sendTransaction({
      socialId: data.socialId,
      socialType: data.socialType,
      chain: data.chain,
      to: token,
      value: '0',
      data: transferData,
      usePaymaster: data.usePaymaster,
    });
  }

  // ==================== CROSS-CHAIN OPERATIONS ====================

  /**
   * Bridge tokens across chains (simplified)
   */
  async bridgeTokens(data: {
    socialId: string;
    socialType: string;
    fromChain: SupportedChain;
    toChain: SupportedChain;
    amount: string;
    token?: string;
  }): Promise<BridgeResult> {
    if (!this.config.enableBridging) {
      throw new Error('❌ Bridging is disabled for this SDK instance');
    }

    await this.validateProjectConnection();

    const response = await this.makeRequest<BridgeResult>(
      `/v1/projects/${this.projectId}/bridge`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectName: this.config.projectName,
          ...data,
        }),
      }
    );

    if (!response.success) {
      throw new Error(`❌ Bridge failed: ${response.error?.message}`);
    }

    console.log('✅ Bridge transaction initiated');
    return response.data!;
  }

  // ==================== ANALYTICS & MONITORING ====================

  /**
   * Get project analytics
   */
  async getAnalytics(days: number = 30): Promise<AnalyticsOverview> {
    await this.validateProjectConnection();

    const response = await this.makeRequest<AnalyticsOverview>(
      `/v1/projects/${this.projectId}/analytics?days=${days}&projectName=${encodeURIComponent(this.config.projectName)}`
    );

    if (!response.success) {
      throw new Error(`❌ Failed to get analytics: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * Get paymaster balances
   */
  async getPaymasterBalances(): Promise<PaymasterBalance[]> {
    await this.validateProjectConnection();

    const response = await this.makeRequest<PaymasterBalance[]>(
      `/v1/projects/${this.projectId}/paymaster/balances?projectName=${encodeURIComponent(this.config.projectName)}`
    );

    if (!response.success) {
      throw new Error(`❌ Failed to get paymaster balances: ${response.error?.message}`);
    }

    return response.data!;
  }

  /**
   * Health check for all systems
   */
  async healthCheck(): Promise<{ status: string; projectName: string; chains: string[] }> {
    const response = await this.makeRequest<{ status: string; projectName: string; chains: string[] }>(
      `/v1/health?projectName=${encodeURIComponent(this.config.projectName)}`
    );

    if (!response.success) {
      throw new Error(`❌ Health check failed: ${response.error?.message}`);
    }

    return response.data!;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Encode ERC-20 token transfer
   */
  private encodeTokenTransfer(to: string, amount: string): string {
    // ERC-20 transfer function signature: transfer(address,uint256)
    const methodId = '0xa9059cbb';
    const paddedTo = to.replace('0x', '').padStart(64, '0');
    const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');
    return `${methodId}${paddedTo}${paddedAmount}`;
  }

  // ==================== DEVELOPER UTILITIES ====================

  /**
   * Get project configuration
   */
  getProjectInfo(): { projectName: string; projectId: string; chains: string[] } {
    return {
      projectName: this.config.projectName,
      projectId: this.projectId,
      chains: ['ethereum', 'arbitrum', 'solana'], // Will be dynamic in future
    };
  }

  /**
   * Check if gasless transactions are enabled
   */
  isGaslessEnabled(): boolean {
    return this.config.enableGasless !== false;
  }

  /**
   * Check if bridging is enabled
   */
  isBridgingEnabled(): boolean {
    return this.config.enableBridging !== false;
  }

  /**
   * Get SDK version and configuration
   */
  getSDKInfo(): { version: string; config: SimpleNexusConfig } {
    return {
      version: '1.2.0',
      config: this.config,
    };
  }
} 