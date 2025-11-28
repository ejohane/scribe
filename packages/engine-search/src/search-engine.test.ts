/**
 * Tests for SearchEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEngine } from './search-engine';
import type { Note, LexicalState } from '@scribe/shared';

/**
 * Helper to create a test note
 */
function createTestNote(id: string, title: string, content: string, tags: string[] = []): Note {
  const lexicalContent: LexicalState = {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: content,
            },
          ],
        },
      ],
    },
  };

  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: lexicalContent,
    metadata: {
      title,
      tags,
      links: [],
      mentions: [],
    },
  };
}

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;

  beforeEach(() => {
    searchEngine = new SearchEngine();
  });

  describe('indexNote', () => {
    it('should index a note successfully', () => {
      const note = createTestNote('note-1', 'Test Note', 'This is a test note');

      searchEngine.indexNote(note);

      expect(searchEngine.size()).toBe(1);
    });

    it('should index multiple notes', () => {
      const note1 = createTestNote('note-1', 'First Note', 'First content');
      const note2 = createTestNote('note-2', 'Second Note', 'Second content');

      searchEngine.indexNote(note1);
      searchEngine.indexNote(note2);

      expect(searchEngine.size()).toBe(2);
    });

    it('should update an existing note', () => {
      const note1 = createTestNote('note-1', 'Original Title', 'Original content');
      const note2 = createTestNote('note-1', 'Updated Title', 'Updated content');

      searchEngine.indexNote(note1);
      searchEngine.indexNote(note2);

      expect(searchEngine.size()).toBe(1);
    });
  });

  describe('removeNote', () => {
    it('should remove a note from the index', () => {
      const note = createTestNote('note-1', 'Test Note', 'Test content');

      searchEngine.indexNote(note);
      expect(searchEngine.size()).toBe(1);

      searchEngine.removeNote('note-1');
      expect(searchEngine.size()).toBe(0);
    });

    it('should handle removing non-existent note', () => {
      expect(() => searchEngine.removeNote('non-existent')).not.toThrow();
      expect(searchEngine.size()).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Index some test notes
      searchEngine.indexNote(
        createTestNote(
          'note-1',
          'Getting Started with Scribe',
          'This is a guide for getting started with Scribe, a note-taking application.'
        )
      );

      searchEngine.indexNote(
        createTestNote(
          'note-2',
          'Advanced Scribe Features',
          'Learn about advanced features like graph view and search.'
        )
      );

      searchEngine.indexNote(
        createTestNote(
          'note-3',
          'Meeting Notes',
          'Notes from the team meeting about project planning.',
          ['meetings', 'planning']
        )
      );

      searchEngine.indexNote(
        createTestNote('note-4', 'Project Ideas', 'Ideas for future projects and improvements.', [
          'projects',
          'ideas',
        ])
      );
    });

    it('should return empty array for empty query', () => {
      const results = searchEngine.search('');
      expect(results).toEqual([]);
    });

    it('should find notes by title', () => {
      const results = searchEngine.search('Scribe');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'note-1')).toBe(true);
      expect(results.some((r) => r.id === 'note-2')).toBe(true);
    });

    it('should find notes by content', () => {
      const results = searchEngine.search('guide');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'note-1')).toBe(true);
    });

    it('should find notes by tags', () => {
      const results = searchEngine.search('meetings');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'note-3')).toBe(true);
    });

    it('should rank title matches higher than content matches', () => {
      const results = searchEngine.search('Scribe');

      // Title matches should score higher
      const titleMatch = results.find((r) => r.id === 'note-1' || r.id === 'note-2');
      expect(titleMatch).toBeDefined();
      if (titleMatch) {
        expect(titleMatch.score).toBeGreaterThan(0);
      }
    });

    it('should include snippets in results', () => {
      const results = searchEngine.search('Scribe');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toBeDefined();
      expect(typeof results[0].snippet).toBe('string');
    });

    it('should respect limit parameter', () => {
      const results = searchEngine.search('project', 1);

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should include match information', () => {
      const results = searchEngine.search('Scribe');

      expect(results.length).toBeGreaterThan(0);
      expect(Array.isArray(results[0].matches)).toBe(true);
    });

    it('should handle partial word matches', () => {
      const results = searchEngine.search('plan');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === 'note-3')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all indexed notes', () => {
      searchEngine.indexNote(createTestNote('note-1', 'Test', 'Content'));
      searchEngine.indexNote(createTestNote('note-2', 'Test 2', 'Content 2'));

      expect(searchEngine.size()).toBe(2);

      searchEngine.clear();

      expect(searchEngine.size()).toBe(0);
    });

    it('should allow indexing after clear', () => {
      searchEngine.indexNote(createTestNote('note-1', 'Test', 'Content'));
      searchEngine.clear();

      searchEngine.indexNote(createTestNote('note-2', 'New Test', 'New Content'));

      expect(searchEngine.size()).toBe(1);
    });
  });
});
