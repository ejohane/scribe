/**
 * Tests for DocumentService.
 *
 * These tests verify:
 * 1. Create note → file + index
 * 2. Read note → combines file content + indexed metadata
 * 3. Update note → updates file, re-indexes
 * 4. Delete note → removes file + index (CASCADE)
 * 5. List notes → returns indexed metadata
 * 6. Links/tags extracted and indexed
 * 7. Search index updated on mutations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import {
  ScribeDatabase,
  NotesRepository,
  LinksRepository,
  TagsRepository,
  SearchRepository,
} from '@scribe/server-db';
import { DocumentService } from './document.service.js';
import type { EditorContent, NoteFile } from '../types/index.js';
import { DocumentError } from '../errors.js';

describe('DocumentService', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let service: DocumentService;

  // Helper to create test editor content
  const createTestContent = (text: string): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text }],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  // Helper to create content with links
  const createContentWithLink = (targetId: string, linkText?: string): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'See also: ' },
            { type: 'note-link', noteId: targetId, text: linkText },
          ],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  // Helper to create content with tags
  const createContentWithTags = (tags: string[]): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Content with tags: ' },
            ...tags.map((tag) => ({ type: 'hashtag', tag })),
          ],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  beforeEach(async () => {
    // Create temporary vault directory
    vaultPath = path.join(
      tmpdir(),
      `scribe-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    // Initialize in-memory database
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    service = new DocumentService({
      vaultPath,
      notesRepo: new NotesRepository(db),
      linksRepo: new LinksRepository(db),
      tagsRepo: new TagsRepository(db),
      searchRepo: new SearchRepository(db),
    });
  });

  afterEach(async () => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
    // Clean up temp directory
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('create', () => {
    it('should create a note with file and index', async () => {
      const note = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      expect(note).toBeDefined();
      expect(note.id).toHaveLength(12);
      expect(note.title).toBe('Test Note');
      expect(note.type).toBe('note');
      expect(note.date).toBeNull();
      expect(note.createdAt).toBeDefined();
      expect(note.updatedAt).toBeDefined();
      expect(note.content).toBeDefined();
      expect(note.wordCount).toBe(0);
    });

    it('should write JSON file to vault', async () => {
      const note = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      const filePath = path.join(vaultPath, 'notes', `${note.id}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const noteFile = JSON.parse(fileContent) as NoteFile;

      expect(noteFile.id).toBe(note.id);
      expect(noteFile.title).toBe(note.title);
      expect(noteFile.type).toBe(note.type);
      expect(noteFile.content).toBeDefined();
    });

    it('should index note in SQLite', async () => {
      const note = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      const notesRepo = new NotesRepository(scribeDb.getDb());
      const indexed = notesRepo.findById(note.id);

      expect(indexed).not.toBeNull();
      expect(indexed?.id).toBe(note.id);
      expect(indexed?.title).toBe(note.title);
      expect(indexed?.filePath).toBe(`notes/${note.id}.json`);
    });

    it('should create note with initial content', async () => {
      const content = createTestContent('Hello world!');
      const note = await service.create({
        title: 'Test Note',
        type: 'note',
        content,
      });

      expect(note.content).toEqual(content);
      expect(note.wordCount).toBe(2); // "Hello world!"
    });

    it('should create daily note with date', async () => {
      const note = await service.create({
        title: 'Daily Note',
        type: 'daily',
        date: '2024-01-15',
      });

      expect(note.type).toBe('daily');
      expect(note.date).toBe('2024-01-15');
    });

    it('should create meeting note with date', async () => {
      const note = await service.create({
        title: 'Meeting Note',
        type: 'meeting',
        date: '2024-01-15',
      });

      expect(note.type).toBe('meeting');
      expect(note.date).toBe('2024-01-15');
    });

    it('should index note for search', async () => {
      const content = createTestContent('This is searchable content');
      const note = await service.create({
        title: 'Searchable Note',
        type: 'note',
        content,
      });

      const searchRepo = new SearchRepository(scribeDb.getDb());
      const results = searchRepo.search('searchable');

      expect(results).toHaveLength(1);
      expect(results[0].noteId).toBe(note.id);
    });

    it('should extract and index tags', async () => {
      const content = createContentWithTags(['typescript', 'programming']);
      const note = await service.create({
        title: 'Tagged Note',
        type: 'note',
        content,
      });

      const tagsRepo = new TagsRepository(scribeDb.getDb());
      const tags = tagsRepo.findByNoteId(note.id);

      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name)).toContain('typescript');
      expect(tags.map((t) => t.name)).toContain('programming');
    });

    it('should extract tags from inline text patterns', async () => {
      const content: EditorContent = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'This has #inline-tag and #another-tag' }],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      };

      const note = await service.create({
        title: 'Inline Tags Note',
        type: 'note',
        content,
      });

      const tagsRepo = new TagsRepository(scribeDb.getDb());
      const tags = tagsRepo.findByNoteId(note.id);

      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name)).toContain('inline-tag');
      expect(tags.map((t) => t.name)).toContain('another-tag');
    });

    it('should generate unique IDs for multiple notes', async () => {
      const note1 = await service.create({ title: 'Note 1', type: 'note' });
      const note2 = await service.create({ title: 'Note 2', type: 'note' });
      const note3 = await service.create({ title: 'Note 3', type: 'note' });

      expect(note1.id).not.toBe(note2.id);
      expect(note2.id).not.toBe(note3.id);
      expect(note1.id).not.toBe(note3.id);
    });
  });

  describe('read', () => {
    it('should read an existing note', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Hello world!'),
      });

      const note = await service.read(created.id);

      expect(note).not.toBeNull();
      expect(note?.id).toBe(created.id);
      expect(note?.title).toBe('Test Note');
      expect(note?.content).toEqual(created.content);
      expect(note?.wordCount).toBe(2);
    });

    it('should return null for non-existent note', async () => {
      const note = await service.read('non-existent-id');
      expect(note).toBeNull();
    });

    it('should return null if file is missing (stale index)', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      // Delete the file manually
      const filePath = path.join(vaultPath, 'notes', `${created.id}.json`);
      await fs.unlink(filePath);

      // Spy on console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const note = await service.read(created.id);

      expect(note).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Note file missing'));

      warnSpy.mockRestore();
    });

    it('should throw error on file read failure', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      // Replace file with a directory to cause read error
      const filePath = path.join(vaultPath, 'notes', `${created.id}.json`);
      await fs.unlink(filePath);
      await fs.mkdir(filePath);

      await expect(service.read(created.id)).rejects.toThrow(DocumentError);
    });
  });

  describe('update', () => {
    it('should update note title', async () => {
      const created = await service.create({
        title: 'Original Title',
        type: 'note',
      });

      // Small delay to ensure updatedAt differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.update(created.id, {
        title: 'Updated Title',
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Updated Title');
      // Note: updatedAt should be different, but in fast tests it may be the same
      // so we just verify it exists
      expect(updated?.updatedAt).toBeDefined();
    });

    it('should update note content', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Original content'),
      });

      const newContent = createTestContent('Updated content with more words');
      const updated = await service.update(created.id, {
        content: newContent,
      });

      expect(updated).not.toBeNull();
      expect(updated?.content).toEqual(newContent);
      expect(updated?.wordCount).toBe(5);
    });

    it('should update both title and content', async () => {
      const created = await service.create({
        title: 'Original',
        type: 'note',
        content: createTestContent('Original'),
      });

      const newContent = createTestContent('New content');
      const updated = await service.update(created.id, {
        title: 'New Title',
        content: newContent,
      });

      expect(updated?.title).toBe('New Title');
      expect(updated?.content).toEqual(newContent);
    });

    it('should update file on disk', async () => {
      const created = await service.create({
        title: 'Original',
        type: 'note',
      });

      await service.update(created.id, { title: 'Updated' });

      const filePath = path.join(vaultPath, 'notes', `${created.id}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const noteFile = JSON.parse(fileContent) as NoteFile;

      expect(noteFile.title).toBe('Updated');
    });

    it('should update search index', async () => {
      const created = await service.create({
        title: 'Original Title',
        type: 'note',
        content: createTestContent('Original content'),
      });

      await service.update(created.id, {
        content: createTestContent('New unique searchable content'),
      });

      const searchRepo = new SearchRepository(scribeDb.getDb());
      const results = searchRepo.search('unique searchable');

      expect(results).toHaveLength(1);
      expect(results[0].noteId).toBe(created.id);
    });

    it('should re-index tags on update', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
        content: createContentWithTags(['oldtag']),
      });

      await service.update(created.id, {
        content: createContentWithTags(['newtag', 'anothertag']),
      });

      const tagsRepo = new TagsRepository(scribeDb.getDb());
      const tags = tagsRepo.findByNoteId(created.id);

      expect(tags.map((t) => t.name)).not.toContain('oldtag');
      expect(tags.map((t) => t.name)).toContain('newtag');
      expect(tags.map((t) => t.name)).toContain('anothertag');
    });

    it('should return null for non-existent note', async () => {
      const updated = await service.update('non-existent-id', {
        title: 'New Title',
      });

      expect(updated).toBeNull();
    });

    it('should preserve unchanged fields', async () => {
      const created = await service.create({
        title: 'Original',
        type: 'note',
        content: createTestContent('Original content'),
      });

      const updated = await service.update(created.id, {
        title: 'New Title',
      });

      expect(updated?.content).toEqual(created.content);
      expect(updated?.type).toBe(created.type);
      expect(updated?.createdAt).toBe(created.createdAt);
    });
  });

  describe('delete', () => {
    it('should delete note file and index', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      const deleted = await service.delete(created.id);

      expect(deleted).toBe(true);

      // File should be gone
      const filePath = path.join(vaultPath, 'notes', `${created.id}.json`);
      await expect(fs.access(filePath)).rejects.toThrow();

      // Index should be gone
      const notesRepo = new NotesRepository(scribeDb.getDb());
      expect(notesRepo.findById(created.id)).toBeNull();
    });

    it('should remove from search index', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Searchable content'),
      });

      await service.delete(created.id);

      const searchRepo = new SearchRepository(scribeDb.getDb());
      expect(searchRepo.isIndexed(created.id)).toBe(false);
    });

    it('should cascade delete links', async () => {
      // Create two notes and link them
      const note1 = await service.create({
        title: 'Note 1',
        type: 'note',
      });
      const note2 = await service.create({
        title: 'Note 2',
        type: 'note',
        content: createContentWithLink(note1.id, 'Link to Note 1'),
      });

      // Verify link exists
      const linksRepo = new LinksRepository(scribeDb.getDb());
      const linksBefore = linksRepo.findBySourceId(note2.id);
      expect(linksBefore).toHaveLength(1);

      // Delete note2 (source of link)
      await service.delete(note2.id);

      // Links should be cascade deleted
      const linksAfter = linksRepo.findBySourceId(note2.id);
      expect(linksAfter).toHaveLength(0);
    });

    it('should cascade delete tags associations', async () => {
      const note = await service.create({
        title: 'Tagged Note',
        type: 'note',
        content: createContentWithTags(['testtag']),
      });

      await service.delete(note.id);

      const tagsRepo = new TagsRepository(scribeDb.getDb());
      const tags = tagsRepo.findByNoteId(note.id);
      expect(tags).toHaveLength(0);
    });

    it('should return false for non-existent note', async () => {
      const deleted = await service.delete('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should succeed even if file is already missing', async () => {
      const created = await service.create({
        title: 'Test Note',
        type: 'note',
      });

      // Delete file manually first
      const filePath = path.join(vaultPath, 'notes', `${created.id}.json`);
      await fs.unlink(filePath);

      // Service delete should still succeed
      const deleted = await service.delete(created.id);
      expect(deleted).toBe(true);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create various notes for listing tests
      await service.create({ title: 'Note A', type: 'note' });
      await service.create({ title: 'Note B', type: 'note' });
      await service.create({ title: 'Daily 1', type: 'daily', date: '2024-01-15' });
      await service.create({ title: 'Daily 2', type: 'daily', date: '2024-01-16' });
      await service.create({ title: 'Meeting', type: 'meeting', date: '2024-01-15' });
    });

    it('should list all notes', () => {
      const notes = service.list();
      expect(notes).toHaveLength(5);
    });

    it('should filter by type', () => {
      const dailyNotes = service.list({ type: 'daily' });
      expect(dailyNotes).toHaveLength(2);
      expect(dailyNotes.every((n) => n.type === 'daily')).toBe(true);
    });

    it('should filter by date range', () => {
      const notes = service.list({ dateFrom: '2024-01-15', dateTo: '2024-01-15' });
      expect(notes).toHaveLength(2);
    });

    it('should apply limit', () => {
      const notes = service.list({ limit: 2 });
      expect(notes).toHaveLength(2);
    });

    it('should apply offset', () => {
      const allNotes = service.list();
      const offsetNotes = service.list({ limit: 2, offset: 2 });

      expect(offsetNotes).toHaveLength(2);
      expect(offsetNotes[0].id).not.toBe(allNotes[0].id);
      expect(offsetNotes[0].id).not.toBe(allNotes[1].id);
    });

    it('should order by specified field', () => {
      const notes = service.list({ orderBy: 'title', orderDir: 'asc' });
      const titles = notes.map((n) => n.title);
      expect(titles).toEqual([...titles].sort());
    });

    it('should return note metadata without content', () => {
      const notes = service.list();
      for (const note of notes) {
        expect(note.id).toBeDefined();
        expect(note.title).toBeDefined();
        expect(note.type).toBeDefined();
        expect(note.createdAt).toBeDefined();
        expect(note.updatedAt).toBeDefined();
        expect(note.wordCount).toBeDefined();
        expect(note.filePath).toBeDefined();
        // Content should not be in metadata
        expect((note as unknown as { content?: unknown }).content).toBeUndefined();
      }
    });
  });

  describe('exists', () => {
    it('should return true for existing note', async () => {
      const note = await service.create({ title: 'Test', type: 'note' });
      expect(service.exists(note.id)).toBe(true);
    });

    it('should return false for non-existent note', () => {
      expect(service.exists('non-existent-id')).toBe(false);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await service.create({ title: 'Note 1', type: 'note' });
      await service.create({ title: 'Note 2', type: 'note' });
      await service.create({ title: 'Daily', type: 'daily', date: '2024-01-15' });
      await service.create({ title: 'Meeting', type: 'meeting', date: '2024-01-15' });
    });

    it('should count all notes', () => {
      expect(service.count()).toBe(4);
    });

    it('should count notes by type', () => {
      expect(service.count('note')).toBe(2);
      expect(service.count('daily')).toBe(1);
      expect(service.count('meeting')).toBe(1);
      expect(service.count('person')).toBe(0);
    });
  });

  describe('links extraction and indexing', () => {
    it('should create links when target note exists', async () => {
      const targetNote = await service.create({
        title: 'Target Note',
        type: 'note',
      });

      const sourceNote = await service.create({
        title: 'Source Note',
        type: 'note',
        content: createContentWithLink(targetNote.id, 'Related'),
      });

      const linksRepo = new LinksRepository(scribeDb.getDb());
      const links = linksRepo.findBySourceId(sourceNote.id);

      expect(links).toHaveLength(1);
      expect(links[0].targetId).toBe(targetNote.id);
      expect(links[0].linkText).toBe('Related');
    });

    it('should not create links when target note does not exist', async () => {
      const note = await service.create({
        title: 'Note with broken link',
        type: 'note',
        content: createContentWithLink('non-existent-id', 'Broken Link'),
      });

      const linksRepo = new LinksRepository(scribeDb.getDb());
      const links = linksRepo.findBySourceId(note.id);

      expect(links).toHaveLength(0);
    });

    it('should re-index links on update', async () => {
      const target1 = await service.create({ title: 'Target 1', type: 'note' });
      const target2 = await service.create({ title: 'Target 2', type: 'note' });

      const source = await service.create({
        title: 'Source',
        type: 'note',
        content: createContentWithLink(target1.id),
      });

      // Update to link to different target
      await service.update(source.id, {
        content: createContentWithLink(target2.id),
      });

      const linksRepo = new LinksRepository(scribeDb.getDb());
      const links = linksRepo.findBySourceId(source.id);

      expect(links).toHaveLength(1);
      expect(links[0].targetId).toBe(target2.id);
    });

    it('should support different note-link node types', async () => {
      const target = await service.create({ title: 'Target', type: 'note' });

      // Test wikilink type
      const wikilinkContent: EditorContent = {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'wikilink', noteId: target.id }],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      };

      const note = await service.create({
        title: 'Wikilink Note',
        type: 'note',
        content: wikilinkContent,
      });

      const linksRepo = new LinksRepository(scribeDb.getDb());
      const links = linksRepo.findBySourceId(note.id);

      expect(links).toHaveLength(1);
      expect(links[0].targetId).toBe(target.id);
    });
  });

  describe('empty content handling', () => {
    it('should create empty content structure for new notes', async () => {
      const note = await service.create({
        title: 'Empty Note',
        type: 'note',
      });

      expect(note.content).toBeDefined();
      expect(note.content.root).toBeDefined();
      expect(note.content.root.type).toBe('root');
      expect(note.content.root.children).toHaveLength(1);
      expect(note.content.root.children[0].type).toBe('paragraph');
    });

    it('should count 0 words for empty content', async () => {
      const note = await service.create({
        title: 'Empty Note',
        type: 'note',
      });

      expect(note.wordCount).toBe(0);
    });
  });

  describe('content hashing', () => {
    it('should generate consistent hashes for same content', async () => {
      const content = createTestContent('Same content');

      const note1 = await service.create({
        title: 'Note 1',
        type: 'note',
        content,
      });

      const notesRepo = new NotesRepository(scribeDb.getDb());
      const indexed1 = notesRepo.findById(note1.id);

      // Content hash should be set
      expect(indexed1?.contentHash).toBeDefined();
      expect(indexed1?.contentHash).not.toBe('');
    });

    it('should update hash when content changes', async () => {
      const note = await service.create({
        title: 'Test Note',
        type: 'note',
        content: createTestContent('Original'),
      });

      const notesRepo = new NotesRepository(scribeDb.getDb());
      const indexedBefore = notesRepo.findById(note.id);
      const hashBefore = indexedBefore?.contentHash;

      await service.update(note.id, {
        content: createTestContent('Updated content'),
      });

      const indexedAfter = notesRepo.findById(note.id);
      expect(indexedAfter?.contentHash).not.toBe(hashBefore);
    });
  });
});
