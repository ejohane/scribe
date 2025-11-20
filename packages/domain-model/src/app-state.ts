/**
 * Application state aggregation.
 */

import type { NoteRegistry } from './registry.js';
import type { PeopleIndex } from './person.js';
import type { TagIndex } from './tag.js';
import type { FolderIndex } from './folder.js';
import type { HeadingIndex } from './heading.js';
import type { EmbedIndex } from './embed.js';
import type { GraphIndex } from './graph.js';
import type { UnlinkedMentionIndex } from './unlinked-mentions.js';

/**
 * Central application state aggregating all indices.
 * This is exposed as read-only to the UI and other subsystems,
 * with mutations funneled through the Indexing System.
 */
export interface AppState {
  noteRegistry: NoteRegistry;
  peopleIndex: PeopleIndex;
  tagIndex: TagIndex;
  folderIndex: FolderIndex;
  headingIndex: HeadingIndex;
  embedIndex: EmbedIndex;
  graphIndex: GraphIndex;
  unlinkedMentionIndex: UnlinkedMentionIndex;
}
