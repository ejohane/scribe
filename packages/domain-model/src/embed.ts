/**
 * Embed-related types and models.
 */

import type { EmbedId, NoteId } from './primitives.js';

/**
 * Embed entity pointing to other notes.
 */
export interface Embed {
  id: EmbedId; // e.g. "embed:notes/Plan.md"
  sourceNoteId: NoteId; // note that includes the embed
  targetNoteId?: NoteId; // resolved note, if any
}

/**
 * Index for embed entities.
 */
export interface EmbedIndex {
  embedsBySourceNote: Map<NoteId, EmbedId[]>;
  embedsByTargetNote: Map<NoteId, EmbedId[]>;
}
