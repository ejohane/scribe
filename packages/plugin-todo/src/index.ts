/**
 * @scribe/plugin-todo
 *
 * Todo plugin for Scribe - adds task management capabilities to your notes.
 *
 * @example
 * ```typescript
 * // Server-side usage
 * import { TodoStore } from '@scribe/plugin-todo/server';
 *
 * const store = new TodoStore(pluginStorage);
 * const todo = await store.create({ title: 'Buy milk' });
 * ```
 *
 * @example
 * ```typescript
 * // Shared types
 * import type { Todo, TodoStatus } from '@scribe/plugin-todo/shared';
 * ```
 *
 * @module
 */

// Re-export server components
export { TodoStore } from './server/index.js';

// Re-export shared types
export type { Todo, TodoStatus, CreateTodoInput, UpdateTodoInput } from './shared/index.js';
