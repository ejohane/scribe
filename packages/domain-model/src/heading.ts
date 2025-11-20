/**
 * Heading-related types and models.
 */

import type { HeadingId, NoteId } from './primitives.js';

/**
 * Heading entity within a note.
 */
export interface Heading {
  id: HeadingId; // e.g. "note:notes/Plan.md#goals-and-scope"
  noteId: NoteId;
  level: number;
  text: string;
  normalized: string; // for matching [[Note#Heading]]
  line: number;
}

/**
 * Index for heading entities.
 */
export interface HeadingIndex {
  byId: Map<HeadingId, Heading>;
  headingsByNote: Map<NoteId, HeadingId[]>;
}
