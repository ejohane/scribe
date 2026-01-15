/**
 * SearchRepository - Full-text search using SQLite FTS5.
 *
 * Provides type-safe search operations using FTS5 virtual table.
 * Supports word search, phrase search, and FTS5 query syntax.
 */

import type { Database } from 'better-sqlite3';
import type { SearchResult } from '../types.js';
import { wrapError } from '../errors.js';

/**
 * Options for search queries
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 50) */
  limit?: number;
  /** Pagination offset (default: 0) */
  offset?: number;
  /** HTML tag for highlighting matches (default: 'mark') */
  highlightTag?: string;
}

/**
 * Raw row structure from FTS5 search results
 */
interface SearchRow {
  note_id: string;
  title: string;
  snippet: string;
  rank: number;
}

/**
 * SearchRepository - Repository for full-text search operations.
 *
 * Uses SQLite FTS5 for efficient text search with:
 * - Porter stemmer for word normalization (running → run)
 * - Unicode support for international text
 * - BM25 ranking for relevance scoring
 * - Snippet extraction with highlighting
 *
 * @example
 * ```typescript
 * const repo = new SearchRepository(db);
 *
 * // Index a note for search
 * repo.index('note-1', 'My Title', 'This is the content', ['tag1', 'tag2']);
 *
 * // Search for notes
 * const results = repo.search('content');
 * // [{ noteId: 'note-1', title: 'My Title', snippet: '...the <mark>content</mark>...', rank: -0.5 }]
 *
 * // Advanced FTS5 syntax
 * const results = repo.search('fts:"exact phrase"');
 * ```
 */
export class SearchRepository {
  constructor(private db: Database) {}

  /**
   * Search notes by query text.
   *
   * Supports FTS5 query syntax when prefixed with "fts:":
   * - "exact phrase"
   * - word1 OR word2
   * - word1 AND word2 (default)
   * - prefix*
   *
   * Without "fts:" prefix, searches are treated as simple word searches
   * where each word must appear (AND logic).
   *
   * @param query - Search query string
   * @param options - Search options (limit, offset, highlightTag)
   * @returns Array of search results sorted by relevance (rank)
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    try {
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;
      const tag = options.highlightTag ?? 'mark';

      // Prepare the query - either raw FTS5 or escaped
      const ftsQuery = this.prepareQuery(trimmedQuery);
      if (!ftsQuery) {
        return [];
      }

      // Use parameterized queries for safety, but highlight tags must be interpolated
      // since they're part of the SQL function syntax, not values
      // We validate the tag to prevent SQL injection
      const safeTag = this.sanitizeTag(tag);

      const stmt = this.db.prepare(`
        SELECT
          note_id,
          highlight(notes_fts, 0, '<${safeTag}>', '</${safeTag}>') as title,
          snippet(notes_fts, 1, '<${safeTag}>', '</${safeTag}>', '...', 64) as snippet,
          bm25(notes_fts) as rank
        FROM notes_fts
        WHERE notes_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(ftsQuery, limit, offset) as SearchRow[];
      return rows.map((row) => this.mapRow(row));
    } catch (error) {
      // FTS5 can throw on invalid query syntax - return empty results
      // This is expected behavior, not a programming error
      // Common FTS5 error patterns: 'fts5', 'syntax', 'malformed', 'unterminated', 'unknown'
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (
        message.includes('fts5') ||
        message.includes('syntax') ||
        message.includes('malformed') ||
        message.includes('unterminated') ||
        message.includes('unknown') ||
        message.includes('no such column')
      ) {
        return [];
      }
      throw wrapError(error, 'QUERY_FAILED', 'Failed to execute search query');
    }
  }

  /**
   * Index a note for full-text search.
   *
   * Call this after creating or updating a note to add it to the search index.
   * If the note already exists in the index, it will be replaced.
   *
   * @param noteId - The note's unique identifier
   * @param title - The note's title
   * @param content - Plain text content (extracted from editor state)
   * @param tags - Array of tag names associated with the note
   */
  index(noteId: string, title: string, content: string, tags: string[]): void {
    try {
      // Use a transaction to ensure atomic update
      this.db.transaction(() => {
        // Remove existing entry if any
        this.db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId);

        // Insert new entry
        this.db
          .prepare(
            `
          INSERT INTO notes_fts (note_id, title, content, tags)
          VALUES (?, ?, ?, ?)
        `
          )
          .run(noteId, title, content, tags.join(' '));
      })();
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to index note ${noteId}`);
    }
  }

  /**
   * Remove a note from the search index.
   *
   * Call this after deleting a note. Note that CASCADE delete on the notes
   * table does NOT automatically remove FTS5 entries since it's a virtual table.
   *
   * @param noteId - The note's unique identifier
   * @returns true if the note was removed, false if it wasn't in the index
   */
  remove(noteId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM notes_fts WHERE note_id = ?');
      const result = stmt.run(noteId);
      return result.changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to remove note ${noteId} from search index`);
    }
  }

  /**
   * Rebuild the entire search index from notes table.
   *
   * Useful for recovery, schema changes, or when the index becomes corrupted.
   * The callback function is used to extract content and tags for each note.
   *
   * @param getNoteContent - Callback to get content and tags for a note ID
   */
  reindexAll(getNoteContent: (noteId: string) => { content: string; tags: string[] }): void {
    try {
      this.db.transaction(() => {
        // Clear existing index
        this.db.exec('DELETE FROM notes_fts');

        // Get all notes
        const notes = this.db.prepare('SELECT id, title FROM notes').all() as {
          id: string;
          title: string;
        }[];

        // Re-index each note
        const insertStmt = this.db.prepare(`
          INSERT INTO notes_fts (note_id, title, content, tags)
          VALUES (?, ?, ?, ?)
        `);

        for (const note of notes) {
          const { content, tags } = getNoteContent(note.id);
          insertStmt.run(note.id, note.title, content, tags.join(' '));
        }
      })();
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to reindex all notes');
    }
  }

  /**
   * Check if a note is in the search index.
   *
   * @param noteId - The note's unique identifier
   * @returns true if the note is indexed
   */
  isIndexed(noteId: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM notes_fts WHERE note_id = ? LIMIT 1');
      const result = stmt.get(noteId);
      return result !== undefined;
    } catch (error) {
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to check if note ${noteId} is in search index`
      );
    }
  }

  /**
   * Count the number of indexed notes.
   *
   * @returns The count of notes in the search index
   */
  count(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM notes_fts');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to count indexed notes');
    }
  }

  /**
   * Prepare a query for FTS5.
   *
   * If the query starts with "fts:", it's passed through as raw FTS5 syntax.
   * Otherwise, the query is escaped to prevent syntax errors.
   */
  private prepareQuery(query: string): string | null {
    // Raw FTS5 syntax - pass through
    if (query.startsWith('fts:')) {
      return query.slice(4).trim() || null;
    }

    // Simple search - escape and quote each word
    const words = query
      .replace(/["']/g, '') // Remove quotes
      .split(/\s+/) // Split on whitespace
      .filter(Boolean) // Remove empty strings
      .map((word) => `"${word.replace(/"/g, '""')}"`) // Quote and escape each word
      .join(' '); // AND them together (implicit in FTS5)

    return words || null;
  }

  /**
   * Sanitize HTML tag name to prevent SQL injection.
   * Only allows alphanumeric characters.
   */
  private sanitizeTag(tag: string): string {
    const sanitized = tag.replace(/[^a-zA-Z0-9]/g, '');
    return sanitized || 'mark';
  }

  /**
   * Map a database row to a SearchResult object.
   */
  private mapRow(row: SearchRow): SearchResult {
    return {
      noteId: row.note_id,
      title: row.title,
      snippet: row.snippet,
      rank: row.rank,
    };
  }
}
