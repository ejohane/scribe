/**
 * Tag-related types and models.
 */

import type { TagId, NoteId } from './primitives.js';
import { normalizeTag } from '@scribe/utils';

/**
 * Tag entity.
 */
export interface Tag {
  id: TagId;
  name: string; // original tag text
  usageCount: number;
}

/**
 * Central registry of all tag entities and their relationships to notes.
 *
 * Provides efficient lookup and bidirectional mappings between tags and notes,
 * with automatic usage count maintenance.
 */
export class TagRegistry {
  /** Primary index: TagId -> Tag */
  readonly tags: Map<TagId, Tag> = new Map();

  /** Notes that use a tag: TagId -> Set<NoteId> */
  readonly notesByTag: Map<TagId, Set<NoteId>> = new Map();

  /** Tags used by a note: NoteId -> Set<TagId> */
  readonly tagsByNote: Map<NoteId, Set<TagId>> = new Map();

  /**
   * Add tags from a note to the registry.
   * Creates tag entities if they don't exist and updates bidirectional mappings.
   *
   * @param noteId - The note that contains the tags
   * @param tagNames - Array of tag names (will be normalized)
   */
  addTagsForNote(noteId: NoteId, tagNames: string[]): void {
    const tagIds = new Set<TagId>();

    for (const tagName of tagNames) {
      const tagId = normalizeTag(tagName);
      tagIds.add(tagId);

      // Create tag entity if it doesn't exist
      if (!this.tags.has(tagId)) {
        this.tags.set(tagId, {
          id: tagId,
          name: tagName, // preserve original casing
          usageCount: 0,
        });
      }

      // Add to notesByTag
      let notes = this.notesByTag.get(tagId);
      if (!notes) {
        notes = new Set();
        this.notesByTag.set(tagId, notes);
      }
      notes.add(noteId);

      // Increment usage count
      const tag = this.tags.get(tagId)!;
      tag.usageCount++;
    }

    // Update tagsByNote
    this.tagsByNote.set(noteId, tagIds);
  }

  /**
   * Update tags for a note.
   * Handles tag removals and additions efficiently.
   *
   * @param noteId - The note to update
   * @param newTagNames - Array of new tag names (will be normalized)
   */
  updateTagsForNote(noteId: NoteId, newTagNames: string[]): void {
    // Remove old tags first
    this.removeTagsForNote(noteId);

    // Add new tags
    this.addTagsForNote(noteId, newTagNames);
  }

  /**
   * Remove all tags associated with a note.
   * Cleans up tag entities with zero usage count.
   *
   * @param noteId - The note whose tags should be removed
   */
  removeTagsForNote(noteId: NoteId): void {
    const tagIds = this.tagsByNote.get(noteId);
    if (!tagIds) return;

    for (const tagId of tagIds) {
      // Remove from notesByTag
      const notes = this.notesByTag.get(tagId);
      if (notes) {
        notes.delete(noteId);
        if (notes.size === 0) {
          this.notesByTag.delete(tagId);
        }
      }

      // Decrement usage count and clean up if zero
      const tag = this.tags.get(tagId);
      if (tag) {
        tag.usageCount--;
        if (tag.usageCount <= 0) {
          this.tags.delete(tagId);
        }
      }
    }

    // Remove from tagsByNote
    this.tagsByNote.delete(noteId);
  }

  /**
   * Get a tag by its ID.
   *
   * @param tagId - The tag ID (normalized)
   * @returns The tag entity, or undefined if not found
   */
  getTag(tagId: TagId): Tag | undefined {
    return this.tags.get(tagId);
  }

  /**
   * Get all notes that use a specific tag.
   *
   * @param tagId - The tag ID (normalized)
   * @returns Set of note IDs, or empty set if tag not found
   */
  getNotesForTag(tagId: TagId): Set<NoteId> {
    return this.notesByTag.get(tagId) || new Set();
  }

  /**
   * Get all tags used by a specific note.
   *
   * @param noteId - The note ID
   * @returns Set of tag IDs, or empty set if note has no tags
   */
  getTagsForNote(noteId: NoteId): Set<TagId> {
    return this.tagsByNote.get(noteId) || new Set();
  }

  /**
   * Get all tags sorted by usage count (descending).
   *
   * @returns Array of all tag entities
   */
  getAllTags(): Tag[] {
    return Array.from(this.tags.values()).sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get the total number of unique tags.
   */
  get size(): number {
    return this.tags.size;
  }

  /**
   * Clear all tags from the registry.
   */
  clear(): void {
    this.tags.clear();
    this.notesByTag.clear();
    this.tagsByNote.clear();
  }
}

/**
 * Type alias for backwards compatibility with architecture docs.
 */
export type TagIndex = TagRegistry;
