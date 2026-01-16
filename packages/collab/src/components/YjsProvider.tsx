/**
 * YjsProvider component
 *
 * Placeholder Yjs provider component for testing infrastructure.
 * Will be replaced with actual Yjs context implementation.
 */

import { createContext, useContext, type FC, type ReactNode } from 'react';

export interface YjsContextValue {
  /** Whether the provider is connected to a sync server */
  isConnected: boolean;
  /** The document ID being edited */
  documentId: string | null;
  /** Number of connected peers */
  peerCount: number;
}

const YjsContext = createContext<YjsContextValue | null>(null);

export interface YjsProviderProps {
  /** Children to render within the provider */
  children: ReactNode;
  /** Document ID to sync */
  documentId?: string;
  /** Override connection status (for testing) */
  isConnected?: boolean;
  /** Override peer count (for testing) */
  peerCount?: number;
}

export const YjsProvider: FC<YjsProviderProps> = ({
  children,
  documentId = null,
  isConnected = false,
  peerCount = 0,
}) => {
  const value: YjsContextValue = {
    isConnected,
    documentId,
    peerCount,
  };

  return (
    <YjsContext.Provider value={value}>
      <div data-testid="yjs-provider" data-connected={isConnected}>
        {children}
      </div>
    </YjsContext.Provider>
  );
};

/**
 * Hook to access Yjs context
 */
export function useYjs(): YjsContextValue {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}
