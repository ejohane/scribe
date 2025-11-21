/**
 * Tests for PeopleRegistry.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { PeopleRegistry } from './person.js';
import type { PersonId, NoteId } from './primitives.js';
import type { Person } from './person.js';

describe('PeopleRegistry', () => {
  let registry: PeopleRegistry;

  beforeEach(() => {
    registry = new PeopleRegistry();
  });

  test('should add a person', () => {
    const person: Person = {
      id: 'Erik' as PersonId,
      noteId: 'note:people/Erik.md' as NoteId,
      path: 'people/Erik.md',
      name: 'Erik',
      metadata: { role: 'developer' },
    };

    registry.addPerson(person);

    expect(registry.size).toBe(1);
    expect(registry.getPerson('Erik' as PersonId)).toEqual(person);
  });

  test('should update a person', () => {
    const person: Person = {
      id: 'Erik' as PersonId,
      noteId: 'note:people/Erik.md' as NoteId,
      path: 'people/Erik.md',
      name: 'Erik',
      metadata: {},
    };

    registry.addPerson(person);

    const updatedPerson: Person = {
      ...person,
      name: 'Erik Johnson',
      metadata: { role: 'senior developer' },
    };

    registry.updatePerson(updatedPerson);

    expect(registry.size).toBe(1);
    expect(registry.getPerson('Erik' as PersonId)?.name).toBe('Erik Johnson');
  });

  test('should remove a person', () => {
    const person: Person = {
      id: 'Erik' as PersonId,
      noteId: 'note:people/Erik.md' as NoteId,
      path: 'people/Erik.md',
      name: 'Erik',
      metadata: {},
    };

    registry.addPerson(person);
    expect(registry.size).toBe(1);

    registry.removePerson('Erik' as PersonId);
    expect(registry.size).toBe(0);
    expect(registry.getPerson('Erik' as PersonId)).toBeUndefined();
  });

  test('should find person by name', () => {
    const person: Person = {
      id: 'Erik' as PersonId,
      noteId: 'note:people/Erik.md' as NoteId,
      path: 'people/Erik.md',
      name: 'Erik',
      metadata: {},
    };

    registry.addPerson(person);

    expect(registry.getPersonByName('Erik')).toEqual(person);
    expect(registry.getPersonByName('erik')).toBeUndefined(); // Case-sensitive in current implementation
  });

  test('should add person mentions for a note', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const personNames = ['Erik', 'Sarah'];

    registry.addMentionsForNote(noteId, personNames);

    expect(registry.getPeopleForNote(noteId)).toEqual(new Set(['Erik', 'Sarah']));
    expect(registry.getNotesForPerson('Erik' as PersonId)).toEqual(new Set([noteId]));
    expect(registry.getNotesForPerson('Sarah' as PersonId)).toEqual(new Set([noteId]));
  });

  test('should update person mentions for a note', () => {
    const noteId = 'note:Plan.md' as NoteId;

    registry.addMentionsForNote(noteId, ['Erik', 'Sarah']);
    expect(registry.getPeopleForNote(noteId)).toEqual(new Set(['Erik', 'Sarah']));

    registry.updateMentionsForNote(noteId, ['Erik', 'John']);
    expect(registry.getPeopleForNote(noteId)).toEqual(new Set(['Erik', 'John']));
    expect(registry.getNotesForPerson('Sarah' as PersonId)).toEqual(new Set()); // Sarah removed
  });

  test('should remove person mentions for a note', () => {
    const noteId = 'note:Plan.md' as NoteId;

    registry.addMentionsForNote(noteId, ['Erik', 'Sarah']);
    expect(registry.getPeopleForNote(noteId).size).toBe(2);

    registry.removeMentionsForNote(noteId);
    expect(registry.getPeopleForNote(noteId).size).toBe(0);
    expect(registry.getNotesForPerson('Erik' as PersonId).size).toBe(0);
  });

  test('should maintain bidirectional mappings for mentions', () => {
    const note1 = 'note:Plan.md' as NoteId;
    const note2 = 'note:Goals.md' as NoteId;

    registry.addMentionsForNote(note1, ['Erik', 'Sarah']);
    registry.addMentionsForNote(note2, ['Erik', 'John']);

    // Check peopleByNote
    expect(registry.getPeopleForNote(note1)).toEqual(new Set(['Erik', 'Sarah']));
    expect(registry.getPeopleForNote(note2)).toEqual(new Set(['Erik', 'John']));

    // Check mentionsByPerson
    expect(registry.getNotesForPerson('Erik' as PersonId)).toEqual(new Set([note1, note2]));
    expect(registry.getNotesForPerson('Sarah' as PersonId)).toEqual(new Set([note1]));
    expect(registry.getNotesForPerson('John' as PersonId)).toEqual(new Set([note2]));
  });

  test('should handle multiple mentions of same person in different notes', () => {
    const note1 = 'note:Plan.md' as NoteId;
    const note2 = 'note:Goals.md' as NoteId;
    const note3 = 'note:Review.md' as NoteId;

    registry.addMentionsForNote(note1, ['Erik']);
    registry.addMentionsForNote(note2, ['Erik']);
    registry.addMentionsForNote(note3, ['Erik']);

    expect(registry.getNotesForPerson('Erik' as PersonId)).toEqual(new Set([note1, note2, note3]));
  });

  test('should clean up empty mention sets', () => {
    const noteId = 'note:Plan.md' as NoteId;

    registry.addMentionsForNote(noteId, ['Erik']);
    expect(registry.getNotesForPerson('Erik' as PersonId).size).toBe(1);

    registry.removeMentionsForNote(noteId);
    expect(registry.getNotesForPerson('Erik' as PersonId).size).toBe(0);
  });

  test('should get all people sorted by name', () => {
    const person1: Person = {
      id: 'Zoe' as PersonId,
      noteId: 'note:people/Zoe.md' as NoteId,
      path: 'people/Zoe.md',
      name: 'Zoe',
      metadata: {},
    };

    const person2: Person = {
      id: 'Alice' as PersonId,
      noteId: 'note:people/Alice.md' as NoteId,
      path: 'people/Alice.md',
      name: 'Alice',
      metadata: {},
    };

    const person3: Person = {
      id: 'Bob' as PersonId,
      noteId: 'note:people/Bob.md' as NoteId,
      path: 'people/Bob.md',
      name: 'Bob',
      metadata: {},
    };

    registry.addPerson(person1);
    registry.addPerson(person2);
    registry.addPerson(person3);

    const allPeople = registry.getAllPeople();
    expect(allPeople).toHaveLength(3);
    expect(allPeople[0].name).toBe('Alice');
    expect(allPeople[1].name).toBe('Bob');
    expect(allPeople[2].name).toBe('Zoe');
  });

  test('should normalize person names', () => {
    const noteId = 'note:Plan.md' as NoteId;

    // Whitespace trimming
    registry.addMentionsForNote(noteId, ['  Erik  ', 'Erik', 'Erik']);

    // All should normalize to 'Erik'
    expect(registry.getPeopleForNote(noteId)).toEqual(new Set(['Erik']));
  });

  test('should update name lookup when person name changes', () => {
    const person: Person = {
      id: 'Erik' as PersonId,
      noteId: 'note:people/Erik.md' as NoteId,
      path: 'people/Erik.md',
      name: 'Erik',
      metadata: {},
    };

    registry.addPerson(person);
    expect(registry.getPersonByName('Erik')).toBeDefined();

    const updatedPerson: Person = {
      ...person,
      name: 'Erik Johnson',
    };

    registry.updatePerson(updatedPerson);
    expect(registry.getPersonByName('Erik')).toBeUndefined(); // Old name removed
    expect(registry.getPersonByName('Erik Johnson')).toBeDefined();
  });

  test('should clear all people and mentions', () => {
    const person: Person = {
      id: 'Erik' as PersonId,
      noteId: 'note:people/Erik.md' as NoteId,
      path: 'people/Erik.md',
      name: 'Erik',
      metadata: {},
    };

    registry.addPerson(person);
    registry.addMentionsForNote('note:Plan.md' as NoteId, ['Erik']);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAllPeople()).toHaveLength(0);
    expect(registry.getPeopleForNote('note:Plan.md' as NoteId).size).toBe(0);
  });
});
