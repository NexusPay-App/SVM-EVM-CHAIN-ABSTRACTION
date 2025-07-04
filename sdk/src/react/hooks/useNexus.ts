/**
 * useNexus Hook - Ultimate Cross-Chain Wallet Operations
 * Provides access to all SDK features with React state management
 */

import { useContext } from 'react';
import { NexusContext, UseNexusReturn } from '../providers/NexusProvider.js';

export const useNexus = (): UseNexusReturn => {
  const context = useContext(NexusContext);
  
  if (!context) {
    throw new Error('useNexus must be used within a NexusProvider');
  }
  
  return context;
};

export default useNexus; 