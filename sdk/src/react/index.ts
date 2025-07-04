/**
 * NexusSDK React Components & Hooks
 * 
 * Ultimate flexible React integration for cross-chain wallet infrastructure
 * 
 * @example
 * ```tsx
 * import { NexusProvider, WalletConnect, useNexus } from '@nexusplatform/sdk/react';
 * 
 * function App() {
 *   return (
 *     <NexusProvider config={{ 
 *       apiKey: 'your_api_key',
 *       enableBridging: true,
 *       enableGasless: true 
 *     }}>
 *       <MyWalletApp />
 *     </NexusProvider>
 *   );
 * }
 * 
 * function MyWalletApp() {
 *   const { createWallet, bridgeTokens, swapTokens } = useNexus();
 *   
 *   return (
 *     <div>
 *       <WalletConnect
 *         chains={['ethereum', 'arbitrum', 'solana']}
 *         allowedSocialTypes={['email', 'twitter', 'gameId', 'nftHolder']}
 *         customSocialTypes={[
 *           { type: 'nftHolder', label: 'NFT Holder', placeholder: 'Enter collection' }
 *         ]}
 *         theme="auto"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */

// Provider and Context
export { NexusProvider, NexusContext } from './providers/NexusProvider.js';
export type { NexusProviderProps, UseNexusReturn } from './providers/NexusProvider.js';

// Components
export { WalletConnect } from './components/WalletConnect.js';

// Hooks
export { useNexus } from './hooks/useNexus.js';

// Re-export types for convenience
export type { 
  WalletConnectProps
} from '../types/index.js'; 