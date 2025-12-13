/**
 * Integration Tests for Search Handlers Logic
 *
 * Tests the search:* handler logic through the SearchEngine package.
 * Since IPC handlers are thin wrappers, testing the underlying
 * SearchEngine operations validates the handler behavior.
 *
 * Tests cover:
 * - search:query - via searchEngine.search()
 *
 * Issue: scribe-5na
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { SearchEngine } from '@scribe/engine-search';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createNoteContent,
} from './test-helpers';

describe('Search Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-search-handler-test');
    vault = ctx.vault;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // search:query Tests
  // ===========================================================================

  describe('search:query logic', () => {
    it('should return matching notes', async () => {
      // Create notes with searchable content
      const note1 = await vault.create({
        title: 'Meeting Notes',
        content: createNoteContent('Meeting Notes', 'Discussion about the project roadmap'),
      });
      const note2 = await vault.create({
        title: 'Project Plan',
        content: createNoteContent('Project Plan', 'Timeline for the project delivery'),
      });
      const note3 = await vault.create({
        title: 'Random Ideas',
        content: createNoteContent('Random Ideas', 'Some random thoughts'),
      });

      // Index all notes
      searchEngine.indexNote(note1);
      searchEngine.indexNote(note2);
      searchEngine.indexNote(note3);

      // Search for "project"
      const results = searchEngine.search('project');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.id === note1.id || r.id === note2.id)).toBe(true);
    });

    it('should return empty for no matches', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note', 'Some content here'),
      });
      searchEngine.indexNote(note);

      const results = searchEngine.search('nonexistentword12345');
      expect(results).toHaveLength(0);
    });

    it('should search both title and content', async () => {
      const note = await vault.create({
        title: 'Architecture Decision',
        content: createNoteContent('Architecture Decision', 'We decided to use microservices'),
      });
      searchEngine.indexNote(note);

      // Search by title
      const titleResults = searchEngine.search('architecture');
      expect(titleResults.some((r) => r.id === note.id)).toBe(true);

      // Search by content
      const contentResults = searchEngine.search('microservices');
      expect(contentResults.some((r) => r.id === note.id)).toBe(true);
    });

    it('should update search index when note is updated', async () => {
      const note = await vault.create({
        title: 'Original Title',
        content: createNoteContent('Original Title', 'Original content'),
      });
      searchEngine.indexNote(note);

      // Update the note
      const updatedNote = {
        ...note,
        title: 'Updated Title',
        content: createNoteContent('Updated Title', 'Brand new content'),
      };
      await vault.save(updatedNote);
      searchEngine.indexNote(updatedNote);

      // Search should find new content
      const results = searchEngine.search('brand new');
      expect(results.some((r) => r.id === note.id)).toBe(true);
    });

    it('should remove note from search index on delete', async () => {
      const note = await vault.create({
        title: 'To Be Deleted',
        content: createNoteContent('To Be Deleted', 'This will be removed'),
      });
      searchEngine.indexNote(note);

      // Verify it's searchable
      let results = searchEngine.search('removed');
      expect(results.some((r) => r.id === note.id)).toBe(true);

      // Remove from index
      searchEngine.removeNote(note.id);

      // Should no longer be found
      results = searchEngine.search('removed');
      expect(results.some((r) => r.id === note.id)).toBe(false);
    });
  });
});
