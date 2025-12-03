/**
 * E2E Integration Tests for Templates Feature
 *
 * Tests the Note Templates functionality including:
 * - Daily Notes: creation, idempotency, title rendering, content structure
 * - Meeting Notes: creation, daily note linking, content structure
 * - Attendees: add, remove, idempotency
 *
 * These tests focus on the data layer integration.
 * UI component tests are in renderer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format, parse, isValid, isToday } from 'date-fns';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { Note, NoteId, LexicalState } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
  createPersonContent,
  indexNoteInEngines,
} from './test-helpers';

// =============================================================================
// Content Generation Helpers
// =============================================================================

/**
 * Creates Lexical content for a daily note (empty bullet list, no H1)
 * Matches the structure defined in spec.md
 */
function createDailyContent(): LexicalState & { type: 'daily' } {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              children: [],
              direction: null,
              format: '',
              indent: 0,
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'daily',
  };
}

/**
 * Creates Lexical content for a meeting note (H3 sections with bullet lists, no H1)
 * Matches the structure defined in spec.md
 */
function createMeetingContent(): LexicalState & { type: 'meeting' } {
  const createH3 = (text: string) => ({
    type: 'heading',
    tag: 'h3',
    children: [{ type: 'text', text }],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });

  const emptyBulletList = () => ({
    type: 'list',
    listType: 'bullet',
    children: [
      {
        type: 'listitem',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });

  return {
    root: {
      type: 'root',
      children: [
        createH3('Pre-Read'),
        emptyBulletList(),
        createH3('Notes'),
        emptyBulletList(),
        createH3('Action Items'),
        emptyBulletList(),
      ],
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'meeting',
  };
}

// =============================================================================
// Daily Note API Helpers (Simulating IPC handlers)
// =============================================================================

/**
 * Simulates daily:getOrCreate IPC handler
 * Finds existing daily note for today or creates new one
 */
async function dailyGetOrCreate(
  vault: FileSystemVault,
  graphEngine: GraphEngine,
  searchEngine: SearchEngine,
  date: Date = new Date()
): Promise<Note> {
  const dateStr = format(date, 'MM-dd-yyyy');

  // Find existing daily note
  const notes = vault.list();
  const existing = notes.find((n) => n.type === 'daily' && n.title === dateStr);
  if (existing) return existing;

  // Create new daily note
  const content = createDailyContent();
  const note = await vault.create({
    type: 'daily',
    title: dateStr,
    tags: ['daily'],
    content,
  });

  // Update note with daily metadata
  const loaded = vault.read(note.id);
  (loaded as any).daily = { date: dateStr };
  await vault.save(loaded);

  const savedNote = vault.read(note.id);
  graphEngine.addNote(savedNote);
  searchEngine.indexNote(savedNote);

  return savedNote;
}

/**
 * Simulates daily:find IPC handler
 * Finds daily note for a specific date
 */
function dailyFind(vault: FileSystemVault, date: string): Note | null {
  const notes = vault.list();
  return notes.find((n) => n.type === 'daily' && n.title === date) ?? null;
}

// =============================================================================
// Meeting Note API Helpers (Simulating IPC handlers)
// =============================================================================

/**
 * Simulates meeting:create IPC handler
 * Creates a new meeting note linked to today's daily note
 */
async function meetingCreate(
  vault: FileSystemVault,
  graphEngine: GraphEngine,
  searchEngine: SearchEngine,
  title: string
): Promise<Note> {
  if (!title?.trim()) {
    throw new Error('Meeting title required');
  }

  const today = new Date();
  const dateStr = format(today, 'MM-dd-yyyy');

  // Ensure daily note exists
  let dailyNote = vault.list().find((n) => n.type === 'daily' && n.title === dateStr);
  if (!dailyNote) {
    dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine, today);
  }

  // Create meeting note
  const content = createMeetingContent();
  const note = await vault.create({
    type: 'meeting',
    title: title.trim(),
    tags: ['meeting'],
    content,
  });

  // Update note with meeting metadata
  const loaded = vault.read(note.id);
  (loaded as any).meeting = {
    date: dateStr,
    dailyNoteId: dailyNote.id,
    attendees: [],
  };
  await vault.save(loaded);

  const savedNote = vault.read(note.id);
  graphEngine.addNote(savedNote);
  searchEngine.indexNote(savedNote);

  return savedNote;
}

/**
 * Simulates meeting:addAttendee IPC handler
 */
async function meetingAddAttendee(
  vault: FileSystemVault,
  noteId: NoteId,
  personId: NoteId
): Promise<{ success: boolean }> {
  const note = vault.read(noteId);
  if (note.type !== 'meeting') {
    throw new Error('Note is not a meeting');
  }

  const attendees = note.meeting?.attendees ?? [];
  if (attendees.includes(personId)) {
    return { success: true }; // Already added (idempotent)
  }

  const updatedNote = {
    ...note,
    meeting: {
      ...note.meeting!,
      attendees: [...attendees, personId],
    },
  };

  await vault.save(updatedNote);
  return { success: true };
}

/**
 * Simulates meeting:removeAttendee IPC handler
 */
async function meetingRemoveAttendee(
  vault: FileSystemVault,
  noteId: NoteId,
  personId: NoteId
): Promise<{ success: boolean }> {
  const note = vault.read(noteId);
  if (note.type !== 'meeting') {
    throw new Error('Note is not a meeting');
  }

  const attendees = note.meeting?.attendees ?? [];
  const updatedNote = {
    ...note,
    meeting: {
      ...note.meeting!,
      attendees: attendees.filter((id) => id !== personId),
    },
  };

  await vault.save(updatedNote);
  return { success: true };
}

// =============================================================================
// Display Title Helper
// =============================================================================

/**
 * Computes the display title for a note
 * For daily notes, shows "Today" if it's today's note, otherwise formatted date
 */
function getDisplayTitle(note: Note): string {
  if (note.type === 'daily') {
    const noteDate = parse(note.title, 'MM-dd-yyyy', new Date());
    if (!isValid(noteDate)) {
      return note.title;
    }
    if (isToday(noteDate)) {
      return 'Today';
    }
    return format(noteDate, 'MM/dd/yyyy');
  }
  return note.title;
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('Templates Feature Integration Tests', () => {
  let ctx: TestContext;

  // Convenience aliases for cleaner test code
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-templates-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // Daily Notes Tests
  // ===========================================================================

  describe('Daily Notes', () => {
    describe('Creation via API', () => {
      it('should create daily note with correct structure', async () => {
        const today = new Date();
        const dateStr = format(today, 'MM-dd-yyyy');

        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        expect(dailyNote.type).toBe('daily');
        expect(dailyNote.title).toBe(dateStr);
        expect(dailyNote.tags).toContain('daily');
        expect(dailyNote.content.type).toBe('daily');
        expect(dailyNote.daily?.date).toBe(dateStr);
      });

      it('should create daily note with empty bullet list (no H1)', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        // Verify content structure
        const rootChildren = dailyNote.content.root.children;
        expect(rootChildren.length).toBe(1);

        // First child should be a bullet list, not a heading
        const firstChild = rootChildren[0] as any;
        expect(firstChild.type).toBe('list');
        expect(firstChild.listType).toBe('bullet');
        expect(firstChild.type).not.toBe('heading');
      });

      it('should store title as MM-dd-yyyy date format', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        // Title should be MM-dd-yyyy format
        expect(dailyNote.title).toMatch(/^\d{2}-\d{2}-\d{4}$/);
      });
    });

    describe('Idempotency', () => {
      it('should return same note on repeated getOrCreate calls', async () => {
        const firstCall = await dailyGetOrCreate(vault, graphEngine, searchEngine);
        const secondCall = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        expect(firstCall.id).toBe(secondCall.id);
        expect(firstCall.title).toBe(secondCall.title);
      });

      it('should not create duplicate daily notes for same date', async () => {
        await dailyGetOrCreate(vault, graphEngine, searchEngine);
        await dailyGetOrCreate(vault, graphEngine, searchEngine);
        await dailyGetOrCreate(vault, graphEngine, searchEngine);

        const allNotes = vault.list();
        const dailyNotes = allNotes.filter((n) => n.type === 'daily');

        expect(dailyNotes.length).toBe(1);
      });
    });

    describe('Title Rendering', () => {
      it('should render "Today" for today\'s daily note', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        const displayTitle = getDisplayTitle(dailyNote);
        expect(displayTitle).toBe('Today');
      });

      it('should render formatted date for past daily note', async () => {
        // Create a daily note with a past date
        const pastDate = new Date('2024-01-15');
        const dateStr = format(pastDate, 'MM-dd-yyyy');

        const content = createDailyContent();
        const pastNote = await vault.create({
          type: 'daily',
          title: dateStr,
          tags: ['daily'],
          content,
        });

        const loaded = vault.read(pastNote.id);
        (loaded as any).daily = { date: dateStr };
        await vault.save(loaded);

        const savedNote = vault.read(pastNote.id);
        const displayTitle = getDisplayTitle(savedNote);

        expect(displayTitle).toBe('01/15/2024');
      });

      it('should store MM-dd-yyyy date but display formatted date', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        // Stored title is MM-dd-yyyy format
        expect(dailyNote.title).toMatch(/^\d{2}-\d{2}-\d{4}$/);

        // Display title is user-friendly format
        const displayTitle = getDisplayTitle(dailyNote);
        expect(displayTitle).toBe('Today'); // or formatted date
      });
    });

    describe('Find by Date', () => {
      it('should find existing daily note by date', async () => {
        const today = new Date();
        const dateStr = format(today, 'MM-dd-yyyy');

        await dailyGetOrCreate(vault, graphEngine, searchEngine);

        const found = dailyFind(vault, dateStr);
        expect(found).not.toBeNull();
        expect(found?.title).toBe(dateStr);
      });

      it('should return null for non-existent daily note', async () => {
        const found = dailyFind(vault, '12-31-2099');
        expect(found).toBeNull();
      });
    });

    describe('Persistence', () => {
      it('should persist daily note across vault reload', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);
        const noteId = dailyNote.id;

        // Simulate restart
        const newVault = await simulateAppRestart(tempDir);

        const loaded = newVault.read(noteId);
        expect(loaded).toBeDefined();
        expect(loaded.type).toBe('daily');
        expect(loaded.tags).toContain('daily');
        expect(loaded.daily?.date).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // Meeting Notes Tests
  // ===========================================================================

  describe('Meeting Notes', () => {
    describe('Creation via API', () => {
      it('should create meeting with correct structure', async () => {
        const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Team Standup');

        expect(meeting.type).toBe('meeting');
        expect(meeting.title).toBe('Team Standup');
        expect(meeting.tags).toContain('meeting');
        expect(meeting.content.type).toBe('meeting');
      });

      it('should create meeting content with H3 sections and bullet lists (no H1)', async () => {
        const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Project Sync');

        const rootChildren = meeting.content.root.children;

        // Should have 6 children: H3, list, H3, list, H3, list
        expect(rootChildren.length).toBe(6);

        // Verify section structure
        const sections = ['Pre-Read', 'Notes', 'Action Items'];
        for (let i = 0; i < 3; i++) {
          const heading = rootChildren[i * 2] as any;
          const list = rootChildren[i * 2 + 1] as any;

          expect(heading.type).toBe('heading');
          expect(heading.tag).toBe('h3');
          expect(heading.children[0].text).toBe(sections[i]);

          expect(list.type).toBe('list');
          expect(list.listType).toBe('bullet');
        }

        // No H1 heading
        const hasH1 = rootChildren.some(
          (child: any) => child.type === 'heading' && child.tag === 'h1'
        );
        expect(hasH1).toBe(false);
      });

      it('should require a title for meeting creation', async () => {
        await expect(meetingCreate(vault, graphEngine, searchEngine, '')).rejects.toThrow(
          'Meeting title required'
        );

        await expect(meetingCreate(vault, graphEngine, searchEngine, '   ')).rejects.toThrow(
          'Meeting title required'
        );
      });

      it('should trim meeting title', async () => {
        const meeting = await meetingCreate(vault, graphEngine, searchEngine, '  Weekly Review  ');

        expect(meeting.title).toBe('Weekly Review');
      });
    });

    describe('Daily Note Linking', () => {
      it('should auto-create daily note if needed', async () => {
        // Verify no daily note exists
        const today = new Date();
        const dateStr = format(today, 'MM-dd-yyyy');
        let dailyNote = dailyFind(vault, dateStr);
        expect(dailyNote).toBeNull();

        // Create meeting
        await meetingCreate(vault, graphEngine, searchEngine, 'Team Meeting');

        // Daily note should now exist
        dailyNote = dailyFind(vault, dateStr);
        expect(dailyNote).not.toBeNull();
        expect(dailyNote?.type).toBe('daily');
      });

      it('should link meeting to existing daily note via dailyNoteId', async () => {
        // First create a daily note
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        // Then create a meeting
        const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Planning Session');

        // Meeting should link to the existing daily note
        expect(meeting.meeting?.dailyNoteId).toBe(dailyNote.id);
      });

      it('should store meeting date as MM-dd-yyyy string', async () => {
        const today = new Date();
        const dateStr = format(today, 'MM-dd-yyyy');

        const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Sprint Review');

        expect(meeting.meeting?.date).toBe(dateStr);
      });

      it('should create multiple meetings linked to same daily note', async () => {
        const meeting1 = await meetingCreate(vault, graphEngine, searchEngine, 'Morning Standup');
        const meeting2 = await meetingCreate(vault, graphEngine, searchEngine, 'Afternoon Sync');

        // Both should link to the same daily note
        expect(meeting1.meeting?.dailyNoteId).toBe(meeting2.meeting?.dailyNoteId);

        // Only one daily note should exist
        const dailyNotes = vault.list().filter((n) => n.type === 'daily');
        expect(dailyNotes.length).toBe(1);
      });
    });

    describe('Persistence', () => {
      it('should persist meeting note across vault reload', async () => {
        const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Quarterly Review');
        const meetingId = meeting.id;
        const dailyNoteId = meeting.meeting?.dailyNoteId;

        // Simulate restart
        const newVault = await simulateAppRestart(tempDir);

        const loaded = newVault.read(meetingId);
        expect(loaded).toBeDefined();
        expect(loaded.type).toBe('meeting');
        expect(loaded.title).toBe('Quarterly Review');
        expect(loaded.meeting?.dailyNoteId).toBe(dailyNoteId);
        expect(loaded.meeting?.attendees).toEqual([]);
      });
    });
  });

  // ===========================================================================
  // Attendees Tests
  // ===========================================================================

  describe('Attendees', () => {
    let meeting: Note;
    let alice: Note;
    let bob: Note;

    beforeEach(async () => {
      // Create a meeting
      meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Team Sync');

      // Create some people
      alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
        title: 'Alice',
      });
      bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
        title: 'Bob',
      });

      indexNoteInEngines(ctx, alice);
      indexNoteInEngines(ctx, bob);
    });

    describe('Add Attendee', () => {
      it('should add attendee to meeting', async () => {
        const result = await meetingAddAttendee(vault, meeting.id, alice.id);

        expect(result.success).toBe(true);

        const updated = vault.read(meeting.id);
        expect(updated.meeting?.attendees).toContain(alice.id);
        expect(updated.meeting?.attendees.length).toBe(1);
      });

      it('should add multiple attendees to meeting', async () => {
        await meetingAddAttendee(vault, meeting.id, alice.id);
        await meetingAddAttendee(vault, meeting.id, bob.id);

        const updated = vault.read(meeting.id);
        expect(updated.meeting?.attendees).toContain(alice.id);
        expect(updated.meeting?.attendees).toContain(bob.id);
        expect(updated.meeting?.attendees.length).toBe(2);
      });

      it('should fail when adding attendee to non-meeting note', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        await expect(meetingAddAttendee(vault, dailyNote.id, alice.id)).rejects.toThrow(
          'Note is not a meeting'
        );
      });
    });

    describe('Remove Attendee', () => {
      it('should remove attendee from meeting', async () => {
        // Add then remove
        await meetingAddAttendee(vault, meeting.id, alice.id);
        await meetingAddAttendee(vault, meeting.id, bob.id);

        const result = await meetingRemoveAttendee(vault, meeting.id, alice.id);
        expect(result.success).toBe(true);

        const updated = vault.read(meeting.id);
        expect(updated.meeting?.attendees).not.toContain(alice.id);
        expect(updated.meeting?.attendees).toContain(bob.id);
        expect(updated.meeting?.attendees.length).toBe(1);
      });

      it('should handle removing non-existent attendee gracefully', async () => {
        // No attendees yet
        const result = await meetingRemoveAttendee(vault, meeting.id, alice.id);

        expect(result.success).toBe(true);

        const updated = vault.read(meeting.id);
        expect(updated.meeting?.attendees.length).toBe(0);
      });

      it('should fail when removing attendee from non-meeting note', async () => {
        const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

        await expect(meetingRemoveAttendee(vault, dailyNote.id, alice.id)).rejects.toThrow(
          'Note is not a meeting'
        );
      });
    });

    describe('Idempotency', () => {
      it('should be idempotent for duplicate adds', async () => {
        await meetingAddAttendee(vault, meeting.id, alice.id);
        await meetingAddAttendee(vault, meeting.id, alice.id);
        await meetingAddAttendee(vault, meeting.id, alice.id);

        const updated = vault.read(meeting.id);
        expect(updated.meeting?.attendees.length).toBe(1);
        expect(updated.meeting?.attendees).toContain(alice.id);
      });

      it('should be idempotent for duplicate removes', async () => {
        await meetingAddAttendee(vault, meeting.id, alice.id);

        await meetingRemoveAttendee(vault, meeting.id, alice.id);
        await meetingRemoveAttendee(vault, meeting.id, alice.id);

        const updated = vault.read(meeting.id);
        expect(updated.meeting?.attendees.length).toBe(0);
      });
    });

    describe('Persistence', () => {
      it('should persist attendees across vault reload', async () => {
        await meetingAddAttendee(vault, meeting.id, alice.id);
        await meetingAddAttendee(vault, meeting.id, bob.id);

        // Simulate restart
        const newVault = await simulateAppRestart(tempDir);

        const loaded = newVault.read(meeting.id);
        expect(loaded.meeting?.attendees).toContain(alice.id);
        expect(loaded.meeting?.attendees).toContain(bob.id);
        expect(loaded.meeting?.attendees.length).toBe(2);
      });
    });
  });

  // ===========================================================================
  // Complete User Journey Tests
  // ===========================================================================

  describe('Complete Templates Workflow', () => {
    it('should handle full daily note + meeting workflow', async () => {
      // Step 1: Create daily note via "Today" command
      const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);
      expect(dailyNote.type).toBe('daily');
      expect(getDisplayTitle(dailyNote)).toBe('Today');

      // Step 2: Create a meeting note
      const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Sprint Planning');

      // Verify meeting links to daily note
      expect(meeting.meeting?.dailyNoteId).toBe(dailyNote.id);

      // Step 3: Add attendees to meeting
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
        title: 'Alice',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
        title: 'Bob',
      });

      await meetingAddAttendee(vault, meeting.id, alice.id);
      await meetingAddAttendee(vault, meeting.id, bob.id);

      // Step 4: Verify all data
      const updatedMeeting = vault.read(meeting.id);
      expect(updatedMeeting.meeting?.attendees.length).toBe(2);
      expect(updatedMeeting.meeting?.attendees).toContain(alice.id);
      expect(updatedMeeting.meeting?.attendees).toContain(bob.id);

      // Step 5: "Today" command returns existing daily note (idempotent)
      const sameDailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);
      expect(sameDailyNote.id).toBe(dailyNote.id);

      // Step 6: Create another meeting (same day)
      const meeting2 = await meetingCreate(vault, graphEngine, searchEngine, 'Design Review');
      expect(meeting2.meeting?.dailyNoteId).toBe(dailyNote.id);

      // Verify only one daily note exists
      const dailyNotes = vault.list().filter((n) => n.type === 'daily');
      expect(dailyNotes.length).toBe(1);

      // Verify two meetings exist
      const meetings = vault.list().filter((n) => n.type === 'meeting');
      expect(meetings.length).toBe(2);
    });

    it('should handle data persistence across restart', async () => {
      // Create everything
      const dailyNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);
      const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Persistent Meeting');

      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
        title: 'Alice',
      });

      await meetingAddAttendee(vault, meeting.id, alice.id);

      // Simulate restart
      const newVault = await simulateAppRestart(tempDir);
      const newGraphEngine = new GraphEngine();
      const newSearchEngine = new SearchEngine();

      // Rebuild indexes
      for (const note of newVault.list()) {
        newGraphEngine.addNote(note);
        newSearchEngine.indexNote(note);
      }

      // Verify daily note
      const loadedDaily = newVault.read(dailyNote.id);
      expect(loadedDaily.type).toBe('daily');
      expect(loadedDaily.daily?.date).toBeDefined();

      // Verify meeting
      const loadedMeeting = newVault.read(meeting.id);
      expect(loadedMeeting.type).toBe('meeting');
      expect(loadedMeeting.meeting?.dailyNoteId).toBe(dailyNote.id);
      expect(loadedMeeting.meeting?.attendees).toContain(alice.id);

      // Verify search works
      const searchResults = newSearchEngine.search('Persistent');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].id).toBe(meeting.id);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle meeting with deleted daily note', async () => {
      // Create meeting (which creates daily note)
      const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Orphan Meeting');
      const dailyNoteId = meeting.meeting?.dailyNoteId;

      // Delete the daily note
      await vault.delete(dailyNoteId!);

      // Meeting should still be accessible
      const loadedMeeting = vault.read(meeting.id);
      expect(loadedMeeting).toBeDefined();
      expect(loadedMeeting.type).toBe('meeting');

      // Meeting still has stale dailyNoteId reference
      expect(loadedMeeting.meeting?.dailyNoteId).toBe(dailyNoteId);

      // But the daily note no longer exists
      expect(() => vault.read(dailyNoteId!)).toThrow();
    });

    it('should handle meeting with deleted attendee', async () => {
      const meeting = await meetingCreate(vault, graphEngine, searchEngine, 'Ghost Attendee');

      const person = await vault.create({
        content: createPersonContent('Ghost'),
        type: 'person',
        title: 'Ghost',
      });

      await meetingAddAttendee(vault, meeting.id, person.id);

      // Delete the person
      await vault.delete(person.id);

      // Meeting should still be accessible
      const loadedMeeting = vault.read(meeting.id);
      expect(loadedMeeting).toBeDefined();

      // Meeting still has stale attendee ID
      expect(loadedMeeting.meeting?.attendees).toContain(person.id);

      // But the person no longer exists
      expect(() => vault.read(person.id)).toThrow();
    });

    it('should handle creating multiple daily notes for different dates', async () => {
      // Create today's daily note
      const todayNote = await dailyGetOrCreate(vault, graphEngine, searchEngine);

      // Manually create yesterday's daily note
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = format(yesterday, 'MM-dd-yyyy');

      const yesterdayContent = createDailyContent();
      const yesterdayNote = await vault.create({
        type: 'daily',
        title: yesterdayStr,
        tags: ['daily'],
        content: yesterdayContent,
      });

      // Both should exist
      const dailyNotes = vault.list().filter((n) => n.type === 'daily');
      expect(dailyNotes.length).toBe(2);

      // Today should render as "Today"
      expect(getDisplayTitle(todayNote)).toBe('Today');

      // Yesterday should render as formatted date
      const loadedYesterday = vault.read(yesterdayNote.id);
      expect(getDisplayTitle(loadedYesterday)).toBe(format(yesterday, 'MM/dd/yyyy'));
    });
  });
});
