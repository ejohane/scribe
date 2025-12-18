/**
 * Notes Command Helpers
 *
 * Shared utilities for notes commands including fuzzy matching and formatting.
 */

import type { Note, NoteType } from '@scribe/shared';

// ============================================================================
// Types
// ============================================================================

/**
 * Note type filter values
 * Matches NoteType from @scribe/shared but includes 'regular' for undefined types
 */
export type NoteTypeFilter =
  | 'regular'
  | 'person'
  | 'project'
  | 'meeting'
  | 'daily'
  | 'template'
  | 'system';

/**
 * Sort field options for notes list
 */
export type SortField = 'created' | 'updated' | 'title';

/**
 * Sort order options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Valid note types for update command
 */
export const VALID_NOTE_TYPES = ['regular', 'person', 'meeting'] as const;
export type ValidNoteType = (typeof VALID_NOTE_TYPES)[number];

// ============================================================================
// Fuzzy Matching Utilities
// ============================================================================

/**
 * Calculate the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions,
 * or substitutions) required to change one string into the other.
 *
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate a fuzzy match score between a query and a title.
 * Returns a score from 0 to 1, where 1 is an exact match.
 *
 * The scoring algorithm:
 * 1. Exact match → 1.0
 * 2. Exact substring match → 0.9
 * 3. Fuzzy match based on Levenshtein distance → normalized score
 *
 * @param query - Search query (case-insensitive)
 * @param title - Note title (case-insensitive)
 * @returns Match score from 0 to 1
 */
export function fuzzyMatchScore(query: string, title: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Exact match
  if (lowerTitle === lowerQuery) {
    return 1.0;
  }

  // Substring match - high score
  if (lowerTitle.includes(lowerQuery)) {
    // Score based on how much of the title is covered by the query
    return 0.9 * (lowerQuery.length / lowerTitle.length) + 0.1;
  }

  // Check if query words appear in title (multi-word matching)
  const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length > 1) {
    const matchingWords = queryWords.filter((word) => lowerTitle.includes(word));
    if (matchingWords.length === queryWords.length) {
      // All words found
      return 0.85;
    } else if (matchingWords.length > 0) {
      // Some words found
      return 0.5 * (matchingWords.length / queryWords.length);
    }
  }

  // Fuzzy match using Levenshtein distance
  // We compare query against each word in the title and take the best match
  const titleWords = lowerTitle.split(/\s+/).filter((w) => w.length > 0);
  let bestWordScore = 0;

  for (const titleWord of titleWords) {
    // Compare query to this title word
    const distance = levenshteinDistance(lowerQuery, titleWord);
    const maxLen = Math.max(lowerQuery.length, titleWord.length);

    if (maxLen > 0) {
      const wordScore = 1 - distance / maxLen;
      bestWordScore = Math.max(bestWordScore, wordScore);
    }
  }

  // Also compare full strings for longer queries
  const fullDistance = levenshteinDistance(lowerQuery, lowerTitle);
  const maxFullLen = Math.max(lowerQuery.length, lowerTitle.length);
  const fullScore = maxFullLen > 0 ? 1 - fullDistance / maxFullLen : 0;

  // Take the better of word-level or full-string matching
  const fuzzyScore = Math.max(bestWordScore * 0.7, fullScore * 0.6);

  return fuzzyScore;
}

/**
 * Check if title contains query as exact substring (case-insensitive)
 */
export function exactSubstringMatch(query: string, title: string): boolean {
  return title.toLowerCase().includes(query.toLowerCase());
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a note for list output (subset of fields)
 */
export function formatNoteForList(note: Note) {
  return {
    id: note.id,
    title: note.title,
    type: note.type ?? 'regular',
    tags: note.tags || [],
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    linkCount: note.metadata?.links?.length || 0,
  };
}

/**
 * Get a sort function based on field and order
 */
export function getSortFunction(field: SortField, order: SortOrder) {
  const multiplier = order === 'asc' ? 1 : -1;
  return (a: Note, b: Note): number => {
    switch (field) {
      case 'title':
        return multiplier * a.title.localeCompare(b.title);
      case 'created':
        return multiplier * (a.createdAt - b.createdAt);
      case 'updated':
      default:
        return multiplier * (a.updatedAt - b.updatedAt);
    }
  };
}

/**
 * Parse a date string into a timestamp
 * Supports ISO dates and common formats
 */
export function parseDate(dateStr: string): number {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return parsed.getTime();
}

// ============================================================================
// Tag Utilities
// ============================================================================

/**
 * Normalize a tag to ensure it starts with #
 */
export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Parse comma-separated tags and normalize them
 */
export function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(',')
    .map((t) => normalizeTag(t))
    .filter((t) => t.length > 1); // Filter out empty tags (just '#')
}

/**
 * Map 'regular' type to undefined (regular notes have no type in the system)
 */
export function mapNoteType(type: string): NoteType | undefined {
  return type === 'regular' ? undefined : (type as NoteType);
}
