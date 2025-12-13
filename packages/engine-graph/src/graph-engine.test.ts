/**
 * GraphEngine Tests
 *
 * Tests for graph construction, edge management, and query operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphEngine } from './graph-engine.js';
import type {
  Note,
  NoteMetadata,
  NoteType,
  NoteId,
  MeetingNoteData,
  DailyNoteData,
} from '@scribe/shared';
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
});
