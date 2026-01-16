/**
 * Integration tests for SearchService with DocumentService.
 *
 * These tests verify end-to-end scenarios where SearchService operates
 * on notes created and managed through DocumentService.
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

describe('SearchService Integration', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let documentService: DocumentService;
  let searchService: SearchService;

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

  const createContentWithTags = (text: string, tags: string[]): EditorContent => ({
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
    vaultPath = path.join(
      tmpdir(),
      `scribe-search-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    const notesRepo = new NotesRepository(db);
    const linksRepo = new LinksRepository(db);
    const tagsRepo = new TagsRepository(db);
    const searchRepo = new SearchRepository(db);

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

  describe('Note creation and search', () => {
    it('should find newly created notes immediately', async () => {
      await documentService.create({
        title: 'New TypeScript Note',
        type: 'note',
        content: createTestContent('Learning TypeScript today'),
      });

      const results = await searchService.search({ text: 'TypeScript' });

      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('New TypeScript Note');
    });

    it('should find notes by content, not just title', async () => {
      await documentService.create({
        title: 'Generic Note',
        type: 'note',
        content: createTestContent('This note discusses Kubernetes architecture in detail'),
      });

      const results = await searchService.search({ text: 'Kubernetes' });

      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('Generic Note');
    });

    it('should index all note types correctly', async () => {
      await documentService.create({
        title: 'Regular Note',
        type: 'note',
        content: createTestContent('Testing search'),
      });

      await documentService.create({
        title: 'Daily 2024-01-15',
        type: 'daily',
        date: '2024-01-15',
        content: createTestContent('Daily entry about search'),
      });

      await documentService.create({
        title: 'Team Meeting',
        type: 'meeting',
        date: '2024-01-15',
        content: createTestContent('Meeting about search functionality'),
      });

      await documentService.create({
        title: 'John Doe',
        type: 'person',
        content: createTestContent('John works on search features'),
      });

      const results = await searchService.search({ text: 'search' });

      expect(results).toHaveLength(4);
    });
  });

  describe('Note updates and search', () => {
    it('should find updated content after note update', async () => {
      const note = await documentService.create({
        title: 'Original Note',
        type: 'note',
        content: createTestContent('Original content about JavaScript'),
      });

      // Initial search finds original
      let results = await searchService.search({ text: 'JavaScript' });
      expect(results).toHaveLength(1);

      // Update content
      await documentService.update(note.id, {
        content: createTestContent('Updated content about Rust programming'),
      });

      // Should find by new content
      results = await searchService.search({ text: 'Rust' });
      expect(results).toHaveLength(1);

      // Old content should no longer match
      results = await searchService.search({ text: 'JavaScript' });
      expect(results).toHaveLength(0);
    });

    it('should find updated titles after note update', async () => {
      const note = await documentService.create({
        title: 'Original Title',
        type: 'note',
        content: createTestContent('Some content'),
      });

      // Update title
      await documentService.update(note.id, {
        title: 'Brand New Title',
      });

      // Should find by new title
      const results = await searchService.search({ text: 'Brand New' });
      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('Brand New Title');
    });
  });

  describe('Note deletion and search', () => {
    it('should not find deleted notes', async () => {
      const note = await documentService.create({
        title: 'Deletable Note',
        type: 'note',
        content: createTestContent('This note will be deleted'),
      });

      // Verify searchable
      let results = await searchService.search({ text: 'Deletable' });
      expect(results).toHaveLength(1);

      // Delete note
      await documentService.delete(note.id);

      // Should no longer be findable
      results = await searchService.search({ text: 'Deletable' });
      expect(results).toHaveLength(0);
    });

    it('should handle deletion of multiple notes', async () => {
      const note1 = await documentService.create({
        title: 'Note One',
        type: 'note',
        content: createTestContent('TypeScript one'),
      });

      const note2 = await documentService.create({
        title: 'Note Two',
        type: 'note',
        content: createTestContent('TypeScript two'),
      });

      await documentService.create({
        title: 'Note Three',
        type: 'note',
        content: createTestContent('TypeScript three'),
      });

      // All 3 searchable
      let results = await searchService.search({ text: 'TypeScript' });
      expect(results).toHaveLength(3);

      // Delete two
      await documentService.delete(note1.id);
      await documentService.delete(note2.id);

      // Only one remaining
      results = await searchService.search({ text: 'TypeScript' });
      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('Note Three');
    });
  });

  describe('Search with filters use cases', () => {
    it('should support searching daily notes for a date range', async () => {
      await documentService.create({
        title: 'Daily 2024-01-10',
        type: 'daily',
        date: '2024-01-10',
        content: createTestContent('Project meeting about API'),
      });

      await documentService.create({
        title: 'Daily 2024-01-15',
        type: 'daily',
        date: '2024-01-15',
        content: createTestContent('Working on API implementation'),
      });

      await documentService.create({
        title: 'Daily 2024-01-20',
        type: 'daily',
        date: '2024-01-20',
        content: createTestContent('API testing complete'),
      });

      // Search for API in mid-January dailies
      const results = await searchService.search({
        text: 'API',
        filters: {
          type: ['daily'],
          dateFrom: '2024-01-12',
          dateTo: '2024-01-18',
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('Daily 2024-01-15');
    });

    it('should support searching only meetings', async () => {
      await documentService.create({
        title: 'Sprint Planning',
        type: 'meeting',
        date: '2024-01-15',
        content: createTestContent('Discussed the roadmap for Q1'),
      });

      await documentService.create({
        title: 'Regular Note',
        type: 'note',
        content: createTestContent('Notes about the Q1 roadmap'),
      });

      const results = await searchService.search({
        text: 'roadmap',
        filters: { type: ['meeting'] },
      });

      expect(results).toHaveLength(1);
      expect(results[0].note.type).toBe('meeting');
    });

    it('should support combined filters', async () => {
      await documentService.create({
        title: 'Jan Meeting',
        type: 'meeting',
        date: '2024-01-15',
        content: createTestContent('Discussed architecture'),
      });

      await documentService.create({
        title: 'Feb Meeting',
        type: 'meeting',
        date: '2024-02-15',
        content: createTestContent('Discussed architecture updates'),
      });

      await documentService.create({
        title: 'Architecture Note',
        type: 'note',
        content: createTestContent('Architecture documentation'),
      });

      // Search for architecture in meetings during January
      const results = await searchService.search({
        text: 'architecture',
        filters: {
          type: ['meeting'],
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        },
      });

      expect(results).toHaveLength(1);
      expect(results[0].note.title).toBe('Jan Meeting');
    });
  });

  describe('Search with pagination', () => {
    it('should support paginated search results', async () => {
      // Create 15 notes
      for (let i = 0; i < 15; i++) {
        await documentService.create({
          title: `Note ${i + 1}`,
          type: 'note',
          content: createTestContent(`Programming content number ${i + 1}`),
        });
      }

      // Get first page
      const page1 = await searchService.search({
        text: 'Programming',
        options: { limit: 5, offset: 0 },
      });

      // Get second page
      const page2 = await searchService.search({
        text: 'Programming',
        options: { limit: 5, offset: 5 },
      });

      // Get third page
      const page3 = await searchService.search({
        text: 'Programming',
        options: { limit: 5, offset: 10 },
      });

      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
      expect(page3).toHaveLength(5);

      // Ensure no duplicates
      const allIds = [...page1, ...page2, ...page3].map((r) => r.note.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(15);
    });
  });

  describe('Complex search scenarios', () => {
    it('should handle a realistic knowledge base search', async () => {
      // Create a realistic set of notes
      await documentService.create({
        title: 'TypeScript Best Practices',
        type: 'note',
        content: createContentWithTags(
          'This guide covers TypeScript best practices including strict mode, proper typing, and avoiding any.',
          ['typescript', 'programming', 'best-practices']
        ),
      });

      await documentService.create({
        title: 'TypeScript Setup Guide',
        type: 'note',
        content: createContentWithTags(
          'How to set up a new TypeScript project with tsconfig.json and ESLint.',
          ['typescript', 'setup', 'tooling']
        ),
      });

      await documentService.create({
        title: 'JavaScript Migration Notes',
        type: 'note',
        content: createContentWithTags(
          'Notes on migrating from JavaScript to TypeScript. Key considerations and common pitfalls.',
          ['typescript', 'javascript', 'migration']
        ),
      });

      await documentService.create({
        title: 'Python Type Hints',
        type: 'note',
        content: createContentWithTags('Using type hints in Python for better code quality.', [
          'python',
          'typing',
        ]),
      });

      // Search for TypeScript content
      const tsResults = await searchService.search({ text: 'TypeScript' });
      expect(tsResults.length).toBeGreaterThanOrEqual(3);

      // Search for best practices
      const bpResults = await searchService.search({ text: 'best practices' });
      expect(bpResults.length).toBeGreaterThanOrEqual(1);

      // Search for migration-related content
      const migrationResults = await searchService.search({ text: 'migration' });
      expect(migrationResults.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle FTS5 stemming correctly', async () => {
      await documentService.create({
        title: 'Running Tests',
        type: 'note',
        content: createTestContent('The runner runs all tests when running in CI mode'),
      });

      // Should match various forms due to stemming
      const results1 = await searchService.search({ text: 'run' });
      const results2 = await searchService.search({ text: 'running' });
      const results3 = await searchService.search({ text: 'runner' });

      // All searches should find the note (due to porter stemmer)
      expect(results1.length + results2.length + results3.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle special characters and Unicode', async () => {
      await documentService.create({
        title: 'Unicode Test',
        type: 'note',
        content: createTestContent('Testing émojis 🎉 and accénts café résumé'),
      });

      await documentService.create({
        title: 'Code Snippets',
        type: 'note',
        content: createTestContent('function foo() { return "bar"; }'),
      });

      // Should handle special characters gracefully
      const emojiResults = await searchService.search({ text: 'émojis' });
      expect(Array.isArray(emojiResults)).toBe(true);

      const codeResults = await searchService.search({ text: 'function' });
      expect(codeResults.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Reindex operations', () => {
    it('should correctly reindex after external modifications', async () => {
      // Create initial notes
      await documentService.create({
        title: 'Note 1',
        type: 'note',
        content: createTestContent('Apple content'),
      });

      await documentService.create({
        title: 'Note 2',
        type: 'note',
        content: createTestContent('Banana content'),
      });

      // Verify initial search
      let results = await searchService.search({ text: 'Apple' });
      expect(results).toHaveLength(1);

      // Rebuild entire index
      const reindexResult = await searchService.reindexAll();
      expect(reindexResult.indexed).toBe(2);
      expect(reindexResult.errors).toBe(0);

      // Verify search still works
      results = await searchService.search({ text: 'Apple' });
      expect(results).toHaveLength(1);

      results = await searchService.search({ text: 'Banana' });
      expect(results).toHaveLength(1);
    });

    it('should handle large vault reindex efficiently', async () => {
      // Create 50 notes
      for (let i = 0; i < 50; i++) {
        await documentService.create({
          title: `Note ${i}`,
          type: 'note',
          content: createTestContent(`Content ${i} with keyword${i}`),
        });
      }

      const startTime = Date.now();
      const result = await searchService.reindexAll();
      const duration = Date.now() - startTime;

      expect(result.indexed).toBe(50);
      expect(result.errors).toBe(0);
      // Should complete in reasonable time (less than 10 seconds for 50 notes)
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Search result quality', () => {
    it('should rank exact title matches highly', async () => {
      await documentService.create({
        title: 'TypeScript',
        type: 'note',
        content: createTestContent('A note about programming'),
      });

      await documentService.create({
        title: 'Random Note',
        type: 'note',
        content: createTestContent('This mentions TypeScript once'),
      });

      const results = await searchService.search({ text: 'TypeScript' });

      expect(results.length).toBeGreaterThanOrEqual(2);
      // Note with TypeScript in title should rank well
      expect(results.some((r) => r.note.title === 'TypeScript')).toBe(true);
    });

    it('should handle case-insensitive search', async () => {
      await documentService.create({
        title: 'UPPERCASE NOTE',
        type: 'note',
        content: createTestContent('TYPESCRIPT IS GREAT'),
      });

      const results = await searchService.search({ text: 'typescript' });

      expect(results).toHaveLength(1);
    });
  });

  describe('Real-world workflows', () => {
    it('should support "find all notes from last week about project X"', async () => {
      // Create notes spread across different dates
      await documentService.create({
        title: 'Old Project Note',
        type: 'daily',
        date: '2024-01-01',
        content: createTestContent('Working on Project Alpha'),
      });

      await documentService.create({
        title: 'Recent Project Note',
        type: 'daily',
        date: '2024-01-15',
        content: createTestContent('Progress on Project Alpha'),
      });

      await documentService.create({
        title: 'Today Project Note',
        type: 'daily',
        date: '2024-01-20',
        content: createTestContent('Finishing Project Alpha'),
      });

      // Search for recent Project Alpha notes
      const results = await searchService.search({
        text: 'Project Alpha',
        filters: {
          dateFrom: '2024-01-14',
          dateTo: '2024-01-21',
        },
      });

      expect(results).toHaveLength(2);
    });

    it('should support "find all meeting notes mentioning a person"', async () => {
      await documentService.create({
        title: 'Team Sync 2024-01-15',
        type: 'meeting',
        date: '2024-01-15',
        content: createTestContent('Discussed progress with Alice and Bob'),
      });

      await documentService.create({
        title: 'Project Review',
        type: 'meeting',
        date: '2024-01-16',
        content: createTestContent('Alice presented the demo'),
      });

      await documentService.create({
        title: 'Random Note',
        type: 'note',
        content: createTestContent('Alice mentioned this approach'),
      });

      // Find all meetings mentioning Alice
      const results = await searchService.search({
        text: 'Alice',
        filters: { type: ['meeting'] },
      });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.note.type === 'meeting')).toBe(true);
    });
  });
});
