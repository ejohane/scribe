/**
 * Tests for Todo Plugin Event Handlers
 *
 * These tests verify:
 * 1. note:deleted event triggers todo cleanup
 * 2. Cleanup count is logged appropriately
 * 3. Errors are logged and re-thrown
 * 4. Handler is idempotent (safe to call multiple times)
 * 5. Handler gracefully handles non-existent notes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginStorage, PluginLogger, NoteDeletedEvent } from '@scribe/plugin-core';
import type { PluginEventHandlers } from '@scribe/plugin-core';
import { TodoStore } from './store.js';
import { createEventHandlers } from './events.js';

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Creates a mock PluginStorage implementation for testing.
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

/**
 * Creates a mock PluginLogger for testing.
 */
function createMockLogger(): PluginLogger & {
  debugCalls: Array<{ message: string; data?: Record<string, unknown> }>;
  infoCalls: Array<{ message: string; data?: Record<string, unknown> }>;
  warnCalls: Array<{ message: string; data?: Record<string, unknown> }>;
  errorCalls: Array<{ message: string; data?: Record<string, unknown> }>;
  reset: () => void;
} {
  const debugCalls: Array<{ message: string; data?: Record<string, unknown> }> = [];
  const infoCalls: Array<{ message: string; data?: Record<string, unknown> }> = [];
  const warnCalls: Array<{ message: string; data?: Record<string, unknown> }> = [];
  const errorCalls: Array<{ message: string; data?: Record<string, unknown> }> = [];

  return {
    debug(message: string, data?: Record<string, unknown>) {
      debugCalls.push({ message, data });
    },
    info(message: string, data?: Record<string, unknown>) {
      infoCalls.push({ message, data });
    },
    warn(message: string, data?: Record<string, unknown>) {
      warnCalls.push({ message, data });
    },
    error(message: string, data?: Record<string, unknown>) {
      errorCalls.push({ message, data });
    },
    debugCalls,
    infoCalls,
    warnCalls,
    errorCalls,
    reset() {
      debugCalls.length = 0;
      infoCalls.length = 0;
      warnCalls.length = 0;
      errorCalls.length = 0;
    },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Todo event handlers', () => {
  let store: TodoStore;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let handlers: PluginEventHandlers;

  beforeEach(() => {
    const mockStorage = createMockStorage();
    mockLogger = createMockLogger();
    store = new TodoStore(mockStorage);
    handlers = createEventHandlers(store, mockLogger);
  });

  // ==========================================================================
  // note:deleted Handler Tests
  // ==========================================================================

  describe('note:deleted', () => {
    it('deletes todos associated with the note', async () => {
      // Create todos for a note
      await store.create({ title: 'Task 1', noteId: 'note-1' });
      await store.create({ title: 'Task 2', noteId: 'note-1' });
      await store.create({ title: 'Other note task', noteId: 'note-2' });

      // Get the handler
      const noteDeletedHandler = handlers['note:deleted'];
      expect(noteDeletedHandler).toBeDefined();

      // Trigger event
      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };
      await noteDeletedHandler!(event);

      // Verify cleanup - only note-1 todos should be deleted
      const remaining = await store.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe('Other note task');
    });

    it('logs cleanup count when todos are deleted', async () => {
      // Create todos
      await store.create({ title: 'Task 1', noteId: 'note-1' });
      await store.create({ title: 'Task 2', noteId: 'note-1' });

      // Trigger event
      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };
      await handlers['note:deleted']!(event);

      // Check info log
      expect(mockLogger.infoCalls).toHaveLength(1);
      expect(mockLogger.infoCalls[0].message).toContain('Cleaned up 2 todo(s)');
      expect(mockLogger.infoCalls[0].data).toEqual({
        noteId: 'note-1',
        deletedCount: 2,
      });
    });

    it('logs debug message on event received', async () => {
      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };
      await handlers['note:deleted']!(event);

      expect(mockLogger.debugCalls).toHaveLength(1);
      expect(mockLogger.debugCalls[0].message).toBe('Note deleted event received');
      expect(mockLogger.debugCalls[0].data).toEqual({ noteId: 'note-1' });
    });

    it('does not log info when no todos to clean up', async () => {
      // Trigger event for note with no todos
      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-with-no-todos',
      };
      await handlers['note:deleted']!(event);

      // Should have debug log but no info log
      expect(mockLogger.debugCalls).toHaveLength(1);
      expect(mockLogger.infoCalls).toHaveLength(0);
    });

    it('handles non-existent note gracefully', async () => {
      // Should not throw
      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'non-existent-note',
      };
      // The handler should complete without throwing
      await handlers['note:deleted']!(event);
      // If we reach here, the handler completed successfully
      expect(true).toBe(true);
    });

    it('is idempotent - safe to call multiple times', async () => {
      // Create todos
      await store.create({ title: 'Task 1', noteId: 'note-1' });

      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };

      // Call handler multiple times
      await handlers['note:deleted']!(event);
      mockLogger.reset();
      await handlers['note:deleted']!(event);

      // Second call should complete without error
      // And should not log any deletions (0 todos to delete)
      expect(mockLogger.infoCalls).toHaveLength(0);
      expect(mockLogger.errorCalls).toHaveLength(0);
    });

    it('logs and re-throws errors from store operations', async () => {
      // Create a store that throws on deleteByNoteId
      const errorStore = {
        deleteByNoteId: vi.fn().mockRejectedValue(new Error('Storage failure')),
      } as unknown as TodoStore;

      const errorHandlers = createEventHandlers(errorStore, mockLogger);

      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };

      // Should throw the error
      await expect(errorHandlers['note:deleted']!(event)).rejects.toThrow('Storage failure');

      // Should have logged the error
      expect(mockLogger.errorCalls).toHaveLength(1);
      expect(mockLogger.errorCalls[0].message).toBe('Failed to clean up todos for deleted note');
      expect(mockLogger.errorCalls[0].data).toEqual({
        noteId: 'note-1',
        error: 'Storage failure',
      });
    });

    it('handles non-Error objects thrown by store', async () => {
      // Create a store that throws a string
      const errorStore = {
        deleteByNoteId: vi.fn().mockRejectedValue('String error'),
      } as unknown as TodoStore;

      const errorHandlers = createEventHandlers(errorStore, mockLogger);

      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };

      await expect(errorHandlers['note:deleted']!(event)).rejects.toBe('String error');

      // Error should be converted to string
      expect(mockLogger.errorCalls[0].data?.error).toBe('String error');
    });
  });

  // ==========================================================================
  // Handler Registration Tests
  // ==========================================================================

  describe('handler registration', () => {
    it('returns handlers object with note:deleted handler', () => {
      expect(handlers).toHaveProperty('note:deleted');
      expect(typeof handlers['note:deleted']).toBe('function');
    });

    it('only includes note:deleted handler', () => {
      // Verify structure matches PluginEventHandlers interface
      expect(Object.keys(handlers)).toEqual(['note:deleted']);
    });
  });

  // ==========================================================================
  // Integration-like Tests
  // ==========================================================================

  describe('integration scenarios', () => {
    it('cleans up todos when note with many tasks is deleted', async () => {
      // Create many todos for the same note
      for (let i = 0; i < 10; i++) {
        await store.create({ title: `Task ${i}`, noteId: 'busy-note' });
      }

      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'busy-note',
      };
      await handlers['note:deleted']!(event);

      const remaining = await store.list();
      expect(remaining).toHaveLength(0);
      expect(mockLogger.infoCalls[0].message).toContain('Cleaned up 10 todo(s)');
    });

    it('only affects specified note, preserves others', async () => {
      // Create todos across multiple notes
      await store.create({ title: 'Note 1 Task A', noteId: 'note-1' });
      await store.create({ title: 'Note 1 Task B', noteId: 'note-1' });
      await store.create({ title: 'Note 2 Task A', noteId: 'note-2' });
      await store.create({ title: 'Note 3 Task A', noteId: 'note-3' });
      await store.create({ title: 'Global Task', noteId: undefined });

      // Delete only note-1
      const event: NoteDeletedEvent = {
        type: 'note:deleted',
        noteId: 'note-1',
      };
      await handlers['note:deleted']!(event);

      const remaining = await store.list();
      expect(remaining).toHaveLength(3);

      const titles = remaining.map((t) => t.title);
      expect(titles).toContain('Note 2 Task A');
      expect(titles).toContain('Note 3 Task A');
      expect(titles).toContain('Global Task');
      expect(titles).not.toContain('Note 1 Task A');
      expect(titles).not.toContain('Note 1 Task B');
    });

    it('handles rapid consecutive deletions', async () => {
      // Create todos for multiple notes
      await store.create({ title: 'Task 1', noteId: 'note-1' });
      await store.create({ title: 'Task 2', noteId: 'note-2' });
      await store.create({ title: 'Task 3', noteId: 'note-3' });

      // Rapid consecutive deletions
      await Promise.all([
        handlers['note:deleted']!({ type: 'note:deleted', noteId: 'note-1' }),
        handlers['note:deleted']!({ type: 'note:deleted', noteId: 'note-2' }),
        handlers['note:deleted']!({ type: 'note:deleted', noteId: 'note-3' }),
      ]);

      const remaining = await store.list();
      expect(remaining).toHaveLength(0);
    });
  });
});
