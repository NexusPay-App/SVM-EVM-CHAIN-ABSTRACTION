/**
 * @nexusplatform/sdk
 * 
 * Unified SDK for EVM + SVM wallet infrastructure
 * The ThirdWeb alternative with Solana integration
 * 
 * @example
 * ```typescript
 * import { NexusSDK } from '@nexusplatform/sdk';
 * 
 * const sdk = new NexusSDK({
 *   apiKey: 'your-api-key',
 *   chains: ['ethereum', 'polygon', 'solana']
 * });
 * 
 * // Create cross-chain wallet
 * const wallet = await sdk.createWallet({
 *   socialId: 'user@email.com',
 *   chains: ['ethereum', 'solana']
 * });
 * ```
 */

// Core SDK
export { NexusSDK } from './core/NexusSDK';
export { NexusConfig, CreateWalletParams, WalletInfo, TransactionResult } from './core/types';

// EVM specific exports
export { EVMWalletManager } from './evm/EVMWalletManager';
export { EVMBridge } from './evm/EVMBridge';

// SVM specific exports  
export { SVMWalletManager } from './svm/SVMWalletManager';
export { SVMBridge } from './svm/SVMBridge';

// Cross-chain utilities
export { CrossChainBridge } from './bridge/CrossChainBridge';
export { SocialRecovery } from './recovery/SocialRecovery';

// Utilities
export { utils } from './utils';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0'; 