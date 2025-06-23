/**
 * WalletConnect Component
 * 
 * Main wallet connection component with social login support
 * The ThirdWeb alternative with cross-chain support
 */

import React, { useState } from 'react';
import { WalletConnectProps, SupportedChain, SocialIdType } from '../../types';

interface WalletConnectState {
  isConnecting: boolean;
  showSocialOptions: boolean;
  selectedSocialType: SocialIdType | null;
  socialId: string;
  error: string | null;
}

/**
 * WalletConnect Component
 * 
 * @example
 * ```tsx
 * import { WalletConnect } from '@nexusplatform/sdk/react';
 * 
 * function App() {
 *   return (
 *     <WalletConnect
 *       chains={['ethereum', 'polygon', 'solana']}
 *       onConnect={(wallet) => {
 *         console.log('Wallet connected:', wallet);
 *       }}
 *       showBalance={true}
 *       showGasTank={true}
 *     />
 *   );
 * }
 * ```
 */
export function WalletConnect({
  chains,
  onConnect,
  onDisconnect,
  className = '',
  showBalance = true,
  showGasTank = true
}: WalletConnectProps) {
  const [state, setState] = useState<WalletConnectState>({
    isConnecting: false,
    showSocialOptions: false,
    selectedSocialType: null,
    socialId: '',
    error: null
  });

  // Mock wallet state - in real implementation this would use useNexus hook
  const [isConnected, setIsConnected] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<any>(null);

  const socialOptions: { type: SocialIdType; label: string; icon: string }[] = [
    { type: 'email', label: 'Email', icon: '📧' },
    { type: 'google', label: 'Google', icon: '🔍' },
    { type: 'phone', label: 'Phone', icon: '📱' },
    { type: 'twitter', label: 'Twitter', icon: '🐦' },
    { type: 'discord', label: 'Discord', icon: '💬' },
    { type: 'ens', label: 'ENS', icon: '🏷️' }
  ];

  const handleSocialLogin = async (socialType: SocialIdType) => {
    setState(prev => ({ ...prev, selectedSocialType: socialType, showSocialOptions: false }));
  };

  const handleConnect = async () => {
    if (!state.selectedSocialType || !state.socialId.trim()) {
      setState(prev => ({ ...prev, error: 'Please select a login method and enter your ID' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Mock connection - in real implementation this would use the SDK
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      const mockWallet = {
        socialId: state.socialId,
        socialType: state.selectedSocialType,
        addresses: {
          ethereum: '0x1234...abcd',
          polygon: '0x1234...abcd',
          solana: 'ABC123...XYZ'
        },
        balances: {
          ethereum: [
            { symbol: 'ETH', balance: '1.5', usdValue: '3750.00' },
            { symbol: 'USDC', balance: '1000.0', usdValue: '1000.00' }
          ],
          solana: [
            { symbol: 'SOL', balance: '25.0', usdValue: '2500.00' }
          ]
        },
        totalUsdValue: '7250.00'
      };

      setConnectedWallet(mockWallet);
      setIsConnected(true);
      onConnect?.(mockWallet);

      setState(prev => ({ 
        ...prev, 
        isConnecting: false,
        showSocialOptions: false,
        selectedSocialType: null,
        socialId: ''
      }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      }));
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setConnectedWallet(null);
    onDisconnect?.();
    setState({
      isConnecting: false,
      showSocialOptions: false,
      selectedSocialType: null,
      socialId: '',
      error: null
    });
  };

  if (isConnected && connectedWallet) {
    return (
      <div className={`nexus-wallet-connected ${className}`}>
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {connectedWallet.socialId.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{connectedWallet.socialId}</h3>
                <p className="text-sm text-gray-600">{connectedWallet.socialType}</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Disconnect
            </button>
          </div>

          {showBalance && (
            <div className="mb-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                <p className="text-sm opacity-90">Total Portfolio Value</p>
                <p className="text-2xl font-bold">${connectedWallet.totalUsdValue}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Addresses</h4>
            {Object.entries(connectedWallet.addresses).map(([chain, address]) => (
              <div key={chain} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm font-medium capitalize">{chain}</span>
                <span className="text-xs text-gray-600 font-mono">
                  {typeof address === 'string' ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                </span>
              </div>
            ))}
          </div>

          {showGasTank && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">⛽ Gas Tank</span>
                <span className="text-sm text-green-600">Ready</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Gasless transactions enabled across all chains
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`nexus-wallet-connect ${className}`}>
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Wallet</h2>
          <p className="text-gray-600">Connect with social login across all chains</p>
        </div>

        {state.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{state.error}</p>
          </div>
        )}

        {!state.showSocialOptions && !state.selectedSocialType ? (
          <button
            onClick={() => setState(prev => ({ ...prev, showSocialOptions: true }))}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Choose Login Method
          </button>
        ) : state.showSocialOptions ? (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 mb-3">Select Login Method</h3>
            {socialOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleSocialLogin(option.type)}
                className="w-full flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">{option.icon}</span>
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
            <button
              onClick={() => setState(prev => ({ ...prev, showSocialOptions: false }))}
              className="w-full text-gray-500 text-sm py-2"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-xl">
                {socialOptions.find(opt => opt.type === state.selectedSocialType)?.icon}
              </span>
              <span className="font-medium">
                {socialOptions.find(opt => opt.type === state.selectedSocialType)?.label}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your {state.selectedSocialType}
              </label>
              <input
                type={state.selectedSocialType === 'email' ? 'email' : 
                      state.selectedSocialType === 'phone' ? 'tel' : 'text'}
                value={state.socialId}
                onChange={(e) => setState(prev => ({ ...prev, socialId: e.target.value }))}
                placeholder={
                  state.selectedSocialType === 'email' ? 'user@example.com' :
                  state.selectedSocialType === 'phone' ? '+1234567890' :
                  state.selectedSocialType === 'ens' ? 'user.eth' :
                  state.selectedSocialType === 'twitter' ? '@username' :
                  'Enter your ID'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setState(prev => ({ 
                  ...prev, 
                  selectedSocialType: null, 
                  socialId: '',
                  showSocialOptions: true 
                }))}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleConnect}
                disabled={state.isConnecting || !state.socialId.trim()}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Powered by <span className="font-semibold">NexusSDK</span> • 
            Cross-chain support for {chains?.join(', ') || 'all chains'}
          </p>
        </div>
      </div>
    </div>
  );
} 