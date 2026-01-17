/**
 * Todo Plugin Server Plugin Factory
 *
 * Creates the server-side plugin instance with storage, router, and event handlers.
 *
 * @module
 */

import type { PluginManifest, ServerPlugin, ServerPluginContext } from '@scribe/plugin-core';
import { TodoStore } from './store.js';
import { createTodoRouter } from './router.js';
import { createEventHandlers } from './events.js';

/**
 * Todo plugin manifest.
 *
 * Declares the plugin's identity and capabilities.
 */
export const manifest: PluginManifest = {
  id: '@scribe/plugin-todo',
  version: '1.0.0',
  name: 'Todo Plugin',
  description: 'Adds task management capabilities to your notes',
  author: 'Scribe Team',
  capabilities: [
    { type: 'trpc-router', namespace: 'todos' },
    { type: 'storage', keys: ['todo:ids', 'todo:*', 'todo:by-note:*'] },
    { type: 'event-hook', events: ['note:deleted'] },
    { type: 'sidebar-panel', id: 'todo-panel', label: 'Tasks', icon: 'CheckSquare' },
    { type: 'slash-command', command: 'task', label: 'Add Task', description: 'Add a todo item' },
  ],
};

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
