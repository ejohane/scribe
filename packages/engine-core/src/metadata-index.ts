/**
 * Metadata Index
 *
 * In-memory indexes for fast metadata lookups
 */

import type { NoteId, NoteMetadata } from '@scribe/shared';

/**
 * In-memory metadata indexes
 *
 * Maintains fast lookup structures for:
 * - Note metadata by note ID
 * - Notes by tag
 * - Backlinks (incoming links) by note ID
 */
export class MetadataIndex {
  /**
   * Metadata by note ID
   */
  private byNote: Map<NoteId, NoteMetadata> = new Map();

  /**
   * Note IDs by tag
   */
  private byTag: Map<string, Set<NoteId>> = new Map();

  /**
   * Backlinks (incoming links) by note ID
   */
  private byLink: Map<NoteId, Set<NoteId>> = new Map();

  /**
   * Add or update metadata for a note
   *
   * @param noteId - Note ID
   * @param metadata - Note metadata
   */
  set(noteId: NoteId, metadata: NoteMetadata): void {
    // Remove old metadata if exists
    this.delete(noteId);

    // Store metadata
    this.byNote.set(noteId, metadata);

    // Index by tags
    for (const tag of metadata.tags) {
      if (!this.byTag.has(tag)) {
        this.byTag.set(tag, new Set());
      }
      this.byTag.get(tag)!.add(noteId);
    }

    // Index backlinks (outgoing links from this note)
    for (const linkedNoteId of metadata.links) {
      if (!this.byLink.has(linkedNoteId)) {
        this.byLink.set(linkedNoteId, new Set());
      }
      this.byLink.get(linkedNoteId)!.add(noteId);
    }
  }

  /**
   * Get metadata for a note
   *
   * @param noteId - Note ID
   * @returns Metadata or undefined if not found
   */
  get(noteId: NoteId): NoteMetadata | undefined {
    return this.byNote.get(noteId);
  }

  /**
   * Delete metadata for a note
   *
   * @param noteId - Note ID
   */
  delete(noteId: NoteId): void {
    const metadata = this.byNote.get(noteId);
    if (!metadata) {
      return;
    }

    // Remove from tag index
    for (const tag of metadata.tags) {
      const notesWithTag = this.byTag.get(tag);
      if (notesWithTag) {
        notesWithTag.delete(noteId);
        if (notesWithTag.size === 0) {
          this.byTag.delete(tag);
        }
      }
    }

    // Remove from backlink index
    for (const linkedNoteId of metadata.links) {
      const backlinks = this.byLink.get(linkedNoteId);
      if (backlinks) {
        backlinks.delete(noteId);
        if (backlinks.size === 0) {
          this.byLink.delete(linkedNoteId);
        }
      }
    }

    // Remove metadata
    this.byNote.delete(noteId);
  }

  /**
   * Get all notes with a specific tag
   *
   * @param tag - Tag name (without # prefix)
   * @returns Array of note IDs
   */
  getNotesWithTag(tag: string): NoteId[] {
    const notes = this.byTag.get(tag);
    return notes ? Array.from(notes) : [];
  }

  /**
   * Get all backlinks for a note
   *
   * @param noteId - Note ID
   * @returns Array of note IDs that link to this note
   */
  getBacklinks(noteId: NoteId): NoteId[] {
    const backlinks = this.byLink.get(noteId);
    return backlinks ? Array.from(backlinks) : [];
  }

  /**
   * Get all unique tags
   *
   * @returns Array of all tags
   */
  getAllTags(): string[] {
    return Array.from(this.byTag.keys()).sort();
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.byNote.clear();
    this.byTag.clear();
    this.byLink.clear();
  }

  /**
   * Get total number of indexed notes
   *
   * @returns Count of indexed notes
   */
  size(): number {
    return this.byNote.size;
  }
}
