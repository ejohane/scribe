/**
 * Task Slash Command Tests
 *
 * Tests for the /task slash command handler.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SlashCommandArgs } from '@scribe/plugin-core';
import type { Todo } from '../shared/types.js';
import {
  taskCommandHandler,
  createTaskCommandHandler,
  setTaskCommandClient,
  setTaskCommandToast,
} from './taskSlashCommand.js';

// Mock todo data
const mockTodo: Todo = {
  id: 'todo-1',
  title: 'Buy milk',
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

describe('taskCommandHandler', () => {
  let mockInsertContent: ReturnType<typeof vi.fn>;
  let mockToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertContent = vi.fn();
    mockToast = vi.fn();

    // Set up the client and toast injectors
    setTaskCommandClient(mockUseScribeClient);
    setTaskCommandToast(mockToast);

    // Default mock implementation
    mockTodosClient.create.mutate.mockResolvedValue(mockTodo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('task creation', () => {
    it('creates a task with the provided text', async () => {
      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockTodosClient.create.mutate).toHaveBeenCalledWith({
        title: 'Buy milk',
        noteId: 'note-1',
      });
    });

    it('trims whitespace from the task title', async () => {
      const args: SlashCommandArgs = {
        text: '  Buy groceries  ',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockTodosClient.create.mutate).toHaveBeenCalledWith({
        title: 'Buy groceries',
        noteId: 'note-1',
      });
    });

    it('creates a task without noteId when not provided', async () => {
      const args: SlashCommandArgs = {
        text: 'General task',
        noteId: '',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockTodosClient.create.mutate).toHaveBeenCalledWith({
        title: 'General task',
        noteId: undefined,
      });
    });

    it('inserts a task reference in the editor after creation', async () => {
      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockInsertContent).toHaveBeenCalledWith('☐ Buy milk');
    });

    it('shows a success toast after creating a task', async () => {
      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockToast).toHaveBeenCalledWith('Task created: Buy milk', 'success');
    });
  });

  describe('error handling', () => {
    it('shows error toast when no title is provided', async () => {
      const args: SlashCommandArgs = {
        text: '',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockToast).toHaveBeenCalledWith(
        'Please provide a task title: /task Your task here',
        'error'
      );
      expect(mockTodosClient.create.mutate).not.toHaveBeenCalled();
      expect(mockInsertContent).not.toHaveBeenCalled();
    });

    it('shows error toast when only whitespace is provided', async () => {
      const args: SlashCommandArgs = {
        text: '   ',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await taskCommandHandler.execute(args);

      expect(mockToast).toHaveBeenCalledWith(
        'Please provide a task title: /task Your task here',
        'error'
      );
      expect(mockTodosClient.create.mutate).not.toHaveBeenCalled();
    });

    it('shows error toast and rethrows when API call fails', async () => {
      mockTodosClient.create.mutate.mockRejectedValue(new Error('Network error'));

      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await expect(taskCommandHandler.execute(args)).rejects.toThrow('Network error');

      expect(mockToast).toHaveBeenCalledWith('Failed to create task: Network error', 'error');
      expect(mockInsertContent).not.toHaveBeenCalled();
    });

    it('handles non-Error exceptions', async () => {
      mockTodosClient.create.mutate.mockRejectedValue('String error');

      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await expect(taskCommandHandler.execute(args)).rejects.toThrow();

      expect(mockToast).toHaveBeenCalledWith('Failed to create task: Unknown error', 'error');
    });

    it('throws when client is not initialized', async () => {
      // Reset the client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTaskCommandClient(null as any);

      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      await expect(taskCommandHandler.execute(args)).rejects.toThrow(
        'useScribeClient hook not initialized'
      );
    });
  });

  describe('edge cases', () => {
    it('works without toast function set', async () => {
      // Reset toast (should use no-op)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTaskCommandToast(null as any);

      const args: SlashCommandArgs = {
        text: 'Buy milk',
        noteId: 'note-1',
        insertContent: mockInsertContent,
      };

      // Should not throw
      await taskCommandHandler.execute(args);

      expect(mockTodosClient.create.mutate).toHaveBeenCalled();
      expect(mockInsertContent).toHaveBeenCalled();
    });
  });
});

describe('createTaskCommandHandler', () => {
  let mockInsertContent: ReturnType<typeof vi.fn>;
  let mockToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertContent = vi.fn();
    mockToast = vi.fn();
    mockTodosClient.create.mutate.mockResolvedValue(mockTodo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a handler with injected dependencies', async () => {
    const handler = createTaskCommandHandler({
      client: mockClientObject,
      toast: mockToast,
    });

    const args: SlashCommandArgs = {
      text: 'Buy milk',
      noteId: 'note-1',
      insertContent: mockInsertContent,
    };

    await handler.execute(args);

    expect(mockTodosClient.create.mutate).toHaveBeenCalledWith({
      title: 'Buy milk',
      noteId: 'note-1',
    });
    expect(mockInsertContent).toHaveBeenCalledWith('☐ Buy milk');
    expect(mockToast).toHaveBeenCalledWith('Task created: Buy milk', 'success');
  });

  it('handles errors with injected toast', async () => {
    mockTodosClient.create.mutate.mockRejectedValue(new Error('API error'));

    const handler = createTaskCommandHandler({
      client: mockClientObject,
      toast: mockToast,
    });

    const args: SlashCommandArgs = {
      text: 'Buy milk',
      noteId: 'note-1',
      insertContent: mockInsertContent,
    };

    await expect(handler.execute(args)).rejects.toThrow('API error');
    expect(mockToast).toHaveBeenCalledWith('Failed to create task: API error', 'error');
  });

  it('shows error when no title provided', async () => {
    const handler = createTaskCommandHandler({
      client: mockClientObject,
      toast: mockToast,
    });

    const args: SlashCommandArgs = {
      text: '',
      noteId: 'note-1',
      insertContent: mockInsertContent,
    };

    await handler.execute(args);

    expect(mockToast).toHaveBeenCalledWith(
      'Please provide a task title: /task Your task here',
      'error'
    );
  });
});

describe('setTaskCommandClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows setting a custom client hook', async () => {
    const customClient = {
      api: {
        todos: {
          create: {
            mutate: vi.fn().mockResolvedValue({ ...mockTodo, title: 'Custom task' }),
          },
        },
      },
    };

    setTaskCommandClient(() => customClient);
    setTaskCommandToast(vi.fn());

    const args: SlashCommandArgs = {
      text: 'Custom task',
      noteId: 'note-1',
      insertContent: vi.fn(),
    };

    await taskCommandHandler.execute(args);

    expect(customClient.api.todos.create.mutate).toHaveBeenCalled();
  });
});

describe('setTaskCommandToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTaskCommandClient(mockUseScribeClient);
    mockTodosClient.create.mutate.mockResolvedValue(mockTodo);
  });

  it('allows setting a custom toast function', async () => {
    const customToast = vi.fn();
    setTaskCommandToast(customToast);

    const args: SlashCommandArgs = {
      text: 'Buy milk',
      noteId: 'note-1',
      insertContent: vi.fn(),
    };

    await taskCommandHandler.execute(args);

    expect(customToast).toHaveBeenCalledWith('Task created: Buy milk', 'success');
  });
});
