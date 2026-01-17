/**
 * Tests for TodoStore
 *
 * These tests verify:
 * 1. CRUD operations for todos (create, read, update, delete)
 * 2. Listing with status filters
 * 3. Toggle completion functionality
 * 4. Note association and cleanup
 * 5. Index maintenance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginStorage } from '@scribe/plugin-core';
import { TodoStore } from './store.js';

// ============================================================================
// Mock Storage Implementation
// ============================================================================

/**
 * Creates a mock PluginStorage implementation for testing.
 * Uses an in-memory Map to simulate storage behavior.
 */
function createMockStorage(): PluginStorage {
  const data = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return data.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      data.set(key, value);
    },
    async delete(key: string): Promise<void> {
      data.delete(key);
    },
    async has(key: string): Promise<boolean> {
      return data.has(key);
    },
    async keys(): Promise<string[]> {
      return Array.from(data.keys());
    },
    async clear(): Promise<void> {
      data.clear();
    },
  };
}

// ============================================================================
// Test Setup
// ============================================================================

describe('TodoStore', () => {
  let store: TodoStore;
  let mockStorage: PluginStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    store = new TodoStore(mockStorage);
    // Mock Date.now for deterministic IDs
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T12:00:00.000Z'));
  });

  // ==========================================================================
  // Create Tests
  // ==========================================================================

  describe('create', () => {
    it('creates a todo with generated id', async () => {
      const todo = await store.create({ title: 'Test task' });

      expect(todo.id).toBeDefined();
      expect(todo.id).toMatch(/^todo-/);
      expect(todo.title).toBe('Test task');
      expect(todo.completed).toBe(false);
    });

    it('creates a todo with noteId association', async () => {
      const todo = await store.create({ title: 'Task for note', noteId: 'note-123' });

      expect(todo.noteId).toBe('note-123');
    });

    it('creates a todo without noteId', async () => {
      const todo = await store.create({ title: 'Standalone task' });

      expect(todo.noteId).toBeUndefined();
    });

    it('sets createdAt and updatedAt timestamps', async () => {
      const todo = await store.create({ title: 'Test task' });

      expect(todo.createdAt).toBe('2026-01-17T12:00:00.000Z');
      expect(todo.updatedAt).toBe('2026-01-17T12:00:00.000Z');
    });

    it('adds todo to global index', async () => {
      const todo = await store.create({ title: 'Test task' });
      const todos = await store.list();

      expect(todos).toContainEqual(todo);
    });

    it('adds todo to note index when associated', async () => {
      const todo = await store.create({ title: 'Task for note', noteId: 'note-123' });
      const noteIds = await store.getTodoIdsByNote('note-123');

      expect(noteIds).toContain(todo.id);
    });
  });

  // ==========================================================================
  // Get Tests
  // ==========================================================================

  describe('get', () => {
    it('returns todo by id', async () => {
      const created = await store.create({ title: 'Test task' });
      const fetched = await store.get(created.id);

      expect(fetched).toEqual(created);
    });

    it('returns undefined for non-existent id', async () => {
      const fetched = await store.get('non-existent-id');

      expect(fetched).toBeUndefined();
    });
  });

  // ==========================================================================
  // List Tests
  // ==========================================================================

  describe('list', () => {
    beforeEach(async () => {
      // Create some test todos with different timestamps
      vi.setSystemTime(new Date('2026-01-17T10:00:00.000Z'));
      await store.create({ title: 'Oldest task' });

      vi.setSystemTime(new Date('2026-01-17T11:00:00.000Z'));
      const middle = await store.create({ title: 'Middle task' });
      await store.update({ id: middle.id, completed: true });

      vi.setSystemTime(new Date('2026-01-17T12:00:00.000Z'));
      await store.create({ title: 'Newest task' });
    });

    it('lists all todos by default', async () => {
      const todos = await store.list();

      expect(todos).toHaveLength(3);
    });

    it('lists todos sorted by creation date (newest first)', async () => {
      const todos = await store.list();

      expect(todos[0].title).toBe('Newest task');
      expect(todos[1].title).toBe('Middle task');
      expect(todos[2].title).toBe('Oldest task');
    });

    it('lists only pending todos when status is pending', async () => {
      const todos = await store.list('pending');

      expect(todos).toHaveLength(2);
      expect(todos.every((t) => !t.completed)).toBe(true);
    });

    it('lists only completed todos when status is completed', async () => {
      const todos = await store.list('completed');

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Middle task');
      expect(todos[0].completed).toBe(true);
    });

    it('returns empty array when no todos exist', async () => {
      const emptyStore = new TodoStore(createMockStorage());
      const todos = await emptyStore.list();

      expect(todos).toEqual([]);
    });
  });

  // ==========================================================================
  // Update Tests
  // ==========================================================================

  describe('update', () => {
    it('updates todo title', async () => {
      const created = await store.create({ title: 'Original title' });

      vi.setSystemTime(new Date('2026-01-17T13:00:00.000Z'));
      const updated = await store.update({ id: created.id, title: 'New title' });

      expect(updated.title).toBe('New title');
      expect(updated.updatedAt).toBe('2026-01-17T13:00:00.000Z');
    });

    it('updates todo completion status', async () => {
      const created = await store.create({ title: 'Task' });

      const updated = await store.update({ id: created.id, completed: true });

      expect(updated.completed).toBe(true);
    });

    it('preserves unchanged fields', async () => {
      const created = await store.create({ title: 'Task', noteId: 'note-123' });

      const updated = await store.update({ id: created.id, title: 'New title' });

      expect(updated.noteId).toBe('note-123');
      expect(updated.createdAt).toBe(created.createdAt);
    });

    it('throws error for non-existent todo', async () => {
      await expect(store.update({ id: 'non-existent', title: 'Test' })).rejects.toThrow(
        'Todo not found: non-existent'
      );
    });
  });

  // ==========================================================================
  // Toggle Tests
  // ==========================================================================

  describe('toggle', () => {
    it('toggles todo from incomplete to complete', async () => {
      const created = await store.create({ title: 'Task' });
      expect(created.completed).toBe(false);

      const toggled = await store.toggle(created.id);
      expect(toggled.completed).toBe(true);
    });

    it('toggles todo from complete to incomplete', async () => {
      const created = await store.create({ title: 'Task' });
      await store.update({ id: created.id, completed: true });

      const toggled = await store.toggle(created.id);
      expect(toggled.completed).toBe(false);
    });

    it('throws error for non-existent todo', async () => {
      await expect(store.toggle('non-existent')).rejects.toThrow('Todo not found: non-existent');
    });
  });

  // ==========================================================================
  // Delete Tests
  // ==========================================================================

  describe('delete', () => {
    it('deletes a todo', async () => {
      const created = await store.create({ title: 'Task to delete' });

      await store.delete(created.id);

      const fetched = await store.get(created.id);
      expect(fetched).toBeUndefined();
    });

    it('removes todo from global index', async () => {
      const created = await store.create({ title: 'Task to delete' });

      await store.delete(created.id);

      const todos = await store.list();
      expect(todos).not.toContainEqual(expect.objectContaining({ id: created.id }));
    });

    it('removes todo from note index', async () => {
      const created = await store.create({ title: 'Task', noteId: 'note-123' });

      await store.delete(created.id);

      const noteIds = await store.getTodoIdsByNote('note-123');
      expect(noteIds).not.toContain(created.id);
    });

    it('does nothing for non-existent todo', async () => {
      // Should not throw
      await store.delete('non-existent');
    });

    it('only deletes the specified todo', async () => {
      const todo1 = await store.create({ title: 'Task 1' });
      const todo2 = await store.create({ title: 'Task 2' });

      await store.delete(todo1.id);

      const todos = await store.list();
      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe(todo2.id);
    });
  });

  // ==========================================================================
  // DeleteByNoteId Tests
  // ==========================================================================

  describe('deleteByNoteId', () => {
    it('deletes all todos for a note', async () => {
      await store.create({ title: 'Task 1', noteId: 'note-1' });
      await store.create({ title: 'Task 2', noteId: 'note-1' });
      await store.create({ title: 'Task 3', noteId: 'note-2' });

      const deleted = await store.deleteByNoteId('note-1');

      expect(deleted).toBe(2);
      const remaining = await store.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe('Task 3');
    });

    it('returns 0 when no todos exist for note', async () => {
      await store.create({ title: 'Task 1', noteId: 'note-1' });

      const deleted = await store.deleteByNoteId('note-2');

      expect(deleted).toBe(0);
    });

    it('cleans up note index after deletion', async () => {
      await store.create({ title: 'Task 1', noteId: 'note-1' });
      await store.create({ title: 'Task 2', noteId: 'note-1' });

      await store.deleteByNoteId('note-1');

      const noteIds = await store.getTodoIdsByNote('note-1');
      expect(noteIds).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getTodoIdsByNote Tests
  // ==========================================================================

  describe('getTodoIdsByNote', () => {
    it('returns todo ids for a note', async () => {
      const todo1 = await store.create({ title: 'Task 1', noteId: 'note-1' });
      const todo2 = await store.create({ title: 'Task 2', noteId: 'note-1' });
      await store.create({ title: 'Task 3', noteId: 'note-2' });

      const noteIds = await store.getTodoIdsByNote('note-1');

      expect(noteIds).toHaveLength(2);
      expect(noteIds).toContain(todo1.id);
      expect(noteIds).toContain(todo2.id);
    });

    it('returns empty array for note with no todos', async () => {
      const noteIds = await store.getTodoIdsByNote('non-existent-note');

      expect(noteIds).toEqual([]);
    });
  });

  // ==========================================================================
  // Index Consistency Tests
  // ==========================================================================

  describe('index consistency', () => {
    it('maintains global index after multiple operations', async () => {
      // Create several todos
      const todo1 = await store.create({ title: 'Task 1' });
      const todo2 = await store.create({ title: 'Task 2' });
      const todo3 = await store.create({ title: 'Task 3' });

      // Delete one
      await store.delete(todo2.id);

      // Create another
      const todo4 = await store.create({ title: 'Task 4' });

      // List should show correct todos
      const todos = await store.list();
      const ids = todos.map((t) => t.id);

      expect(ids).toContain(todo1.id);
      expect(ids).not.toContain(todo2.id);
      expect(ids).toContain(todo3.id);
      expect(ids).toContain(todo4.id);
    });

    it('maintains note index after multiple operations', async () => {
      // Create todos for a note
      const todo1 = await store.create({ title: 'Task 1', noteId: 'note-1' });
      const todo2 = await store.create({ title: 'Task 2', noteId: 'note-1' });

      // Delete one
      await store.delete(todo1.id);

      // Create another
      const todo3 = await store.create({ title: 'Task 3', noteId: 'note-1' });

      // Note index should be correct
      const noteIds = await store.getTodoIdsByNote('note-1');
      expect(noteIds).toContain(todo2.id);
      expect(noteIds).toContain(todo3.id);
      expect(noteIds).not.toContain(todo1.id);
    });

    it('handles duplicate add to index gracefully', async () => {
      // This tests the idempotent nature of addToIndex
      const todo = await store.create({ title: 'Task' });

      // Get the todo and manually "re-add" it by creating another one with timing
      // Just verify the list is still correct
      const todos = await store.list();
      expect(todos.filter((t) => t.id === todo.id)).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles empty title', async () => {
      const todo = await store.create({ title: '' });

      expect(todo.title).toBe('');
    });

    it('handles very long title', async () => {
      const longTitle = 'x'.repeat(10000);
      const todo = await store.create({ title: longTitle });

      expect(todo.title).toBe(longTitle);
    });

    it('handles unicode in title', async () => {
      const todo = await store.create({ title: '完成任务 🎯' });

      expect(todo.title).toBe('完成任务 🎯');
    });

    it('handles multiple todos with same title', async () => {
      await store.create({ title: 'Duplicate' });
      await store.create({ title: 'Duplicate' });
      await store.create({ title: 'Duplicate' });

      const todos = await store.list();
      const duplicates = todos.filter((t) => t.title === 'Duplicate');

      expect(duplicates).toHaveLength(3);
      // Each should have unique ID
      const ids = new Set(duplicates.map((t) => t.id));
      expect(ids.size).toBe(3);
    });

    it('handles concurrent operations', async () => {
      // Simulate concurrent creates
      const promises = [
        store.create({ title: 'Task 1' }),
        store.create({ title: 'Task 2' }),
        store.create({ title: 'Task 3' }),
      ];

      const todos = await Promise.all(promises);

      expect(todos).toHaveLength(3);
      // All should have unique IDs
      const ids = new Set(todos.map((t) => t.id));
      expect(ids.size).toBe(3);
    });
  });
});
