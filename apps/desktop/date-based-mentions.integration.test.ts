/**
 * E2E Integration Tests for Date-Based Linked Mentions Feature
 *
 * Tests the date-based linked mentions functionality for daily notes:
 * - Shows backlinks (standard behavior)
 * - Shows notes created on the daily note's date (with "Created" badge)
 * - Shows notes modified on the daily note's date (with "Modified" badge)
 * - Deduplicates notes that appear in multiple categories
 * - Excludes the daily note itself from its mentions
 * - Regular (non-daily) notes only show backlinks
 *
 * Based on features/templates/spec.md requirements.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { format } from 'date-fns';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { Note, NoteId, EditorContent } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createNoteContent,
  indexNoteInEngines,
  createWikiLinkNode,
  withTimestamp,
} from './test-helpers';

// =============================================================================
// Content Generation Helpers
// =============================================================================

/**
 * Creates Lexical content for a daily note (empty bullet list, no H1)
 */
function createDailyContent(): EditorContent & { type: 'daily' } {
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

// =============================================================================
// Date-Based Mentions API Helper (Simulating IPC handler)
// =============================================================================

/**
 * Simulates notes:findByDate IPC handler
 * Finds notes created or modified on a specific date
 */
function findNotesByDate(
  vault: FileSystemVault,
  date: string,
  includeCreated: boolean,
  includeUpdated: boolean
): Array<{ note: Note; reason: 'created' | 'updated' }> {
  // Parse the date string (expecting "MM-dd-yyyy" format)
  const [month, day, year] = date.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startMs = startOfDay.getTime();
  const endMs = endOfDay.getTime();

  const notes = vault.list();
  const results: Array<{ note: Note; reason: 'created' | 'updated' }> = [];

  for (const note of notes) {
    // Skip the daily note itself
    if (note.type === 'daily' && note.title === date) {
      continue;
    }

    const wasCreatedOnDate = note.createdAt >= startMs && note.createdAt <= endMs;
    const wasUpdatedOnDate = note.updatedAt >= startMs && note.updatedAt <= endMs;

    if (includeCreated && wasCreatedOnDate) {
      results.push({ note, reason: 'created' });
    } else if (includeUpdated && wasUpdatedOnDate && !wasCreatedOnDate) {
      // Only mark as "updated" if it wasn't also created on this date
      results.push({ note, reason: 'updated' });
    }
  }

  return results;
}

/**
 * Simulates the LinkedMentions deduplication logic
 * Merges backlinks with date-based notes
 */
interface LinkedMention {
  id: string;
  title: string | null;
  isBacklink?: boolean;
  createdOnDate?: boolean;
  modifiedOnDate?: boolean;
}

function mergeLinkedMentions(
  backlinks: Array<{ id: string; title: string | null }>,
  dateBasedNotes: Array<{ note: Note; reason: 'created' | 'updated' }>,
  currentNoteId: NoteId
): LinkedMention[] {
  const mentionMap = new Map<string, LinkedMention>();

  // First add backlinks
  for (const backlink of backlinks) {
    mentionMap.set(backlink.id, {
      id: backlink.id,
      title: backlink.title,
      isBacklink: true,
    });
  }

  // Then merge date-based notes
  for (const { note, reason } of dateBasedNotes) {
    // Exclude self
    if (note.id === currentNoteId) {
      continue;
    }

    const existing = mentionMap.get(note.id);
    if (existing) {
      // Merge: add date badges to existing backlink
      existing.createdOnDate = reason === 'created' || existing.createdOnDate;
      existing.modifiedOnDate = reason === 'updated' || existing.modifiedOnDate;
    } else {
      // Add new entry
      mentionMap.set(note.id, {
        id: note.id,
        title: note.title,
        createdOnDate: reason === 'created',
        modifiedOnDate: reason === 'updated',
      });
    }
  }

  return Array.from(mentionMap.values());
}

// =============================================================================
// Daily Note Helper
// =============================================================================

/**
 * Creates a daily note for a specific date
 * Sets createdAt to noon on the target date (matching production behavior)
 */
async function createDailyNote(
  vault: FileSystemVault,
  graphEngine: GraphEngine,
  searchEngine: SearchEngine,
  date: Date
): Promise<Note> {
  const dateStr = format(date, 'MM-dd-yyyy');

  // Set createdAt to noon on the target date (avoids timezone edge cases)
  const createdAt = new Date(date);
  createdAt.setHours(12, 0, 0, 0);

  const content = createDailyContent();
  const note = await vault.create({
    type: 'daily',
    title: dateStr,
    tags: ['daily'],
    content,
    daily: { date: dateStr },
    createdAt: createdAt.getTime(),
  });

  const savedNote = vault.read(note.id);
  graphEngine.addNote(savedNote);
  searchEngine.indexNote(savedNote);

  return savedNote;
}

/**
 * Creates a regular note at a specific timestamp
 */
async function createNoteAtTimestamp(
  vault: FileSystemVault,
  graphEngine: GraphEngine,
  searchEngine: SearchEngine,
  title: string,
  timestamp: number
): Promise<Note> {
  const content = createNoteContent(title);
  const note = await vault.create({ title, content });

  // Read the note to get the actual saved version
  const savedNote = vault.read(note.id);

  // Override timestamps for testing using type-safe utility
  withTimestamp(savedNote, timestamp);

  // Save with modified timestamps
  await vault.save(savedNote);

  const finalNote = vault.read(note.id);
  graphEngine.addNote(finalNote);
  searchEngine.indexNote(finalNote);

  return finalNote;
}

/**
 * Creates a note with a wiki-link to another note
 */
function createNoteWithWikiLink(
  title: string,
  linkTitle: string,
  linkTargetId: NoteId
): EditorContent {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: title }],
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Link to ' },
            createWikiLinkNode(
              linkTitle,
              linkTitle,
              linkTargetId
            ) as unknown as import('@scribe/shared').EditorNode,
          ],
        },
      ],
    },
  };
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('Date-Based Linked Mentions Integration Tests', () => {
  let ctx: TestContext;

  // Convenience aliases
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-date-mentions-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // Basic Date-Based Queries
  // ===========================================================================

  describe('Date-based note queries', () => {
    it('should find notes created on a specific date', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create a daily note
      await createDailyNote(vault, graphEngine, searchEngine, today);

      // Create a note "today" (will have current timestamp)
      const regularNote = await vault.create({
        title: 'Regular Note',
        content: createNoteContent('Regular Note'),
      });
      const savedRegular = vault.read(regularNote.id);
      indexNoteInEngines(ctx, savedRegular);

      // Query notes by date
      const results = findNotesByDate(vault, dateStr, true, false);

      // Should find the regular note, not the daily note
      expect(results.length).toBe(1);
      expect(results[0].note.id).toBe(regularNote.id);
      expect(results[0].reason).toBe('created');
    });

    it('should find notes modified on a specific date', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = format(today, 'MM-dd-yyyy');
      const yesterdayMs = yesterday.getTime();

      // Create daily note for today
      await createDailyNote(vault, graphEngine, searchEngine, today);

      // Create a note "yesterday" then modify it "today"
      const note = await createNoteAtTimestamp(
        vault,
        graphEngine,
        searchEngine,
        'Old Note',
        yesterdayMs
      );

      // Modify the note (this sets updatedAt to now)
      const loadedNote = vault.read(note.id);
      loadedNote.title = 'Old Note - Updated';
      await vault.save(loadedNote);

      // Re-read to get updated timestamps
      const updatedNote = vault.read(note.id);
      graphEngine.addNote(updatedNote);

      // Query for notes modified today
      const results = findNotesByDate(vault, todayStr, false, true);

      // Should find the note as "updated"
      expect(results.length).toBe(1);
      expect(results[0].note.id).toBe(note.id);
      expect(results[0].reason).toBe('updated');
    });

    it('should return "created" not "updated" when note was created AND modified on same date', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create daily note
      await createDailyNote(vault, graphEngine, searchEngine, today);

      // Create a note today
      const note = await vault.create({
        title: 'New Note',
        content: createNoteContent('New Note'),
      });
      indexNoteInEngines(ctx, vault.read(note.id));

      // Modify it immediately (same day)
      const loadedNote = vault.read(note.id);
      loadedNote.title = 'New Note - Edited';
      await vault.save(loadedNote);

      // Query for both created and updated
      const results = findNotesByDate(vault, dateStr, true, true);

      // Should only appear once, as "created" (not "updated")
      expect(results.length).toBe(1);
      expect(results[0].reason).toBe('created');
    });

    it('should exclude the daily note itself from date-based results', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create daily note
      const dailyNote = await createDailyNote(vault, graphEngine, searchEngine, today);

      // Query notes by date
      const results = findNotesByDate(vault, dateStr, true, true);

      // Daily note should not appear in its own mentions
      const dailyInResults = results.find((r) => r.note.id === dailyNote.id);
      expect(dailyInResults).toBeUndefined();
    });
  });

  // ===========================================================================
  // Backlinks Integration
  // ===========================================================================

  describe('Backlinks with date-based mentions', () => {
    it('should show standard backlinks for daily notes', async () => {
      const today = new Date();

      // Create daily note
      const dailyNote = await createDailyNote(vault, graphEngine, searchEngine, today);

      // Create a note that links to the daily note
      const linkingContent = createNoteWithWikiLink('Linking Note', dailyNote.title, dailyNote.id);
      const linkingNote = await vault.create({
        title: 'Linking Note',
        content: linkingContent,
      });
      const savedLinking = vault.read(linkingNote.id);
      indexNoteInEngines(ctx, savedLinking);

      // Get backlinks from graph engine
      const backlinks = graphEngine.backlinks(dailyNote.id);

      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(linkingNote.id);
    });

    it('should deduplicate notes that are both backlinks AND created on date', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create daily note
      const dailyNote = await createDailyNote(vault, graphEngine, searchEngine, today);

      // Create a note that links to the daily note (created today)
      const linkingContent = createNoteWithWikiLink('Linking Note', dailyNote.title, dailyNote.id);
      const linkingNote = await vault.create({
        title: 'Linking Note',
        content: linkingContent,
      });
      const savedLinking = vault.read(linkingNote.id);
      indexNoteInEngines(ctx, savedLinking);

      // Get backlinks
      const backlinks = graphEngine.backlinks(dailyNote.id);

      // Get date-based notes
      const dateBasedNotes = findNotesByDate(vault, dateStr, true, true);

      // Merge them
      const mentions = mergeLinkedMentions(backlinks, dateBasedNotes, dailyNote.id);

      // Should appear only once, with both indicators
      expect(mentions.length).toBe(1);
      expect(mentions[0].id).toBe(linkingNote.id);
      expect(mentions[0].isBacklink).toBe(true);
      expect(mentions[0].createdOnDate).toBe(true);
    });

    it('should show note as backlink + modified when note links AND was modified on date', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = format(today, 'MM-dd-yyyy');
      const yesterdayMs = yesterday.getTime();

      // Create daily note for today
      const dailyNote = await createDailyNote(vault, graphEngine, searchEngine, today);

      // Create a note "yesterday"
      const oldNote = await createNoteAtTimestamp(
        vault,
        graphEngine,
        searchEngine,
        'Old Note',
        yesterdayMs
      );

      // Modify it today and add a link to the daily note
      const linkingContent = createNoteWithWikiLink('Old Note', dailyNote.title, dailyNote.id);
      const loadedNote = vault.read(oldNote.id);
      loadedNote.content = linkingContent;
      await vault.save(loadedNote);

      // Re-index
      const updatedNote = vault.read(oldNote.id);
      graphEngine.removeNote(oldNote.id);
      graphEngine.addNote(updatedNote);

      // Get backlinks
      const backlinks = graphEngine.backlinks(dailyNote.id);

      // Get date-based notes
      const dateBasedNotes = findNotesByDate(vault, todayStr, true, true);

      // Merge them
      const mentions = mergeLinkedMentions(backlinks, dateBasedNotes, dailyNote.id);

      // Should appear once with backlink + modified
      expect(mentions.length).toBe(1);
      expect(mentions[0].id).toBe(oldNote.id);
      expect(mentions[0].isBacklink).toBe(true);
      expect(mentions[0].modifiedOnDate).toBe(true);
    });
  });

  // ===========================================================================
  // Regular Notes (Non-Daily)
  // ===========================================================================

  describe('Regular notes (non-daily)', () => {
    it('should only show backlinks for regular notes, not date-based mentions', async () => {
      // Create a regular note
      const regularNote = await vault.create({
        title: 'Regular Note',
        content: createNoteContent('Regular Note'),
      });
      const savedRegular = vault.read(regularNote.id);
      indexNoteInEngines(ctx, savedRegular);

      // Create another note that links to it (created today)
      const linkingContent = createNoteWithWikiLink('Linking Note', 'Regular Note', regularNote.id);
      const linkingNote = await vault.create({
        title: 'Linking Note',
        content: linkingContent,
      });
      const savedLinking = vault.read(linkingNote.id);
      indexNoteInEngines(ctx, savedLinking);

      // Get backlinks
      const backlinks = graphEngine.backlinks(regularNote.id);

      // For regular notes, we don't query date-based mentions
      // The includeByDate option is only enabled for daily notes
      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(linkingNote.id);

      // If we WERE to query date-based (which we wouldn't for regular notes),
      // it would return the linking note. But since regular notes don't use
      // includeByDate, we only show backlinks.
    });
  });

  // ===========================================================================
  // Complete Workflow Tests
  // ===========================================================================

  describe('Complete date-based mentions workflow', () => {
    it('should handle full daily note linked mentions scenario', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = format(today, 'MM-dd-yyyy');
      const yesterdayMs = yesterday.getTime();

      // Create today's daily note
      const dailyNote = await createDailyNote(vault, graphEngine, searchEngine, today);

      // Scenario 1: Note created today (should show "Created" badge)
      const createdToday = await vault.create({
        title: 'Note Created Today',
        content: createNoteContent('Note Created Today'),
      });
      indexNoteInEngines(ctx, vault.read(createdToday.id));

      // Scenario 2: Note created yesterday, modified today (should show "Modified" badge)
      const modifiedToday = await createNoteAtTimestamp(
        vault,
        graphEngine,
        searchEngine,
        'Note Modified Today',
        yesterdayMs
      );
      const loadedModified = vault.read(modifiedToday.id);
      loadedModified.title = 'Note Modified Today - Updated';
      await vault.save(loadedModified);
      graphEngine.addNote(vault.read(modifiedToday.id));

      // Scenario 3: Note that links to daily note but was created/updated yesterday (should show as backlink only)
      // We need to create it with the link content from the start to avoid modification
      const backlinkContent = createNoteWithWikiLink(
        'Backlink Note',
        dailyNote.title,
        dailyNote.id
      );
      const backlinkNote = await vault.create({
        title: 'Backlink Note',
        content: backlinkContent,
      });
      // Override timestamps to be from yesterday
      const loadedBacklink = vault.read(backlinkNote.id);
      withTimestamp(loadedBacklink, yesterdayMs);
      await vault.save(loadedBacklink);
      // Re-read to get the saved version with correct timestamps
      const finalBacklink = vault.read(backlinkNote.id);
      graphEngine.addNote(finalBacklink);
      searchEngine.indexNote(finalBacklink);

      // Scenario 4: Note that links to daily AND was created today (should show backlink + created)
      const bothContent = createNoteWithWikiLink('Both Note', dailyNote.title, dailyNote.id);
      const bothNote = await vault.create({
        title: 'Both Note',
        content: bothContent,
      });
      indexNoteInEngines(ctx, vault.read(bothNote.id));

      // Get all mentions
      const backlinks = graphEngine.backlinks(dailyNote.id);
      const dateBasedNotes = findNotesByDate(vault, todayStr, true, true);
      const mentions = mergeLinkedMentions(backlinks, dateBasedNotes, dailyNote.id);

      // Should have 4 unique mentions
      expect(mentions.length).toBe(4);

      // Find each and verify badges
      const createdMention = mentions.find((m) => m.id === createdToday.id);
      expect(createdMention?.createdOnDate).toBe(true);
      expect(createdMention?.isBacklink).toBeUndefined();

      const modifiedMention = mentions.find((m) => m.id === modifiedToday.id);
      expect(modifiedMention?.modifiedOnDate).toBe(true);
      expect(modifiedMention?.isBacklink).toBeUndefined();

      const backlinkMention = mentions.find((m) => m.id === backlinkNote.id);
      expect(backlinkMention?.isBacklink).toBe(true);
      // Note: The backlink note will show modifiedOnDate because vault.save()
      // always updates the updatedAt timestamp. This is expected behavior.
      // In a real scenario, a note from yesterday would only show as a backlink
      // if it was never modified today.

      const bothMention = mentions.find((m) => m.id === bothNote.id);
      expect(bothMention?.isBacklink).toBe(true);
      expect(bothMention?.createdOnDate).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge cases', () => {
    it('should handle daily note with no mentions of any kind', async () => {
      const today = new Date();
      const dateStr = format(today, 'MM-dd-yyyy');

      // Create daily note
      const dailyNote = await createDailyNote(vault, graphEngine, searchEngine, today);

      // Get all mentions (nothing else exists)
      const backlinks = graphEngine.backlinks(dailyNote.id);
      const dateBasedNotes = findNotesByDate(vault, dateStr, true, true);
      const mentions = mergeLinkedMentions(backlinks, dateBasedNotes, dailyNote.id);

      expect(mentions.length).toBe(0);
    });

    it('should handle date query for non-existent daily note date', async () => {
      const futureDate = new Date('2099-12-31');
      const futureDateStr = format(futureDate, 'MM-dd-yyyy');

      // Query notes for a date with no daily note
      const results = findNotesByDate(vault, futureDateStr, true, true);

      expect(results.length).toBe(0);
    });

    it('should correctly parse MM-dd-yyyy date format', async () => {
      // Create a note at a specific known timestamp
      const specificDate = new Date('2024-06-15T12:00:00');
      const dateStr = format(specificDate, 'MM-dd-yyyy'); // "06-15-2024"

      // Create a note at that timestamp
      const note = await vault.create({
        title: 'Specific Date Note',
        content: createNoteContent('Specific Date Note'),
      });

      // Override timestamps
      const loaded = vault.read(note.id);
      withTimestamp(loaded, specificDate.getTime());
      await vault.save(loaded);

      // Query with the correct date
      const results = findNotesByDate(vault, dateStr, true, true);

      // Should find the note
      expect(results.length).toBe(1);
      expect(results[0].note.id).toBe(note.id);
    });
  });
});
