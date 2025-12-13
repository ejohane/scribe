/**
 * Search engine implementation using FlexSearch
 *
 * Provides fast, in-memory full-text search across notes with support for
 * title, tag, and content indexing. Implements incremental updates and
 * ranked search results.
 */

import {
  Document,
  type EnrichedDocumentSearchResultSetUnit,
  type EnrichedDocumentSearchResultSetUnitResultUnit,
} from 'flexsearch';
import { format, parse, isValid } from 'date-fns';
import type { Note, NoteId, SearchResult } from '@scribe/shared';
import { extractTextForSearch, extractTextWithContext, generateSnippet } from './text-extraction';

// Search indexing constants
/** Maximum content length to index for performance (characters) */
const MAX_INDEXED_CONTENT_LENGTH = 1000;

// Snippet generation constants
/** Maximum length for search result snippets (characters) */
const SNIPPET_MAX_LENGTH = 160;
/** Context radius around match position for snippet generation (characters) */
const SNIPPET_CONTEXT_RADIUS = 80;

// Search scoring weights
/** Weight for matches in title field (highest priority) */
const SEARCH_WEIGHT_TITLE = 10;
/** Weight for matches in tags field (medium priority) */
const SEARCH_WEIGHT_TAGS = 5;
/** Weight for matches in content field (lowest priority) */
const SEARCH_WEIGHT_CONTENT = 1;

/**
 * Internal document structure for indexing
 */
interface SearchDocument {
  id: NoteId;
  title: string;
  tags: string;
  content: string;
  fullText: string; // For snippet generation
}

/**
 * SearchEngine class
 *
 * Maintains an in-memory search index using FlexSearch and provides
 * methods for indexing notes and executing queries.
 */
export class SearchEngine {
  private index: Document<SearchDocument, string[]>;
  private documents: Map<NoteId, SearchDocument>;

  constructor() {
    this.documents = new Map();

    // Configure FlexSearch with document index
    this.index = new Document<SearchDocument, string[]>({
      document: {
        id: 'id',
        index: ['title', 'tags', 'content'],
        store: ['id', 'title', 'tags', 'fullText'],
      },
      tokenize: 'forward',
      // Optimize for speed and memory
      cache: true,
      context: {
        resolution: 9,
        depth: 2,
        bidirectional: true,
      },
    });
  }

  /**
   * Add or update a note in the search index
   *
   * Extracts text from the note content and adds it to the index.
   * If the note already exists, it will be updated.
   *
   * @param note - Note to index
   */
  indexNote(note: Note): void {
    // Remove old version if it exists
    this.removeNote(note.id);

    // Extract text for indexing
    const fullText = extractTextForSearch(note.content);
    const contextText = extractTextWithContext(note.content);

    // Combine explicit user tags with inline #tags from content for search
    const allTags = [...new Set([...note.tags, ...note.metadata.tags])];

    // Build searchable title - for daily notes, also include formatted date (MM/dd/yyyy)
    let searchableTitle = note.title || '';
    if (note.type === 'daily' && note.title) {
      try {
        // Daily notes store their title as MM-dd-yyyy date
        const date = parse(note.title, 'MM-dd-yyyy', new Date());
        if (isValid(date)) {
          // Add formatted date as additional searchable text
          const formattedDate = format(date, 'MM/dd/yyyy');
          searchableTitle = `${note.title} ${formattedDate}`;
        } else {
          // Log warning for invalid dates that parsed but aren't valid
          console.warn(
            `[SearchEngine] Invalid date in daily note title: "${note.title}" (note id: ${note.id})`
          );
        }
      } catch (error) {
        // Log warning for dates that failed to parse
        console.warn(
          `[SearchEngine] Failed to parse date from daily note title: "${note.title}" (note id: ${note.id})`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // Prepare document for indexing (using explicit title field)
    const doc: SearchDocument = {
      id: note.id,
      title: searchableTitle,
      tags: allTags.join(' '),
      content: fullText.slice(0, MAX_INDEXED_CONTENT_LENGTH), // Index first N chars for performance
      fullText: contextText, // Store more for snippets
    };

    // Store document for snippet generation
    this.documents.set(note.id, doc);

    // Add to FlexSearch index
    this.index.add(doc);
  }

  /**
   * Remove a note from the search index
   *
   * @param noteId - ID of note to remove
   */
  removeNote(noteId: NoteId): void {
    this.documents.delete(noteId);
    this.index.remove(noteId);
  }

  /**
   * Search for notes matching a query
   *
   * Returns ranked search results with snippets and match information.
   *
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Array of search results sorted by relevance
   */
  search(query: string, limit: number = 20): SearchResult[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Type alias for the enriched search result structure
    type EnrichedResult = EnrichedDocumentSearchResultSetUnit<SearchDocument>;
    type EnrichedResultItem = EnrichedDocumentSearchResultSetUnitResultUnit<SearchDocument>;

    // Execute search across all indexed fields
    // FlexSearch's type inference doesn't properly handle the enrich option,
    // so we use explicit generic parameters to get the correct enriched result type
    const results = this.index.search<true>(query, limit, {
      enrich: true, // Get full documents
    }) as EnrichedResult[];

    // FlexSearch returns results grouped by field
    // We need to merge and rank them
    const resultMap = new Map<NoteId, SearchResult>();

    for (const fieldResult of results) {
      if (!Array.isArray(fieldResult.result)) {
        continue;
      }

      const field = fieldResult.field as 'title' | 'tags' | 'content';

      for (const item of fieldResult.result as EnrichedResultItem[]) {
        const doc = item.doc;
        const noteId = doc.id;

        if (!resultMap.has(noteId)) {
          // Create new result entry
          const snippet = this.generateResultSnippet(doc, query, field);

          resultMap.set(noteId, {
            id: noteId,
            title: doc.title || null,
            snippet,
            score: 0,
            matches: [],
          });
        }

        // Add match information
        const result = resultMap.get(noteId)!;
        result.matches.push({
          field,
          positions: [], // FlexSearch doesn't provide exact positions
        });

        // Update score based on field weight
        const fieldWeight = this.getFieldWeight(field);
        result.score += fieldWeight;
      }
    }

    // Convert to array and sort by score
    const rankedResults = Array.from(resultMap.values()).sort((a, b) => b.score - a.score);

    return rankedResults.slice(0, limit);
  }

  /**
   * Clear all indexed notes
   *
   * Useful for rebuilding the index from scratch
   */
  clear(): void {
    this.documents.clear();
    // Recreate index to clear all data
    this.index = new Document<SearchDocument, string[]>({
      document: {
        id: 'id',
        index: ['title', 'tags', 'content'],
        store: ['id', 'title', 'tags', 'fullText'],
      },
      tokenize: 'forward',
      cache: true,
      context: {
        resolution: 9,
        depth: 2,
        bidirectional: true,
      },
    });
  }

  /**
   * Get the number of indexed notes
   *
   * @returns Count of indexed notes
   */
  size(): number {
    return this.documents.size;
  }

  /**
   * Get field weight for scoring
   */
  private getFieldWeight(field: 'title' | 'tags' | 'content'): number {
    const weights = {
      title: SEARCH_WEIGHT_TITLE,
      tags: SEARCH_WEIGHT_TAGS,
      content: SEARCH_WEIGHT_CONTENT,
    };
    return weights[field];
  }

  /**
   * Generate snippet for search result
   */
  private generateResultSnippet(
    doc: SearchDocument,
    query: string,
    matchField: 'title' | 'tags' | 'content'
  ): string {
    // If match is in title or tags, use beginning of content
    if (matchField === 'title' || matchField === 'tags') {
      return doc.fullText.slice(0, SNIPPET_MAX_LENGTH) || '';
    }

    // For content matches, try to find the query in the text
    const lowerText = doc.fullText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchPos = lowerText.indexOf(lowerQuery);

    if (matchPos >= 0) {
      return generateSnippet(doc.fullText, matchPos, SNIPPET_CONTEXT_RADIUS);
    }

    // Fallback to beginning of content
    return doc.fullText.slice(0, SNIPPET_MAX_LENGTH) || '';
  }
}
