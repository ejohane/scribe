import { describe, it, expect } from 'vitest';
import { createDailyContent, getDailyDisplayTitle, dailyTemplate } from './daily';
import { format, subDays, addDays } from 'date-fns';
import type { DailyNote } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create mock daily note
function mockDailyNote(isoDate: string): DailyNote {
  return {
    id: createNoteId('test-id'),
    title: isoDate,
    type: 'daily',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: ['daily'],
    content: createDailyContent(),
    metadata: { title: null, tags: [], links: [], mentions: [] },
    daily: { date: isoDate },
  };
}

describe('dailyTemplate', () => {
  describe('getDailyDisplayTitle', () => {
    it("returns 'Today' for today's note", () => {
      const today = format(new Date(), 'MM-dd-yyyy');
      const note = mockDailyNote(today);
      expect(getDailyDisplayTitle(note)).toBe('Today');
    });

    it('returns MM/dd/yyyy for yesterday', () => {
      const yesterday = subDays(new Date(), 1);
      const dateStr = format(yesterday, 'MM-dd-yyyy');
      const note = mockDailyNote(dateStr);
      expect(getDailyDisplayTitle(note)).toBe(format(yesterday, 'MM/dd/yyyy'));
    });

    it('returns MM/dd/yyyy for future dates', () => {
      const tomorrow = addDays(new Date(), 1);
      const dateStr = format(tomorrow, 'MM-dd-yyyy');
      const note = mockDailyNote(dateStr);
      expect(getDailyDisplayTitle(note)).toBe(format(tomorrow, 'MM/dd/yyyy'));
    });

    it('returns raw title for invalid dates', () => {
      const note = mockDailyNote('not-a-date');
      expect(getDailyDisplayTitle(note)).toBe('not-a-date');
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
