/**
 * ScribeProvider
 *
 * Provides Scribe SDK context to the application.
 * This is a placeholder for Phase 8 - will be fully implemented in a later task.
 */

import { createContext, useContext, type FC, type ReactNode } from 'react';

export interface ScribeContextValue {
  /** Whether the SDK is connected to the daemon */
  isConnected: boolean;
}

const ScribeContext = createContext<ScribeContextValue | null>(null);

export interface ScribeProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the app and provides SDK context.
 * Currently a stub - SDK integration will be added in scribe-ljii.
 */
export const ScribeProvider: FC<ScribeProviderProps> = ({ children }) => {
  // Placeholder context value - will be connected to actual SDK later
  const value: ScribeContextValue = {
    isConnected: false,
  };

  return <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>;
};

/**
 * Hook to access the Scribe SDK context.
 * @throws Error if used outside of ScribeProvider
 */
export function useScribe(): ScribeContextValue {
  const context = useContext(ScribeContext);
  if (!context) {
    throw new Error('useScribe must be used within a ScribeProvider');
  }
  return context;
}
