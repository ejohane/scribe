import React, { createContext, useContext, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@scribe/server-core';

interface ScribeContextValue {
  trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
}

const ScribeContext = createContext<ScribeContextValue | null>(null);

interface ScribeProviderProps {
  children: React.ReactNode;
  daemonUrl: string;
}

/**
 * ScribeProvider sets up the tRPC client and React Query for communicating
 * with the Scribe daemon. This provider is platform-agnostic and can be used
 * in both web and Electron apps.
 *
 * @param children - React children to render
 * @param daemonUrl - Base URL of the Scribe daemon (e.g., "http://localhost:3000")
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ScribeProvider daemonUrl="http://localhost:3000">
 *       <MyApp />
 *     </ScribeProvider>
 *   );
 * }
 * ```
 */
export function ScribeProvider({ children, daemonUrl }: ScribeProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpc] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${daemonUrl}/trpc`,
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ScribeContext.Provider value={{ trpc }}>{children}</ScribeContext.Provider>
    </QueryClientProvider>
  );
}

/**
 * Hook to access the Scribe context containing the tRPC client.
 *
 * @throws Error if used outside of ScribeProvider
 * @returns The Scribe context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { trpc } = useScribe();
 *   const notes = await trpc.notes.list.query();
 * }
 * ```
 */
export function useScribe(): ScribeContextValue {
  const context = useContext(ScribeContext);
  if (!context) {
    throw new Error('useScribe must be used within ScribeProvider');
  }
  return context;
}

/**
 * Convenience hook to access just the tRPC client.
 *
 * @returns The tRPC proxy client
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const trpc = useTrpc();
 *   const notes = await trpc.notes.list.query();
 * }
 * ```
 */
export function useTrpc(): ScribeContextValue['trpc'] {
  return useScribe().trpc;
}
