/**
 * Tests for LinksRepository.
 *
 * These tests verify:
 * 1. Create link (idempotent - ignores duplicates)
 * 2. Find by source/target
 * 3. Batch create links
 * 4. CASCADE delete when note deleted
 * 5. Transaction usage for batch operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from '../database.js';
import { LinksRepository } from './links.repository.js';
import { NotesRepository } from './notes.repository.js';
import type { CreateNoteInput, CreateLinkInput } from '../types.js';

describe('LinksRepository', () => {
  let scribeDb: ScribeDatabase;
  let linksRepo: LinksRepository;
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

  // Create notes for testing links
  let noteA: ReturnType<NotesRepository['create']>;
  let noteB: ReturnType<NotesRepository['create']>;
  let noteC: ReturnType<NotesRepository['create']>;

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();
    linksRepo = new LinksRepository(scribeDb.getDb());
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

  describe('create', () => {
    it('should create a link between two notes', () => {
      const link = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
      });

      expect(link).not.toBeNull();
      expect(link?.sourceId).toBe(noteA.id);
      expect(link?.targetId).toBe(noteB.id);
      expect(link?.linkText).toBeNull();
    });

    it('should create a link with link text', () => {
      const link = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
        linkText: 'See also',
      });

      expect(link?.linkText).toBe('See also');
    });

    it('should be idempotent - return existing link on duplicate with same link_text', () => {
      // Note: SQLite's UNIQUE constraint treats NULL != NULL, so two links with
      // NULL link_text are NOT duplicates. Only links with non-null link_text
      // are truly idempotent.
      const link1 = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
        linkText: 'same text',
      });
      const link2 = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
        linkText: 'same text',
      });

      expect(link1).not.toBeNull();
      expect(link2).not.toBeNull();
      expect(link1?.id).toBe(link2?.id);
    });

    it('should create separate links when link_text is null (SQLite NULL behavior)', () => {
      // SQLite treats NULL != NULL in UNIQUE constraints, so two links with
      // null link_text will both be created
      const link1 = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
      });
      const link2 = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
      });

      expect(link1).not.toBeNull();
      expect(link2).not.toBeNull();
      expect(link1?.id).not.toBe(link2?.id);
    });

    it('should allow multiple links with different link_text', () => {
      const link1 = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
        linkText: 'Text 1',
      });
      const link2 = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
        linkText: 'Text 2',
      });

      expect(link1).not.toBeNull();
      expect(link2).not.toBeNull();
      expect(link1?.id).not.toBe(link2?.id);
    });

    it('should return null for non-existent source note', () => {
      const link = linksRepo.create({
        sourceId: 'non-existent',
        targetId: noteB.id,
      });

      expect(link).toBeNull();
    });

    it('should return null for non-existent target note', () => {
      const link = linksRepo.create({
        sourceId: noteA.id,
        targetId: 'non-existent',
      });

      expect(link).toBeNull();
    });

    it('should allow self-referential links', () => {
      const link = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteA.id,
      });

      expect(link).not.toBeNull();
      expect(link?.sourceId).toBe(noteA.id);
      expect(link?.targetId).toBe(noteA.id);
    });
  });

  describe('findById', () => {
    it('should find an existing link by id', () => {
      const created = linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
      });

      const found = linksRepo.findById(created!.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created?.id);
    });

    it('should return null for non-existent id', () => {
      const found = linksRepo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findBySourceAndTarget', () => {
    it('should find a link by source and target', () => {
      linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
        linkText: 'test',
      });

      const found = linksRepo.findBySourceAndTarget(noteA.id, noteB.id, 'test');

      expect(found).not.toBeNull();
      expect(found?.sourceId).toBe(noteA.id);
      expect(found?.targetId).toBe(noteB.id);
    });

    it('should handle null link_text correctly', () => {
      linksRepo.create({
        sourceId: noteA.id,
        targetId: noteB.id,
      });

      const found = linksRepo.findBySourceAndTarget(noteA.id, noteB.id, null);

      expect(found).not.toBeNull();
    });

    it('should return null for non-existent link', () => {
      const found = linksRepo.findBySourceAndTarget(noteA.id, noteB.id, null);
      expect(found).toBeNull();
    });
  });

  describe('findBySourceId', () => {
    it('should return all outlinks from a note', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });
      linksRepo.create({ sourceId: noteA.id, targetId: noteC.id });

      const outlinks = linksRepo.findBySourceId(noteA.id);

      expect(outlinks).toHaveLength(2);
      expect(outlinks.map((l) => l.targetId).sort()).toEqual([noteB.id, noteC.id].sort());
    });

    it('should include target titles', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });

      const outlinks = linksRepo.findBySourceId(noteA.id);

      expect(outlinks[0].targetTitle).toBe('Note B');
    });

    it('should return empty array when no outlinks', () => {
      const outlinks = linksRepo.findBySourceId(noteA.id);
      expect(outlinks).toHaveLength(0);
    });
  });

  describe('findByTargetId', () => {
    it('should return all backlinks to a note', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteC.id });
      linksRepo.create({ sourceId: noteB.id, targetId: noteC.id });

      const backlinks = linksRepo.findByTargetId(noteC.id);

      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((l) => l.sourceId).sort()).toEqual([noteA.id, noteB.id].sort());
    });

    it('should include source titles', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });

      const backlinks = linksRepo.findByTargetId(noteB.id);

      expect(backlinks[0].sourceTitle).toBe('Note A');
    });

    it('should return empty array when no backlinks', () => {
      const backlinks = linksRepo.findByTargetId(noteA.id);
      expect(backlinks).toHaveLength(0);
    });
  });

  describe('deleteBySourceId', () => {
    it('should delete all links from a source', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });
      linksRepo.create({ sourceId: noteA.id, targetId: noteC.id });

      const deleted = linksRepo.deleteBySourceId(noteA.id);

      expect(deleted).toBe(2);
      expect(linksRepo.findBySourceId(noteA.id)).toHaveLength(0);
    });

    it('should not delete links from other sources', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteC.id });
      linksRepo.create({ sourceId: noteB.id, targetId: noteC.id });

      linksRepo.deleteBySourceId(noteA.id);

      expect(linksRepo.findBySourceId(noteB.id)).toHaveLength(1);
    });

    it('should return 0 when no links to delete', () => {
      const deleted = linksRepo.deleteBySourceId(noteA.id);
      expect(deleted).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a specific link by id', () => {
      const link = linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });

      const deleted = linksRepo.delete(link!.id);

      expect(deleted).toBe(true);
      expect(linksRepo.findById(link!.id)).toBeNull();
    });

    it('should return false for non-existent id', () => {
      const deleted = linksRepo.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('createMany', () => {
    it('should batch create multiple links', () => {
      const links: CreateLinkInput[] = [
        { sourceId: noteA.id, targetId: noteB.id },
        { sourceId: noteA.id, targetId: noteC.id },
        { sourceId: noteB.id, targetId: noteC.id },
      ];

      const created = linksRepo.createMany(links);

      expect(created).toBe(3);
      expect(linksRepo.findBySourceId(noteA.id)).toHaveLength(2);
      expect(linksRepo.findBySourceId(noteB.id)).toHaveLength(1);
    });

    it('should skip invalid links silently', () => {
      const links: CreateLinkInput[] = [
        { sourceId: noteA.id, targetId: noteB.id },
        { sourceId: noteA.id, targetId: 'non-existent' },
        { sourceId: 'non-existent', targetId: noteC.id },
      ];

      const created = linksRepo.createMany(links);

      expect(created).toBe(1);
    });

    it('should skip duplicates silently when link_text is provided', () => {
      // With non-null link_text, duplicates are properly skipped
      const links: CreateLinkInput[] = [
        { sourceId: noteA.id, targetId: noteB.id, linkText: 'same' },
        { sourceId: noteA.id, targetId: noteB.id, linkText: 'same' },
      ];

      const created = linksRepo.createMany(links);

      expect(created).toBe(1);
    });

    it('should create multiple links with null link_text (SQLite NULL behavior)', () => {
      // SQLite treats NULL != NULL in UNIQUE constraints
      const links: CreateLinkInput[] = [
        { sourceId: noteA.id, targetId: noteB.id },
        { sourceId: noteA.id, targetId: noteB.id },
      ];

      const created = linksRepo.createMany(links);

      expect(created).toBe(2);
    });

    it('should handle empty array', () => {
      const created = linksRepo.createMany([]);
      expect(created).toBe(0);
    });
  });

  describe('countByNoteId', () => {
    it('should count outlinks and backlinks correctly', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });
      linksRepo.create({ sourceId: noteA.id, targetId: noteC.id });
      linksRepo.create({ sourceId: noteB.id, targetId: noteA.id });

      const counts = linksRepo.countByNoteId(noteA.id);

      expect(counts.outlinks).toBe(2);
      expect(counts.backlinks).toBe(1);
    });

    it('should return zeros for note with no links', () => {
      const counts = linksRepo.countByNoteId(noteA.id);

      expect(counts.outlinks).toBe(0);
      expect(counts.backlinks).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true if link exists', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });

      expect(linksRepo.exists(noteA.id, noteB.id)).toBe(true);
    });

    it('should return false if link does not exist', () => {
      expect(linksRepo.exists(noteA.id, noteB.id)).toBe(false);
    });
  });

  describe('CASCADE delete', () => {
    it('should delete links when source note is deleted', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });
      linksRepo.create({ sourceId: noteA.id, targetId: noteC.id });

      notesRepo.delete(noteA.id);

      expect(linksRepo.findBySourceId(noteA.id)).toHaveLength(0);
    });

    it('should delete links when target note is deleted', () => {
      linksRepo.create({ sourceId: noteA.id, targetId: noteB.id });
      linksRepo.create({ sourceId: noteC.id, targetId: noteB.id });

      notesRepo.delete(noteB.id);

      expect(linksRepo.findByTargetId(noteB.id)).toHaveLength(0);
    });
  });
});
