/**
 * Application state aggregation.
 */

import { NoteRegistry } from './registry.js';
import { PeopleRegistry } from './person.js';
import { TagRegistry } from './tag.js';
import { FolderRegistry } from './folder.js';
import { HeadingRegistry } from './heading.js';
import { EmbedRegistry } from './embed.js';
import { UnlinkedMentionRegistry } from './unlinked-mentions.js';
import type { GraphIndex } from './graph.js';
import type { NoteId } from './primitives.js';
import type { ParsedNote } from './note.js';

/**
 * Central application state aggregating all indices.
 * This is exposed as read-only to the UI and other subsystems,
 * with mutations funneled through the Indexing System.
 */
export interface AppState {
  noteRegistry: NoteRegistry;
  peopleIndex: PeopleRegistry;
  tagIndex: TagRegistry;
  folderIndex: FolderRegistry;
  headingIndex: HeadingRegistry;
  embedIndex: EmbedRegistry;
  graphIndex: GraphIndex;
  unlinkedMentionIndex: UnlinkedMentionRegistry;
}

/**
 * Create a new empty AppState with all indices initialized.
 *
 * @returns A new AppState instance
 */
export function createAppState(): AppState {
  return {
    noteRegistry: new NoteRegistry(),
    peopleIndex: new PeopleRegistry(),
    tagIndex: new TagRegistry(),
    folderIndex: new FolderRegistry(),
    headingIndex: new HeadingRegistry(),
    embedIndex: new EmbedRegistry(),
    graphIndex: {
      nodes: new Map(),
      outgoing: new Map(),
      incoming: new Map(),
    },
    unlinkedMentionIndex: new UnlinkedMentionRegistry(),
  };
}

/**
 * Read-only view of AppState for safe access from UI and other subsystems.
 * All properties are the same as AppState but conceptually immutable from the consumer's perspective.
 */
export type ReadOnlyAppState = Readonly<AppState>;

/**
 * Get a read-only view of the AppState.
 * Note: TypeScript readonly is shallow, so consumers must not mutate the underlying indices.
 *
 * @param state - The mutable AppState
 * @returns A read-only view of the state
 */
export function asReadOnly(state: AppState): ReadOnlyAppState {
  return state as ReadOnlyAppState;
}

/**
 * Clear all data from the AppState.
 * Useful for testing or resetting the application.
 *
 * @param state - The AppState to clear
 */
export function clearAppState(state: AppState): void {
  state.noteRegistry.clear();
  state.peopleIndex.clear();
  state.tagIndex.clear();
  state.folderIndex.clear();
  state.headingIndex.clear();
  state.embedIndex.clear();
  state.unlinkedMentionIndex.clear();

  // Clear graph index
  state.graphIndex.nodes.clear();
  state.graphIndex.outgoing.clear();
  state.graphIndex.incoming.clear();
}

/**
 * Get basic statistics about the AppState.
 *
 * @param state - The AppState
 * @returns Statistics object with counts of each entity type
 */
export function getAppStateStats(state: ReadOnlyAppState) {
  return {
    notes: state.noteRegistry.size,
    people: state.peopleIndex.size,
    tags: state.tagIndex.size,
    folders: state.folderIndex.size,
    headings: state.headingIndex.size,
    embeds: state.embedIndex.size,
    graphNodes: state.graphIndex.nodes.size,
    unlinkedMentions: state.unlinkedMentionIndex.size,
  };
}

/**
 * Validate AppState consistency invariants.
 * Checks for common integrity issues between indices.
 *
 * @param state - The AppState to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateAppState(state: ReadOnlyAppState): string[] {
  const errors: string[] = [];

  // Validate that all notes referenced in indices exist in the note registry
  const allNoteIds = new Set(state.noteRegistry.byId.keys());

  // Check tag index
  for (const noteId of state.tagIndex.tagsByNote.keys()) {
    if (!allNoteIds.has(noteId)) {
      errors.push(`Tag index references non-existent note: ${noteId}`);
    }
  }

  // Check folder index
  for (const noteId of [...state.folderIndex.notesByFolder.values()].flatMap((s) =>
    Array.from(s)
  )) {
    if (!allNoteIds.has(noteId)) {
      errors.push(`Folder index references non-existent note: ${noteId}`);
    }
  }

  // Check heading index
  for (const noteId of state.headingIndex.headingsByNote.keys()) {
    if (!allNoteIds.has(noteId)) {
      errors.push(`Heading index references non-existent note: ${noteId}`);
    }
  }

  // Check people mentions
  for (const noteId of state.peopleIndex.peopleByNote.keys()) {
    if (!allNoteIds.has(noteId)) {
      errors.push(`People index references non-existent note: ${noteId}`);
    }
  }

  // Check embed index
  for (const noteId of state.embedIndex.embedsBySourceNote.keys()) {
    if (!allNoteIds.has(noteId)) {
      errors.push(`Embed index (source) references non-existent note: ${noteId}`);
    }
  }

  // Check unlinked mentions
  for (const noteId of state.unlinkedMentionIndex.byNote.keys()) {
    if (!allNoteIds.has(noteId)) {
      errors.push(`Unlinked mention index references non-existent note: ${noteId}`);
    }
  }

  return errors;
}

/**
 * Query helpers for common read operations across the AppState.
 * These provide convenient access patterns for the UI and other consumers.
 */
export const AppStateQueries = {
  /**
   * Get a complete view of a note including all its relationships.
   */
  getNoteWithRelationships(state: ReadOnlyAppState, noteId: NoteId) {
    const note = state.noteRegistry.getNoteById(noteId);
    if (!note) return undefined;

    return {
      note,
      tags: Array.from(state.tagIndex.getTagsForNote(noteId))
        .map((tagId) => state.tagIndex.getTag(tagId))
        .filter(Boolean),
      headings: state.headingIndex
        .getHeadingsForNote(noteId)
        .map((hId) => state.headingIndex.getHeading(hId))
        .filter(Boolean),
      embeds: state.embedIndex
        .getEmbedsFromNote(noteId)
        .map((eId) => state.embedIndex.getEmbed(eId))
        .filter(Boolean),
      peopleMentioned: Array.from(state.peopleIndex.getPeopleForNote(noteId))
        .map((pId) => state.peopleIndex.getPerson(pId))
        .filter(Boolean),
      unlinkedMentions: state.unlinkedMentionIndex.getMentionsInNote(noteId),
    };
  },

  /**
   * Get all notes that reference a given note (backlinks).
   */
  getBacklinks(state: ReadOnlyAppState, noteId: NoteId): Set<NoteId> {
    const backlinks = new Set<NoteId>();

    // Notes that embed this note
    const embedIds = state.embedIndex.getEmbedsToNote(noteId);
    for (const embedId of embedIds) {
      const embed = state.embedIndex.getEmbed(embedId);
      if (embed) {
        backlinks.add(embed.sourceNoteId);
      }
    }

    // Notes with unlinked mentions
    const mentions = state.unlinkedMentionIndex.getMentionsOfNote(noteId);
    for (const mention of mentions) {
      backlinks.add(mention.noteId);
    }

    // TODO: Add graph-based backlinks when graph is implemented

    return backlinks;
  },

  /**
   * Get all notes in a specific folder (including subfolders if recursive).
   */
  getNotesInFolder(state: ReadOnlyAppState, folderId: string, recursive = false): ParsedNote[] {
    const noteIds = new Set<NoteId>();

    // Direct notes
    const directNotes = state.folderIndex.getNotesForFolder(folderId);
    for (const noteId of directNotes) {
      noteIds.add(noteId);
    }

    // Recursive: include all subfolder notes
    if (recursive) {
      const collectSubfolderNotes = (currentFolderId: string) => {
        const children = state.folderIndex.getChildrenForFolder(currentFolderId);
        for (const childFolderId of children) {
          const childNotes = state.folderIndex.getNotesForFolder(childFolderId);
          for (const noteId of childNotes) {
            noteIds.add(noteId);
          }
          collectSubfolderNotes(childFolderId);
        }
      };
      collectSubfolderNotes(folderId);
    }

    return Array.from(noteIds)
      .map((id) => state.noteRegistry.getNoteById(id))
      .filter((note): note is ParsedNote => note !== undefined);
  },
};
