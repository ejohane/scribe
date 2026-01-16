/**
 * Notes router - CRUD operations for notes via tRPC.
 *
 * Exposes DocumentService operations as type-safe tRPC procedures.
 *
 * @module
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, procedure } from './trpc.js';

/**
 * Note type enum values matching the database schema.
 * Must match NoteType in @scribe/server-db: 'note' | 'daily' | 'meeting' | 'person'
 */
const noteTypeSchema = z.enum(['note', 'daily', 'meeting', 'person']);

/**
 * Schema for creating a new note.
 */
const createNoteSchema = z.object({
  /** Title of the note (required, non-empty) */
  title: z.string().min(1, 'Title is required'),
  /** Type of note */
  type: noteTypeSchema,
  /** ISO date string for daily/meeting notes */
  date: z.string().optional(),
  /** Initial Lexical editor content (complex JSON) */
  content: z.any().optional(),
});

/**
 * Schema for updating an existing note.
 */
const updateNoteSchema = z.object({
  /** Note ID to update */
  id: z.string().min(1, 'Note ID is required'),
  /** New title (optional) */
  title: z.string().min(1).optional(),
  /** New Lexical editor content (optional) */
  content: z.any().optional(),
});

/**
 * Schema for listing notes with filters.
 */
const listNotesSchema = z
  .object({
    /** Filter by note type */
    type: noteTypeSchema.optional(),
    /** Filter notes dated on or after this ISO date */
    dateFrom: z.string().optional(),
    /** Filter notes dated on or before this ISO date */
    dateTo: z.string().optional(),
    /** Maximum results (1-100, default 50) */
    limit: z.number().min(1).max(100).default(50),
    /** Pagination offset (default 0) */
    offset: z.number().min(0).default(0),
    /** Sort field */
    orderBy: z.enum(['created_at', 'updated_at', 'title', 'date']).optional(),
    /** Sort direction */
    orderDir: z.enum(['asc', 'desc']).optional(),
  })
  .optional();

/**
 * Notes router providing CRUD operations.
 *
 * @example
 * ```typescript
 * // List all notes
 * const notes = await client.notes.list.query();
 *
 * // Get single note
 * const note = await client.notes.get.query('note-id');
 *
 * // Create note
 * const created = await client.notes.create.mutate({
 *   title: 'My Note',
 *   type: 'note',
 * });
 *
 * // Update note
 * const updated = await client.notes.update.mutate({
 *   id: 'note-id',
 *   title: 'New Title',
 * });
 *
 * // Delete note
 * const deleted = await client.notes.delete.mutate('note-id');
 * ```
 */
export const notesRouter = router({
  /**
   * List notes with optional filtering and pagination.
   *
   * Returns note metadata (not full content) for fast queries.
   * Use `get` to retrieve full note content.
   */
  list: procedure.input(listNotesSchema).query(async ({ ctx, input }) => {
    const filter = input ?? {};
    return ctx.services.documentService.list(filter);
  }),

  /**
   * Get a single note by ID.
   *
   * Returns the full note document including content.
   * Returns null if note not found.
   */
  get: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .query(async ({ ctx, input: id }) => {
      const note = await ctx.services.documentService.read(id);
      return note;
    }),

  /**
   * Create a new note.
   *
   * Creates both the JSON file and SQLite index entry.
   * Returns the created note document.
   */
  create: procedure.input(createNoteSchema).mutation(async ({ ctx, input }) => {
    const note = await ctx.services.documentService.create(input);
    return note;
  }),

  /**
   * Update an existing note.
   *
   * Updates both the JSON file and SQLite index.
   * Returns the updated note document or null if not found.
   */
  update: procedure.input(updateNoteSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const updated = await ctx.services.documentService.update(id, data);

    if (!updated) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Note not found: ${id}`,
      });
    }

    return updated;
  }),

  /**
   * Delete a note by ID.
   *
   * Removes both the JSON file and all related index entries.
   * Returns true if deleted, false if not found.
   */
  delete: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .mutation(async ({ ctx, input: id }) => {
      const deleted = await ctx.services.documentService.delete(id);

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Note not found: ${id}`,
        });
      }

      return { success: true, id };
    }),

  /**
   * Check if a note exists.
   *
   * Faster than `get` when you only need to check existence.
   */
  exists: procedure
    .input(z.string().min(1, 'Note ID is required'))
    .query(async ({ ctx, input: id }) => {
      return ctx.services.documentService.exists(id);
    }),

  /**
   * Count notes, optionally filtered by type.
   */
  count: procedure.input(noteTypeSchema.optional()).query(async ({ ctx, input: type }) => {
    // Only pass the type if it's one of the supported count types
    const countType =
      type && ['note', 'daily', 'meeting', 'person'].includes(type)
        ? (type as 'note' | 'daily' | 'meeting' | 'person')
        : undefined;
    return ctx.services.documentService.count(countType);
  }),
});
