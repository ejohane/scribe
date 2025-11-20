/**
 * Core client types.
 */

import type { ParsedNote, NoteId } from '@scribe/domain-model';

/**
 * Search options.
 */
export interface SearchOptions {
  mode?: 'fuzzy' | 'fulltext';
  limit?: number;
  threshold?: number;
}

/**
 * Search result item.
 */
export interface SearchResult {
  noteId: NoteId;
  note: ParsedNote;
  score: number;
  matchType: 'title' | 'content' | 'tag' | 'alias';
}
