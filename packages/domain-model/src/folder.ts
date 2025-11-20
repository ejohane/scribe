/**
 * Folder-related types and models.
 */

import type { FolderId, NoteId } from './primitives.js';

/**
 * Folder entity derived from file paths.
 */
export interface Folder {
  id: FolderId; // e.g. "notes/2025"
  name: string; // last segment: "2025"
  parentId?: FolderId; // undefined for root
  path: string; // normalized folder path
}

/**
 * Index for folder entities.
 */
export interface FolderIndex {
  folders: Map<FolderId, Folder>;
  childrenByFolder: Map<FolderId, Set<FolderId>>;
  notesByFolder: Map<FolderId, Set<NoteId>>;
}
