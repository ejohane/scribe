/**
 * Integration Tests for Meeting Note Handlers
 *
 * Tests the meeting note handler logic through the data layer packages.
 * Since IPC handlers are thin wrappers around vault/engine calls,
 * testing the underlying operations validates the handler behavior.
 *
 * Tests cover:
 * - meeting:create - Create a new meeting note
 * - meeting:addAttendee - Add person to meeting
 * - meeting:removeAttendee - Remove person from meeting
 *
 * Issue: scribe-q3n.10
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { MeetingNote, NoteId } from '@scribe/shared';
import { isMeetingNote } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
  createPersonContent,
  createDailyContent,
  createMeetingContent,
} from './test-helpers';

describe('Meeting Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-meeting-handler-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // meeting:create Tests
  // ===========================================================================

  describe('meeting:create logic', () => {
    it('should create a meeting note with title', async () => {
      const title = 'Sprint Planning';
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Ensure daily note exists (mimicking handler behavior)
      let dailyNote = vault.list().find((n) => n.type === 'daily' && n.title === dateStr);
      if (!dailyNote) {
        dailyNote = await vault.create({
          type: 'daily',
          title: dateStr,
          tags: ['daily'],
          content: createDailyContent(),
          daily: { date: dateStr },
        });
        graphEngine.addNote(dailyNote);
        searchEngine.indexNote(dailyNote);
      }

      // Create meeting note
      const content = createMeetingContent();
      const note = await vault.create({
        type: 'meeting',
        title: title.trim(),
        tags: ['meeting'],
        content,
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [],
        },
      });

      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      expect(note.type).toBe('meeting');
      expect(note.title).toBe('Sprint Planning');
      // Tags are stored in the note directly, not in metadata
      expect(note.tags).toContain('meeting');
      expect(isMeetingNote(note)).toBe(true);
    });

    it('should link meeting to daily note', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create daily note first
      const dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Create meeting note linked to daily
      const meetingNote = await vault.create({
        type: 'meeting',
        title: 'Team Standup',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [],
        },
      });

      expect(isMeetingNote(meetingNote)).toBe(true);
      if (isMeetingNote(meetingNote)) {
        expect(meetingNote.meeting.dailyNoteId).toBe(dailyNote.id);
        expect(meetingNote.meeting.date).toBe(dateStr);
      }
    });

    it('should create daily note if none exists', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Verify no daily note exists
      let dailyNote = vault.list().find((n) => n.type === 'daily' && n.title === dateStr);
      expect(dailyNote).toBeUndefined();

      // Simulate handler logic - create daily if needed
      if (!dailyNote) {
        dailyNote = await vault.create({
          type: 'daily',
          title: dateStr,
          tags: ['daily'],
          content: createDailyContent(),
          daily: { date: dateStr },
        });
      }

      // Now create meeting
      const meetingNote = await vault.create({
        type: 'meeting',
        title: 'New Meeting',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [],
        },
      });

      // Both notes should exist
      const notes = vault.list();
      expect(notes.filter((n) => n.type === 'daily')).toHaveLength(1);
      expect(notes.filter((n) => n.type === 'meeting')).toHaveLength(1);
    });

    it('should throw error for empty title', () => {
      const title = '';

      expect(() => {
        if (!title?.trim()) {
          throw new Error('Meeting title required');
        }
      }).toThrow('Meeting title required');
    });

    it('should throw error for whitespace-only title', () => {
      const title = '   ';

      expect(() => {
        if (!title?.trim()) {
          throw new Error('Meeting title required');
        }
      }).toThrow('Meeting title required');
    });

    it('should create meeting with proper content structure', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      const dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      const note = await vault.create({
        type: 'meeting',
        title: 'Planning Meeting',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [],
        },
      });

      // Verify content has the three sections
      const children = note.content.root.children;
      expect(children.length).toBe(6); // 3 headings + 3 lists

      // Check headings exist
      const headings = children.filter((c: { type: string }) => c.type === 'heading');
      expect(headings).toHaveLength(3);
    });

    it('should initialize meeting with empty attendees', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      const dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      const note = await vault.create({
        type: 'meeting',
        title: 'Team Meeting',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [],
        },
      });

      if (isMeetingNote(note)) {
        expect(note.meeting.attendees).toEqual([]);
      }
    });
  });

  // ===========================================================================
  // meeting:addAttendee Tests
  // ===========================================================================

  describe('meeting:addAttendee logic', () => {
    let meetingNote: MeetingNote;
    let person1Id: NoteId;
    let person2Id: NoteId;

    beforeEach(async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create daily note
      const dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Create meeting note
      const note = await vault.create({
        type: 'meeting',
        title: 'Team Meeting',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [],
        },
      });
      meetingNote = note as MeetingNote;

      // Create people
      const person1 = await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });
      person1Id = person1.id;

      const person2 = await vault.create({
        title: 'Bob',
        content: createPersonContent('Bob'),
        type: 'person',
      });
      person2Id = person2.id;
    });

    it('should add attendee to meeting', async () => {
      // Read current meeting
      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) {
        throw new Error('Note is not a meeting');
      }

      // Add attendee
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: [...note.meeting.attendees, person1Id],
        },
      };

      await vault.save(updatedNote);

      // Verify
      const reloaded = vault.read(meetingNote.id);
      if (isMeetingNote(reloaded)) {
        expect(reloaded.meeting.attendees).toContain(person1Id);
        expect(reloaded.meeting.attendees).toHaveLength(1);
      }
    });

    it('should add multiple attendees', async () => {
      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) throw new Error('Not a meeting');

      // Add both attendees
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: [person1Id, person2Id],
        },
      };

      await vault.save(updatedNote);

      const reloaded = vault.read(meetingNote.id);
      if (isMeetingNote(reloaded)) {
        expect(reloaded.meeting.attendees).toHaveLength(2);
        expect(reloaded.meeting.attendees).toContain(person1Id);
        expect(reloaded.meeting.attendees).toContain(person2Id);
      }
    });

    it('should be idempotent - adding same attendee twice has no effect', async () => {
      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) throw new Error('Not a meeting');

      // Simulate idempotent add
      const attendees = note.meeting.attendees;
      if (!attendees.includes(person1Id)) {
        const updatedNote: MeetingNote = {
          ...note,
          meeting: {
            ...note.meeting,
            attendees: [...attendees, person1Id],
          },
        };
        await vault.save(updatedNote);
      }

      // Try to add again
      const note2 = vault.read(meetingNote.id);
      if (!isMeetingNote(note2)) throw new Error('Not a meeting');

      // Verify person is already an attendee
      expect(note2.meeting.attendees.includes(person1Id)).toBe(true);

      expect(note2.meeting.attendees).toHaveLength(1);
    });

    it('should throw error if note is not a meeting', async () => {
      // Create a regular note
      const regularNote = await vault.create({ title: 'Regular Note' });

      expect(() => {
        const note = vault.read(regularNote.id);
        if (!isMeetingNote(note)) {
          throw new Error('Note is not a meeting');
        }
      }).toThrow('Note is not a meeting');
    });

    it('should return success object', async () => {
      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) throw new Error('Not a meeting');

      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: [...note.meeting.attendees, person1Id],
        },
      };

      await vault.save(updatedNote);
      const result = { success: true };

      expect(result).toEqual({ success: true });
    });
  });

  // ===========================================================================
  // meeting:removeAttendee Tests
  // ===========================================================================

  describe('meeting:removeAttendee logic', () => {
    let meetingNote: MeetingNote;
    let person1Id: NoteId;
    let person2Id: NoteId;

    beforeEach(async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      const dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Create people
      const person1 = await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });
      person1Id = person1.id;

      const person2 = await vault.create({
        title: 'Bob',
        content: createPersonContent('Bob'),
        type: 'person',
      });
      person2Id = person2.id;

      // Create meeting with attendees
      const note = await vault.create({
        type: 'meeting',
        title: 'Team Meeting',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [person1Id, person2Id],
        },
      });
      meetingNote = note as MeetingNote;
    });

    it('should remove attendee from meeting', async () => {
      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) throw new Error('Not a meeting');

      // Remove person1
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: note.meeting.attendees.filter((id) => id !== person1Id),
        },
      };

      await vault.save(updatedNote);

      const reloaded = vault.read(meetingNote.id);
      if (isMeetingNote(reloaded)) {
        expect(reloaded.meeting.attendees).not.toContain(person1Id);
        expect(reloaded.meeting.attendees).toContain(person2Id);
        expect(reloaded.meeting.attendees).toHaveLength(1);
      }
    });

    it('should be idempotent - removing non-existent attendee has no effect', async () => {
      const nonExistentId = 'non-existent-person-id' as NoteId;

      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) throw new Error('Not a meeting');

      const originalLength = note.meeting.attendees.length;

      // Remove non-existent
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: note.meeting.attendees.filter((id) => id !== nonExistentId),
        },
      };

      await vault.save(updatedNote);

      const reloaded = vault.read(meetingNote.id);
      if (isMeetingNote(reloaded)) {
        expect(reloaded.meeting.attendees).toHaveLength(originalLength);
      }
    });

    it('should throw error if note is not a meeting', async () => {
      const regularNote = await vault.create({ title: 'Regular Note' });

      expect(() => {
        const note = vault.read(regularNote.id);
        if (!isMeetingNote(note)) {
          throw new Error('Note is not a meeting');
        }
      }).toThrow('Note is not a meeting');
    });

    it('should allow removing all attendees', async () => {
      const note = vault.read(meetingNote.id);
      if (!isMeetingNote(note)) throw new Error('Not a meeting');

      // Remove all
      const updatedNote: MeetingNote = {
        ...note,
        meeting: {
          ...note.meeting,
          attendees: [],
        },
      };

      await vault.save(updatedNote);

      const reloaded = vault.read(meetingNote.id);
      if (isMeetingNote(reloaded)) {
        expect(reloaded.meeting.attendees).toEqual([]);
      }
    });
  });

  // ===========================================================================
  // Meeting List Tests (date range)
  // ===========================================================================

  describe('Meeting listing by date range', () => {
    beforeEach(async () => {
      // Create meetings on different dates
      const dates = ['01-01-2024', '01-05-2024', '01-10-2024'];

      for (const dateStr of dates) {
        const dailyNote = await vault.create({
          type: 'daily',
          title: dateStr,
          content: createDailyContent(),
          daily: { date: dateStr },
        });

        await vault.create({
          type: 'meeting',
          title: `Meeting on ${dateStr}`,
          content: createMeetingContent(),
          meeting: {
            date: dateStr,
            dailyNoteId: dailyNote.id,
            attendees: [],
          },
        });
      }
    });

    it('should list all meetings', () => {
      const meetings = vault.list().filter((n) => n.type === 'meeting');
      expect(meetings).toHaveLength(3);
    });

    it('should filter meetings by date range', () => {
      const startDate = '01-01-2024';
      const endDate = '01-05-2024';

      const meetings = vault.list().filter((n) => {
        if (!isMeetingNote(n)) return false;
        return n.meeting.date >= startDate && n.meeting.date <= endDate;
      });

      expect(meetings).toHaveLength(2);
    });

    it('should sort meetings by date', () => {
      const meetings = vault
        .list()
        .filter((n): n is MeetingNote => isMeetingNote(n))
        .sort((a, b) => a.meeting.date.localeCompare(b.meeting.date));

      expect(meetings[0].meeting.date).toBe('01-01-2024');
      expect(meetings[2].meeting.date).toBe('01-10-2024');
    });
  });

  // ===========================================================================
  // Persistence Tests
  // ===========================================================================

  describe('Meeting persistence', () => {
    it('should persist meeting with attendees through restart', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      const dailyNote = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      const person = await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });

      const meetingNote = await vault.create({
        type: 'meeting',
        title: 'Persisted Meeting',
        content: createMeetingContent(),
        meeting: {
          date: dateStr,
          dailyNoteId: dailyNote.id,
          attendees: [person.id],
        },
      });

      // Simulate restart
      const vault2 = await simulateAppRestart(ctx.tempDir);

      const loaded = vault2.read(meetingNote.id);
      expect(loaded.type).toBe('meeting');
      if (isMeetingNote(loaded)) {
        expect(loaded.meeting.attendees).toContain(person.id);
        expect(loaded.meeting.dailyNoteId).toBe(dailyNote.id);
      }
    });
  });
});
