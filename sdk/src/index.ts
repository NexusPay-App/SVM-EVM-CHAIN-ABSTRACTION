/**
 * NexusSDK - Ultimate Cross-Chain Wallet Infrastructure
 * 
 * The most flexible and powerful cross-chain wallet SDK:
 * - Support for ANY social identifier (not just hardcoded types)
 * - Universal gasless transactions across EVM and SVM
 * - Cross-chain bridging and token swapping
 * - Multi-token support with comprehensive analytics
 * - Unbeatable developer experience
 * 
 * @example Basic Usage
 * ```typescript
 * import { NexusSDK } from '@nexusplatform/sdk';
 * 
 * const sdk = new NexusSDK({
 *   apiKey: 'npay_proj_your_project_id_random_string',
 *   enableBridging: true,
 *   enableGasless: true,
 * });
 * 
 * // Create wallet with ANY social identifier
 * const wallet = await sdk.createWallet({
 *   socialId: 'any_identifier_you_want',
 *   socialType: 'any_type_you_want', // Complete flexibility!
 *   chains: ['ethereum', 'arbitrum', 'solana'],
 *   enableGasless: true,
 * });
 * 
 * // Gasless cross-chain bridge
 * await sdk.bridgeTokens({
 *   fromChain: 'ethereum',
 *   toChain: 'arbitrum',
 *   token: 'native',
 *   amount: '1000000000000000000',
 *   fromAddress: wallet.addresses.ethereum,
 *   toAddress: wallet.addresses.arbitrum,
 *   usePaymaster: true, // Gasless!
 * });
 * ```
 * 
 * @example React Usage
 * ```tsx
 * import { NexusProvider, WalletConnect, useNexus } from '@nexusplatform/sdk/react';
 * 
 * function App() {
 *   return (
 *     <NexusProvider config={{ apiKey: 'your_api_key' }}>
 *       <WalletConnect
 *         chains={['ethereum', 'arbitrum', 'solana']}
 *         allowedSocialTypes={['email', 'twitter', 'gameId', 'customType']}
 *         customSocialTypes={[
 *           { type: 'nftHolder', label: 'NFT Holder', placeholder: 'Enter NFT collection' }
 *         ]}
 *       />
 *     </NexusProvider>
 *   );
 * }
 * ```
 */

// Core SDK exports
export { NexusSDK } from './core/NexusSDK.js';
export { NexusSDK as NexusSDKDefault } from './core/NexusSDK.js';

// Type exports
export * from './types/index.js';

// React exports
export { NexusProvider, NexusContext } from './react/providers/NexusProvider.js';
export { WalletConnect } from './react/components/WalletConnect.js';
export { useNexus } from './react/hooks/useNexus.js';
export * from './react/index.js';

// Default export for convenience
export { NexusSDK as default } from './core/NexusSDK.js';

// Version
export const VERSION = '2.0.0';
export const SDK_NAME = 'NexusSDK';

/**
 * Get SDK information
 */
export function getSDKInfo() {
  return {
    name: SDK_NAME,
    version: VERSION,
    description: 'Clean, Fast, and Secure Cross-Chain Wallet SDK',
    supportedChains: ['ethereum', 'arbitrum', 'solana'],
    features: [
      'Cross-chain Wallet Infrastructure',
      'Social Login Integration', 
      'Gasless Transactions (Paymaster)',
      'Real-time Analytics',
      'Project-based Architecture',
      'TypeScript Support'
    ],
    backend: 'https://backend-amber-zeta-94.vercel.app'
  };
} 