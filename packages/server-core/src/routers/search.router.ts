/**
 * Search router - Full-text search via tRPC.
 *
 * Exposes SearchService operations as type-safe tRPC procedures.
 *
 * @module
 */

import { z } from 'zod';
import { router, procedure } from './trpc.js';

/**
 * Note type enum for search filters.
 * Must match NoteType in @scribe/server-db: 'note' | 'daily' | 'meeting' | 'person'
 */
const noteTypeSchema = z.enum(['note', 'daily', 'meeting', 'person']);

/**
 * Schema for search filters.
 */
const searchFiltersSchema = z.object({
  /** Filter by note types */
  type: z.array(noteTypeSchema).optional(),
  /** Filter notes dated on or after this ISO date */
  dateFrom: z.string().optional(),
  /** Filter notes dated on or before this ISO date */
  dateTo: z.string().optional(),
  /** Filter notes that have specific tags */
  tags: z.array(z.string()).optional(),
});

/**
 * Schema for search options.
 */
const searchOptionsSchema = z.object({
  /** Maximum results to return (1-100, default 50) */
  limit: z.number().min(1).max(100).default(50),
  /** Pagination offset (default 0) */
  offset: z.number().min(0).default(0),
  /** Number of characters per snippet (default 128) */
  snippetLength: z.number().min(10).max(500).default(128),
});

/**
 * Schema for complete search query.
 */
const searchQuerySchema = z.object({
  /** Search query text (required, non-empty) */
  text: z.string().min(1, 'Search text is required'),
  /** Optional filters to narrow results */
  filters: searchFiltersSchema.optional(),
  /** Optional search options */
  options: searchOptionsSchema.optional(),
});

/**
 * Search router providing full-text search.
 *
 * @example
 * ```typescript
 * // Simple search
 * const results = await client.search.query.query({ text: 'typescript' });
 *
 * // Search with filters
 * const filtered = await client.search.query.query({
 *   text: 'meeting notes',
 *   filters: {
 *     type: ['daily', 'meeting'],
 *     dateFrom: '2024-01-01',
 *   },
 *   options: { limit: 20 },
 * });
 *
 * // Rebuild search index
 * const result = await client.search.reindexAll.mutate();
 * ```
 */
export const searchRouter = router({
  /**
   * Search notes by query.
   *
   * Supports simple word search and FTS5 syntax:
   * - `word` - Find notes containing "word"
   * - `"exact phrase"` - Find exact phrase
   * - `word1 word2` - Find notes with both words (AND)
   *
   * Returns results sorted by relevance with snippets showing match context.
   */
  query: procedure.input(searchQuerySchema).query(async ({ ctx, input }) => {
    return ctx.services.searchService.search(input);
  }),

  /**
   * Reindex a single note in the search index.
   *
   * Call this after manually modifying a note file to keep the index in sync.
   * If the note doesn't exist, removes it from the index.
   */
  reindex: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .mutation(async ({ ctx, input: noteId }) => {
      await ctx.services.searchService.reindex(noteId);
      return { success: true, noteId };
    }),

  /**
   * Rebuild the entire search index.
   *
   * Use for recovery, after schema changes, or when the index becomes corrupted.
   * This iterates through all notes and re-indexes each one.
   *
   * Returns counts of indexed notes and errors.
   */
  reindexAll: procedure.mutation(async ({ ctx }) => {
    return ctx.services.searchService.reindexAll();
  }),
});
