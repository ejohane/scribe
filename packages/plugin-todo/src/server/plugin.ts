/**
 * Todo Plugin Server Plugin Factory
 *
 * Creates the server-side plugin instance with storage, router, and event handlers.
 *
 * @module
 */

import type { ServerPlugin, ServerPluginContext } from '@scribe/plugin-core';
import { TodoStore } from './store.js';
import { createTodoRouter } from './router.js';
import { createEventHandlers } from './events.js';
import { manifest } from '../shared/manifest.js';

// Re-export manifest for backwards compatibility
export { manifest } from '../shared/manifest.js';

/**
 * Create the server-side plugin instance.
 *
 * Sets up storage, router, and event handlers for the todo plugin.
 *
 * @param context - The server plugin context providing storage, events, and logger
 * @returns The configured server plugin instance
 *
 * @example
 * ```typescript
 * import { createServerPlugin } from '@scribe/plugin-todo/server/plugin';
 *
 * const plugin = await createServerPlugin(context);
 * ```
 */
export async function createServerPlugin(context: ServerPluginContext): Promise<ServerPlugin> {
  const store = new TodoStore(context.storage);
  const eventHandlers = createEventHandlers(store, context.logger);

  context.logger.info('Todo plugin initializing');

  return {
    manifest,
    router: createTodoRouter(store),
    eventHandlers,
    onActivate: async () => {
      context.logger.info('Todo plugin activated');
    },
    onDeactivate: async () => {
      context.logger.info('Todo plugin deactivated');
    },
  };
}
