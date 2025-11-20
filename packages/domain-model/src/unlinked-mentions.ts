/**
 * Unlinked mentions types and models.
 */

import type { NoteId } from './primitives.js';

/**
 * Occurrence of an unlinked mention within a note.
 */
export interface UnlinkedMentionOccurrence {
  line: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Unlinked mention tracking potential links.
 */
export interface UnlinkedMention {
  noteId: NoteId; // the note that contains the text
  candidateTargetId: NoteId; // note that could be linked to
  occurrences: UnlinkedMentionOccurrence[];
}

/**
 * Index for unlinked mentions.
 */
export interface UnlinkedMentionIndex {
  byNote: Map<NoteId, UnlinkedMention[]>; // for a given note, possible outgoing links
  byTarget: Map<NoteId, UnlinkedMention[]>; // for a given note, who mentions it
}
