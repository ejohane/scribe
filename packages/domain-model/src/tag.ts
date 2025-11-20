/**
 * Tag-related types and models.
 */

import type { TagId, NoteId } from './primitives.js';

/**
 * Tag entity.
 */
export interface Tag {
  id: TagId;
  name: string; // original tag text
  usageCount: number;
}

/**
 * Index for tag entities.
 */
export interface TagIndex {
  tags: Map<TagId, Tag>;
  notesByTag: Map<TagId, Set<NoteId>>;
  tagsByNote: Map<NoteId, Set<TagId>>;
}
