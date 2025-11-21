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
 * Central registry of unlinked mentions for link suggestion.
 *
 * Unlinked mentions are discovered by scanning note plain text for note titles
 * that aren't already linked. This registry maintains bidirectional mappings
 * for efficient lookup both from source notes and target notes.
 *
 * Note: This index is typically recomputed during indexing passes rather than
 * incrementally maintained, as it depends on the full note registry state.
 */
export class UnlinkedMentionRegistry {
  /** Unlinked mentions in a note (outgoing): NoteId -> UnlinkedMention[] */
  readonly byNote: Map<NoteId, UnlinkedMention[]> = new Map();

  /** Notes that mention a target (incoming): NoteId -> UnlinkedMention[] */
  readonly byTarget: Map<NoteId, UnlinkedMention[]> = new Map();

  /**
   * Add unlinked mentions for a note.
   * Updates bidirectional mappings for efficient lookup.
   *
   * @param noteId - The note that contains the unlinked mentions
   * @param mentions - Array of unlinked mentions in the note
   */
  addMentionsForNote(noteId: NoteId, mentions: UnlinkedMention[]): void {
    // Store in byNote
    this.byNote.set(noteId, mentions);

    // Update byTarget for each mention
    for (const mention of mentions) {
      let targetMentions = this.byTarget.get(mention.candidateTargetId);
      if (!targetMentions) {
        targetMentions = [];
        this.byTarget.set(mention.candidateTargetId, targetMentions);
      }
      targetMentions.push(mention);
    }
  }

  /**
   * Update unlinked mentions for a note.
   * Replaces all existing mentions with new ones.
   *
   * @param noteId - The note to update
   * @param mentions - Array of new unlinked mentions
   */
  updateMentionsForNote(noteId: NoteId, mentions: UnlinkedMention[]): void {
    // Remove old mentions first
    this.removeMentionsForNote(noteId);

    // Add new mentions
    this.addMentionsForNote(noteId, mentions);
  }

  /**
   * Remove all unlinked mentions for a note.
   * Cleans up bidirectional mappings.
   *
   * @param noteId - The note whose mentions should be removed
   */
  removeMentionsForNote(noteId: NoteId): void {
    const mentions = this.byNote.get(noteId);
    if (!mentions) return;

    // Remove from byTarget
    for (const mention of mentions) {
      const targetMentions = this.byTarget.get(mention.candidateTargetId);
      if (targetMentions) {
        const idx = targetMentions.findIndex(
          (m) => m.noteId === noteId && m.candidateTargetId === mention.candidateTargetId
        );
        if (idx !== -1) {
          targetMentions.splice(idx, 1);
        }
        if (targetMentions.length === 0) {
          this.byTarget.delete(mention.candidateTargetId);
        }
      }
    }

    // Remove from byNote
    this.byNote.delete(noteId);
  }

  /**
   * Get all unlinked mentions in a specific note (outgoing).
   *
   * @param noteId - The note ID
   * @returns Array of unlinked mentions, or empty array if none
   */
  getMentionsInNote(noteId: NoteId): UnlinkedMention[] {
    return this.byNote.get(noteId) || [];
  }

  /**
   * Get all notes that have unlinked mentions of a target note (incoming).
   *
   * @param targetNoteId - The target note ID
   * @returns Array of unlinked mentions, or empty array if none
   */
  getMentionsOfNote(targetNoteId: NoteId): UnlinkedMention[] {
    return this.byTarget.get(targetNoteId) || [];
  }

  /**
   * Get all unlinked mentions across all notes.
   *
   * @returns Array of all unlinked mentions
   */
  getAllMentions(): UnlinkedMention[] {
    const allMentions: UnlinkedMention[] = [];
    for (const mentions of this.byNote.values()) {
      allMentions.push(...mentions);
    }
    return allMentions;
  }

  /**
   * Get the total number of notes with unlinked mentions.
   */
  get size(): number {
    return this.byNote.size;
  }

  /**
   * Clear all unlinked mentions from the registry.
   */
  clear(): void {
    this.byNote.clear();
    this.byTarget.clear();
  }

  /**
   * Recompute all unlinked mentions from scratch.
   * This is typically called during full indexing passes.
   *
   * @param mentionsMap - Map of NoteId -> UnlinkedMention[]
   */
  recompute(mentionsMap: Map<NoteId, UnlinkedMention[]>): void {
    this.clear();

    for (const [noteId, mentions] of mentionsMap.entries()) {
      this.addMentionsForNote(noteId, mentions);
    }
  }
}

/**
 * Type alias for backwards compatibility with architecture docs.
 */
export type UnlinkedMentionIndex = UnlinkedMentionRegistry;
