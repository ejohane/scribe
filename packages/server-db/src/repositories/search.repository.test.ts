/**
 * Tests for SearchRepository.
 *
 * These tests verify:
 * 1. Basic word search works
 * 2. Phrase search with quotes works
 * 3. Results ranked by relevance (BM25)
 * 4. Snippets show highlighted matches
 * 5. Index/remove operations work
 * 6. Reindex all notes works
 * 7. Invalid queries don't crash (graceful handling)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from '../database.js';
import { NotesRepository } from './notes.repository.js';
import { SearchRepository } from './search.repository.js';
import type { CreateNoteInput } from '../types.js';

describe('SearchRepository', () => {
  let scribeDb: ScribeDatabase;
  let notesRepo: NotesRepository;
  let searchRepo: SearchRepository;

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

  // Helper to create a note and index it
  const createAndIndexNote = (
    id: string,
    title: string,
    content: string,
    tags: string[] = []
  ): void => {
    const input = createTestNoteInput({ id, title, filePath: `notes/${id}.json` });
    notesRepo.create(input);
    searchRepo.index(id, title, content, tags);
  };

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();
    notesRepo = new NotesRepository(scribeDb.getDb());
    searchRepo = new SearchRepository(scribeDb.getDb());
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('index', () => {
    it('should index a note for search', () => {
      const input = createTestNoteInput({ id: 'note-1', title: 'Test Title' });
      notesRepo.create(input);

      searchRepo.index('note-1', 'Test Title', 'This is the content', ['tag1', 'tag2']);

      expect(searchRepo.isIndexed('note-1')).toBe(true);
    });

    it('should replace existing index entry on re-index', () => {
      const input = createTestNoteInput({ id: 'note-1', title: 'Original Title' });
      notesRepo.create(input);

      searchRepo.index('note-1', 'Original Title', 'Original content', []);
      searchRepo.index('note-1', 'Updated Title', 'Updated content', []);

      const results = searchRepo.search('Updated');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Updated');

      const oldResults = searchRepo.search('Original');
      expect(oldResults).toHaveLength(0);
    });

    it('should join tags with spaces for searching', () => {
      createAndIndexNote('note-1', 'Tagged Note', 'Some content', ['javascript', 'typescript']);

      const results = searchRepo.search('javascript');
      expect(results).toHaveLength(1);
      expect(results[0].noteId).toBe('note-1');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Create and index several notes for search testing
      createAndIndexNote(
        'note-1',
        'Getting Started with JavaScript',
        'Learn JavaScript basics and fundamentals for web development',
        ['javascript', 'tutorial']
      );
      createAndIndexNote(
        'note-2',
        'TypeScript Best Practices',
        'TypeScript offers type safety for JavaScript applications',
        ['typescript', 'best-practices']
      );
      createAndIndexNote(
        'note-3',
        'React Component Patterns',
        'Building reusable React components with hooks and context',
        ['react', 'patterns']
      );
      createAndIndexNote(
        'note-4',
        'Node.js Server Development',
        'Building server-side applications with Node.js and Express',
        ['nodejs', 'server']
      );
      createAndIndexNote(
        'note-5',
        'Daily Standup Meeting Notes',
        'Today we discussed the JavaScript migration project',
        ['meeting', 'standup']
      );
    });

    it('should return empty array for empty query', () => {
      const results = searchRepo.search('');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for whitespace-only query', () => {
      const results = searchRepo.search('   ');
      expect(results).toHaveLength(0);
    });

    it('should find notes by single word', () => {
      const results = searchRepo.search('JavaScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
    });

    it('should find notes by multiple words (AND logic)', () => {
      const results = searchRepo.search('JavaScript basics');
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
      // note-5 mentions JavaScript but not basics
      expect(results.some((r) => r.noteId === 'note-5')).toBe(false);
    });

    it('should search in title field', () => {
      const results = searchRepo.search('Standup');
      expect(results.some((r) => r.noteId === 'note-5')).toBe(true);
    });

    it('should search in content field', () => {
      const results = searchRepo.search('fundamentals');
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
    });

    it('should search in tags field', () => {
      const results = searchRepo.search('tutorial');
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
    });

    it('should use Porter stemmer (find "running" when searching "run")', () => {
      createAndIndexNote(
        'note-stemmer',
        'Running Tests',
        'Learn about running unit tests efficiently',
        ['testing']
      );

      // Porter stemmer should match "running" to "run"
      const results = searchRepo.search('run');
      expect(results.some((r) => r.noteId === 'note-stemmer')).toBe(true);
    });

    it('should be case insensitive', () => {
      const lower = searchRepo.search('javascript');
      const upper = searchRepo.search('JAVASCRIPT');
      const mixed = searchRepo.search('JavaScript');

      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });
  });

  describe('search with FTS5 syntax (fts: prefix)', () => {
    beforeEach(() => {
      createAndIndexNote('note-1', 'JavaScript Fundamentals', 'Core JavaScript concepts', []);
      createAndIndexNote('note-2', 'TypeScript Advanced', 'Advanced TypeScript features', []);
    });

    it('should support exact phrase search', () => {
      createAndIndexNote(
        'note-phrase',
        'Meeting Notes',
        'We need to fix the bug in production',
        []
      );

      const results = searchRepo.search('fts:"fix the bug"');
      expect(results.some((r) => r.noteId === 'note-phrase')).toBe(true);
    });

    it('should support OR operator', () => {
      const results = searchRepo.search('fts:JavaScript OR TypeScript');
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
      expect(results.some((r) => r.noteId === 'note-2')).toBe(true);
    });

    it('should support prefix search', () => {
      const results = searchRepo.search('fts:Java*');
      expect(results.some((r) => r.noteId === 'note-1')).toBe(true);
    });
  });

  describe('search results ranking', () => {
    beforeEach(() => {
      // Create notes with different relevance to "JavaScript"
      createAndIndexNote(
        'note-high',
        'JavaScript JavaScript JavaScript',
        'JavaScript is great for JavaScript development with JavaScript',
        ['javascript']
      );
      createAndIndexNote(
        'note-low',
        'Programming',
        'Many languages exist including JavaScript',
        []
      );
    });

    it('should rank more relevant results higher (lower BM25 score)', () => {
      const results = searchRepo.search('JavaScript');

      // Find positions
      const highIndex = results.findIndex((r) => r.noteId === 'note-high');
      const lowIndex = results.findIndex((r) => r.noteId === 'note-low');

      // note-high should appear before note-low (BM25 is negative, more negative = more relevant)
      expect(highIndex).toBeLessThan(lowIndex);
      expect(results[highIndex].rank).toBeLessThan(results[lowIndex].rank);
    });

    it('should include BM25 score in results', () => {
      const results = searchRepo.search('JavaScript');
      expect(results[0].rank).toBeDefined();
      expect(typeof results[0].rank).toBe('number');
      // BM25 scores are negative in FTS5
      expect(results[0].rank).toBeLessThan(0);
    });
  });

  describe('search results snippets and highlighting', () => {
    beforeEach(() => {
      createAndIndexNote(
        'note-highlight',
        'Testing Highlights',
        'This content has the word testing in it for testing purposes',
        ['testing']
      );
    });

    it('should highlight matches in title', () => {
      const results = searchRepo.search('Testing');
      const result = results.find((r) => r.noteId === 'note-highlight');

      expect(result).toBeDefined();
      expect(result!.title).toContain('<mark>');
      expect(result!.title).toContain('</mark>');
    });

    it('should include snippet with highlighted matches', () => {
      const results = searchRepo.search('testing');
      const result = results.find((r) => r.noteId === 'note-highlight');

      expect(result).toBeDefined();
      expect(result!.snippet).toContain('<mark>');
      expect(result!.snippet).toContain('testing');
    });

    it('should use custom highlight tag', () => {
      const results = searchRepo.search('testing', { highlightTag: 'strong' });
      const result = results.find((r) => r.noteId === 'note-highlight');

      expect(result).toBeDefined();
      expect(result!.title).toContain('<strong>');
      expect(result!.title).toContain('</strong>');
      expect(result!.snippet).toContain('<strong>');
    });

    it('should sanitize invalid highlight tags', () => {
      // Try XSS-like tag
      const results = searchRepo.search('testing', { highlightTag: 'script><script' });
      const result = results.find((r) => r.noteId === 'note-highlight');

      // Should fall back to sanitized tag (alphanumeric only)
      expect(result).toBeDefined();
      expect(result!.title).not.toContain('<script>');
    });
  });

  describe('search pagination', () => {
    beforeEach(() => {
      // Create many notes for pagination testing
      for (let i = 0; i < 20; i++) {
        createAndIndexNote(`note-${i}`, `Document ${i}`, `Content about topic number ${i}`, [
          'topic',
        ]);
      }
    });

    it('should limit results', () => {
      const results = searchRepo.search('topic', { limit: 5 });
      expect(results).toHaveLength(5);
    });

    it('should offset results', () => {
      const firstPage = searchRepo.search('topic', { limit: 5, offset: 0 });
      const secondPage = searchRepo.search('topic', { limit: 5, offset: 5 });

      expect(firstPage).toHaveLength(5);
      expect(secondPage).toHaveLength(5);

      // Pages should have different results
      const firstPageIds = firstPage.map((r) => r.noteId);
      const secondPageIds = secondPage.map((r) => r.noteId);
      expect(firstPageIds).not.toEqual(secondPageIds);
    });

    it('should use default limit of 50', () => {
      // Add more notes
      for (let i = 20; i < 60; i++) {
        createAndIndexNote(`note-${i}`, `Document ${i}`, `Content about topic number ${i}`, [
          'topic',
        ]);
      }

      const results = searchRepo.search('topic');
      expect(results).toHaveLength(50);
    });
  });

  describe('invalid query handling', () => {
    it('should return empty results for invalid FTS5 syntax', () => {
      createAndIndexNote('note-1', 'Test', 'Content', []);

      // Invalid FTS5 syntax should not crash
      const results = searchRepo.search('fts:invalid syntax " unclosed');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters gracefully in simple search', () => {
      createAndIndexNote('note-1', 'Test Note', 'Some content here', []);

      // These could cause FTS5 syntax errors if not escaped
      const results1 = searchRepo.search('test "quote');
      const results2 = searchRepo.search("test 'apostrophe");
      const results3 = searchRepo.search('test AND');
      const results4 = searchRepo.search('test OR NOT');

      // Should not throw, may or may not return results
      expect(Array.isArray(results1)).toBe(true);
      expect(Array.isArray(results2)).toBe(true);
      expect(Array.isArray(results3)).toBe(true);
      expect(Array.isArray(results4)).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove note from search index', () => {
      const input = createTestNoteInput({ id: 'note-1', title: 'To Remove' });
      notesRepo.create(input);
      searchRepo.index('note-1', 'To Remove', 'Content to remove', []);

      expect(searchRepo.isIndexed('note-1')).toBe(true);

      const removed = searchRepo.remove('note-1');

      expect(removed).toBe(true);
      expect(searchRepo.isIndexed('note-1')).toBe(false);
    });

    it('should return false when removing non-existent note', () => {
      const removed = searchRepo.remove('non-existent');
      expect(removed).toBe(false);
    });

    it('should make note unsearchable after removal', () => {
      createAndIndexNote('note-1', 'Searchable Note', 'Unique searchable content xyz123', []);

      const beforeResults = searchRepo.search('xyz123');
      expect(beforeResults).toHaveLength(1);

      searchRepo.remove('note-1');

      const afterResults = searchRepo.search('xyz123');
      expect(afterResults).toHaveLength(0);
    });
  });

  describe('reindexAll', () => {
    it('should rebuild entire search index', () => {
      // Create notes
      notesRepo.create(
        createTestNoteInput({ id: 'note-1', title: 'First Note', filePath: 'notes/1.json' })
      );
      notesRepo.create(
        createTestNoteInput({ id: 'note-2', title: 'Second Note', filePath: 'notes/2.json' })
      );

      // Initially not indexed
      expect(searchRepo.count()).toBe(0);

      // Reindex with content provider
      searchRepo.reindexAll((noteId) => {
        if (noteId === 'note-1') {
          return { content: 'First note content about apples', tags: ['fruit'] };
        }
        return { content: 'Second note content about oranges', tags: ['fruit'] };
      });

      expect(searchRepo.count()).toBe(2);
      expect(searchRepo.isIndexed('note-1')).toBe(true);
      expect(searchRepo.isIndexed('note-2')).toBe(true);
    });

    it('should clear existing index before reindexing', () => {
      // Create and index a note with old content
      createAndIndexNote('note-1', 'Old Title', 'Old content xyz', ['old-tag']);

      // Reindex with new content
      searchRepo.reindexAll(() => ({
        content: 'New content abc',
        tags: ['new-tag'],
      }));

      // Old content should not be searchable
      expect(searchRepo.search('xyz')).toHaveLength(0);
      // New content should be searchable
      expect(searchRepo.search('abc')).toHaveLength(1);
    });
  });

  describe('isIndexed', () => {
    it('should return true for indexed note', () => {
      createAndIndexNote('note-1', 'Test', 'Content', []);
      expect(searchRepo.isIndexed('note-1')).toBe(true);
    });

    it('should return false for non-indexed note', () => {
      expect(searchRepo.isIndexed('non-existent')).toBe(false);
    });
  });

  describe('count', () => {
    it('should return number of indexed notes', () => {
      expect(searchRepo.count()).toBe(0);

      createAndIndexNote('note-1', 'First', 'Content', []);
      expect(searchRepo.count()).toBe(1);

      createAndIndexNote('note-2', 'Second', 'Content', []);
      expect(searchRepo.count()).toBe(2);
    });

    it('should decrease after remove', () => {
      createAndIndexNote('note-1', 'First', 'Content', []);
      createAndIndexNote('note-2', 'Second', 'Content', []);

      expect(searchRepo.count()).toBe(2);

      searchRepo.remove('note-1');

      expect(searchRepo.count()).toBe(1);
    });
  });
});
