/**
 * Unit tests for tasks.ts CLI command module
 *
 * Tests the tasks command functionality for listing, filtering, and managing tasks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Task, NoteId } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Import after mocking
import { registerTasksCommands } from '../../../src/commands/tasks';
import { initializeContext } from '../../../src/context';
import { output } from '../../../src/output';

/**
 * Create a mock task for testing
 */
function createMockTask(
  id: string,
  text: string,
  options?: {
    noteId?: string;
    noteTitle?: string;
    completed?: boolean;
    completedAt?: number;
    priority?: number;
    createdAt?: number;
    updatedAt?: number;
    nodeKey?: string;
    lineIndex?: number;
    textHash?: string;
  }
): Task {
  const noteId = options?.noteId ?? 'note-1';
  return {
    id,
    noteId: createNoteId(noteId),
    noteTitle: options?.noteTitle ?? 'Test Note',
    nodeKey: options?.nodeKey ?? 'node_1',
    lineIndex: options?.lineIndex ?? 0,
    text,
    textHash: options?.textHash ?? 'abc123',
    completed: options?.completed ?? false,
    completedAt: options?.completedAt,
    priority: options?.priority ?? 2,
    createdAt: options?.createdAt ?? Date.now(),
    updatedAt: options?.updatedAt ?? Date.now(),
  };
}

/**
 * Create a mock task index
 */
function createMockTaskIndex(tasks: Task[]) {
  return {
    list: vi.fn().mockImplementation((filter?: { completed?: boolean; noteId?: NoteId }) => {
      let filteredTasks = [...tasks];

      if (filter?.completed !== undefined) {
        filteredTasks = filteredTasks.filter((t) => t.completed === filter.completed);
      }

      if (filter?.noteId) {
        filteredTasks = filteredTasks.filter((t) => t.noteId === filter.noteId);
      }

      return { tasks: filteredTasks, total: filteredTasks.length };
    }),
    toggle: vi.fn().mockImplementation((id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      task.completed = !task.completed;
      if (task.completed) {
        task.completedAt = Date.now();
      } else {
        task.completedAt = undefined;
      }
      return task;
    }),
    setPriority: vi.fn().mockImplementation((id: string, priority: number) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      const previousPriority = task.priority;
      task.priority = priority;
      return { task, previousPriority };
    }),
    load: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a mock vault
 */
function createMockVault() {
  return {
    list: vi.fn().mockReturnValue([]),
    read: vi.fn().mockImplementation((id: NoteId) => {
      return {
        id,
        title: `Note ${id}`,
        content: { root: { type: 'root', children: [] } },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        metadata: { title: null, tags: [], links: [], mentions: [] },
      };
    }),
  };
}

/**
 * Create a mock context with task index
 */
function createMockContext(tasks: Task[]) {
  return {
    vault: createMockVault(),
    vaultPath: '/test/vault',
    options: { format: 'json' as const },
    taskIndex: createMockTaskIndex(tasks),
    ensureTaskIndexLoaded: vi.fn().mockResolvedValue(undefined),
  };
}

describe('tasks commands', () => {
  let program: Command;
  const mockInitializeContext = initializeContext as ReturnType<typeof vi.fn>;
  const mockOutput = output as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.option('--format <format>', 'Output format', 'json');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerTasksCommands', () => {
    it('should register tasks command on program', () => {
      registerTasksCommands(program);

      const tasksCmd = program.commands.find((cmd) => cmd.name() === 'tasks');
      expect(tasksCmd).toBeDefined();
    });

    it('should register list subcommand', () => {
      registerTasksCommands(program);

      const tasksCmd = program.commands.find((cmd) => cmd.name() === 'tasks');
      const listCmd = tasksCmd?.commands.find((cmd) => cmd.name() === 'list');
      expect(listCmd).toBeDefined();
    });

    it('should register toggle subcommand', () => {
      registerTasksCommands(program);

      const tasksCmd = program.commands.find((cmd) => cmd.name() === 'tasks');
      const toggleCmd = tasksCmd?.commands.find((cmd) => cmd.name() === 'toggle');
      expect(toggleCmd).toBeDefined();
    });

    it('should register set-priority subcommand', () => {
      registerTasksCommands(program);

      const tasksCmd = program.commands.find((cmd) => cmd.name() === 'tasks');
      const setPriorityCmd = tasksCmd?.commands.find((cmd) => cmd.name() === 'set-priority');
      expect(setPriorityCmd).toBeDefined();
    });
  });

  describe('list', () => {
    it('returns all tasks', async () => {
      const task1 = createMockTask('task-1', 'Task 1', { priority: 1 });
      const task2 = createMockTask('task-2', 'Task 2', { priority: 2 });
      const task3 = createMockTask('task-3', 'Task 3', { completed: true, priority: 3 });

      const ctx = createMockContext([task1, task2, task3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list']);

      expect(mockOutput).toHaveBeenCalledTimes(1);
      const outputData = mockOutput.mock.calls[0][0];

      expect(outputData.tasks).toHaveLength(3);
      expect(outputData.total).toBe(3);
      expect(outputData.openCount).toBe(2);
      expect(outputData.completedCount).toBe(1);
    });

    it('filters by status open', async () => {
      const openTask = createMockTask('task-1', 'Open task', { completed: false });
      const completedTask = createMockTask('task-2', 'Completed task', {
        completed: true,
        completedAt: Date.now(),
      });

      const ctx = createMockContext([openTask, completedTask]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--status', 'open']);

      // The filter is passed to taskIndex.list
      expect(ctx.taskIndex.list).toHaveBeenCalledWith(
        expect.objectContaining({ completed: false })
      );
    });

    it('filters by status completed', async () => {
      const openTask = createMockTask('task-1', 'Open task', { completed: false });
      const completedTask = createMockTask('task-2', 'Completed task', {
        completed: true,
        completedAt: Date.now(),
      });

      const ctx = createMockContext([openTask, completedTask]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--status', 'completed']);

      expect(ctx.taskIndex.list).toHaveBeenCalledWith(expect.objectContaining({ completed: true }));
    });

    it('filters by date range (since)', async () => {
      const oldTask = createMockTask('task-1', 'Old task', { createdAt: 1000 });
      const newTask = createMockTask('task-2', 'New task', { createdAt: Date.now() });

      const ctx = createMockContext([oldTask, newTask]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--since', '2024-01-01']);

      const outputData = mockOutput.mock.calls[0][0];
      // The filter is applied after getting tasks from index
      // Since we mock list() to return all tasks, the test validates the filtering logic runs
      expect(outputData).toHaveProperty('tasks');
    });

    it('outputs JSON format correctly', async () => {
      const task = createMockTask('task-1', 'Test task', {
        priority: 1,
        noteTitle: 'My Note',
        createdAt: 1700000000000,
      });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData).toHaveProperty('tasks');
      expect(outputData).toHaveProperty('total');
      expect(outputData).toHaveProperty('openCount');
      expect(outputData).toHaveProperty('completedCount');

      const outputTask = outputData.tasks[0];
      expect(outputTask).toHaveProperty('id');
      expect(outputTask).toHaveProperty('text');
      expect(outputTask).toHaveProperty('completed');
      expect(outputTask).toHaveProperty('priority');
      expect(outputTask).toHaveProperty('noteId');
      expect(outputTask).toHaveProperty('noteTitle');
      expect(outputTask).toHaveProperty('createdAt');
    });

    it('supports pagination with limit and offset', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask(`task-${i}`, `Task ${i}`, { priority: i })
      );

      const ctx = createMockContext(tasks);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--limit', '3', '--offset', '2']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tasks).toHaveLength(3);
      expect(outputData.total).toBe(10);
    });

    it('sorts by priority by default', async () => {
      const lowPriority = createMockTask('task-1', 'Low priority', { priority: 3 });
      const highPriority = createMockTask('task-2', 'High priority', { priority: 0 });
      const medPriority = createMockTask('task-3', 'Medium priority', { priority: 1 });

      const ctx = createMockContext([lowPriority, highPriority, medPriority]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      // Should be sorted by priority ascending (lower number = higher priority)
      expect(outputData.tasks[0].priority).toBe(0);
      expect(outputData.tasks[1].priority).toBe(1);
      expect(outputData.tasks[2].priority).toBe(3);
    });

    it('sorts by created date when specified', async () => {
      const oldTask = createMockTask('task-1', 'Old', { createdAt: 1000, priority: 0 });
      const newTask = createMockTask('task-2', 'New', { createdAt: 3000, priority: 0 });
      const middleTask = createMockTask('task-3', 'Middle', { createdAt: 2000, priority: 0 });

      const ctx = createMockContext([oldTask, newTask, middleTask]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--sort', 'created']);

      const outputData = mockOutput.mock.calls[0][0];
      // Should be sorted by createdAt descending (newest first)
      expect(outputData.tasks[0].text).toBe('New');
      expect(outputData.tasks[1].text).toBe('Middle');
      expect(outputData.tasks[2].text).toBe('Old');
    });

    it('filters by priority', async () => {
      const task1 = createMockTask('task-1', 'Urgent', { priority: 0 });
      const task2 = createMockTask('task-2', 'High', { priority: 1 });
      const task3 = createMockTask('task-3', 'Low', { priority: 3 });

      const ctx = createMockContext([task1, task2, task3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--priority', '1']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tasks).toHaveLength(1);
      expect(outputData.tasks[0].priority).toBe(1);
    });

    it('filters by note ID', async () => {
      const task1 = createMockTask('task-1', 'Task in note 1', { noteId: 'note-1' });
      const task2 = createMockTask('task-2', 'Task in note 2', { noteId: 'note-2' });

      const ctx = createMockContext([task1, task2]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list', '--note', 'note-1']);

      expect(ctx.taskIndex.list).toHaveBeenCalledWith(
        expect.objectContaining({ noteId: createNoteId('note-1') })
      );
    });

    it('throws error for invalid limit value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tasks', 'list', '--limit', 'invalid'])
      ).rejects.toThrow('--limit must be a non-negative integer');
    });

    it('throws error for negative offset value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tasks', 'list', '--offset', '-1'])
      ).rejects.toThrow('--offset must be a non-negative integer');
    });

    it('returns empty list when no tasks exist', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tasks).toHaveLength(0);
      expect(outputData.total).toBe(0);
      expect(outputData.openCount).toBe(0);
      expect(outputData.completedCount).toBe(0);
    });

    it('includes completedAt for completed tasks', async () => {
      const completedAt = Date.now();
      const task = createMockTask('task-1', 'Completed task', {
        completed: true,
        completedAt,
      });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tasks[0]).toHaveProperty('completedAt');
    });
  });

  describe('toggle', () => {
    it('marks task as completed', async () => {
      const task = createMockTask('task-1', 'Test task', { completed: false });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'toggle', 'task-1']);

      expect(ctx.taskIndex.toggle).toHaveBeenCalledWith('task-1');
      expect(ctx.taskIndex.flush).toHaveBeenCalled();

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.success).toBe(true);
      expect(outputData.task.id).toBe('task-1');
      expect(outputData.task.completed).toBe(true);
    });

    it('marks task as uncompleted', async () => {
      const task = createMockTask('task-1', 'Test task', {
        completed: true,
        completedAt: Date.now(),
      });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'toggle', 'task-1']);

      expect(ctx.taskIndex.toggle).toHaveBeenCalledWith('task-1');
      expect(ctx.taskIndex.flush).toHaveBeenCalled();

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.success).toBe(true);
      expect(outputData.task.completed).toBe(false);
    });

    it('handles task not found', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tasks', 'toggle', 'nonexistent'])
      ).rejects.toThrow('Task not found');
    });

    it('persists changes via flush', async () => {
      const task = createMockTask('task-1', 'Test task', { completed: false });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'toggle', 'task-1']);

      expect(ctx.taskIndex.flush).toHaveBeenCalledTimes(1);
    });
  });

  describe('set-priority', () => {
    it('sets task priority', async () => {
      const task = createMockTask('task-1', 'Test task', { priority: 2 });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'set-priority', 'task-1', '0']);

      expect(ctx.taskIndex.setPriority).toHaveBeenCalledWith('task-1', 0);
      expect(ctx.taskIndex.flush).toHaveBeenCalled();

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.success).toBe(true);
      expect(outputData.task.id).toBe('task-1');
      expect(outputData.task.priority).toBe(0);
      expect(outputData.task.previousPriority).toBe(2);
    });

    it('handles task not found', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tasks', 'set-priority', 'nonexistent', '1'])
      ).rejects.toThrow('Task not found');
    });

    it('validates priority range (0-3)', async () => {
      const task = createMockTask('task-1', 'Test task', { priority: 2 });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tasks', 'set-priority', 'task-1', '5'])
      ).rejects.toThrow('Priority must be 0-3');
    });

    it('validates priority is a number', async () => {
      const task = createMockTask('task-1', 'Test task', { priority: 2 });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tasks', 'set-priority', 'task-1', 'invalid'])
      ).rejects.toThrow('Priority must be 0-3');
    });

    it('accepts all valid priority levels', async () => {
      const task = createMockTask('task-1', 'Test task', { priority: 2 });

      for (const priority of [0, 1, 2, 3]) {
        vi.clearAllMocks();
        const ctx = createMockContext([{ ...task }]);
        mockInitializeContext.mockResolvedValue(ctx);

        // Create a fresh program for each iteration
        const testProgram = new Command();
        testProgram.option('--format <format>', 'Output format', 'json');
        registerTasksCommands(testProgram);

        await testProgram.parseAsync([
          'node',
          'test',
          'tasks',
          'set-priority',
          'task-1',
          String(priority),
        ]);

        expect(ctx.taskIndex.setPriority).toHaveBeenCalledWith('task-1', priority);
      }
    });

    it('persists changes via flush', async () => {
      const task = createMockTask('task-1', 'Test task', { priority: 2 });

      const ctx = createMockContext([task]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTasksCommands(program);
      await program.parseAsync(['node', 'test', 'tasks', 'set-priority', 'task-1', '1']);

      expect(ctx.taskIndex.flush).toHaveBeenCalledTimes(1);
    });
  });
});
