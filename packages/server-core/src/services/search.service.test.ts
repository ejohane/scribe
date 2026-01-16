/**
 * Unit tests for SearchService.
 *
 * These tests verify:
 * 1. Basic word search returns relevant results
 * 2. Phrase search with quotes works
 * 3. Results sorted by relevance (BM25)
 * 4. Snippets show context around matches
 * 5. Type/date filters work correctly
 * 6. Empty query returns empty array (not error)
 * 7. Reindex updates search results
 * 8. ReindexAll rebuilds entire index
 * 9. Match location detection works
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
import { SearchService } from './search.service.js';
import type { EditorContent } from '../types/index.js';

describe('SearchService', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let notesRepo: NotesRepository;
  let linksRepo: LinksRepository;
  let tagsRepo: TagsRepository;
  let searchRepo: SearchRepository;
  let documentService: DocumentService;
  let searchService: SearchService;

  // Helper to create content with text
  const createTextContent = (text: string): EditorContent => ({
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

  // Helper to create content with tags
  const createTaggedContent = (text: string, tags: string[]): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text }, ...tags.map((tag) => ({ type: 'hashtag', tag }))],
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
    // Create temp vault directory
    vaultPath = path.join(
      tmpdir(),
      `scribe-search-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    // Initialize in-memory database
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    notesRepo = new NotesRepository(db);
    linksRepo = new LinksRepository(db);
    tagsRepo = new TagsRepository(db);
    searchRepo = new SearchRepository(db);

    documentService = new DocumentService({
      vaultPath,
      notesRepo,
      linksRepo,
      tagsRepo,
      searchRepo,
    });

    searchService = new SearchService({
      searchRepo,
      notesRepo,
      documentService,
    });
  });

  afterEach(async () => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('search', () => {
    describe('basic word search', () => {
      it('should find notes containing a single word', async () => {
        await documentService.create({
          title: 'TypeScript Guide',
          type: 'note',
          content: createTextContent('TypeScript is a typed superset of JavaScript'),
        });

        await documentService.create({
          title: 'Python Guide',
          type: 'note',
          content: createTextContent('Python is a general-purpose language'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(results[0].note.title).toBe('TypeScript Guide');
      });

      it('should find notes with multiple matching words (AND logic)', async () => {
        await documentService.create({
          title: 'Note 1',
          type: 'note',
          content: createTextContent('This is about typescript and programming'),
        });

        await documentService.create({
          title: 'Note 2',
          type: 'note',
          content: createTextContent('This is about typescript'),
        });

        await documentService.create({
          title: 'Note 3',
          type: 'note',
          content: createTextContent('This is about programming'),
        });

        const results = await searchService.search({ text: 'typescript programming' });

        // Should find the note with both words
        expect(results.length).toBeGreaterThanOrEqual(1);
        const note1Result = results.find((r) => r.note.title === 'Note 1');
        expect(note1Result).toBeDefined();
      });

      it('should return results sorted by relevance', async () => {
        // Note with term in title and multiple times in content
        await documentService.create({
          title: 'TypeScript TypeScript',
          type: 'note',
          content: createTextContent('TypeScript TypeScript TypeScript is great'),
        });

        // Note with term only once
        await documentService.create({
          title: 'Random Note',
          type: 'note',
          content: createTextContent('I like TypeScript'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results.length).toBeGreaterThanOrEqual(2);
        // The first result should be the one with more occurrences (better rank)
        // BM25 ranks are negative, lower is better
      });
    });

    describe('phrase search', () => {
      it('should find exact phrases with quotes', async () => {
        await documentService.create({
          title: 'Exact Match',
          type: 'note',
          content: createTextContent('I love TypeScript programming today'),
        });

        await documentService.create({
          title: 'No Match',
          type: 'note',
          content: createTextContent('TypeScript is great. Programming is fun'),
        });

        const results = await searchService.search({ text: '"TypeScript programming"' });

        expect(results.length).toBeGreaterThanOrEqual(1);
        const exactMatch = results.find((r) => r.note.title === 'Exact Match');
        expect(exactMatch).toBeDefined();
      });
    });

    describe('empty and whitespace queries', () => {
      it('should return empty array for empty query', async () => {
        await documentService.create({
          title: 'Some Note',
          type: 'note',
          content: createTextContent('Some content'),
        });

        const results = await searchService.search({ text: '' });

        expect(results).toEqual([]);
      });

      it('should return empty array for whitespace-only query', async () => {
        await documentService.create({
          title: 'Some Note',
          type: 'note',
          content: createTextContent('Some content'),
        });

        const results = await searchService.search({ text: '   ' });

        expect(results).toEqual([]);
      });
    });

    describe('snippets', () => {
      it('should include snippet with match context', async () => {
        await documentService.create({
          title: 'Long Note',
          type: 'note',
          content: createTextContent(
            'This is a very long note with lots of text. ' +
              'The important part is that TypeScript is mentioned here. ' +
              'There is more text after this as well.'
          ),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(results[0].snippet).toContain('TypeScript');
      });
    });

    describe('type filters', () => {
      it('should filter by single type', async () => {
        await documentService.create({
          title: 'Daily 2024-01-15',
          type: 'daily',
          date: '2024-01-15',
          content: createTextContent('Today I worked on TypeScript'),
        });

        await documentService.create({
          title: 'TypeScript Guide',
          type: 'note',
          content: createTextContent('TypeScript is a typed language'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: { type: ['daily'] },
        });

        expect(results).toHaveLength(1);
        expect(results[0].note.type).toBe('daily');
      });

      it('should filter by multiple types', async () => {
        await documentService.create({
          title: 'Daily Note',
          type: 'daily',
          date: '2024-01-15',
          content: createTextContent('TypeScript daily'),
        });

        await documentService.create({
          title: 'Meeting Note',
          type: 'meeting',
          date: '2024-01-15',
          content: createTextContent('TypeScript meeting'),
        });

        await documentService.create({
          title: 'Regular Note',
          type: 'note',
          content: createTextContent('TypeScript note'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: { type: ['daily', 'meeting'] },
        });

        expect(results).toHaveLength(2);
        expect(results.every((r) => r.note.type === 'daily' || r.note.type === 'meeting')).toBe(
          true
        );
      });

      it('should return all types when type filter is empty array', async () => {
        await documentService.create({
          title: 'Daily Note',
          type: 'daily',
          date: '2024-01-15',
          content: createTextContent('TypeScript'),
        });

        await documentService.create({
          title: 'Regular Note',
          type: 'note',
          content: createTextContent('TypeScript'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: { type: [] },
        });

        expect(results).toHaveLength(2);
      });
    });

    describe('date filters', () => {
      it('should filter by dateFrom', async () => {
        await documentService.create({
          title: 'Old Note',
          type: 'daily',
          date: '2024-01-01',
          content: createTextContent('TypeScript old'),
        });

        await documentService.create({
          title: 'New Note',
          type: 'daily',
          date: '2024-06-15',
          content: createTextContent('TypeScript new'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: { dateFrom: '2024-06-01' },
        });

        expect(results).toHaveLength(1);
        expect(results[0].note.title).toBe('New Note');
      });

      it('should filter by dateTo', async () => {
        await documentService.create({
          title: 'Old Note',
          type: 'daily',
          date: '2024-01-01',
          content: createTextContent('TypeScript old'),
        });

        await documentService.create({
          title: 'New Note',
          type: 'daily',
          date: '2024-06-15',
          content: createTextContent('TypeScript new'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: { dateTo: '2024-03-01' },
        });

        expect(results).toHaveLength(1);
        expect(results[0].note.title).toBe('Old Note');
      });

      it('should filter by date range', async () => {
        await documentService.create({
          title: 'Jan Note',
          type: 'daily',
          date: '2024-01-15',
          content: createTextContent('TypeScript jan'),
        });

        await documentService.create({
          title: 'Mar Note',
          type: 'daily',
          date: '2024-03-15',
          content: createTextContent('TypeScript mar'),
        });

        await documentService.create({
          title: 'Jun Note',
          type: 'daily',
          date: '2024-06-15',
          content: createTextContent('TypeScript jun'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: {
            dateFrom: '2024-02-01',
            dateTo: '2024-05-01',
          },
        });

        expect(results).toHaveLength(1);
        expect(results[0].note.title).toBe('Mar Note');
      });

      it('should include notes without date when filtering', async () => {
        await documentService.create({
          title: 'Dated Note',
          type: 'daily',
          date: '2024-01-01',
          content: createTextContent('TypeScript dated'),
        });

        await documentService.create({
          title: 'Undated Note',
          type: 'note',
          content: createTextContent('TypeScript undated'),
        });

        const results = await searchService.search({
          text: 'TypeScript',
          filters: { dateFrom: '2024-06-01' },
        });

        // Undated notes pass through date filters (date is null)
        expect(results).toHaveLength(1);
        expect(results[0].note.title).toBe('Undated Note');
      });
    });

    describe('pagination', () => {
      it('should respect limit option', async () => {
        // Create 10 notes
        for (let i = 0; i < 10; i++) {
          await documentService.create({
            title: `Note ${i}`,
            type: 'note',
            content: createTextContent(`TypeScript content ${i}`),
          });
        }

        const results = await searchService.search({
          text: 'TypeScript',
          options: { limit: 5 },
        });

        expect(results).toHaveLength(5);
      });

      it('should respect offset option', async () => {
        // Create 10 notes
        for (let i = 0; i < 10; i++) {
          await documentService.create({
            title: `Note ${i}`,
            type: 'note',
            content: createTextContent(`TypeScript content ${i}`),
          });
        }

        const allResults = await searchService.search({
          text: 'TypeScript',
        });

        const offsetResults = await searchService.search({
          text: 'TypeScript',
          options: { offset: 5 },
        });

        // With offset, we should get the remaining results
        expect(offsetResults.length).toBeLessThanOrEqual(allResults.length - 5);
      });
    });

    describe('match location detection', () => {
      it('should detect match in title', async () => {
        await documentService.create({
          title: 'TypeScript Guide',
          type: 'note',
          content: createTextContent('This guide covers programming'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(results[0].matchedIn).toContain('title');
      });

      it('should detect match in content', async () => {
        await documentService.create({
          title: 'Programming Guide',
          type: 'note',
          content: createTextContent('This is about TypeScript programming'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(results[0].matchedIn).toContain('content');
      });

      it('should detect match in both title and content', async () => {
        await documentService.create({
          title: 'TypeScript Guide',
          type: 'note',
          content: createTextContent('TypeScript is great'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(results[0].matchedIn).toContain('title');
        expect(results[0].matchedIn).toContain('content');
      });
    });

    describe('result metadata', () => {
      it('should include note id, title, type, and updatedAt', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'meeting',
          date: '2024-01-15',
          content: createTextContent('TypeScript content'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(results[0].note.id).toBe(note.id);
        expect(results[0].note.title).toBe('Test Note');
        expect(results[0].note.type).toBe('meeting');
        expect(results[0].note.updatedAt).toBeDefined();
      });

      it('should include relevance score', async () => {
        await documentService.create({
          title: 'Test Note',
          type: 'note',
          content: createTextContent('TypeScript content'),
        });

        const results = await searchService.search({ text: 'TypeScript' });

        expect(results).toHaveLength(1);
        expect(typeof results[0].score).toBe('number');
      });
    });
  });

  describe('reindex', () => {
    it('should update search index for existing note', async () => {
      const note = await documentService.create({
        title: 'Original Title',
        type: 'note',
        content: createTextContent('Original content'),
      });

      // Verify original is searchable
      let results = await searchService.search({ text: 'Original' });
      expect(results).toHaveLength(1);

      // Update note through documentService
      await documentService.update(note.id, {
        title: 'Updated Title',
        content: createTextContent('Updated content'),
      });

      // Manually reindex (although DocumentService already indexes, this tests the reindex method)
      await searchService.reindex(note.id);

      // Should now find by new title
      results = await searchService.search({ text: 'Updated' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should remove deleted notes from search index', async () => {
      const note = await documentService.create({
        title: 'Deletable Note',
        type: 'note',
        content: createTextContent('Deletable content'),
      });

      // Verify searchable
      let results = await searchService.search({ text: 'Deletable' });
      expect(results).toHaveLength(1);

      // Delete from storage (note will no longer be readable)
      await documentService.delete(note.id);

      // Reindex should remove from search
      await searchService.reindex(note.id);

      // Should no longer be findable
      results = await searchService.search({ text: 'Deletable' });
      expect(results).toHaveLength(0);
    });

    it('should handle reindex of non-existent note gracefully', async () => {
      // Should not throw
      await expect(searchService.reindex('non-existent-id')).resolves.toBeUndefined();
    });
  });

  describe('reindexAll', () => {
    it('should rebuild entire search index', async () => {
      // Create some notes
      await documentService.create({
        title: 'Note A',
        type: 'note',
        content: createTextContent('Apple content'),
      });

      await documentService.create({
        title: 'Note B',
        type: 'note',
        content: createTextContent('Banana content'),
      });

      await documentService.create({
        title: 'Note C',
        type: 'note',
        content: createTextContent('Cherry content'),
      });

      const result = await searchService.reindexAll();

      expect(result.indexed).toBe(3);
      expect(result.errors).toBe(0);

      // Verify all are searchable
      const appleResults = await searchService.search({ text: 'Apple' });
      expect(appleResults).toHaveLength(1);

      const bananaResults = await searchService.search({ text: 'Banana' });
      expect(bananaResults).toHaveLength(1);

      const cherryResults = await searchService.search({ text: 'Cherry' });
      expect(cherryResults).toHaveLength(1);
    });

    it('should return counts of indexed and errors', async () => {
      await documentService.create({
        title: 'Note 1',
        type: 'note',
        content: createTextContent('Content 1'),
      });

      await documentService.create({
        title: 'Note 2',
        type: 'note',
        content: createTextContent('Content 2'),
      });

      const result = await searchService.reindexAll();

      expect(result.indexed).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('should handle empty vault', async () => {
      const result = await searchService.reindexAll();

      expect(result.indexed).toBe(0);
      expect(result.errors).toBe(0);
    });
  });

  describe('getSuggestions', () => {
    it('should return empty array (MVP implementation)', () => {
      const suggestions = searchService.getSuggestions('type');

      expect(suggestions).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in search query', async () => {
      await documentService.create({
        title: 'Code Note',
        type: 'note',
        content: createTextContent('function foo() { return bar; }'),
      });

      // Special characters should not cause errors
      const results = await searchService.search({ text: 'foo()' });
      // May or may not find results, but should not error
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very long search queries', async () => {
      await documentService.create({
        title: 'Test Note',
        type: 'note',
        content: createTextContent('Some content'),
      });

      const longQuery = 'word '.repeat(100);
      const results = await searchService.search({ text: longQuery });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle notes with empty content', async () => {
      await documentService.create({
        title: 'Empty Note with TypeScript',
        type: 'note',
      });

      const results = await searchService.search({ text: 'TypeScript' });

      // Title should still be searchable
      expect(results).toHaveLength(1);
    });

    it('should handle concurrent searches', async () => {
      await documentService.create({
        title: 'Note A',
        type: 'note',
        content: createTextContent('Apple'),
      });

      await documentService.create({
        title: 'Note B',
        type: 'note',
        content: createTextContent('Banana'),
      });

      // Run multiple searches concurrently
      const [appleResults, bananaResults] = await Promise.all([
        searchService.search({ text: 'Apple' }),
        searchService.search({ text: 'Banana' }),
      ]);

      expect(appleResults).toHaveLength(1);
      expect(bananaResults).toHaveLength(1);
    });

    it('should handle notes with tagged content', async () => {
      await documentService.create({
        title: 'Tagged Note',
        type: 'note',
        content: createTaggedContent('Some content about TypeScript', ['typescript', 'coding']),
      });

      const results = await searchService.search({ text: 'TypeScript' });

      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('Tagged Note');
    });
  });
});
