/**
 * Fuzzy Search Tests
 *
 * Tests for the shared fuzzy search utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  fuzzyMatchScore,
  exactSubstringMatch,
  fuzzySearch,
  FUZZY_MATCH_THRESHOLD,
  EXACT_MATCH_SCORE,
  SUBSTRING_MATCH_BASE,
  ALL_WORDS_MATCH_SCORE,
} from './fuzzy-search';

// ============================================================================
// levenshteinDistance
// ============================================================================

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('a', 'a')).toBe(0);
  });

  it('returns length of other string when one is empty', () => {
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', 'world')).toBe(5);
  });

  it('handles single character differences', () => {
    // substitution
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    // insertion
    expect(levenshteinDistance('cat', 'cart')).toBe(1);
    // deletion
    expect(levenshteinDistance('cart', 'cat')).toBe(1);
  });

  it('handles multiple edits correctly', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
  });

  it('is symmetric', () => {
    expect(levenshteinDistance('abc', 'def')).toBe(levenshteinDistance('def', 'abc'));
    expect(levenshteinDistance('hello', 'world')).toBe(levenshteinDistance('world', 'hello'));
  });

  it('handles unicode correctly', () => {
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
    expect(fuzzyMatchScore('hello', 'hello')).toBe(EXACT_MATCH_SCORE);
    expect(fuzzyMatchScore('Hello', 'hello')).toBe(EXACT_MATCH_SCORE);
    expect(fuzzyMatchScore('HELLO', 'hello')).toBe(EXACT_MATCH_SCORE);
  });

  it('returns high score for substring match', () => {
    const score = fuzzyMatchScore('meet', 'Meeting Notes');
    // Substring matches get good scores, scaled by query/title length ratio
    expect(score).toBeGreaterThan(FUZZY_MATCH_THRESHOLD);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('returns good score when query is substring of title', () => {
    // "meeting notes" is a substring of "weekly meeting notes"
    // so it gets the substring score, not the all-words score
    const score1 = fuzzyMatchScore('meeting notes', 'Weekly Meeting Notes');
    const score2 = fuzzyMatchScore('project plan', 'My Project Plan Draft');
    expect(score1).toBeGreaterThan(FUZZY_MATCH_THRESHOLD);
    expect(score2).toBeGreaterThan(FUZZY_MATCH_THRESHOLD);
  });

  it('returns ALL_WORDS score when words found but not as substring', () => {
    // "notes meeting" is NOT a substring but both words are found
    const score = fuzzyMatchScore('notes meeting', 'Weekly Meeting Notes');
    expect(score).toBe(ALL_WORDS_MATCH_SCORE);
  });

  it('returns partial score when some query words are found', () => {
    const score = fuzzyMatchScore('meeting agenda', 'Meeting Notes');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(ALL_WORDS_MATCH_SCORE);
  });

  it('returns fuzzy score for similar but non-matching strings', () => {
    const score = fuzzyMatchScore('hellp', 'hello');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(SUBSTRING_MATCH_BASE);
  });

  it('returns low score for very different strings', () => {
    const score = fuzzyMatchScore('xyz', 'Meeting Notes');
    expect(score).toBeLessThan(FUZZY_MATCH_THRESHOLD);
  });

  it('handles single word in multi-word title', () => {
    const score = fuzzyMatchScore('meeting', 'Weekly Team Meeting');
    // "meeting" is a substring of the title, so it gets a good score
    // The score depends on the ratio of query length to title length
    expect(score).toBeGreaterThan(FUZZY_MATCH_THRESHOLD);
  });

  it('handles empty query gracefully', () => {
    const score = fuzzyMatchScore('', 'Some Title');
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

// ============================================================================
// exactSubstringMatch
// ============================================================================

describe('exactSubstringMatch', () => {
  it('returns true for exact substring', () => {
    expect(exactSubstringMatch('meet', 'Meeting Notes')).toBe(true);
    expect(exactSubstringMatch('Notes', 'Meeting Notes')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(exactSubstringMatch('MEET', 'Meeting Notes')).toBe(true);
    expect(exactSubstringMatch('meeting', 'MEETING NOTES')).toBe(true);
  });

  it('returns false when substring not found', () => {
    expect(exactSubstringMatch('xyz', 'Meeting Notes')).toBe(false);
  });

  it('returns true for exact match', () => {
    expect(exactSubstringMatch('hello', 'hello')).toBe(true);
  });

  it('returns true for empty query', () => {
    expect(exactSubstringMatch('', 'hello')).toBe(true);
  });
});

// ============================================================================
// fuzzySearch
// ============================================================================

describe('fuzzySearch', () => {
  interface TestItem {
    id: string;
    name: string;
  }

  const items: TestItem[] = [
    { id: '1', name: 'Meeting Notes' },
    { id: '2', name: 'Project Plan' },
    { id: '3', name: 'Weekly Review' },
    { id: '4', name: 'Quarterly Goals' },
  ];

  it('returns matching items sorted by score', () => {
    const results = fuzzySearch(items, 'meet', (item) => item.name);
    expect(results.length).toBe(1);
    expect(results[0].item.id).toBe('1');
    expect(results[0].score).toBeGreaterThan(FUZZY_MATCH_THRESHOLD);
  });

  it('returns empty array for no matches', () => {
    const results = fuzzySearch(items, 'xyz123', (item) => item.name);
    expect(results).toEqual([]);
  });

  it('returns empty array for empty query', () => {
    const results = fuzzySearch(items, '', (item) => item.name);
    expect(results).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    const results = fuzzySearch(items, '   ', (item) => item.name);
    expect(results).toEqual([]);
  });

  it('respects custom threshold', () => {
    // With default threshold (0.3), we might get some results
    const defaultResults = fuzzySearch(items, 'not', (item) => item.name);

    // With very high threshold (0.9), we should get fewer/no results
    const strictResults = fuzzySearch(items, 'not', (item) => item.name, 0.9);

    expect(strictResults.length).toBeLessThanOrEqual(defaultResults.length);
  });

  it('sorts results by score descending', () => {
    // Search for something that might match multiple items
    const results = fuzzySearch(items, 'review', (item) => item.name);

    // Verify sorted order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('fuzzy search constants', () => {
  it('exports expected threshold values', () => {
    expect(FUZZY_MATCH_THRESHOLD).toBe(0.3);
    expect(EXACT_MATCH_SCORE).toBe(1.0);
    expect(SUBSTRING_MATCH_BASE).toBe(0.9);
    expect(ALL_WORDS_MATCH_SCORE).toBe(0.85);
  });
});
