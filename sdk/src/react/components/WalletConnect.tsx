/**
 * WalletConnect - Ultimate Flexible Social Wallet Creator
 * Support for ANY social identifier with beautiful, customizable UI
 */

import React, { useState, useEffect } from 'react';
import { useNexus } from '../hooks/useNexus';
import { SupportedChain, WalletConnectProps, COMMON_SOCIAL_TYPES } from '../../types/index.js';

export const WalletConnect: React.FC<WalletConnectProps> = ({
  onWalletCreated,
  onError,
  chains = ['ethereum', 'arbitrum', 'solana'],
  allowedSocialTypes,
  customSocialTypes = [],
  className = '',
  theme = 'auto',
}) => {
  const { createWallet, isLoading, error, clearError } = useNexus();
  
  const [socialId, setSocialId] = useState('');
  const [socialType, setSocialType] = useState('');
  const [selectedChains, setSelectedChains] = useState<SupportedChain[]>(chains);
  const [walletName, setWalletName] = useState('');
  const [customSocialType, setCustomSocialType] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Available social types (filtered if allowedSocialTypes is provided)
  const availableSocialTypes = React.useMemo(() => {
    const commonTypes = Object.entries(COMMON_SOCIAL_TYPES).map(([key, value]) => ({
      type: value,
      label: key.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' '),
      placeholder: getSocialPlaceholder(value),
    }));

    // Add custom types
    const allTypes = [...commonTypes, ...customSocialTypes];

    // Filter if allowedSocialTypes is provided
    if (allowedSocialTypes) {
      return allTypes.filter(type => allowedSocialTypes.includes(type.type));
    }

    return allTypes;
  }, [allowedSocialTypes, customSocialTypes]);

  // Auto-detect theme
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setCurrentTheme(mediaQuery.matches ? 'dark' : 'light');
      
      const handleChange = (e: MediaQueryListEvent) => {
        setCurrentTheme(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setCurrentTheme(theme);
    }
  }, [theme]);

  // Get placeholder text for social types
  function getSocialPlaceholder(type: string): string {
    const placeholders: Record<string, string> = {
      email: 'user@example.com',
      twitter: '@username',
      discord: 'username#1234',
      telegram: '@username',
      github: 'username',
      instagram: '@username',
      gameId: 'player123',
      employeeId: 'EMP001',
      customerId: 'CUST001',
      ens: 'username.eth',
      phone: '+1234567890',
      username: 'username',
      steamId: 'steam_username',
      xboxGamertag: 'GamerTag',
      userUuid: 'unique-user-id',
    };
    return placeholders[type] || `Enter your ${type}`;
  }

  // Handle social type change
  const handleSocialTypeChange = (type: string) => {
    setSocialType(type);
    setIsCustomType(type === 'custom');
    setSocialId('');
    setCustomSocialType('');
  };

  // Handle chain selection
  const handleChainToggle = (chain: SupportedChain) => {
    setSelectedChains(prev => 
      prev.includes(chain) 
        ? prev.filter(c => c !== chain)
        : [...prev, chain]
    );
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!socialId.trim()) {
      onError?.({ code: 'INVALID_INPUT', message: 'Social ID is required' });
      return;
    }

    if (!socialType && !isCustomType) {
      onError?.({ code: 'INVALID_INPUT', message: 'Social type is required' });
      return;
    }

    if (isCustomType && !customSocialType.trim()) {
      onError?.({ code: 'INVALID_INPUT', message: 'Custom social type is required' });
      return;
    }

    if (selectedChains.length === 0) {
      onError?.({ code: 'INVALID_INPUT', message: 'At least one chain must be selected' });
      return;
    }

    try {
      clearError();
      
      const wallet = await createWallet(
        socialId.trim(),
        isCustomType ? customSocialType.trim() : socialType,
        selectedChains
      );

      onWalletCreated?.(wallet);
      
      // Reset form
      setSocialId('');
      setSocialType('');
      setWalletName('');
      setCustomSocialType('');
      setIsCustomType(false);
      setShowAdvanced(false);
      
    } catch (err: any) {
      onError?.(err);
    }
  };

  // Get chain display name
  const getChainDisplayName = (chain: SupportedChain) => {
    const names: Record<SupportedChain, string> = {
      ethereum: 'Ethereum',
      arbitrum: 'Arbitrum',
      solana: 'Solana',
    };
    return names[chain];
  };

  // Get chain logo emoji
  const getChainLogo = (chain: SupportedChain) => {
    const logos: Record<SupportedChain, string> = {
      ethereum: '⟡',
      arbitrum: '🔵',
      solana: '🌟',
    };
    return logos[chain];
  };

  // Theme colors
  const colors = {
    light: {
      bg: '#ffffff',
      cardBg: '#f8fafc',
      border: '#e2e8f0',
      text: '#1e293b',
      textSecondary: '#64748b',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      success: '#10b981',
      error: '#ef4444',
      inputBg: '#ffffff',
      inputBorder: '#d1d5db',
      inputFocus: '#3b82f6',
    },
    dark: {
      bg: '#0f172a',
      cardBg: '#1e293b',
      border: '#334155',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      success: '#10b981',
      error: '#ef4444',
      inputBg: '#334155',
      inputBorder: '#475569',
      inputFocus: '#3b82f6',
    },
  };

  const c = colors[currentTheme];

  return (
    <div 
      className={`nexus-wallet-connect ${className}`}
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '24px',
        backgroundColor: c.bg,
        borderRadius: '16px',
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        color: c.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '24px', 
          fontWeight: '600',
          color: c.text,
        }}>
          Create Wallet
        </h2>
        <p style={{ 
          margin: '0', 
          fontSize: '14px', 
          color: c.textSecondary,
        }}>
          Connect with any social identifier across multiple chains
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: c.error + '10',
          border: `1px solid ${c.error}30`,
          borderRadius: '8px',
          marginBottom: '20px',
          color: c.error,
          fontSize: '14px',
        }}>
          {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Social Type Selection */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '14px', 
            fontWeight: '500', 
            marginBottom: '8px',
            color: c.text,
          }}>
            Social Type
          </label>
          <select
            value={socialType}
            onChange={(e) => handleSocialTypeChange(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${c.inputBorder}`,
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: c.inputBg,
              color: c.text,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = c.inputFocus}
            onBlur={(e) => e.target.style.borderColor = c.inputBorder}
          >
            <option value="">Select social type</option>
            {availableSocialTypes.map((type) => (
              <option key={type.type} value={type.type}>
                {type.label}
              </option>
            ))}
            <option value="custom">Custom Type</option>
          </select>
        </div>

        {/* Custom Social Type Input */}
        {isCustomType && (
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              marginBottom: '8px',
              color: c.text,
            }}>
              Custom Social Type
            </label>
            <input
              type="text"
              value={customSocialType}
              onChange={(e) => setCustomSocialType(e.target.value)}
              placeholder="Enter custom social type (e.g., nftHolder, daoMember)"
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: c.inputBg,
                color: c.text,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = c.inputFocus}
              onBlur={(e) => e.target.style.borderColor = c.inputBorder}
            />
          </div>
        )}

        {/* Social ID Input */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '14px', 
            fontWeight: '500', 
            marginBottom: '8px',
            color: c.text,
          }}>
            Social ID
          </label>
          <input
            type="text"
            value={socialId}
            onChange={(e) => setSocialId(e.target.value)}
            placeholder={
              isCustomType 
                ? "Enter your custom identifier" 
                : socialType 
                  ? getSocialPlaceholder(socialType)
                  : "Enter your social identifier"
            }
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid ${c.inputBorder}`,
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: c.inputBg,
              color: c.text,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = c.inputFocus}
            onBlur={(e) => e.target.style.borderColor = c.inputBorder}
          />
        </div>

        {/* Chain Selection */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: '14px', 
            fontWeight: '500', 
            marginBottom: '8px',
            color: c.text,
          }}>
            Select Chains
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {chains.map((chain) => (
              <button
                key={chain}
                type="button"
                onClick={() => handleChainToggle(chain)}
                style={{
                  padding: '8px 16px',
                  border: `1px solid ${selectedChains.includes(chain) ? c.primary : c.inputBorder}`,
                  borderRadius: '20px',
                  backgroundColor: selectedChains.includes(chain) ? c.primary : c.inputBg,
                  color: selectedChains.includes(chain) ? 'white' : c.text,
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{getChainLogo(chain)}</span>
                {getChainDisplayName(chain)}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none',
              border: 'none',
              color: c.primary,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              padding: '0',
              textDecoration: 'underline',
            }}
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>
          
          {showAdvanced && (
            <div style={{ marginTop: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '8px',
                color: c.text,
              }}>
                Wallet Name (Optional)
              </label>
              <input
                type="text"
                value={walletName}
                onChange={(e) => setWalletName(e.target.value)}
                placeholder="My Wallet"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${c.inputBorder}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: c.inputBg,
                  color: c.text,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = c.inputFocus}
                onBlur={(e) => e.target.style.borderColor = c.inputBorder}
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: isLoading ? c.textSecondary : c.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = c.primaryHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = c.primary;
            }
          }}
        >
          {isLoading ? (
            <>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Creating Wallet...
            </>
          ) : (
            '🚀 Create Gasless Wallet'
          )}
        </button>
      </form>

      {/* Features */}
      <div style={{ 
        marginTop: '24px', 
        padding: '16px', 
        backgroundColor: c.cardBg,
        borderRadius: '8px',
        border: `1px solid ${c.border}`,
      }}>
        <h3 style={{ 
          margin: '0 0 12px 0', 
          fontSize: '16px', 
          fontWeight: '600',
          color: c.text,
        }}>
          ✨ Features
        </h3>
        <ul style={{ 
          margin: '0', 
          padding: '0', 
          listStyle: 'none',
          fontSize: '14px',
          color: c.textSecondary,
        }}>
          <li style={{ marginBottom: '8px' }}>⚡ Gasless transactions across all chains</li>
          <li style={{ marginBottom: '8px' }}>🔗 Cross-chain bridging & swaps</li>
          <li style={{ marginBottom: '8px' }}>🔐 Multi-chain wallet infrastructure</li>
          <li>🎯 Any social identifier supported</li>
        </ul>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default WalletConnect; 