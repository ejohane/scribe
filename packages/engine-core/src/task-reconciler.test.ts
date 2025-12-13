/**
 * TaskReconciler unit tests
 *
 * Tests for reconciliation logic in isolation from TaskIndex storage operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultTaskReconciler, type TaskReconciler } from './task-reconciler.js';
import type { Note, LexicalState, Task } from '@scribe/shared';
import { createNoteId, serializeTaskId } from '@scribe/shared';

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
 * Create a mock existing task
 */
function createExistingTask(params: {
  noteId: string;
  nodeKey: string;
  text: string;
  completed: boolean;
  priority: number;
  createdAt: number;
  completedAt?: number;
}): Task {
  const textHash = computeSimpleHash(params.text);
  const id = serializeTaskId({
    noteId: createNoteId(params.noteId),
    nodeKey: params.nodeKey,
    textHash,
  });

  return {
    id,
    noteId: createNoteId(params.noteId),
    noteTitle: 'Test Note',
    nodeKey: params.nodeKey,
    lineIndex: 0,
    text: params.text,
    textHash,
    completed: params.completed,
    completedAt: params.completedAt,
    priority: params.priority,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  };
}

/**
 * Simple hash function matching task-extraction.ts
 */
function computeSimpleHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
}

describe('DefaultTaskReconciler', () => {
  let reconciler: TaskReconciler;

  beforeEach(() => {
    reconciler = new DefaultTaskReconciler();
  });

  describe('reconcile() - New tasks', () => {
    it('should identify new tasks to add', () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: true, nodeKey: 'key2' },
      ]);

      const result = reconciler.reconcile(note, new Map(), -1, 1000);

      expect(result.toAdd.length).toBe(2);
      expect(result.toUpdate.length).toBe(0);
      expect(result.toRemove.length).toBe(0);

      // Verify new task properties
      expect(result.toAdd[0].text).toBe('Task 1');
      expect(result.toAdd[0].completed).toBe(false);
      expect(result.toAdd[0].priority).toBe(0); // maxPriority (-1) + 1 + 0

      expect(result.toAdd[1].text).toBe('Task 2');
      expect(result.toAdd[1].completed).toBe(true);
      expect(result.toAdd[1].priority).toBe(1); // maxPriority (-1) + 1 + 1
    });

    it('should assign sequential priorities to new tasks', () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
        { text: 'Task 2', checked: false, nodeKey: 'key2' },
        { text: 'Task 3', checked: false, nodeKey: 'key3' },
      ]);

      const result = reconciler.reconcile(note, new Map(), 5, 1000);

      expect(result.toAdd[0].priority).toBe(6); // maxPriority (5) + 1 + 0
      expect(result.toAdd[1].priority).toBe(7);
      expect(result.toAdd[2].priority).toBe(8);
    });

    it('should set completedAt for initially completed tasks', () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
      ]);

      const result = reconciler.reconcile(note, new Map(), -1, 5000);

      expect(result.toAdd[0].completed).toBe(true);
      expect(result.toAdd[0].completedAt).toBe(5000);
    });
  });

  describe('reconcile() - Existing tasks matched by nodeKey', () => {
    it('should identify tasks to update when completion state changes', () => {
      const existingTask = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: false,
        priority: 0,
        createdAt: 1000,
      });

      const existingTasks = new Map([[existingTask.id, existingTask]]);

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 0, 5000);

      expect(result.toAdd.length).toBe(0);
      expect(result.toUpdate.length).toBe(1);
      expect(result.toRemove.length).toBe(0);

      expect(result.toUpdate[0].completed).toBe(true);
      expect(result.toUpdate[0].completedAt).toBe(5000);
    });

    it('should preserve priority and createdAt on update', () => {
      const existingTask = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: false,
        priority: 42,
        createdAt: 1000,
      });

      const existingTasks = new Map([[existingTask.id, existingTask]]);

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1 updated', checked: false, nodeKey: 'key1' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 100, 5000);

      expect(result.toUpdate.length).toBe(1);
      expect(result.toUpdate[0].priority).toBe(42); // Preserved
      expect(result.toUpdate[0].createdAt).toBe(1000); // Preserved
      expect(result.toUpdate[0].updatedAt).toBe(5000); // Updated
    });

    it('should clear completedAt when task becomes uncompleted', () => {
      const existingTask = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: true,
        priority: 0,
        createdAt: 1000,
        completedAt: 2000,
      });

      const existingTasks = new Map([[existingTask.id, existingTask]]);

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 0, 5000);

      expect(result.toUpdate.length).toBe(1);
      expect(result.toUpdate[0].completed).toBe(false);
      expect(result.toUpdate[0].completedAt).toBeUndefined();
    });

    it('should not report update when nothing changed', () => {
      const existingTask = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: false,
        priority: 0,
        createdAt: 1000,
      });

      const existingTasks = new Map([[existingTask.id, existingTask]]);

      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 0, 5000);

      expect(result.toAdd.length).toBe(0);
      expect(result.toUpdate.length).toBe(0);
      expect(result.toRemove.length).toBe(0);
    });
  });

  describe('reconcile() - Existing tasks matched by textHash', () => {
    it('should match by textHash when nodeKey changes', () => {
      const existingTask = createExistingTask({
        noteId: 'note1',
        nodeKey: 'oldKey',
        text: 'Task 1',
        completed: false,
        priority: 5,
        createdAt: 1000,
      });

      const existingTasks = new Map([[existingTask.id, existingTask]]);

      // Same text, different nodeKey
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'newKey' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 10, 5000);

      // Should be treated as update, not add+remove
      expect(result.toAdd.length).toBe(0);
      expect(result.toUpdate.length).toBe(1);
      expect(result.toRemove.length).toBe(0);

      // Should preserve priority and createdAt
      expect(result.toUpdate[0].priority).toBe(5);
      expect(result.toUpdate[0].createdAt).toBe(1000);
      expect(result.toUpdate[0].nodeKey).toBe('newKey');
    });
  });

  describe('reconcile() - Missing tasks', () => {
    it('should identify tasks to remove', () => {
      const existingTask1 = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: false,
        priority: 0,
        createdAt: 1000,
      });

      const existingTask2 = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key2',
        text: 'Task 2',
        completed: false,
        priority: 1,
        createdAt: 1000,
      });

      const existingTasks = new Map([
        [existingTask1.id, existingTask1],
        [existingTask2.id, existingTask2],
      ]);

      // Only Task 1 remains
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: false, nodeKey: 'key1' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 1, 5000);

      expect(result.toAdd.length).toBe(0);
      expect(result.toUpdate.length).toBe(0);
      expect(result.toRemove.length).toBe(1);
      expect(result.toRemove[0]).toBe(existingTask2.id);
    });
  });

  describe('reconcile() - Empty note', () => {
    it('should remove all tasks when note becomes empty', () => {
      const existingTask = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: false,
        priority: 0,
        createdAt: 1000,
      });

      const existingTasks = new Map([[existingTask.id, existingTask]]);

      const note = createNote('note1', 'Test Note', []);

      const result = reconciler.reconcile(note, existingTasks, 0, 5000);

      expect(result.toAdd.length).toBe(0);
      expect(result.toUpdate.length).toBe(0);
      expect(result.toRemove.length).toBe(1);
    });
  });

  describe('reconcile() - Complex scenarios', () => {
    it('should handle mix of adds, updates, and removes', () => {
      const existingTask1 = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key1',
        text: 'Task 1',
        completed: false,
        priority: 0,
        createdAt: 1000,
      });

      const existingTask2 = createExistingTask({
        noteId: 'note1',
        nodeKey: 'key2',
        text: 'Task 2',
        completed: false,
        priority: 1,
        createdAt: 1000,
      });

      const existingTasks = new Map([
        [existingTask1.id, existingTask1],
        [existingTask2.id, existingTask2],
      ]);

      // Task 1 updated, Task 2 removed, Task 3 added
      const note = createNote('note1', 'Test Note', [
        { text: 'Task 1', checked: true, nodeKey: 'key1' },
        { text: 'Task 3', checked: false, nodeKey: 'key3' },
      ]);

      const result = reconciler.reconcile(note, existingTasks, 1, 5000);

      expect(result.toAdd.length).toBe(1);
      expect(result.toAdd[0].text).toBe('Task 3');

      expect(result.toUpdate.length).toBe(1);
      expect(result.toUpdate[0].text).toBe('Task 1');
      expect(result.toUpdate[0].completed).toBe(true);

      expect(result.toRemove.length).toBe(1);
      expect(result.toRemove[0]).toBe(existingTask2.id);
    });

    it('should handle duplicate text in same note', () => {
      const note = createNote('note1', 'Test Note', [
        { text: 'Same task', checked: false, nodeKey: 'key1' },
        { text: 'Same task', checked: false, nodeKey: 'key2' },
      ]);

      const result = reconciler.reconcile(note, new Map(), -1, 1000);

      expect(result.toAdd.length).toBe(2);
      expect(result.toAdd[0].nodeKey).toBe('key1');
      expect(result.toAdd[1].nodeKey).toBe('key2');
      // They should have different IDs due to different nodeKeys
      expect(result.toAdd[0].id).not.toBe(result.toAdd[1].id);
    });
  });
});
