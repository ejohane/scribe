/**
 * @scribe/indexing
 *
 * Indexing system for maintaining registries and indices of all entities.
 * Manages note registry, people index, tag index, folder index, etc.
 */

import type { AppState, ParsedNote } from '@scribe/domain-model';

/**
 * Create an empty AppState with all indices initialized.
 */
export function createAppState(): AppState {
  return {
    noteRegistry: {
      byId: new Map(),
      byPath: new Map(),
      byTitle: new Map(),
      byAlias: new Map(),
    },
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
  // TODO: Implement full indexing logic
  state.noteRegistry.byId.set(note.id, note);
  state.noteRegistry.byPath.set(note.path, note.id);
}

/**
 * Remove a note from the index.
 */
export function removeNote(state: AppState, noteId: string): void {
  // TODO: Implement full removal logic
  const note = state.noteRegistry.byId.get(noteId);
  if (note) {
    state.noteRegistry.byId.delete(noteId);
    state.noteRegistry.byPath.delete(note.path);
  }
}

export * from './types.js';
