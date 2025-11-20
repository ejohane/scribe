/**
 * Person-related types and models.
 */

import type { PersonId, NoteId, FilePath } from './primitives.js';

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
 * Index for people entities.
 */
export interface PeopleIndex {
  byId: Map<PersonId, Person>;
  byName: Map<string, PersonId>; // normalized person name -> PersonId
  mentionsByPerson: Map<PersonId, Set<NoteId>>;
  peopleByNote: Map<NoteId, Set<PersonId>>;
}
