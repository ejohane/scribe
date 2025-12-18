/**
 * Unit Tests for EngineOrchestrator
 *
 * Tests the coordination of vault, graphEngine, searchEngine, and taskIndex
 * for note operations.
 *
 * These tests use mock implementations to verify:
 * - saveNote coordinates all 4 engines correctly
 * - deleteNote coordinates all 4 engines correctly
 * - initialize populates all engines from vault
 * - shutdown flushes and clears all engines
 * - Task change callbacks are invoked when tasks change
 *
 * @module EngineOrchestrator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Note, NoteId, TaskChangeEvent, Task } from '@scribe/shared';
import { EngineOrchestrator, type EngineOrchestratorConfig } from './EngineOrchestrator';

// =============================================================================
// Mock Implementations
// =============================================================================

/**
 * Create a mock note for testing
 */
function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-123' as NoteId,
    title: 'Test Note',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    type: undefined,
    tags: [],
    content: {
      root: {
        type: 'root',
        children: [],
        format: '',
        indent: 0,
        version: 1,
      },
    },
    metadata: {
      links: [],
      tags: [],
      mentions: [],
      hasTitle: true,
      taskCount: 0,
    },
    ...overrides,
  } as Note;
}

/**
 * Create a mock task change event
 */
function createMockTaskChange(type: 'added' | 'updated' | 'removed'): TaskChangeEvent {
  if (type === 'removed') {
    return { type: 'removed', taskId: 'task-123' };
  }
  return {
    type,
    task: {
      id: 'task-123',
      noteId: 'note-123' as NoteId,
      text: 'Test task',
      completed: false,
      priority: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lineIndex: 0,
      nodeKey: 'node-1',
      textHash: 'hash-1',
    } as Task,
  };
}

/**
 * Create mock vault
 */
function createMockVault() {
  const notes = new Map<NoteId, Note>();

  return {
    save: vi.fn(async (note: Note) => {
      notes.set(note.id, note);
    }),
    delete: vi.fn(async (noteId: NoteId) => {
      notes.delete(noteId);
    }),
    list: vi.fn(() => Array.from(notes.values())),
    read: vi.fn((noteId: NoteId) => notes.get(noteId)),
    load: vi.fn(async () => notes.size),
    _notes: notes, // Expose for test setup
  };
}

/**
 * Create mock graph engine
 */
function createMockGraphEngine() {
  return {
    addNote: vi.fn((_note: Note) => {}),
    removeNote: vi.fn((_noteId: NoteId) => {}),
    clear: vi.fn(() => {}),
    backlinks: vi.fn(() => []),
    outlinks: vi.fn(() => []),
    neighbors: vi.fn(() => []),
    notesWithTag: vi.fn(() => []),
    getAllTags: vi.fn(() => []),
    getStats: vi.fn(() => ({ nodes: 0, edges: 0, tags: 0 })),
  };
}

/**
 * Create mock search engine
 */
function createMockSearchEngine() {
  return {
    indexNote: vi.fn((_note: Note) => {}),
    removeNote: vi.fn((_noteId: NoteId) => {}),
    clear: vi.fn(() => {}),
    search: vi.fn(() => []),
    size: vi.fn(() => 0),
  };
}

/**
 * Create mock task index
 */
function createMockTaskIndex(taskChanges: TaskChangeEvent[] = []) {
  return {
    indexNote: vi.fn((_note: Note) => taskChanges),
    removeNote: vi.fn((_noteId: NoteId) => taskChanges),
    flush: vi.fn(async () => {}),
    load: vi.fn(async () => {}),
    list: vi.fn(() => ({ tasks: [], nextCursor: undefined })),
    get: vi.fn(() => undefined),
    toggle: vi.fn(() => null),
    setPriority: vi.fn(() => null),
    reorder: vi.fn(() => {}),
    query: vi.fn(() => ({
      execute: () => ({ tasks: [], nextCursor: undefined }),
    })),
    size: 0,
    isDirty: false,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('EngineOrchestrator', () => {
  let vault: ReturnType<typeof createMockVault>;
  let graphEngine: ReturnType<typeof createMockGraphEngine>;
  let searchEngine: ReturnType<typeof createMockSearchEngine>;
  let taskIndex: ReturnType<typeof createMockTaskIndex>;
  let onTasksChanged: ReturnType<typeof vi.fn>;
  let orchestrator: EngineOrchestrator;

  beforeEach(() => {
    vault = createMockVault();
    graphEngine = createMockGraphEngine();
    searchEngine = createMockSearchEngine();
    taskIndex = createMockTaskIndex();
    onTasksChanged = vi.fn();

    orchestrator = new EngineOrchestrator({
      vault: vault as unknown as EngineOrchestratorConfig['vault'],
      graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
      searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
      taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
      onTasksChanged,
    });
  });

  describe('saveNote', () => {
    it('should save note to vault', async () => {
      const note = createMockNote();

      await orchestrator.saveNote(note);

      expect(vault.save).toHaveBeenCalledTimes(1);
      expect(vault.save).toHaveBeenCalledWith(note);
    });

    it('should update graph engine', async () => {
      const note = createMockNote();

      await orchestrator.saveNote(note);

      expect(graphEngine.addNote).toHaveBeenCalledTimes(1);
      expect(graphEngine.addNote).toHaveBeenCalledWith(note);
    });

    it('should update search engine', async () => {
      const note = createMockNote();

      await orchestrator.saveNote(note);

      expect(searchEngine.indexNote).toHaveBeenCalledTimes(1);
      expect(searchEngine.indexNote).toHaveBeenCalledWith(note);
    });

    it('should update task index', async () => {
      const note = createMockNote();

      await orchestrator.saveNote(note);

      expect(taskIndex.indexNote).toHaveBeenCalledTimes(1);
      expect(taskIndex.indexNote).toHaveBeenCalledWith(note);
    });

    it('should return success result with task changes', async () => {
      const note = createMockNote();

      const result = await orchestrator.saveNote(note);

      expect(result.success).toBe(true);
      expect(result.taskChanges).toEqual([]);
    });

    it('should invoke onTasksChanged when tasks change', async () => {
      const taskChanges = [createMockTaskChange('added')];
      taskIndex = createMockTaskIndex(taskChanges);
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        onTasksChanged,
      });

      const note = createMockNote();
      await orchestrator.saveNote(note);

      expect(onTasksChanged).toHaveBeenCalledTimes(1);
      expect(onTasksChanged).toHaveBeenCalledWith(taskChanges);
    });

    it('should not invoke onTasksChanged when no tasks change', async () => {
      const note = createMockNote();

      await orchestrator.saveNote(note);

      expect(onTasksChanged).not.toHaveBeenCalled();
    });

    it('should propagate vault errors', async () => {
      vault.save = vi.fn(async () => {
        throw new Error('Vault error');
      });
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        onTasksChanged,
      });

      const note = createMockNote();

      await expect(orchestrator.saveNote(note)).rejects.toThrow('Vault error');
    });
  });

  describe('deleteNote', () => {
    it('should delete note from vault', async () => {
      const noteId = 'note-123' as NoteId;

      await orchestrator.deleteNote(noteId);

      expect(vault.delete).toHaveBeenCalledTimes(1);
      expect(vault.delete).toHaveBeenCalledWith(noteId);
    });

    it('should remove from graph engine', async () => {
      const noteId = 'note-123' as NoteId;

      await orchestrator.deleteNote(noteId);

      expect(graphEngine.removeNote).toHaveBeenCalledTimes(1);
      expect(graphEngine.removeNote).toHaveBeenCalledWith(noteId);
    });

    it('should remove from search engine', async () => {
      const noteId = 'note-123' as NoteId;

      await orchestrator.deleteNote(noteId);

      expect(searchEngine.removeNote).toHaveBeenCalledTimes(1);
      expect(searchEngine.removeNote).toHaveBeenCalledWith(noteId);
    });

    it('should remove from task index', async () => {
      const noteId = 'note-123' as NoteId;

      await orchestrator.deleteNote(noteId);

      expect(taskIndex.removeNote).toHaveBeenCalledTimes(1);
      expect(taskIndex.removeNote).toHaveBeenCalledWith(noteId);
    });

    it('should return success result with task changes', async () => {
      const noteId = 'note-123' as NoteId;

      const result = await orchestrator.deleteNote(noteId);

      expect(result.success).toBe(true);
      expect(result.taskChanges).toEqual([]);
    });

    it('should invoke onTasksChanged when tasks are removed', async () => {
      const taskChanges = [createMockTaskChange('removed')];
      taskIndex = createMockTaskIndex(taskChanges);
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        onTasksChanged,
      });

      const noteId = 'note-123' as NoteId;
      await orchestrator.deleteNote(noteId);

      expect(onTasksChanged).toHaveBeenCalledTimes(1);
      expect(onTasksChanged).toHaveBeenCalledWith(taskChanges);
    });

    it('should propagate vault errors', async () => {
      vault.delete = vi.fn(async () => {
        throw new Error('Delete error');
      });
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        onTasksChanged,
      });

      const noteId = 'note-123' as NoteId;

      await expect(orchestrator.deleteNote(noteId)).rejects.toThrow('Delete error');
    });
  });

  describe('initialize', () => {
    it('should index all notes from vault into graph engine', async () => {
      const note1 = createMockNote({ id: 'note-1' as NoteId });
      const note2 = createMockNote({ id: 'note-2' as NoteId });
      vault._notes.set(note1.id, note1);
      vault._notes.set(note2.id, note2);

      await orchestrator.initialize();

      expect(graphEngine.addNote).toHaveBeenCalledTimes(2);
    });

    it('should index all notes from vault into search engine', async () => {
      const note1 = createMockNote({ id: 'note-1' as NoteId });
      const note2 = createMockNote({ id: 'note-2' as NoteId });
      vault._notes.set(note1.id, note1);
      vault._notes.set(note2.id, note2);

      await orchestrator.initialize();

      expect(searchEngine.indexNote).toHaveBeenCalledTimes(2);
    });

    it('should index all notes from vault into task index', async () => {
      const note1 = createMockNote({ id: 'note-1' as NoteId });
      const note2 = createMockNote({ id: 'note-2' as NoteId });
      vault._notes.set(note1.id, note1);
      vault._notes.set(note2.id, note2);

      await orchestrator.initialize();

      expect(taskIndex.indexNote).toHaveBeenCalledTimes(2);
    });

    it('should return count of indexed notes', async () => {
      const note1 = createMockNote({ id: 'note-1' as NoteId });
      const note2 = createMockNote({ id: 'note-2' as NoteId });
      const note3 = createMockNote({ id: 'note-3' as NoteId });
      vault._notes.set(note1.id, note1);
      vault._notes.set(note2.id, note2);
      vault._notes.set(note3.id, note3);

      const count = await orchestrator.initialize();

      expect(count).toBe(3);
    });

    it('should return 0 for empty vault', async () => {
      const count = await orchestrator.initialize();

      expect(count).toBe(0);
      expect(graphEngine.addNote).not.toHaveBeenCalled();
      expect(searchEngine.indexNote).not.toHaveBeenCalled();
      expect(taskIndex.indexNote).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should flush task index', async () => {
      await orchestrator.shutdown();

      expect(taskIndex.flush).toHaveBeenCalledTimes(1);
    });

    it('should clear graph engine', async () => {
      await orchestrator.shutdown();

      expect(graphEngine.clear).toHaveBeenCalledTimes(1);
    });

    it('should clear search engine', async () => {
      await orchestrator.shutdown();

      expect(searchEngine.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('getters', () => {
    it('should return vault instance', () => {
      expect(orchestrator.getVault()).toBe(vault);
    });

    it('should return graph engine instance', () => {
      expect(orchestrator.getGraphEngine()).toBe(graphEngine);
    });

    it('should return search engine instance', () => {
      expect(orchestrator.getSearchEngine()).toBe(searchEngine);
    });

    it('should return task index instance', () => {
      expect(orchestrator.getTaskIndex()).toBe(taskIndex);
    });
  });

  describe('without onTasksChanged callback', () => {
    beforeEach(() => {
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        // No onTasksChanged callback
      });
    });

    it('should not throw when saving note with task changes', async () => {
      const taskChanges = [createMockTaskChange('added')];
      taskIndex = createMockTaskIndex(taskChanges);
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        // No onTasksChanged callback
      });

      const note = createMockNote();

      // Should not throw
      const result = await orchestrator.saveNote(note);
      expect(result.success).toBe(true);
      expect(result.taskChanges).toEqual(taskChanges);
    });

    it('should not throw when deleting note with task changes', async () => {
      const taskChanges = [createMockTaskChange('removed')];
      taskIndex = createMockTaskIndex(taskChanges);
      orchestrator = new EngineOrchestrator({
        vault: vault as unknown as EngineOrchestratorConfig['vault'],
        graphEngine: graphEngine as unknown as EngineOrchestratorConfig['graphEngine'],
        searchEngine: searchEngine as unknown as EngineOrchestratorConfig['searchEngine'],
        taskIndex: taskIndex as unknown as EngineOrchestratorConfig['taskIndex'],
        // No onTasksChanged callback
      });

      const noteId = 'note-123' as NoteId;

      // Should not throw
      const result = await orchestrator.deleteNote(noteId);
      expect(result.success).toBe(true);
      expect(result.taskChanges).toEqual(taskChanges);
    });
  });
});
