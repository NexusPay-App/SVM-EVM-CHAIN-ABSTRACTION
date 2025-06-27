# 🎫 TICKET-009: SDK Restructure & Enhancement

**Priority**: 🟡 Medium  
**Estimate**: 10 hours  
**Phase**: SDK & Documentation  
**Status**: ⏳ Pending  

**Assignee**: Frontend Team  
**Dependencies**: TICKET-008  
**Blocks**: TICKET-010  

---

## 📝 Description

Completely restructure the SDK to match the new project-centric API, fix TypeScript errors, and enhance developer experience with better error handling, type safety, and modern practices.

**Context**: Current SDK has TypeScript errors and doesn't align with the new API structure. Need modern, enterprise-ready SDK for third-party adoption.

---

## 🎯 Acceptance Criteria

- [ ] SDK matches new API structure (project-centric)
- [ ] All TypeScript errors resolved
- [ ] Modern async/await patterns implemented
- [ ] Comprehensive error handling and types
- [ ] React hooks and components functional
- [ ] Package builds and publishes successfully

---

## ✅ Tasks

### **Core SDK Restructure**
- [ ] Fix TypeScript compilation errors
- [ ] Restructure to project-centric architecture
- [ ] Implement proper authentication handling
- [ ] Add comprehensive error handling
- [ ] Update to modern JavaScript patterns

### **API Client Updates**
- [ ] Align with new `/v1/projects/` API structure
- [ ] Implement automatic retry logic
- [ ] Add request/response interceptors
- [ ] Support batch operations
- [ ] Add webhook subscription handling

### **Type Safety & Validation**
- [ ] Fix missing type exports
- [ ] Add runtime type validation
- [ ] Create comprehensive TypeScript interfaces
- [ ] Add JSDoc documentation for all methods
- [ ] Implement proper error types

### **React Integration**
- [ ] Fix React component compilation
- [ ] Update hooks to use new API
- [ ] Add better state management
- [ ] Implement error boundaries
- [ ] Add loading states and optimistic updates

---

## 🔧 New SDK Architecture

### **Project-Centric API Client**
```typescript
// New SDK structure
export class NexusSDK {
  private apiKey: string;
  private projectId: string;
  private baseURL: string;
  
  constructor(config: NexusConfig) {
    this.apiKey = config.apiKey;
    this.projectId = this.extractProjectId(config.apiKey);
    this.baseURL = config.baseURL || 'https://api.nexuspay.io/v1';
  }
  
  // Project management
  projects = {
    get: () => this.request('GET', '/projects'),
    create: (data: CreateProjectRequest) => this.request('POST', '/projects', data),
    update: (id: string, data: UpdateProjectRequest) => 
      this.request('PUT', `/projects/${id}`, data),
    delete: (id: string) => this.request('DELETE', `/projects/${id}`)
  };
  
  // Wallet operations (scoped to current project)
  wallets = {
    create: (data: CreateWalletRequest) => 
      this.request('POST', `/projects/${this.projectId}/wallets/create`, data),
    deploy: (walletId: string) => 
      this.request('POST', `/projects/${this.projectId}/wallets/deploy`, { walletId }),
    get: (walletId: string) => 
      this.request('GET', `/projects/${this.projectId}/wallets/${walletId}`),
    list: (params?: ListWalletsParams) => 
      this.request('GET', `/projects/${this.projectId}/wallets`, params)
  };
  
  // Paymaster operations
  paymaster = {
    getBalance: () => 
      this.request('GET', `/projects/${this.projectId}/paymaster/balance`),
    getAddresses: () => 
      this.request('GET', `/projects/${this.projectId}/paymaster/addresses`),
    fund: (data: FundPaymasterRequest) => 
      this.request('POST', `/projects/${this.projectId}/paymaster/fund`, data)
  };
  
  // Analytics
  analytics = {
    overview: () => 
      this.request('GET', `/projects/${this.projectId}/analytics/overview`),
    transactions: (params?: AnalyticsParams) => 
      this.request('GET', `/projects/${this.projectId}/analytics/transactions`, params),
    costs: (params?: CostAnalyticsParams) => 
      this.request('GET', `/projects/${this.projectId}/analytics/costs`, params)
  };
}
```

### **Enhanced Error Handling**
```typescript
// Comprehensive error types
export class NexusError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: string,
    public field?: string,
    public documentationUrl?: string
  ) {
    super(message);
    this.name = 'NexusError';
  }
}

export class ValidationError extends NexusError {
  constructor(field: string, message: string) {
    super('VALIDATION_ERROR', message, 400, undefined, field);
  }
}

export class AuthenticationError extends NexusError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_REQUIRED', message, 401);
  }
}

export class PaymasterInsufficientFundsError extends NexusError {
  constructor(requiredAmount: string, currentBalance: string) {
    super(
      'PAYMASTER_INSUFFICIENT_FUNDS',
      'Insufficient paymaster balance for transaction',
      400,
      `Required: ${requiredAmount}, Available: ${currentBalance}`
    );
  }
}

// Error handling in API client
private async handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json();
    
    throw new NexusError(
      errorData.error.code,
      errorData.error.message,
      response.status,
      errorData.error.details,
      errorData.error.field,
      errorData.error.documentation_url
    );
  }
  
  const data = await response.json();
  return data.data; // Return just the data portion
}
```

### **Modern React Hooks**
```typescript
// Enhanced useNexus hook
export function useNexus(config: NexusConfig) {
  const [sdk, setSdk] = useState<NexusSDK | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NexusError | null>(null);
  
  useEffect(() => {
    const nexus = new NexusSDK(config);
    setSdk(nexus);
  }, [config.apiKey]);
  
  const createWallet = useCallback(async (data: CreateWalletRequest) => {
    if (!sdk) throw new Error('SDK not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const wallet = await sdk.wallets.create(data);
      setIsLoading(false);
      return wallet;
    } catch (err) {
      const error = err as NexusError;
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [sdk]);
  
  const deployWallet = useCallback(async (walletId: string) => {
    if (!sdk) throw new Error('SDK not initialized');
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await sdk.wallets.deploy(walletId);
      setIsLoading(false);
      return result;
    } catch (err) {
      const error = err as NexusError;
      setError(error);
      setIsLoading(false);
      throw error;
    }
  }, [sdk]);
  
  return {
    sdk,
    isLoading,
    error,
    createWallet,
    deployWallet,
    clearError: () => setError(null)
  };
}

// Wallet creation hook with optimistic updates
export function useWalletCreation() {
  const { sdk } = useNexus();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  const createWallet = useCallback(async (data: CreateWalletRequest) => {
    if (!sdk) throw new Error('SDK not initialized');
    
    setIsCreating(true);
    
    // Optimistic update
    const optimisticWallet: Wallet = {
      id: `temp_${Date.now()}`,
      addresses: {},
      status: 'creating',
      ...data
    };
    setWallets(prev => [optimisticWallet, ...prev]);
    
    try {
      const wallet = await sdk.wallets.create(data);
      
      // Replace optimistic wallet with real one
      setWallets(prev => 
        prev.map(w => w.id === optimisticWallet.id ? wallet : w)
      );
      
      setIsCreating(false);
      return wallet;
    } catch (error) {
      // Remove optimistic wallet on error
      setWallets(prev => 
        prev.filter(w => w.id !== optimisticWallet.id)
      );
      
      setIsCreating(false);
      throw error;
    }
  }, [sdk]);
  
  return { wallets, createWallet, isCreating };
}
```

---

## 🔧 TypeScript Fixes

### **Missing Type Exports**
```typescript
// src/types/index.ts - COMPLETE TYPE DEFINITIONS
export interface NexusConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retries?: number;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  owner_id: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  website?: string;
  chains: SupportedChain[];
  settings: ProjectSettings;
}

export interface ProjectSettings {
  paymasterEnabled: boolean;
  webhookUrl?: string;
  rateLimit: number;
}

export interface Wallet {
  id: string;
  addresses: Record<SupportedChain, string>;
  status: 'created' | 'deploying' | 'deployed' | 'failed';
  deployment_status: Record<SupportedChain, 'pending' | 'confirmed' | 'failed'>;
  socialId: string;
  socialType: SocialType;
  created_at: string;
  updated_at: string;
}

export interface CreateWalletRequest {
  socialId: string;
  socialType: SocialType;
  chains: SupportedChain[];
  paymasterEnabled?: boolean;
  metadata?: Record<string, any>;
}

export type SupportedChain = 'ethereum' | 'solana' | 'arbitrum';
export type SocialType = 'email' | 'twitter' | 'discord' | 'gameId' | 'employeeId';

// React component props
export interface WalletConnectProps {
  onWalletCreated?: (wallet: Wallet) => void;
  onError?: (error: NexusError) => void;
  chains?: SupportedChain[];
  className?: string;
  style?: React.CSSProperties;
}

export interface NexusProviderProps {
  config: NexusConfig;
  children: React.ReactNode;
}

// Context types
export interface NexusContextValue {
  sdk: NexusSDK | null;
  isLoading: boolean;
  error: NexusError | null;
  createWallet: (data: CreateWalletRequest) => Promise<Wallet>;
  deployWallet: (walletId: string) => Promise<any>;
  clearError: () => void;
}
```

### **Fixed React Components**
```typescript
// src/react/components/WalletConnect.tsx - FIXED VERSION
import React, { useState, useCallback } from 'react';
import { useNexus } from '../hooks/useNexus';
import { WalletConnectProps, CreateWalletRequest, SupportedChain } from '../../types';

export const WalletConnect: React.FC<WalletConnectProps> = ({
  onWalletCreated,
  onError,
  chains = ['ethereum', 'solana', 'arbitrum'],
  className,
  style
}) => {
  const { createWallet, isLoading, error } = useNexus();
  const [formData, setFormData] = useState({
    socialId: '',
    socialType: 'email' as const,
    selectedChains: chains
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const request: CreateWalletRequest = {
        socialId: formData.socialId,
        socialType: formData.socialType,
        chains: formData.selectedChains,
        paymasterEnabled: true
      };
      
      const wallet = await createWallet(request);
      onWalletCreated?.(wallet);
    } catch (err) {
      onError?.(err as any);
    }
  }, [formData, createWallet, onWalletCreated, onError]);

  return (
    <form onSubmit={handleSubmit} className={className} style={style}>
      <div>
        <label>
          Social ID:
          <input
            type="text"
            value={formData.socialId}
            onChange={(e) => setFormData(prev => ({ ...prev, socialId: e.target.value }))}
            required
          />
        </label>
      </div>
      
      <div>
        <label>
          Social Type:
          <select
            value={formData.socialType}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              socialType: e.target.value as any 
            }))}
          >
            <option value="email">Email</option>
            <option value="twitter">Twitter</option>
            <option value="discord">Discord</option>
            <option value="gameId">Game ID</option>
          </select>
        </label>
      </div>
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Wallet'}
      </button>
      
      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          Error: {error.message}
        </div>
      )}
    </form>
  );
};
```

---

## 📦 Package Configuration

### **Updated package.json**
```json
{
  "name": "@nexuspay/sdk",
  "version": "2.0.0",
  "description": "Enterprise-grade cross-chain wallet infrastructure SDK",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "rollup -c",
    "build:types": "tsc --emitDeclarationOnly",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build && npm run test"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "rollup": "^4.0.0",
    "@rollup/plugin-typescript": "^11.1.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

### **Build Configuration**
```javascript
// rollup.config.js - PROPER BUILD SETUP
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

export default defineConfig([
  // CJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    },
    plugins: [typescript()],
    external: ['react', 'react-dom', 'axios']
  },
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm'
    },
    plugins: [typescript()],
    external: ['react', 'react-dom', 'axios']
  }
]);
```

---

## 🧪 Testing Requirements

### **Unit Tests**
- [ ] SDK initialization and configuration
- [ ] API client request/response handling
- [ ] Error handling and type safety
- [ ] React hooks functionality
- [ ] Component rendering and interactions

### **Integration Tests**
- [ ] End-to-end wallet creation flow
- [ ] Project management operations
- [ ] Paymaster integration
- [ ] Analytics data fetching
- [ ] Error scenarios and recovery

### **Type Testing**
- [ ] TypeScript compilation without errors
- [ ] Type inference and autocompletion
- [ ] Interface compatibility
- [ ] Generic type constraints
- [ ] JSDoc documentation generation

---

## 📊 Success Metrics

- [ ] TypeScript compilation success (0 errors)
- [ ] Package build time < 30 seconds
- [ ] Bundle size < 50KB (gzipped)
- [ ] Test coverage > 90%
- [ ] NPM package publishes successfully

---

## 🚀 Next Steps

**After completion**:
1. Publish v2.0.0 to NPM registry
2. Update all documentation and examples
3. Create migration guide from v1 to v2
4. Set up automated testing pipeline

---

## 📝 Notes

- Maintain backward compatibility where possible
- Use semantic versioning for breaking changes
- Add comprehensive JSDoc for IntelliSense
- Consider tree-shaking for bundle optimization
- Plan deprecation strategy for old SDK versions 