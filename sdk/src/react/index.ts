/**
 * NexusSDK React Components
 * 
 * Easy-to-use React components for Next.js applications
 * The ThirdWeb alternative with Solana integration
 */

// Provider and Hooks
export { NexusProvider } from './providers/NexusProvider';
export { useNexus } from './hooks/useNexus';
export { useWallet } from './hooks/useWallet';
export { useGasTank } from './hooks/useGasTank';
export { useTokens } from './hooks/useTokens';
export { useTransactions } from './hooks/useTransactions';

// UI Components
export { WalletConnect } from './components/WalletConnect';
export { PaymentButton } from './components/PaymentButton';
export { GasTankWidget } from './components/GasTankWidget';
export { BridgeWidget } from './components/BridgeWidget';
export { SwapWidget } from './components/SwapWidget';
export { TokenBalance } from './components/TokenBalance';
export { TransactionHistory } from './components/TransactionHistory';
export { WalletDashboard } from './components/WalletDashboard';

// Advanced Components
export { DeFiPortfolio } from './components/DeFiPortfolio';
export { CrossChainBridge } from './components/CrossChainBridge';
export { SocialRecovery } from './components/SocialRecovery';
export { AnalyticsDashboard } from './components/AnalyticsDashboard';

// Utility Components
export { ChainSelector } from './components/ChainSelector';
export { TokenSelector } from './components/TokenSelector';
export { LoadingSpinner } from './components/LoadingSpinner';
export { ErrorBoundary } from './components/ErrorBoundary';

// Types
export type {
  NexusProviderProps,
  WalletConnectProps,
  PaymentButtonProps,
  GasTankWidgetProps,
  BridgeWidgetProps,
  SwapWidgetProps
} from '../types'; 