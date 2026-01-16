/**
 * Tests for NotesRepository.
 *
 * These tests verify:
 * 1. Create note with all fields
 * 2. Read by ID and by file path
 * 3. List with filtering and pagination
 * 4. Update individual fields
 * 5. Delete with cascade verification
 * 6. Timestamps auto-managed
 * 7. Type-safe inputs and outputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from '../database.js';
import { NotesRepository } from './notes.repository.js';
import type { Note, CreateNoteInput } from '../types.js';
import { DatabaseError } from '../errors.js';

describe('NotesRepository', () => {
  let scribeDb: ScribeDatabase;
  let repo: NotesRepository;

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

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();
    repo = new NotesRepository(scribeDb.getDb());
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('create', () => {
    it('should create a note with all required fields', () => {
      const input = createTestNoteInput();
      const note = repo.create(input);

      expect(note).toBeDefined();
      expect(note.id).toBe(input.id);
      expect(note.title).toBe(input.title);
      expect(note.type).toBe(input.type);
      expect(note.filePath).toBe(input.filePath);
      expect(note.createdAt).toBe(input.createdAt);
      expect(note.updatedAt).toBe(input.updatedAt);
    });

    it('should create a note with optional fields', () => {
      const input = createTestNoteInput({
        date: '2024-01-15',
        wordCount: 150,
        contentHash: 'abc123hash',
      });
      const note = repo.create(input);

      expect(note.date).toBe('2024-01-15');
      expect(note.wordCount).toBe(150);
      expect(note.contentHash).toBe('abc123hash');
    });

    it('should default wordCount to 0 when not provided', () => {
      const input = createTestNoteInput();
      const note = repo.create(input);

      expect(note.wordCount).toBe(0);
    });

    it('should default date and contentHash to null when not provided', () => {
      const input = createTestNoteInput();
      const note = repo.create(input);

      expect(note.date).toBeNull();
      expect(note.contentHash).toBeNull();
    });

    it('should create notes with different types', () => {
      const types = ['note', 'daily', 'meeting', 'person'] as const;

      for (const type of types) {
        const input = createTestNoteInput({ type });
        const note = repo.create(input);
        expect(note.type).toBe(type);
      }
    });

    it('should throw error on duplicate id', () => {
      const input = createTestNoteInput();
      repo.create(input);

      expect(() => repo.create(input)).toThrow(DatabaseError);
    });

    it('should throw error on duplicate file_path', () => {
      const input1 = createTestNoteInput();
      const input2 = createTestNoteInput({ filePath: input1.filePath });

      repo.create(input1);
      expect(() => repo.create(input2)).toThrow(DatabaseError);
    });
  });

  describe('findById', () => {
    it('should find an existing note by id', () => {
      const input = createTestNoteInput();
      repo.create(input);

      const found = repo.findById(input.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(input.id);
      expect(found?.title).toBe(input.title);
    });

    it('should return null for non-existent id', () => {
      const found = repo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByFilePath', () => {
    it('should find an existing note by file path', () => {
      const input = createTestNoteInput();
      repo.create(input);

      const found = repo.findByFilePath(input.filePath);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(input.id);
      expect(found?.filePath).toBe(input.filePath);
    });

    it('should return null for non-existent file path', () => {
      const found = repo.findByFilePath('non-existent/path.json');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      // Create some test notes
      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();

      repo.create(
        createTestNoteInput({
          id: 'note-1',
          title: 'Alpha Note',
          type: 'note',
          filePath: 'notes/alpha.json',
          createdAt: twoDaysAgo,
          updatedAt: now,
        })
      );
      repo.create(
        createTestNoteInput({
          id: 'note-2',
          title: 'Beta Note',
          type: 'daily',
          date: '2024-01-15',
          filePath: 'daily/2024-01-15.json',
          createdAt: yesterday,
          updatedAt: yesterday,
        })
      );
      repo.create(
        createTestNoteInput({
          id: 'note-3',
          title: 'Gamma Note',
          type: 'meeting',
          date: '2024-01-14',
          filePath: 'meetings/gamma.json',
          createdAt: now,
          updatedAt: twoDaysAgo,
        })
      );
      repo.create(
        createTestNoteInput({
          id: 'note-4',
          title: 'Delta Note',
          type: 'daily',
          date: '2024-01-16',
          filePath: 'daily/2024-01-16.json',
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    it('should return all notes without filters', () => {
      const notes = repo.findAll();
      expect(notes).toHaveLength(4);
    });

    it('should filter by type', () => {
      const dailyNotes = repo.findAll({ type: 'daily' });
      expect(dailyNotes).toHaveLength(2);
      expect(dailyNotes.every((n) => n.type === 'daily')).toBe(true);
    });

    it('should filter by date range - dateFrom', () => {
      const notes = repo.findAll({ dateFrom: '2024-01-15' });
      expect(notes).toHaveLength(2);
      expect(notes.every((n) => n.date && n.date >= '2024-01-15')).toBe(true);
    });

    it('should filter by date range - dateTo', () => {
      const notes = repo.findAll({ dateTo: '2024-01-15' });
      expect(notes).toHaveLength(2);
      expect(notes.every((n) => n.date && n.date <= '2024-01-15')).toBe(true);
    });

    it('should filter by date range - both', () => {
      const notes = repo.findAll({ dateFrom: '2024-01-15', dateTo: '2024-01-15' });
      expect(notes).toHaveLength(1);
      expect(notes[0].date).toBe('2024-01-15');
    });

    it('should apply limit', () => {
      const notes = repo.findAll({ limit: 2 });
      expect(notes).toHaveLength(2);
    });

    it('should apply offset', () => {
      const allNotes = repo.findAll();
      const offsetNotes = repo.findAll({ limit: 2, offset: 2 });

      expect(offsetNotes).toHaveLength(2);
      // Offset notes should not include the first 2 notes
      expect(offsetNotes[0].id).not.toBe(allNotes[0].id);
      expect(offsetNotes[0].id).not.toBe(allNotes[1].id);
    });

    it('should order by updated_at desc by default', () => {
      const notes = repo.findAll();
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i - 1].updatedAt >= notes[i].updatedAt).toBe(true);
      }
    });

    it('should order by title asc', () => {
      const notes = repo.findAll({ orderBy: 'title', orderDir: 'asc' });
      const titles = notes.map((n) => n.title);
      expect(titles).toEqual([...titles].sort());
    });

    it('should order by created_at desc', () => {
      const notes = repo.findAll({ orderBy: 'created_at', orderDir: 'desc' });
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i - 1].createdAt >= notes[i].createdAt).toBe(true);
      }
    });

    it('should combine multiple filters', () => {
      const notes = repo.findAll({
        type: 'daily',
        dateFrom: '2024-01-15',
        dateTo: '2024-01-16',
        orderBy: 'date',
        orderDir: 'asc',
        limit: 10,
      });

      expect(notes).toHaveLength(2);
      expect(notes[0].date).toBe('2024-01-15');
      expect(notes[1].date).toBe('2024-01-16');
    });
  });

  describe('update', () => {
    let existingNote: Note;

    beforeEach(() => {
      existingNote = repo.create(
        createTestNoteInput({
          title: 'Original Title',
          wordCount: 100,
        })
      );
    });

    it('should update title', () => {
      const newUpdatedAt = new Date().toISOString();
      const updated = repo.update(existingNote.id, {
        title: 'Updated Title',
        updatedAt: newUpdatedAt,
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.updatedAt).toBe(newUpdatedAt);
    });

    it('should update wordCount', () => {
      const newUpdatedAt = new Date().toISOString();
      const updated = repo.update(existingNote.id, {
        wordCount: 250,
        updatedAt: newUpdatedAt,
      });

      expect(updated?.wordCount).toBe(250);
    });

    it('should update contentHash', () => {
      const newUpdatedAt = new Date().toISOString();
      const updated = repo.update(existingNote.id, {
        contentHash: 'newhash456',
        updatedAt: newUpdatedAt,
      });

      expect(updated?.contentHash).toBe('newhash456');
    });

    it('should update type', () => {
      const newUpdatedAt = new Date().toISOString();
      const updated = repo.update(existingNote.id, {
        type: 'meeting',
        updatedAt: newUpdatedAt,
      });

      expect(updated?.type).toBe('meeting');
    });

    it('should update date', () => {
      const newUpdatedAt = new Date().toISOString();
      const updated = repo.update(existingNote.id, {
        date: '2024-02-01',
        updatedAt: newUpdatedAt,
      });

      expect(updated?.date).toBe('2024-02-01');
    });

    it('should allow setting date to null', () => {
      // First set a date
      repo.update(existingNote.id, {
        date: '2024-02-01',
        updatedAt: new Date().toISOString(),
      });

      // Then clear it
      const updated = repo.update(existingNote.id, {
        date: null,
        updatedAt: new Date().toISOString(),
      });

      expect(updated?.date).toBeNull();
    });

    it('should update multiple fields at once', () => {
      const newUpdatedAt = new Date().toISOString();
      const updated = repo.update(existingNote.id, {
        title: 'New Title',
        wordCount: 300,
        contentHash: 'multihash',
        updatedAt: newUpdatedAt,
      });

      expect(updated?.title).toBe('New Title');
      expect(updated?.wordCount).toBe(300);
      expect(updated?.contentHash).toBe('multihash');
    });

    it('should return null for non-existent note', () => {
      const updated = repo.update('non-existent-id', {
        title: 'New Title',
        updatedAt: new Date().toISOString(),
      });

      expect(updated).toBeNull();
    });

    it('should preserve unchanged fields', () => {
      const originalTitle = existingNote.title;
      const originalWordCount = existingNote.wordCount;

      const updated = repo.update(existingNote.id, {
        contentHash: 'onlyhash',
        updatedAt: new Date().toISOString(),
      });

      expect(updated?.title).toBe(originalTitle);
      expect(updated?.wordCount).toBe(originalWordCount);
    });
  });

  describe('delete', () => {
    it('should delete an existing note', () => {
      const note = repo.create(createTestNoteInput());

      const deleted = repo.delete(note.id);

      expect(deleted).toBe(true);
      expect(repo.findById(note.id)).toBeNull();
    });

    it('should return false for non-existent note', () => {
      const deleted = repo.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should cascade delete to related records', () => {
      // Create a note
      const note = repo.create(createTestNoteInput());
      const db = scribeDb.getDb();

      // Create related records in links table (link to itself for simplicity)
      db.prepare('INSERT INTO links (source_id, target_id) VALUES (?, ?)').run(note.id, note.id);

      // Create a tag and associate it
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('test-tag');
      const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get('test-tag') as {
        id: number;
      };
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(note.id, tagRow.id);

      // Create Yjs state
      db.prepare('INSERT INTO yjs_state (note_id, state, updated_at) VALUES (?, ?, ?)').run(
        note.id,
        Buffer.from('test'),
        new Date().toISOString()
      );

      // Create snapshot
      db.prepare(
        'INSERT INTO snapshots (note_id, title, content, created_at, trigger) VALUES (?, ?, ?, ?, ?)'
      ).run(note.id, 'Test', '{}', new Date().toISOString(), 'manual');

      // Delete the note
      const deleted = repo.delete(note.id);
      expect(deleted).toBe(true);

      // Verify cascades
      const links = db
        .prepare('SELECT * FROM links WHERE source_id = ? OR target_id = ?')
        .all(note.id, note.id);
      expect(links).toHaveLength(0);

      const noteTags = db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all(note.id);
      expect(noteTags).toHaveLength(0);

      const yjsState = db.prepare('SELECT * FROM yjs_state WHERE note_id = ?').all(note.id);
      expect(yjsState).toHaveLength(0);

      const snapshots = db.prepare('SELECT * FROM snapshots WHERE note_id = ?').all(note.id);
      expect(snapshots).toHaveLength(0);

      // Tag should still exist (only junction table entry deleted)
      const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagRow.id);
      expect(tag).toBeDefined();
    });
  });

  describe('count', () => {
    beforeEach(() => {
      repo.create(createTestNoteInput({ type: 'note' }));
      repo.create(createTestNoteInput({ type: 'note' }));
      repo.create(createTestNoteInput({ type: 'daily' }));
      repo.create(createTestNoteInput({ type: 'meeting' }));
    });

    it('should count all notes', () => {
      expect(repo.count()).toBe(4);
    });

    it('should count notes by type', () => {
      expect(repo.count('note')).toBe(2);
      expect(repo.count('daily')).toBe(1);
      expect(repo.count('meeting')).toBe(1);
      expect(repo.count('person')).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing note', () => {
      const note = repo.create(createTestNoteInput());
      expect(repo.exists(note.id)).toBe(true);
    });

    it('should return false for non-existent note', () => {
      expect(repo.exists('non-existent-id')).toBe(false);
    });
  });

  describe('filePathExists', () => {
    it('should return true for existing file path', () => {
      const input = createTestNoteInput();
      repo.create(input);
      expect(repo.filePathExists(input.filePath)).toBe(true);
    });

    it('should return false for non-existent file path', () => {
      expect(repo.filePathExists('non-existent/path.json')).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should return properly typed Note objects', () => {
      const input = createTestNoteInput({
        date: '2024-01-15',
        wordCount: 100,
        contentHash: 'hash123',
      });
      const note = repo.create(input);

      // TypeScript compilation would fail if types are incorrect
      const id: string = note.id;
      const title: string = note.title;
      const type: 'note' | 'daily' | 'meeting' | 'person' = note.type;
      const date: string | null = note.date;
      const createdAt: string = note.createdAt;
      const updatedAt: string = note.updatedAt;
      const wordCount: number = note.wordCount;
      const filePath: string = note.filePath;
      const contentHash: string | null = note.contentHash;

      // All should be defined based on input
      expect(id).toBeDefined();
      expect(title).toBeDefined();
      expect(type).toBeDefined();
      expect(date).toBeDefined();
      expect(createdAt).toBeDefined();
      expect(updatedAt).toBeDefined();
      expect(wordCount).toBeDefined();
      expect(filePath).toBeDefined();
      expect(contentHash).toBeDefined();
    });
  });
});
