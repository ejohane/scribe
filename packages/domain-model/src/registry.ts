/**
 * Note registry and related types.
 */

import type { NoteId, FilePath } from './primitives.js';
import type { ParsedNote } from './note.js';

/**
 * Central registry of all note-like entities (including person notes).
 *
 * Provides efficient lookup by ID, path, title, and aliases, with automatic
 * index maintenance on add/update/remove operations.
 */
export class NoteRegistry {
  /** Primary index: NoteId -> ParsedNote */
  readonly byId: Map<NoteId, ParsedNote> = new Map();

  /** Path index: FilePath -> NoteId */
  readonly byPath: Map<FilePath, NoteId> = new Map();

  /** Title index: normalized title -> Set<NoteId> (supports duplicate titles) */
  readonly byTitle: Map<string, Set<NoteId>> = new Map();

  /** Alias index: normalized alias -> Set<NoteId> (multiple notes can share aliases) */
  readonly byAlias: Map<string, Set<NoteId>> = new Map();

  /**
   * Add a new note to the registry.
   * Updates all indices: byId, byPath, byTitle, byAlias.
   *
   * @param note - The parsed note to register
   * @throws Error if a note with the same ID or path already exists
   */
  add(note: ParsedNote): void {
    if (this.byId.has(note.id)) {
      throw new Error(`Note with ID ${note.id} already exists`);
    }
    if (this.byPath.has(note.path)) {
      throw new Error(`Note with path ${note.path} already exists`);
    }

    // Add to primary index
    this.byId.set(note.id, note);

    // Add to path index
    this.byPath.set(note.path, note.id);

    // Add to title index
    this._addToTitleIndex(note);

    // Add to alias index
    this._addToAliasIndex(note);
  }

  /**
   * Update an existing note in the registry.
   * Handles title/alias changes by recomputing indices.
   *
   * @param note - The updated note
   * @throws Error if the note doesn't exist
   */
  update(note: ParsedNote): void {
    const existingNote = this.byId.get(note.id);
    if (!existingNote) {
      throw new Error(`Note with ID ${note.id} not found`);
    }

    // Remove old title/alias indices
    this._removeFromTitleIndex(existingNote);
    this._removeFromAliasIndex(existingNote);

    // Handle path changes
    if (existingNote.path !== note.path) {
      this.byPath.delete(existingNote.path);
      this.byPath.set(note.path, note.id);
    }

    // Update primary index
    this.byId.set(note.id, note);

    // Add new title/alias indices
    this._addToTitleIndex(note);
    this._addToAliasIndex(note);
  }

  /**
   * Remove a note from the registry.
   * Cleans up all indices: byId, byPath, byTitle, byAlias.
   *
   * @param noteId - The ID of the note to remove
   * @throws Error if the note doesn't exist
   */
  remove(noteId: NoteId): void {
    const note = this.byId.get(noteId);
    if (!note) {
      throw new Error(`Note with ID ${noteId} not found`);
    }

    // Remove from all indices
    this.byId.delete(noteId);
    this.byPath.delete(note.path);
    this._removeFromTitleIndex(note);
    this._removeFromAliasIndex(note);
  }

  /**
   * Get a note by its ID.
   *
   * @param noteId - The note ID
   * @returns The parsed note, or undefined if not found
   */
  getNoteById(noteId: NoteId): ParsedNote | undefined {
    return this.byId.get(noteId);
  }

  /**
   * Get a note by its file path.
   *
   * @param path - The file path
   * @returns The parsed note, or undefined if not found
   */
  getNoteByPath(path: FilePath): ParsedNote | undefined {
    const noteId = this.byPath.get(path);
    return noteId ? this.byId.get(noteId) : undefined;
  }

  /**
   * Find notes by title (case-insensitive).
   *
   * @param title - The title to search for (will be normalized)
   * @returns Array of matching notes (empty if none found)
   */
  getNotesByTitle(title: string): ParsedNote[] {
    const normalizedTitle = this._normalizeForLookup(title);
    const noteIds = this.byTitle.get(normalizedTitle);
    if (!noteIds) return [];

    return Array.from(noteIds)
      .map((id) => this.byId.get(id))
      .filter((note): note is ParsedNote => note !== undefined);
  }

  /**
   * Find notes by alias (case-insensitive).
   *
   * @param alias - The alias to search for (will be normalized)
   * @returns Array of matching notes (empty if none found)
   */
  getNotesByAlias(alias: string): ParsedNote[] {
    const normalizedAlias = this._normalizeForLookup(alias);
    const noteIds = this.byAlias.get(normalizedAlias);
    if (!noteIds) return [];

    return Array.from(noteIds)
      .map((id) => this.byId.get(id))
      .filter((note): note is ParsedNote => note !== undefined);
  }

  /**
   * Get all notes in the registry.
   *
   * @returns Array of all parsed notes
   */
  getAllNotes(): ParsedNote[] {
    return Array.from(this.byId.values());
  }

  /**
   * Get the total number of notes in the registry.
   */
  get size(): number {
    return this.byId.size;
  }

  /**
   * Clear all notes from the registry.
   */
  clear(): void {
    this.byId.clear();
    this.byPath.clear();
    this.byTitle.clear();
    this.byAlias.clear();
  }

  // Private helper methods

  private _normalizeForLookup(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private _addToTitleIndex(note: ParsedNote): void {
    const normalizedTitle = this._normalizeForLookup(note.resolvedTitle);
    let noteIds = this.byTitle.get(normalizedTitle);
    if (!noteIds) {
      noteIds = new Set();
      this.byTitle.set(normalizedTitle, noteIds);
    }
    noteIds.add(note.id);
  }

  private _removeFromTitleIndex(note: ParsedNote): void {
    const normalizedTitle = this._normalizeForLookup(note.resolvedTitle);
    const noteIds = this.byTitle.get(normalizedTitle);
    if (noteIds) {
      noteIds.delete(note.id);
      if (noteIds.size === 0) {
        this.byTitle.delete(normalizedTitle);
      }
    }
  }

  private _addToAliasIndex(note: ParsedNote): void {
    for (const alias of note.aliases) {
      const normalizedAlias = this._normalizeForLookup(alias);
      let noteIds = this.byAlias.get(normalizedAlias);
      if (!noteIds) {
        noteIds = new Set();
        this.byAlias.set(normalizedAlias, noteIds);
      }
      noteIds.add(note.id);
    }
  }

  private _removeFromAliasIndex(note: ParsedNote): void {
    for (const alias of note.aliases) {
      const normalizedAlias = this._normalizeForLookup(alias);
      const noteIds = this.byAlias.get(normalizedAlias);
      if (noteIds) {
        noteIds.delete(note.id);
        if (noteIds.size === 0) {
          this.byAlias.delete(normalizedAlias);
        }
      }
    }
  }
}
