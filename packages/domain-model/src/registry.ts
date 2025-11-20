/**
 * Note registry and related types.
 */

import type { NoteId, FilePath } from './primitives.js';
import type { ParsedNote } from './note.js';

/**
 * Central registry of all note-like entities (including person notes).
 */
export interface NoteRegistry {
  byId: Map<NoteId, ParsedNote>;
  byPath: Map<FilePath, NoteId>;
  byTitle: Map<string, Set<NoteId>>; // for unlinked mentions + resolution
  byAlias: Map<string, Set<NoteId>>; // aliases -> candidate notes
}
