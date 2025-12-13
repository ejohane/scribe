/**
 * Tests for Node.js-specific exports from engine-core
 *
 * This module tests the @scribe/engine-core/node entry point which provides
 * Node.js-specific exports that cannot be used in browser contexts.
 */

import { describe, it, expect } from 'vitest';
import { TaskIndex } from './node.js';

describe('@scribe/engine-core/node exports', () => {
  describe('TaskIndex export', () => {
    it('should export TaskIndex class', () => {
      expect(TaskIndex).toBeDefined();
      expect(typeof TaskIndex).toBe('function');
    });

    it('should be constructible with a path string (legacy constructor)', () => {
      const index = new TaskIndex('/tmp/test-derived');
      expect(index).toBeInstanceOf(TaskIndex);
    });

    it('should have expected instance methods', () => {
      const index = new TaskIndex('/tmp/test-derived');

      // Core methods
      expect(typeof index.load).toBe('function');
      expect(typeof index.persist).toBe('function');
      expect(typeof index.flush).toBe('function');
      expect(typeof index.schedulePersist).toBe('function');

      // Task management methods
      expect(typeof index.indexNote).toBe('function');
      expect(typeof index.removeNote).toBe('function');
      expect(typeof index.list).toBe('function');
      expect(typeof index.query).toBe('function');
      expect(typeof index.toggle).toBe('function');
      expect(typeof index.reorder).toBe('function');
      expect(typeof index.get).toBe('function');
      expect(typeof index.getTaskIdsForNote).toBe('function');
    });

    it('should have expected instance properties', () => {
      const index = new TaskIndex('/tmp/test-derived');

      // Read-only properties
      expect(typeof index.size).toBe('number');
      expect(typeof index.isDirty).toBe('boolean');

      // Initial state
      expect(index.size).toBe(0);
      expect(index.isDirty).toBe(false);
    });
  });

  describe('TaskIndex basic operations', () => {
    it('should return empty list when no tasks indexed', () => {
      const index = new TaskIndex('/tmp/test-derived');
      const result = index.list();

      expect(result.tasks).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should return undefined for non-existent task', () => {
      const index = new TaskIndex('/tmp/test-derived');
      const task = index.get('non-existent-id');

      expect(task).toBeUndefined();
    });

    it('should return empty set for note with no tasks', () => {
      const index = new TaskIndex('/tmp/test-derived');
      const taskIds = index.getTaskIdsForNote(
        'note-123' as Parameters<typeof index.getTaskIdsForNote>[0]
      );

      expect(taskIds.size).toBe(0);
    });

    it('should return null when toggling non-existent task', () => {
      const index = new TaskIndex('/tmp/test-derived');
      const result = index.toggle('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return a TaskQuery instance from query()', () => {
      const index = new TaskIndex('/tmp/test-derived');
      const query = index.query();

      // TaskQuery should have chainable methods
      expect(typeof query.byStatus).toBe('function');
      expect(typeof query.byNote).toBe('function');
      expect(typeof query.sortBy).toBe('function');
      expect(typeof query.limit).toBe('function');
      expect(typeof query.execute).toBe('function');
    });
  });

  describe('TaskIndex debounce configuration', () => {
    it('should accept custom debounce time', () => {
      // Custom debounce of 1000ms
      const index = new TaskIndex('/tmp/test-derived', 1000);
      expect(index).toBeInstanceOf(TaskIndex);
    });

    it('should use default debounce when not specified', () => {
      // Default debounce (5000ms)
      const index = new TaskIndex('/tmp/test-derived');
      expect(index).toBeInstanceOf(TaskIndex);
    });
  });
});
