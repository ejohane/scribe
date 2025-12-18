/**
 * Search-related type definitions for Scribe
 *
 * This module contains types for full-text search functionality,
 * including search results and match position data for highlighting.
 */

import type { NoteId } from './note-types.js';

/**
 * Search result
 *
 * Represents a single result from a full-text search query. Contains
 * the matched note's information along with relevance scoring and
 * match position data for highlighting.
 *
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   id: createNoteId('abc-123'),
 *   title: 'Meeting Notes',
 *   snippet: '...discussed the **project** timeline and deliverables...',
 *   score: 0.85,
 *   matches: [
 *     { field: 'content', positions: [42, 156] }
 *   ]
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface SearchResult {
  /** Unique identifier of the matched note */
  id: NoteId;
  /**
   * Title of the matched note. Can be `null` for untitled notes.
   * Used for display in search results list.
   */
  title: string | null;
  /**
   * Contextual text snippet showing where matches occurred.
   * Typically 100-200 characters with ellipsis for context.
   * Match terms may be wrapped with markers for highlighting.
   */
  snippet: string;
  /**
   * Relevance score from the search engine.
   * Range: 0.0 to 1.0, where 1.0 is a perfect match.
   * Used for sorting results by relevance.
   */
  score: number;
  /**
   * Detailed match information for each field that matched.
   * Used for highlighting matches in the UI.
   */
  matches: Array<{
    /** Which field contained the match */
    field: 'title' | 'tags' | 'content';
    /**
     * Character positions where matches occurred within the field.
     * Each position is the start index of a match term.
     */
    positions: number[];
  }>;
}
