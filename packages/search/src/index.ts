/**
 * @scribe/search
 *
 * Search engine implementing fuzzy search and full-text search.
 */

import type { ParsedNote, NoteId } from '@scribe/domain-model';

/**
 * Search result item.
 */
export interface SearchResult {
  noteId: NoteId;
  note: ParsedNote;
  score: number;
  matchType: 'title' | 'content' | 'tag' | 'alias';
}

/**
 * Search options.
 */
export interface SearchOptions {
  /**
   * Search mode: 'fuzzy' or 'fulltext'.
   */
  mode?: 'fuzzy' | 'fulltext';

  /**
   * Maximum number of results to return.
   */
  limit?: number;

  /**
   * Minimum score threshold (0-1).
   */
  threshold?: number;
}

/**
 * Search engine for notes.
 */
export class SearchEngine {
  private notes: Map<NoteId, ParsedNote> = new Map();

  /**
   * Index a note for searching.
   */
  indexNote(note: ParsedNote): void {
    this.notes.set(note.id, note);
  }

  /**
   * Remove a note from the search index.
   */
  removeNote(noteId: NoteId): void {
    this.notes.delete(noteId);
  }

  /**
   * Search for notes matching the query.
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    // TODO: Implement fuzzy and full-text search
    // For now, return simple title matching
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const note of this.notes.values()) {
      if (note.resolvedTitle.toLowerCase().includes(lowerQuery)) {
        results.push({
          noteId: note.id,
          note,
          score: 1.0,
          matchType: 'title',
        });
      }
    }

    return results.slice(0, options.limit || 50);
  }

  /**
   * Clear all indexed notes.
   */
  clear(): void {
    this.notes.clear();
  }
}
