/**
 * Create Task Command Palette Handler Tests
 *
 * Tests for the todo.createTask command palette command.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CommandContext } from '@scribe/plugin-core';
import type { Todo } from '../shared/types.js';
import { setCommandPaletteClient, createClientPlugin } from './index.js';

// Mock todo data
const mockTodo: Todo = {
  id: 'todo-1',
  title: 'New Task',
  completed: false,
  noteId: 'note-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Mock tRPC client
const mockTodosClient = {
  create: {
    mutate: vi.fn(),
  },
};

const mockClientObject = {
  api: {
    todos: mockTodosClient,
  },
};

const mockUseScribeClient = vi.fn(() => mockClientObject);

describe('createTaskHandler (command palette)', () => {
  let mockToast: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast = vi.fn();
    mockNavigate = vi.fn();

    // Set up the client injector
    setCommandPaletteClient(mockUseScribeClient);

    // Default mock implementation
    mockTodosClient.create.mutate.mockResolvedValue(mockTodo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getCreateTaskHandler() {
    const plugin = createClientPlugin({ manifest: {} as never, client: {} as never });
    const handler = plugin.commandPaletteCommands?.['todo.createTask'];
    if (!handler) {
      throw new Error('createTask handler not found');
    }
    return handler;
  }

  describe('task creation', () => {
    it('creates a task with default title', async () => {
      const handler = getCreateTaskHandler();
      const ctx: CommandContext = {
        noteId: 'note-1',
        navigate: mockNavigate,
        toast: mockToast,
      };

      await handler.execute(ctx);

      expect(mockTodosClient.create.mutate).toHaveBeenCalledWith({
        title: 'New Task',
        noteId: 'note-1',
      });
    });

    it('creates a task without noteId when no note is open', async () => {
      const handler = getCreateTaskHandler();
      const ctx: CommandContext = {
        noteId: null,
        navigate: mockNavigate,
        toast: mockToast,
      };

      await handler.execute(ctx);

      expect(mockTodosClient.create.mutate).toHaveBeenCalledWith({
        title: 'New Task',
        noteId: undefined,
      });
    });

    it('shows success toast after creating a task', async () => {
      const handler = getCreateTaskHandler();
      const ctx: CommandContext = {
        noteId: 'note-1',
        navigate: mockNavigate,
        toast: mockToast,
      };

      await handler.execute(ctx);

      expect(mockToast).toHaveBeenCalledWith('Task created!', 'success');
    });
  });

  describe('error handling', () => {
    it('shows error toast when client is not initialized', async () => {
      // Reset the client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCommandPaletteClient(null as any);

      const handler = getCreateTaskHandler();
      const ctx: CommandContext = {
        noteId: 'note-1',
        navigate: mockNavigate,
        toast: mockToast,
      };

      await handler.execute(ctx);

      expect(mockToast).toHaveBeenCalledWith('Todo plugin not initialized', 'error');
      expect(mockTodosClient.create.mutate).not.toHaveBeenCalled();
    });

    it('shows error toast when API call fails', async () => {
      mockTodosClient.create.mutate.mockRejectedValue(new Error('Network error'));

      const handler = getCreateTaskHandler();
      const ctx: CommandContext = {
        noteId: 'note-1',
        navigate: mockNavigate,
        toast: mockToast,
      };

      await handler.execute(ctx);

      expect(mockToast).toHaveBeenCalledWith('Failed to create task: Network error', 'error');
    });

    it('handles non-Error exceptions', async () => {
      mockTodosClient.create.mutate.mockRejectedValue('String error');

      const handler = getCreateTaskHandler();
      const ctx: CommandContext = {
        noteId: 'note-1',
        navigate: mockNavigate,
        toast: mockToast,
      };

      await handler.execute(ctx);

      expect(mockToast).toHaveBeenCalledWith('Failed to create task: Unknown error', 'error');
    });
  });
});

describe('setCommandPaletteClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows setting a custom client hook', async () => {
    const customTodo: Todo = { ...mockTodo, title: 'Custom task' };
    const customClient = {
      api: {
        todos: {
          create: {
            mutate: vi.fn().mockResolvedValue(customTodo),
          },
        },
      },
    };

    setCommandPaletteClient(() => customClient);

    const plugin = createClientPlugin({ manifest: {} as never, client: {} as never });
    const handler = plugin.commandPaletteCommands?.['todo.createTask'];

    const ctx: CommandContext = {
      noteId: 'note-1',
      navigate: vi.fn(),
      toast: vi.fn(),
    };

    await handler?.execute(ctx);

    expect(customClient.api.todos.create.mutate).toHaveBeenCalled();
    expect(ctx.toast).toHaveBeenCalledWith('Task created!', 'success');
  });
});

describe('createClientPlugin command registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCommandPaletteClient(mockUseScribeClient);
    mockTodosClient.create.mutate.mockResolvedValue(mockTodo);
  });

  it('registers the todo.createTask command', () => {
    const plugin = createClientPlugin({ manifest: {} as never, client: {} as never });

    expect(plugin.commandPaletteCommands).toBeDefined();
    expect(plugin.commandPaletteCommands?.['todo.createTask']).toBeDefined();
    expect(typeof plugin.commandPaletteCommands?.['todo.createTask'].execute).toBe('function');
  });

  it('registers the todo.viewTasks command', () => {
    const plugin = createClientPlugin({ manifest: {} as never, client: {} as never });

    expect(plugin.commandPaletteCommands).toBeDefined();
    expect(plugin.commandPaletteCommands?.['todo.viewTasks']).toBeDefined();
    expect(typeof plugin.commandPaletteCommands?.['todo.viewTasks'].execute).toBe('function');
  });
});
