/**
 * @scribe/plugin-todo
 *
 * Todo plugin for Scribe - adds task management capabilities to your notes.
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
export { TodoStore, createTodoRouter } from './server/index.js';
export type { TodoRouter } from './server/index.js';

// Re-export shared types
export type { Todo, TodoStatus, CreateTodoInput, UpdateTodoInput } from './shared/index.js';
