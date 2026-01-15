/**
 * Tests for TagsRepository.
 *
 * These tests verify:
 * 1. Find or create tag (idempotent)
 * 2. Set note tags (replace all)
 * 3. Query notes by tag
 * 4. Get all tags with counts
 * 5. Tag normalization (lowercase)
 * 6. Transaction usage for batch operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from '../database.js';
import { TagsRepository } from './tags.repository.js';
import { NotesRepository } from './notes.repository.js';
import type { CreateNoteInput } from '../types.js';

describe('TagsRepository', () => {
  let scribeDb: ScribeDatabase;
  let tagsRepo: TagsRepository;
  let notesRepo: NotesRepository;

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

  // Create notes for testing tags
  let noteA: ReturnType<NotesRepository['create']>;
  let noteB: ReturnType<NotesRepository['create']>;
  let noteC: ReturnType<NotesRepository['create']>;

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();
    tagsRepo = new TagsRepository(scribeDb.getDb());
    notesRepo = new NotesRepository(scribeDb.getDb());

    // Create test notes
    noteA = notesRepo.create(createTestNoteInput({ id: 'note-a', title: 'Note A' }));
    noteB = notesRepo.create(createTestNoteInput({ id: 'note-b', title: 'Note B' }));
    noteC = notesRepo.create(createTestNoteInput({ id: 'note-c', title: 'Note C' }));
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('findOrCreate', () => {
    it('should create a new tag when it does not exist', () => {
      const tag = tagsRepo.findOrCreate('javascript');

      expect(tag.id).toBeGreaterThan(0);
      expect(tag.name).toBe('javascript');
    });

    it('should return existing tag when it already exists', () => {
      const tag1 = tagsRepo.findOrCreate('javascript');
      const tag2 = tagsRepo.findOrCreate('javascript');

      expect(tag1.id).toBe(tag2.id);
    });

    it('should normalize tag names to lowercase', () => {
      const tag1 = tagsRepo.findOrCreate('JavaScript');
      const tag2 = tagsRepo.findOrCreate('JAVASCRIPT');
      const tag3 = tagsRepo.findOrCreate('javascript');

      expect(tag1.id).toBe(tag2.id);
      expect(tag2.id).toBe(tag3.id);
      expect(tag1.name).toBe('javascript');
    });

    it('should trim whitespace from tag names', () => {
      const tag1 = tagsRepo.findOrCreate('  javascript  ');
      const tag2 = tagsRepo.findOrCreate('javascript');

      expect(tag1.id).toBe(tag2.id);
      expect(tag1.name).toBe('javascript');
    });
  });

  describe('findById', () => {
    it('should find an existing tag by id', () => {
      const created = tagsRepo.findOrCreate('javascript');

      const found = tagsRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('javascript');
    });

    it('should return null for non-existent id', () => {
      const found = tagsRepo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should find an existing tag by name', () => {
      tagsRepo.findOrCreate('javascript');

      const found = tagsRepo.findByName('javascript');

      expect(found).not.toBeNull();
      expect(found?.name).toBe('javascript');
    });

    it('should normalize name when searching', () => {
      tagsRepo.findOrCreate('javascript');

      const found = tagsRepo.findByName('JavaScript');

      expect(found).not.toBeNull();
    });

    it('should return null for non-existent name', () => {
      const found = tagsRepo.findByName('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByNoteId', () => {
    it('should return all tags for a note', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript', 'react']);

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags).toHaveLength(3);
      expect(tags.map((t) => t.name).sort()).toEqual(['javascript', 'react', 'typescript']);
    });

    it('should return tags ordered by name', () => {
      tagsRepo.setNoteTags(noteA.id, ['zebra', 'apple', 'mango']);

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags.map((t) => t.name)).toEqual(['apple', 'mango', 'zebra']);
    });

    it('should return empty array when note has no tags', () => {
      const tags = tagsRepo.findByNoteId(noteA.id);
      expect(tags).toHaveLength(0);
    });
  });

  describe('findNotesByTagName', () => {
    beforeEach(() => {
      // Set up some tags
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);
      tagsRepo.setNoteTags(noteB.id, ['javascript', 'react']);
      tagsRepo.setNoteTags(noteC.id, ['python']);
    });

    it('should return all notes with a specific tag', () => {
      const notes = tagsRepo.findNotesByTagName('javascript');

      expect(notes).toHaveLength(2);
      expect(notes.map((n) => n.id).sort()).toEqual([noteA.id, noteB.id].sort());
    });

    it('should normalize tag name when searching', () => {
      const notes = tagsRepo.findNotesByTagName('JavaScript');

      expect(notes).toHaveLength(2);
    });

    it('should return notes ordered by updated_at desc', () => {
      // Create notes with specific timestamps to ensure ordering
      const oldTime = '2020-01-01T00:00:00.000Z';
      const newTime = '2025-01-01T00:00:00.000Z';

      // Update noteA to be older
      notesRepo.update(noteA.id, { updatedAt: oldTime });
      // Update noteB to be newer
      notesRepo.update(noteB.id, { updatedAt: newTime });

      const notes = tagsRepo.findNotesByTagName('javascript');

      expect(notes[0].id).toBe(noteB.id);
      expect(notes[1].id).toBe(noteA.id);
    });

    it('should return empty array for non-existent tag', () => {
      const notes = tagsRepo.findNotesByTagName('nonexistent');
      expect(notes).toHaveLength(0);
    });
  });

  describe('setNoteTags', () => {
    it('should set tags for a note', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags).toHaveLength(2);
    });

    it('should replace existing tags', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);
      tagsRepo.setNoteTags(noteA.id, ['python', 'rust']);

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name).sort()).toEqual(['python', 'rust']);
    });

    it('should clear tags when given empty array', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);
      tagsRepo.setNoteTags(noteA.id, []);

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags).toHaveLength(0);
    });

    it('should handle duplicate tag names', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'JavaScript', 'JAVASCRIPT']);

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('javascript');
    });
  });

  describe('addTagToNote', () => {
    it('should add a tag to a note', () => {
      const added = tagsRepo.addTagToNote(noteA.id, 'javascript');

      expect(added).toBe(true);
      expect(tagsRepo.findByNoteId(noteA.id)).toHaveLength(1);
    });

    it('should return false if tag already associated', () => {
      tagsRepo.addTagToNote(noteA.id, 'javascript');

      const added = tagsRepo.addTagToNote(noteA.id, 'javascript');

      expect(added).toBe(false);
    });

    it('should not remove existing tags', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);
      tagsRepo.addTagToNote(noteA.id, 'react');

      const tags = tagsRepo.findByNoteId(noteA.id);

      expect(tags).toHaveLength(3);
    });
  });

  describe('removeTagFromNote', () => {
    beforeEach(() => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript', 'react']);
    });

    it('should remove a tag from a note', () => {
      const removed = tagsRepo.removeTagFromNote(noteA.id, 'typescript');

      expect(removed).toBe(true);
      expect(tagsRepo.findByNoteId(noteA.id)).toHaveLength(2);
    });

    it('should return false if tag was not associated', () => {
      const removed = tagsRepo.removeTagFromNote(noteA.id, 'python');

      expect(removed).toBe(false);
    });

    it('should normalize tag name when removing', () => {
      const removed = tagsRepo.removeTagFromNote(noteA.id, 'TypeScript');

      expect(removed).toBe(true);
    });
  });

  describe('findAllWithCounts', () => {
    beforeEach(() => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);
      tagsRepo.setNoteTags(noteB.id, ['javascript', 'react']);
      tagsRepo.setNoteTags(noteC.id, ['javascript']);
    });

    it('should return all tags with their usage counts', () => {
      const tagsWithCounts = tagsRepo.findAllWithCounts();

      const jsTag = tagsWithCounts.find((t) => t.name === 'javascript');
      const tsTag = tagsWithCounts.find((t) => t.name === 'typescript');
      const reactTag = tagsWithCounts.find((t) => t.name === 'react');

      expect(jsTag?.count).toBe(3);
      expect(tsTag?.count).toBe(1);
      expect(reactTag?.count).toBe(1);
    });

    it('should order by count descending, then name ascending', () => {
      const tagsWithCounts = tagsRepo.findAllWithCounts();

      expect(tagsWithCounts[0].name).toBe('javascript');
      // react and typescript both have count 1, should be ordered by name
      expect(tagsWithCounts[1].name).toBe('react');
      expect(tagsWithCounts[2].name).toBe('typescript');
    });

    it('should include tags with 0 count', () => {
      // Create a tag that's not associated with any note
      tagsRepo.findOrCreate('unused-tag');

      const tagsWithCounts = tagsRepo.findAllWithCounts();
      const unusedTag = tagsWithCounts.find((t) => t.name === 'unused-tag');

      expect(unusedTag?.count).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should return all tags ordered by name', () => {
      tagsRepo.findOrCreate('zebra');
      tagsRepo.findOrCreate('apple');
      tagsRepo.findOrCreate('mango');

      const tags = tagsRepo.findAll();

      expect(tags.map((t) => t.name)).toEqual(['apple', 'mango', 'zebra']);
    });

    it('should return empty array when no tags exist', () => {
      const tags = tagsRepo.findAll();
      expect(tags).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete a tag by id', () => {
      const tag = tagsRepo.findOrCreate('javascript');

      const deleted = tagsRepo.delete(tag.id);

      expect(deleted).toBe(true);
      expect(tagsRepo.findById(tag.id)).toBeNull();
    });

    it('should return false for non-existent id', () => {
      const deleted = tagsRepo.delete(99999);
      expect(deleted).toBe(false);
    });

    it('should cascade delete note_tags associations', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);
      const jsTag = tagsRepo.findByName('javascript')!;

      tagsRepo.delete(jsTag.id);

      const tags = tagsRepo.findByNoteId(noteA.id);
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('typescript');
    });
  });

  describe('deleteUnused', () => {
    it('should delete tags with no associated notes', () => {
      tagsRepo.findOrCreate('unused-tag');
      tagsRepo.setNoteTags(noteA.id, ['used-tag']);

      const deleted = tagsRepo.deleteUnused();

      expect(deleted).toBe(1);
      expect(tagsRepo.findByName('unused-tag')).toBeNull();
      expect(tagsRepo.findByName('used-tag')).not.toBeNull();
    });

    it('should return 0 when no unused tags', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript']);

      const deleted = tagsRepo.deleteUnused();

      expect(deleted).toBe(0);
    });
  });

  describe('countNotesByTagName', () => {
    beforeEach(() => {
      tagsRepo.setNoteTags(noteA.id, ['javascript']);
      tagsRepo.setNoteTags(noteB.id, ['javascript']);
      tagsRepo.setNoteTags(noteC.id, ['typescript']);
    });

    it('should count notes with a tag', () => {
      expect(tagsRepo.countNotesByTagName('javascript')).toBe(2);
      expect(tagsRepo.countNotesByTagName('typescript')).toBe(1);
    });

    it('should normalize tag name', () => {
      expect(tagsRepo.countNotesByTagName('JavaScript')).toBe(2);
    });

    it('should return 0 for non-existent tag', () => {
      expect(tagsRepo.countNotesByTagName('nonexistent')).toBe(0);
    });
  });

  describe('CASCADE delete on note deletion', () => {
    it('should remove note-tag associations when note is deleted', () => {
      tagsRepo.setNoteTags(noteA.id, ['javascript', 'typescript']);

      notesRepo.delete(noteA.id);

      // Tag should still exist but count should decrease
      const jsTag = tagsRepo.findByName('javascript');
      expect(jsTag).not.toBeNull();
      expect(tagsRepo.countNotesByTagName('javascript')).toBe(0);
    });
  });
});
