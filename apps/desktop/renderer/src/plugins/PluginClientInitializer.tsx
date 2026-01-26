/**
 * PluginClientInitializer
 *
 * Component that initializes plugins with the tRPC client from app-shell.
 * Must be rendered inside ScribeProvider after the client is ready.
 *
 * @module
 */

import { useEffect, useRef, type FC, type ReactNode } from 'react';
// Import from /client to avoid pulling in server-side code (@trpc/server)
import {
  ensureToday as ensureDailyNoteToday,
  initializeClientPlugin as initDailyNotePlugin,
} from '@scribe/plugin-daily-note/client';
import { initializeClientPlugin as initTodoPlugin } from '@scribe/plugin-todo/client';
import { useTrpc } from '@scribe/web-core';
import { usePluginSettings } from './usePluginSettings';

let hasEnsuredDailyNote = false;

/**
 * Props for the PluginClientInitializer component.
 */
export interface PluginClientInitializerProps {
  /** Child components to render */
  children: ReactNode;
}

/**
 * Component that initializes plugins with the tRPC client.
 *
 * This component:
 * 1. Gets the tRPC client from app-shell's ScribeProvider
 * 2. Initializes all installed plugins with the client hook
 * 3. Renders children once initialization is complete
 *
 * Place this component inside ScribeProvider but outside PluginProvider
 * to ensure plugins have access to the client before they're loaded.
 */
export const PluginClientInitializer: FC<PluginClientInitializerProps> = ({ children }) => {
  const initialized = useRef(false);
  const trpc = useTrpc();
  const { enabledPluginIds } = usePluginSettings();
  const isDailyNoteEnabled = enabledPluginIds.has('@scribe/plugin-daily-note');

  useEffect(() => {
    if (trpc && !initialized.current) {
      // Initialize plugins with the tRPC client hook
      // The plugins expect a hook that returns the API client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initDailyNotePlugin(() => ({ api: trpc }) as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initTodoPlugin(() => ({ api: trpc }) as any);

      initialized.current = true;
      // eslint-disable-next-line no-console -- Intentional logging for debugging
      console.log('[PluginClientInitializer] Plugins initialized with tRPC client');
    }

    if (!trpc || hasEnsuredDailyNote || !isDailyNoteEnabled) {
      return;
    }

    hasEnsuredDailyNote = true;
    void ensureDailyNoteToday().catch((error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // eslint-disable-next-line no-console -- Intentional logging for initialization failure
      console.error(`[PluginClientInitializer] Failed to ensure daily note: ${message}`);
    });
  }, [trpc, isDailyNoteEnabled]);

  return <>{children}</>;
};
