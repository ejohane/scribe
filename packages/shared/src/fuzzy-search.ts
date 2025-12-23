/**
 * Fuzzy Search Utilities
 *
 * Provides lightweight, dependency-free fuzzy matching functionality.
 * This module is the canonical implementation for text similarity
 * scoring across the Scribe codebase.
 *
 * For React-based UI components that need more advanced features
 * (weighted multi-field search, location-based scoring), consider
 * using Fuse.js directly with these utilities for consistency.
 *
 * @example
 * ```typescript
 * import { fuzzyMatchScore, levenshteinDistance } from '@scribe/shared';
 *
 * // Find best matching notes
 * const matches = notes
 *   .map(note => ({ note, score: fuzzyMatchScore(query, note.title) }))
 *   .filter(({ score }) => score >= 0.3)
 *   .sort((a, b) => b.score - a.score);
 * ```
 */

// ============================================================================
// Levenshtein Distance
// ============================================================================

/**
 * Calculate the Levenshtein distance between two strings.
 *
 * This is the minimum number of single-character edits (insertions, deletions,
 * or substitutions) required to change one string into the other.
 *
 * Time complexity: O(m * n) where m and n are string lengths
 * Space complexity: O(min(m, n)) using two-row optimization
 *
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings (0 = identical)
 *
 * @example
 * ```typescript
 * levenshteinDistance('kitten', 'sitting'); // 3
 * levenshteinDistance('hello', 'hello');    // 0
 * levenshteinDistance('cat', 'bat');        // 1
 * ```
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Handle edge cases
  if (m === 0) return n;
  if (n === 0) return m;

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

// ============================================================================
// Fuzzy Match Scoring
// ============================================================================

/**
 * Minimum score threshold for considering a match valid.
 * Scores below this are typically noise.
 *
 * ## Rationale for 0.3
 *
 * This threshold was chosen based on Levenshtein distance characteristics:
 * - A score of 0.3 means approximately 70% of characters differ between strings
 * - This captures typos (1-2 chars in a 5-char word = 0.6-0.8 score)
 * - But filters out completely unrelated strings (e.g., "cat" vs "elephant")
 *
 * In practice, 0.3 allows:
 * - 2 typos in a 6-character word (distance 2, score ~0.67)
 * - 3 typos in a 10-character word (distance 3, score ~0.7)
 * - Partial matches where query is significantly shorter than title
 *
 * Lower values (e.g., 0.2) would include too many false positives.
 * Higher values (e.g., 0.5) would miss legitimate fuzzy matches with typos.
 */
export const FUZZY_MATCH_THRESHOLD = 0.3;

/**
 * Score returned for exact matches (query equals title, case-insensitive).
 *
 * ## Rationale for 1.0
 *
 * Maximum possible score - an exact match should always rank highest.
 * This ensures users find what they're looking for when they type it exactly.
 */
export const EXACT_MATCH_SCORE = 1.0;

/**
 * Base score for substring matches (query is contained in title).
 *
 * ## Rationale for 0.9
 *
 * Substring matches should rank just below exact matches:
 * - High enough (0.9) to prioritize over fuzzy matches (~0.3-0.7)
 * - Low enough to leave room for the coverage bonus (+0.1 max)
 * - The actual score is: 0.9 * (queryLength / titleLength) + 0.1
 *
 * Examples:
 * - "meet" in "Meeting Notes" = 0.9 * (4/13) + 0.1 = ~0.38
 * - "meeting" in "Meeting Notes" = 0.9 * (7/13) + 0.1 = ~0.58
 * - "meeting notes" in "Meeting Notes" = 0.9 * (13/13) + 0.1 = 1.0
 *
 * This rewards longer, more specific queries that cover more of the title.
 */
export const SUBSTRING_MATCH_BASE = 0.9;

/**
 * Score for when all query words are found in title.
 *
 * ## Rationale for 0.85
 *
 * Multi-word matching (all words found) should rank between:
 * - Substring matches (0.9 base) - because word order may differ
 * - Pure fuzzy matches (~0.3-0.7) - because all words were found exactly
 *
 * The value 0.85 was chosen because:
 * - It's lower than SUBSTRING_MATCH_BASE (0.9) since the words may be
 *   scattered throughout the title rather than appearing as a substring
 * - It's higher than typical fuzzy scores to reward finding all query terms
 * - It provides a clear tier: exact(1.0) > substring(0.9) > all-words(0.85) > fuzzy
 *
 * Example: "project plan" matching "My Project Plan for 2024"
 * - Not a substring match (extra words in between)
 * - But all query words are present, so score = 0.85
 */
export const ALL_WORDS_MATCH_SCORE = 0.85;

/**
 * Calculate a fuzzy match score between a query and a title.
 *
 * Returns a score from 0 to 1, where:
 * - 1.0 = exact match (case-insensitive)
 * - 0.9+ = exact substring match
 * - 0.85 = all query words found in title
 * - 0.3-0.7 = fuzzy match based on edit distance
 * - < 0.3 = poor match (consider filtering out)
 *
 * The algorithm prioritizes:
 * 1. Exact matches
 * 2. Substring matches (with length-based bonus)
 * 3. Multi-word matches (all words found)
 * 4. Fuzzy matches using Levenshtein distance
 *
 * @param query - Search query (case-insensitive)
 * @param title - Text to match against (case-insensitive)
 * @returns Match score from 0 to 1
 *
 * @example
 * ```typescript
 * fuzzyMatchScore('hello', 'hello');           // 1.0 (exact)
 * fuzzyMatchScore('meet', 'Meeting Notes');    // ~0.95 (substring)
 * fuzzyMatchScore('project plan', 'My Project Plan'); // 0.85 (all words)
 * fuzzyMatchScore('hellp', 'hello');           // ~0.56 (fuzzy, 1 typo)
 * ```
 */
export function fuzzyMatchScore(query: string, title: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Exact match
  if (lowerTitle === lowerQuery) {
    return EXACT_MATCH_SCORE;
  }

  // Substring match - high score
  if (lowerTitle.includes(lowerQuery)) {
    // Score based on how much of the title is covered by the query
    return SUBSTRING_MATCH_BASE * (lowerQuery.length / lowerTitle.length) + 0.1;
  }

  // Check if query words appear in title (multi-word matching)
  const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length > 1) {
    const matchingWords = queryWords.filter((word) => lowerTitle.includes(word));
    if (matchingWords.length === queryWords.length) {
      // All words found
      return ALL_WORDS_MATCH_SCORE;
    } else if (matchingWords.length > 0) {
      // Some words found - partial credit
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
  // Apply scaling factors to keep fuzzy scores in reasonable range
  const fuzzyScore = Math.max(bestWordScore * 0.7, fullScore * 0.6);

  return fuzzyScore;
}

/**
 * Check if title contains query as exact substring (case-insensitive).
 *
 * Useful for --exact mode in CLI where fuzzy matching should be disabled.
 *
 * @param query - Search query
 * @param title - Text to search in
 * @returns true if query is found as substring
 */
export function exactSubstringMatch(query: string, title: string): boolean {
  return title.toLowerCase().includes(query.toLowerCase());
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Result of a fuzzy search match.
 */
export interface FuzzyMatchResult<T> {
  /** The matched item */
  item: T;
  /** Match score from 0 to 1 */
  score: number;
}

/**
 * Search items by fuzzy matching a string field.
 *
 * This is a convenience function for common fuzzy search patterns.
 * For more complex searches (multiple fields, custom scoring), use
 * fuzzyMatchScore directly.
 *
 * @param items - Array of items to search
 * @param query - Search query
 * @param getField - Function to extract the searchable string from each item
 * @param threshold - Minimum score to include in results (default: 0.3)
 * @returns Array of matches sorted by score (highest first)
 *
 * @example
 * ```typescript
 * const notes = [{ id: '1', title: 'Meeting Notes' }, ...];
 * const results = fuzzySearch(notes, 'meet', n => n.title);
 * // Returns [{ item: { id: '1', title: 'Meeting Notes' }, score: 0.95 }, ...]
 * ```
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getField: (item: T) => string,
  threshold: number = FUZZY_MATCH_THRESHOLD
): FuzzyMatchResult<T>[] {
  if (!query.trim()) {
    return [];
  }

  return items
    .map((item) => ({
      item,
      score: fuzzyMatchScore(query, getField(item)),
    }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score);
}
