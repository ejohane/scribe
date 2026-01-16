/**
 * Graph router - Knowledge graph queries via tRPC.
 *
 * Exposes GraphService operations as type-safe tRPC procedures.
 * Provides backlinks, forward links, tag navigation, and stats.
 *
 * @module
 */

import { z } from 'zod';
import { router, procedure } from './trpc.js';

/**
 * Graph router providing knowledge graph navigation.
 *
 * @example
 * ```typescript
 * // Get backlinks (notes that reference this note)
 * const backlinks = await client.graph.backlinks.query('note-id');
 *
 * // Get forward links (notes this note references)
 * const forwardLinks = await client.graph.forwardLinks.query('note-id');
 *
 * // Browse notes by tag
 * const taggedNotes = await client.graph.notesByTag.query('typescript');
 *
 * // Get all tags with counts
 * const tags = await client.graph.tags.query();
 *
 * // Get graph statistics
 * const stats = await client.graph.stats.query();
 * ```
 */
export const graphRouter = router({
  /**
   * Get all notes that link TO this note (backlinks).
   *
   * Use case: "What references this note?" - critical for
   * knowledge graph navigation and discovering connections.
   */
  backlinks: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .query(async ({ ctx, input: noteId }) => {
      return ctx.services.graphService.getBacklinks(noteId);
    }),

  /**
   * Get all notes that this note links TO (forward links / outlinks).
   *
   * Use case: "What does this note reference?" - for showing
   * a local graph or related notes panel.
   */
  forwardLinks: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .query(async ({ ctx, input: noteId }) => {
      return ctx.services.graphService.getForwardLinks(noteId);
    }),

  /**
   * Get all notes with a specific tag.
   *
   * Use case: Browse notes by topic/category.
   */
  notesByTag: procedure
    .input(z.string().min(1, 'Tag name is required'))
    .query(async ({ ctx, input: tagName }) => {
      return ctx.services.graphService.getNotesWithTag(tagName);
    }),

  /**
   * Get all tags in the vault with usage counts.
   *
   * Use case: Tag cloud, autocomplete, navigation sidebar.
   * Returns tags ordered by count descending.
   */
  tags: procedure.query(async ({ ctx }) => {
    return ctx.services.graphService.getAllTags();
  }),

  /**
   * Get tags for a specific note.
   *
   * Returns array of tag names (strings).
   */
  noteTags: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .query(async ({ ctx, input: noteId }) => {
      return ctx.services.graphService.getNoteTags(noteId);
    }),

  /**
   * Get graph-wide statistics.
   *
   * Use case: Dashboard, health monitoring, vault overview.
   * Returns: totalNotes, totalLinks, totalTags, orphanedNotes.
   */
  stats: procedure.query(async ({ ctx }) => {
    return ctx.services.graphService.getStats();
  }),
});
