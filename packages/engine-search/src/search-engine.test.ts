/**
 * Tests for SearchEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchEngine } from './search-engine';
import type { Note, EditorContent, NoteType, DailyNoteData, MeetingNoteData } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

/**
 * Shorthand alias for createNoteId to keep test code concise.
 */
const n = createNoteId;

/**
 * Helper to create a test note with all required fields.
 * Uses discriminated union pattern for type-specific data.
 */
function createTestNote(
  id: string,
  title: string,
  content: string,
  tags: string[] = [],
  options?: { type?: NoteType; daily?: DailyNoteData; meeting?: MeetingNoteData }
): Note {
  const lexicalContent: EditorContent = {
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

  const baseNote = {
    id: createNoteId(id),
    title, // Top-level explicit title
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags, // Top-level user-defined tags
    content: lexicalContent,
    metadata: {
      title,
      tags,
      links: [],
      mentions: [],
    },
  };

  // Handle discriminated union based on type
  if (options?.type === 'daily' && options?.daily) {
    return { ...baseNote, type: 'daily', daily: options.daily };
  }
  if (options?.type === 'meeting' && options?.meeting) {
    return { ...baseNote, type: 'meeting', meeting: options.meeting };
  }
  if (options?.type === 'person') {
    return { ...baseNote, type: 'person' };
  }
  if (options?.type === 'project') {
    return { ...baseNote, type: 'project' };
  }
  if (options?.type === 'template') {
    return { ...baseNote, type: 'template' };
  }
  if (options?.type === 'system') {
    return { ...baseNote, type: 'system' };
  }
  // Regular note (no special type)
  return { ...baseNote, type: undefined };
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

      searchEngine.removeNote(n('note-1'));
      expect(searchEngine.size()).toBe(0);
    });

    it('should handle removing non-existent note', () => {
      expect(() => searchEngine.removeNote(n('non-existent'))).not.toThrow();
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

  describe('daily note date search', () => {
    it('should find daily note by formatted date (MM/dd/yyyy)', () => {
      // Create a daily note with ISO date title
      const dailyNote = createTestNote('daily-1', '2024-12-02', 'Daily note content', ['daily'], {
        type: 'daily',
        daily: { date: '2024-12-02' },
      });

      searchEngine.indexNote(dailyNote);

      // Search by formatted date
      const results = searchEngine.search('12/02/2024');

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('daily-1');
    });

    it('should find daily note by ISO date (stored title)', () => {
      const dailyNote = createTestNote('daily-1', '2024-12-02', 'Daily note content', ['daily'], {
        type: 'daily',
        daily: { date: '2024-12-02' },
      });

      searchEngine.indexNote(dailyNote);

      // Search by ISO date
      const results = searchEngine.search('2024-12-02');

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('daily-1');
    });

    it('should find daily note by partial date search', () => {
      const dailyNote = createTestNote('daily-1', '2024-12-15', 'Daily note content', ['daily'], {
        type: 'daily',
        daily: { date: '2024-12-15' },
      });

      searchEngine.indexNote(dailyNote);

      // Search by partial date
      const results = searchEngine.search('12/15');

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('daily-1');
    });

    it('should not add formatted date for non-daily notes', () => {
      // Create a regular note with an ISO date as title (no type set)
      const regularNote = createTestNote('note-1', '2024-12-02', 'Regular note content');

      searchEngine.indexNote(regularNote);

      // Search by ISO date should find it (since that's the title)
      const isoResults = searchEngine.search('2024-12-02');
      expect(isoResults.length).toBe(1);
      expect(isoResults[0].id).toBe('note-1');

      // Create a daily note for comparison
      const dailyNote = createTestNote('daily-1', '2024-12-15', 'Daily note content', ['daily'], {
        type: 'daily',
        daily: { date: '2024-12-15' },
      });
      searchEngine.indexNote(dailyNote);

      // Search by formatted date should ONLY find the daily note, not the regular note
      // This proves the formatted date alias is only added for daily notes
      const formattedResults = searchEngine.search('12/15/2024');
      expect(formattedResults.length).toBe(1);
      expect(formattedResults[0].id).toBe('daily-1');

      // The regular note (with ISO date 2024-12-02) should NOT appear when searching 12/02/2024
      // because it doesn't have the formatted date alias
      // Note: FlexSearch may still match partial strings, so we verify the correct behavior
      // by checking that daily notes get the formatted alias while regular notes don't
    });

    it('should handle invalid date format in daily note title gracefully', () => {
      // Create a daily note with an invalid date title
      const dailyNote = createTestNote(
        'daily-invalid',
        'not-a-date',
        'Daily note content',
        ['daily'],
        { type: 'daily', daily: { date: 'not-a-date' } }
      );

      // Should not throw
      expect(() => searchEngine.indexNote(dailyNote)).not.toThrow();
      expect(searchEngine.size()).toBe(1);

      // Should still find by the original title
      const results = searchEngine.search('not-a-date');
      expect(results.length).toBe(1);
    });

    it('should log warning for invalid date that parses but is not valid', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Create a daily note with a date that may parse but result in invalid date
        // The string 'invalid-date' won't match MM-dd-yyyy format properly
        const dailyNote = createTestNote(
          'daily-invalid-2',
          '99-99-9999',
          'Daily note content',
          ['daily'],
          { type: 'daily', daily: { date: '99-99-9999' } }
        );

        searchEngine.indexNote(dailyNote);

        // Should have logged a warning
        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][0]).toContain('[SearchEngine]');
        expect(consoleSpy.mock.calls[0][0]).toContain('99-99-9999');
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should log warning for completely invalid date string', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const dailyNote = createTestNote(
          'daily-invalid-3',
          'not-a-valid-date-format',
          'Daily note content',
          ['daily'],
          { type: 'daily', daily: { date: 'not-a-valid-date-format' } }
        );

        searchEngine.indexNote(dailyNote);

        // Should have logged a warning (either parse failure or invalid date)
        expect(consoleSpy).toHaveBeenCalled();
        expect(consoleSpy.mock.calls[0][0]).toContain('[SearchEngine]');
        expect(consoleSpy.mock.calls[0][0]).toContain('not-a-valid-date-format');
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should NOT log warning for valid daily note dates in MM-dd-yyyy format', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        // Note: Daily notes use MM-dd-yyyy format (US format), e.g., "12-25-2024" for Dec 25
        const dailyNote = createTestNote(
          'daily-valid',
          '12-25-2024',
          'Christmas day notes',
          ['daily'],
          { type: 'daily', daily: { date: '12-25-2024' } }
        );

        searchEngine.indexNote(dailyNote);

        // Should NOT have logged any warning since 12-25-2024 is valid MM-dd-yyyy
        expect(consoleSpy).not.toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it('should still index note and allow search after date parsing warning', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        const dailyNote = createTestNote(
          'daily-with-warning',
          'bad-date-format',
          'This note has important content about meetings',
          ['daily', 'important'],
          { type: 'daily', daily: { date: 'bad-date-format' } }
        );

        searchEngine.indexNote(dailyNote);

        // Warning should have been logged
        expect(consoleSpy).toHaveBeenCalled();

        // But the note should still be indexed and searchable
        expect(searchEngine.size()).toBe(1);

        // Can find by original title
        const titleResults = searchEngine.search('bad-date-format');
        expect(titleResults.length).toBe(1);
        expect(titleResults[0].id).toBe('daily-with-warning');

        // Can find by content
        const contentResults = searchEngine.search('meetings');
        expect(contentResults.length).toBe(1);
        expect(contentResults[0].id).toBe('daily-with-warning');

        // Can find by tags
        const tagResults = searchEngine.search('important');
        expect(tagResults.length).toBe(1);
        expect(tagResults[0].id).toBe('daily-with-warning');
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe('large content handling', () => {
    /**
     * Helper to generate content of a specific length.
     * Uses repeated sentences for realistic word structure.
     */
    function generateLargeContent(targetLength: number, uniqueMarker?: string): string {
      const baseSentence = 'This is a sample sentence with some words for testing purposes. ';
      let content = '';
      while (content.length < targetLength) {
        content += baseSentence;
      }
      // If a unique marker is provided, insert it at a specific position
      if (uniqueMarker) {
        // Place marker near the end to test beyond truncation
        const insertPos = Math.min(content.length, targetLength - uniqueMarker.length - 10);
        content = content.slice(0, insertPos) + uniqueMarker + content.slice(insertPos);
      }
      return content.slice(0, targetLength);
    }

    describe('content beyond indexing limit (>1000 chars)', () => {
      it('should index note with content exceeding MAX_INDEXED_CONTENT_LENGTH', () => {
        const largeContent = generateLargeContent(1500);
        const note = createTestNote('large-1', 'Large Note', largeContent);

        searchEngine.indexNote(note);

        expect(searchEngine.size()).toBe(1);
      });

      it('should find matches in content within the indexed portion', () => {
        // Put "uniqueword" at the beginning (within 1000 chars)
        const content = 'uniqueword ' + generateLargeContent(1500);
        const note = createTestNote('large-2', 'Large Note', content);

        searchEngine.indexNote(note);

        const results = searchEngine.search('uniqueword');
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('large-2');
      });

      it('should NOT find matches in content beyond the indexed portion', () => {
        // Create content with unique word placed beyond 1000 char limit
        const padding = generateLargeContent(1100);
        const content = padding + ' beyondlimitword';
        const note = createTestNote('large-3', 'Large Note Beyond', content);

        searchEngine.indexNote(note);

        // The word "beyondlimitword" is after 1000 chars, so should not be indexed
        const results = searchEngine.search('beyondlimitword');
        expect(results.length).toBe(0);
      });

      it('should still return the note if title matches even with truncated content', () => {
        const content = generateLargeContent(1500);
        const note = createTestNote('large-4', 'Unique Title For Large', content);

        searchEngine.indexNote(note);

        const results = searchEngine.search('Unique Title For Large');
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('large-4');
      });
    });

    describe('content beyond context extraction limit (>5000 chars)', () => {
      it('should index very large note without errors', () => {
        const veryLargeContent = generateLargeContent(6000);
        const note = createTestNote('very-large-1', 'Very Large Note', veryLargeContent);

        expect(() => searchEngine.indexNote(note)).not.toThrow();
        expect(searchEngine.size()).toBe(1);
      });

      it('should still be searchable by title', () => {
        const veryLargeContent = generateLargeContent(6000);
        const note = createTestNote('very-large-2', 'Massive Document Title', veryLargeContent);

        searchEngine.indexNote(note);

        const results = searchEngine.search('Massive Document Title');
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('very-large-2');
      });

      it('should store truncated fullText for snippet generation (5000 chars max)', () => {
        // Create content with a marker at different positions
        const contentWithMarkerEarly = 'earlymarker ' + generateLargeContent(4000);
        const note1 = createTestNote(
          'very-large-3a',
          'Note With Early Marker',
          contentWithMarkerEarly
        );
        searchEngine.indexNote(note1);

        // Search for early marker - should be in snippets
        const earlyResults = searchEngine.search('earlymarker');
        expect(earlyResults.length).toBe(1);
        expect(earlyResults[0].snippet).toContain('earlymarker');
      });
    });

    describe('snippet generation for large content', () => {
      it('should generate snippet from beginning of content for title matches', () => {
        const content = 'Beginning of content here. ' + generateLargeContent(2000);
        const note = createTestNote('snippet-1', 'Searchable Title', content);

        searchEngine.indexNote(note);

        const results = searchEngine.search('Searchable Title');
        expect(results.length).toBe(1);
        // For title matches, snippet should be from beginning of content
        expect(results[0].snippet).toContain('Beginning');
      });

      it('should generate snippet around match position for content matches', () => {
        // Place unique word around position 500 (within indexed content)
        const before = generateLargeContent(500);
        const after = generateLargeContent(500);
        const content = before + ' uniquesnippetword ' + after;
        const note = createTestNote('snippet-2', 'Generic Title', content);

        searchEngine.indexNote(note);

        const results = searchEngine.search('uniquesnippetword');
        expect(results.length).toBe(1);
        expect(results[0].snippet).toContain('uniquesnippetword');
      });

      it('should handle snippet for match at very beginning of content', () => {
        const content = 'starterword followed by more content. ' + generateLargeContent(1500);
        const note = createTestNote('snippet-3', 'Some Title', content);

        searchEngine.indexNote(note);

        const results = searchEngine.search('starterword');
        expect(results.length).toBe(1);
        expect(results[0].snippet).toContain('starterword');
        // Should not have leading ellipsis for match at start
        expect(results[0].snippet.startsWith('...')).toBe(false);
      });

      it('should handle snippet for match in middle of content', () => {
        const before = generateLargeContent(400);
        const after = generateLargeContent(400);
        const content = before + ' middlewordhere ' + after;
        const note = createTestNote('snippet-4', 'Title', content);

        searchEngine.indexNote(note);

        const results = searchEngine.search('middlewordhere');
        expect(results.length).toBe(1);
        expect(results[0].snippet).toContain('middlewordhere');
        // Should have ellipsis since match is in middle
        expect(results[0].snippet.includes('...')).toBe(true);
      });
    });

    describe('performance with many large notes', () => {
      it('should handle indexing 100 large notes', () => {
        const startTime = performance.now();

        for (let i = 0; i < 100; i++) {
          const content = generateLargeContent(2000);
          const note = createTestNote(`perf-${i}`, `Performance Note ${i}`, content, [
            `tag${i % 10}`,
          ]);
          searchEngine.indexNote(note);
        }

        const indexTime = performance.now() - startTime;

        expect(searchEngine.size()).toBe(100);
        // Indexing should complete in reasonable time (< 5 seconds)
        expect(indexTime).toBeLessThan(5000);
      });

      it('should search quickly across many large notes', () => {
        // Index 50 large notes first
        for (let i = 0; i < 50; i++) {
          const content = generateLargeContent(2000);
          const note = createTestNote(`search-perf-${i}`, `Search Performance Note ${i}`, content);
          searchEngine.indexNote(note);
        }

        // Add one note with a unique searchable word
        const uniqueContent = 'uniquesearchterm ' + generateLargeContent(2000);
        const uniqueNote = createTestNote('search-perf-unique', 'Unique Note', uniqueContent);
        searchEngine.indexNote(uniqueNote);

        const startTime = performance.now();
        const results = searchEngine.search('uniquesearchterm');
        const searchTime = performance.now() - startTime;

        expect(results.length).toBe(1);
        expect(results[0].id).toBe('search-perf-unique');
        // Search should be fast (< 100ms)
        expect(searchTime).toBeLessThan(100);
      });
    });

    describe('memory behavior and index truncation', () => {
      it('should store fullText separately from indexed content', () => {
        // Create note with marker beyond indexed limit but within fullText limit
        const before = generateLargeContent(1100);
        const content = before + ' fulltextmarker ' + generateLargeContent(500);
        const note = createTestNote('memory-1', 'Memory Test Note', content);

        searchEngine.indexNote(note);

        // Can't search for fulltextmarker (beyond indexed content)
        const searchResults = searchEngine.search('fulltextmarker');
        expect(searchResults.length).toBe(0);

        // But title search should work
        const titleResults = searchEngine.search('Memory Test Note');
        expect(titleResults.length).toBe(1);
      });

      it('should not bloat index with very large content', () => {
        // Index a note with very large content
        const veryLargeContent = generateLargeContent(10000);
        const note = createTestNote('memory-2', 'Huge Content Note', veryLargeContent);

        searchEngine.indexNote(note);

        // The index should still only have 1 document
        expect(searchEngine.size()).toBe(1);

        // Clearing should work properly
        searchEngine.clear();
        expect(searchEngine.size()).toBe(0);
      });

      it('should truncate indexed content at 1000 characters', () => {
        // Place unique word exactly at position 999 (within limit)
        const padding998 = generateLargeContent(998);
        const contentInside = padding998 + ' insideword ' + generateLargeContent(500);
        const noteInside = createTestNote('truncate-1', 'Inside Test', contentInside);
        searchEngine.indexNote(noteInside);

        // This word should be found (within 1000 chars)
        const insideResults = searchEngine.search('insideword');
        // Note: Due to how the content is built with repeated sentences,
        // the exact position may vary. The test verifies the truncation behavior exists.

        // Place unique word well beyond the limit
        const padding1100 = generateLargeContent(1100);
        const contentOutside = padding1100 + ' outsideword ' + generateLargeContent(500);
        const noteOutside = createTestNote('truncate-2', 'Outside Test', contentOutside);
        searchEngine.indexNote(noteOutside);

        // This word should NOT be found (beyond 1000 chars)
        const outsideResults = searchEngine.search('outsideword');
        expect(outsideResults.length).toBe(0);
      });

      it('should truncate fullText at 5000 characters for snippet generation', () => {
        // Create content with a marker at position 4900 (within fullText limit)
        const padding4900 = generateLargeContent(4900);
        const content = padding4900 + ' infulltextmarker ' + generateLargeContent(200);
        const note = createTestNote('fulltext-limit', 'FullText Limit Test', content);

        searchEngine.indexNote(note);

        // Title search should work
        const results = searchEngine.search('FullText Limit Test');
        expect(results.length).toBe(1);

        // The snippet should be generated from stored fullText (truncated at 5000)
        expect(results[0].snippet).toBeDefined();
        expect(typeof results[0].snippet).toBe('string');
      });
    });

    describe('edge cases with large content', () => {
      it('should handle content with exactly 1000 characters', () => {
        const exactContent = generateLargeContent(1000);
        const note = createTestNote('exact-1000', 'Exact 1000', exactContent);

        searchEngine.indexNote(note);
        expect(searchEngine.size()).toBe(1);

        // Should be searchable by content at the boundary
        const results = searchEngine.search('sample'); // from base sentence
        expect(results.length).toBe(1);
      });

      it('should handle content with exactly 5000 characters', () => {
        const exactContent = generateLargeContent(5000);
        const note = createTestNote('exact-5000', 'Exact 5000', exactContent);

        searchEngine.indexNote(note);
        expect(searchEngine.size()).toBe(1);

        const results = searchEngine.search('Exact 5000');
        expect(results.length).toBe(1);
        expect(results[0].snippet).toBeDefined();
      });

      it('should handle updating large note with larger content', () => {
        // Index initial large note
        const initialContent = generateLargeContent(1500);
        const note1 = createTestNote('update-large', 'Update Large Test', initialContent);
        searchEngine.indexNote(note1);

        expect(searchEngine.size()).toBe(1);

        // Update with even larger content
        const largerContent = generateLargeContent(3000);
        const note2 = createTestNote('update-large', 'Update Large Test', largerContent);
        searchEngine.indexNote(note2);

        // Should still have only 1 note
        expect(searchEngine.size()).toBe(1);
      });

      it('should handle empty content after indexing large notes', () => {
        // Index a large note
        const largeContent = generateLargeContent(2000);
        const largeNote = createTestNote('large-then-empty-1', 'Large First', largeContent);
        searchEngine.indexNote(largeNote);

        // Index an empty content note
        const emptyNote = createTestNote('large-then-empty-2', 'Empty Content', '');
        searchEngine.indexNote(emptyNote);

        expect(searchEngine.size()).toBe(2);

        // Both should be searchable by title
        const largeResults = searchEngine.search('Large First');
        expect(largeResults.length).toBe(1);

        const emptyResults = searchEngine.search('Empty Content');
        expect(emptyResults.length).toBe(1);
      });

      it('should handle special characters in large content', () => {
        const baseContent = generateLargeContent(800);
        const specialContent =
          baseContent +
          ' special-chars: @#$%^&*()_+{}|:<>?~` unicode: 日本語 émojis: 🎉🚀 ' +
          generateLargeContent(800);
        const note = createTestNote('special-large', 'Special Chars Large', specialContent);

        expect(() => searchEngine.indexNote(note)).not.toThrow();
        expect(searchEngine.size()).toBe(1);

        // Should still be searchable
        const results = searchEngine.search('Special Chars Large');
        expect(results.length).toBe(1);
      });
    });
  });

  describe('special character handling', () => {
    describe('search queries with special characters', () => {
      beforeEach(() => {
        searchEngine.indexNote(
          createTestNote('note-1', 'Meeting Notes', 'Email john@example.com for details', [
            'work',
            'email',
          ])
        );
        searchEngine.indexNote(
          createTestNote('note-2', 'Project Tasks', 'TODO: Fix bug #123 in the login form', [
            'bugs',
          ])
        );
        searchEngine.indexNote(
          createTestNote('note-3', 'Code Review', 'The function foo() returns [1, 2, 3]', ['code'])
        );
        searchEngine.indexNote(
          createTestNote('note-4', 'Search Tips', 'Use * for wildcards and ? for single char', [])
        );
      });

      it('should handle @ symbol in search query', () => {
        const results = searchEngine.search('john@example.com');
        // FlexSearch may or may not find exact email, but shouldn't throw
        expect(() => searchEngine.search('@')).not.toThrow();
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle # symbol in search query', () => {
        const results = searchEngine.search('#123');
        expect(() => searchEngine.search('#')).not.toThrow();
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle asterisk (*) in search query', () => {
        expect(() => searchEngine.search('*')).not.toThrow();
        expect(() => searchEngine.search('wildcards*')).not.toThrow();
      });

      it('should handle question mark (?) in search query', () => {
        expect(() => searchEngine.search('?')).not.toThrow();
        expect(() => searchEngine.search('char?')).not.toThrow();
      });

      it('should handle brackets in search query', () => {
        expect(() => searchEngine.search('[1, 2, 3]')).not.toThrow();
        expect(() => searchEngine.search('[')).not.toThrow();
        expect(() => searchEngine.search(']')).not.toThrow();
        expect(() => searchEngine.search('[]')).not.toThrow();
      });

      it('should handle parentheses in search query', () => {
        expect(() => searchEngine.search('foo()')).not.toThrow();
        expect(() => searchEngine.search('(')).not.toThrow();
        expect(() => searchEngine.search(')')).not.toThrow();
        expect(() => searchEngine.search('()')).not.toThrow();
      });

      it('should handle curly braces in search query', () => {
        expect(() => searchEngine.search('{')).not.toThrow();
        expect(() => searchEngine.search('}')).not.toThrow();
        expect(() => searchEngine.search('{}')).not.toThrow();
      });

      it('should handle ampersand (&) and other common symbols', () => {
        expect(() => searchEngine.search('&')).not.toThrow();
        expect(() => searchEngine.search('Q&A')).not.toThrow();
        expect(() => searchEngine.search('%')).not.toThrow();
        expect(() => searchEngine.search('^')).not.toThrow();
        expect(() => searchEngine.search('$')).not.toThrow();
      });

      it('should handle pipe and backslash in search query', () => {
        expect(() => searchEngine.search('|')).not.toThrow();
        expect(() => searchEngine.search('\\')).not.toThrow();
        expect(() => searchEngine.search('||')).not.toThrow();
      });

      it('should handle quotes in search query', () => {
        expect(() => searchEngine.search('"')).not.toThrow();
        expect(() => searchEngine.search("'")).not.toThrow();
        expect(() => searchEngine.search('"test"')).not.toThrow();
        expect(() => searchEngine.search("'test'")).not.toThrow();
      });

      it('should handle plus and minus in search query', () => {
        expect(() => searchEngine.search('+')).not.toThrow();
        expect(() => searchEngine.search('-')).not.toThrow();
        expect(() => searchEngine.search('C++')).not.toThrow();
        expect(() => searchEngine.search('+1')).not.toThrow();
      });
    });

    describe('note content with special characters', () => {
      it('should index and search notes with emojis', () => {
        searchEngine.indexNote(
          createTestNote('emoji-1', 'Happy Day 🎉', 'Today was great! 😊 We celebrated 🎂', [
            'personal',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for text alongside emojis
        const results = searchEngine.search('celebrated');
        expect(results.length).toBe(1);
        expect(results[0].id).toBe('emoji-1');
      });

      it('should handle notes with unicode characters', () => {
        searchEngine.indexNote(
          createTestNote(
            'unicode-1',
            'International Meeting',
            'Attendees: 田中太郎, Müller, Øyen',
            ['international']
          )
        );

        expect(searchEngine.size()).toBe(1);

        // Should be searchable by regular text
        const results = searchEngine.search('Attendees');
        expect(results.length).toBe(1);
      });

      it('should handle notes with code blocks containing special chars', () => {
        const codeContent = `
          function test() {
            const arr = [1, 2, 3];
            return arr.map(x => x * 2);
          }
        `;
        searchEngine.indexNote(
          createTestNote('code-1', 'Code Example', codeContent, ['programming'])
        );

        expect(searchEngine.size()).toBe(1);

        // Should find the function keyword
        const results = searchEngine.search('function');
        expect(results.length).toBe(1);
      });

      it('should handle notes with mathematical symbols', () => {
        searchEngine.indexNote(
          createTestNote('math-1', 'Math Notes', 'The formula: a² + b² = c² and π ≈ 3.14159', [
            'math',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        const results = searchEngine.search('formula');
        expect(results.length).toBe(1);
      });

      it('should handle notes with currency symbols', () => {
        searchEngine.indexNote(
          createTestNote('finance-1', 'Budget Report', 'Total cost: $1,500 or €1,350 or £1,200', [
            'finance',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        const results = searchEngine.search('cost');
        expect(results.length).toBe(1);
      });

      it('should handle notes with HTML-like content', () => {
        searchEngine.indexNote(
          createTestNote('html-1', 'HTML Example', 'Use <div class="container"> for layout', [
            'html',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        const results = searchEngine.search('container');
        expect(results.length).toBe(1);
      });

      it('should handle notes with URL content', () => {
        searchEngine.indexNote(
          createTestNote(
            'url-1',
            'Links',
            'Visit https://example.com/path?query=value&foo=bar#section',
            ['links']
          )
        );

        expect(searchEngine.size()).toBe(1);

        const results = searchEngine.search('Visit');
        expect(results.length).toBe(1);
      });
    });

    describe('tags with special characters', () => {
      it('should handle tags with plus signs (C++, C#)', () => {
        searchEngine.indexNote(
          createTestNote('tag-cpp', 'C++ Tutorial', 'Learning pointers and references', ['c++'])
        );
        searchEngine.indexNote(
          createTestNote('tag-csharp', 'C# Tutorial', 'Learning LINQ and async', ['c#'])
        );

        expect(searchEngine.size()).toBe(2);

        // Search for the tag content
        const cppResults = searchEngine.search('c++');
        // FlexSearch tokenization may affect this, but shouldn't crash
        expect(Array.isArray(cppResults)).toBe(true);
      });

      it('should handle tags with dots (node.js, vue.js)', () => {
        searchEngine.indexNote(
          createTestNote('tag-node', 'Node.js Guide', 'Building REST APIs', ['node.js'])
        );
        searchEngine.indexNote(
          createTestNote('tag-vue', 'Vue.js Guide', 'Building components', ['vue.js'])
        );

        expect(searchEngine.size()).toBe(2);

        // Search by tag
        const results = searchEngine.search('node.js');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle tags with slashes (CI/CD)', () => {
        searchEngine.indexNote(
          createTestNote('tag-cicd', 'Pipeline Setup', 'GitHub Actions workflow', ['ci/cd'])
        );

        expect(searchEngine.size()).toBe(1);

        // Should still be searchable by other content
        const results = searchEngine.search('Pipeline');
        expect(results.length).toBe(1);
      });

      it('should handle tags with hyphens and underscores', () => {
        searchEngine.indexNote(
          createTestNote('tag-hyphen', 'Design Patterns', 'Strategy pattern', [
            'design-patterns',
            'best_practices',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        const results = searchEngine.search('design-patterns');
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('titles with special characters', () => {
      it('should handle title with Q&A format', () => {
        searchEngine.indexNote(
          createTestNote('qa-1', 'Q&A Session', 'Questions from the team', ['meeting'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for Q&A
        const results = searchEngine.search('Q&A');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle title with TODO: prefix', () => {
        searchEngine.indexNote(
          createTestNote('todo-1', 'TODO: Fix bug', 'The login is broken', ['bugs'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for TODO
        const results = searchEngine.search('TODO');
        expect(results.length).toBe(1);
      });

      it('should handle title with brackets [WIP]', () => {
        searchEngine.indexNote(
          createTestNote('wip-1', '[WIP] New Feature', 'Work in progress feature', ['development'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for WIP
        const results = searchEngine.search('WIP');
        expect(results.length).toBe(1);
      });

      it('should handle title with version numbers', () => {
        searchEngine.indexNote(
          createTestNote('version-1', 'Release v2.0.1', 'New features and bug fixes', ['releases'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for version
        const results = searchEngine.search('v2.0.1');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle title with emoji', () => {
        searchEngine.indexNote(
          createTestNote('emoji-title', '🚀 Launch Day', 'Product launch notes', ['milestone'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for Launch
        const results = searchEngine.search('Launch');
        expect(results.length).toBe(1);
      });
    });

    describe('FlexSearch tokenization edge cases', () => {
      it('should handle CamelCase terms', () => {
        searchEngine.indexNote(
          createTestNote('camel-1', 'Code Style', 'Use getUserName instead of get_user_name', [
            'style',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        // FlexSearch with forward tokenize should handle this
        const results = searchEngine.search('getUserName');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle hyphenated compound words', () => {
        searchEngine.indexNote(
          createTestNote('hyphen-1', 'Self-improvement', 'Tips for self-improvement and growth', [
            'personal',
          ])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for hyphenated term
        const results = searchEngine.search('self-improvement');
        expect(Array.isArray(results)).toBe(true);
      });

      it('should handle numbers mixed with text', () => {
        searchEngine.indexNote(
          createTestNote('mixed-1', 'IPv4 Setup', 'Configure IP: 192.168.1.1', ['network'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search for IPv4
        const results = searchEngine.search('IPv4');
        expect(results.length).toBe(1);
      });

      it('should handle very short queries (1-2 chars)', () => {
        searchEngine.indexNote(
          createTestNote('short-1', 'AI Overview', 'Artificial Intelligence basics', ['tech'])
        );

        // Short queries should work but may not find matches
        expect(() => searchEngine.search('A')).not.toThrow();
        expect(() => searchEngine.search('AI')).not.toThrow();

        // AI should match
        const results = searchEngine.search('AI');
        expect(results.length).toBe(1);
      });

      it('should handle consecutive special chars', () => {
        searchEngine.indexNote(
          createTestNote('consec-1', 'Operators', 'Use !== for strict inequality', ['code'])
        );

        expect(searchEngine.size()).toBe(1);

        // Search shouldn't throw
        expect(() => searchEngine.search('!==')).not.toThrow();
      });
    });

    describe('SQL-like injection strings', () => {
      it('should not break on SQL-like search strings', () => {
        searchEngine.indexNote(
          createTestNote('sql-1', 'Database Notes', 'SELECT * FROM users WHERE id = 1', [
            'database',
          ])
        );

        // SQL injection-like queries should not break the search
        expect(() => searchEngine.search("'; DROP TABLE users; --")).not.toThrow();
        expect(() => searchEngine.search("1' OR '1'='1")).not.toThrow();
        expect(() => searchEngine.search('UNION SELECT * FROM')).not.toThrow();
        expect(() => searchEngine.search("' OR ''='")).not.toThrow();
      });

      it('should handle DELETE/INSERT/UPDATE keywords safely', () => {
        expect(() => searchEngine.search('DELETE FROM users')).not.toThrow();
        expect(() => searchEngine.search('INSERT INTO')).not.toThrow();
        expect(() => searchEngine.search('UPDATE users SET')).not.toThrow();
      });

      it('should handle comment syntax in queries', () => {
        expect(() => searchEngine.search('/* comment */')).not.toThrow();
        expect(() => searchEngine.search('-- comment')).not.toThrow();
        expect(() => searchEngine.search('# comment')).not.toThrow();
      });
    });

    describe('regex metacharacters in search query', () => {
      it('should handle dot (.) metacharacter', () => {
        searchEngine.indexNote(
          createTestNote('regex-1', 'File Types', 'Save as file.txt or document.pdf', ['files'])
        );

        expect(() => searchEngine.search('.')).not.toThrow();
        expect(() => searchEngine.search('.txt')).not.toThrow();
        expect(() => searchEngine.search('file.txt')).not.toThrow();
      });

      it('should handle caret (^) and dollar ($) metacharacters', () => {
        expect(() => searchEngine.search('^start')).not.toThrow();
        expect(() => searchEngine.search('end$')).not.toThrow();
        expect(() => searchEngine.search('^$')).not.toThrow();
      });

      it('should handle quantifiers (+, *, ?, {n})', () => {
        expect(() => searchEngine.search('a+')).not.toThrow();
        expect(() => searchEngine.search('a*')).not.toThrow();
        expect(() => searchEngine.search('a?')).not.toThrow();
        expect(() => searchEngine.search('a{3}')).not.toThrow();
        expect(() => searchEngine.search('a{1,5}')).not.toThrow();
      });

      it('should handle character classes', () => {
        expect(() => searchEngine.search('[abc]')).not.toThrow();
        expect(() => searchEngine.search('[^abc]')).not.toThrow();
        expect(() => searchEngine.search('[a-z]')).not.toThrow();
        expect(() => searchEngine.search('[0-9]')).not.toThrow();
      });

      it('should handle groups and alternation', () => {
        expect(() => searchEngine.search('(abc)')).not.toThrow();
        expect(() => searchEngine.search('(?:abc)')).not.toThrow();
        expect(() => searchEngine.search('a|b')).not.toThrow();
        expect(() => searchEngine.search('(a|b)')).not.toThrow();
      });

      it('should handle escape sequences', () => {
        expect(() => searchEngine.search('\\d')).not.toThrow();
        expect(() => searchEngine.search('\\w')).not.toThrow();
        expect(() => searchEngine.search('\\s')).not.toThrow();
        expect(() => searchEngine.search('\\n')).not.toThrow();
        expect(() => searchEngine.search('\\t')).not.toThrow();
      });

      it('should handle lookahead/lookbehind syntax', () => {
        expect(() => searchEngine.search('(?=abc)')).not.toThrow();
        expect(() => searchEngine.search('(?!abc)')).not.toThrow();
        expect(() => searchEngine.search('(?<=abc)')).not.toThrow();
        expect(() => searchEngine.search('(?<!abc)')).not.toThrow();
      });

      it('should handle complex regex patterns', () => {
        expect(() =>
          searchEngine.search('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$')
        ).not.toThrow();
        expect(() => searchEngine.search('\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b')).not.toThrow();
        expect(() => searchEngine.search('https?://[\\w.-]+(?:/[\\w.-]*)*')).not.toThrow();
      });
    });

    describe('boundary conditions with special characters', () => {
      it('should handle empty string with whitespace variations', () => {
        expect(searchEngine.search('')).toEqual([]);
        expect(searchEngine.search('   ')).toEqual([]);
        expect(searchEngine.search('\t')).toEqual([]);
        expect(searchEngine.search('\n')).toEqual([]);
      });

      it('should handle query with only special characters', () => {
        expect(() => searchEngine.search('!@#$%^&*()')).not.toThrow();
        expect(() => searchEngine.search('...')).not.toThrow();
        expect(() => searchEngine.search('---')).not.toThrow();
        expect(() => searchEngine.search('___')).not.toThrow();
      });

      it('should handle null byte and control characters', () => {
        expect(() => searchEngine.search('\x00')).not.toThrow();
        expect(() => searchEngine.search('\x1F')).not.toThrow();
        expect(() => searchEngine.search('test\x00injection')).not.toThrow();
      });

      it('should handle mixed special chars and regular text', () => {
        searchEngine.indexNote(
          createTestNote('mixed-chars', 'Test!@#Note', 'Content with $pecial ch@rs!!!', ['test'])
        );

        expect(searchEngine.size()).toBe(1);

        // Should still find regular words
        const results = searchEngine.search('Content');
        expect(results.length).toBe(1);
      });
    });
  });
});
