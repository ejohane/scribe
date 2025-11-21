/**
 * Person-related types and models.
 */

import type { PersonId, NoteId, FilePath } from './primitives.js';
import { normalizePersonName } from '@scribe/utils';

/**
 * Person entity.
 * Persons are represented both as notes (files in `people/`) and as a typed entity.
 */
export interface Person {
  id: PersonId; // canonical name, e.g. "Erik"
  noteId: NoteId; // associated note/entity (people/Erik.md)
  path: FilePath; // "people/Erik.md"
  name: string; // display name (from title or frontmatter)
  metadata: Record<string, unknown>; // derived from frontmatter
}

/**
 * Central registry of all person entities and their mentions.
 *
 * Provides efficient lookup by person ID and name, with bidirectional mappings
 * between people and the notes that mention them.
 */
export class PeopleRegistry {
  /** Primary index: PersonId -> Person */
  readonly byId: Map<PersonId, Person> = new Map();

  /** Name lookup: normalized name -> PersonId */
  readonly byName: Map<string, PersonId> = new Map();

  /** Notes that mention a person: PersonId -> Set<NoteId> */
  readonly mentionsByPerson: Map<PersonId, Set<NoteId>> = new Map();

  /** People mentioned in a note: NoteId -> Set<PersonId> */
  readonly peopleByNote: Map<NoteId, Set<PersonId>> = new Map();

  /**
   * Add or update a person entity.
   * Creates a person from a note (typically from `people/` folder).
   *
   * @param person - The person entity to add
   */
  addPerson(person: Person): void {
    // Add to primary index
    this.byId.set(person.id, person);

    // Add to name lookup
    const normalizedName = this._normalizeName(person.name);
    this.byName.set(normalizedName, person.id);
  }

  /**
   * Update a person entity.
   * Handles name changes by updating the name lookup index.
   *
   * @param person - The updated person entity
   */
  updatePerson(person: Person): void {
    const existingPerson = this.byId.get(person.id);
    if (existingPerson) {
      // Remove old name mapping if name changed
      if (existingPerson.name !== person.name) {
        const oldNormalizedName = this._normalizeName(existingPerson.name);
        this.byName.delete(oldNormalizedName);
      }
    }

    // Add/update person
    this.addPerson(person);
  }

  /**
   * Remove a person entity.
   * Note: Does not remove mention mappings - those are managed separately.
   *
   * @param personId - The person ID to remove
   */
  removePerson(personId: PersonId): void {
    const person = this.byId.get(personId);
    if (!person) return;

    // Remove from name lookup
    const normalizedName = this._normalizeName(person.name);
    this.byName.delete(normalizedName);

    // Remove from primary index
    this.byId.delete(personId);
  }

  /**
   * Add person mentions from a note.
   * Updates bidirectional mappings between people and notes.
   *
   * @param noteId - The note that contains the mentions
   * @param personNames - Array of person names mentioned in the note
   */
  addMentionsForNote(noteId: NoteId, personNames: string[]): void {
    const personIds = new Set<PersonId>();

    for (const personName of personNames) {
      const normalizedName = this._normalizeName(personName);
      const personId = normalizedName as PersonId; // PersonId is the normalized name

      personIds.add(personId);

      // Add to mentionsByPerson
      let notes = this.mentionsByPerson.get(personId);
      if (!notes) {
        notes = new Set();
        this.mentionsByPerson.set(personId, notes);
      }
      notes.add(noteId);
    }

    // Update peopleByNote
    this.peopleByNote.set(noteId, personIds);
  }

  /**
   * Update person mentions for a note.
   * Replaces all existing mentions with new ones.
   *
   * @param noteId - The note to update
   * @param personNames - Array of new person names
   */
  updateMentionsForNote(noteId: NoteId, personNames: string[]): void {
    // Remove old mentions first
    this.removeMentionsForNote(noteId);

    // Add new mentions
    this.addMentionsForNote(noteId, personNames);
  }

  /**
   * Remove all person mentions from a note.
   * Cleans up bidirectional mappings.
   *
   * @param noteId - The note whose mentions should be removed
   */
  removeMentionsForNote(noteId: NoteId): void {
    const personIds = this.peopleByNote.get(noteId);
    if (!personIds) return;

    for (const personId of personIds) {
      // Remove from mentionsByPerson
      const notes = this.mentionsByPerson.get(personId);
      if (notes) {
        notes.delete(noteId);
        if (notes.size === 0) {
          this.mentionsByPerson.delete(personId);
        }
      }
    }

    // Remove from peopleByNote
    this.peopleByNote.delete(noteId);
  }

  /**
   * Get a person by their ID.
   *
   * @param personId - The person ID
   * @returns The person entity, or undefined if not found
   */
  getPerson(personId: PersonId): Person | undefined {
    return this.byId.get(personId);
  }

  /**
   * Find a person by their name (case-insensitive).
   *
   * @param name - The person name (will be normalized)
   * @returns The person entity, or undefined if not found
   */
  getPersonByName(name: string): Person | undefined {
    const normalizedName = this._normalizeName(name);
    const personId = this.byName.get(normalizedName);
    return personId ? this.byId.get(personId) : undefined;
  }

  /**
   * Get all notes that mention a specific person.
   *
   * @param personId - The person ID
   * @returns Set of note IDs, or empty set if no mentions
   */
  getNotesForPerson(personId: PersonId): Set<NoteId> {
    return this.mentionsByPerson.get(personId) || new Set();
  }

  /**
   * Get all people mentioned in a specific note.
   *
   * @param noteId - The note ID
   * @returns Set of person IDs, or empty set if no mentions
   */
  getPeopleForNote(noteId: NoteId): Set<PersonId> {
    return this.peopleByNote.get(noteId) || new Set();
  }

  /**
   * Get all people sorted by name.
   *
   * @returns Array of all person entities
   */
  getAllPeople(): Person[] {
    return Array.from(this.byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get the total number of people.
   */
  get size(): number {
    return this.byId.size;
  }

  /**
   * Clear all people and mentions from the registry.
   */
  clear(): void {
    this.byId.clear();
    this.byName.clear();
    this.mentionsByPerson.clear();
    this.peopleByNote.clear();
  }

  /**
   * Normalize a person name for lookups.
   * Uses the normalizePersonName utility from @scribe/utils.
   *
   * @param name - The person name
   * @returns Normalized name (trimmed, preserving case)
   */
  private _normalizeName(name: string): string {
    return normalizePersonName(name);
  }
}

/**
 * Type alias for backwards compatibility with architecture docs.
 */
export type PeopleIndex = PeopleRegistry;
