/**
 * Task Slash Command Handler
 *
 * Implements the /task slash command for quickly creating todos from the editor.
 * When triggered, it creates a todo via the API and inserts a reference in the note.
 *
 * @module
 */

import type { SlashCommandHandler, SlashCommandArgs } from '@scribe/plugin-core';
import type { Todo, CreateTodoInput } from '../shared/types.js';

/**
 * Minimal tRPC client interface for todo operations.
 * Matches the structure exposed by client.api.todos.*
 */
interface TodosClient {
  create: {
    mutate: (input: CreateTodoInput) => Promise<Todo>;
  };
}

/**
 * Context required for the task command handler.
 * Includes toast for notifications and the tRPC client.
 */
interface TaskCommandContext {
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;
  client: { api: { todos: TodosClient } };
}

/**
 * Hook injector for accessing the Scribe client.
 * This allows the handler to work in both production and test environments.
 */
let _useScribeClient: (() => { api: { todos: TodosClient } }) | null = null;

/**
 * Toast function injector.
 * This allows the handler to show toast notifications.
 */
let _toastFn: ((message: string, type?: 'info' | 'success' | 'error') => void) | null = null;

/**
 * Set the hook for accessing the Scribe client.
 * Called during client plugin initialization.
 *
 * @param hook - The useScribeClient hook from the app
 */
export function setTaskCommandClient(hook: () => { api: { todos: TodosClient } }): void {
  _useScribeClient = hook;
}

/**
 * Set the toast function.
 * Called during slash command execution.
 *
 * @param toastFn - The toast function from SlashCommandContext
 */
export function setTaskCommandToast(
  toastFn: (message: string, type?: 'info' | 'success' | 'error') => void
): void {
  _toastFn = toastFn;
}

/**
 * Get the task command context.
 *
 * @returns The context with client and toast
 * @throws If client hook is not initialized
 */
function getContext(): TaskCommandContext {
  if (!_useScribeClient) {
    throw new Error('useScribeClient hook not initialized. Call setTaskCommandClient first.');
  }

  const toast =
    _toastFn ??
    (() => {
      // No-op toast if not set
    });

  return {
    client: _useScribeClient(),
    toast,
  };
}

/**
 * Format a task reference to insert in the editor.
 *
 * Creates a simple text representation of the task that can be inserted
 * at the cursor position. In the future, this could be a custom Lexical node.
 *
 * @param task - The created todo
 * @returns Formatted text to insert
 */
function formatTaskReference(task: Todo): string {
  // Insert a checkbox-style reference with the task title
  return `☐ ${task.title}`;
}

/**
 * Task slash command handler.
 *
 * Creates a new todo item when the /task command is executed.
 *
 * Supports two flows:
 * 1. Quick creation: `/task Buy milk` - creates task with title "Buy milk"
 * 2. Prompted creation: `/task` alone - (future: show prompt for title)
 *
 * After creating the task:
 * - Associates it with the current note (if editing one)
 * - Inserts a task reference at the cursor position
 * - Shows a success toast notification
 *
 * @example
 * ```typescript
 * // Usage in manifest
 * slashCommands: {
 *   'task': taskCommandHandler,
 * }
 * ```
 */
export const taskCommandHandler: SlashCommandHandler = {
  async execute(args: SlashCommandArgs): Promise<void> {
    const { text, noteId, insertContent } = args;
    const { client, toast } = getContext();

    // If no text provided, show an error (future: prompt for title)
    const title = text.trim();
    if (!title) {
      toast('Please provide a task title: /task Your task here', 'error');
      return;
    }

    try {
      // Create the task via API
      const task = await client.api.todos.create.mutate({
        title,
        noteId: noteId || undefined,
      });

      // Insert a reference in the editor
      const reference = formatTaskReference(task);
      insertContent(reference);

      // Show success notification
      toast(`Task created: ${title}`, 'success');
    } catch (error) {
      // Handle errors gracefully
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast(`Failed to create task: ${message}`, 'error');
      throw error;
    }
  },
};

/**
 * Create a task command handler with injected dependencies.
 *
 * This factory function allows creating handlers with specific client
 * and toast implementations, useful for testing and different environments.
 *
 * @param context - The context with client and toast
 * @returns A SlashCommandHandler instance
 *
 * @example
 * ```typescript
 * // For testing
 * const mockClient = createMockClient();
 * const mockToast = vi.fn();
 * const handler = createTaskCommandHandler({
 *   client: mockClient,
 *   toast: mockToast,
 * });
 * ```
 */
export function createTaskCommandHandler(context: TaskCommandContext): SlashCommandHandler {
  return {
    async execute(args: SlashCommandArgs): Promise<void> {
      const { text, noteId, insertContent } = args;
      const { client, toast } = context;

      const title = text.trim();
      if (!title) {
        toast('Please provide a task title: /task Your task here', 'error');
        return;
      }

      try {
        const task = await client.api.todos.create.mutate({
          title,
          noteId: noteId || undefined,
        });

        const reference = formatTaskReference(task);
        insertContent(reference);

        toast(`Task created: ${title}`, 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast(`Failed to create task: ${message}`, 'error');
        throw error;
      }
    },
  };
}
