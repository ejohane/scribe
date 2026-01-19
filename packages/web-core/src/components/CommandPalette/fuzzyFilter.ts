/**
 * Fuzzy Filter Utilities
 *
 * Simple fuzzy matching for filtering commands in the palette.
 * Matches characters in sequence but not necessarily contiguous.
 *
 * @module
 */

import type { CommandItem } from './types';

/**
 * Check if a query fuzzy matches a string.
 * Characters must appear in order but not contiguously.
 *
 * @param text - The text to match against
 * @param query - The query to match
 * @returns true if the query fuzzy matches the text
 *
 * @example
 * ```ts
 * fuzzyMatch('Create Note', 'crn'); // true
 * fuzzyMatch('Create Note', 'cnt'); // true
 * fuzzyMatch('Create Note', 'xyz'); // false
 * ```
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  let textIndex = 0;
  let queryIndex = 0;

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }

  return queryIndex === queryLower.length;
}

/**
 * Calculate a fuzzy match score.
 * Higher scores mean better matches.
 *
 * Scoring:
 * - +10 points for matches at word boundaries
 * - +5 points for consecutive character matches
 * - +1 point base for any match
 * - +20 points if query matches start of text
 *
 * @param text - The text to score against
 * @param query - The query to score
 * @returns Score (higher is better), or -1 if no match
 */
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;
  let textIndex = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;

  // Check if query starts at beginning of text
  if (textLower.startsWith(queryLower)) {
    score += 20;
  }

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      score += 1;

      // Bonus for match at word boundary
      if (textIndex === 0 || /\s/.test(text[textIndex - 1])) {
        score += 10;
      }

      // Bonus for consecutive matches
      if (lastMatchIndex === textIndex - 1) {
        score += 5;
      }

      lastMatchIndex = textIndex;
      queryIndex++;
    }
    textIndex++;
  }

  // Return -1 if we didn't match all query characters
  if (queryIndex !== queryLower.length) {
    return -1;
  }

  return score;
}

/**
 * Filter and sort commands by fuzzy match.
 *
 * @param commands - Array of commands to filter
 * @param query - Search query
 * @returns Filtered and sorted commands
 */
export function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query) {
    // Sort by category then priority when no query
    return [...commands].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.priority - b.priority;
    });
  }

  // Score each command
  const scored = commands
    .map((command) => {
      // Score against label and description
      const labelScore = fuzzyScore(command.label, query);
      const descScore = command.description ? fuzzyScore(command.description, query) * 0.5 : -1;
      const score = Math.max(labelScore, descScore);
      return { command, score };
    })
    .filter(({ score }) => score >= 0);

  // Sort by score descending, then by priority
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.command.priority - b.command.priority;
  });

  return scored.map(({ command }) => command);
}
