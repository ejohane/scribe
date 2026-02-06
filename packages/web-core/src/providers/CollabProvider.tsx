/**
 * CollabProvider - React context for collaborative editing.
 *
 * Creates and manages a CollabClient instance for WebSocket-based
 * real-time synchronization with the Scribe daemon.
 *
 * @module
 */

import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from 'react';
import { CollabClient } from '@scribe/client-sdk';

/**
 * Value provided by CollabContext.
 */
export interface CollabContextValue {
  /** The CollabClient instance, null while connecting */
  collabClient: CollabClient | null;
  /** Whether the WebSocket is connected */
  isConnected: boolean;
  /** Error that occurred during connection, null if successful */
  error: Error | null;
}

const CollabContext = createContext<CollabContextValue | null>(null);

/**
 * Props for CollabProvider component.
 */
export interface CollabProviderProps {
  /** The daemon URL (e.g., http://localhost:47900) */
  daemonUrl: string;
  /** Children to render within the provider */
  children: ReactNode;
}

/**
 * CollabProvider - Provides CollabClient context for collaborative editing.
 *
 * This component manages the lifecycle of the WebSocket connection:
 * - Creates CollabClient on mount
 * - Connects to the daemon WebSocket server
 * - Disconnects on unmount
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <CollabProvider daemonUrl="http://localhost:47900">
 *       <NoteEditor />
 *     </CollabProvider>
 *   );
 * }
 * ```
 */
export const CollabProvider: FC<CollabProviderProps> = ({ daemonUrl, children }) => {
  const [collabClient, setCollabClient] = useState<CollabClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    let client: CollabClient | null = null;

    // Create client inside useEffect to handle React Strict Mode properly
    try {
      const url = new URL(daemonUrl);
      client = new CollabClient({
        host: url.hostname,
        port: parseInt(url.port, 10),
      });
    } catch (err) {
      console.error('CollabProvider: Failed to parse daemon URL:', err);
      setError(new Error('Failed to parse daemon URL'));
      return;
    }

    // Set up event listeners
    const handleConnected = () => {
      if (mounted) {
        setIsConnected(true);
        setError(null);
      }
    };

    const handleDisconnected = () => {
      if (mounted) {
        setIsConnected(false);
      }
    };

    const handleError = (err: Error) => {
      if (mounted) {
        setError(err);
      }
    };

    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);

    // Connect to the daemon
    console.log('[CollabProvider] Attempting to connect...');
    client
      .connect()
      .then(() => {
        console.log('[CollabProvider] Connected successfully, mounted:', mounted);
        if (mounted) {
          setCollabClient(client);
        }
      })
      .catch((err) => {
        console.log('[CollabProvider] Connection failed, mounted:', mounted, 'error:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      console.log('[CollabProvider] Cleanup called, disconnecting...');
      mounted = false;
      if (client) {
        client.off('connected', handleConnected);
        client.off('disconnected', handleDisconnected);
        client.off('error', handleError);
        client.disconnect();
      }
    };
  }, [daemonUrl]);

  const value: CollabContextValue = {
    collabClient,
    isConnected,
    error,
  };

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
};

/**
 * Hook to access the CollabClient context.
 *
 * @throws Error if used outside of CollabProvider
 *
 * @example
 * ```tsx
 * function NoteEditor({ noteId }: { noteId: string }) {
 *   const { collabClient, isConnected } = useCollab();
 *
 *   if (!isConnected) return <div>Connecting...</div>;
 *
 *   return (
 *     <YjsProvider noteId={noteId} collabClient={collabClient!}>
 *       <Editor />
 *     </YjsProvider>
 *   );
 * }
 * ```
 */
export function useCollab(): CollabContextValue {
  const context = useContext(CollabContext);
  if (!context) {
    throw new Error('useCollab must be used within a CollabProvider');
  }
  return context;
}
