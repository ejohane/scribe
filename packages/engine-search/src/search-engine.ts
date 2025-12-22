/**
 * Search engine implementation using FlexSearch
 *
 * Provides fast, in-memory full-text search across notes with support for
 * title, tag, and content indexing. Implements incremental updates and
 * ranked search results.
 *
 * ## Architecture Overview
 *
 * The SearchEngine wraps FlexSearch's Document index to provide:
 * - Multi-field indexing (title, tags, content)
 * - Weighted scoring based on match location
 * - Snippet generation with context around matches
 * - Incremental index updates (add/remove individual notes)
 *
 * ## Query Syntax
 *
 * The search engine supports FlexSearch's default query syntax:
 * - **Simple terms**: `meeting` - matches notes containing "meeting"
 * - **Multiple terms**: `project update` - matches notes containing both terms (AND logic)
 * - **Prefix matching**: Due to `tokenize: 'forward'`, partial prefixes match
 *   (e.g., "meet" matches "meeting")
 *
 * Note: FlexSearch does NOT support:
 * - Boolean operators (AND, OR, NOT)
 * - Phrase matching with quotes
 * - Field-specific queries (e.g., title:meeting)
 * - Wildcards or regex patterns
 *
 * ## Scoring Algorithm
 *
 * Results are ranked by a weighted scoring system based on WHERE the match occurred:
 * - **Title matches**: weight = 10 (highest priority - titles are most relevant)
 * - **Tag matches**: weight = 5 (medium priority - explicit categorization)
 * - **Content matches**: weight = 1 (lowest priority - body text)
 *
 * If a term matches in multiple fields, the scores are additive. For example,
 * a note with "project" in both title and content would score 11 (10 + 1).
 *
 * ## Performance Characteristics
 *
 * - **Indexing**: O(n) where n is content length (capped at 1000 chars)
 * - **Search**: O(log n) typical for FlexSearch with context indexing
 * - **Memory**: ~2-3x the indexed text size due to forward tokenization
 * - **Cache**: Enabled for repeated queries with identical terms
 */

import FlexSearch, {
  type Document as FlexSearchDocumentClass,
  type EnrichedDocumentSearchResultSetUnit,
  type EnrichedDocumentSearchResultSetUnitResultUnit,
} from 'flexsearch';

// FlexSearch's ESM bundle exports Document as a property of the default export,
// not as a named export. This works around Bun's bundler requiring named exports.
const Document = FlexSearch.Document as typeof FlexSearchDocumentClass;
type Document<T, S extends string[] = string[]> = FlexSearchDocumentClass<T, S>;
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
// These weights determine how matches in different fields contribute to the
// final relevance score. The rationale:
// - Title (10): Highest weight because if a search term appears in the title,
//   the note is almost certainly about that topic
// - Tags (5): Medium weight since tags are explicit user categorization,
//   indicating strong relevance but less than a title match
// - Content (1): Lowest weight as content matches may be incidental mentions
//   rather than the primary topic of the note

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
 *
 * ## FlexSearch Configuration Explained
 *
 * The index is configured with specific options optimized for note-taking search:
 *
 * ### Tokenization Strategy: `tokenize: 'forward'`
 * - Indexes all forward-facing prefixes of each word
 * - Example: "meeting" → ["m", "me", "mee", "meet", "meeti", "meetin", "meeting"]
 * - Enables instant search-as-you-type without requiring wildcards
 * - Trade-off: ~2-3x memory usage vs 'strict' tokenization
 *
 * ### Context Indexing: `context: { resolution: 9, depth: 2, bidirectional: true }`
 * Context indexing improves relevance by considering word relationships:
 *
 * - **resolution: 9** - Precision level (1-9 scale, 9 = highest precision)
 *   Controls how finely word positions are tracked. Higher values give more
 *   accurate phrase/proximity matching but use more memory.
 *
 * - **depth: 2** - How many words of context to consider around each term
 *   A depth of 2 means FlexSearch indexes relationships between words that
 *   are up to 2 positions apart. Helps rank "project meeting" higher when
 *   those words appear near each other.
 *
 * - **bidirectional: true** - Consider context in both directions
 *   Without this, only words AFTER the current word are considered as context.
 *   With bidirectional, both "project meeting" and "meeting project" benefit
 *   from context scoring.
 *
 * ### Caching: `cache: true`
 * - Enables query result caching
 * - Repeated identical searches return cached results instantly
 * - Cache is automatically invalidated when documents are added/removed
 */
export class SearchEngine {
  private index: Document<SearchDocument, string[]>;
  private documents: Map<NoteId, SearchDocument>;

  /**
   * Create a new SearchEngine instance
   *
   * Initializes an empty FlexSearch document index with optimized settings
   * for note-taking search (forward tokenization, context indexing, caching).
   */
  constructor() {
    this.documents = new Map();

    // Configure FlexSearch with document index
    // See class-level JSDoc for detailed explanation of each option
    this.index = new Document<SearchDocument, string[]>({
      document: {
        id: 'id',
        // Fields to index for search (not stored, just searchable)
        index: ['title', 'tags', 'content'],
        // Fields to store for retrieval (returned with search results)
        store: ['id', 'title', 'tags', 'fullText'],
      },
      // Forward tokenization: enables prefix/partial matching (e.g., "meet" → "meeting")
      tokenize: 'forward',
      // Cache repeated queries for performance
      cache: true,
      // Context indexing: improves relevance by considering word proximity
      context: {
        resolution: 9, // Highest precision for position tracking
        depth: 2, // Consider words up to 2 positions apart as related
        bidirectional: true, // Consider context in both directions
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
          // eslint-disable-next-line no-console -- TODO: Migrate to logger abstraction
          console.warn(
            `[SearchEngine] Invalid date in daily note title: "${note.title}" (note id: ${note.id})`
          );
        }
      } catch (error) {
        // Log warning for dates that failed to parse
        // eslint-disable-next-line no-console -- TODO: Migrate to logger abstraction
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
   * Executes a full-text search across all indexed fields (title, tags, content)
   * and returns ranked results with snippets and match information.
   *
   * ## Query Behavior
   *
   * - **Empty/whitespace queries**: Returns empty array immediately (no index query)
   * - **Single terms**: Matches any note containing the term (prefix-matched)
   * - **Multiple terms**: Treated as AND - all terms must be present
   * - **Case sensitivity**: Searches are case-insensitive
   *
   * ## Result Structure
   *
   * FlexSearch returns results grouped by field (one array per indexed field).
   * This method merges those results into a single ranked list:
   *
   * 1. **Deduplication**: Same note may match in multiple fields; we merge these
   * 2. **Score accumulation**: Each field match adds its weight to the note's score
   * 3. **Snippet generation**: Uses the first/best matching field for context
   * 4. **Final ranking**: Sort by total accumulated score, descending
   *
   * ## Performance Notes
   *
   * - Cached queries return instantly (FlexSearch internal caching)
   * - First query after index modification may be slower
   * - Result limiting happens AFTER scoring, so all matches are considered
   *
   * @param query - Search query string. Multiple words are AND-ed together.
   *                Empty or whitespace-only strings return empty results.
   * @param limit - Maximum number of results to return (default: 20).
   *                Set higher if you need comprehensive results.
   * @returns Array of search results sorted by relevance score (highest first).
   *          Empty array if query is empty or no matches found.
   *
   * @example
   * ```typescript
   * // Simple search
   * const results = engine.search('meeting');
   *
   * // Multi-term search (AND logic)
   * const results = engine.search('project update');
   *
   * // Prefix matching works automatically
   * const results = engine.search('meet'); // matches "meeting", "meetings", etc.
   *
   * // Limit results
   * const topFive = engine.search('todo', 5);
   * ```
   */
  search(query: string, limit: number = 20): SearchResult[] {
    // Early return for empty queries - no need to hit the index
    if (!query || query.trim().length === 0) {
      return [];
    }

    // Type alias for the enriched search result structure
    // FlexSearch returns full documents when enrich: true is set
    type EnrichedResult = EnrichedDocumentSearchResultSetUnit<SearchDocument>;
    type EnrichedResultItem = EnrichedDocumentSearchResultSetUnitResultUnit<SearchDocument>;

    // Execute search across all indexed fields
    // FlexSearch's type inference doesn't properly handle the enrich option,
    // so we use explicit generic parameters to get the correct enriched result type
    const results = this.index.search<true>(query, limit, {
      enrich: true, // Get full documents instead of just IDs
    }) as EnrichedResult[];

    // === Result Merging Logic ===
    //
    // FlexSearch returns results grouped by field, e.g.:
    // [
    //   { field: 'title', result: [{ id: 'note1', doc: {...} }] },
    //   { field: 'content', result: [{ id: 'note1', doc: {...} }, { id: 'note2', doc: {...} }] }
    // ]
    //
    // We need to:
    // 1. Merge results for the same note across different fields
    // 2. Accumulate scores based on which fields matched
    // 3. Track which fields matched for debugging/display
    const resultMap = new Map<NoteId, SearchResult>();

    for (const fieldResult of results) {
      // Skip malformed results (defensive - shouldn't happen in practice)
      if (!Array.isArray(fieldResult.result)) {
        continue;
      }

      const field = fieldResult.field as 'title' | 'tags' | 'content';

      for (const item of fieldResult.result as EnrichedResultItem[]) {
        const doc = item.doc;
        const noteId = doc.id;

        if (!resultMap.has(noteId)) {
          // First time seeing this note - create result entry
          // Generate snippet based on this (first encountered) matching field
          const snippet = this.generateResultSnippet(doc, query, field);

          resultMap.set(noteId, {
            id: noteId,
            title: doc.title || null,
            snippet,
            score: 0, // Will be accumulated below
            matches: [],
          });
        }

        // Add match information for this field
        const result = resultMap.get(noteId)!;
        result.matches.push({
          field,
          positions: [], // FlexSearch doesn't provide exact character positions
        });

        // Accumulate score: each field match adds its weight
        // Example: match in title (10) + content (1) = score of 11
        const fieldWeight = this.getFieldWeight(field);
        result.score += fieldWeight;
      }
    }

    // Sort by score descending (most relevant first) and apply limit
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
   *
   * Returns the relevance weight for a given field. These weights are used
   * to calculate the final score of a search result:
   *
   * - **Title (10)**: Highest weight. A term in the title strongly indicates
   *   the note is about that topic.
   * - **Tags (5)**: Medium weight. Tags are explicit user categorization,
   *   but a tag match doesn't mean the note is primarily about that term.
   * - **Content (1)**: Lowest weight. Content matches may be incidental
   *   mentions rather than the main topic.
   *
   * The weights are designed so that:
   * - A title match alone (10) outranks content-only matches from multiple notes
   * - A tag match (5) is worth 5 content matches
   * - Multiple field matches accumulate (title + content = 11)
   *
   * @param field - The field where the match occurred
   * @returns Numeric weight to add to the result's score
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
