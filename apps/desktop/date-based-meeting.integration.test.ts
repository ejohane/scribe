/**
 * Integration Tests for Meeting Creation with Date Selection
 *
 * Tests the meeting creation logic with the optional date parameter,
 * validating that meetings can be created for past, present, and future dates.
 *
 * Tests cover:
 * - Creating meetings for today (default behavior)
 * - Creating meetings for past dates
 * - Creating meetings for future dates
 * - Multiple meetings on the same date sharing a daily note
 * - Invalid date handling
 * - Backward compatibility with existing calls
 *
 * Issue: scribe-3na.10
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format, subDays, addDays, parse, isValid } from 'date-fns';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { MeetingNote } from '@scribe/shared';
import { isMeetingNote, ScribeError, ErrorCode } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createDailyContent,
  createMeetingContent,
} from './test-helpers';

/**
 * Simulates the meeting creation handler logic.
 * This mimics what meetingHandlers.ts does for 'meeting:create'.
 */
async function createMeeting(
  vault: FileSystemVault,
  graphEngine: GraphEngine,
  searchEngine: SearchEngine,
  params: { title: string; date?: string }
): Promise<MeetingNote> {
  const { title, date } = params;

  if (!title?.trim()) {
    throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Meeting title required');
  }

  // Parse date parameter or default to today
  let targetDate: Date;
  const effectiveDate = date?.trim() || undefined;
  if (effectiveDate) {
    // Parse ISO date string (YYYY-MM-DD)
    targetDate = parse(effectiveDate, 'yyyy-MM-dd', new Date());
    if (!isValid(targetDate)) {
      throw new ScribeError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid date format: "${date}". Expected YYYY-MM-DD (e.g., "2025-12-25").`
      );
    }
  } else {
    targetDate = new Date(); // Default to today
  }

  const dateStr = format(targetDate, 'MM-dd-yyyy');

  // Ensure daily note exists (create if needed)
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

  return note as MeetingNote;
}

describe('Meeting Creation with Date Selection', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-date-meeting-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // Default Behavior (Today)
  // ===========================================================================

  describe('Default behavior (today)', () => {
    it('should create meeting for today when no date specified', async () => {
      const title = 'Sprint Planning';

      const note = await createMeeting(vault, graphEngine, searchEngine, { title });

      expect(note.type).toBe('meeting');
      expect(note.title).toBe(title);
      expect(note.meeting.date).toBe(format(new Date(), 'MM-dd-yyyy'));

      // Verify daily note was created for today
      const dailyNote = vault.read(note.meeting.dailyNoteId);
      expect(dailyNote.type).toBe('daily');
      expect(dailyNote.title).toBe(format(new Date(), 'MM-dd-yyyy'));
    });

    it('should treat empty string date as today', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Test Meeting',
        date: '',
      });

      expect(note.meeting.date).toBe(format(new Date(), 'MM-dd-yyyy'));
    });

    it('should treat whitespace-only date as today', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Test Meeting',
        date: '   ',
      });

      expect(note.meeting.date).toBe(format(new Date(), 'MM-dd-yyyy'));
    });
  });

  // ===========================================================================
  // Past Date
  // ===========================================================================

  describe('Past date', () => {
    it('should create meeting for a past date', async () => {
      const pastDate = subDays(new Date(), 7); // 7 days ago
      const isoDate = format(pastDate, 'yyyy-MM-dd');

      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Retro',
        date: isoDate,
      });

      expect(note.meeting.date).toBe(format(pastDate, 'MM-dd-yyyy'));

      // Verify correct daily note was created
      const dailyNote = vault.read(note.meeting.dailyNoteId);
      expect(dailyNote.title).toBe(format(pastDate, 'MM-dd-yyyy'));
    });

    it('should create meeting for a date in the previous year', async () => {
      const isoDate = '2024-01-15';

      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Old Meeting',
        date: isoDate,
      });

      expect(note.meeting.date).toBe('01-15-2024');
    });
  });

  // ===========================================================================
  // Future Date
  // ===========================================================================

  describe('Future date', () => {
    it('should create meeting for a future date', async () => {
      const futureDate = addDays(new Date(), 14); // 2 weeks from now
      const isoDate = format(futureDate, 'yyyy-MM-dd');

      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Planning',
        date: isoDate,
      });

      expect(note.meeting.date).toBe(format(futureDate, 'MM-dd-yyyy'));
    });

    it('should create meeting for a date in the next year', async () => {
      const isoDate = '2026-12-25';

      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Christmas Planning',
        date: isoDate,
      });

      expect(note.meeting.date).toBe('12-25-2026');
    });
  });

  // ===========================================================================
  // Multiple Meetings Same Date
  // ===========================================================================

  describe('Multiple meetings on same date', () => {
    it('should reuse daily note for multiple meetings on same date', async () => {
      const date = '2025-12-25';

      const meeting1 = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Meeting 1',
        date,
      });
      const meeting2 = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Meeting 2',
        date,
      });

      // Both should link to same daily note
      expect(meeting1.meeting.dailyNoteId).toBe(meeting2.meeting.dailyNoteId);

      // Only one daily note should exist for that date
      const dailyNotes = vault.list().filter((n) => n.type === 'daily' && n.title === '12-25-2025');
      expect(dailyNotes).toHaveLength(1);
    });

    it('should create separate meetings with unique IDs', async () => {
      const date = '2025-06-15';

      const meeting1 = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Standup',
        date,
      });
      const meeting2 = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Planning',
        date,
      });
      const meeting3 = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Retro',
        date,
      });

      // All meetings should have unique IDs
      const ids = [meeting1.id, meeting2.id, meeting3.id];
      expect(new Set(ids).size).toBe(3);

      // All meetings should share the same daily note
      expect(meeting1.meeting.dailyNoteId).toBe(meeting2.meeting.dailyNoteId);
      expect(meeting2.meeting.dailyNoteId).toBe(meeting3.meeting.dailyNoteId);
    });
  });

  // ===========================================================================
  // Invalid Date Handling
  // ===========================================================================

  describe('Invalid date handling', () => {
    it('should reject invalid date format', async () => {
      await expect(
        createMeeting(vault, graphEngine, searchEngine, {
          title: 'Test',
          date: 'invalid-date',
        })
      ).rejects.toThrow(/Invalid date format/);
    });

    it('should reject invalid date values (month out of range)', async () => {
      await expect(
        createMeeting(vault, graphEngine, searchEngine, {
          title: 'Test',
          date: '2025-13-45',
        })
      ).rejects.toThrow(/Invalid date format/);
    });

    it('should reject date in wrong format (MM-dd-yyyy)', async () => {
      await expect(
        createMeeting(vault, graphEngine, searchEngine, {
          title: 'Test',
          date: '12-25-2025', // Wrong format - should be 2025-12-25
        })
      ).rejects.toThrow(/Invalid date format/);
    });

    it('should reject date with slashes', async () => {
      await expect(
        createMeeting(vault, graphEngine, searchEngine, {
          title: 'Test',
          date: '2025/12/25',
        })
      ).rejects.toThrow(/Invalid date format/);
    });

    it('should throw VALIDATION_ERROR for invalid dates', async () => {
      try {
        await createMeeting(vault, graphEngine, searchEngine, {
          title: 'Test',
          date: 'not-a-date',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ScribeError);
        expect((error as ScribeError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });
  });

  // ===========================================================================
  // Backward Compatibility
  // ===========================================================================

  describe('Backward compatibility', () => {
    it('should maintain backward compatibility with existing calls (no date param)', async () => {
      // Old signature: just title
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Old Style Meeting',
      });

      // Should default to today
      expect(note.meeting.date).toBe(format(new Date(), 'MM-dd-yyyy'));
    });

    it('should maintain backward compatibility with undefined date', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Another Old Style',
        date: undefined,
      });

      expect(note.meeting.date).toBe(format(new Date(), 'MM-dd-yyyy'));
    });
  });

  // ===========================================================================
  // Meeting Content and Structure
  // ===========================================================================

  describe('Meeting content and structure', () => {
    it('should create meeting with proper content structure regardless of date', async () => {
      const futureDate = '2025-07-04';
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Holiday Planning',
        date: futureDate,
      });

      // Verify content is a blank page with single empty paragraph
      const children = note.content.root.children;
      expect(children.length).toBe(1);

      // First child should be an empty paragraph
      const firstChild = children[0] as { type: string; children: unknown[] };
      expect(firstChild.type).toBe('paragraph');
      expect(firstChild.children).toEqual([]);
    });

    it('should initialize meeting with empty attendees for any date', async () => {
      const pastDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Past Meeting',
        date: pastDate,
      });

      expect(isMeetingNote(note)).toBe(true);
      expect(note.meeting.attendees).toEqual([]);
    });

    it('should trim meeting title', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: '  Trimmed Title  ',
        date: '2025-05-15',
      });

      expect(note.title).toBe('Trimmed Title');
    });
  });

  // ===========================================================================
  // Title Validation
  // ===========================================================================

  describe('Title validation', () => {
    it('should throw error for empty title', async () => {
      await expect(
        createMeeting(vault, graphEngine, searchEngine, {
          title: '',
          date: '2025-12-25',
        })
      ).rejects.toThrow('Meeting title required');
    });

    it('should throw error for whitespace-only title', async () => {
      await expect(
        createMeeting(vault, graphEngine, searchEngine, {
          title: '   ',
          date: '2025-12-25',
        })
      ).rejects.toThrow('Meeting title required');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge cases', () => {
    it('should handle leap year date', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'Leap Day Meeting',
        date: '2024-02-29', // 2024 is a leap year
      });

      expect(note.meeting.date).toBe('02-29-2024');
    });

    it('should handle end of year date', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'New Years Eve Planning',
        date: '2025-12-31',
      });

      expect(note.meeting.date).toBe('12-31-2025');
    });

    it('should handle start of year date', async () => {
      const note = await createMeeting(vault, graphEngine, searchEngine, {
        title: 'New Years Day Retro',
        date: '2025-01-01',
      });

      expect(note.meeting.date).toBe('01-01-2025');
    });
  });
});
