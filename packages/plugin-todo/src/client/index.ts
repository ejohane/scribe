/**
 * Client-side Todo Plugin
 *
 * Exports the client plugin factory and components for the Todo plugin.
 *
 * @module
 */

import type {
  ClientPlugin,
  ClientPluginContext,
  CommandPaletteCommandHandler,
  CommandContext,
} from '@scribe/plugin-core';
import { manifest } from '../shared/manifest.js';
import { TasksSidebarPanel, setUseScribeClient } from './TasksSidebarPanel.js';
import { taskCommandHandler, setTaskCommandClient } from './taskSlashCommand.js';
import type { Todo, CreateTodoInput } from '../shared/types.js';

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
/**
 * Minimal tRPC client interface for todo operations in command palette commands.
 */
interface TodosClient {
  create: {
    mutate: (input: CreateTodoInput) => Promise<Todo>;
  };
}

/**
 * Hook injector for accessing the Scribe client in command palette commands.
 */
let _commandPaletteClient: (() => { api: { todos: TodosClient } }) | null = null;

/**
 * Set the hook for accessing the Scribe client in command palette commands.
 * Called during client plugin initialization.
 *
 * @param hook - The useScribeClient hook from the app
 */
export function setCommandPaletteClient(hook: () => { api: { todos: TodosClient } }): void {
  _commandPaletteClient = hook;
}

/**
 * Command handler for viewing tasks via command palette.
 *
 * Opens the sidebar or navigates to tasks view and shows a toast confirmation.
 */
const viewTasksHandler: CommandPaletteCommandHandler = {
  execute(ctx) {
    ctx.toast('Opening tasks panel', 'info');
    // Note: Actual sidebar panel opening would be handled by the UI layer
    // This command serves as a test/demo of command palette integration
  },
};

/**
 * Command handler for creating a task via command palette.
 *
 * Creates a new task associated with the current note (if one is open).
 * Shows a success toast on completion.
 */
const createTaskHandler: CommandPaletteCommandHandler = {
  async execute(ctx: CommandContext): Promise<void> {
    if (!_commandPaletteClient) {
      ctx.toast('Todo plugin not initialized', 'error');
      return;
    }

    try {
      const client = _commandPaletteClient();
      await client.api.todos.create.mutate({
        title: 'New Task',
        noteId: ctx.noteId || undefined,
      });
      ctx.toast('Task created!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      ctx.toast(`Failed to create task: ${message}`, 'error');
    }
  },
};

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
    commandPaletteCommands: {
      'todo.viewTasks': viewTasksHandler,
      'todo.createTask': createTaskHandler,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setCommandPaletteClient(useScribeClient as any);
}
