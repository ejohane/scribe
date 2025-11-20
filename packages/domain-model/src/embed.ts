/**
 * Embed-related types and models.
 */

import type { EmbedId, NoteId } from './primitives.js';

/**
 * Embed entity pointing to other notes.
 */
export interface Embed {
  id: EmbedId; // unique ID for this embed
  sourceNoteId: NoteId; // note that includes the embed
  targetNoteId?: NoteId; // resolved note, if any
  rawText: string; // original embed text, e.g., "![[Plan]]"
  line: number; // line number in source note
}

/**
 * Parsed embed data from the parser.
 */
export interface ParsedEmbed {
  rawText: string;
  line: number;
}

/**
 * Central registry of all embed entities and their relationships.
 *
 * Provides efficient bidirectional lookup between source notes (notes that embed)
 * and target notes (notes being embedded), with support for unresolved embeds.
 */
export class EmbedRegistry {
  /** Primary index: EmbedId -> Embed */
  private readonly byId: Map<EmbedId, Embed> = new Map();

  /** Embeds in a note (by source): NoteId -> EmbedId[] */
  readonly embedsBySourceNote: Map<NoteId, EmbedId[]> = new Map();

  /** Embeds pointing to a note (by target): NoteId -> EmbedId[] */
  readonly embedsByTargetNote: Map<NoteId, EmbedId[]> = new Map();

  /** Counter for generating unique embed IDs */
  private embedCounter = 0;

  /**
   * Add embeds from a note to the registry.
   * Creates embed entities with unique IDs.
   *
   * @param sourceNoteId - The note that contains the embeds
   * @param embeds - Array of parsed embeds from the note
   */
  addEmbedsForNote(sourceNoteId: NoteId, embeds: ParsedEmbed[]): void {
    const embedIds: EmbedId[] = [];

    for (const embed of embeds) {
      const embedId = this._generateEmbedId(sourceNoteId);

      const embedEntity: Embed = {
        id: embedId,
        sourceNoteId,
        targetNoteId: undefined, // Will be resolved later
        rawText: embed.rawText,
        line: embed.line,
      };

      this.byId.set(embedId, embedEntity);
      embedIds.push(embedId);
    }

    // Update source mapping
    this.embedsBySourceNote.set(sourceNoteId, embedIds);
  }

  /**
   * Resolve an embed's target note.
   * Updates bidirectional mappings between source and target.
   *
   * @param embedId - The embed ID
   * @param targetNoteId - The resolved target note ID, or undefined if unresolved
   */
  resolveEmbed(embedId: EmbedId, targetNoteId: NoteId | undefined): void {
    const embed = this.byId.get(embedId);
    if (!embed) return;

    // Remove from old target mapping if exists
    if (embed.targetNoteId) {
      const targetEmbeds = this.embedsByTargetNote.get(embed.targetNoteId);
      if (targetEmbeds) {
        const idx = targetEmbeds.indexOf(embedId);
        if (idx !== -1) {
          targetEmbeds.splice(idx, 1);
        }
        if (targetEmbeds.length === 0) {
          this.embedsByTargetNote.delete(embed.targetNoteId);
        }
      }
    }

    // Update target
    embed.targetNoteId = targetNoteId;

    // Add to new target mapping if resolved
    if (targetNoteId) {
      let targetEmbeds = this.embedsByTargetNote.get(targetNoteId);
      if (!targetEmbeds) {
        targetEmbeds = [];
        this.embedsByTargetNote.set(targetNoteId, targetEmbeds);
      }
      targetEmbeds.push(embedId);
    }
  }

  /**
   * Update embeds for a note.
   * Replaces all existing embeds with new ones.
   *
   * @param sourceNoteId - The note to update
   * @param embeds - Array of new parsed embeds
   */
  updateEmbedsForNote(sourceNoteId: NoteId, embeds: ParsedEmbed[]): void {
    // Remove old embeds first
    this.removeEmbedsForNote(sourceNoteId);

    // Add new embeds
    this.addEmbedsForNote(sourceNoteId, embeds);
  }

  /**
   * Remove all embeds from a source note.
   * Cleans up all bidirectional mappings.
   *
   * @param sourceNoteId - The note whose embeds should be removed
   */
  removeEmbedsForNote(sourceNoteId: NoteId): void {
    const embedIds = this.embedsBySourceNote.get(sourceNoteId);
    if (!embedIds) return;

    for (const embedId of embedIds) {
      const embed = this.byId.get(embedId);
      if (embed) {
        // Remove from target mapping
        if (embed.targetNoteId) {
          const targetEmbeds = this.embedsByTargetNote.get(embed.targetNoteId);
          if (targetEmbeds) {
            const idx = targetEmbeds.indexOf(embedId);
            if (idx !== -1) {
              targetEmbeds.splice(idx, 1);
            }
            if (targetEmbeds.length === 0) {
              this.embedsByTargetNote.delete(embed.targetNoteId);
            }
          }
        }

        // Remove from primary index
        this.byId.delete(embedId);
      }
    }

    // Remove from source mapping
    this.embedsBySourceNote.delete(sourceNoteId);
  }

  /**
   * Get an embed by its ID.
   *
   * @param embedId - The embed ID
   * @returns The embed entity, or undefined if not found
   */
  getEmbed(embedId: EmbedId): Embed | undefined {
    return this.byId.get(embedId);
  }

  /**
   * Get all embeds from a specific source note.
   *
   * @param sourceNoteId - The source note ID
   * @returns Array of embed IDs, or empty array if note has no embeds
   */
  getEmbedsFromNote(sourceNoteId: NoteId): EmbedId[] {
    return this.embedsBySourceNote.get(sourceNoteId) || [];
  }

  /**
   * Get all embeds pointing to a specific target note.
   *
   * @param targetNoteId - The target note ID
   * @returns Array of embed IDs, or empty array if no embeds point to this note
   */
  getEmbedsToNote(targetNoteId: NoteId): EmbedId[] {
    return this.embedsByTargetNote.get(targetNoteId) || [];
  }

  /**
   * Get all embeds.
   *
   * @returns Array of all embed entities
   */
  getAllEmbeds(): Embed[] {
    return Array.from(this.byId.values());
  }

  /**
   * Get the total number of embeds.
   */
  get size(): number {
    return this.byId.size;
  }

  /**
   * Clear all embeds from the registry.
   */
  clear(): void {
    this.byId.clear();
    this.embedsBySourceNote.clear();
    this.embedsByTargetNote.clear();
    this.embedCounter = 0;
  }

  /**
   * Generate a unique embed ID.
   * Format: "embed:{sourceNoteId}:{counter}"
   *
   * @param sourceNoteId - The source note ID
   * @returns A unique embed ID
   */
  private _generateEmbedId(sourceNoteId: NoteId): EmbedId {
    return `embed:${sourceNoteId}:${this.embedCounter++}` as EmbedId;
  }
}

/**
 * Type alias for backwards compatibility with architecture docs.
 */
export type EmbedIndex = EmbedRegistry;
