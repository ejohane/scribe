/**
 * Integration Tests for Daily Note Handlers
 *
 * Tests the daily note handler logic through the data layer packages.
 * Since IPC handlers are thin wrappers around vault/engine calls,
 * testing the underlying operations validates the handler behavior.
 *
 * Tests cover:
 * - daily:getOrCreate - Get or create today's daily note
 * - daily:find - Find daily note by date
 *
 * Issue: scribe-q3n.10
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { EditorContent } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
} from './test-helpers';

/**
 * Create initial content for daily notes (mirrors handler implementation)
 */
function createDailyContent(): EditorContent {
  return {
    root: {
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
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'daily',
  } as EditorContent;
}

describe('Daily Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-daily-handler-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // daily:getOrCreate Tests
  // ===========================================================================

  describe('daily:getOrCreate logic', () => {
    it('should create daily note for today if none exists', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Simulate handler logic
      const notes = vault.list();
      const existing = notes.find((n) => n.type === 'daily' && n.title === dateStr);
      expect(existing).toBeUndefined();

      // Create new daily note
      const content = createDailyContent();
      const createdAt = new Date(today);
      createdAt.setHours(12, 0, 0, 0);

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content,
        daily: { date: dateStr },
        createdAt: createdAt.getTime(),
      });

      expect(note.type).toBe('daily');
      expect(note.title).toBe(dateStr);
      // Tags are stored in the note directly, not in metadata
      expect(note.tags).toContain('daily');
    });

    it('should return existing daily note if one exists', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create first daily note
      const content = createDailyContent();
      const note1 = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content,
        daily: { date: dateStr },
      });

      // Simulate second call - should find existing
      const notes = vault.list();
      const existing = notes.find((n) => n.type === 'daily' && n.title === dateStr);

      expect(existing).toBeDefined();
      expect(existing?.id).toBe(note1.id);
    });

    it('should create daily note for specific date', async () => {
      const specificDate = new Date('2024-06-15');
      const dateStr = format(specificDate, 'MM-dd-yyyy');

      const content = createDailyContent();
      const createdAt = new Date(specificDate);
      createdAt.setHours(12, 0, 0, 0);

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content,
        daily: { date: dateStr },
        createdAt: createdAt.getTime(),
      });

      expect(note.title).toBe('06-15-2024');
      expect(note.type).toBe('daily');
    });

    it('should set createdAt to noon on target date', async () => {
      const specificDate = new Date('2024-03-20');
      const dateStr = format(specificDate, 'MM-dd-yyyy');

      const createdAt = new Date(specificDate);
      createdAt.setHours(12, 0, 0, 0);

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
        createdAt: createdAt.getTime(),
      });

      const noteDate = new Date(note.createdAt);
      expect(noteDate.getHours()).toBe(12);
      expect(noteDate.getMinutes()).toBe(0);
    });

    it('should index new daily note in engines', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Index in engines (mimicking handler behavior)
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      // Verify indexed
      const tagResults = graphEngine.notesWithTag('daily');
      expect(tagResults.some((n) => n.id === note.id)).toBe(true);
    });

    it('should create daily notes for multiple different dates', async () => {
      const dates = ['2024-01-15', '2024-02-20', '2024-03-25'];

      for (const dateInput of dates) {
        const date = new Date(dateInput);
        const dateStr = format(date, 'MM-dd-yyyy');

        await vault.create({
          type: 'daily',
          title: dateStr,
          content: createDailyContent(),
          daily: { date: dateStr },
        });
      }

      const dailyNotes = vault.list().filter((n) => n.type === 'daily');
      expect(dailyNotes).toHaveLength(3);
    });
  });

  // ===========================================================================
  // daily:find Tests
  // ===========================================================================

  describe('daily:find logic', () => {
    it('should find daily note by date string', async () => {
      const dateStr = '01-15-2024';

      // Create daily note
      await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Find it
      const notes = vault.list();
      const found = notes.find((n) => n.type === 'daily' && n.title === dateStr);

      expect(found).toBeDefined();
      expect(found?.title).toBe(dateStr);
    });

    it('should return null for non-existent date', () => {
      const dateStr = '12-31-2099';

      const notes = vault.list();
      const found = notes.find((n) => n.type === 'daily' && n.title === dateStr) ?? null;

      expect(found).toBeNull();
    });

    it('should not match regular notes with date-like titles', async () => {
      const dateStr = '01-15-2024';

      // Create regular note with date-like title
      await vault.create({
        title: dateStr,
        // No type: 'daily'
      });

      // Should not find as daily note
      const notes = vault.list();
      const found = notes.find((n) => n.type === 'daily' && n.title === dateStr) ?? null;

      expect(found).toBeNull();
    });

    it('should find correct daily note among multiple', async () => {
      const dates = ['01-10-2024', '01-15-2024', '01-20-2024'];

      for (const dateStr of dates) {
        await vault.create({
          type: 'daily',
          title: dateStr,
          content: createDailyContent(),
          daily: { date: dateStr },
        });
      }

      // Find specific date
      const targetDate = '01-15-2024';
      const notes = vault.list();
      const found = notes.find((n) => n.type === 'daily' && n.title === targetDate);

      expect(found).toBeDefined();
      expect(found?.title).toBe(targetDate);
    });
  });

  // ===========================================================================
  // Daily Note List Tests (date range filtering)
  // ===========================================================================

  describe('daily:list logic (date range)', () => {
    beforeEach(async () => {
      // Create daily notes for a week
      const dates = [
        '01-01-2024',
        '01-02-2024',
        '01-03-2024',
        '01-04-2024',
        '01-05-2024',
        '01-06-2024',
        '01-07-2024',
      ];

      for (const dateStr of dates) {
        await vault.create({
          type: 'daily',
          title: dateStr,
          content: createDailyContent(),
          daily: { date: dateStr },
        });
      }
    });

    it('should list all daily notes', () => {
      const dailyNotes = vault.list().filter((n) => n.type === 'daily');
      expect(dailyNotes).toHaveLength(7);
    });

    it('should filter daily notes by date range', () => {
      const startDate = '01-03-2024';
      const endDate = '01-05-2024';

      const dailyNotes = vault.list().filter((n) => {
        if (n.type !== 'daily') return false;
        const title = n.title ?? '';
        return title >= startDate && title <= endDate;
      });

      expect(dailyNotes).toHaveLength(3);
    });

    it('should sort daily notes by date', () => {
      const dailyNotes = vault
        .list()
        .filter((n) => n.type === 'daily')
        .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));

      expect(dailyNotes[0].title).toBe('01-01-2024');
      expect(dailyNotes[6].title).toBe('01-07-2024');
    });

    it('should return empty for date range with no notes', () => {
      const startDate = '12-01-2024';
      const endDate = '12-31-2024';

      const dailyNotes = vault.list().filter((n) => {
        if (n.type !== 'daily') return false;
        const title = n.title ?? '';
        return title >= startDate && title <= endDate;
      });

      expect(dailyNotes).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Persistence Tests
  // ===========================================================================

  describe('Daily note persistence', () => {
    it('should persist daily note type through restart', async () => {
      const dateStr = format(new Date(), 'MM-dd-yyyy');

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Simulate restart
      const vault2 = await simulateAppRestart(ctx.tempDir);

      const loaded = vault2.read(note.id);
      expect(loaded.type).toBe('daily');
      expect(loaded.title).toBe(dateStr);
    });

    it('should persist daily note content through restart', async () => {
      const dateStr = format(new Date(), 'MM-dd-yyyy');

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Simulate restart
      const vault2 = await simulateAppRestart(ctx.tempDir);

      const loaded = vault2.read(note.id);
      expect(loaded.content.type).toBe('daily');
    });

    it('should rebuild daily note indexes after restart', async () => {
      const dateStr = format(new Date(), 'MM-dd-yyyy');

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        tags: ['daily'],
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      // Simulate restart
      const vault2 = await simulateAppRestart(ctx.tempDir);
      const newGraphEngine = new GraphEngine();
      const newSearchEngine = new SearchEngine();

      for (const n of vault2.list()) {
        newGraphEngine.addNote(n);
        newSearchEngine.indexNote(n);
      }

      // Verify indexes
      const tagResults = newGraphEngine.notesWithTag('daily');
      expect(tagResults.some((n) => n.id === note.id)).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge cases', () => {
    it('should handle timezone edge cases with noon timestamp', async () => {
      // Create daily note for a specific date
      const specificDate = new Date('2024-01-15T23:59:59');
      const dateStr = format(specificDate, 'MM-dd-yyyy');

      const createdAt = new Date(specificDate);
      createdAt.setHours(12, 0, 0, 0);

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
        createdAt: createdAt.getTime(),
      });

      // Verify the date in title matches
      expect(note.title).toBe('01-15-2024');
    });

    it('should handle daily notes created on different days', async () => {
      // Create notes for consecutive days
      const day1 = new Date('2024-01-15');
      const day2 = new Date('2024-01-16');

      const note1 = await vault.create({
        type: 'daily',
        title: format(day1, 'MM-dd-yyyy'),
        content: createDailyContent(),
        daily: { date: format(day1, 'MM-dd-yyyy') },
      });

      const note2 = await vault.create({
        type: 'daily',
        title: format(day2, 'MM-dd-yyyy'),
        content: createDailyContent(),
        daily: { date: format(day2, 'MM-dd-yyyy') },
      });

      expect(note1.title).toBe('01-15-2024');
      expect(note2.title).toBe('01-16-2024');
      expect(note1.id).not.toBe(note2.id);
    });

    it('should allow updating daily note content', async () => {
      const dateStr = format(new Date(), 'MM-dd-yyyy');

      const note = await vault.create({
        type: 'daily',
        title: dateStr,
        content: createDailyContent(),
        daily: { date: dateStr },
      });

      // Update content
      const loaded = vault.read(note.id);
      loaded.content = {
        ...loaded.content,
        root: {
          ...loaded.content.root,
          children: [
            ...loaded.content.root.children,
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Updated content' }],
            },
          ],
        },
      };
      await vault.save(loaded);

      // Verify update
      const updated = vault.read(note.id);
      expect(updated.content.root.children.length).toBeGreaterThan(1);
    });
  });
});
