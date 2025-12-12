/**
 * TaskIndex unit tests
 *
 * Tests for:
 * - Reconciliation rules (nodeKey first, textHash fallback)
 * - Priority assignment for new tasks
 * - completedAt handling (set when checked, clear when unchecked)
 * - Pagination support with cursor-based paging
 * - JSONL persistence (atomic temp+rename, debounced writes)
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { TaskIndex } from './task-index.js';
import type { Note, LexicalState, Task } from '@scribe/shared';

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
): LexicalState {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'check',
          children: tasks.map((t, index) => ({
            type: 'listitem',
            __key: t.nodeKey,
            __checked: t.checked,
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
    id,
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
        noteId: 'note1',
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
        noteId: 'note2',
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
        noteId: 'note1',
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
        noteId: 'note1',
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
        noteId: 'note1',
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

      const noteTaskIds = index.getTaskIdsForNote('note1');
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
      const changes = index.removeNote('note1');

      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('removed');
      expect(index.size).toBe(1);
      expect(index.getTaskIdsForNote('note1').size).toBe(0);
    });

    it('should return empty array for non-existent note', () => {
      const changes = index.removeNote('nonexistent');
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
      const { tasks } = index.list({ noteId: 'note1' });
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

  describe('Edge cases', () => {
    it('should handle empty note', () => {
      const note = createNote('note1', 'Test Note', []);
      const changes = index.indexNote(note);

      expect(changes.length).toBe(0);
      expect(index.size).toBe(0);
    });

    it('should handle note with non-checklist items', () => {
      const note: Note = {
        id: 'note1',
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
});
