/**
 * useNexus - Main hook for accessing NexusSDK
 */

import { useContext } from 'react';
import { useNexusContext, NexusContextType } from '../providers/NexusProvider';

export function useNexus(): NexusContextType {
  const context = useNexusContext();
  if (!context) {
    throw new Error('useNexus must be used within a NexusProvider');
  }
  return context;
} 