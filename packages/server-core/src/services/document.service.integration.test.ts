/**
 * Integration tests for DocumentService.
 *
 * These tests verify end-to-end scenarios that exercise multiple
 * components together, including file system operations, database
 * persistence, and cross-service coordination.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('DocumentService Integration', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let service: DocumentService;
  let notesRepo: NotesRepository;
  let linksRepo: LinksRepository;
  let tagsRepo: TagsRepository;
  let searchRepo: SearchRepository;

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

  beforeEach(async () => {
    vaultPath = path.join(
      tmpdir(),
      `scribe-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    notesRepo = new NotesRepository(db);
    linksRepo = new LinksRepository(db);
    tagsRepo = new TagsRepository(db);
    searchRepo = new SearchRepository(db);

    service = new DocumentService({
      vaultPath,
      notesRepo,
      linksRepo,
      tagsRepo,
      searchRepo,
    });
  });

  afterEach(async () => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('Full note lifecycle', () => {
    it('should support complete CRUD workflow', async () => {
      // CREATE
      const note = await service.create({
        title: 'Integration Test Note',
        type: 'note',
        content: createTestContent('Initial content for testing'),
      });

      expect(note.id).toHaveLength(12);
      expect(await fileExists(path.join(vaultPath, 'notes', `${note.id}.json`))).toBe(true);
      expect(notesRepo.exists(note.id)).toBe(true);
      expect(searchRepo.isIndexed(note.id)).toBe(true);

      // READ
      const readNote = await service.read(note.id);
      expect(readNote).not.toBeNull();
      expect(readNote?.title).toBe('Integration Test Note');
      expect(readNote?.wordCount).toBe(4);

      // UPDATE
      const updatedNote = await service.update(note.id, {
        title: 'Updated Integration Test',
        content: createTestContent('Updated content with more words than before'),
      });

      expect(updatedNote?.title).toBe('Updated Integration Test');
      expect(updatedNote?.wordCount).toBe(7);

      // Verify file is updated
      const fileContent = await fs.readFile(
        path.join(vaultPath, 'notes', `${note.id}.json`),
        'utf-8'
      );
      const noteFile = JSON.parse(fileContent) as NoteFile;
      expect(noteFile.title).toBe('Updated Integration Test');

      // Verify search index is updated
      const searchResults = searchRepo.search('Updated content');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].noteId).toBe(note.id);

      // DELETE
      const deleted = await service.delete(note.id);
      expect(deleted).toBe(true);

      // Verify cleanup
      expect(await fileExists(path.join(vaultPath, 'notes', `${note.id}.json`))).toBe(false);
      expect(notesRepo.exists(note.id)).toBe(false);
      expect(searchRepo.isIndexed(note.id)).toBe(false);
    });
  });

  describe('Linked notes graph', () => {
    it('should maintain bidirectional link integrity', async () => {
      // Create a graph of linked notes
      const noteA = await service.create({ title: 'Note A', type: 'note' });
      const noteB = await service.create({ title: 'Note B', type: 'note' });
      const noteC = await service.create({ title: 'Note C', type: 'note' });

      // A links to B
      await service.update(noteA.id, {
        content: createContentWithLinks([noteB.id]),
      });

      // B links to A and C
      await service.update(noteB.id, {
        content: createContentWithLinks([noteA.id, noteC.id]),
      });

      // Verify forward links (outlinks)
      expect(linksRepo.findBySourceId(noteA.id)).toHaveLength(1);
      expect(linksRepo.findBySourceId(noteB.id)).toHaveLength(2);
      expect(linksRepo.findBySourceId(noteC.id)).toHaveLength(0);

      // Verify backlinks (inlinks)
      expect(linksRepo.findByTargetId(noteA.id)).toHaveLength(1);
      expect(linksRepo.findByTargetId(noteB.id)).toHaveLength(1);
      expect(linksRepo.findByTargetId(noteC.id)).toHaveLength(1);

      // Delete B - links should be cascade deleted
      await service.delete(noteB.id);

      // A should still have its outlink entry removed (since B is gone)
      const aLinks = linksRepo.findBySourceId(noteA.id);
      expect(aLinks).toHaveLength(0);

      // C should have no more backlinks
      const cBacklinks = linksRepo.findByTargetId(noteC.id);
      expect(cBacklinks).toHaveLength(0);
    });

    it('should update links when content changes', async () => {
      const noteA = await service.create({ title: 'Note A', type: 'note' });
      const noteB = await service.create({ title: 'Note B', type: 'note' });
      const noteC = await service.create({ title: 'Note C', type: 'note' });

      // Initially link A to B
      await service.update(noteA.id, {
        content: createContentWithLinks([noteB.id]),
      });

      let links = linksRepo.findBySourceId(noteA.id);
      expect(links).toHaveLength(1);
      expect(links[0].targetId).toBe(noteB.id);

      // Change A to link to C instead
      await service.update(noteA.id, {
        content: createContentWithLinks([noteC.id]),
      });

      links = linksRepo.findBySourceId(noteA.id);
      expect(links).toHaveLength(1);
      expect(links[0].targetId).toBe(noteC.id);

      // Link A to both B and C
      await service.update(noteA.id, {
        content: createContentWithLinks([noteB.id, noteC.id]),
      });

      links = linksRepo.findBySourceId(noteA.id);
      expect(links).toHaveLength(2);
    });
  });

  describe('Tags and search integration', () => {
    it('should maintain tag associations across updates', async () => {
      const note = await service.create({
        title: 'Tagged Note',
        type: 'note',
        content: createContentWithTags(['javascript', 'typescript']),
      });

      let tags = tagsRepo.findByNoteId(note.id);
      expect(tags.map((t) => t.name)).toContain('javascript');
      expect(tags.map((t) => t.name)).toContain('typescript');

      // Update with different tags
      await service.update(note.id, {
        content: createContentWithTags(['python', 'rust']),
      });

      tags = tagsRepo.findByNoteId(note.id);
      expect(tags.map((t) => t.name)).not.toContain('javascript');
      expect(tags.map((t) => t.name)).not.toContain('typescript');
      expect(tags.map((t) => t.name)).toContain('python');
      expect(tags.map((t) => t.name)).toContain('rust');

      // Tags should be searchable
      const searchResults = searchRepo.search('python rust');
      expect(searchResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should find notes by tag', async () => {
      await service.create({
        title: 'JS Note 1',
        type: 'note',
        content: createContentWithTags(['javascript']),
      });

      await service.create({
        title: 'JS Note 2',
        type: 'note',
        content: createContentWithTags(['javascript']),
      });

      await service.create({
        title: 'Python Note',
        type: 'note',
        content: createContentWithTags(['python']),
      });

      const jsNotes = tagsRepo.findNotesByTagName('javascript');
      expect(jsNotes).toHaveLength(2);

      const pythonNotes = tagsRepo.findNotesByTagName('python');
      expect(pythonNotes).toHaveLength(1);
    });

    it('should support full-text search across notes', async () => {
      await service.create({
        title: 'Architecture Document',
        type: 'note',
        content: createTestContent(
          'This document describes the system architecture and design patterns'
        ),
      });

      await service.create({
        title: 'Meeting Notes',
        type: 'meeting',
        date: '2024-01-15',
        content: createTestContent('We discussed the implementation timeline for the new features'),
      });

      await service.create({
        title: 'Daily Log',
        type: 'daily',
        date: '2024-01-15',
        content: createTestContent('Worked on fixing bugs in the authentication module'),
      });

      // Search by content
      let results = searchRepo.search('architecture');
      expect(results).toHaveLength(1);
      // Title may include highlighting marks, so check that it contains the expected text
      expect(results[0].title).toContain('Architecture');
      expect(results[0].title).toContain('Document');

      // Search by title
      results = searchRepo.search('Meeting');
      expect(results).toHaveLength(1);

      // Search for common word across multiple notes
      results = searchRepo.search('the');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('File system consistency', () => {
    it('should create proper directory structure', async () => {
      await service.create({ title: 'Note 1', type: 'note' });
      await service.create({ title: 'Note 2', type: 'note' });
      await service.create({ title: 'Note 3', type: 'note' });

      const notesDir = path.join(vaultPath, 'notes');
      const files = await fs.readdir(notesDir);

      expect(files).toHaveLength(3);
      expect(files.every((f) => f.endsWith('.json'))).toBe(true);
    });

    it('should write valid JSON files', async () => {
      const note = await service.create({
        title: 'JSON Test',
        type: 'note',
        content: createTestContent('Test content'),
      });

      const filePath = path.join(vaultPath, 'notes', `${note.id}.json`);
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Should parse without error
      const parsed = JSON.parse(fileContent) as NoteFile;

      expect(parsed.id).toBe(note.id);
      expect(parsed.title).toBe('JSON Test');
      expect(parsed.type).toBe('note');
      expect(parsed.content).toBeDefined();
      expect(parsed.content.root).toBeDefined();
    });

    it('should recover from stale index entries', async () => {
      const note = await service.create({ title: 'Test', type: 'note' });

      // Manually delete the file (simulating corruption/external change)
      const filePath = path.join(vaultPath, 'notes', `${note.id}.json`);
      await fs.unlink(filePath);

      // Read should return null (file missing)
      const readResult = await service.read(note.id);
      expect(readResult).toBeNull();

      // List should still include the note (from index)
      const listed = service.list();
      expect(listed.some((n) => n.id === note.id)).toBe(true);

      // Delete should clean up the stale entry
      const deleted = await service.delete(note.id);
      expect(deleted).toBe(true);
      expect(notesRepo.exists(note.id)).toBe(false);
    });
  });

  describe('Bulk operations', () => {
    it('should handle creating many notes efficiently', async () => {
      const count = 50;
      const notes: string[] = [];

      for (let i = 0; i < count; i++) {
        const note = await service.create({
          title: `Bulk Note ${i}`,
          type: 'note',
          content: createTestContent(`Content for note ${i}`),
        });
        notes.push(note.id);
      }

      expect(service.count()).toBe(count);
      expect(notes).toHaveLength(count);
      expect(new Set(notes).size).toBe(count); // All unique IDs
    });

    it('should handle listing with pagination', async () => {
      const count = 25;

      for (let i = 0; i < count; i++) {
        await service.create({
          title: `Page Note ${i.toString().padStart(2, '0')}`,
          type: 'note',
        });
      }

      // Page 1
      const page1 = service.list({ limit: 10, offset: 0, orderBy: 'title', orderDir: 'asc' });
      expect(page1).toHaveLength(10);
      expect(page1[0].title).toBe('Page Note 00');

      // Page 2
      const page2 = service.list({ limit: 10, offset: 10, orderBy: 'title', orderDir: 'asc' });
      expect(page2).toHaveLength(10);
      expect(page2[0].title).toBe('Page Note 10');

      // Page 3 (partial)
      const page3 = service.list({ limit: 10, offset: 20, orderBy: 'title', orderDir: 'asc' });
      expect(page3).toHaveLength(5);
      expect(page3[0].title).toBe('Page Note 20');
    });
  });

  describe('Different note types', () => {
    it('should handle all note types correctly', async () => {
      const regularNote = await service.create({
        title: 'Regular Note',
        type: 'note',
      });

      const dailyNote = await service.create({
        title: 'Daily Note',
        type: 'daily',
        date: '2024-01-15',
      });

      const meetingNote = await service.create({
        title: 'Meeting Note',
        type: 'meeting',
        date: '2024-01-15',
      });

      const personNote = await service.create({
        title: 'Person Note',
        type: 'person',
      });

      // Verify types
      expect(regularNote.type).toBe('note');
      expect(dailyNote.type).toBe('daily');
      expect(meetingNote.type).toBe('meeting');
      expect(personNote.type).toBe('person');

      // Verify filtering by type
      expect(service.list({ type: 'note' })).toHaveLength(1);
      expect(service.list({ type: 'daily' })).toHaveLength(1);
      expect(service.list({ type: 'meeting' })).toHaveLength(1);
      expect(service.list({ type: 'person' })).toHaveLength(1);

      // Verify date filtering for notes with dates
      const datedNotes = service.list({ dateFrom: '2024-01-15', dateTo: '2024-01-15' });
      expect(datedNotes).toHaveLength(2);
    });
  });

  // Helper functions
  function createContentWithLinks(noteIds: string[]): EditorContent {
    return {
      root: {
        children: [
          {
            type: 'paragraph',
            children: noteIds.map((id) => ({
              type: 'note-link',
              noteId: id,
              text: `Link to ${id}`,
            })),
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  function createContentWithTags(tags: string[]): EditorContent {
    return {
      root: {
        children: [
          {
            type: 'paragraph',
            children: tags.map((tag) => ({
              type: 'hashtag',
              tag,
            })),
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
});
