/**
 * Tests for TodoRouter
 *
 * These tests verify:
 * 1. All CRUD operations work correctly
 * 2. Input validation with Zod
 * 3. Proper error handling with TRPCError
 * 4. Status filtering for list operation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginStorage } from '@scribe/plugin-core';
import { TRPCError } from '@trpc/server';
import { TodoStore } from './store.js';
import { createTodoRouter } from './router.js';

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

describe('TodoRouter', () => {
  let store: TodoStore;
  let router: ReturnType<typeof createTodoRouter>;
  let caller: ReturnType<ReturnType<typeof createTodoRouter>['createCaller']>;

  beforeEach(() => {
    const mockStorage = createMockStorage();
    store = new TodoStore(mockStorage);
    router = createTodoRouter(store);
    caller = router.createCaller({});

    // Mock Date.now for deterministic IDs
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-17T12:00:00.000Z'));
  });

  // ==========================================================================
  // Create Tests
  // ==========================================================================

  describe('create', () => {
    it('creates a todo', async () => {
      const result = await caller.create({ title: 'Test task' });

      expect(result.title).toBe('Test task');
      expect(result.completed).toBe(false);
      expect(result.id).toBeDefined();
    });

    it('creates a todo with noteId', async () => {
      const result = await caller.create({
        title: 'Task for note',
        noteId: 'note-123',
      });

      expect(result.noteId).toBe('note-123');
    });

    it('validates title is not empty', async () => {
      await expect(caller.create({ title: '' })).rejects.toThrow();
    });

    it('validates title length', async () => {
      const longTitle = 'x'.repeat(501);
      await expect(caller.create({ title: longTitle })).rejects.toThrow();
    });

    it('accepts maximum length title', async () => {
      const maxTitle = 'x'.repeat(500);
      const result = await caller.create({ title: maxTitle });

      expect(result.title).toBe(maxTitle);
    });
  });

  // ==========================================================================
  // Get Tests
  // ==========================================================================

  describe('get', () => {
    it('returns todo by id', async () => {
      const created = await caller.create({ title: 'Test task' });
      const fetched = await caller.get({ id: created.id });

      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe('Test task');
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      try {
        await caller.get({ id: 'non-existent' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
        expect((error as TRPCError).message).toContain('non-existent');
      }
    });
  });

  // ==========================================================================
  // List Tests
  // ==========================================================================

  describe('list', () => {
    beforeEach(async () => {
      // Create some test todos
      vi.setSystemTime(new Date('2026-01-17T10:00:00.000Z'));
      await caller.create({ title: 'Task 1' });

      vi.setSystemTime(new Date('2026-01-17T11:00:00.000Z'));
      const task2 = await caller.create({ title: 'Task 2' });
      await caller.toggle({ id: task2.id }); // Mark as completed

      vi.setSystemTime(new Date('2026-01-17T12:00:00.000Z'));
      await caller.create({ title: 'Task 3' });
    });

    it('lists all todos by default', async () => {
      const todos = await caller.list({});

      expect(todos).toHaveLength(3);
    });

    it('lists all todos when status is "all"', async () => {
      const todos = await caller.list({ status: 'all' });

      expect(todos).toHaveLength(3);
    });

    it('lists only pending todos when status is "pending"', async () => {
      const todos = await caller.list({ status: 'pending' });

      expect(todos).toHaveLength(2);
      expect(todos.every((t) => !t.completed)).toBe(true);
    });

    it('lists only completed todos when status is "completed"', async () => {
      const todos = await caller.list({ status: 'completed' });

      expect(todos).toHaveLength(1);
      expect(todos[0].completed).toBe(true);
    });

    it('returns empty array when no todos exist', async () => {
      const emptyStore = new TodoStore(createMockStorage());
      const emptyRouter = createTodoRouter(emptyStore);
      const emptyCaller = emptyRouter.createCaller({});

      const todos = await emptyCaller.list({});

      expect(todos).toEqual([]);
    });
  });

  // ==========================================================================
  // Update Tests
  // ==========================================================================

  describe('update', () => {
    it('updates todo title', async () => {
      const created = await caller.create({ title: 'Original' });

      const updated = await caller.update({ id: created.id, title: 'Updated' });

      expect(updated.title).toBe('Updated');
    });

    it('updates todo completion status', async () => {
      const created = await caller.create({ title: 'Task' });

      const updated = await caller.update({ id: created.id, completed: true });

      expect(updated.completed).toBe(true);
    });

    it('updates both title and completion', async () => {
      const created = await caller.create({ title: 'Original' });

      const updated = await caller.update({
        id: created.id,
        title: 'Updated',
        completed: true,
      });

      expect(updated.title).toBe('Updated');
      expect(updated.completed).toBe(true);
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      try {
        await caller.update({ id: 'non-existent', title: 'Test' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }
    });

    it('validates updated title is not empty', async () => {
      const created = await caller.create({ title: 'Original' });

      await expect(caller.update({ id: created.id, title: '' })).rejects.toThrow();
    });

    it('validates updated title length', async () => {
      const created = await caller.create({ title: 'Original' });
      const longTitle = 'x'.repeat(501);

      await expect(caller.update({ id: created.id, title: longTitle })).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Toggle Tests
  // ==========================================================================

  describe('toggle', () => {
    it('toggles todo from incomplete to complete', async () => {
      const created = await caller.create({ title: 'Task' });
      expect(created.completed).toBe(false);

      const toggled = await caller.toggle({ id: created.id });
      expect(toggled.completed).toBe(true);
    });

    it('toggles todo from complete to incomplete', async () => {
      const created = await caller.create({ title: 'Task' });
      await caller.toggle({ id: created.id }); // Make complete

      const toggled = await caller.toggle({ id: created.id });
      expect(toggled.completed).toBe(false);
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      try {
        await caller.toggle({ id: 'non-existent' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // Delete Tests
  // ==========================================================================

  describe('delete', () => {
    it('deletes a todo and returns success', async () => {
      const created = await caller.create({ title: 'Task to delete' });

      const result = await caller.delete({ id: created.id });

      expect(result.success).toBe(true);
    });

    it('todo is not retrievable after deletion', async () => {
      const created = await caller.create({ title: 'Task to delete' });

      await caller.delete({ id: created.id });

      try {
        await caller.get({ id: created.id });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }
    });

    it('returns success even for non-existent id', async () => {
      // Delete is idempotent - succeeds even if the todo doesn't exist
      const result = await caller.delete({ id: 'non-existent' });

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Router Type Tests
  // ==========================================================================

  describe('router structure', () => {
    it('exposes expected procedures', () => {
      // Verify all expected methods exist on the caller
      expect(typeof caller.list).toBe('function');
      expect(typeof caller.get).toBe('function');
      expect(typeof caller.create).toBe('function');
      expect(typeof caller.update).toBe('function');
      expect(typeof caller.toggle).toBe('function');
      expect(typeof caller.delete).toBe('function');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    it('handles full CRUD lifecycle', async () => {
      // Create
      const created = await caller.create({ title: 'New task' });
      expect(created.title).toBe('New task');
      expect(created.completed).toBe(false);

      // Read
      const fetched = await caller.get({ id: created.id });
      expect(fetched.id).toBe(created.id);

      // Update
      const updated = await caller.update({ id: created.id, title: 'Updated task' });
      expect(updated.title).toBe('Updated task');

      // Toggle
      const toggled = await caller.toggle({ id: created.id });
      expect(toggled.completed).toBe(true);

      // List
      const todos = await caller.list({});
      expect(todos.some((t) => t.id === created.id)).toBe(true);

      // Delete
      const deleted = await caller.delete({ id: created.id });
      expect(deleted.success).toBe(true);

      // Verify deletion
      const finalList = await caller.list({});
      expect(finalList.some((t) => t.id === created.id)).toBe(false);
    });

    it('handles multiple todos correctly', async () => {
      // Create multiple todos
      const todo1 = await caller.create({ title: 'Task 1' });
      const todo2 = await caller.create({ title: 'Task 2' });
      const todo3 = await caller.create({ title: 'Task 3' });

      // Complete one
      await caller.toggle({ id: todo2.id });

      // List pending
      const pending = await caller.list({ status: 'pending' });
      expect(pending).toHaveLength(2);
      expect(pending.some((t) => t.id === todo1.id)).toBe(true);
      expect(pending.some((t) => t.id === todo3.id)).toBe(true);

      // List completed
      const completed = await caller.list({ status: 'completed' });
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe(todo2.id);

      // Delete one
      await caller.delete({ id: todo1.id });

      // List all
      const all = await caller.list({});
      expect(all).toHaveLength(2);
    });
  });
});
