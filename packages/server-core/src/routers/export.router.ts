/**
 * Export router - Export notes to various formats via tRPC.
 *
 * Exposes ExportService operations as type-safe tRPC procedures.
 * Currently supports Markdown export with optional YAML frontmatter.
 *
 * @module
 */

import { z } from 'zod';
import { router, procedure } from './trpc.js';

/**
 * Schema for markdown export options.
 */
const exportMarkdownOptionsSchema = z.object({
  /**
   * Include YAML frontmatter with metadata.
   * @default true
   */
  includeFrontmatter: z.boolean().optional(),
  /**
   * Include title as H1 heading in the body.
   * @default false
   */
  includeTitle: z.boolean().optional(),
});

/**
 * Schema for export input.
 */
const exportInputSchema = z.object({
  /** Note ID to export (required, non-empty) */
  noteId: z.string().min(1, 'Note ID is required'),
  /** Export options */
  options: exportMarkdownOptionsSchema.optional(),
});

/**
 * Export router providing note export functionality.
 *
 * @example
 * ```typescript
 * // Export note to markdown (default options)
 * const result = await client.export.toMarkdown.query({ noteId: 'note-123' });
 * console.log(result.markdown);
 *
 * // Export without frontmatter
 * const result = await client.export.toMarkdown.query({
 *   noteId: 'note-123',
 *   options: { includeFrontmatter: false },
 * });
 *
 * // Export with title as heading
 * const result = await client.export.toMarkdown.query({
 *   noteId: 'note-123',
 *   options: { includeTitle: true },
 * });
 * ```
 */
export const exportRouter = router({
  /**
   * Export a note to Markdown format.
   *
   * Converts the note to standard Markdown with optional YAML frontmatter.
   * Returns the markdown content, note ID, and export timestamp.
   *
   * Using `query` because:
   * - Export is read-only (doesn't modify note)
   * - Results are cacheable
   * - Aligns with REST GET semantics
   */
  toMarkdown: procedure.input(exportInputSchema).query(async ({ input, ctx }) => {
    const { markdown, title } = await ctx.services.exportService.toMarkdown(
      input.noteId,
      input.options
    );

    return {
      /** The exported markdown content */
      markdown,
      /** The note ID that was exported */
      noteId: input.noteId,
      /** The note title (useful for generating filenames) */
      title,
      /** Timestamp of when the export was performed */
      exportedAt: new Date().toISOString(),
    };
  }),
});

/** Export type for client-sdk type inference */
export type ExportRouter = typeof exportRouter;
