/**
 * SearchService - Full-text search with query parsing and result enrichment.
 *
 * This service wraps the SearchRepository and provides higher-level search functionality:
 * - Query parsing and validation
 * - Result enrichment with note metadata
 * - Type/date filtering
 * - Match location detection
 *
 * SearchService depends on DocumentService for reindexing operations.
 *
 * @module
 */

import type { NotesRepository, SearchRepository, NoteType } from '@scribe/server-db';
import type { DocumentService } from './document.service.js';
import type { EditorContent } from '../types/index.js';

/**
 * Filter options for search queries.
 */
export interface SearchFilters {
  /** Filter by note types */
  type?: NoteType[];
  /** Filter notes dated on or after this ISO date */
  dateFrom?: string;
  /** Filter notes dated on or before this ISO date */
  dateTo?: string;
  /** Filter notes that have specific tags */
  tags?: string[];
}

/**
 * Options for search queries.
 */
export interface SearchOptions {
  /** Maximum results to return (default: 50) */
  limit?: number;
  /** Pagination offset (default: 0) */
  offset?: number;
  /** Number of characters per snippet (default: 128) */
  snippetLength?: number;
}

/**
 * Complete search query with text, filters, and options.
 */
export interface SearchQuery {
  /** Search query text */
  text: string;
  /** Optional filters to narrow results */
  filters?: SearchFilters;
  /** Optional search options */
  options?: SearchOptions;
}

/**
 * Note metadata included in search results.
 */
export interface SearchResultNote {
  /** Note ID */
  id: string;
  /** Note title */
  title: string;
  /** Note type */
  type: NoteType;
  /** Last update timestamp (ISO) */
  updatedAt: string;
}

/**
 * Where the search term matched within the note.
 */
export type MatchLocation = 'title' | 'content' | 'tags';

/**
 * A single search result with metadata and relevance info.
 */
export interface SearchResult {
  /** Note metadata */
  note: SearchResultNote;
  /** Highlighted snippet showing match context */
  snippet: string;
  /** Relevance score (lower is better, BM25) */
  score: number;
  /** Where the match was found */
  matchedIn: MatchLocation[];
}

/**
 * Search suggestion for autocomplete (future enhancement).
 */
export interface SearchSuggestion {
  /** Suggestion text */
  text: string;
  /** Type of suggestion */
  type: 'recent' | 'popular' | 'tag';
}

/**
 * Result of a reindex operation.
 */
export interface ReindexResult {
  /** Number of notes successfully indexed */
  indexed: number;
  /** Number of notes that failed to index */
  errors: number;
}

/**
 * Dependencies for SearchService.
 */
export interface SearchServiceDeps {
  /** Search repository for FTS operations */
  searchRepo: SearchRepository;
  /** Notes repository for metadata lookups */
  notesRepo: NotesRepository;
  /** Document service for reading note content */
  documentService: DocumentService;
}

/**
 * SearchService - Full-text search with query parsing and result enrichment.
 *
 * @example
 * ```typescript
 * const service = new SearchService({
 *   searchRepo: new SearchRepository(db),
 *   notesRepo: new NotesRepository(db),
 *   documentService: docService,
 * });
 *
 * // Basic search
 * const results = await service.search({ text: 'typescript' });
 *
 * // Search with filters
 * const filtered = await service.search({
 *   text: 'meeting notes',
 *   filters: {
 *     type: ['daily', 'meeting'],
 *     dateFrom: '2024-01-01',
 *   },
 *   options: { limit: 20 },
 * });
 *
 * // Reindex a specific note
 * await service.reindex(noteId);
 *
 * // Rebuild entire index
 * const result = await service.reindexAll();
 * ```
 */
export class SearchService {
  private readonly searchRepo: SearchRepository;
  private readonly notesRepo: NotesRepository;
  private readonly documentService: DocumentService;

  constructor(deps: SearchServiceDeps) {
    this.searchRepo = deps.searchRepo;
    this.notesRepo = deps.notesRepo;
    this.documentService = deps.documentService;
  }

  /**
   * Search notes by query.
   *
   * Supports simple word search and FTS5 syntax:
   * - `word` - Find notes containing "word"
   * - `"exact phrase"` - Find exact phrase
   * - `word1 word2` - Find notes with both words (AND)
   *
   * @param query - Search query with text, filters, and options
   * @returns Array of search results sorted by relevance
   *
   * @example
   * ```typescript
   * // Simple search
   * const results = await search({ text: 'typescript' });
   *
   * // With filters
   * const filtered = await search({
   *   text: 'meeting',
   *   filters: { type: ['meeting', 'daily'] },
   * });
   * ```
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    // Validate and normalize query text
    const text = query.text.trim();
    if (!text) {
      return [];
    }

    // Execute FTS search via repository
    const limit = query.options?.limit ?? 50;
    const offset = query.options?.offset ?? 0;

    const ftsResults = this.searchRepo.search(text, {
      limit,
      offset,
    });

    // Enrich results with note metadata and apply filters
    const results: SearchResult[] = [];
    const lowerText = text.toLowerCase();

    for (const fts of ftsResults) {
      const note = this.notesRepo.findById(fts.noteId);
      if (!note) {
        continue;
      }

      // Apply type filter
      if (query.filters?.type && query.filters.type.length > 0) {
        if (!query.filters.type.includes(note.type)) {
          continue;
        }
      }

      // Apply date filters
      if (query.filters?.dateFrom && note.date) {
        if (note.date < query.filters.dateFrom) {
          continue;
        }
      }

      if (query.filters?.dateTo && note.date) {
        if (note.date > query.filters.dateTo) {
          continue;
        }
      }

      // Determine where the match was found
      const matchedIn: MatchLocation[] = [];

      // Check if matched in title
      if (this.textContainsQuery(note.title.toLowerCase(), lowerText)) {
        matchedIn.push('title');
      }

      // Check if matched in content (snippet)
      if (this.textContainsQuery(fts.snippet.toLowerCase(), lowerText)) {
        matchedIn.push('content');
      }

      // If no matches detected in title or snippet, still mark as content match
      // since FTS returned this result
      if (matchedIn.length === 0) {
        matchedIn.push('content');
      }

      results.push({
        note: {
          id: note.id,
          title: note.title,
          type: note.type,
          updatedAt: note.updatedAt,
        },
        snippet: fts.snippet,
        score: fts.rank,
        matchedIn,
      });
    }

    return results;
  }

  /**
   * Reindex a single note in the search index.
   *
   * Call this after updating a note to keep the search index in sync.
   * If the note doesn't exist, removes it from the index.
   *
   * @param noteId - The note ID to reindex
   *
   * @example
   * ```typescript
   * // After updating a note
   * await documentService.update(noteId, { title: 'New Title' });
   * await searchService.reindex(noteId);
   * ```
   */
  async reindex(noteId: string): Promise<void> {
    const note = await this.documentService.read(noteId);

    if (!note) {
      // Note doesn't exist - remove from search index
      this.searchRepo.remove(noteId);
      return;
    }

    // Extract plain text and tags for indexing
    const plainText = this.extractPlainText(note.content);
    const tags = this.extractTags(note.content);

    this.searchRepo.index(noteId, note.title, plainText, tags);
  }

  /**
   * Rebuild the entire search index.
   *
   * Use for recovery, after schema changes, or when the index becomes corrupted.
   * This iterates through all notes and re-indexes each one.
   *
   * @returns Object with counts of indexed notes and errors
   *
   * @example
   * ```typescript
   * const result = await searchService.reindexAll();
   * console.log(`Indexed ${result.indexed} notes, ${result.errors} errors`);
   * ```
   */
  async reindexAll(): Promise<ReindexResult> {
    const notes = this.notesRepo.findAll();
    let indexed = 0;
    let errors = 0;

    for (const noteMeta of notes) {
      try {
        await this.reindex(noteMeta.id);
        indexed++;
      } catch (err) {
        console.error(`Failed to index ${noteMeta.id}:`, err);
        errors++;
      }
    }

    return { indexed, errors };
  }

  /**
   * Get search suggestions for autocomplete.
   *
   * Future enhancement - currently returns empty array.
   * Will support recent searches, popular terms, and tag completions.
   *
   * @param _prefix - The prefix to get suggestions for
   * @returns Array of suggestions (empty for now)
   */
  getSuggestions(_prefix: string): SearchSuggestion[] {
    // MVP: Return empty
    // Future: Recent searches, popular terms, tag completions
    return [];
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Check if text contains the query words.
   * Handles both single words and phrase queries.
   */
  private textContainsQuery(text: string, query: string): boolean {
    // Handle phrase queries (quoted)
    if (query.includes('"')) {
      // Extract phrases and check for exact matches
      const phrases = query.match(/"([^"]+)"/g);
      if (phrases) {
        for (const phrase of phrases) {
          const cleanPhrase = phrase.replace(/"/g, '');
          if (text.includes(cleanPhrase)) {
            return true;
          }
        }
      }
    }

    // Handle word queries - check if any word appears
    const words = query.replace(/["']/g, '').split(/\s+/).filter(Boolean);

    for (const word of words) {
      if (text.includes(word)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract plain text from Lexical editor content.
   */
  private extractPlainText(content: EditorContent): string {
    const texts: string[] = [];

    const traverse = (node: unknown): void => {
      if (!node || typeof node !== 'object') {
        return;
      }

      const n = node as Record<string, unknown>;

      // Extract text from text nodes
      if (typeof n.text === 'string') {
        texts.push(n.text);
      }

      // Recurse into children
      if (Array.isArray(n.children)) {
        for (const child of n.children) {
          traverse(child);
        }
      }
    };

    if (content?.root?.children) {
      for (const child of content.root.children) {
        traverse(child);
      }
    }

    return texts.join(' ');
  }

  /**
   * Extract hashtags from Lexical editor content.
   */
  private extractTags(content: EditorContent): string[] {
    const tags: Set<string> = new Set();

    const traverse = (node: unknown): void => {
      if (!node || typeof node !== 'object') {
        return;
      }

      const n = node as Record<string, unknown>;

      // Check if this node is a hashtag
      if ((n.type === 'hashtag' || n.type === 'tag') && typeof n.tag === 'string') {
        tags.add(n.tag.toLowerCase().trim());
      }

      // Also check for inline text patterns like #tag
      if (typeof n.text === 'string') {
        const hashtagMatches = n.text.match(/#[\w-]+/g);
        if (hashtagMatches) {
          for (const match of hashtagMatches) {
            tags.add(match.slice(1).toLowerCase().trim());
          }
        }
      }

      // Recurse into children
      if (Array.isArray(n.children)) {
        for (const child of n.children) {
          traverse(child);
        }
      }
    };

    if (content?.root?.children) {
      for (const child of content.root.children) {
        traverse(child);
      }
    }

    return Array.from(tags);
  }
}
