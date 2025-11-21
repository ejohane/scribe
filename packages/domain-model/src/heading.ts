/**
 * Heading-related types and models.
 */

import type { HeadingId, NoteId } from './primitives.js';
import { normalizeHeading } from '@scribe/utils';

/**
 * Heading entity within a note.
 */
export interface Heading {
  id: HeadingId; // e.g. "note:notes/Plan.md#goals-and-scope"
  noteId: NoteId;
  level: number;
  text: string;
  normalized: string; // for matching [[Note#Heading]]
  line: number;
}

/**
 * Parsed heading data from the parser.
 */
export interface ParsedHeading {
  level: number;
  text: string;
  line: number;
}

/**
 * Central registry of all heading entities within notes.
 *
 * Provides efficient lookup by heading ID and mappings from notes to their headings,
 * with automatic normalization for anchor matching.
 */
export class HeadingRegistry {
  /** Primary index: HeadingId -> Heading */
  readonly byId: Map<HeadingId, Heading> = new Map();

  /** Headings in a note (ordered): NoteId -> HeadingId[] */
  readonly headingsByNote: Map<NoteId, HeadingId[]> = new Map();

  /**
   * Add headings from a note to the registry.
   * Creates heading entities with proper IDs and normalization.
   *
   * @param noteId - The note that contains the headings
   * @param headings - Array of parsed headings from the note
   */
  addHeadingsForNote(noteId: NoteId, headings: ParsedHeading[]): void {
    const headingIds: HeadingId[] = [];

    for (const heading of headings) {
      const normalized = normalizeHeading(heading.text);
      const headingId = `${noteId}#${normalized}` as HeadingId;

      const headingEntity: Heading = {
        id: headingId,
        noteId,
        level: heading.level,
        text: heading.text,
        normalized,
        line: heading.line,
      };

      this.byId.set(headingId, headingEntity);
      headingIds.push(headingId);
    }

    // Maintain order
    this.headingsByNote.set(noteId, headingIds);
  }

  /**
   * Update headings for a note.
   * Replaces all existing headings with new ones.
   *
   * @param noteId - The note to update
   * @param headings - Array of new parsed headings
   */
  updateHeadingsForNote(noteId: NoteId, headings: ParsedHeading[]): void {
    // Remove old headings first
    this.removeHeadingsForNote(noteId);

    // Add new headings
    this.addHeadingsForNote(noteId, headings);
  }

  /**
   * Remove all headings associated with a note.
   *
   * @param noteId - The note whose headings should be removed
   */
  removeHeadingsForNote(noteId: NoteId): void {
    const headingIds = this.headingsByNote.get(noteId);
    if (!headingIds) return;

    // Remove from byId
    for (const headingId of headingIds) {
      this.byId.delete(headingId);
    }

    // Remove from headingsByNote
    this.headingsByNote.delete(noteId);
  }

  /**
   * Get a heading by its ID.
   *
   * @param headingId - The heading ID (noteId#normalized-heading)
   * @returns The heading entity, or undefined if not found
   */
  getHeading(headingId: HeadingId): Heading | undefined {
    return this.byId.get(headingId);
  }

  /**
   * Get all headings for a specific note (in order).
   *
   * @param noteId - The note ID
   * @returns Array of heading IDs, or empty array if note has no headings
   */
  getHeadingsForNote(noteId: NoteId): HeadingId[] {
    return this.headingsByNote.get(noteId) || [];
  }

  /**
   * Find a heading by note ID and normalized heading text.
   * Used for resolving [[Note#Heading]] links.
   *
   * @param noteId - The note ID
   * @param normalizedHeading - The normalized heading text
   * @returns The heading entity, or undefined if not found
   */
  findHeadingByNormalized(noteId: NoteId, normalizedHeading: string): Heading | undefined {
    const headingId = `${noteId}#${normalizedHeading}` as HeadingId;
    return this.byId.get(headingId);
  }

  /**
   * Get all headings.
   *
   * @returns Array of all heading entities
   */
  getAllHeadings(): Heading[] {
    return Array.from(this.byId.values());
  }

  /**
   * Get the total number of headings.
   */
  get size(): number {
    return this.byId.size;
  }

  /**
   * Clear all headings from the registry.
   */
  clear(): void {
    this.byId.clear();
    this.headingsByNote.clear();
  }
}

/**
 * Type alias for backwards compatibility with architecture docs.
 */
export type HeadingIndex = HeadingRegistry;
