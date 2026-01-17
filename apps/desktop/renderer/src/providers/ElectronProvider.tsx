/**
 * ElectronProvider
 *
 * Provides Electron-specific context to the desktop renderer.
 * Creates a tRPC client connected to the daemon and exposes
 * Electron APIs via React context.
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from '@scribe/client-sdk';
import type { ScribeAPI } from '@scribe/shared';

/**
 * Context value provided by ElectronProvider.
 */
export interface ElectronContextValue {
  /** Electron IPC API (window.scribe) */
  electron: ScribeAPI;
  /** tRPC client for daemon API, null if not yet connected */
  trpc: ApiClient | null;
  /** Whether the provider is ready (daemon port resolved and tRPC client created) */
  isReady: boolean;
  /** Daemon port, null if not yet resolved */
  daemonPort: number | null;
  /** Error if initialization failed */
  error: Error | null;
}

const ElectronContext = createContext<ElectronContextValue | null>(null);

/**
 * Props for ElectronProvider component.
 */
export interface ElectronProviderProps {
  /** Child components */
  children: ReactNode;
  /** Optional loading component to show while connecting to daemon */
  loadingComponent?: ReactNode;
  /** Optional error component factory */
  errorComponent?: (error: Error) => ReactNode;
}

/**
 * Provider component that wraps the desktop app and provides Electron context.
 *
 * - Retrieves daemon port from main process via IPC
 * - Creates tRPC client connected to the daemon
 * - Exposes Electron APIs via context
 *
 * @example
 * ```tsx
 * <ElectronProvider>
 *   <App />
 * </ElectronProvider>
 * ```
 *
 * @example
 * ```tsx
 * // With custom loading/error components
 * <ElectronProvider
 *   loadingComponent={<LoadingSpinner />}
 *   errorComponent={(err) => <ErrorDisplay error={err} />}
 * >
 *   <App />
 * </ElectronProvider>
 * ```
 */
export function ElectronProvider({
  children,
  loadingComponent,
  errorComponent,
}: ElectronProviderProps) {
  const [daemonPort, setDaemonPort] = useState<number | null>(null);
  const [trpc, setTrpc] = useState<ApiClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Get daemon port from main process
        const port = await window.scribe.scribe.getDaemonPort();

        if (!mounted) return;

        setDaemonPort(port);

        // Create tRPC client
        const client = createApiClient({ port });
        setTrpc(client);
        setIsReady(true);
      } catch (err) {
        if (!mounted) return;

        const initError =
          err instanceof Error ? err : new Error('Failed to initialize ElectronProvider');
        setError(initError);
        console.error('[ElectronProvider] Initialization failed:', initError);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const value: ElectronContextValue = {
    electron: window.scribe,
    trpc,
    isReady,
    daemonPort,
    error,
  };

  // Handle error state
  if (error) {
    if (errorComponent) {
      return (
        <ElectronContext.Provider value={value}>{errorComponent(error)}</ElectronContext.Provider>
      );
    }
    // Default error display
    return (
      <ElectronContext.Provider value={value}>
        <div style={{ padding: '2rem', color: 'red' }}>
          <h2>Connection Error</h2>
          <p>{error.message}</p>
        </div>
      </ElectronContext.Provider>
    );
  }

  // Show loading while connecting to daemon
  if (!isReady) {
    if (loadingComponent) {
      return <ElectronContext.Provider value={value}>{loadingComponent}</ElectronContext.Provider>;
    }
    // Default loading display
    return (
      <ElectronContext.Provider value={value}>
        <div style={{ padding: '2rem' }}>Loading...</div>
      </ElectronContext.Provider>
    );
  }

  return <ElectronContext.Provider value={value}>{children}</ElectronContext.Provider>;
}

/**
 * Hook to access the full Electron context.
 *
 * @throws Error if used outside of ElectronProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { electron, trpc, isReady, daemonPort, error } = useElectron();
 *
 *   if (!isReady) {
 *     return <div>Loading...</div>;
 *   }
 *
 *   return <div>Connected to daemon on port {daemonPort}</div>;
 * }
 * ```
 */
export function useElectron(): ElectronContextValue {
  const context = useContext(ElectronContext);
  if (!context) {
    throw new Error('useElectron must be used within ElectronProvider');
  }
  return context;
}

/**
 * Hook to get the tRPC client.
 *
 * This is a convenience hook that returns only the tRPC client
 * and throws if not ready. Use this when you need the client
 * and want to assume the connection is ready.
 *
 * @throws Error if used outside of ElectronProvider
 * @throws Error if provider is not ready or has an error
 *
 * @example
 * ```tsx
 * function NoteList() {
 *   const trpc = useTrpc();
 *
 *   // Safe to use trpc here
 *   const notes = await trpc.notes.list.query();
 * }
 * ```
 */
export function useTrpc(): ApiClient {
  const { trpc, isReady, error } = useElectron();

  if (error) {
    throw error;
  }

  if (!isReady || !trpc) {
    throw new Error('tRPC client not ready');
  }

  return trpc;
}

/**
 * Hook to get the Electron API.
 *
 * Returns the window.scribe API object for Electron-specific operations
 * like window management, dialogs, shell operations, etc.
 *
 * @throws Error if used outside of ElectronProvider
 *
 * @example
 * ```tsx
 * function OpenLinkButton({ url }: { url: string }) {
 *   const electron = useElectronAPI();
 *
 *   const handleClick = () => {
 *     electron.shell.openExternal(url);
 *   };
 *
 *   return <button onClick={handleClick}>Open Link</button>;
 * }
 * ```
 */
export function useElectronAPI(): ScribeAPI {
  const { electron } = useElectron();
  return electron;
}
