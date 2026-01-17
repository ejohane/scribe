/**
 * Client-side Todo Plugin
 *
 * Exports the client plugin factory and components for the Todo plugin.
 *
 * @module
 */

import type { ClientPlugin, ClientPluginContext } from '@scribe/plugin-core';
import { manifest } from '../shared/manifest.js';
import { TasksSidebarPanel, setUseScribeClient } from './TasksSidebarPanel.js';
import { taskCommandHandler, setTaskCommandClient } from './taskSlashCommand.js';

// Re-export manifest for PluginModule interface
export { manifest } from '../shared/manifest.js';

// Re-export components and hooks
export { TasksSidebarPanel, setUseScribeClient } from './TasksSidebarPanel.js';
export {
  taskCommandHandler,
  setTaskCommandClient,
  setTaskCommandToast,
  createTaskCommandHandler,
} from './taskSlashCommand.js';

/**
 * Create the client-side plugin instance.
 *
 * Sets up the sidebar panel and slash commands for the todo plugin.
 *
 * @param context - The client plugin context
 * @returns The configured client plugin instance
 *
 * @example
 * ```typescript
 * import { createClientPlugin } from '@scribe/plugin-todo/client';
 *
 * const plugin = createClientPlugin(context);
 * ```
 */
export function createClientPlugin(_context: ClientPluginContext): ClientPlugin {
  return {
    manifest,
    sidebarPanels: {
      // Type assertion needed because TasksSidebarPanel expects PanelProps
      // which will be injected by the plugin system at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'todo-panel': TasksSidebarPanel as any,
    },
    slashCommands: {
      task: taskCommandHandler,
    },
  };
}

/**
 * Initialize the client plugin with the Scribe client hook.
 *
 * This must be called before the plugin components are rendered
 * to provide access to the tRPC client.
 *
 * @param useScribeClient - The hook that returns the Scribe client
 *
 * @example
 * ```typescript
 * import { initializeClientPlugin } from '@scribe/plugin-todo/client';
 * import { useScribeClient } from '~/lib/scribe-client';
 *
 * initializeClientPlugin(useScribeClient);
 * ```
 */
export function initializeClientPlugin(useScribeClient: () => { api: { todos: unknown } }): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setUseScribeClient(useScribeClient as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setTaskCommandClient(useScribeClient as any);
}
