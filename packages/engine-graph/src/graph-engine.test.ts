/**
 * GraphEngine Tests
 *
 * Tests for graph construction, edge management, and query operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphEngine } from './graph-engine.js';
import type { Note, NoteMetadata, NoteType } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

/**
 * Shorthand alias for createNoteId to keep test code concise.
 * Usage: n('note-1') instead of createNoteId('note-1')
 */
const n = createNoteId;

/**
 * Helper function to create NoteMetadata with proper branded types.
 * Converts plain string arrays to branded NoteId arrays.
 */
function createTestMetadata(metadata: {
  title: string | null;
  tags: string[];
  links: string[];
  mentions: string[];
  type?: NoteType;
}): NoteMetadata {
  return {
    ...metadata,
    links: metadata.links.map(createNoteId),
    mentions: metadata.mentions.map(createNoteId),
  };
}

/**
 * Helper function to create a valid test Note with all required fields.
 * This ensures tests use the correct Note structure with top-level title and tags.
 * Uses discriminated union pattern for type-specific data.
 */
function createTestNote(
  id: string,
  metadata: {
    title: string | null;
    tags: string[];
    links: string[];
    mentions: string[];
    type?: NoteType;
  },
  options?: {
    type?: NoteType;
    meeting?: { date: string; dailyNoteId: string; attendees: string[] };
    daily?: { date: string };
  }
): Note {
  const typedMetadata = createTestMetadata(metadata);
  const noteType = options?.type ?? metadata.type;

  const baseNote = {
    id: createNoteId(id),
    title: metadata.title ?? 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [], // User-defined tags (separate from inline #tags in metadata.tags)
    content: noteType
      ? { root: { type: 'root' as const, children: [] }, type: noteType }
      : { root: { type: 'root' as const, children: [] } },
    metadata: typedMetadata,
  };

  // Handle discriminated union based on type
  if (noteType === 'meeting' && options?.meeting) {
    return {
      ...baseNote,
      type: 'meeting',
      meeting: {
        date: options.meeting.date,
        dailyNoteId: createNoteId(options.meeting.dailyNoteId),
        attendees: options.meeting.attendees.map(createNoteId),
      },
    };
  }

  if (noteType === 'daily' && options?.daily) {
    return {
      ...baseNote,
      type: 'daily',
      daily: options.daily,
    };
  }

  if (noteType === 'daily') {
    // Daily note without explicit daily data
    return {
      ...baseNote,
      type: 'daily',
      daily: { date: new Date().toISOString().split('T')[0] },
    };
  }

  if (noteType === 'person') {
    return {
      ...baseNote,
      type: 'person',
    };
  }

  if (noteType === 'project') {
    return {
      ...baseNote,
      type: 'project',
    };
  }

  if (noteType === 'template') {
    return {
      ...baseNote,
      type: 'template',
    };
  }

  if (noteType === 'system') {
    return {
      ...baseNote,
      type: 'system',
    };
  }

  // Regular note (no type)
  return {
    ...baseNote,
    type: undefined,
  };
}

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
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(1);
      expect(stats.edges).toBe(0);
      expect(stats.tags).toBe(0);
    });

    it('should add a note with tags', () => {
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['tag1', 'tag2'],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      const withTag1 = graph.notesWithTag('tag1');
      const withTag2 = graph.notesWithTag('tag2');

      expect(withTag1).toHaveLength(1);
      expect(withTag1[0].id).toBe('note-1');
      expect(withTag2).toHaveLength(1);
      expect(withTag2[0].id).toBe('note-1');
    });

    it('should add a note with outgoing links', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2', 'note-3'],
        mentions: [],
      });

      graph.addNote(note1);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(1);
      expect(stats.edges).toBe(2);
    });

    it('should update existing note', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['tag1'],
        links: ['note-2'],
        mentions: [],
      });

      graph.addNote(note1);

      // Update with different tags and links
      const note1Updated = createTestNote('note-1', {
        title: 'Note 1 Updated',
        tags: ['tag2'],
        links: ['note-3'],
        mentions: [],
      });

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
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      const backlinks = graph.backlinks(n('note-1'));
      expect(backlinks).toHaveLength(0);
    });

    it('should return backlinks for note', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      const backlinks = graph.backlinks(n('note-2'));
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe('note-1');
      expect(backlinks[0].title).toBe('Note 1');
    });

    it('should return multiple backlinks', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-3'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: ['note-3'],
        mentions: [],
      });

      const note3 = createTestNote('note-3', {
        title: 'Note 3',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);
      graph.addNote(note3);

      const backlinks = graph.backlinks(n('note-3'));
      expect(backlinks).toHaveLength(2);

      const backlinkIds = backlinks.map((n) => n.id).sort();
      expect(backlinkIds).toEqual(['note-1', 'note-2']);
    });

    it('should update backlinks when note links change', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      expect(graph.backlinks(n('note-2'))).toHaveLength(1);

      // Update note1 to link to note-3 instead
      const note1Updated = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-3'],
        mentions: [],
      });

      graph.addNote(note1Updated);

      // note-2 should no longer have backlinks
      expect(graph.backlinks(n('note-2'))).toHaveLength(0);
    });
  });

  describe('outlinks', () => {
    it('returns notes that the given note links to', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b', 'note-c'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: [],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      const outlinks = graph.outlinks(n('note-a'));
      expect(outlinks).toHaveLength(2);
      expect(outlinks.map((node) => node.id)).toContain('note-b');
      expect(outlinks.map((node) => node.id)).toContain('note-c');
    });

    it('returns empty array for note with no outlinks', () => {
      const note = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      expect(graph.outlinks(n('note-a'))).toEqual([]);
    });

    it('returns empty array for unknown note', () => {
      expect(graph.outlinks(n('unknown'))).toEqual([]);
    });

    it('filters out broken links to deleted notes', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      graph.addNote(noteA);
      // Note 'note-b' is never added, so it's a broken link

      const outlinks = graph.outlinks(n('note-a'));
      expect(outlinks).toEqual([]); // Broken links are filtered
    });
  });

  describe('neighbors', () => {
    it('should return empty array for isolated note', () => {
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      const neighbors = graph.neighbors(n('note-1'));
      expect(neighbors).toHaveLength(0);
    });

    it('should return outgoing neighbors', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      const neighbors = graph.neighbors(n('note-1'));
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('note-2');
    });

    it('should return incoming neighbors', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      const neighbors = graph.neighbors(n('note-2'));
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('note-1');
    });

    it('should return both incoming and outgoing neighbors', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: ['note-3'],
        mentions: [],
      });

      const note3 = createTestNote('note-3', {
        title: 'Note 3',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);
      graph.addNote(note3);

      const neighbors = graph.neighbors(n('note-2'));
      expect(neighbors).toHaveLength(2);

      const neighborIds = neighbors.map((n) => n.id).sort();
      expect(neighborIds).toEqual(['note-1', 'note-3']);
    });

    it('should not duplicate bidirectional links', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: ['note-1'],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      const neighbors = graph.neighbors(n('note-1'));
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
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['important'],
        links: [],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: ['important'],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      const notes = graph.notesWithTag('important');
      expect(notes).toHaveLength(2);

      const noteIds = notes.map((n) => n.id).sort();
      expect(noteIds).toEqual(['note-1', 'note-2']);
    });

    it('should update when tags change', () => {
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['old-tag'],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      expect(graph.notesWithTag('old-tag')).toHaveLength(1);

      // Update tags
      const noteUpdated = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['new-tag'],
        links: [],
        mentions: [],
      });

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
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['zebra', 'apple'],
        links: [],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: ['banana', 'apple'],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      const tags = graph.getAllTags();
      expect(tags).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('removeNote', () => {
    it('should remove note and all its edges', () => {
      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['tag1'],
        links: ['note-2'],
        mentions: [],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note1);
      graph.addNote(note2);

      expect(graph.getStats().nodes).toBe(2);
      expect(graph.backlinks(n('note-2'))).toHaveLength(1);

      graph.removeNote(n('note-1'));

      expect(graph.getStats().nodes).toBe(1);
      expect(graph.backlinks(n('note-2'))).toHaveLength(0);
      expect(graph.notesWithTag('tag1')).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all graph data', () => {
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: ['tag1'],
        links: ['note-2'],
        mentions: [],
      });

      graph.addNote(note);

      expect(graph.getStats().nodes).toBe(1);

      graph.clear();

      const stats = graph.getStats();
      expect(stats.nodes).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.tags).toBe(0);
    });

    it('should clear person mention indexes', () => {
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      graph.addNote(person);
      graph.addNote(note);

      expect(graph.notesMentioning(n('person-1'))).toHaveLength(1);

      graph.clear();

      expect(graph.notesMentioning(n('person-1'))).toHaveLength(0);
      expect(graph.peopleMentionedIn(n('note-1'))).toHaveLength(0);
    });
  });

  describe('person mentions', () => {
    it('should track mentions - adding note updates mentioning/mentionedBy indexes', () => {
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      graph.addNote(person);
      graph.addNote(note);

      // mentionedBy: person -> notes mentioning them
      expect(graph.notesMentioning(n('person-1'))).toEqual(['note-1']);

      // mentioning: note -> people mentioned in it
      expect(graph.peopleMentionedIn(n('note-1'))).toEqual(['person-1']);
    });

    it('should remove note cleans mentions - removing note clears mention relationships', () => {
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      graph.addNote(person);
      graph.addNote(note);

      expect(graph.notesMentioning(n('person-1'))).toHaveLength(1);

      graph.removeNote(n('note-1'));

      expect(graph.notesMentioning(n('person-1'))).toHaveLength(0);
    });

    it('should remove person cleans references - removing a person clears all mention-of references', () => {
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note1 = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      const note2 = createTestNote('note-2', {
        title: 'Project Notes',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      graph.addNote(person);
      graph.addNote(note1);
      graph.addNote(note2);

      expect(graph.notesMentioning(n('person-1'))).toHaveLength(2);
      expect(graph.peopleMentionedIn(n('note-1'))).toContain('person-1');
      expect(graph.peopleMentionedIn(n('note-2'))).toContain('person-1');

      // Remove the person
      graph.removeNote(n('person-1'));

      // Person should no longer appear in mentions
      expect(graph.peopleMentionedIn(n('note-1'))).not.toContain('person-1');
      expect(graph.peopleMentionedIn(n('note-2'))).not.toContain('person-1');
    });

    it('should update mentions when note is updated', () => {
      const person1 = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const person2 = createTestNote(
        'person-2',
        { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(note);

      expect(graph.notesMentioning(n('person-1'))).toEqual(['note-1']);
      expect(graph.notesMentioning(n('person-2'))).toHaveLength(0);

      // Update note to mention person-2 instead
      const noteUpdated = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-2'],
      });

      graph.addNote(noteUpdated);

      expect(graph.notesMentioning(n('person-1'))).toHaveLength(0);
      expect(graph.notesMentioning(n('person-2'))).toEqual(['note-1']);
      expect(graph.peopleMentionedIn(n('note-1'))).toEqual(['person-2']);
    });

    it('should handle multiple mentions in one note', () => {
      const person1 = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const person2 = createTestNote(
        'person-2',
        { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-1', 'person-2'],
      });

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(note);

      expect(graph.peopleMentionedIn(n('note-1')).sort()).toEqual(['person-1', 'person-2']);
      expect(graph.notesMentioning(n('person-1'))).toEqual(['note-1']);
      expect(graph.notesMentioning(n('person-2'))).toEqual(['note-1']);
    });
  });

  describe('getAllPeople', () => {
    it('should return empty array when no people exist', () => {
      const note = createTestNote('note-1', {
        title: 'Regular Note',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      const people = graph.getAllPeople();
      expect(people).toHaveLength(0);
    });

    it('should return only notes with type=person', () => {
      const person1 = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const person2 = createTestNote(
        'person-2',
        { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const regularNote = createTestNote('note-1', {
        title: 'Regular Note',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(regularNote);

      const people = graph.getAllPeople();
      expect(people).toHaveLength(2);
      expect(people.sort()).toEqual(['person-1', 'person-2']);
    });

    it('should update when person is removed', () => {
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      graph.addNote(person);
      expect(graph.getAllPeople()).toHaveLength(1);

      graph.removeNote(n('person-1'));
      expect(graph.getAllPeople()).toHaveLength(0);
    });
  });

  describe('notesMentioning', () => {
    it('should return empty array for non-existent person', () => {
      const notes = graph.notesMentioning(n('non-existent'));
      expect(notes).toHaveLength(0);
    });

    it('should return correct notes for a person', () => {
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      const note2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: [],
        mentions: ['person-1'],
      });

      const note3 = createTestNote('note-3', {
        title: 'Note 3',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(person);
      graph.addNote(note1);
      graph.addNote(note2);
      graph.addNote(note3);

      const mentioningNotes = graph.notesMentioning(n('person-1'));
      expect(mentioningNotes).toHaveLength(2);
      expect(mentioningNotes.sort()).toEqual(['note-1', 'note-2']);
    });
  });

  describe('peopleMentionedIn', () => {
    it('should return empty array for note with no mentions', () => {
      const note = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(note);

      const people = graph.peopleMentionedIn(n('note-1'));
      expect(people).toHaveLength(0);
    });

    it('should return correct people for a note', () => {
      const person1 = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const person2 = createTestNote(
        'person-2',
        { title: 'Jane Doe', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const note = createTestNote('note-1', {
        title: 'Meeting Notes',
        tags: [],
        links: [],
        mentions: ['person-1', 'person-2'],
      });

      graph.addNote(person1);
      graph.addNote(person2);
      graph.addNote(note);

      const people = graph.peopleMentionedIn(n('note-1'));
      expect(people).toHaveLength(2);
      expect(people.sort()).toEqual(['person-1', 'person-2']);
    });

    it('should return empty array for non-existent note', () => {
      const people = graph.peopleMentionedIn(n('non-existent'));
      expect(people).toHaveLength(0);
    });
  });

  describe('meeting -> daily note relationship', () => {
    it('should include dailyNoteId as a backlink', () => {
      const dailyNote = createTestNote(
        'daily-2024-12-02',
        { title: '12-02-2024', tags: ['daily'], links: [], mentions: [] },
        { type: 'daily' }
      );

      const meetingNote = createTestNote(
        'meeting-1',
        { title: 'Team Sync', tags: ['meeting'], links: [], mentions: [] },
        {
          type: 'meeting',
          meeting: {
            date: '2024-12-02',
            dailyNoteId: 'daily-2024-12-02',
            attendees: [],
          },
        }
      );

      graph.addNote(dailyNote);
      graph.addNote(meetingNote);

      // The meeting should appear as a backlink on the daily note
      const backlinks = graph.backlinks(n('daily-2024-12-02'));
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe('meeting-1');
      expect(backlinks[0].title).toBe('Team Sync');
    });

    it('should include dailyNoteId in neighbors', () => {
      const dailyNote = createTestNote(
        'daily-2024-12-02',
        { title: '12-02-2024', tags: ['daily'], links: [], mentions: [] },
        { type: 'daily' }
      );

      const meetingNote = createTestNote(
        'meeting-1',
        { title: 'Team Sync', tags: ['meeting'], links: [], mentions: [] },
        {
          type: 'meeting',
          meeting: {
            date: '2024-12-02',
            dailyNoteId: 'daily-2024-12-02',
            attendees: [],
          },
        }
      );

      graph.addNote(dailyNote);
      graph.addNote(meetingNote);

      // Daily note should have meeting as neighbor (via incoming edge)
      const dailyNeighbors = graph.neighbors(n('daily-2024-12-02'));
      expect(dailyNeighbors).toHaveLength(1);
      expect(dailyNeighbors[0].id).toBe('meeting-1');

      // Meeting should have daily as neighbor (via outgoing edge)
      const meetingNeighbors = graph.neighbors(n('meeting-1'));
      expect(meetingNeighbors).toHaveLength(1);
      expect(meetingNeighbors[0].id).toBe('daily-2024-12-02');
    });

    it('should update backlinks when meeting is updated', () => {
      const dailyNote1 = createTestNote(
        'daily-2024-12-01',
        { title: '12-01-2024', tags: ['daily'], links: [], mentions: [] },
        { type: 'daily' }
      );

      const dailyNote2 = createTestNote(
        'daily-2024-12-02',
        { title: '12-02-2024', tags: ['daily'], links: [], mentions: [] },
        { type: 'daily' }
      );

      const meetingNote = createTestNote(
        'meeting-1',
        { title: 'Team Sync', tags: ['meeting'], links: [], mentions: [] },
        {
          type: 'meeting',
          meeting: {
            date: '2024-12-01',
            dailyNoteId: 'daily-2024-12-01',
            attendees: [],
          },
        }
      );

      graph.addNote(dailyNote1);
      graph.addNote(dailyNote2);
      graph.addNote(meetingNote);

      expect(graph.backlinks(n('daily-2024-12-01'))).toHaveLength(1);
      expect(graph.backlinks(n('daily-2024-12-02'))).toHaveLength(0);

      // Update meeting to link to different daily note
      const meetingUpdated = createTestNote(
        'meeting-1',
        { title: 'Team Sync', tags: ['meeting'], links: [], mentions: [] },
        {
          type: 'meeting',
          meeting: {
            date: '2024-12-02',
            dailyNoteId: 'daily-2024-12-02',
            attendees: [],
          },
        }
      );

      graph.addNote(meetingUpdated);

      expect(graph.backlinks(n('daily-2024-12-01'))).toHaveLength(0);
      expect(graph.backlinks(n('daily-2024-12-02'))).toHaveLength(1);
    });

    it('should clean up backlinks when meeting is removed', () => {
      const dailyNote = createTestNote(
        'daily-2024-12-02',
        { title: '12-02-2024', tags: ['daily'], links: [], mentions: [] },
        { type: 'daily' }
      );

      const meetingNote = createTestNote(
        'meeting-1',
        { title: 'Team Sync', tags: ['meeting'], links: [], mentions: [] },
        {
          type: 'meeting',
          meeting: {
            date: '2024-12-02',
            dailyNoteId: 'daily-2024-12-02',
            attendees: [],
          },
        }
      );

      graph.addNote(dailyNote);
      graph.addNote(meetingNote);

      expect(graph.backlinks(n('daily-2024-12-02'))).toHaveLength(1);

      graph.removeNote(n('meeting-1'));

      expect(graph.backlinks(n('daily-2024-12-02'))).toHaveLength(0);
    });

    it('should handle meeting with both dailyNoteId and content links', () => {
      const dailyNote = createTestNote(
        'daily-2024-12-02',
        { title: '12-02-2024', tags: ['daily'], links: [], mentions: [] },
        { type: 'daily' }
      );

      const projectNote = createTestNote('project-1', {
        title: 'Project Alpha',
        tags: [],
        links: [],
        mentions: [],
      });

      // Meeting links to project in content AND has dailyNoteId
      const meetingNote = createTestNote(
        'meeting-1',
        { title: 'Team Sync', tags: ['meeting'], links: ['project-1'], mentions: [] },
        {
          type: 'meeting',
          meeting: {
            date: '2024-12-02',
            dailyNoteId: 'daily-2024-12-02',
            attendees: [],
          },
        }
      );

      graph.addNote(dailyNote);
      graph.addNote(projectNote);
      graph.addNote(meetingNote);

      // Both should appear in meeting's outgoing neighbors
      const meetingNeighbors = graph.neighbors(n('meeting-1'));
      expect(meetingNeighbors).toHaveLength(2);
      const neighborIds = meetingNeighbors.map((n) => n.id).sort();
      expect(neighborIds).toEqual(['daily-2024-12-02', 'project-1']);

      // Meeting should appear as backlink for both
      expect(graph.backlinks(n('daily-2024-12-02'))).toHaveLength(1);
      expect(graph.backlinks(n('project-1'))).toHaveLength(1);
    });
  });

  describe('circular references', () => {
    it('should handle simple bidirectional cycle (A <-> B)', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);

      // Each note should have exactly 1 neighbor (no duplicates)
      const neighborsA = graph.neighbors(n('note-a'));
      expect(neighborsA).toHaveLength(1);
      expect(neighborsA[0].id).toBe('note-b');

      const neighborsB = graph.neighbors(n('note-b'));
      expect(neighborsB).toHaveLength(1);
      expect(neighborsB[0].id).toBe('note-a');

      // Each note should have 1 backlink
      const backlinksA = graph.backlinks(n('note-a'));
      expect(backlinksA).toHaveLength(1);
      expect(backlinksA[0].id).toBe('note-b');

      const backlinksB = graph.backlinks(n('note-b'));
      expect(backlinksB).toHaveLength(1);
      expect(backlinksB[0].id).toBe('note-a');

      // 2 edges total: A->B and B->A
      expect(graph.getStats().edges).toBe(2);
    });

    it('should handle cycle of 3 (A -> B -> C -> A)', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      // Verify edges: exactly 3 edges (one per link)
      expect(graph.getStats().edges).toBe(3);
      expect(graph.getStats().nodes).toBe(3);

      // Each node should have exactly 2 neighbors (incoming + outgoing)
      const neighborsA = graph.neighbors(n('note-a'));
      expect(neighborsA).toHaveLength(2);
      const neighborAIds = neighborsA.map((n) => n.id).sort();
      expect(neighborAIds).toEqual(['note-b', 'note-c']);

      const neighborsB = graph.neighbors(n('note-b'));
      expect(neighborsB).toHaveLength(2);
      const neighborBIds = neighborsB.map((n) => n.id).sort();
      expect(neighborBIds).toEqual(['note-a', 'note-c']);

      const neighborsC = graph.neighbors(n('note-c'));
      expect(neighborsC).toHaveLength(2);
      const neighborCIds = neighborsC.map((n) => n.id).sort();
      expect(neighborCIds).toEqual(['note-a', 'note-b']);

      // Each node should have exactly 1 backlink
      expect(graph.backlinks(n('note-a'))).toHaveLength(1);
      expect(graph.backlinks(n('note-a'))[0].id).toBe('note-c');

      expect(graph.backlinks(n('note-b'))).toHaveLength(1);
      expect(graph.backlinks(n('note-b'))[0].id).toBe('note-a');

      expect(graph.backlinks(n('note-c'))).toHaveLength(1);
      expect(graph.backlinks(n('note-c'))[0].id).toBe('note-b');
    });

    it('should handle longer cycle (A -> B -> C -> D -> A)', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-d'],
        mentions: [],
      });

      const noteD = createTestNote('note-d', {
        title: 'Note D',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);
      graph.addNote(noteD);

      // Verify edges: exactly 4 edges
      expect(graph.getStats().edges).toBe(4);
      expect(graph.getStats().nodes).toBe(4);

      // Each node should have exactly 2 neighbors (incoming + outgoing)
      expect(graph.neighbors(n('note-a'))).toHaveLength(2);
      expect(graph.neighbors(n('note-b'))).toHaveLength(2);
      expect(graph.neighbors(n('note-c'))).toHaveLength(2);
      expect(graph.neighbors(n('note-d'))).toHaveLength(2);

      // No duplicate neighbors
      const neighborsA = graph.neighbors(n('note-a'));
      const uniqueNeighborAIds = new Set(neighborsA.map((n) => n.id));
      expect(uniqueNeighborAIds.size).toBe(2);

      // Backlinks are correct
      expect(graph.backlinks(n('note-a'))[0].id).toBe('note-d');
      expect(graph.backlinks(n('note-b'))[0].id).toBe('note-a');
      expect(graph.backlinks(n('note-c'))[0].id).toBe('note-b');
      expect(graph.backlinks(n('note-d'))[0].id).toBe('note-c');
    });

    it('should handle complex cycle with multiple connections', () => {
      // A -> B, A -> C
      // B -> C
      // C -> A (closes cycle A -> C -> A and A -> B -> C -> A)
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b', 'note-c'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      // 4 edges: A->B, A->C, B->C, C->A
      expect(graph.getStats().edges).toBe(4);

      // Note C has 2 backlinks (from A and B)
      const backlinksC = graph.backlinks(n('note-c'));
      expect(backlinksC).toHaveLength(2);
      const backlinkCIds = backlinksC.map((n) => n.id).sort();
      expect(backlinkCIds).toEqual(['note-a', 'note-b']);

      // Note A has 1 backlink (from C only)
      const backlinksA = graph.backlinks(n('note-a'));
      expect(backlinksA).toHaveLength(1);
      expect(backlinksA[0].id).toBe('note-c');

      // Note B has 1 backlink (from A only)
      const backlinksB = graph.backlinks(n('note-b'));
      expect(backlinksB).toHaveLength(1);
      expect(backlinksB[0].id).toBe('note-a');

      // Neighbors should have no duplicates
      const neighborsA = graph.neighbors(n('note-a'));
      expect(neighborsA).toHaveLength(2); // B (outgoing) and C (both directions)
      const neighborAIds = neighborsA.map((n) => n.id).sort();
      expect(neighborAIds).toEqual(['note-b', 'note-c']);
    });

    it('should properly clean up when removing a note from a cycle of 3', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      expect(graph.getStats().nodes).toBe(3);
      expect(graph.getStats().edges).toBe(3);

      // Remove B (middle of chain A -> B -> C)
      graph.removeNote(n('note-b'));

      // Should have 2 nodes and 1 edge (C -> A)
      expect(graph.getStats().nodes).toBe(2);
      expect(graph.getStats().edges).toBe(1);

      // A should no longer have any outgoing edges to B
      const neighborsA = graph.neighbors(n('note-a'));
      expect(neighborsA).toHaveLength(1);
      expect(neighborsA[0].id).toBe('note-c');

      // C's outgoing edge to A should still work
      const backlinksA = graph.backlinks(n('note-a'));
      expect(backlinksA).toHaveLength(1);
      expect(backlinksA[0].id).toBe('note-c');

      // B should not appear in any neighbors
      expect(graph.neighbors(n('note-b'))).toHaveLength(0);
    });

    it('should properly clean up when removing a note from a bidirectional cycle', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);

      expect(graph.getStats().edges).toBe(2);

      // Remove B
      graph.removeNote(n('note-b'));

      expect(graph.getStats().nodes).toBe(1);
      expect(graph.getStats().edges).toBe(0);

      // A should have no neighbors or backlinks
      expect(graph.neighbors(n('note-a'))).toHaveLength(0);
      expect(graph.backlinks(n('note-a'))).toHaveLength(0);
    });

    it('should update circular references when note links change', () => {
      // Initial: A -> B -> C -> A
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      expect(graph.getStats().edges).toBe(3);

      // Update C to break the cycle (C no longer links to A)
      const noteCUpdated = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: [], // No more link to A
        mentions: [],
      });

      graph.addNote(noteCUpdated);

      // Should now be a chain: A -> B -> C (2 edges)
      expect(graph.getStats().edges).toBe(2);

      // A should have no backlinks
      expect(graph.backlinks(n('note-a'))).toHaveLength(0);

      // C should have 1 backlink from B
      expect(graph.backlinks(n('note-c'))).toHaveLength(1);
      expect(graph.backlinks(n('note-c'))[0].id).toBe('note-b');

      // A's neighbors: only B (outgoing)
      const neighborsA = graph.neighbors(n('note-a'));
      expect(neighborsA).toHaveLength(1);
      expect(neighborsA[0].id).toBe('note-b');
    });

    it('should handle circular references with tags correctly', () => {
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: ['cycle', 'start'],
        links: ['note-b'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: ['cycle'],
        links: ['note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: ['cycle', 'end'],
        links: ['note-a'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      // All 3 notes should have the 'cycle' tag
      const cycleNotes = graph.notesWithTag('cycle');
      expect(cycleNotes).toHaveLength(3);

      // Only A should have 'start' tag
      const startNotes = graph.notesWithTag('start');
      expect(startNotes).toHaveLength(1);
      expect(startNotes[0].id).toBe('note-a');

      // Only C should have 'end' tag
      const endNotes = graph.notesWithTag('end');
      expect(endNotes).toHaveLength(1);
      expect(endNotes[0].id).toBe('note-c');

      // Removing a note should clean up tags
      graph.removeNote(n('note-b'));
      expect(graph.notesWithTag('cycle')).toHaveLength(2);
    });

    it('should handle fully connected graph (all nodes link to all others)', () => {
      // Each note links to the other two
      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b', 'note-c'],
        mentions: [],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-a', 'note-c'],
        mentions: [],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-a', 'note-b'],
        mentions: [],
      });

      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      // 6 edges total (2 from each note)
      expect(graph.getStats().edges).toBe(6);

      // Each note should have 2 neighbors (no duplicates despite bidirectional links)
      expect(graph.neighbors(n('note-a'))).toHaveLength(2);
      expect(graph.neighbors(n('note-b'))).toHaveLength(2);
      expect(graph.neighbors(n('note-c'))).toHaveLength(2);

      // Each note should have 2 backlinks
      expect(graph.backlinks(n('note-a'))).toHaveLength(2);
      expect(graph.backlinks(n('note-b'))).toHaveLength(2);
      expect(graph.backlinks(n('note-c'))).toHaveLength(2);
    });

    it('should handle cycle with person mentions', () => {
      // Cycle of notes where each mentions the same person
      const person = createTestNote(
        'person-1',
        { title: 'John Smith', tags: [], links: [], mentions: [], type: 'person' },
        { type: 'person' }
      );

      const noteA = createTestNote('note-a', {
        title: 'Note A',
        tags: [],
        links: ['note-b'],
        mentions: ['person-1'],
      });

      const noteB = createTestNote('note-b', {
        title: 'Note B',
        tags: [],
        links: ['note-c'],
        mentions: ['person-1'],
      });

      const noteC = createTestNote('note-c', {
        title: 'Note C',
        tags: [],
        links: ['note-a'],
        mentions: ['person-1'],
      });

      graph.addNote(person);
      graph.addNote(noteA);
      graph.addNote(noteB);
      graph.addNote(noteC);

      // Cycle should work correctly
      expect(graph.getStats().edges).toBe(3);

      // All notes should mention the person
      const mentioningNotes = graph.notesMentioning(n('person-1'));
      expect(mentioningNotes).toHaveLength(3);
      expect(mentioningNotes.sort()).toEqual(['note-a', 'note-b', 'note-c']);

      // Removing a note from the cycle should clean up mentions
      graph.removeNote(n('note-b'));
      expect(graph.notesMentioning(n('person-1'))).toHaveLength(2);
      expect(graph.notesMentioning(n('person-1')).sort()).toEqual(['note-a', 'note-c']);
    });
  });

  describe('self-referencing notes', () => {
    it('should handle note that links to itself', () => {
      // A recursive topic note that references itself (e.g., "Recursion" note)
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: ['concept'],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(1);
      expect(stats.edges).toBe(1); // Self-link counts as one edge
    });

    it('should include self in backlinks for self-referencing note', () => {
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);

      const backlinks = graph.backlinks(n('note-self'));
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe('note-self');
      expect(backlinks[0].title).toBe('Recursion');
    });

    it('should include self in neighbors for self-referencing note (deduplicated)', () => {
      // A note that links to itself should appear exactly once in neighbors
      // since it's both an outgoing and incoming neighbor
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);

      const neighbors = graph.neighbors(n('note-self'));
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].id).toBe('note-self');
    });

    it('should handle self-referencing note with other links', () => {
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: ['note-self', 'note-other'],
        mentions: [],
      });

      const otherNote = createTestNote('note-other', {
        title: 'Other Topic',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(selfRefNote);
      graph.addNote(otherNote);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(2);
      expect(stats.edges).toBe(2); // Self-link + link to other

      // Self should be in its own backlinks
      const selfBacklinks = graph.backlinks(n('note-self'));
      expect(selfBacklinks).toHaveLength(1);
      expect(selfBacklinks[0].id).toBe('note-self');

      // Other note should have self-ref note as backlink
      const otherBacklinks = graph.backlinks(n('note-other'));
      expect(otherBacklinks).toHaveLength(1);
      expect(otherBacklinks[0].id).toBe('note-self');

      // Self-ref note neighbors should include both self and other
      const neighbors = graph.neighbors(n('note-self'));
      expect(neighbors).toHaveLength(2);
      const neighborIds = neighbors.map((n) => n.id).sort();
      expect(neighborIds).toEqual(['note-other', 'note-self']);
    });

    it('should clean up self-reference edge when updating note', () => {
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);

      expect(graph.backlinks(n('note-self'))).toHaveLength(1);
      expect(graph.getStats().edges).toBe(1);

      // Update to remove self-reference
      const updatedNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(updatedNote);

      expect(graph.backlinks(n('note-self'))).toHaveLength(0);
      expect(graph.getStats().edges).toBe(0);
    });

    it('should add self-reference edge when updating note', () => {
      const regularNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: [],
        mentions: [],
      });

      graph.addNote(regularNote);

      expect(graph.backlinks(n('note-self'))).toHaveLength(0);
      expect(graph.getStats().edges).toBe(0);

      // Update to add self-reference
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);

      expect(graph.backlinks(n('note-self'))).toHaveLength(1);
      expect(graph.getStats().edges).toBe(1);
    });

    it('should properly remove self-referencing note', () => {
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: ['concept'],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);

      expect(graph.getStats().nodes).toBe(1);
      expect(graph.getStats().edges).toBe(1);
      expect(graph.notesWithTag('concept')).toHaveLength(1);

      graph.removeNote(n('note-self'));

      expect(graph.getStats().nodes).toBe(0);
      expect(graph.getStats().edges).toBe(0);
      expect(graph.notesWithTag('concept')).toHaveLength(0);
      expect(graph.backlinks(n('note-self'))).toHaveLength(0);
      expect(graph.neighbors(n('note-self'))).toHaveLength(0);
    });

    it('should handle removing self-referencing note with other connections', () => {
      const selfRefNote = createTestNote('note-self', {
        title: 'Recursion',
        tags: [],
        links: ['note-self', 'note-linked'],
        mentions: [],
      });

      const linkedNote = createTestNote('note-linked', {
        title: 'Linked Note',
        tags: [],
        links: ['note-self'],
        mentions: [],
      });

      graph.addNote(selfRefNote);
      graph.addNote(linkedNote);

      expect(graph.getStats().nodes).toBe(2);
      expect(graph.getStats().edges).toBe(3); // Self-link + link to linked + link from linked

      // Verify bidirectional connection plus self-reference
      expect(graph.backlinks(n('note-self'))).toHaveLength(2); // From self and from linked
      expect(graph.backlinks(n('note-linked'))).toHaveLength(1); // From self

      graph.removeNote(n('note-self'));

      expect(graph.getStats().nodes).toBe(1);
      expect(graph.getStats().edges).toBe(0); // Linked note's link to removed note is cleaned up
      expect(graph.backlinks(n('note-self'))).toHaveLength(0);
      expect(graph.backlinks(n('note-linked'))).toHaveLength(0);
    });

    it('should handle multiple notes with self-references', () => {
      const selfRef1 = createTestNote('note-1', {
        title: 'Note 1',
        tags: [],
        links: ['note-1', 'note-2'],
        mentions: [],
      });

      const selfRef2 = createTestNote('note-2', {
        title: 'Note 2',
        tags: [],
        links: ['note-2', 'note-1'],
        mentions: [],
      });

      graph.addNote(selfRef1);
      graph.addNote(selfRef2);

      const stats = graph.getStats();
      expect(stats.nodes).toBe(2);
      expect(stats.edges).toBe(4); // 2 self-links + 2 cross-links

      // Each note should have 2 backlinks: self and the other
      const backlinks1 = graph.backlinks(n('note-1'));
      expect(backlinks1).toHaveLength(2);
      const backlink1Ids = backlinks1.map((n) => n.id).sort();
      expect(backlink1Ids).toEqual(['note-1', 'note-2']);

      const backlinks2 = graph.backlinks(n('note-2'));
      expect(backlinks2).toHaveLength(2);
      const backlink2Ids = backlinks2.map((n) => n.id).sort();
      expect(backlink2Ids).toEqual(['note-1', 'note-2']);

      // Each note should have 2 neighbors (deduplicated)
      const neighbors1 = graph.neighbors(n('note-1'));
      expect(neighbors1).toHaveLength(2);

      const neighbors2 = graph.neighbors(n('note-2'));
      expect(neighbors2).toHaveLength(2);
    });
  });
});
