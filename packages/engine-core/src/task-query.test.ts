/**
 * TaskQuery unit tests
 *
 * Tests for:
 * - Chainable filter methods (byNote, byStatus, byPriority, etc.)
 * - Query combinations (multiple filters)
 * - Sorting (by priority, by createdAt)
 * - Pagination (limit, offset, cursor)
 * - Cursor encoding/decoding
 * - TaskFilter adapter (fromTaskFilter)
 */

import { describe, it, expect } from 'vitest';
import { createTaskQuery, fromTaskFilter, encodeCursor, decodeCursor } from './task-query.js';
import type { Task } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test task with customizable properties.
 */
function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `test-task-${Math.random().toString(36).slice(2)}`,
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

/**
 * Create an array of test tasks.
 */
function createTasks(count: number, overridesFn?: (i: number) => Partial<Task>): Task[] {
  return Array.from({ length: count }, (_, i) =>
    createTask({
      id: `task-${i}`,
      priority: i,
      createdAt: 1000 + i * 100,
      updatedAt: 1000 + i * 100,
      ...(overridesFn?.(i) ?? {}),
    })
  );
}

// ============================================================================
// Cursor Encoding/Decoding Tests
// ============================================================================

describe('encodeCursor / decodeCursor', () => {
  it('should encode and decode a cursor correctly', () => {
    const index = 42;
    const cursor = encodeCursor(index);
    const decoded = decodeCursor(cursor);
    expect(decoded).toBe(index);
  });

  it('should encode cursor as base64', () => {
    const cursor = encodeCursor(10);
    // "10" in base64 is "MTA="
    expect(cursor).toBe(Buffer.from('10').toString('base64'));
  });

  it('should return null for invalid cursor', () => {
    expect(decodeCursor('not-valid-base64!!!')).toBeNull();
  });

  it('should return null for non-numeric cursor', () => {
    const cursor = Buffer.from('not-a-number').toString('base64');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('should handle zero index', () => {
    const cursor = encodeCursor(0);
    expect(decodeCursor(cursor)).toBe(0);
  });

  it('should handle large numbers', () => {
    const index = 999999;
    const cursor = encodeCursor(index);
    expect(decodeCursor(cursor)).toBe(index);
  });
});

// ============================================================================
// TaskQuery Filter Tests
// ============================================================================

describe('TaskQuery - Filtering', () => {
  describe('byStatus()', () => {
    it('should filter by open status', () => {
      const tasks = [
        createTask({ id: 'open1', completed: false }),
        createTask({ id: 'completed1', completed: true }),
        createTask({ id: 'open2', completed: false }),
      ];

      const result = createTaskQuery(tasks).byStatus('open').execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => !t.completed)).toBe(true);
    });

    it('should filter by completed status', () => {
      const tasks = [
        createTask({ id: 'open1', completed: false }),
        createTask({ id: 'completed1', completed: true }),
        createTask({ id: 'completed2', completed: true }),
      ];

      const result = createTaskQuery(tasks).byStatus('completed').execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.completed)).toBe(true);
    });
  });

  describe('byNote()', () => {
    it('should filter by note ID', () => {
      const note1 = createNoteId('note1');
      const note2 = createNoteId('note2');

      const tasks = [
        createTask({ id: 't1', noteId: note1 }),
        createTask({ id: 't2', noteId: note2 }),
        createTask({ id: 't3', noteId: note1 }),
      ];

      const result = createTaskQuery(tasks).byNote(note1).execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.noteId === note1)).toBe(true);
    });
  });

  describe('byPriority()', () => {
    it('should filter by exact priority', () => {
      const tasks = createTasks(5); // priorities 0-4

      const result = createTaskQuery(tasks).byPriority(2).execute();

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].priority).toBe(2);
    });
  });

  describe('byPriorityRange()', () => {
    it('should filter by priority range', () => {
      const tasks = createTasks(10); // priorities 0-9

      const result = createTaskQuery(tasks).byPriorityRange(3, 6).execute();

      expect(result.tasks).toHaveLength(4);
      expect(result.tasks.every((t) => t.priority >= 3 && t.priority <= 6)).toBe(true);
    });

    it('should handle single-value range', () => {
      const tasks = createTasks(5);

      const result = createTaskQuery(tasks).byPriorityRange(2, 2).execute();

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].priority).toBe(2);
    });
  });

  describe('createdAfter()', () => {
    it('should filter by creation date (inclusive)', () => {
      const tasks = [
        createTask({ id: 't1', createdAt: 1000 }),
        createTask({ id: 't2', createdAt: 2000 }),
        createTask({ id: 't3', createdAt: 3000 }),
      ];

      const result = createTaskQuery(tasks).createdAfter(2000).execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.createdAt >= 2000)).toBe(true);
    });
  });

  describe('createdBefore()', () => {
    it('should filter by creation date (inclusive)', () => {
      const tasks = [
        createTask({ id: 't1', createdAt: 1000 }),
        createTask({ id: 't2', createdAt: 2000 }),
        createTask({ id: 't3', createdAt: 3000 }),
      ];

      const result = createTaskQuery(tasks).createdBefore(2000).execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.createdAt <= 2000)).toBe(true);
    });
  });

  describe('completedAfter()', () => {
    it('should filter by completion date (completed tasks only)', () => {
      const tasks = [
        createTask({ id: 't1', completed: true, completedAt: 1000 }),
        createTask({ id: 't2', completed: true, completedAt: 2000 }),
        createTask({ id: 't3', completed: false }), // incomplete
        createTask({ id: 't4', completed: true, completedAt: 3000 }),
      ];

      const result = createTaskQuery(tasks).completedAfter(1500).execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.completed && t.completedAt! >= 1500)).toBe(true);
    });

    it('should exclude incomplete tasks', () => {
      const tasks = [
        createTask({ id: 't1', completed: false, createdAt: 5000 }),
        createTask({ id: 't2', completed: true, completedAt: 2000 }),
      ];

      const result = createTaskQuery(tasks).completedAfter(1000).execute();

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('t2');
    });
  });

  describe('completedBefore()', () => {
    it('should filter by completion date (completed tasks only)', () => {
      const tasks = [
        createTask({ id: 't1', completed: true, completedAt: 1000 }),
        createTask({ id: 't2', completed: true, completedAt: 2000 }),
        createTask({ id: 't3', completed: true, completedAt: 3000 }),
      ];

      const result = createTaskQuery(tasks).completedBefore(2500).execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.every((t) => t.completedAt! <= 2500)).toBe(true);
    });
  });
});

// ============================================================================
// TaskQuery Sorting Tests
// ============================================================================

describe('TaskQuery - Sorting', () => {
  describe('sortBy()', () => {
    it('should sort by priority ascending by default', () => {
      const tasks = [
        createTask({ id: 't1', priority: 2 }),
        createTask({ id: 't2', priority: 0 }),
        createTask({ id: 't3', priority: 1 }),
      ];

      const result = createTaskQuery(tasks).execute();

      expect(result.tasks.map((t) => t.priority)).toEqual([0, 1, 2]);
    });

    it('should sort by priority descending', () => {
      const tasks = [
        createTask({ id: 't1', priority: 2 }),
        createTask({ id: 't2', priority: 0 }),
        createTask({ id: 't3', priority: 1 }),
      ];

      const result = createTaskQuery(tasks).sortBy('priority', 'desc').execute();

      expect(result.tasks.map((t) => t.priority)).toEqual([2, 1, 0]);
    });

    it('should sort by createdAt ascending', () => {
      const tasks = [
        createTask({ id: 't1', createdAt: 3000 }),
        createTask({ id: 't2', createdAt: 1000 }),
        createTask({ id: 't3', createdAt: 2000 }),
      ];

      const result = createTaskQuery(tasks).sortBy('createdAt', 'asc').execute();

      expect(result.tasks.map((t) => t.createdAt)).toEqual([1000, 2000, 3000]);
    });

    it('should sort by createdAt descending', () => {
      const tasks = [
        createTask({ id: 't1', createdAt: 3000 }),
        createTask({ id: 't2', createdAt: 1000 }),
        createTask({ id: 't3', createdAt: 2000 }),
      ];

      const result = createTaskQuery(tasks).sortBy('createdAt', 'desc').execute();

      expect(result.tasks.map((t) => t.createdAt)).toEqual([3000, 2000, 1000]);
    });

    it('should sort completed tasks after incomplete when sorting by priority', () => {
      const tasks = [
        createTask({ id: 't1', priority: 0, completed: true }),
        createTask({ id: 't2', priority: 1, completed: false }),
        createTask({ id: 't3', priority: 2, completed: false }),
      ];

      const result = createTaskQuery(tasks).sortBy('priority', 'asc').execute();

      // Incomplete tasks first, then completed
      expect(result.tasks.map((t) => t.id)).toEqual(['t2', 't3', 't1']);
    });

    it('should use createdAt as tertiary sort when priorities are equal', () => {
      const tasks = [
        createTask({ id: 't1', priority: 0, createdAt: 1000 }),
        createTask({ id: 't2', priority: 0, createdAt: 3000 }),
        createTask({ id: 't3', priority: 0, createdAt: 2000 }),
      ];

      const result = createTaskQuery(tasks).sortBy('priority', 'asc').execute();

      // Newest first within same priority (desc by createdAt)
      expect(result.tasks.map((t) => t.createdAt)).toEqual([3000, 2000, 1000]);
    });
  });
});

// ============================================================================
// TaskQuery Pagination Tests
// ============================================================================

describe('TaskQuery - Pagination', () => {
  describe('limit()', () => {
    it('should limit results', () => {
      const tasks = createTasks(10);

      const result = createTaskQuery(tasks).limit(3).execute();

      expect(result.tasks).toHaveLength(3);
      expect(result.nextCursor).toBeDefined();
    });

    it('should return no cursor when all results fit', () => {
      const tasks = createTasks(5);

      const result = createTaskQuery(tasks).limit(10).execute();

      expect(result.tasks).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('offset()', () => {
    it('should skip tasks using offset', () => {
      const tasks = createTasks(5); // priorities 0-4

      const result = createTaskQuery(tasks).offset(2).execute();

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].priority).toBe(2);
    });

    it('should combine offset with limit', () => {
      const tasks = createTasks(10);

      const result = createTaskQuery(tasks).offset(3).limit(3).execute();

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks.map((t) => t.priority)).toEqual([3, 4, 5]);
    });
  });

  describe('cursor()', () => {
    it('should paginate with cursor', () => {
      const tasks = createTasks(10);

      // Get first page
      const page1 = createTaskQuery(tasks).limit(3).execute();
      expect(page1.tasks).toHaveLength(3);
      expect(page1.nextCursor).toBeDefined();

      // Get second page using cursor
      const page2 = createTaskQuery(tasks).limit(3).cursor(page1.nextCursor!).execute();
      expect(page2.tasks).toHaveLength(3);
      expect(page2.nextCursor).toBeDefined();

      // Verify no duplicates
      const page1Ids = page1.tasks.map((t) => t.id);
      const page2Ids = page2.tasks.map((t) => t.id);
      expect(page1Ids).not.toContain(page2Ids[0]);
    });

    it('should handle invalid cursor gracefully', () => {
      const tasks = createTasks(5);

      const result = createTaskQuery(tasks).cursor('invalid-cursor').execute();

      // Should start from beginning
      expect(result.tasks[0].priority).toBe(0);
    });

    it('cursor should take precedence over offset', () => {
      const tasks = createTasks(10);
      const cursor = encodeCursor(5); // Start at index 5

      const result = createTaskQuery(tasks).offset(2).cursor(cursor).execute();

      // Cursor (index 5) should take precedence over offset (2)
      expect(result.tasks[0].priority).toBe(5);
    });
  });

  describe('totalCount', () => {
    it('should return total count before pagination', () => {
      const tasks = createTasks(10);

      const result = createTaskQuery(tasks).limit(3).execute();

      expect(result.tasks).toHaveLength(3);
      expect(result.totalCount).toBe(10);
    });

    it('should return filtered count', () => {
      const tasks = [
        ...createTasks(5, () => ({ completed: false })),
        ...createTasks(5, () => ({ completed: true })),
      ];

      const result = createTaskQuery(tasks).byStatus('open').limit(2).execute();

      expect(result.tasks).toHaveLength(2);
      expect(result.totalCount).toBe(5); // Only open tasks
    });
  });
});

// ============================================================================
// TaskQuery Chaining/Combinations Tests
// ============================================================================

describe('TaskQuery - Chaining', () => {
  it('should combine multiple filters', () => {
    const note1 = createNoteId('note1');
    const note2 = createNoteId('note2');

    const tasks = [
      createTask({ id: 't1', noteId: note1, completed: false, priority: 0 }),
      createTask({ id: 't2', noteId: note1, completed: true, priority: 1 }),
      createTask({ id: 't3', noteId: note2, completed: false, priority: 2 }),
      createTask({ id: 't4', noteId: note1, completed: false, priority: 3 }),
    ];

    const result = createTaskQuery(tasks).byNote(note1).byStatus('open').execute();

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.every((t) => t.noteId === note1 && !t.completed)).toBe(true);
  });

  it('should chain filters with sorting', () => {
    const tasks = [
      createTask({ id: 't1', completed: false, createdAt: 3000 }),
      createTask({ id: 't2', completed: true, createdAt: 1000 }),
      createTask({ id: 't3', completed: false, createdAt: 2000 }),
    ];

    const result = createTaskQuery(tasks).byStatus('open').sortBy('createdAt', 'asc').execute();

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.map((t) => t.createdAt)).toEqual([2000, 3000]);
  });

  it('should chain filters with pagination', () => {
    const tasks = createTasks(20, (i) => ({ completed: i < 10 })); // 10 incomplete, 10 complete

    const result = createTaskQuery(tasks)
      .byStatus('open')
      .sortBy('priority', 'asc')
      .limit(5)
      .execute();

    expect(result.tasks).toHaveLength(5);
    expect(result.tasks.every((t) => !t.completed)).toBe(true);
    expect(result.nextCursor).toBeDefined();
    expect(result.totalCount).toBe(10);
  });

  it('should be immutable (cloning)', () => {
    const tasks = createTasks(10);

    const baseQuery = createTaskQuery(tasks);
    const filteredQuery = baseQuery.byStatus('open');
    const limitedQuery = filteredQuery.limit(5);

    // Each should be independent
    const baseResult = baseQuery.execute();
    const filteredResult = filteredQuery.execute();
    const limitedResult = limitedQuery.execute();

    expect(baseResult.tasks).toHaveLength(10);
    expect(filteredResult.tasks).toHaveLength(10); // All are incomplete by default
    expect(limitedResult.tasks).toHaveLength(5);
  });

  it('should filter by date range', () => {
    const tasks = [
      createTask({ id: 't1', createdAt: 1000, priority: 0 }),
      createTask({ id: 't2', createdAt: 2000, priority: 1 }),
      createTask({ id: 't3', createdAt: 3000, priority: 2 }),
      createTask({ id: 't4', createdAt: 4000, priority: 3 }),
    ];

    const result = createTaskQuery(tasks)
      .createdAfter(1500)
      .createdBefore(3500)
      .sortBy('createdAt', 'asc')
      .execute();

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.map((t) => t.createdAt)).toEqual([2000, 3000]);
  });
});

// ============================================================================
// fromTaskFilter Adapter Tests
// ============================================================================

describe('fromTaskFilter', () => {
  it('should convert empty filter to default query', () => {
    const tasks = createTasks(5);

    const result = fromTaskFilter(tasks).execute();

    expect(result.tasks).toHaveLength(5);
  });

  it('should convert filter with completed', () => {
    const tasks = [createTask({ completed: false }), createTask({ completed: true })];

    const result = fromTaskFilter(tasks, { completed: true }).execute();

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].completed).toBe(true);
  });

  it('should convert filter with noteId', () => {
    const note1 = createNoteId('note1');
    const tasks = [createTask({ noteId: note1 }), createTask({ noteId: createNoteId('note2') })];

    const result = fromTaskFilter(tasks, { noteId: note1 }).execute();

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].noteId).toBe(note1);
  });

  it('should convert filter with date ranges', () => {
    const tasks = [
      createTask({ createdAt: 1000 }),
      createTask({ createdAt: 2000 }),
      createTask({ createdAt: 3000 }),
    ];

    const result = fromTaskFilter(tasks, {
      createdAfter: 1500,
      createdBefore: 2500,
    }).execute();

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].createdAt).toBe(2000);
  });

  it('should convert filter with sorting', () => {
    const tasks = [
      createTask({ createdAt: 3000 }),
      createTask({ createdAt: 1000 }),
      createTask({ createdAt: 2000 }),
    ];

    const result = fromTaskFilter(tasks, {
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }).execute();

    expect(result.tasks.map((t) => t.createdAt)).toEqual([3000, 2000, 1000]);
  });

  it('should convert filter with pagination', () => {
    const tasks = createTasks(10);

    const result = fromTaskFilter(tasks, { limit: 3 }).execute();

    expect(result.tasks).toHaveLength(3);
    expect(result.nextCursor).toBeDefined();
  });

  it('should convert filter with cursor', () => {
    const tasks = createTasks(10);
    const cursor = encodeCursor(5);

    const result = fromTaskFilter(tasks, { cursor, limit: 3 }).execute();

    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].priority).toBe(5);
  });

  it('should convert complex filter', () => {
    const note1 = createNoteId('note1');
    const tasks = [
      createTask({ noteId: note1, completed: false, createdAt: 1000, priority: 3 }),
      createTask({ noteId: note1, completed: true, createdAt: 2000, priority: 1 }),
      createTask({ noteId: createNoteId('note2'), completed: false, createdAt: 3000, priority: 2 }),
      createTask({ noteId: note1, completed: false, createdAt: 4000, priority: 0 }),
    ];

    const result = fromTaskFilter(tasks, {
      noteId: note1,
      completed: false,
      createdAfter: 500,
      sortBy: 'priority',
      sortOrder: 'asc',
      limit: 10,
    }).execute();

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].priority).toBe(0);
    expect(result.tasks[1].priority).toBe(3);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('TaskQuery - Edge Cases', () => {
  it('should handle empty task list', () => {
    const result = createTaskQuery([]).execute();

    expect(result.tasks).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
    expect(result.totalCount).toBe(0);
  });

  it('should handle single task', () => {
    const tasks = [createTask()];

    const result = createTaskQuery(tasks).execute();

    expect(result.tasks).toHaveLength(1);
    expect(result.nextCursor).toBeUndefined();
  });

  it('should handle filter with no matches', () => {
    const tasks = createTasks(5, () => ({ completed: false }));

    const result = createTaskQuery(tasks).byStatus('completed').execute();

    expect(result.tasks).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('should handle Map.values() as input', () => {
    const taskMap = new Map<string, Task>();
    createTasks(5).forEach((t) => taskMap.set(t.id, t));

    const result = createTaskQuery(taskMap.values()).execute();

    expect(result.tasks).toHaveLength(5);
  });

  it('should handle generator as input', () => {
    function* generateTasks() {
      yield createTask({ id: 't1', priority: 2 });
      yield createTask({ id: 't2', priority: 0 });
      yield createTask({ id: 't3', priority: 1 });
    }

    const result = createTaskQuery(generateTasks()).execute();

    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.map((t) => t.priority)).toEqual([0, 1, 2]);
  });
});
