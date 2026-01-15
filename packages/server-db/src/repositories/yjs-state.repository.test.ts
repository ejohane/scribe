/**
 * Tests for YjsStateRepository.
 *
 * These tests verify:
 * 1. Save Yjs state (upsert semantics)
 * 2. Load state by note ID
 * 3. Load state as Uint8Array
 * 4. Delete state
 * 5. Proper Buffer ↔ Uint8Array conversion
 * 6. CASCADE delete when note is deleted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from '../database.js';
import { NotesRepository } from './notes.repository.js';
import { YjsStateRepository } from './yjs-state.repository.js';
import type { CreateNoteInput, CreateYjsStateInput } from '../types.js';

describe('YjsStateRepository', () => {
  let scribeDb: ScribeDatabase;
  let notesRepo: NotesRepository;
  let repo: YjsStateRepository;

  // Helper to create test note input
  const createTestNoteInput = (overrides: Partial<CreateNoteInput> = {}): CreateNoteInput => {
    const now = new Date().toISOString();
    const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      title: 'Test Note',
      type: 'note',
      filePath: `notes/${id}.json`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  // Helper to create test Yjs state input
  const createTestYjsStateInput = (
    noteId: string,
    overrides: Partial<CreateYjsStateInput> = {}
  ): CreateYjsStateInput => {
    return {
      noteId,
      state: Buffer.from('test-yjs-state'),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  };

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();
    notesRepo = new NotesRepository(scribeDb.getDb());
    repo = new YjsStateRepository(scribeDb.getDb());
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('save', () => {
    it('should save Yjs state for a note', () => {
      const note = notesRepo.create(createTestNoteInput());
      const input = createTestYjsStateInput(note.id);

      const state = repo.save(input);

      expect(state).toBeDefined();
      expect(state.noteId).toBe(note.id);
      expect(state.state).toBeInstanceOf(Buffer);
      expect(state.state.toString()).toBe('test-yjs-state');
      expect(state.updatedAt).toBe(input.updatedAt);
    });

    it('should save binary state correctly', () => {
      const note = notesRepo.create(createTestNoteInput());
      // Simulate actual Yjs binary state (random bytes)
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const input = createTestYjsStateInput(note.id, { state: binaryData });

      const state = repo.save(input);

      expect(Buffer.compare(state.state, binaryData)).toBe(0);
    });

    it('should update existing state (upsert)', () => {
      const note = notesRepo.create(createTestNoteInput());
      const firstState = Buffer.from('first-state');
      const secondState = Buffer.from('second-state');
      const firstUpdatedAt = '2024-01-01T00:00:00.000Z';
      const secondUpdatedAt = '2024-01-02T00:00:00.000Z';

      // Save first state
      repo.save({
        noteId: note.id,
        state: firstState,
        updatedAt: firstUpdatedAt,
      });

      // Update with second state
      const state = repo.save({
        noteId: note.id,
        state: secondState,
        updatedAt: secondUpdatedAt,
      });

      expect(state.state.toString()).toBe('second-state');
      expect(state.updatedAt).toBe(secondUpdatedAt);

      // Verify only one record exists
      expect(repo.count()).toBe(1);
    });

    it('should throw error for non-existent note (FK constraint)', () => {
      const input = createTestYjsStateInput('non-existent-note');

      expect(() => repo.save(input)).toThrow();
    });
  });

  describe('load', () => {
    it('should load existing Yjs state', () => {
      const note = notesRepo.create(createTestNoteInput());
      const input = createTestYjsStateInput(note.id);
      repo.save(input);

      const state = repo.load(note.id);

      expect(state).not.toBeNull();
      expect(state?.noteId).toBe(note.id);
      expect(state?.state.toString()).toBe('test-yjs-state');
    });

    it('should return null for non-existent note', () => {
      const state = repo.load('non-existent-note');
      expect(state).toBeNull();
    });

    it('should return null for note without Yjs state', () => {
      const note = notesRepo.create(createTestNoteInput());
      const state = repo.load(note.id);
      expect(state).toBeNull();
    });
  });

  describe('loadAsUint8Array', () => {
    it('should load state as Uint8Array', () => {
      const note = notesRepo.create(createTestNoteInput());
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      repo.save(createTestYjsStateInput(note.id, { state: binaryData }));

      const state = repo.loadAsUint8Array(note.id);

      expect(state).toBeInstanceOf(Uint8Array);
      expect(state).toEqual(new Uint8Array([0x00, 0x01, 0x02, 0xff]));
    });

    it('should return null for non-existent state', () => {
      const state = repo.loadAsUint8Array('non-existent-note');
      expect(state).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing Yjs state', () => {
      const note = notesRepo.create(createTestNoteInput());
      repo.save(createTestYjsStateInput(note.id));

      const deleted = repo.delete(note.id);

      expect(deleted).toBe(true);
      expect(repo.load(note.id)).toBeNull();
    });

    it('should return false for non-existent state', () => {
      const deleted = repo.delete('non-existent-note');
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for note with Yjs state', () => {
      const note = notesRepo.create(createTestNoteInput());
      repo.save(createTestYjsStateInput(note.id));

      expect(repo.exists(note.id)).toBe(true);
    });

    it('should return false for note without Yjs state', () => {
      const note = notesRepo.create(createTestNoteInput());
      expect(repo.exists(note.id)).toBe(false);
    });

    it('should return false for non-existent note', () => {
      expect(repo.exists('non-existent-note')).toBe(false);
    });
  });

  describe('getLastUpdated', () => {
    it('should return last updated timestamp', () => {
      const note = notesRepo.create(createTestNoteInput());
      const updatedAt = '2024-01-15T10:30:00.000Z';
      repo.save(createTestYjsStateInput(note.id, { updatedAt }));

      const lastUpdated = repo.getLastUpdated(note.id);

      expect(lastUpdated).toBe(updatedAt);
    });

    it('should return null for non-existent state', () => {
      const lastUpdated = repo.getLastUpdated('non-existent-note');
      expect(lastUpdated).toBeNull();
    });
  });

  describe('getAllNoteIds', () => {
    it('should return all note IDs with Yjs state', () => {
      const note1 = notesRepo.create(createTestNoteInput());
      const note2 = notesRepo.create(createTestNoteInput());
      const note3 = notesRepo.create(createTestNoteInput());

      repo.save(createTestYjsStateInput(note1.id));
      repo.save(createTestYjsStateInput(note3.id));
      // note2 has no Yjs state

      const noteIds = repo.getAllNoteIds();

      expect(noteIds).toHaveLength(2);
      expect(noteIds).toContain(note1.id);
      expect(noteIds).toContain(note3.id);
      expect(noteIds).not.toContain(note2.id);
    });

    it('should return empty array when no Yjs states exist', () => {
      const noteIds = repo.getAllNoteIds();
      expect(noteIds).toEqual([]);
    });
  });

  describe('count', () => {
    it('should return count of Yjs states', () => {
      const note1 = notesRepo.create(createTestNoteInput());
      const note2 = notesRepo.create(createTestNoteInput());

      expect(repo.count()).toBe(0);

      repo.save(createTestYjsStateInput(note1.id));
      expect(repo.count()).toBe(1);

      repo.save(createTestYjsStateInput(note2.id));
      expect(repo.count()).toBe(2);
    });
  });

  describe('cascade delete', () => {
    it('should delete Yjs state when note is deleted', () => {
      const note = notesRepo.create(createTestNoteInput());
      repo.save(createTestYjsStateInput(note.id));

      // Verify state exists
      expect(repo.exists(note.id)).toBe(true);

      // Delete the note
      notesRepo.delete(note.id);

      // Verify state was cascade deleted
      expect(repo.exists(note.id)).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should return properly typed YjsState objects', () => {
      const note = notesRepo.create(createTestNoteInput());
      const input = createTestYjsStateInput(note.id);
      const state = repo.save(input);

      // TypeScript compilation would fail if types are incorrect
      const noteId: string = state.noteId;
      const stateBuffer: Buffer = state.state;
      const updatedAt: string = state.updatedAt;

      expect(noteId).toBeDefined();
      expect(stateBuffer).toBeDefined();
      expect(updatedAt).toBeDefined();
    });
  });

  describe('large state handling', () => {
    it('should handle large binary state', () => {
      const note = notesRepo.create(createTestNoteInput());
      // Create a 1MB buffer (typical Yjs state can be large)
      const largeState = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < largeState.length; i++) {
        largeState[i] = i % 256;
      }

      repo.save(createTestYjsStateInput(note.id, { state: largeState }));
      const loaded = repo.load(note.id);

      expect(loaded?.state.length).toBe(largeState.length);
      expect(Buffer.compare(loaded!.state, largeState)).toBe(0);
    });
  });
});
