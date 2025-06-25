/**
 * NexusSDK React Components
 * 
 * Easy-to-use React components for Next.js applications
 * The ThirdWeb alternative with Solana integration
 */

// React components and hooks
export { NexusProvider } from './providers/NexusProvider';
export { useNexus } from './hooks/useNexus';
export { WalletConnect } from './components/WalletConnect';

// Types
export type {
  NexusConfig,
  WalletInfo,
  SupportedChain,
  SocialIdType
} from '../types'; 