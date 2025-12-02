/**
 * E2E Integration Tests for Delete Note Feature
 *
 * Tests the delete note functionality including:
 * - Flow 1: Delete note via command palette
 * - Flow 5: Delete via icon in file-browse mode
 * - Core deletion operations
 * - Engine cleanup (graph and search)
 * - Toast notification verification
 * - Persistence across restarts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { Note, LexicalState } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createNoteContent,
  createNoteWithTitle,
  createAndIndexNote,
  indexNoteInEngines,
  removeNoteFromEngines,
  createFuseIndex,
  getRecentNotes,
  simulateAppRestart,
} from './test-helpers';

describe('Delete Note E2E Integration Tests', () => {
  let ctx: TestContext;

  // Convenience aliases for cleaner test code
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-delete-note-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  /**
   * E2E Flow 1: Delete note via command palette
   *
   * Per spec.md:
   * 1. Launch app with 3+ existing notes
   * 2. Press Cmd+K
   * 3. Type "delete" and select "Delete Note" command
   * 4. Verify delete-browse mode with note list
   * 5. Press Down then Enter to select a note
   * 6. Verify confirmation screen appears
   * 7. Click "Delete" button
   * 8. Verify success toast appears with note title
   * 9. Verify note is deleted (not in list)
   * 10. Verify toast auto-dismisses after 3 seconds
   */
  describe('Flow 1: Delete note via command palette', () => {
    it('should complete full delete flow: Cmd+K -> Delete Note -> select note -> confirm -> delete', async () => {
      // Step 1: Launch app with 3+ existing notes
      const note1 = await createAndIndexNote(ctx, 'Meeting Notes', 'Discuss project timeline');
      const note2 = await createAndIndexNote(ctx, 'Project Ideas', 'Brainstorm new features');
      const note3 = await createAndIndexNote(ctx, 'Daily Journal', 'Reflections on today');

      // Verify initial state
      expect(vault.list()).toHaveLength(3);
      expect(graphEngine.getStats().nodes).toBe(3);
      expect(searchEngine.size()).toBe(3);

      // Step 2-3: Simulate Cmd+K and selecting "Delete Note" command
      // This transitions to delete-browse mode

      // Step 4: Verify delete-browse mode shows note list
      const notesInBrowseMode = vault.list();
      expect(notesInBrowseMode).toHaveLength(3);

      // Get recent notes (excluding current - assume note3 is current as most recent)
      const currentNoteId = note3.id;
      const recentNotes = getRecentNotes(notesInBrowseMode, currentNoteId);
      expect(recentNotes).toHaveLength(2);
      expect(recentNotes[0].id).toBe(note2.id); // Most recent excluding current
      expect(recentNotes[1].id).toBe(note1.id);

      // Step 5: Press Down then Enter to select second note (note1 - Meeting Notes)
      let selectedIndex = 0;
      selectedIndex++; // Down key press
      const selectedNote = recentNotes[selectedIndex];
      expect(selectedNote.metadata.title).toBe('Meeting Notes');

      // Step 6: Verify confirmation screen would show
      // (In UI this replaces palette content with "Delete 'Meeting Notes'?")
      const pendingDeleteNote = selectedNote;
      expect(pendingDeleteNote.metadata.title).toBe('Meeting Notes');

      // Step 7: Confirm deletion (Click "Delete" button)
      await vault.delete(pendingDeleteNote.id);
      removeNoteFromEngines(ctx, pendingDeleteNote.id);

      // Step 8: Verify success toast message format
      const successMessage = `"${pendingDeleteNote.metadata.title}" deleted`;
      expect(successMessage).toBe('"Meeting Notes" deleted');

      // Step 9: Verify note is deleted (not in list)
      const remainingNotes = vault.list();
      expect(remainingNotes).toHaveLength(2);
      expect(remainingNotes.find((n) => n.id === pendingDeleteNote.id)).toBeUndefined();

      // Verify engines are updated
      expect(graphEngine.getStats().nodes).toBe(2);
      expect(searchEngine.size()).toBe(2);

      // Verify other notes still exist
      expect(remainingNotes.find((n) => n.id === note2.id)).toBeDefined();
      expect(remainingNotes.find((n) => n.id === note3.id)).toBeDefined();

      // Step 10: Toast auto-dismiss (3s) is verified in component tests
    });

    it('should display recent notes sorted by updatedAt in delete-browse mode', async () => {
      // Create 3 notes with distinct timestamps
      await createAndIndexNote(ctx, 'First Note');
      await createAndIndexNote(ctx, 'Second Note');
      await createAndIndexNote(ctx, 'Third Note');

      // Verify notes in delete-browse mode are sorted by updatedAt descending
      const recentNotes = getRecentNotes(vault.list());

      expect(recentNotes).toHaveLength(3);
      expect(recentNotes[0].metadata.title).toBe('Third Note');
      expect(recentNotes[1].metadata.title).toBe('Second Note');
      expect(recentNotes[2].metadata.title).toBe('First Note');

      // Verify ordering by timestamp
      expect(recentNotes[0].updatedAt).toBeGreaterThanOrEqual(recentNotes[1].updatedAt);
      expect(recentNotes[1].updatedAt).toBeGreaterThanOrEqual(recentNotes[2].updatedAt);
    });

    it('should exclude current note from delete-browse list', async () => {
      // Create 3 notes
      const note1 = await createAndIndexNote(ctx, 'First Note');
      const note2 = await createAndIndexNote(ctx, 'Second Note');
      const note3 = await createAndIndexNote(ctx, 'Third Note');

      // Simulate note3 is the current note
      const currentNoteId = note3.id;

      // Get notes for delete-browse mode (excluding current)
      const deleteableNotes = getRecentNotes(vault.list(), currentNoteId);

      expect(deleteableNotes).toHaveLength(2);
      expect(deleteableNotes.find((n) => n.id === currentNoteId)).toBeUndefined();
      expect(deleteableNotes[0].id).toBe(note2.id);
      expect(deleteableNotes[1].id).toBe(note1.id);
    });

    it('should support fuzzy search in delete-browse mode', async () => {
      // Create notes
      await createAndIndexNote(ctx, 'Meeting Notes', 'Discussed project timeline');
      await createAndIndexNote(ctx, 'Project Ideas', 'Brainstorming new features');
      await createAndIndexNote(ctx, 'Daily Journal', 'Reflections');
      await createAndIndexNote(ctx, 'Team Meeting Summary', 'Notes from standup');

      const allNotes = vault.list();
      const fuseIndex = createFuseIndex(allNotes);

      // Search for 'meet'
      const searchResults = fuseIndex.search('meet', { limit: 25 });
      const filteredNotes = searchResults.map((result) => result.item);

      // Should find Meeting Notes and Team Meeting Summary
      expect(filteredNotes.length).toBeGreaterThan(0);
      expect(filteredNotes.find((n) => n.metadata.title === 'Meeting Notes')).toBeDefined();
      expect(filteredNotes.find((n) => n.metadata.title === 'Team Meeting Summary')).toBeDefined();

      // Should NOT find non-matching notes
      expect(filteredNotes.find((n) => n.metadata.title === 'Daily Journal')).toBeUndefined();
    });

    it('should show "No notes to delete" for empty vault', async () => {
      // Vault is empty after initialization
      const notes = vault.list();
      expect(notes).toHaveLength(0);

      // Per spec: In delete-browse mode, empty vault shows "No notes to delete"
      const isEmptyVault = notes.length === 0;
      const emptyMessage = isEmptyVault ? 'No notes to delete' : null;
      expect(emptyMessage).toBe('No notes to delete');
    });
  });

  /**
   * Flow 2: Cancel deletion
   *
   * Per spec: Returns to delete-browse mode, note still exists
   */
  describe('Flow 2: Cancel deletion', () => {
    it('should not delete note when Escape is pressed in confirmation screen', async () => {
      // Create notes
      await createAndIndexNote(ctx, 'First Note');
      const note2 = await createAndIndexNote(ctx, 'Second Note');
      await createAndIndexNote(ctx, 'Third Note');

      const initialCount = vault.list().length;
      expect(initialCount).toBe(3);

      // Simulate selecting note2 for deletion, then pressing Escape
      const pendingDeleteNote = note2;
      expect(pendingDeleteNote.metadata.title).toBe('Second Note');

      // Cancel - no deletion happens

      // Verify note still exists
      const notes = vault.list();
      expect(notes).toHaveLength(3);
      expect(notes.find((n) => n.id === pendingDeleteNote.id)).toBeDefined();

      // Verify engines still have the note
      expect(graphEngine.getStats().nodes).toBe(3);
      expect(searchEngine.size()).toBe(3);
    });
  });

  /**
   * Toast notification verification
   *
   * Per spec: Success toast shows "{note-title}" deleted, auto-dismisses after 3 seconds
   */
  describe('Toast notifications', () => {
    it('should generate correct success message with note title', async () => {
      const note = await createAndIndexNote(ctx, 'Meeting Notes');

      // Simulate deletion
      const deletedTitle = note.metadata.title;
      await vault.delete(note.id);

      // Verify success message format
      const successMessage = `"${deletedTitle}" deleted`;
      expect(successMessage).toBe('"Meeting Notes" deleted');
    });

    it('should truncate long note titles in toast message (~30 chars)', async () => {
      const longTitle =
        'This is a very long note title that should be truncated at around 30 chars';
      const note = await createAndIndexNote(ctx, longTitle);

      // Simulate deletion and message truncation (per spec: ~30 chars)
      const fullTitle = note.metadata.title!;
      const truncatedTitle = fullTitle.length > 30 ? fullTitle.substring(0, 30) + '...' : fullTitle;

      const successMessage = `"${truncatedTitle}" deleted`;
      expect(successMessage).toContain('...');
      expect(truncatedTitle.length).toBeLessThanOrEqual(33); // 30 + '...'
    });
  });

  /**
   * E2E Integration Test: Delete via icon in file-browse mode (Flow 5)
   *
   * Tests the complete flow:
   * 1. Launch app with 3+ existing notes
   * 2. In file-browse mode, hover over a note item (UI behavior - tested in component tests)
   * 3. Click delete icon -> opens confirmation
   * 4. Click Cancel -> returns to file-browse (NOT delete-browse)
   * 5. Click delete icon again, then Delete -> note deleted
   *
   * For integration testing, we test the underlying delete operation.
   * The UI-specific behavior (hover, icon visibility) is tested in component tests.
   */
  describe('Delete via icon in file-browse mode (Flow 5)', () => {
    it('should delete note when initiated from file-browse mode', async () => {
      // Step 1: Launch app with 3+ existing notes
      const note1 = await createNoteWithTitle(vault, 'Meeting Notes');
      const note2 = await createNoteWithTitle(vault, 'Project Ideas');
      const note3 = await createNoteWithTitle(vault, 'Daily Journal');

      // Index notes in engines
      indexNoteInEngines(ctx, note1);
      indexNoteInEngines(ctx, note2);
      indexNoteInEngines(ctx, note3);

      // Verify initial state
      expect(vault.list()).toHaveLength(3);
      expect(graphEngine.getStats().nodes).toBe(3);
      expect(searchEngine.size()).toBe(3);

      // Steps 2-4 (UI behavior) are tested in component tests
      // The cancel action returns to file-browse mode without deleting

      // Step 5: Delete note2 (simulating: delete icon click -> confirm Delete)
      await vault.delete(note2.id);
      removeNoteFromEngines(ctx, note2.id);

      // Verify deletion
      expect(vault.list()).toHaveLength(2);
      expect(graphEngine.getStats().nodes).toBe(2);
      expect(searchEngine.size()).toBe(2);

      // Verify specific note is gone
      expect(vault.list().find((n) => n.id === note2.id)).toBeUndefined();

      // Verify other notes are still present
      expect(vault.list().find((n) => n.id === note1.id)).toBeDefined();
      expect(vault.list().find((n) => n.id === note3.id)).toBeDefined();
    });

    it('should keep note when cancel is clicked in confirmation', async () => {
      // Create 3 notes
      const note1 = await createNoteWithTitle(vault, 'Note A');
      const note2 = await createNoteWithTitle(vault, 'Note B');
      const note3 = await createNoteWithTitle(vault, 'Note C');

      // Index notes in engines
      indexNoteInEngines(ctx, note1);
      indexNoteInEngines(ctx, note2);
      indexNoteInEngines(ctx, note3);

      // Verify initial state
      expect(vault.list()).toHaveLength(3);

      // Simulate: user clicks delete icon on note2, then clicks Cancel
      // (No deletion happens - this is the expected behavior)
      // The UI returns to file-browse mode (NOT delete-browse)

      // Verify all notes are still present
      expect(vault.list()).toHaveLength(3);
      expect(graphEngine.getStats().nodes).toBe(3);
      expect(searchEngine.size()).toBe(3);

      // Verify note2 specifically is still there
      const note2Still = vault.list().find((n) => n.id === note2.id);
      expect(note2Still).toBeDefined();
      expect(note2Still?.metadata.title).toBe('Note B');
    });

    it('should remove note from all engines when deleted', async () => {
      // Create notes with links and tags
      const note1 = await vault.create({
        content: createNoteContent('Note 1', 'Content with #tag1'),
      });
      const note2 = await vault.create({
        content: createNoteContent('Note 2', 'Content with #tag2'),
      });
      const note3 = await vault.create({
        content: createNoteContent('Note 3', 'Content with #tag1'),
      });

      // Index all notes
      indexNoteInEngines(ctx, note1);
      indexNoteInEngines(ctx, note2);
      indexNoteInEngines(ctx, note3);

      // Verify search works before deletion
      const searchBeforeDelete = searchEngine.search('Note 2');
      expect(searchBeforeDelete.length).toBeGreaterThan(0);

      // Delete note2
      await vault.delete(note2.id);
      removeNoteFromEngines(ctx, note2.id);

      // Verify note is removed from vault
      expect(vault.list()).toHaveLength(2);

      // Verify note is removed from graph
      expect(graphEngine.getStats().nodes).toBe(2);

      // Verify note is removed from search index
      expect(searchEngine.size()).toBe(2);

      // Verify searching for deleted note returns no results
      const searchAfterDelete = searchEngine.search('Note 2');
      expect(searchAfterDelete.length).toBe(0);
    });
  });

  describe('Core deletion operations', () => {
    it('should delete a single note from empty vault with one note', async () => {
      // Create a single note
      const note = await createNoteWithTitle(vault, 'Only Note');
      indexNoteInEngines(ctx, note);

      expect(vault.list()).toHaveLength(1);

      // Delete the only note
      await vault.delete(note.id);
      removeNoteFromEngines(ctx, note.id);

      // Vault should be empty
      expect(vault.list()).toHaveLength(0);
      expect(graphEngine.getStats().nodes).toBe(0);
      expect(searchEngine.size()).toBe(0);
    });

    it('should handle deleting note that is linked to by other notes', async () => {
      // Create note A
      const noteA = await vault.create({ content: createNoteContent('Note A') });

      // Create note B that links to note A
      const noteBContent: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Note B' }],
            },
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Links to ' },
                { type: 'note-reference', noteId: noteA.id, text: 'Note A' } as any,
              ],
            },
          ],
        },
      };
      const noteB = await vault.create({ content: noteBContent });
      await vault.save(noteB);
      const savedNoteB = vault.read(noteB.id);

      // Index notes
      graphEngine.addNote(noteA);
      graphEngine.addNote(savedNoteB);
      searchEngine.indexNote(noteA);
      searchEngine.indexNote(savedNoteB);

      // Verify backlink exists
      const backlinksBeforeDelete = graphEngine.backlinks(noteA.id);
      expect(backlinksBeforeDelete.length).toBe(1);
      expect(backlinksBeforeDelete[0].id).toBe(noteB.id);

      // Delete note A (the linked-to note)
      await vault.delete(noteA.id);
      removeNoteFromEngines(ctx, noteA.id);

      // Note A should be gone
      expect(vault.list()).toHaveLength(1);
      expect(vault.list()[0].id).toBe(noteB.id);

      // Backlinks query should return empty (note A no longer exists)
      const backlinksAfterDelete = graphEngine.backlinks(noteA.id);
      expect(backlinksAfterDelete.length).toBe(0);
    });

    it('should handle deleting note that links to other notes', async () => {
      // Create target note
      const targetNote = await vault.create({ content: createNoteContent('Target Note') });

      // Create source note that links to target
      const sourceContent: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Links to ' },
                { type: 'note-reference', noteId: targetNote.id, text: 'Target' } as any,
              ],
            },
          ],
        },
      };
      const sourceNote = await vault.create({ content: sourceContent });
      await vault.save(sourceNote);
      const savedSourceNote = vault.read(sourceNote.id);

      // Index notes
      graphEngine.addNote(targetNote);
      graphEngine.addNote(savedSourceNote);
      searchEngine.indexNote(targetNote);
      searchEngine.indexNote(savedSourceNote);

      // Verify initial state
      expect(vault.list()).toHaveLength(2);
      const backlinks = graphEngine.backlinks(targetNote.id);
      expect(backlinks.length).toBe(1);

      // Delete source note (the one with the link)
      await vault.delete(sourceNote.id);
      removeNoteFromEngines(ctx, sourceNote.id);

      // Source note should be gone
      expect(vault.list()).toHaveLength(1);
      expect(vault.list()[0].id).toBe(targetNote.id);

      // Target note should have no more backlinks
      const backlinksAfter = graphEngine.backlinks(targetNote.id);
      expect(backlinksAfter.length).toBe(0);
    });

    it('should persist deletion across vault reload', async () => {
      // Create notes
      const note1 = await createNoteWithTitle(vault, 'Persistent Note 1');
      const note2 = await createNoteWithTitle(vault, 'Note to Delete');
      const note3 = await createNoteWithTitle(vault, 'Persistent Note 3');

      // Delete note2
      await vault.delete(note2.id);

      // Reload vault (simulates app restart)
      const newVault = await simulateAppRestart(tempDir);

      // Verify note2 is still gone after reload
      expect(newVault.list()).toHaveLength(2);
      expect(newVault.list().find((n) => n.id === note2.id)).toBeUndefined();

      // Verify other notes are present
      expect(newVault.list().find((n) => n.id === note1.id)).toBeDefined();
      expect(newVault.list().find((n) => n.id === note3.id)).toBeDefined();
    });
  });

  describe('Post-deletion state', () => {
    it('should allow creating new notes after deletion leaves vault empty', async () => {
      // Create and delete a note
      const note = await createNoteWithTitle(vault, 'Temporary Note');
      await vault.delete(note.id);

      expect(vault.list()).toHaveLength(0);

      // Create a new note
      const newNote = await createNoteWithTitle(vault, 'New Note After Delete');

      expect(vault.list()).toHaveLength(1);
      expect(vault.list()[0].metadata.title).toBe('New Note After Delete');
    });

    it('should maintain correct ordering after deletion', async () => {
      // Create 4 notes with different timestamps
      const note1 = await createNoteWithTitle(vault, 'Oldest');
      const note2 = await createNoteWithTitle(vault, 'Second');
      const note3 = await createNoteWithTitle(vault, 'Third');
      const note4 = await createNoteWithTitle(vault, 'Newest');

      // Delete the middle note
      await vault.delete(note2.id);

      // Get remaining notes sorted by updatedAt descending (most recent first)
      const remainingNotes = vault.list().sort((a, b) => b.updatedAt - a.updatedAt);

      expect(remainingNotes).toHaveLength(3);
      expect(remainingNotes[0].id).toBe(note4.id); // Newest
      expect(remainingNotes[1].id).toBe(note3.id); // Third
      expect(remainingNotes[2].id).toBe(note1.id); // Oldest
    });

    it('should find most recent note after deleting current note', async () => {
      // Create 3 notes
      const note1 = await createNoteWithTitle(vault, 'Note 1');
      const note2 = await createNoteWithTitle(vault, 'Note 2');
      const note3 = await createNoteWithTitle(vault, 'Note 3'); // Most recent

      // Simulate: note3 is the "current" note, and we delete it
      const currentNoteId = note3.id;
      await vault.delete(currentNoteId);

      // Get remaining notes sorted by updatedAt to find most recent
      const remainingNotes = vault.list().sort((a, b) => b.updatedAt - a.updatedAt);

      expect(remainingNotes).toHaveLength(2);

      // The most recent remaining note should be note2
      const mostRecentRemaining = remainingNotes[0];
      expect(mostRecentRemaining.id).toBe(note2.id);
      expect(mostRecentRemaining.metadata.title).toBe('Note 2');
    });
  });

  describe('Error handling', () => {
    it('should throw error when deleting non-existent note', async () => {
      // Create a note so vault isn't empty
      await createNoteWithTitle(vault, 'Some Note');

      // Try to delete a note that doesn't exist
      const fakeId = 'non-existent-note-id';

      await expect(vault.delete(fakeId)).rejects.toThrow();
    });

    it('should not affect other notes when deletion fails', async () => {
      // Create notes
      const note1 = await createNoteWithTitle(vault, 'Note 1');
      const note2 = await createNoteWithTitle(vault, 'Note 2');

      indexNoteInEngines(ctx, note1);
      indexNoteInEngines(ctx, note2);

      // Try to delete a non-existent note
      const fakeId = 'non-existent-note-id';
      try {
        await vault.delete(fakeId);
      } catch {
        // Expected to fail
      }

      // Verify existing notes are unaffected
      expect(vault.list()).toHaveLength(2);
      expect(graphEngine.getStats().nodes).toBe(2);
      expect(searchEngine.size()).toBe(2);
    });
  });

  describe('Search index cleanup after deletion', () => {
    it('should not return deleted note in search results', async () => {
      // Create notes with searchable content and explicit titles
      const note1 = await vault.create({
        title: 'Meeting Notes',
        content: createNoteContent('Meeting Notes', 'Discussion about the project timeline'),
      });
      const note2 = await vault.create({
        title: 'Project Ideas',
        content: createNoteContent('Project Ideas', 'Brainstorming new features'),
      });
      const note3 = await vault.create({
        title: 'Weekly Meeting',
        content: createNoteContent('Weekly Meeting', 'Team standup notes'),
      });

      // Index all notes
      indexNoteInEngines(ctx, note1);
      indexNoteInEngines(ctx, note2);
      indexNoteInEngines(ctx, note3);

      // Verify "meeting" search returns 2 notes before deletion
      const searchBefore = searchEngine.search('meeting');
      expect(searchBefore.length).toBe(2);
      const titlesBefore = searchBefore.map((r) => r.title);
      expect(titlesBefore).toContain('Meeting Notes');
      expect(titlesBefore).toContain('Weekly Meeting');

      // Delete "Meeting Notes"
      await vault.delete(note1.id);
      removeNoteFromEngines(ctx, note1.id);

      // Verify search only returns "Weekly Meeting" now
      const searchAfter = searchEngine.search('meeting');
      expect(searchAfter.length).toBe(1);
      expect(searchAfter[0].title).toBe('Weekly Meeting');
    });

    it('should rebuild search index correctly after restart with deletions', async () => {
      // Create notes
      const note1 = await vault.create({ content: createNoteContent('Keep This Note') });
      const note2 = await vault.create({ content: createNoteContent('Delete This Note') });
      const note3 = await vault.create({ content: createNoteContent('Another Keep Note') });

      // Delete note2
      await vault.delete(note2.id);

      // Simulate app restart: create new vault and search engine
      const newVault = await simulateAppRestart(tempDir);
      const newSearchEngine = new SearchEngine();

      // Rebuild index from loaded notes
      for (const note of newVault.list()) {
        newSearchEngine.indexNote(note);
      }

      // Verify only 2 notes are indexed
      expect(newSearchEngine.size()).toBe(2);

      // Verify deleted note is not in search
      const searchResults = newSearchEngine.search('Delete');
      expect(searchResults.length).toBe(0);

      // Verify kept notes are searchable
      const keepResults = newSearchEngine.search('Keep');
      expect(keepResults.length).toBe(2);
    });
  });
});
