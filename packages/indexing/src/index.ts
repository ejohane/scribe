/**
 * @scribe/indexing
 *
 * Indexing system for maintaining registries and indices of all entities.
 * Manages note registry, people index, tag index, folder index, etc.
 */

import { NoteRegistry } from '@scribe/domain-model';
import type { AppState, ParsedNote } from '@scribe/domain-model';

/**
 * Create an empty AppState with all indices initialized.
 */
export function createAppState(): AppState {
  return {
    noteRegistry: new NoteRegistry(),
    peopleIndex: {
      byId: new Map(),
      byName: new Map(),
      mentionsByPerson: new Map(),
      peopleByNote: new Map(),
    },
    tagIndex: {
      tags: new Map(),
      notesByTag: new Map(),
      tagsByNote: new Map(),
    },
    folderIndex: {
      folders: new Map(),
      childrenByFolder: new Map(),
      notesByFolder: new Map(),
    },
    headingIndex: {
      byId: new Map(),
      headingsByNote: new Map(),
    },
    embedIndex: {
      embedsBySourceNote: new Map(),
      embedsByTargetNote: new Map(),
    },
    graphIndex: {
      nodes: new Map(),
      outgoing: new Map(),
      incoming: new Map(),
    },
    unlinkedMentionIndex: {
      byNote: new Map(),
      byTarget: new Map(),
    },
  };
}

/**
 * Add or update a note in the index.
 */
export function indexNote(state: AppState, note: ParsedNote): void {
  // Check if note already exists - if so, update; otherwise add
  const existing = state.noteRegistry.getNoteById(note.id);
  if (existing) {
    state.noteRegistry.update(note);
  } else {
    state.noteRegistry.add(note);
  }
  // TODO: Update other indices (tags, people, headings, etc.)
}

/**
 * Remove a note from the index.
 */
export function removeNote(state: AppState, noteId: string): void {
  // Check if note exists before trying to remove
  const note = state.noteRegistry.getNoteById(noteId);
  if (!note) {
    return; // Nothing to remove
  }

  // Remove from note registry
  state.noteRegistry.remove(noteId);
  // TODO: Implement full removal logic for other indices
}

export * from './types.js';
