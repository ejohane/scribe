/**
 * @scribe/plugin-todo
 *
 * Todo plugin for Scribe - adds task management capabilities to your notes.
 *
 * This module provides a complete PluginModule export that includes both
 * server and client plugin factories, as well as the manifest.
 *
 * @example
 * ```typescript
 * // In installed plugins registry (web app)
 * import * as todoPlugin from '@scribe/plugin-todo';
 *
 * export function getInstalledPlugins(): PluginModule[] {
 *   return [todoPlugin];
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Server-side usage
 * import { TodoStore, createTodoRouter } from '@scribe/plugin-todo/server';
 *
 * const store = new TodoStore(pluginStorage);
 * const router = createTodoRouter(store);
 * ```
 *
 * @example
 * ```typescript
 * // Shared types
 * import type { Todo, TodoStatus } from '@scribe/plugin-todo/shared';
 * ```
 *
 * @example
 * ```typescript
 * // Router type for client-side type safety
 * import type { TodoRouter } from '@scribe/plugin-todo';
 *
 * const client = usePluginClient<TodoRouter>();
 * const todos = await client.todos.list.query({ status: 'pending' });
 * ```
 *
 * @module
 */

// Re-export server components
export {
  TodoStore,
  createTodoRouter,
  createEventHandlers,
  manifest,
  createServerPlugin,
} from './server/index.js';
export type { TodoRouter } from './server/index.js';

// Re-export client components
export {
  createClientPlugin,
  initializeClientPlugin,
  TasksSidebarPanel,
  setUseScribeClient,
  taskCommandHandler,
  setTaskCommandClient,
  setTaskCommandToast,
  createTaskCommandHandler,
} from './client/index.js';

// Re-export shared types
export type { Todo, TodoStatus, CreateTodoInput, UpdateTodoInput } from './shared/index.js';
