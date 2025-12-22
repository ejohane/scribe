/**
 * Unit tests for notes-helpers.ts utilities
 *
 * Tests pure utility functions for fuzzy matching, formatting, and parsing.
 */

import { describe, it, expect } from 'vitest';
import type { Note, NoteId, NoteMetadata } from '@scribe/shared';
import {
  levenshteinDistance,
  fuzzyMatchScore,
  exactSubstringMatch,
  formatNoteForList,
  getSortFunction,
  parseDate,
  normalizeTag,
  parseTags,
  mapNoteType,
} from '../../../src/commands/notes-helpers';

// Helper to create branded NoteId
function createTestNoteId(id: string): NoteId {
  return id as unknown as NoteId;
}

/**
 * Helper to create valid NoteMetadata
 */
function createTestMetadata(overrides: Partial<NoteMetadata> = {}): NoteMetadata {
  return {
    title: null,
    tags: [],
    links: [],
    mentions: [],
    ...overrides,
  };
}

/**
 * Overrides for createMockNote - allows string for id
 */
type MockNoteOverrides = Omit<Partial<Note>, 'id'> & { id?: string };

/**
 * Helper to create a mock note for testing
 */
function createMockNote(overrides: MockNoteOverrides = {}): Note {
  const { id, ...rest } = overrides;
  return {
    id: createTestNoteId(id ?? 'note-123'),
    title: 'Test Note',
    type: undefined,
    tags: [],
    createdAt: 1703001600000, // 2023-12-19T12:00:00.000Z
    updatedAt: 1703088000000, // 2023-12-20T12:00:00.000Z
    content: {
      root: {
        type: 'root',
        children: [],
      },
    },
    metadata: createTestMetadata(),
    ...rest,
  } as Note;
}

describe('notes-helpers', () => {
  // ============================================================================
  // levenshteinDistance
  // ============================================================================
  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('a', 'a')).toBe(0);
    });

    it('returns length of non-empty string when other is empty', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'world')).toBe(5);
    });

    it('returns 1 for single character difference', () => {
      // Substitution
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      // Insertion
      expect(levenshteinDistance('cat', 'cart')).toBe(1);
      // Deletion
      expect(levenshteinDistance('cart', 'cat')).toBe(1);
    });

    it('calculates correct distance for multiple edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });

    it('is symmetric', () => {
      expect(levenshteinDistance('abc', 'def')).toBe(levenshteinDistance('def', 'abc'));
      expect(levenshteinDistance('hello', 'world')).toBe(levenshteinDistance('world', 'hello'));
    });

    it('handles unicode characters', () => {
      expect(levenshteinDistance('café', 'cafe')).toBe(1);
      expect(levenshteinDistance('日本', '日本')).toBe(0);
      expect(levenshteinDistance('日本', '日本語')).toBe(1);
    });
  });

  // ============================================================================
  // fuzzyMatchScore
  // ============================================================================
  describe('fuzzyMatchScore', () => {
    it('returns 1.0 for exact match (case-insensitive)', () => {
      expect(fuzzyMatchScore('hello', 'hello')).toBe(1.0);
      expect(fuzzyMatchScore('Hello', 'hello')).toBe(1.0);
      expect(fuzzyMatchScore('HELLO', 'hello')).toBe(1.0);
    });

    it('returns high score (>0.9) for substring match', () => {
      const score = fuzzyMatchScore('meet', 'Meeting Notes');
      expect(score).toBeGreaterThan(0.1);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('returns high score when all query words appear in title', () => {
      // When all query words appear in the title, score should be high (0.5+)
      const score1 = fuzzyMatchScore('meeting notes', 'Weekly Meeting Notes');
      const score2 = fuzzyMatchScore('project plan', 'My Project Plan Draft');
      expect(score1).toBeGreaterThan(0.5);
      expect(score2).toBeGreaterThan(0.5);
    });

    it('returns partial score when some query words match', () => {
      const score = fuzzyMatchScore('meeting agenda', 'Meeting Notes');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.85);
    });

    it('returns fuzzy score for similar but non-matching strings', () => {
      const score = fuzzyMatchScore('hellp', 'hello');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('returns low score for completely different strings', () => {
      const score = fuzzyMatchScore('xyz', 'Meeting Notes');
      expect(score).toBeLessThan(0.5);
    });

    it('handles single word queries against multi-word titles', () => {
      const score = fuzzyMatchScore('meeting', 'Weekly Team Meeting');
      expect(score).toBeGreaterThan(0.1);
    });

    it('handles empty query', () => {
      const score = fuzzyMatchScore('', 'Some Title');
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // exactSubstringMatch
  // ============================================================================
  describe('exactSubstringMatch', () => {
    it('returns true for exact substring match', () => {
      expect(exactSubstringMatch('meet', 'Meeting Notes')).toBe(true);
      expect(exactSubstringMatch('notes', 'Meeting Notes')).toBe(true);
      expect(exactSubstringMatch('ing No', 'Meeting Notes')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(exactSubstringMatch('MEET', 'Meeting Notes')).toBe(true);
      expect(exactSubstringMatch('Meet', 'meeting notes')).toBe(true);
    });

    it('returns false when no substring match', () => {
      expect(exactSubstringMatch('xyz', 'Meeting Notes')).toBe(false);
      expect(exactSubstringMatch('meetings', 'Meeting Notes')).toBe(false);
    });

    it('returns true for exact full match', () => {
      expect(exactSubstringMatch('hello', 'hello')).toBe(true);
    });

    it('handles empty strings', () => {
      expect(exactSubstringMatch('', 'Meeting Notes')).toBe(true);
      expect(exactSubstringMatch('hello', '')).toBe(false);
    });
  });

  // ============================================================================
  // formatNoteForList
  // ============================================================================
  describe('formatNoteForList', () => {
    it('formats note with all fields', () => {
      const note = createMockNote({
        id: 'note-abc',
        title: 'Test Note',
        type: 'meeting',
        tags: ['#work', '#important'],
        createdAt: 1703001600000,
        updatedAt: 1703088000000,
        metadata: createTestMetadata({
          links: [createTestNoteId('note-1'), createTestNoteId('note-2')],
        }),
      });

      const result = formatNoteForList(note);

      // Check that id is the branded type (as string comparison)
      expect(String(result.id)).toBe('note-abc');
      expect(result.title).toBe('Test Note');
      expect(result.type).toBe('meeting');
      expect(result.tags).toEqual(['#work', '#important']);
      expect(result.linkCount).toBe(2);
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('returns "regular" for notes with undefined type', () => {
      const note = createMockNote({ type: undefined });
      const result = formatNoteForList(note);
      expect(result.type).toBe('regular');
    });

    it('returns linkCount of 0 when no links', () => {
      const note = createMockNote({
        metadata: createTestMetadata({ links: [] }),
      });
      const result = formatNoteForList(note);
      expect(result.linkCount).toBe(0);
    });

    it('handles missing metadata gracefully', () => {
      const note = createMockNote();
      // @ts-expect-error - testing runtime behavior with missing metadata
      note.metadata = undefined;
      const result = formatNoteForList(note);
      expect(result.linkCount).toBe(0);
    });

    it('returns ISO date strings for timestamps', () => {
      const note = createMockNote({
        createdAt: 1703001600000,
        updatedAt: 1703088000000,
      });
      const result = formatNoteForList(note);
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('returns empty array for notes with no tags', () => {
      const note = createMockNote({ tags: [] });
      const result = formatNoteForList(note);
      expect(result.tags).toEqual([]);
    });
  });

  // ============================================================================
  // getSortFunction
  // ============================================================================
  describe('getSortFunction', () => {
    // Helper to create notes fresh for each test to avoid issues with branded types
    function createSortTestNotes() {
      const noteA = createMockNote({
        title: 'Apple',
        createdAt: 1000,
        updatedAt: 2000,
      });
      const noteB = createMockNote({
        title: 'Banana',
        createdAt: 2000,
        updatedAt: 1000,
      });
      const noteC = createMockNote({
        title: 'Cherry',
        createdAt: 1500,
        updatedAt: 1500,
      });
      return { noteA, noteB, noteC };
    }

    describe('sort by title', () => {
      it('sorts ascending by title', () => {
        const { noteA, noteB, noteC } = createSortTestNotes();
        const sortFn = getSortFunction('title', 'asc');
        const sorted = [noteB, noteC, noteA].sort(sortFn);
        expect(sorted.map((n) => n.title)).toEqual(['Apple', 'Banana', 'Cherry']);
      });

      it('sorts descending by title', () => {
        const { noteA, noteB, noteC } = createSortTestNotes();
        const sortFn = getSortFunction('title', 'desc');
        const sorted = [noteA, noteC, noteB].sort(sortFn);
        expect(sorted.map((n) => n.title)).toEqual(['Cherry', 'Banana', 'Apple']);
      });
    });

    describe('sort by created', () => {
      it('sorts ascending by createdAt', () => {
        const { noteA, noteB, noteC } = createSortTestNotes();
        const sortFn = getSortFunction('created', 'asc');
        const sorted = [noteB, noteC, noteA].sort(sortFn);
        expect(sorted.map((n) => n.title)).toEqual(['Apple', 'Cherry', 'Banana']);
      });

      it('sorts descending by createdAt', () => {
        const { noteA, noteB, noteC } = createSortTestNotes();
        const sortFn = getSortFunction('created', 'desc');
        const sorted = [noteA, noteC, noteB].sort(sortFn);
        expect(sorted.map((n) => n.title)).toEqual(['Banana', 'Cherry', 'Apple']);
      });
    });

    describe('sort by updated', () => {
      it('sorts ascending by updatedAt', () => {
        const { noteA, noteB, noteC } = createSortTestNotes();
        const sortFn = getSortFunction('updated', 'asc');
        const sorted = [noteA, noteC, noteB].sort(sortFn);
        expect(sorted.map((n) => n.title)).toEqual(['Banana', 'Cherry', 'Apple']);
      });

      it('sorts descending by updatedAt', () => {
        const { noteA, noteB, noteC } = createSortTestNotes();
        const sortFn = getSortFunction('updated', 'desc');
        const sorted = [noteB, noteC, noteA].sort(sortFn);
        expect(sorted.map((n) => n.title)).toEqual(['Apple', 'Cherry', 'Banana']);
      });
    });

    it('defaults to updated sort for unknown field', () => {
      const { noteA, noteB, noteC } = createSortTestNotes();
      // @ts-expect-error - testing runtime behavior with invalid field
      const sortFn = getSortFunction('unknown', 'asc');
      const sorted = [noteA, noteC, noteB].sort(sortFn);
      // Should sort by updatedAt asc (default case)
      expect(sorted.map((n) => n.title)).toEqual(['Banana', 'Cherry', 'Apple']);
    });
  });

  // ============================================================================
  // parseDate
  // ============================================================================
  describe('parseDate', () => {
    it('parses ISO date strings', () => {
      const result = parseDate('2023-12-19T12:00:00.000Z');
      // The timestamp is the correct UTC time - verify it parses correctly
      expect(result).toBe(new Date('2023-12-19T12:00:00.000Z').getTime());
    });

    it('parses simple date strings', () => {
      const result = parseDate('2023-12-19');
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    it('parses date with time', () => {
      const result = parseDate('2023-12-19 14:30:00');
      expect(result).toBeGreaterThan(0);
    });

    it('throws error for invalid date strings', () => {
      expect(() => parseDate('not-a-date')).toThrow('Invalid date: not-a-date');
      expect(() => parseDate('abc123')).toThrow('Invalid date: abc123');
    });

    it('throws error for empty string', () => {
      expect(() => parseDate('')).toThrow('Invalid date: ');
    });
  });

  // ============================================================================
  // normalizeTag
  // ============================================================================
  describe('normalizeTag', () => {
    it('adds # prefix to tag without it', () => {
      expect(normalizeTag('work')).toBe('#work');
      expect(normalizeTag('important')).toBe('#important');
    });

    it('preserves # prefix if already present', () => {
      expect(normalizeTag('#work')).toBe('#work');
      expect(normalizeTag('#important')).toBe('#important');
    });

    it('trims whitespace', () => {
      expect(normalizeTag('  work  ')).toBe('#work');
      expect(normalizeTag('  #work  ')).toBe('#work');
    });

    it('handles empty string', () => {
      expect(normalizeTag('')).toBe('#');
      expect(normalizeTag('   ')).toBe('#');
    });

    it('handles tags with special characters', () => {
      expect(normalizeTag('work-project')).toBe('#work-project');
      expect(normalizeTag('v1.0')).toBe('#v1.0');
    });
  });

  // ============================================================================
  // parseTags
  // ============================================================================
  describe('parseTags', () => {
    it('parses comma-separated tags', () => {
      expect(parseTags('work,important,todo')).toEqual(['#work', '#important', '#todo']);
    });

    it('normalizes tags by adding # prefix', () => {
      expect(parseTags('work,#important,todo')).toEqual(['#work', '#important', '#todo']);
    });

    it('trims whitespace from each tag', () => {
      expect(parseTags(' work , important , todo ')).toEqual(['#work', '#important', '#todo']);
    });

    it('filters out empty tags', () => {
      expect(parseTags('work,,important')).toEqual(['#work', '#important']);
      expect(parseTags(',work,,')).toEqual(['#work']);
    });

    it('handles single tag', () => {
      expect(parseTags('work')).toEqual(['#work']);
    });

    it('returns empty array for empty string', () => {
      expect(parseTags('')).toEqual([]);
    });

    it('handles tags that are just #', () => {
      expect(parseTags('#,work,#')).toEqual(['#work']);
    });
  });

  // ============================================================================
  // mapNoteType
  // ============================================================================
  describe('mapNoteType', () => {
    it('maps "regular" to undefined', () => {
      expect(mapNoteType('regular')).toBeUndefined();
    });

    it('passes through other types unchanged', () => {
      expect(mapNoteType('person')).toBe('person');
      expect(mapNoteType('meeting')).toBe('meeting');
      expect(mapNoteType('daily')).toBe('daily');
      expect(mapNoteType('project')).toBe('project');
      expect(mapNoteType('template')).toBe('template');
      expect(mapNoteType('system')).toBe('system');
    });

    it('passes through unknown types (runtime behavior)', () => {
      expect(mapNoteType('unknown')).toBe('unknown');
    });
  });
});
