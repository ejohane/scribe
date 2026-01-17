/**
 * Todo Plugin tRPC Router
 *
 * Exposes CRUD operations for todos through tRPC endpoints.
 * This router is merged into the main appRouter at the 'todos' namespace.
 *
 * @example
 * ```typescript
 * // Client usage (type-safe)
 * const todos = await client.todos.list.query({ status: 'pending' });
 * const newTodo = await client.todos.create.mutate({ title: 'Buy milk' });
 * await client.todos.toggle.mutate({ id: newTodo.id });
 * ```
 *
 * @module
 */

import { z } from 'zod';
import { router, publicProcedure, TRPCError } from './trpc.js';
import type { TodoStore } from './store.js';

// ============================================================================
// Input Validation Schemas
// ============================================================================

/**
 * Schema for listing todos with optional status filter.
 */
const listInputSchema = z.object({
  /** Filter by status: 'all', 'pending', or 'completed' */
  status: z.enum(['all', 'pending', 'completed']).optional().default('all'),
});

/**
 * Schema for creating a new todo.
 */
const createInputSchema = z.object({
  /** The todo title (1-500 characters) */
  title: z.string().min(1, 'Title cannot be empty').max(500, 'Title is too long'),
  /** Optional note ID to associate the todo with */
  noteId: z.string().optional(),
});

/**
 * Schema for updating an existing todo.
 */
const updateInputSchema = z.object({
  /** The ID of the todo to update */
  id: z.string(),
  /** New title for the todo */
  title: z.string().min(1, 'Title cannot be empty').max(500, 'Title is too long').optional(),
  /** New completion status */
  completed: z.boolean().optional(),
});

/**
 * Schema for operations requiring only an ID.
 */
const idInputSchema = z.object({
  /** The ID of the todo */
  id: z.string(),
});

// ============================================================================
// Router Factory
// ============================================================================

/**
 * Creates the tRPC router for the Todo plugin.
 *
 * The router exposes the following procedures:
 * - `list` (query): List todos with optional status filter
 * - `get` (query): Get a single todo by ID
 * - `create` (mutation): Create a new todo
 * - `update` (mutation): Update an existing todo
 * - `toggle` (mutation): Toggle a todo's completion status
 * - `delete` (mutation): Delete a todo
 *
 * @param store - The TodoStore instance for data operations
 * @returns The configured tRPC router
 *
 * @example
 * ```typescript
 * const store = new TodoStore(pluginStorage);
 * const todoRouter = createTodoRouter(store);
 *
 * // Use with tRPC server
 * const appRouter = router({
 *   todos: todoRouter,
 *   // ... other routers
 * });
 * ```
 */
export function createTodoRouter(store: TodoStore) {
  return router({
    /**
     * List todos with optional status filter.
     *
     * @example
     * ```typescript
     * // Get all todos
     * const all = await client.todos.list.query();
     *
     * // Get only pending todos
     * const pending = await client.todos.list.query({ status: 'pending' });
     * ```
     */
    list: publicProcedure.input(listInputSchema).query(async ({ input }) => {
      return store.list(input.status);
    }),

    /**
     * Get a single todo by ID.
     *
     * @throws {TRPCError} NOT_FOUND if the todo doesn't exist
     *
     * @example
     * ```typescript
     * const todo = await client.todos.get.query({ id: 'todo-123' });
     * ```
     */
    get: publicProcedure.input(idInputSchema).query(async ({ input }) => {
      const todo = await store.get(input.id);
      if (!todo) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Todo not found: ${input.id}`,
        });
      }
      return todo;
    }),

    /**
     * Create a new todo.
     *
     * @example
     * ```typescript
     * const todo = await client.todos.create.mutate({
     *   title: 'Buy milk',
     *   noteId: 'note-123', // optional
     * });
     * ```
     */
    create: publicProcedure.input(createInputSchema).mutation(async ({ input }) => {
      return store.create(input);
    }),

    /**
     * Update an existing todo.
     *
     * @throws {TRPCError} NOT_FOUND if the todo doesn't exist
     *
     * @example
     * ```typescript
     * const updated = await client.todos.update.mutate({
     *   id: 'todo-123',
     *   title: 'Buy oat milk',
     *   completed: true,
     * });
     * ```
     */
    update: publicProcedure.input(updateInputSchema).mutation(async ({ input }) => {
      try {
        return await store.update(input);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),

    /**
     * Toggle a todo's completion status.
     *
     * @throws {TRPCError} NOT_FOUND if the todo doesn't exist
     *
     * @example
     * ```typescript
     * const toggled = await client.todos.toggle.mutate({ id: 'todo-123' });
     * console.log(toggled.completed); // true -> false or false -> true
     * ```
     */
    toggle: publicProcedure.input(idInputSchema).mutation(async ({ input }) => {
      try {
        return await store.toggle(input.id);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        throw error;
      }
    }),

    /**
     * Delete a todo.
     *
     * @returns Object with success status
     *
     * @example
     * ```typescript
     * const result = await client.todos.delete.mutate({ id: 'todo-123' });
     * console.log(result.success); // true
     * ```
     */
    delete: publicProcedure.input(idInputSchema).mutation(async ({ input }) => {
      await store.delete(input.id);
      return { success: true };
    }),
  });
}

/**
 * Type of the Todo router returned by createTodoRouter.
 *
 * Export this type for client-side type inference.
 *
 * @example
 * ```typescript
 * // In client code
 * import type { TodoRouter } from '@scribe/plugin-todo';
 *
 * // Use with tRPC client for full type safety
 * const client = usePluginClient<TodoRouter>();
 * ```
 */
export type TodoRouter = ReturnType<typeof createTodoRouter>;
