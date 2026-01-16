/**
 * ScribeProvider
 *
 * Provides Scribe SDK context to the application.
 * Connects to the daemon and provides client access to all components.
 */

import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from 'react';
import { ScribeClient, type ClientStatus } from '@scribe/client-sdk';
import { DAEMON_PORT } from '../config';

/**
 * Context value provided by ScribeProvider.
 */
export interface ScribeContextValue {
  /** The ScribeClient instance, or null if not yet initialized */
  client: ScribeClient | null;
  /** Current connection status */
  status: ClientStatus;
  /** Connection error, if any */
  error: Error | null;
  /** Whether the client is connected to the daemon */
  isConnected: boolean;
}

const ScribeContext = createContext<ScribeContextValue | null>(null);

/**
 * Props for ScribeProvider component.
 */
export interface ScribeProviderProps {
  /** Child components */
  children: ReactNode;
  /** Override daemon port (defaults to DAEMON_PORT from config) */
  port?: number;
}

/**
 * Provider component that wraps the app and provides SDK context.
 *
 * Creates a ScribeClient instance and manages its lifecycle.
 * The client connects to the daemon on mount and disconnects on unmount.
 *
 * @example
 * ```tsx
 * <ScribeProvider>
 *   <App />
 * </ScribeProvider>
 * ```
 *
 * @example
 * ```tsx
 * // With custom port
 * <ScribeProvider port={8080}>
 *   <App />
 * </ScribeProvider>
 * ```
 */
export const ScribeProvider: FC<ScribeProviderProps> = ({ children, port }) => {
  // Create client once - it will be reused across re-renders
  const [client] = useState(
    () =>
      new ScribeClient({
        autoDiscover: false, // Browser can't read ~/.scribe/daemon.json
        port: port ?? DAEMON_PORT,
        autoConnect: false, // We'll connect manually in useEffect
      })
  );

  const [status, setStatus] = useState<ClientStatus>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Event handlers
    const handleStatusChange = (newStatus: ClientStatus) => {
      setStatus(newStatus);
    };

    const handleError = (err: Error) => {
      setError(err);
    };

    // Subscribe to events
    client.on('status-change', handleStatusChange);
    client.on('error', handleError);

    // Connect to daemon
    client.connect().catch(handleError);

    // Cleanup on unmount
    return () => {
      client.off('status-change', handleStatusChange);
      client.off('error', handleError);
      client.disconnect();
    };
  }, [client]);

  const value: ScribeContextValue = {
    client,
    status,
    error,
    isConnected: status === 'connected',
  };

  return <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>;
};

/**
 * Hook to access the Scribe SDK context.
 *
 * Returns the full context value including client, status, and error.
 *
 * @throws Error if used outside of ScribeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { client, status, error, isConnected } = useScribe();
 *
 *   if (status === 'connecting') {
 *     return <div>Connecting...</div>;
 *   }
 *
 *   if (error) {
 *     return <div>Error: {error.message}</div>;
 *   }
 *
 *   return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
 * }
 * ```
 */
export function useScribe(): ScribeContextValue {
  const context = useContext(ScribeContext);
  if (!context) {
    throw new Error('useScribe must be used within a ScribeProvider');
  }
  return context;
}

/**
 * Hook to get the ScribeClient directly.
 *
 * This is a convenience hook that returns only the client,
 * and throws if not connected. Use this when you need the client
 * and want to assume the connection is ready.
 *
 * @throws Error if used outside of ScribeProvider
 * @throws Error if client is not connected
 *
 * @example
 * ```tsx
 * function NoteList() {
 *   const client = useScribeClient();
 *
 *   // Safe to use client.api here
 *   const notes = await client.api.notes.list.query();
 * }
 * ```
 */
export function useScribeClient(): ScribeClient {
  const { client, status, error } = useScribe();

  if (error) {
    throw error;
  }

  if (status !== 'connected' || !client) {
    throw new Error('Scribe client not connected');
  }

  return client;
}
