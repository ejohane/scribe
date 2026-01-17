/**
 * PluginClientInitializer
 *
 * Component that initializes plugins with the Scribe client.
 * Must be rendered inside ScribeProvider after the client is connected.
 *
 * @module
 */

import { useEffect, useRef, type FC, type ReactNode } from 'react';
// Import from /client to avoid pulling in server-side code (@trpc/server)
import { initializeClientPlugin as initTodoPlugin } from '@scribe/plugin-todo/client';
import { useScribe } from '../providers/ScribeProvider';

/**
 * Props for the PluginClientInitializer component.
 */
export interface PluginClientInitializerProps {
  /** Child components to render */
  children: ReactNode;
}

/**
 * Hook that returns the Scribe client for plugin use.
 *
 * This wrapper is needed because plugin initialization expects a hook
 * that returns the client directly, not the full context.
 */
function useScribeClientForPlugins() {
  const { client } = useScribe();
  return client;
}

/**
 * Component that initializes plugins with the Scribe client.
 *
 * This component:
 * 1. Waits for the Scribe client to be available
 * 2. Initializes all installed plugins with the client hook
 * 3. Renders children once initialization is complete
 *
 * Place this component inside ScribeProvider but outside PluginProvider
 * to ensure plugins have access to the client before they're loaded.
 *
 * @example
 * ```tsx
 * <ScribeProvider>
 *   <PluginClientInitializer>
 *     <PluginProvider>
 *       <App />
 *     </PluginProvider>
 *   </PluginClientInitializer>
 * </ScribeProvider>
 * ```
 */
export const PluginClientInitializer: FC<PluginClientInitializerProps> = ({ children }) => {
  const initialized = useRef(false);
  const { isConnected } = useScribe();

  useEffect(() => {
    if (isConnected && !initialized.current) {
      // Initialize plugins with the client hook
      // The hook wrapper returns just the client, matching what plugins expect
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initTodoPlugin(useScribeClientForPlugins as any);

      initialized.current = true;
      // eslint-disable-next-line no-console -- Intentional logging for debugging
      console.log('[PluginClientInitializer] Plugins initialized with client');
    }
  }, [isConnected]);

  return <>{children}</>;
};
