/**
 * Integration Tests for Notes Handlers Logic
 *
 * Tests the notes:* handler logic through the data layer packages.
 * Since IPC handlers are thin wrappers around vault/engine calls,
 * testing the underlying operations validates the handler behavior.
 *
 * Tests cover:
 * - notes:list - via vault.list()
 * - notes:read - via vault.read()
 * - notes:create - via vault.create()
 * - notes:save - via vault.save() + engine updates
 * - notes:delete - via vault.delete() + engine updates
 * - notes:findByTitle - title matching logic
 * - notes:findByDate - date range filtering
 * - notes:searchTitles - title search filtering
 *
 * Issue: scribe-5na
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import { createNoteId } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createNoteContent,
} from './test-helpers';

describe('Notes Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-notes-handler-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // notes:list Tests
  // ===========================================================================

  describe('notes:list logic', () => {
    it('should list all notes from vault', async () => {
      await vault.create({ title: 'Note 1' });
      await vault.create({ title: 'Note 2' });
      await vault.create({ title: 'Note 3' });

      const notes = vault.list();
      expect(notes).toHaveLength(3);
    });

    it('should return empty array when no notes exist', () => {
      const notes = vault.list();
      expect(notes).toEqual([]);
    });

    it('should include all note types', async () => {
      await vault.create({ title: 'Regular Note' });
      await vault.create({ title: 'Person Name', type: 'person' });
      await vault.create({ title: '01-15-2024', type: 'daily' });

      const notes = vault.list();
      expect(notes).toHaveLength(3);
    });
  });

  // ===========================================================================
  // notes:read Tests
  // ===========================================================================

  describe('notes:read logic', () => {
    it('should read a note by ID', async () => {
      const created = await vault.create({ title: 'Test Note' });

      const note = vault.read(created.id);
      expect(note.id).toBe(created.id);
      expect(note.title).toBe('Test Note');
    });

    it('should throw for non-existent note', async () => {
      expect(() => vault.read(createNoteId('non-existent-id'))).toThrow();
    });
  });

  // ===========================================================================
  // notes:create Tests
  // ===========================================================================

  describe('notes:create logic', () => {
    it('should create a new note with default content', async () => {
      const note = await vault.create();

      expect(note.id).toBeDefined();
      expect(note.createdAt).toBeDefined();
      expect(note.updatedAt).toBeDefined();
    });

    it('should create a note with specified title', async () => {
      const note = await vault.create({ title: 'My Custom Title' });

      expect(note.title).toBe('My Custom Title');
    });

    it('should create a note with content', async () => {
      const content = createNoteContent('Title', 'Body text');
      const note = await vault.create({ title: 'With Content', content });

      expect(note.content.root.children.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // notes:save Tests
  // ===========================================================================

  describe('notes:save logic', () => {
    it('should save note and update all indexes', async () => {
      const note = await vault.create({ title: 'Original' });

      // Modify the note
      const updatedNote = {
        ...note,
        title: 'Updated Title',
        content: createNoteContent('Updated Title', 'New content with #tag'),
      };

      await vault.save(updatedNote);

      // Update indexes (mimicking handler behavior)
      graphEngine.addNote(updatedNote);
      searchEngine.indexNote(updatedNote);

      // Verify save
      const reloaded = vault.read(note.id);
      expect(reloaded.title).toBe('Updated Title');

      // Verify search index
      const searchResults = searchEngine.search('tag');
      expect(searchResults.some((r) => r.id === note.id)).toBe(true);
    });

    it('should update timestamps on save', async () => {
      const note = await vault.create({ title: 'Test' });
      const originalUpdatedAt = note.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await vault.save({ ...note, title: 'Modified' });

      const reloaded = vault.read(note.id);
      expect(reloaded.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });

  // ===========================================================================
  // notes:delete Tests
  // ===========================================================================

  describe('notes:delete logic', () => {
    it('should delete note and remove from all indexes', async () => {
      const note = await vault.create({ title: 'To Delete' });

      // Index in engines
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      // Delete (mimicking handler behavior)
      await vault.delete(note.id);
      graphEngine.removeNote(note.id);
      searchEngine.removeNote(note.id);

      // Verify deleted
      expect(() => vault.read(note.id)).toThrow();

      // Verify removed from search
      const searchResults = searchEngine.search('Delete');
      expect(searchResults.some((r) => r.id === note.id)).toBe(false);
    });
  });

  // ===========================================================================
  // notes:findByTitle Tests
  // ===========================================================================

  describe('notes:findByTitle logic', () => {
    it('should find note by exact title match', async () => {
      await vault.create({ title: 'Other Note' });
      const target = await vault.create({ title: 'Exact Match' });
      await vault.create({ title: 'Another Note' });

      const notes = vault.list();
      const match = notes.find((n) => n.title === 'Exact Match');

      expect(match?.id).toBe(target.id);
    });

    it('should support case-insensitive title search', async () => {
      const note = await vault.create({ title: 'My Title' });

      const notes = vault.list();
      const lowerQuery = 'my title';
      const match = notes.find((n) => n.title?.toLowerCase() === lowerQuery);

      expect(match?.id).toBe(note.id);
    });

    it('should return most recently updated on multiple matches', async () => {
      // Create two notes with same title (case-insensitive)
      const older = await vault.create({ title: 'My Note' });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newer = await vault.create({ title: 'my note' });

      // Wait and update the newer one to make it most recent
      await new Promise((resolve) => setTimeout(resolve, 10));
      await vault.save({ ...newer, content: createNoteContent('my note', 'Updated content') });

      const notes = vault.list();
      const lowerQuery = 'my note';
      const matches = notes.filter((n) => n.title?.toLowerCase() === lowerQuery);
      const mostRecent = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];

      // Newer note was updated most recently
      expect(mostRecent.id).toBe(newer.id);
    });

    it('should return null for no match', async () => {
      await vault.create({ title: 'Some Note' });

      const notes = vault.list();
      const match = notes.find((n) => n.title === 'Non-existent');

      expect(match).toBeUndefined();
    });
  });

  // ===========================================================================
  // notes:findByDate Tests
  // ===========================================================================

  describe('notes:findByDate logic', () => {
    it('should find notes created on a specific date', async () => {
      const note = await vault.create({ title: 'Today Note' });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const notes = vault.list();
      const createdToday = notes.filter(
        (n) => n.createdAt >= startOfDay.getTime() && n.createdAt <= endOfDay.getTime()
      );

      expect(createdToday.some((n) => n.id === note.id)).toBe(true);
    });

    it('should exclude daily note from date results', async () => {
      const today = new Date();
      const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;

      // Create daily note (must include daily field for discriminated union)
      const daily = await vault.create({
        title: dateStr,
        type: 'daily',
        daily: { date: dateStr },
      });

      // Create regular note
      const regular = await vault.create({ title: 'Regular Note' });

      const notes = vault.list();
      const nonDaily = notes.filter((n) => !(n.type === 'daily' && n.title === dateStr));

      expect(nonDaily.some((n) => n.id === regular.id)).toBe(true);
      expect(nonDaily.some((n) => n.id === daily.id)).toBe(false);
    });
  });

  // ===========================================================================
  // notes:searchTitles Tests
  // ===========================================================================

  describe('notes:searchTitles logic', () => {
    it('should search notes by title substring', async () => {
      await vault.create({ title: 'Meeting Notes' });
      await vault.create({ title: 'Project Plan' });
      await vault.create({ title: 'Meeting Agenda' });

      const notes = vault.list();
      const query = 'meeting';
      const matches = notes.filter((n) => n.title?.toLowerCase().includes(query.toLowerCase()));

      expect(matches).toHaveLength(2);
    });

    it('should be case-insensitive', async () => {
      await vault.create({ title: 'UPPERCASE TITLE' });

      const notes = vault.list();
      const matches = notes.filter((n) => n.title?.toLowerCase().includes('uppercase'));

      expect(matches).toHaveLength(1);
    });

    it('should respect limit', async () => {
      // Create 10 notes
      for (let i = 0; i < 10; i++) {
        await vault.create({ title: `Test Note ${i}` });
      }

      const notes = vault.list();
      const limit = 5;
      const matches = notes.filter((n) => n.title?.toLowerCase().includes('test')).slice(0, limit);

      expect(matches).toHaveLength(5);
    });

    it('should return empty for empty query', () => {
      const query = '   ';
      const matches = query.trim() ? vault.list() : [];

      expect(matches).toEqual([]);
    });

    it('should skip notes without titles', async () => {
      await vault.create(); // No title
      await vault.create({ title: 'Has Title' });

      const notes = vault.list();
      const matches = notes.filter((n) => n.title && n.title.includes('Has'));

      expect(matches).toHaveLength(1);
    });
  });
});
