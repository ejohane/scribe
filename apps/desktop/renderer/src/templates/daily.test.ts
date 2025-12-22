import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDailyContent, getDailyDisplayTitle, dailyTemplate } from './daily';
import { format } from 'date-fns';
import type { DailyNote } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create mock daily note
function mockDailyNote(dateStr: string): DailyNote {
  return {
    id: createNoteId('test-id'),
    title: dateStr,
    type: 'daily',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: ['daily'],
    content: createDailyContent(),
    metadata: { title: null, tags: [], links: [], mentions: [] },
    daily: { date: dateStr },
  };
}

describe('dailyTemplate', () => {
  describe('getDailyDisplayTitle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Set a fixed date for deterministic tests: December 21, 2024 at noon
      vi.setSystemTime(new Date('2024-12-21T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('relative date display', () => {
      it("returns 'Today' for today's note", () => {
        const note = mockDailyNote('12-21-2024');
        expect(getDailyDisplayTitle(note)).toBe('Today');
      });

      it("returns 'Yesterday' for yesterday's note", () => {
        const note = mockDailyNote('12-20-2024');
        expect(getDailyDisplayTitle(note)).toBe('Yesterday');
      });

      it("returns 'Tomorrow' for tomorrow's note", () => {
        const note = mockDailyNote('12-22-2024');
        expect(getDailyDisplayTitle(note)).toBe('Tomorrow');
      });
    });

    describe('ordinal date format', () => {
      it('returns ordinal format for two days ago', () => {
        const note = mockDailyNote('12-19-2024');
        expect(getDailyDisplayTitle(note)).toBe('Dec 19th, 2024');
      });

      it('returns ordinal format for a week ago', () => {
        const note = mockDailyNote('12-14-2024');
        expect(getDailyDisplayTitle(note)).toBe('Dec 14th, 2024');
      });

      it('returns ordinal format for future dates beyond tomorrow', () => {
        const note = mockDailyNote('12-28-2024');
        expect(getDailyDisplayTitle(note)).toBe('Dec 28th, 2024');
      });

      it('returns ordinal format for historical dates', () => {
        const note = mockDailyNote('07-28-1990');
        expect(getDailyDisplayTitle(note)).toBe('Jul 28th, 1990');
      });
    });

    describe('ordinal suffix edge cases', () => {
      it('uses "1st" suffix correctly', () => {
        const note = mockDailyNote('01-01-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 1st, 2024');
      });

      it('uses "2nd" suffix correctly', () => {
        const note = mockDailyNote('01-02-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 2nd, 2024');
      });

      it('uses "3rd" suffix correctly', () => {
        const note = mockDailyNote('01-03-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 3rd, 2024');
      });

      it('uses "4th" suffix correctly', () => {
        const note = mockDailyNote('01-04-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 4th, 2024');
      });

      it('uses "11th" (exception) correctly', () => {
        const note = mockDailyNote('01-11-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 11th, 2024');
      });

      it('uses "12th" (exception) correctly', () => {
        const note = mockDailyNote('01-12-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 12th, 2024');
      });

      it('uses "13th" (exception) correctly', () => {
        const note = mockDailyNote('01-13-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 13th, 2024');
      });

      it('uses "21st" suffix correctly', () => {
        const note = mockDailyNote('01-21-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 21st, 2024');
      });

      it('uses "22nd" suffix correctly', () => {
        const note = mockDailyNote('01-22-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 22nd, 2024');
      });

      it('uses "23rd" suffix correctly', () => {
        const note = mockDailyNote('01-23-2024');
        expect(getDailyDisplayTitle(note)).toBe('Jan 23rd, 2024');
      });
    });

    describe('error handling', () => {
      it('returns raw title for invalid date string', () => {
        const note = mockDailyNote('not-a-date');
        expect(getDailyDisplayTitle(note)).toBe('not-a-date');
      });

      it('returns raw title for malformed date', () => {
        const note = mockDailyNote('13-45-2024');
        expect(getDailyDisplayTitle(note)).toBe('13-45-2024');
      });
    });

    describe('timezone behavior', () => {
      it('uses local timezone for Today/Yesterday/Tomorrow comparisons', () => {
        // date-fns isToday/isYesterday/isTomorrow compare against local midnight.
        // This test verifies that the current date (12-21-2024 at noon) shows "Today"
        const note = mockDailyNote('12-21-2024');
        expect(getDailyDisplayTitle(note)).toBe('Today');
      });

      it('shows Today at 11:59 PM (1 minute before midnight)', () => {
        // Reset to 11:59 PM on Dec 21st - still "Today" even though midnight is imminent
        vi.setSystemTime(new Date('2024-12-21T23:59:00'));
        const note = mockDailyNote('12-21-2024');
        expect(getDailyDisplayTitle(note)).toBe('Today');
      });

      it('shows Yesterday after midnight for previous day note', () => {
        // At 12:01 AM on Dec 22nd, Dec 21st's note should show "Yesterday"
        vi.setSystemTime(new Date('2024-12-22T00:01:00'));
        const note = mockDailyNote('12-21-2024');
        expect(getDailyDisplayTitle(note)).toBe('Yesterday');
      });

      it('does not auto-update title at midnight', () => {
        // This test documents expected behavior: the title is a snapshot of when
        // getDailyDisplayTitle is called, not a live-updating value.
        // If user has note open at 11:59 PM and clock ticks to 12:00 AM,
        // the title only updates on next navigation or re-render.
        vi.setSystemTime(new Date('2024-12-21T23:59:59'));
        const note = mockDailyNote('12-21-2024');
        expect(getDailyDisplayTitle(note)).toBe('Today');

        // Simulate midnight transition
        vi.setSystemTime(new Date('2024-12-22T00:00:01'));
        // Re-calling the function now returns different result
        expect(getDailyDisplayTitle(note)).toBe('Yesterday');
      });
    });
  });

  describe('createDailyContent', () => {
    it('creates content with empty bullet list', () => {
      const content = createDailyContent();
      expect(content.root.children).toHaveLength(1);
      expect((content.root.children[0] as { type: string }).type).toBe('list');
    });

    it('has type: daily on content', () => {
      const content = createDailyContent();
      expect(content.type).toBe('daily');
    });

    it('has no H1 heading', () => {
      const content = createDailyContent();
      const hasH1 = content.root.children.some(
        (child) =>
          (child as { type: string; tag?: string }).type === 'heading' &&
          (child as { type: string; tag?: string }).tag === 'h1'
      );
      expect(hasH1).toBe(false);
    });
  });

  describe('template config', () => {
    it('generates MM-dd-yyyy date title', () => {
      // Use explicit year, month (0-indexed), day to avoid timezone issues
      const date = new Date(2024, 11, 2); // December 2, 2024
      expect(dailyTemplate.generateTitle({ date })).toBe('12-02-2024');
    });

    it('has correct context panel sections', () => {
      const sectionTypes = dailyTemplate.contextPanelConfig.sections.map((s) => s.type);
      expect(sectionTypes).toEqual(['linked-mentions', 'tasks', 'references', 'calendar']);
    });

    it('is date searchable', () => {
      expect(dailyTemplate.dateSearchable).toBe(true);
    });
  });
});
