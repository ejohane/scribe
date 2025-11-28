/**
 * GraphEngine Tests
 *
 * Tests for graph construction, edge management, and query operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphEngine } from './graph-engine.js';
import type { Note } from '@scribe/shared';

describe('GraphEngine', () => {
  let graph: GraphEngine;

  beforeEach(() => {
    graph = new GraphEngine();
  });

  describe('initialization', () => {
    it('should initialize with empty graph', () => {
      const stats = graph.getStats();
      expect(stats.nodes).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.tags).toBe(0);
    });
  });

  describe('addNote', () => {
    it('should add a note with no links or tags', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(1);
      expect(stats.edges).toBe(0);
      expect(stats.tags).toBe(0);
    });

    it('should add a note with tags', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['tag1', 'tag2'], links: [], mentions: [] },
      };

      graph.addNote(note);

      const withTag1 = graph.notesWithTag('tag1');
      const withTag2 = graph.notesWithTag('tag2');

      expect(withTag1).toHaveLength(1);
      expect(withTag1[0].id).toBe('note-1');
      expect(withTag2).toHaveLength(1);
      expect(withTag2[0].id).toBe('note-1');
    });

    it('should add a note with outgoing links', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2', 'note-3'], mentions: [] },
      };

      graph.addNote(note1);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(1);
      expect(stats.edges).toBe(2);
    });

    it('should update existing note', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['tag1'], links: ['note-2'], mentions: [] },
      };

      graph.addNote(note1);

      // Update with different tags and links
      const note1Updated: Note = {
        ...note1,
        metadata: { title: 'Note 1 Updated', tags: ['tag2'], links: ['note-3'], mentions: [] },
      };

      graph.addNote(note1Updated);

      // Old tag should be removed
      expect(graph.notesWithTag('tag1')).toHaveLength(0);
      // New tag should exist
      expect(graph.notesWithTag('tag2')).toHaveLength(1);

      const stats = graph.getStats();
      expect(stats.edges).toBe(1);
    });
  });

  describe('backlinks', () => {
    it('should return empty array for note with no backlinks', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note);

      const backlinks = graph.backlinks('note-1');
      expect(backlinks).toHaveLength(0);
    });

    it('should return backlinks for note', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      const backlinks = graph.backlinks('note-2');
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe('note-1');
      expect(backlinks[0].title).toBe('Note 1');
    });

    it('should return multiple backlinks', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-3'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: ['note-3'], mentions: [] },
      };

      const note3: Note = {
        id: 'note-3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 3', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);
      graph.addNote(note3);

      const backlinks = graph.backlinks('note-3');
      expect(backlinks).toHaveLength(2);

      const backlinkIds = backlinks.map((n) => n.id).sort();
      expect(backlinkIds).toEqual(['note-1', 'note-2']);
    });

    it('should update backlinks when note links change', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      expect(graph.backlinks('note-2')).toHaveLength(1);

      // Update note1 to link to note-3 instead
      const note1Updated: Note = {
        ...note1,
        metadata: { title: 'Note 1', tags: [], links: ['note-3'], mentions: [] },
      };

      graph.addNote(note1Updated);

      // note-2 should no longer have backlinks
      expect(graph.backlinks('note-2')).toHaveLength(0);
    });
  });

  describe('neighbors', () => {
    it('should return empty array for isolated note', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note);

      const neighbors = graph.neighbors('note-1');
      expect(neighbors).toHaveLength(0);
    });

    it('should return outgoing neighbors', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      const neighbors = graph.neighbors('note-1');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('note-2');
    });

    it('should return incoming neighbors', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      const neighbors = graph.neighbors('note-2');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('note-1');
    });

    it('should return both incoming and outgoing neighbors', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: ['note-3'], mentions: [] },
      };

      const note3: Note = {
        id: 'note-3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 3', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);
      graph.addNote(note3);

      const neighbors = graph.neighbors('note-2');
      expect(neighbors).toHaveLength(2);

      const neighborIds = neighbors.map((n) => n.id).sort();
      expect(neighborIds).toEqual(['note-1', 'note-3']);
    });

    it('should not duplicate bidirectional links', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: ['note-1'], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      const neighbors = graph.neighbors('note-1');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('note-2');
    });
  });

  describe('notesWithTag', () => {
    it('should return empty array for non-existent tag', () => {
      const notes = graph.notesWithTag('nonexistent');
      expect(notes).toHaveLength(0);
    });

    it('should return notes with tag', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['important'], links: [], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: ['important'], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      const notes = graph.notesWithTag('important');
      expect(notes).toHaveLength(2);

      const noteIds = notes.map((n) => n.id).sort();
      expect(noteIds).toEqual(['note-1', 'note-2']);
    });

    it('should update when tags change', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['old-tag'], links: [], mentions: [] },
      };

      graph.addNote(note);

      expect(graph.notesWithTag('old-tag')).toHaveLength(1);

      // Update tags
      const noteUpdated: Note = {
        ...note,
        metadata: { title: 'Note 1', tags: ['new-tag'], links: [], mentions: [] },
      };

      graph.addNote(noteUpdated);

      expect(graph.notesWithTag('old-tag')).toHaveLength(0);
      expect(graph.notesWithTag('new-tag')).toHaveLength(1);
    });
  });

  describe('getAllTags', () => {
    it('should return empty array when no tags', () => {
      const tags = graph.getAllTags();
      expect(tags).toHaveLength(0);
    });

    it('should return all unique tags sorted', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['zebra', 'apple'], links: [], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: ['banana', 'apple'], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      const tags = graph.getAllTags();
      expect(tags).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('removeNote', () => {
    it('should remove note and all its edges', () => {
      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['tag1'], links: ['note-2'], mentions: [] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note1);
      graph.addNote(note2);

      expect(graph.getStats().nodes).toBe(2);
      expect(graph.backlinks('note-2')).toHaveLength(1);

      graph.removeNote('note-1');

      expect(graph.getStats().nodes).toBe(1);
      expect(graph.backlinks('note-2')).toHaveLength(0);
      expect(graph.notesWithTag('tag1')).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all graph data', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: ['tag1'], links: ['note-2'], mentions: [] },
      };

      graph.addNote(note);

      expect(graph.getStats().nodes).toBe(1);

      graph.clear();

      const stats = graph.getStats();
      expect(stats.nodes).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.tags).toBe(0);
    });

    it('should clear person mention indexes', () => {
      const person: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: [], mentions: ['person-1'] },
      };

      graph.addNote(person);
      graph.addNote(note);

      expect(graph.notesMentioning('person-1')).toHaveLength(1);

      graph.clear();

      expect(graph.notesMentioning('person-1')).toHaveLength(0);
      expect(graph.peopleMentionedIn('note-1')).toHaveLength(0);
    });
  });

  describe('person mentions', () => {
    it('should track mentions - adding note updates mentioning/mentionedBy indexes', () => {
      const person: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Meeting Notes', tags: [], links: [], mentions: ['person-1'] },
      };

      graph.addNote(person);
      graph.addNote(note);

      // mentionedBy: person -> notes mentioning them
      expect(graph.notesMentioning('person-1')).toEqual(['note-1']);

      // mentioning: note -> people mentioned in it
      expect(graph.peopleMentionedIn('note-1')).toEqual(['person-1']);
    });

    it('should remove note cleans mentions - removing note clears mention relationships', () => {
      const person: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Meeting Notes', tags: [], links: [], mentions: ['person-1'] },
      };

      graph.addNote(person);
      graph.addNote(note);

      expect(graph.notesMentioning('person-1')).toHaveLength(1);

      graph.removeNote('note-1');

      expect(graph.notesMentioning('person-1')).toHaveLength(0);
    });

    it('should remove person cleans references - removing a person clears all mention-of references', () => {
      const person: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Meeting Notes', tags: [], links: [], mentions: ['person-1'] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Project Notes', tags: [], links: [], mentions: ['person-1'] },
      };

      graph.addNote(person);
      graph.addNote(note1);
      graph.addNote(note2);

      expect(graph.notesMentioning('person-1')).toHaveLength(2);
      expect(graph.peopleMentionedIn('note-1')).toContain('person-1');
      expect(graph.peopleMentionedIn('note-2')).toContain('person-1');

      // Remove the person
      graph.removeNote('person-1');

      // Person should no longer appear in mentions
      expect(graph.peopleMentionedIn('note-1')).not.toContain('person-1');
      expect(graph.peopleMentionedIn('note-2')).not.toContain('person-1');
    });

    it('should update mentions when note is updated', () => {
      const person1: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const person2: Note = {
        id: 'person-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Meeting Notes', tags: [], links: [], mentions: ['person-1'] },
      };

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(note);

      expect(graph.notesMentioning('person-1')).toEqual(['note-1']);
      expect(graph.notesMentioning('person-2')).toHaveLength(0);

      // Update note to mention person-2 instead
      const noteUpdated: Note = {
        ...note,
        metadata: { title: 'Meeting Notes', tags: [], links: [], mentions: ['person-2'] },
      };

      graph.addNote(noteUpdated);

      expect(graph.notesMentioning('person-1')).toHaveLength(0);
      expect(graph.notesMentioning('person-2')).toEqual(['note-1']);
      expect(graph.peopleMentionedIn('note-1')).toEqual(['person-2']);
    });

    it('should handle multiple mentions in one note', () => {
      const person1: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const person2: Note = {
        id: 'person-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: {
          title: 'Meeting Notes',
          tags: [],
          links: [],
          mentions: ['person-1', 'person-2'],
        },
      };

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(note);

      expect(graph.peopleMentionedIn('note-1').sort()).toEqual(['person-1', 'person-2']);
      expect(graph.notesMentioning('person-1')).toEqual(['note-1']);
      expect(graph.notesMentioning('person-2')).toEqual(['note-1']);
    });
  });

  describe('getAllPeople', () => {
    it('should return empty array when no people exist', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Regular Note', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note);

      const people = graph.getAllPeople();
      expect(people).toHaveLength(0);
    });

    it('should return only notes with type=person', () => {
      const person1: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const person2: Note = {
        id: 'person-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
      };

      const regularNote: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Regular Note', tags: [], links: [], mentions: [] },
      };

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(regularNote);

      const people = graph.getAllPeople();
      expect(people).toHaveLength(2);
      expect(people.sort()).toEqual(['person-1', 'person-2']);
    });

    it('should update when person is removed', () => {
      const person: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      graph.addNote(person);
      expect(graph.getAllPeople()).toHaveLength(1);

      graph.removeNote('person-1');
      expect(graph.getAllPeople()).toHaveLength(0);
    });
  });

  describe('notesMentioning', () => {
    it('should return empty array for non-existent person', () => {
      const notes = graph.notesMentioning('non-existent');
      expect(notes).toHaveLength(0);
    });

    it('should return correct notes for a person', () => {
      const person: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note1: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: [], mentions: ['person-1'] },
      };

      const note2: Note = {
        id: 'note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 2', tags: [], links: [], mentions: ['person-1'] },
      };

      const note3: Note = {
        id: 'note-3',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 3', tags: [], links: [], mentions: [] },
      };

      graph.addNote(person);
      graph.addNote(note1);
      graph.addNote(note2);
      graph.addNote(note3);

      const mentioningNotes = graph.notesMentioning('person-1');
      expect(mentioningNotes).toHaveLength(2);
      expect(mentioningNotes.sort()).toEqual(['note-1', 'note-2']);
    });
  });

  describe('peopleMentionedIn', () => {
    it('should return empty array for note with no mentions', () => {
      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: { title: 'Note 1', tags: [], links: [], mentions: [] },
      };

      graph.addNote(note);

      const people = graph.peopleMentionedIn('note-1');
      expect(people).toHaveLength(0);
    });

    it('should return correct people for a note', () => {
      const person1: Note = {
        id: 'person-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
      };

      const person2: Note = {
        id: 'person-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] }, type: 'person' },
        metadata: { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
      };

      const note: Note = {
        id: 'note-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        metadata: {
          title: 'Meeting Notes',
          tags: [],
          links: [],
          mentions: ['person-1', 'person-2'],
        },
      };

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(note);

      const people = graph.peopleMentionedIn('note-1');
      expect(people).toHaveLength(2);
      expect(people.sort()).toEqual(['person-1', 'person-2']);
    });

    it('should return empty array for non-existent note', () => {
      const people = graph.peopleMentionedIn('non-existent');
      expect(people).toHaveLength(0);
    });
  });
});
