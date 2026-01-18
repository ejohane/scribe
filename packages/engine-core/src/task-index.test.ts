/**
 * TaskIndex unit tests
 *
 * Tests for:
 * - Pure helper functions (buildExistingTaskMap, findOldTaskId, findOrphanedTaskIds)
 * - Reconciliation rules (nodeKey first, textHash fallback)
 * - Priority assignment for new tasks
 * - completedAt handling (set when checked, clear when unchecked)
 * - Pagination support with cursor-based paging
 * - JSONL persistence (atomic temp+rename, debounced writes)
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  TaskIndex,
  buildExistingTaskMap,
  findOldTaskId,
  findOrphanedTaskIds,
} from './task-index.js';
import type { Note, EditorContent, Task } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  },
}));

const mockFs = {
  readFile: fs.readFile as Mock,
  writeFile: fs.writeFile as Mock,
  rename: fs.rename as Mock,
  mkdir: fs.mkdir as Mock,
};

/**
 * Create a minimal Lexical state with checklist items.
 */
function createContentWithTasks(
  tasks: Array<{ text: string; checked: boolean; nodeKey: string }>
): EditorContent {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'check',
          children: tasks.map((t) => ({
            type: 'listitem',
            __key: t.nodeKey,
            checked: t.checked,
            children: [
              {
                type: 'text',
                text: t.text,
              },
            ],
          })),
        },
      ],
    },
  };
}

/**
 * Create a minimal note for testing.
 */
function createNote(
  id: string,
  title: string,
  tasks: Array<{ text: string; checked: boolean; nodeKey: string }>
): Note {
  return {
    id: createNoteId(id),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: createContentWithTasks(tasks),
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
  };
}

/**
 * Create a minimal Task for testing helper functions.
 */
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'note1:key1:hash1',
    noteId: createNoteId('note1'),
    noteTitle: 'Test Note',
    nodeKey: 'key1',
    lineIndex: 0,
    text: 'Test task',
    textHash: 'hash1',
    completed: false,
    priority: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ============================================================================
// Pure Helper Function Tests
// ============================================================================

describe('buildExistingTaskMap', () => {
  it('should build a map from task IDs', () => {
    const task1 = createTask({ id: 'task1', nodeKey: 'key1' });
    const task2 = createTask({ id: 'task2', nodeKey: 'key2' });
    const tasks = new Map<string, Task>([
      ['task1', task1],
      ['task2', task2],
    ]);
    const taskIds = new Set(['task1', 'task2']);

    const result = buildExistingTaskMap(tasks, taskIds);

    expect(result.size).toBe(2);
    expect(result.get('task1')).toBe(task1);
    expect(result.get('task2')).toBe(task2);
  });

  it('should handle missing task IDs gracefully', () => {
    const task1 = createTask({ id: 'task1' });
    const tasks = new Map<string, Task>([['task1', task1]]);
    const taskIds = new Set(['task1', 'task2', 'task3']); // task2, task3 don't exist

    const result = buildExistingTaskMap(tasks, taskIds);

    expect(result.size).toBe(1);
    expect(result.get('task1')).toBe(task1);
  });

  it('should return empty map for empty inputs', () => {
    const tasks = new Map<string, Task>();
    const taskIds = new Set<string>();

    const result = buildExistingTaskMap(tasks, taskIds);

    expect(result.size).toBe(0);
  });
});

describe('findOldTaskId', () => {
  it('should return undefined when task ID exists in existingTasks', () => {
    const task = createTask({ id: 'task1', nodeKey: 'key1', textHash: 'hash1' });
    const existingTasks = new Map<string, Task>([['task1', task]]);

    const result = findOldTaskId(task, existingTasks);

    expect(result).toBeUndefined();
  });

  it('should find old task ID by matching nodeKey', () => {
    const newTask = createTask({ id: 'new-id', nodeKey: 'key1', textHash: 'new-hash' });
    const oldTask = createTask({ id: 'old-id', nodeKey: 'key1', textHash: 'old-hash' });
    const existingTasks = new Map<string, Task>([['old-id', oldTask]]);

    const result = findOldTaskId(newTask, existingTasks);

    expect(result).toBe('old-id');
  });

  it('should find old task ID by matching textHash', () => {
    const newTask = createTask({ id: 'new-id', nodeKey: 'new-key', textHash: 'hash1' });
    const oldTask = createTask({ id: 'old-id', nodeKey: 'old-key', textHash: 'hash1' });
    const existingTasks = new Map<string, Task>([['old-id', oldTask]]);

    const result = findOldTaskId(newTask, existingTasks);

    expect(result).toBe('old-id');
  });

  it('should return undefined when no match found', () => {
    const newTask = createTask({ id: 'new-id', nodeKey: 'new-key', textHash: 'new-hash' });
    const oldTask = createTask({ id: 'old-id', nodeKey: 'old-key', textHash: 'old-hash' });
    const existingTasks = new Map<string, Task>([['old-id', oldTask]]);

    const result = findOldTaskId(newTask, existingTasks);

    expect(result).toBeUndefined();
  });

  it('should return undefined for empty existingTasks', () => {
    const task = createTask();
    const existingTasks = new Map<string, Task>();

    const result = findOldTaskId(task, existingTasks);

    expect(result).toBeUndefined();
  });
});

describe('findOrphanedTaskIds', () => {
  it('should return toRemove array as-is', () => {
    const existingIds = new Set(['task1', 'task2', 'task3']);
    const toRemove = ['task2', 'task3'];

    const result = findOrphanedTaskIds(existingIds, toRemove);

    expect(result).toEqual(['task2', 'task3']);
  });

  it('should handle empty toRemove', () => {
    const existingIds = new Set(['task1', 'task2']);
    const toRemove: string[] = [];

    const result = findOrphanedTaskIds(existingIds, toRemove);

    expect(result).toEqual([]);
  });

  it('should handle empty existingIds', () => {
    const existingIds = new Set<string>();
    const toRemove = ['task1'];

    const result = findOrphanedTaskIds(existingIds, toRemove);

    expect(result).toEqual(['task1']);
  });
});

// ============================================================================
// TaskIndex Tests
// ============================================================================

describe('TaskIndex', () => {
  const derivedPath = '/test/derived';
  const persistPath = join(derivedPath, 'tasks.jsonl');
  let index: TaskIndex;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Default: file doesn't exist
    mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);

    // Use short debounce for testing
    index = new TaskIndex(derivedPath, 100);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('load()', () => {
    it('should handle missing file (fresh start)', async () => {
      await expect(index.load()).resolves.not.toThrow();
      expect(index.size).toBe(0);
    });

    it('should load tasks from JSONL file', async () => {
      const task1: Task = {
        id: 'note1:key1:hash1',
        noteId: createNoteId('note1'),
        noteTitle: 'Test Note',
        nodeKey: 'key1',
        lineIndex: 0,
        text: 'Task 1',
        textHash: 'hash1',
        completed: false,
        priority: 0,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const task2: Task = {
        id: 'note2:key2:hash2',
        noteId: createNoteId('note2'),
        noteTitle: 'Another Note',
        nodeKey: 'key2',
        lineIndex: 1,
        text: 'Task 2',
        textHash: 'hash2',
        completed: true,
        completedAt: 2000,
        priority: 1,
        createdAt: 1500,
        updatedAt: 2000,
      };

      mockFs.readFile.mockResolvedValue(`${JSON.stringify(task1)}\n${JSON.stringify(task2)}\n`);

      await index.load();

      expect(index.size).toBe(2);
      expect(index.get('note1:key1:hash1')).toEqual(task1);
      expect(index.get('note2:key2:hash2')).toEqual(task2);
    });

    it('should skip malformed lines', async () => {
      const validTask: Task = {
        id: 'note1:key1:hash1',
        noteId: createNoteId('note1'),
        noteTitle: 'Test Note',
        nodeKey: 'key1',
        lineIndex: 0,
        text: 'Task 1',
        textHash: 'hash1',
        completed: false,
        priority: 0,
        createdAt: 1000,
        updatedAt: 1000,
      };

      mockFs.readFile.mockResolvedValue(
        `${JSON.stringify(validTask)}\n{invalid json}\n${JSON.stringify(validTask)}\n`
      );

      await index.load();

      // Should have loaded the valid task (appears twice)
      expect(index.size).toBe(1);
    });

    it('should build byNote index correctly', async () => {
      const task1: Task = {
        id: 'note1:key1:hash1',
        noteId: createNoteId('note1'),
        noteTitle: 'Test Note',
        nodeKey: 'key1',
        lineIndex: 0,
        text: 'Task 1',
        textHash: 'hash1',
        completed: false,
        priority: 0,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const task2: Task = {
        id: 'note1:key2:hash2',
        noteId: createNoteId('note1'),
        noteTitle: 'Test Note',
        nodeKey: 'key2',
        lineIndex: 1,
        text: 'Task 2',
        textHash: 'hash2',
        completed: false,
        priority: 1,
        createdAt: 1000,
        updatedAt: 1000,
      };

      mockFs.readFile.mockResolvedValue(`${JSON.stringify(task1)}\n${JSON.stringify(task2)}\n`);

      await index.load();

      const noteTaskIds = index.getTaskIdsForNote(createNoteId('note1'));
      expect(noteTaskIds.size).toBe(2);
      expect(noteTaskIds.has('note1:key1:hash1')).toBe(true);
      expect(noteTaskIds.has('note1:key2:hash2')).toBe(true);
    });
  });

  describe('persist()', () => {
    it('should write tasks to temp file and rename', async () => {
      // Index a note to create tasks
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Force immediate persist
      await index.flush();

      expect(mockFs.mkdir).toHaveBeenCalledWith(derivedPath, { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        persistPath + '.tmp',
        expect.stringContaining('"noteId":"note1"'),
        'utf-8'
      );
      expect(mockFs.rename).toHaveBeenCalledWith(persistPath + '.tmp', persistPath);
    });

    it('should not persist when not dirty', async () => {
      await index.persist();

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should schedule debounced persist', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Should not have persisted yet
      expect(mockFs.writeFile).not.toHaveBeenCalled();

      // Advance time past debounce
      await vi.advanceTimersByTimeAsync(150);

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should reset debounce timer on multiple changes', async () => {
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // Advance time but not past debounce
      await vi.advanceTimersByTimeAsync(50);

      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note2);

      // Advance time but not past new debounce
      await vi.advanceTimersByTimeAsync(50);
      expect(mockFs.writeFile).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(100);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('indexNote() - New tasks', () => {
    it('should add new tasks with sequential priority', () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);

      const changes = index.indexNote(note);

      expect(changes.length).toBe(2);
      expect(changes[0].type).toBe('added');
      expect(changes[1].type).toBe('added');

      const { tasks } = index.list();
      expect(tasks[0].priority).toBe(0);
      expect(tasks[1].priority).toBe(1);
    });

    it('should assign priority after existing max', () => {
      // Index first note
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // Reorder to set higher priority
      const task1 = index.list().tasks[0];
      index.reorder([task1.id]);
      // Task1 now has priority 0

      // Index second note
      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note2);

      const { tasks } = index.list();
      const task2 = tasks.find((t) => t.text === 'Task 2');
      expect(task2?.priority).toBe(1); // After existing max of 0
    });

    it('should set createdAt and updatedAt to now', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);

      index.indexNote(note);

      const { tasks } = index.list();
      expect(tasks[0].createdAt).toBe(now);
      expect(tasks[0].updatedAt).toBe(now);
    });
  });

  describe('indexNote() - Existing tasks (same nodeKey)', () => {
    it('should update completed state', () => {
      // Create initial task
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // Update to checked
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
      ]);
      const changes = index.indexNote(note2);

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('updated');

      const { tasks } = index.list();
      expect(tasks[0].completed).toBe(true);
    });

    it('should preserve priority on update', () => {
      // Create initial task
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note1);

      // Reorder to change priority
      const { tasks: initialTasks } = index.list();
      index.reorder([initialTasks[1].id, initialTasks[0].id]);

      // Update task text
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1 updated', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note2);

      const task1 = index.list().tasks.find((t) => t.text === 'Task 1 updated');
      // Should have preserved the priority from before (was swapped to 1)
      expect(task1?.priority).toBe(1);
    });

    it('should preserve createdAt on update', () => {
      const createTime = 1000;
      vi.setSystemTime(createTime);

      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // Update later
      vi.setSystemTime(5000);
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1 updated', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note2);

      const task = index.list().tasks[0];
      expect(task.createdAt).toBe(createTime);
      expect(task.updatedAt).toBe(5000);
    });
  });

  describe('indexNote() - completedAt handling', () => {
    it('should set completedAt when task becomes completed', () => {
      const now = 5000;
      vi.setSystemTime(1000);

      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // Complete the task
      vi.setSystemTime(now);
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
      ]);
      index.indexNote(note2);

      const task = index.list().tasks[0];
      expect(task.completed).toBe(true);
      expect(task.completedAt).toBe(now);
    });

    it('should clear completedAt when task becomes uncompleted', () => {
      vi.setSystemTime(1000);

      // Start with completed task
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      let task = index.list().tasks[0];
      expect(task.completedAt).toBe(1000);

      // Uncomplete the task
      vi.setSystemTime(5000);
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note2);

      task = index.list().tasks[0];
      expect(task.completed).toBe(false);
      expect(task.completedAt).toBeUndefined();
    });

    it('should set completedAt for initially completed tasks', () => {
      const now = 1000;
      vi.setSystemTime(now);

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      const task = index.list().tasks[0];
      expect(task.completedAt).toBe(now);
    });
  });

  describe('indexNote() - Moved tasks (same nodeKey, different lineIndex)', () => {
    it('should update lineIndex while preserving priority', () => {
      vi.setSystemTime(1000);

      // Create initial tasks
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note1);

      const task1Initial = index.list().tasks.find((t) => t.text === 'Task 1');
      const initialPriority = task1Initial?.priority;

      // Reorder in document (swap positions)
      vi.setSystemTime(2000);
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      const changes = index.indexNote(note2);

      // Should have updated both tasks
      expect(changes.some((c) => c.type === 'updated')).toBe(true);

      const task1Final = index.list().tasks.find((t) => t.text === 'Task 1');
      expect(task1Final?.lineIndex).toBe(1); // Now at index 1
      expect(task1Final?.priority).toBe(initialPriority); // Priority preserved
    });
  });

  describe('indexNote() - Missing tasks (in index but not in note)', () => {
    it('should remove tasks that no longer exist', () => {
      // Create initial tasks
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note1);
      expect(index.size).toBe(2);

      // Remove one task
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      const changes = index.indexNote(note2);

      expect(changes.some((c) => c.type === 'removed')).toBe(true);
      expect(index.size).toBe(1);
    });
  });

  describe('indexNote() - textHash fallback matching', () => {
    it('should match by textHash when nodeKey changes', () => {
      vi.setSystemTime(1000);

      // Create initial task
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      const initialTask = index.list().tasks[0];
      const initialPriority = initialTask.priority;
      const initialCreatedAt = initialTask.createdAt;

      // Same text, different nodeKey (simulates paste/import)
      vi.setSystemTime(2000);
      const note2 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'newKey' },
      ]);
      const changes = index.indexNote(note2);

      // Should be treated as update, not add+remove
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('updated');

      const updatedTask = index.list().tasks[0];
      expect(updatedTask.nodeKey).toBe('newKey');
      expect(updatedTask.priority).toBe(initialPriority);
      expect(updatedTask.createdAt).toBe(initialCreatedAt);
    });
  });

  describe('removeNote()', () => {
    it('should remove all tasks for a note', () => {
      // Create tasks in multiple notes
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note1);
      index.indexNote(note2);
      expect(index.size).toBe(2);

      // Remove note1
      const changes = index.removeNote(createNoteId('note1'));

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('removed');
      expect(index.size).toBe(1);
      expect(index.getTaskIdsForNote(createNoteId('note1')).size).toBe(0);
    });

    it('should return empty array for non-existent note', () => {
      const changes = index.removeNote(createNoteId('nonexistent'));
      expect(changes.length).toBe(0);
    });
  });

  describe('list() - Filtering', () => {
    beforeEach(() => {
      vi.setSystemTime(1000);

      // Create various tasks for filtering tests
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: true, nodeKey: 'key2' },
      ]);
      index.indexNote(note1);

      vi.setSystemTime(2000);
      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task 3', checked: false, nodeKey: 'key3' },
      ]);
      index.indexNote(note2);
    });

    it('should filter by completed status', () => {
      const { tasks: incomplete } = index.list({ completed: false });
      const { tasks: completed } = index.list({ completed: true });

      expect(incomplete.length).toBe(2);
      expect(completed.length).toBe(1);
    });

    it('should filter by noteId', () => {
      const { tasks } = index.list({ noteId: createNoteId('note1') });
      expect(tasks.length).toBe(2);
    });

    it('should filter by createdAfter', () => {
      const { tasks } = index.list({ createdAfter: 1500 });
      expect(tasks.length).toBe(1);
      expect(tasks[0].text).toBe('Task 3');
    });

    it('should filter by createdBefore', () => {
      const { tasks } = index.list({ createdBefore: 1500 });
      expect(tasks.length).toBe(2);
    });

    it('should filter by completedAfter', () => {
      const { tasks } = index.list({ completedAfter: 500 });
      expect(tasks.length).toBe(1);
      expect(tasks[0].completed).toBe(true);
    });

    it('should filter by completedBefore', () => {
      const { tasks } = index.list({ completedBefore: 1500 });
      expect(tasks.length).toBe(1);
    });
  });

  describe('list() - Sorting', () => {
    beforeEach(() => {
      vi.setSystemTime(1000);
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task A', checked: false, nodeKey: 'keyA' },
      ]);
      index.indexNote(note1);

      vi.setSystemTime(2000);
      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task B', checked: false, nodeKey: 'keyB' },
      ]);
      index.indexNote(note2);
    });

    it('should sort by priority ascending by default', () => {
      const { tasks } = index.list();
      expect(tasks[0].text).toBe('Task A'); // priority 0
      expect(tasks[1].text).toBe('Task B'); // priority 1
    });

    it('should sort by priority descending', () => {
      const { tasks } = index.list({ sortBy: 'priority', sortOrder: 'desc' });
      expect(tasks[0].text).toBe('Task B');
      expect(tasks[1].text).toBe('Task A');
    });

    it('should sort by createdAt ascending', () => {
      const { tasks } = index.list({ sortBy: 'createdAt', sortOrder: 'asc' });
      expect(tasks[0].createdAt).toBe(1000);
      expect(tasks[1].createdAt).toBe(2000);
    });

    it('should sort by createdAt descending', () => {
      const { tasks } = index.list({ sortBy: 'createdAt', sortOrder: 'desc' });
      expect(tasks[0].createdAt).toBe(2000);
      expect(tasks[1].createdAt).toBe(1000);
    });

    it('should sort completed tasks after incomplete when sorting by priority', () => {
      // Complete task A
      const { tasks: initialTasks } = index.list();
      index.toggle(initialTasks[0].id);

      const { tasks } = index.list({ sortBy: 'priority' });
      expect(tasks[0].text).toBe('Task B'); // incomplete, priority 1
      expect(tasks[1].text).toBe('Task A'); // completed, priority 0
    });
  });

  describe('list() - Pagination', () => {
    beforeEach(() => {
      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
        vi.setSystemTime(1000 + i * 100);
        const note = createNote(`note${i}`, `Note ${i}`, [
          { text: `Task ${i}`, checked: false, nodeKey: `key${i}` },
        ]);
        index.indexNote(note);
      }
    });

    it('should limit results', () => {
      const { tasks, nextCursor } = index.list({ limit: 2 });
      expect(tasks.length).toBe(2);
      expect(nextCursor).toBeDefined();
    });

    it('should return no cursor when all results fit', () => {
      const { tasks, nextCursor } = index.list({ limit: 10 });
      expect(tasks.length).toBe(5);
      expect(nextCursor).toBeUndefined();
    });

    it('should paginate with cursor', () => {
      // Get first page
      const page1 = index.list({ limit: 2 });
      expect(page1.tasks.length).toBe(2);
      expect(page1.nextCursor).toBeDefined();

      // Get second page
      const page2 = index.list({ limit: 2, cursor: page1.nextCursor });
      expect(page2.tasks.length).toBe(2);
      expect(page2.nextCursor).toBeDefined();

      // Get third page
      const page3 = index.list({ limit: 2, cursor: page2.nextCursor });
      expect(page3.tasks.length).toBe(1);
      expect(page3.nextCursor).toBeUndefined();

      // Verify no duplicates across pages
      const allIds = new Set([
        ...page1.tasks.map((t) => t.id),
        ...page2.tasks.map((t) => t.id),
        ...page3.tasks.map((t) => t.id),
      ]);
      expect(allIds.size).toBe(5);
    });

    it('should handle invalid cursor', () => {
      const { tasks } = index.list({ limit: 2, cursor: 'invalid' });
      // Should start from beginning
      expect(tasks.length).toBe(2);
      expect(tasks[0].text).toBe('Task 0');
    });
  });

  describe('toggle()', () => {
    beforeEach(() => {
      vi.setSystemTime(1000);
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);
    });

    it('should toggle completion state', () => {
      const { tasks } = index.list();
      const taskId = tasks[0].id;

      const toggled = index.toggle(taskId);

      expect(toggled?.completed).toBe(true);
      expect(index.get(taskId)?.completed).toBe(true);
    });

    it('should set completedAt when completing', () => {
      const now = 5000;
      vi.setSystemTime(now);

      const { tasks } = index.list();
      const taskId = tasks[0].id;

      const toggled = index.toggle(taskId);

      expect(toggled?.completedAt).toBe(now);
    });

    it('should clear completedAt when uncompleting', () => {
      // First complete
      const { tasks } = index.list();
      const taskId = tasks[0].id;
      index.toggle(taskId);

      // Then uncomplete
      vi.setSystemTime(2000);
      const toggled = index.toggle(taskId);

      expect(toggled?.completed).toBe(false);
      expect(toggled?.completedAt).toBeUndefined();
    });

    it('should return null for non-existent task', () => {
      const result = index.toggle('nonexistent');
      expect(result).toBeNull();
    });

    it('should mark index as dirty', () => {
      const { tasks } = index.list();
      index.toggle(tasks[0].id);

      expect(index.isDirty).toBe(true);
    });
  });

  describe('reorder()', () => {
    beforeEach(() => {
      // Create 3 tasks
      const note = createNote('note1', 'Test Note', [
        { text: 'Task A', checked: false, nodeKey: 'keyA' },
        { text: 'Task B', checked: false, nodeKey: 'keyB' },
        { text: 'Task C', checked: false, nodeKey: 'keyC' },
      ]);
      index.indexNote(note);
    });

    it('should update priorities based on new order', () => {
      const { tasks } = index.list();
      const ids = tasks.map((t) => t.id);

      // Reverse order
      index.reorder([ids[2], ids[1], ids[0]]);

      const { tasks: reordered } = index.list();
      expect(reordered[0].text).toBe('Task C');
      expect(reordered[0].priority).toBe(0);
      expect(reordered[1].text).toBe('Task B');
      expect(reordered[1].priority).toBe(1);
      expect(reordered[2].text).toBe('Task A');
      expect(reordered[2].priority).toBe(2);
    });

    it('should mark index as dirty', () => {
      // Clear dirty flag
      index['dirty'] = false;

      const { tasks } = index.list();
      const ids = tasks.map((t) => t.id);
      index.reorder([ids[1], ids[0], ids[2]]);

      expect(index.isDirty).toBe(true);
    });

    it('should handle partial reorder', () => {
      const { tasks } = index.list();

      // Only reorder first two
      index.reorder([tasks[1].id, tasks[0].id]);

      const task0 = index.get(tasks[0].id);
      const task1 = index.get(tasks[1].id);

      expect(task0?.priority).toBe(1);
      expect(task1?.priority).toBe(0);
    });
  });

  describe('flush()', () => {
    it('should cancel pending persist and persist immediately', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Should have scheduled debounced persist
      expect(mockFs.writeFile).not.toHaveBeenCalled();

      // Flush immediately
      await index.flush();

      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Deterministic key stability', () => {
    it('should preserve metadata when re-indexing note with fallback keys', () => {
      vi.setSystemTime(1000);

      // Create a note with tasks that have no __key (will use fallback)
      const noteWithoutKeys: Note = {
        id: createNoteId('note-no-keys'),
        title: 'Fallback Key Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'check',
                children: [
                  {
                    type: 'listitem',
                    checked: false,
                    // No __key - will trigger fallback path
                    children: [{ type: 'text', text: 'Task without key' }],
                  },
                ],
              },
            ],
          },
        },
        metadata: { title: null, tags: [], links: [], mentions: [] },
      };

      // Index the note
      const changes1 = index.indexNote(noteWithoutKeys);
      expect(changes1.length).toBe(1);
      expect(changes1[0].type).toBe('added');

      const initialTask = index.list().tasks[0];
      const initialId = initialTask.id;
      const initialCreatedAt = initialTask.createdAt;
      const initialPriority = initialTask.priority;

      // Reorder to change priority
      index.reorder([initialId]);
      expect(index.get(initialId)?.priority).toBe(0);

      // Re-index the same note (simulating document re-open or re-parse)
      vi.setSystemTime(5000);
      const changes2 = index.indexNote(noteWithoutKeys);

      // Should NOT have added/removed - only potentially updated
      expect(changes2.every((c) => c.type !== 'added')).toBe(true);
      expect(changes2.every((c) => c.type !== 'removed')).toBe(true);

      // Task should still exist with same ID
      const finalTask = index.get(initialId);
      expect(finalTask).toBeDefined();

      // Metadata should be preserved
      expect(finalTask?.createdAt).toBe(initialCreatedAt);
      expect(finalTask?.priority).toBe(initialPriority);
    });

    it('should produce stable task IDs across multiple re-indexing cycles', () => {
      vi.setSystemTime(1000);

      const noteWithoutKeys: Note = {
        id: createNoteId('note-stable-test'),
        title: 'Stability Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'list',
                listType: 'check',
                children: [
                  {
                    type: 'listitem',
                    checked: false,
                    children: [{ type: 'text', text: 'First task' }],
                  },
                  {
                    type: 'listitem',
                    checked: true,
                    children: [{ type: 'text', text: 'Second task' }],
                  },
                ],
              },
            ],
          },
        },
        metadata: { title: null, tags: [], links: [], mentions: [] },
      };

      // Index multiple times
      index.indexNote(noteWithoutKeys);
      const firstIndexIds = index
        .list()
        .tasks.map((t) => t.id)
        .sort();

      vi.setSystemTime(2000);
      index.indexNote(noteWithoutKeys);
      const secondIndexIds = index
        .list()
        .tasks.map((t) => t.id)
        .sort();

      vi.setSystemTime(3000);
      index.indexNote(noteWithoutKeys);
      const thirdIndexIds = index
        .list()
        .tasks.map((t) => t.id)
        .sort();

      // All should have same IDs
      expect(firstIndexIds).toEqual(secondIndexIds);
      expect(secondIndexIds).toEqual(thirdIndexIds);

      // Should always have exactly 2 tasks
      expect(index.size).toBe(2);
    });
  });

  // ============================================================================
  // Persistence Failure Recovery Tests
  // ============================================================================

  describe('persist() - Failure scenarios', () => {
    it('should handle fs.writeFile failure (disk full)', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Simulate disk full error
      const diskFullError = new Error('ENOSPC: no space left on device');
      (diskFullError as NodeJS.ErrnoException).code = 'ENOSPC';
      mockFs.writeFile.mockRejectedValueOnce(diskFullError);

      // persist should throw the error
      await expect(index.flush()).rejects.toThrow('ENOSPC');

      // dirty flag should still be true after failure (allowing retry)
      expect(index.isDirty).toBe(true);
    });

    it('should handle fs.writeFile failure (permission denied)', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Simulate permission denied error
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as NodeJS.ErrnoException).code = 'EACCES';
      mockFs.writeFile.mockRejectedValueOnce(permissionError);

      await expect(index.flush()).rejects.toThrow('EACCES');
      expect(index.isDirty).toBe(true);
    });

    it('should handle fs.rename failure (atomic write failure)', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // writeFile succeeds, but rename fails
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      const renameError = new Error('EXDEV: cross-device link not permitted');
      (renameError as NodeJS.ErrnoException).code = 'EXDEV';
      mockFs.rename.mockRejectedValueOnce(renameError);

      await expect(index.flush()).rejects.toThrow('EXDEV');
      expect(index.isDirty).toBe(true);
    });

    it('should handle fs.mkdir failure', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // mkdir fails
      const mkdirError = new Error('EACCES: permission denied');
      (mkdirError as NodeJS.ErrnoException).code = 'EACCES';
      mockFs.mkdir.mockRejectedValueOnce(mkdirError);

      await expect(index.flush()).rejects.toThrow('EACCES');
      expect(index.isDirty).toBe(true);
    });

    it('should allow retry after persist failure', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // First attempt fails
      const error = new Error('ENOSPC: no space left on device');
      mockFs.writeFile.mockRejectedValueOnce(error);
      await expect(index.flush()).rejects.toThrow();

      // Verify still dirty
      expect(index.isDirty).toBe(true);

      // Reset mocks for successful retry
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      // Second attempt succeeds
      await expect(index.flush()).resolves.not.toThrow();
      expect(index.isDirty).toBe(false);
    });
  });

  describe('load() - Corrupted file scenarios', () => {
    it('should skip completely invalid JSON lines', async () => {
      mockFs.readFile.mockResolvedValue('not json at all\n{also not valid}\ntruncated...');

      await index.load();

      expect(index.size).toBe(0);
    });

    it('should handle partial/truncated JSON lines', async () => {
      const validTask: Task = {
        id: 'note1:key1:hash1',
        noteId: createNoteId('note1'),
        noteTitle: 'Test Note',
        nodeKey: 'key1',
        lineIndex: 0,
        text: 'Task 1',
        textHash: 'hash1',
        completed: false,
        priority: 0,
        createdAt: 1000,
        updatedAt: 1000,
      };

      // File with valid task, then truncated JSON (simulating crash during write)
      mockFs.readFile.mockResolvedValue(
        `${JSON.stringify(validTask)}\n{"id":"note2:key2:hash2","noteId":"note2","noteTitle":"Test`
      );

      await index.load();

      // Should load the valid task and skip the truncated one
      expect(index.size).toBe(1);
      expect(index.get('note1:key1:hash1')).toBeDefined();
    });

    it('should handle mixed valid and invalid lines', async () => {
      const task1: Task = {
        id: 'note1:key1:hash1',
        noteId: createNoteId('note1'),
        noteTitle: 'Test Note 1',
        nodeKey: 'key1',
        lineIndex: 0,
        text: 'Task 1',
        textHash: 'hash1',
        completed: false,
        priority: 0,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const task2: Task = {
        id: 'note2:key2:hash2',
        noteId: createNoteId('note2'),
        noteTitle: 'Test Note 2',
        nodeKey: 'key2',
        lineIndex: 0,
        text: 'Task 2',
        textHash: 'hash2',
        completed: true,
        completedAt: 2000,
        priority: 1,
        createdAt: 1500,
        updatedAt: 2000,
      };

      const task3: Task = {
        id: 'note3:key3:hash3',
        noteId: createNoteId('note3'),
        noteTitle: 'Test Note 3',
        nodeKey: 'key3',
        lineIndex: 0,
        text: 'Task 3',
        textHash: 'hash3',
        completed: false,
        priority: 2,
        createdAt: 2500,
        updatedAt: 2500,
      };

      mockFs.readFile.mockResolvedValue(
        `${JSON.stringify(task1)}\n` +
          `{invalid json}\n` +
          `${JSON.stringify(task2)}\n` +
          `undefined\n` + // invalid
          `\n` + // empty line
          `{"partial":true\n` + // truncated
          `${JSON.stringify(task3)}\n`
      );

      await index.load();

      // Should load only the 3 valid tasks and skip invalid lines
      expect(index.size).toBe(3);
      expect(index.get('note1:key1:hash1')).toEqual(task1);
      expect(index.get('note2:key2:hash2')).toEqual(task2);
      expect(index.get('note3:key3:hash3')).toEqual(task3);
    });

    it('should handle empty file gracefully', async () => {
      mockFs.readFile.mockResolvedValue('');

      await index.load();

      expect(index.size).toBe(0);
    });

    it('should handle file with only whitespace/newlines', async () => {
      mockFs.readFile.mockResolvedValue('\n\n   \n\t\n');

      await index.load();

      expect(index.size).toBe(0);
    });

    it('should handle read permission denied', async () => {
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as NodeJS.ErrnoException).code = 'EACCES';
      mockFs.readFile.mockRejectedValue(permissionError);

      await expect(index.load()).rejects.toThrow('EACCES');
    });
  });

  describe('schedulePersist() - Error handling', () => {
    it('should log error when debounced persist fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Make persist fail
      const error = new Error('ENOSPC: no space left on device');
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(error);

      // Advance past debounce to trigger persist
      await vi.advanceTimersByTimeAsync(150);

      // The error should be logged (logger outputs structured format)
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Persist failed'));

      consoleErrorSpy.mockRestore();
    });

    it('should keep dirty flag true after schedulePersist failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      expect(index.isDirty).toBe(true);

      // Make persist fail
      const error = new Error('ENOSPC');
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(error);

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(150);

      // dirty flag should still be true allowing retry on next change
      expect(index.isDirty).toBe(true);
    });

    it('should allow subsequent persist after schedulePersist failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // First scheduled persist fails
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(new Error('ENOSPC'));

      await vi.advanceTimersByTimeAsync(150);
      expect(index.isDirty).toBe(true);

      // Make another change to trigger new schedulePersist
      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note2);

      // Reset mocks for success
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      // Advance past debounce - this should succeed
      await vi.advanceTimersByTimeAsync(150);

      expect(index.isDirty).toBe(false);
    });
  });

  describe('Persistence recovery behavior', () => {
    it('should preserve in-memory state after persist failure', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: true, nodeKey: 'key2' },
      ]);
      index.indexNote(note);

      // Get initial task IDs
      const { tasks: initialTasks } = index.list();
      expect(initialTasks.length).toBe(2);

      // Make persist fail
      mockFs.mkdir.mockRejectedValueOnce(new Error('EACCES'));

      await expect(index.flush()).rejects.toThrow('EACCES');

      // In-memory state should be preserved
      const { tasks: afterFailure } = index.list();
      expect(afterFailure.length).toBe(2);
      expect(afterFailure[0].id).toBe(initialTasks[0].id);
      expect(afterFailure[1].id).toBe(initialTasks[1].id);
    });

    it('should allow modifications after persist failure', async () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note);

      // Make persist fail
      mockFs.mkdir.mockRejectedValueOnce(new Error('EACCES'));
      await expect(index.flush()).rejects.toThrow();

      // Should still be able to toggle task
      const { tasks } = index.list();
      const toggled = index.toggle(tasks[0].id);

      expect(toggled?.completed).toBe(true);
      expect(index.isDirty).toBe(true);

      // Should be able to successfully persist with the modifications
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      await expect(index.flush()).resolves.not.toThrow();
      expect(index.isDirty).toBe(false);
    });

    it('should include all accumulated changes in retry persist', async () => {
      // Create first task
      const note1 = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);
      index.indexNote(note1);

      // First persist fails
      mockFs.mkdir.mockRejectedValueOnce(new Error('ENOSPC'));
      await expect(index.flush()).rejects.toThrow();

      // Add more tasks while in failed state
      const note2 = createNote('note2', 'Another Note', [
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
      ]);
      index.indexNote(note2);

      // Toggle first task
      const { tasks: currentTasks } = index.list();
      index.toggle(currentTasks[0].id);

      expect(index.size).toBe(2);

      // Now persist successfully
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);
      mockFs.rename.mockResolvedValueOnce(undefined);

      await index.flush();

      // Verify writeFile was called with all tasks
      expect(mockFs.writeFile).toHaveBeenLastCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('"text":"Task 1"'),
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenLastCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('"text":"Task 2"'),
        'utf-8'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty note', () => {
      const note = createNote('note1', 'Test Note', []);
      const changes = index.indexNote(note);

      expect(changes.length).toBe(0);
      expect(index.size).toBe(0);
    });

    it('should handle note with non-checklist items', () => {
      const note: Note = {
        id: createNoteId('note1'),
        title: 'Test Note',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Regular text' }],
              },
            ],
          },
        },
        metadata: { title: null, tags: [], links: [], mentions: [] },
      };

      const changes = index.indexNote(note);
      expect(changes.length).toBe(0);
    });

    it('should handle duplicate text in same note', () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Same task', checked: false, nodeKey: 'key1' },
        { text: 'Same task', checked: false, nodeKey: 'key2' },
      ]);

      index.indexNote(note);

      expect(index.size).toBe(2);
      const { tasks } = index.list();
      expect(tasks[0].nodeKey).not.toBe(tasks[1].nodeKey);
    });
  });

  // ============================================================================
  // Concurrent Modification Tests (scribe-15q)
  // Tests for timing/concurrency edge cases
  // ============================================================================

  describe('Concurrent modification scenarios', () => {
    describe('Multiple rapid indexNote() calls on same note', () => {
      it('should handle rapid sequential indexNote() calls without data loss', () => {
        const note1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);

        // Rapid sequential indexing
        index.indexNote(note1);
        index.indexNote(note1);
        index.indexNote(note1);

        // Should still have exactly 1 task
        expect(index.size).toBe(1);

        // Task data should be intact
        const { tasks } = index.list();
        expect(tasks[0].text).toBe('Task 1');
      });

      it('should correctly reconcile rapidly changing task states', () => {
        vi.setSystemTime(1000);

        // First version: unchecked
        const noteV1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(noteV1);

        vi.setSystemTime(1001);

        // Second version: checked
        const noteV2 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: true, nodeKey: 'key1' },
        ]);
        index.indexNote(noteV2);

        vi.setSystemTime(1002);

        // Third version: back to unchecked
        const noteV3 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(noteV3);

        // Final state should be unchecked
        const { tasks } = index.list();
        expect(tasks[0].completed).toBe(false);
        expect(tasks[0].completedAt).toBeUndefined();
      });

      it('should handle rapid task additions and removals', () => {
        // Add task
        const noteV1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(noteV1);
        expect(index.size).toBe(1);

        // Add second task
        const noteV2 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
          { text: 'Task 2', checked: false, nodeKey: 'key2' },
        ]);
        index.indexNote(noteV2);
        expect(index.size).toBe(2);

        // Remove first task
        const noteV3 = createNote('note1', 'Test Note', [
          { text: 'Task 2', checked: false, nodeKey: 'key2' },
        ]);
        index.indexNote(noteV3);
        expect(index.size).toBe(1);

        // Verify correct task remains
        const { tasks } = index.list();
        expect(tasks[0].text).toBe('Task 2');
        expect(tasks[0].nodeKey).toBe('key2');
      });
    });

    describe('Concurrent toggle() calls on same task', () => {
      it('should handle multiple toggle() calls in rapid succession', () => {
        vi.setSystemTime(1000);

        const note = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note);

        const { tasks } = index.list();
        const taskId = tasks[0].id;

        // Rapid toggles
        vi.setSystemTime(1001);
        index.toggle(taskId); // -> completed
        vi.setSystemTime(1002);
        index.toggle(taskId); // -> uncompleted
        vi.setSystemTime(1003);
        index.toggle(taskId); // -> completed

        // Final state should be completed
        const task = index.get(taskId);
        expect(task?.completed).toBe(true);
        expect(task?.completedAt).toBe(1003);
      });

      it('should maintain data integrity across interleaved toggle and indexNote', () => {
        vi.setSystemTime(1000);

        const noteV1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(noteV1);

        const { tasks } = index.list();
        const taskId = tasks[0].id;
        const originalPriority = tasks[0].priority;

        // Toggle the task
        vi.setSystemTime(2000);
        index.toggle(taskId);
        expect(index.get(taskId)?.completed).toBe(true);

        // Re-index with the same unchecked state (simulating document not yet synced)
        vi.setSystemTime(3000);
        index.indexNote(noteV1);

        // The indexed state should take precedence (unchecked from document)
        const task = index.get(taskId);
        expect(task?.completed).toBe(false);
        // Priority should be preserved
        expect(task?.priority).toBe(originalPriority);
      });
    });

    describe('indexNote() during scheduled persist (debounce timer running)', () => {
      it('should coalesce multiple changes into single persist', async () => {
        const note1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note1);

        // Should have scheduled persist but not yet executed
        expect(mockFs.writeFile).not.toHaveBeenCalled();

        // Make more changes before debounce fires
        const note2 = createNote('note2', 'Note 2', [
          { text: 'Task 2', checked: false, nodeKey: 'key2' },
        ]);
        index.indexNote(note2);

        const note3 = createNote('note3', 'Note 3', [
          { text: 'Task 3', checked: false, nodeKey: 'key3' },
        ]);
        index.indexNote(note3);

        // Still shouldn't have persisted
        expect(mockFs.writeFile).not.toHaveBeenCalled();

        // Advance past debounce
        await vi.advanceTimersByTimeAsync(150);

        // Should have persisted exactly once with all 3 tasks
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
        const writtenContent = mockFs.writeFile.mock.calls[0][1];
        expect(writtenContent).toContain('Task 1');
        expect(writtenContent).toContain('Task 2');
        expect(writtenContent).toContain('Task 3');
      });

      it('should handle indexNote() after persist starts but before completion', async () => {
        // Create a slow persist that we can control
        let persistResolve: () => void;
        const persistPromise = new Promise<void>((resolve) => {
          persistResolve = resolve;
        });

        mockFs.writeFile.mockImplementationOnce(() => persistPromise);

        const note1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note1);

        // Advance to trigger persist
        await vi.advanceTimersByTimeAsync(150);

        // Persist has started but not completed
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);

        // Add another task while persist is in progress
        mockFs.writeFile.mockResolvedValueOnce(undefined);
        const note2 = createNote('note2', 'Note 2', [
          { text: 'Task 2', checked: false, nodeKey: 'key2' },
        ]);
        index.indexNote(note2);

        // Index should have 2 tasks even if first persist hasn't completed
        expect(index.size).toBe(2);

        // Complete the first persist
        persistResolve!();
        await persistPromise;

        // Wait for second persist to be scheduled and complete
        await vi.advanceTimersByTimeAsync(150);

        // Both tasks should be intact
        expect(index.size).toBe(2);
      });
    });

    describe('Multiple notes being indexed simultaneously', () => {
      it('should handle indexing many notes rapidly', () => {
        // Index 10 notes rapidly
        for (let i = 0; i < 10; i++) {
          const note = createNote(`note${i}`, `Note ${i}`, [
            { text: `Task ${i}`, checked: i % 2 === 0, nodeKey: `key${i}` },
          ]);
          index.indexNote(note);
        }

        expect(index.size).toBe(10);

        // Verify all tasks are distinct and have correct data
        const { tasks } = index.list();
        const texts = tasks.map((t) => t.text);
        const uniqueTexts = new Set(texts);
        expect(uniqueTexts.size).toBe(10);

        // Check completion states
        const completedCount = tasks.filter((t) => t.completed).length;
        expect(completedCount).toBe(5); // Even numbered tasks
      });

      it('should maintain correct byNote index under rapid updates', () => {
        // Create notes with multiple tasks
        const note1 = createNote('note1', 'Note 1', [
          { text: 'Task 1A', checked: false, nodeKey: 'key1a' },
          { text: 'Task 1B', checked: false, nodeKey: 'key1b' },
        ]);
        const note2 = createNote('note2', 'Note 2', [
          { text: 'Task 2A', checked: false, nodeKey: 'key2a' },
        ]);

        index.indexNote(note1);
        index.indexNote(note2);

        // Update note1 while keeping note2 unchanged
        const note1Updated = createNote('note1', 'Note 1', [
          { text: 'Task 1A Updated', checked: true, nodeKey: 'key1a' },
          { text: 'Task 1C', checked: false, nodeKey: 'key1c' }, // New task, removed 1B
        ]);
        index.indexNote(note1Updated);

        // Note1 should have 2 tasks
        const note1TaskIds = index.getTaskIdsForNote(createNoteId('note1'));
        expect(note1TaskIds.size).toBe(2);

        // Note2 should still have 1 task
        const note2TaskIds = index.getTaskIdsForNote(createNoteId('note2'));
        expect(note2TaskIds.size).toBe(1);

        // Total should be 3
        expect(index.size).toBe(3);
      });

      it('should isolate changes between notes', () => {
        vi.setSystemTime(1000);

        // Index note1
        const note1 = createNote('note1', 'Note 1', [
          { text: 'Shared text', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note1);
        const note1Task = index.list().tasks[0];
        const note1TaskId = note1Task.id;

        vi.setSystemTime(2000);

        // Index note2 with same text (different note)
        const note2 = createNote('note2', 'Note 2', [
          { text: 'Shared text', checked: true, nodeKey: 'key2' },
        ]);
        index.indexNote(note2);

        // Should have 2 distinct tasks
        expect(index.size).toBe(2);

        // Original task should be unchanged
        const note1TaskAfter = index.get(note1TaskId);
        expect(note1TaskAfter?.completed).toBe(false);
        expect(note1TaskAfter?.createdAt).toBe(1000);
      });
    });

    describe('reorder() during indexNote() on overlapping tasks', () => {
      it('should handle reorder then immediate indexNote', () => {
        vi.setSystemTime(1000);

        const note = createNote('note1', 'Test Note', [
          { text: 'Task A', checked: false, nodeKey: 'keyA' },
          { text: 'Task B', checked: false, nodeKey: 'keyB' },
          { text: 'Task C', checked: false, nodeKey: 'keyC' },
        ]);
        index.indexNote(note);

        const { tasks: initialTasks } = index.list();
        const ids = initialTasks.map((t) => t.id);

        // Reorder to: C, A, B
        index.reorder([ids[2], ids[0], ids[1]]);

        vi.setSystemTime(2000);

        // Re-index the same note (simulating document refresh)
        index.indexNote(note);

        // Priorities from reorder should be preserved
        const taskA = index.list().tasks.find((t) => t.text === 'Task A');
        const taskB = index.list().tasks.find((t) => t.text === 'Task B');
        const taskC = index.list().tasks.find((t) => t.text === 'Task C');

        expect(taskC?.priority).toBe(0);
        expect(taskA?.priority).toBe(1);
        expect(taskB?.priority).toBe(2);
      });

      it('should handle indexNote with removed task during reorder', () => {
        vi.setSystemTime(1000);

        // Create tasks
        const note1 = createNote('note1', 'Test Note', [
          { text: 'Task A', checked: false, nodeKey: 'keyA' },
          { text: 'Task B', checked: false, nodeKey: 'keyB' },
          { text: 'Task C', checked: false, nodeKey: 'keyC' },
        ]);
        index.indexNote(note1);

        const { tasks: initialTasks } = index.list();
        const allIds = initialTasks.map((t) => t.id);

        // Reorder all tasks
        index.reorder([allIds[2], allIds[1], allIds[0]]);

        vi.setSystemTime(2000);

        // Index note with Task B removed
        const note2 = createNote('note1', 'Test Note', [
          { text: 'Task A', checked: false, nodeKey: 'keyA' },
          { text: 'Task C', checked: false, nodeKey: 'keyC' },
        ]);
        const changes = index.indexNote(note2);

        // Should have removed Task B
        expect(changes.some((c) => c.type === 'removed')).toBe(true);
        expect(index.size).toBe(2);

        // Remaining tasks should have their priorities from the reorder
        const { tasks } = index.list();
        expect(tasks.length).toBe(2);
      });

      it('should handle concurrent reorder and indexNote on different notes', () => {
        vi.setSystemTime(1000);

        // Create two notes with tasks
        const note1 = createNote('note1', 'Note 1', [
          { text: 'Task 1A', checked: false, nodeKey: 'key1a' },
          { text: 'Task 1B', checked: false, nodeKey: 'key1b' },
        ]);
        const note2 = createNote('note2', 'Note 2', [
          { text: 'Task 2A', checked: false, nodeKey: 'key2a' },
          { text: 'Task 2B', checked: false, nodeKey: 'key2b' },
        ]);

        index.indexNote(note1);
        index.indexNote(note2);

        // Get all task IDs
        const { tasks } = index.list();
        const task1A = tasks.find((t) => t.text === 'Task 1A')!;
        const task1B = tasks.find((t) => t.text === 'Task 1B')!;
        const task2A = tasks.find((t) => t.text === 'Task 2A')!;
        const task2B = tasks.find((t) => t.text === 'Task 2B')!;

        // Reorder all tasks globally
        index.reorder([task2B.id, task1A.id, task2A.id, task1B.id]);

        vi.setSystemTime(2000);

        // Update note1 while keeping note2 unchanged
        const note1Updated = createNote('note1', 'Note 1', [
          { text: 'Task 1A Updated', checked: true, nodeKey: 'key1a' },
          { text: 'Task 1B', checked: false, nodeKey: 'key1b' },
        ]);
        index.indexNote(note1Updated);

        // Note2 tasks should be unaffected
        const task2AAfter = index.get(task2A.id);
        const task2BAfter = index.get(task2B.id);
        expect(task2AAfter?.priority).toBe(2);
        expect(task2BAfter?.priority).toBe(0);

        // Note1 tasks should have preserved their priorities
        const { tasks: tasksAfter } = index.list();
        const task1AAfter = tasksAfter.find((t) => t.text === 'Task 1A Updated');
        expect(task1AAfter?.priority).toBe(1);
      });
    });

    describe('Debounce coalescing under rapid operations', () => {
      it('should only persist once after many rapid operations', async () => {
        const note = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note);

        const { tasks } = index.list();
        const taskId = tasks[0].id;

        // Perform many operations rapidly
        for (let i = 0; i < 10; i++) {
          index.toggle(taskId);
        }

        // Should not have persisted yet
        expect(mockFs.writeFile).not.toHaveBeenCalled();

        // Advance past debounce
        await vi.advanceTimersByTimeAsync(150);

        // Should have persisted only once
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      });

      it('should handle flush() interrupting debounced persist', async () => {
        const note = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note);

        // Advance partway through debounce
        await vi.advanceTimersByTimeAsync(50);
        expect(mockFs.writeFile).not.toHaveBeenCalled();

        // Flush immediately
        await index.flush();

        // Should have persisted
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);

        // Advance past original debounce time - should NOT persist again
        await vi.advanceTimersByTimeAsync(100);
        expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
      });
    });

    describe('Race condition edge cases', () => {
      it('should handle toggle() on task being removed by indexNote()', () => {
        vi.setSystemTime(1000);

        const note1 = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note1);

        const { tasks } = index.list();
        const taskId = tasks[0].id;

        // Remove the task via indexNote
        const note2 = createNote('note1', 'Test Note', []);
        index.indexNote(note2);

        // Try to toggle the removed task
        const result = index.toggle(taskId);

        // Should return null for non-existent task
        expect(result).toBeNull();
        expect(index.size).toBe(0);
      });

      it('should handle indexNote() with stale data after toggle()', () => {
        vi.setSystemTime(1000);

        const note = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note);

        const { tasks } = index.list();
        const taskId = tasks[0].id;

        vi.setSystemTime(2000);

        // Toggle to complete
        index.toggle(taskId);
        expect(index.get(taskId)?.completed).toBe(true);
        expect(index.get(taskId)?.completedAt).toBe(2000);

        vi.setSystemTime(3000);

        // Re-index with stale (unchecked) data
        // This simulates document not being updated after toggle
        index.indexNote(note);

        // Document state should take precedence
        const task = index.get(taskId);
        expect(task?.completed).toBe(false);
        expect(task?.completedAt).toBeUndefined();
        // But updatedAt should reflect the re-indexing
        expect(task?.updatedAt).toBe(3000);
      });

      it('should preserve createdAt across all concurrent operations', () => {
        const createTime = 1000;
        vi.setSystemTime(createTime);

        const note = createNote('note1', 'Test Note', [
          { text: 'Task 1', checked: false, nodeKey: 'key1' },
        ]);
        index.indexNote(note);

        const { tasks } = index.list();
        const taskId = tasks[0].id;

        // Perform various operations at different times
        vi.setSystemTime(2000);
        index.toggle(taskId);

        vi.setSystemTime(3000);
        index.toggle(taskId);

        vi.setSystemTime(4000);
        index.reorder([taskId]);

        vi.setSystemTime(5000);
        index.indexNote(note);

        // createdAt should always be the original time
        const task = index.get(taskId);
        expect(task?.createdAt).toBe(createTime);
      });
    });
  });
});
