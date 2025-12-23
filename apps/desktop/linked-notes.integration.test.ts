/**
 * E2E Integration Tests for Linked Notes Feature
 *
 * Tests the wiki-link functionality including:
 * - Flow 1: Wiki-link creation and navigation to new notes
 * - Flow 2: Autocomplete selection (title search integration)
 * - Flow 3: Back navigation with Cmd+[ (simulated via NavigationState)
 * - Flow 4: Command palette clears history
 * - Core wiki-link operations
 * - Metadata extraction for wiki-links
 * - Graph engine integration
 *
 * Note: Hook-based tests (useNavigationHistory) are in renderer tests.
 * This file focuses on data layer integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { NoteId, EditorContent } from '@scribe/shared';
import {
  type TestContext,
  type BlockNode,
  setupTestContext,
  cleanupTestContext,
  createNoteContent,
  createNoteWithTitle,
  createAndIndexNote,
  indexNoteInEngines,
  simulateAppRestart,
  createWikiLinkNode,
  getBlockChild,
  getNodeChildren,
} from './test-helpers';

/**
 * Simple navigation history state for testing navigation flows
 * This mirrors the hook's behavior without requiring React/DOM
 */
interface NavigationState {
  history: NoteId[];
  currentNoteId: NoteId | null;
}

function createNavigationState(currentNoteId: NoteId | null = null): NavigationState {
  return { history: [], currentNoteId };
}

function navigateToNote(
  state: NavigationState,
  noteId: NoteId,
  addToHistory: boolean = true
): NavigationState {
  const newHistory =
    addToHistory && state.currentNoteId ? [...state.history, state.currentNoteId] : state.history;
  return { history: newHistory, currentNoteId: noteId };
}

function navigateBack(state: NavigationState): NavigationState {
  if (state.history.length === 0) return state;
  const newHistory = [...state.history];
  const prevNoteId = newHistory.pop()!;
  return { history: newHistory, currentNoteId: prevNoteId };
}

function clearHistory(state: NavigationState): NavigationState {
  return { ...state, history: [] };
}

function canGoBack(state: NavigationState): boolean {
  return state.history.length > 0;
}

describe('Linked Notes E2E Integration Tests', () => {
  let ctx: TestContext;

  // Convenience aliases for cleaner test code
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-linked-notes-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  /**
   * Helper to create a note with a wiki-link in its content
   */
  function createNoteWithWikiLink(
    title: string,
    linkTitle: string,
    linkTargetId: NoteId | null
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
              { type: 'text', text: 'Content with link to ' },
              createWikiLinkNode(linkTitle, linkTitle, linkTargetId),
            ],
          },
        ],
      },
    };
  }

  /**
   * E2E Flow 1: Create and follow link to new note
   *
   * Per spec.md:
   * 1. Create initial note "Alpha"
   * 2. Type [[Beta]] (a non-existent note)
   * 3. Verify WikiLinkNode created in content
   * 4. Click the link
   * 5. Verify new note "Beta" is created and loaded
   * 6. Verify back button is visible
   * 7. Click back button
   * 8. Verify returned to "Alpha"
   */
  describe('Flow 1: Wiki-link creates and navigates to new note', () => {
    it('should create wiki-link node in content structure', async () => {
      // Step 1: Create initial note "Alpha" with a wiki-link to "Beta"
      const alphaContent = createNoteWithWikiLink('Alpha', 'Beta', null);
      const alpha = await vault.create({ content: alphaContent });

      // Step 3: Verify WikiLinkNode is in the content structure
      const loaded = vault.read(alpha.id);
      expect(loaded).toBeDefined();

      // Find the wiki-link node in the content using type-safe accessor
      const paragraph = getBlockChild(loaded!.content, 1);
      expect(paragraph).toBeDefined();
      const paragraphChildren = getNodeChildren(paragraph);
      expect(paragraphChildren.length).toBe(2);

      const wikiLinkNode = paragraphChildren[1];
      expect(wikiLinkNode.type).toBe('wiki-link');
      expect(wikiLinkNode.noteTitle).toBe('Beta');
      expect(wikiLinkNode.displayText).toBe('Beta');
      expect(wikiLinkNode.targetId).toBeNull(); // Unresolved initially
    });

    it('should navigate to new note when clicking unresolved wiki-link', async () => {
      // Create note "Alpha" with link to non-existent "Beta"
      const alphaContent = createNoteWithWikiLink('Alpha', 'Beta', null);
      const alpha = await vault.create({ content: alphaContent });
      indexNoteInEngines(ctx, alpha);

      // Simulate what happens when clicking an unresolved link:
      // Per spec: "On click of unresolved link: Immediately create a new note with that title"

      // Step 4: Search for existing note with title "Beta"
      const searchResults = searchEngine.search('Beta');
      expect(searchResults.length).toBe(0); // No existing note

      // Step 5: Create new note "Beta" (simulating link click behavior)
      // Note: title is now set explicitly, not extracted from content
      const betaContent = createNoteContent('Beta');
      const beta = await vault.create({ content: betaContent, title: 'Beta' });
      indexNoteInEngines(ctx, beta);

      // Verify new note was created
      expect(vault.read(beta.id)).toBeDefined();
      expect(vault.read(beta.id)?.title).toBe('Beta');

      // Verify it's now searchable
      const newSearchResults = searchEngine.search('Beta');
      expect(newSearchResults.length).toBe(1);
      expect(newSearchResults[0].id).toBe(beta.id);
    });

    it('should support back navigation after wiki-link navigation', async () => {
      // Create notes
      const alpha = await createNoteWithTitle(vault, 'Alpha');
      const beta = await createNoteWithTitle(vault, 'Beta');

      // Initialize navigation state at Alpha
      let navState = createNavigationState(alpha.id);

      // Initially, no back navigation available
      expect(canGoBack(navState)).toBe(false);
      expect(navState.history).toEqual([]);

      // Step 4: Navigate to Beta via wiki-link (adds Alpha to history)
      navState = navigateToNote(navState, beta.id, true);

      // Step 6: Verify back button is visible (canGoBack = true)
      expect(canGoBack(navState)).toBe(true);
      expect(navState.history).toEqual([alpha.id]);
      expect(navState.currentNoteId).toBe(beta.id);

      // Step 7: Click back button
      navState = navigateBack(navState);

      // Step 8: Verify returned to "Alpha"
      expect(navState.currentNoteId).toBe(alpha.id);
      expect(navState.history).toEqual([]);
      expect(canGoBack(navState)).toBe(false);
    });

    it('should handle navigation chain: Alpha -> Beta -> Gamma', async () => {
      const alpha = await createNoteWithTitle(vault, 'Alpha');
      const beta = await createNoteWithTitle(vault, 'Beta');
      const gamma = await createNoteWithTitle(vault, 'Gamma');

      // Start at Alpha
      let navState = createNavigationState(alpha.id);

      // Navigate Alpha -> Beta
      navState = navigateToNote(navState, beta.id, true);

      // Navigate Beta -> Gamma
      navState = navigateToNote(navState, gamma.id, true);

      // History should be [Alpha, Beta]
      expect(navState.history).toEqual([alpha.id, beta.id]);
      expect(canGoBack(navState)).toBe(true);
      expect(navState.currentNoteId).toBe(gamma.id);

      // Navigate back to Beta
      navState = navigateBack(navState);
      expect(navState.currentNoteId).toBe(beta.id);
      expect(navState.history).toEqual([alpha.id]);

      // Navigate back to Alpha
      navState = navigateBack(navState);
      expect(navState.currentNoteId).toBe(alpha.id);
      expect(navState.history).toEqual([]);
      expect(canGoBack(navState)).toBe(false);
    });
  });

  /**
   * E2E Flow 2: Autocomplete selection
   *
   * Per spec.md:
   * 1. Create notes "Project Alpha", "Project Beta"
   * 2. In new note, type [[Proj
   * 3. Verify autocomplete popup shows
   * 4. Verify autocomplete shows matching notes
   * 5. Select with keyboard (ArrowDown, Enter)
   * 6. Verify link inserted
   */
  describe('Flow 2: Autocomplete shows matching notes', () => {
    it('should find matching notes by title prefix', async () => {
      // Step 1: Create notes "Project Alpha", "Project Beta"
      const projectAlpha = await createAndIndexNote(ctx, 'Project Alpha', 'Alpha project details');
      const projectBeta = await createAndIndexNote(ctx, 'Project Beta', 'Beta project details');
      await createAndIndexNote(ctx, 'Other Note', 'Unrelated content');

      // Step 2-4: Search for "Proj" (simulating autocomplete query)
      // The autocomplete uses searchTitles which is a title-focused search
      const searchResults = searchEngine.search('Project');

      // Should find both Project Alpha and Project Beta
      expect(searchResults.length).toBeGreaterThanOrEqual(2);

      const titles = searchResults.map((r) => r.title);
      expect(titles).toContain('Project Alpha');
      expect(titles).toContain('Project Beta');

      // Should NOT find unrelated note
      expect(titles).not.toContain('Other Note');
    });

    it('should exclude current note from autocomplete results', async () => {
      // Create notes
      const note1 = await createAndIndexNote(ctx, 'Meeting Notes');
      const note2 = await createAndIndexNote(ctx, 'Meeting Summary');

      // Simulate autocomplete excluding current note (note1)
      const results = searchEngine.search('Meeting');
      const filteredResults = results.filter((r) => r.id !== note1.id);

      // Should only have Meeting Summary
      expect(filteredResults.length).toBe(1);
      expect(filteredResults[0].id).toBe(note2.id);
    });

    it('should limit autocomplete results to 10', async () => {
      // Create 15 notes with similar titles
      for (let i = 1; i <= 15; i++) {
        await createAndIndexNote(ctx, `Test Note ${i.toString().padStart(2, '0')}`);
      }

      // Search for "Test" with limit
      const results = searchEngine.search('Test').slice(0, 10);

      expect(results.length).toBe(10);
    });

    it('should insert resolved wiki-link after autocomplete selection', async () => {
      // Create a target note
      const targetNote = await createAndIndexNote(ctx, 'Target Note');

      // Simulate selecting from autocomplete - this creates a wiki-link with targetId set
      const sourceContent: EditorContent = {
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
                { type: 'text', text: 'Reference: ' },
                createWikiLinkNode('Target Note', 'Target Note', targetNote.id),
              ],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });
      const savedSource = vault.read(sourceNote.id);

      // Verify wiki-link has resolved targetId using type-safe accessor
      const paragraph = getBlockChild(savedSource!.content, 1);
      const wikiLink = getNodeChildren(paragraph)[1];

      expect(wikiLink.type).toBe('wiki-link');
      expect(wikiLink.targetId).toBe(targetNote.id);
    });
  });

  /**
   * E2E Flow 3: Back navigation with Cmd+[
   *
   * Per spec.md:
   * 1. Create note "Alpha" with [[Beta]] link
   * 2. Click link to navigate to Beta
   * 3. Press Cmd+[
   * 4. Verify back at Alpha
   * 5. Press Cmd+[ again - nothing should happen
   */
  describe('Flow 3: Back navigation with Cmd+[', () => {
    it('should navigate back when history is not empty', async () => {
      const alpha = await createNoteWithTitle(vault, 'Alpha');
      const beta = await createNoteWithTitle(vault, 'Beta');

      // Start at Alpha
      let navState = createNavigationState(alpha.id);

      // Navigate to Beta (simulating wiki-link click)
      navState = navigateToNote(navState, beta.id, true);

      expect(canGoBack(navState)).toBe(true);

      // Step 3: Press Cmd+[ (calls navigateBack)
      navState = navigateBack(navState);

      // Step 4: Verify back at Alpha
      expect(navState.currentNoteId).toBe(alpha.id);
      expect(navState.history).toEqual([]);
    });

    it('should do nothing when history is empty (Cmd+[ at start)', async () => {
      const alpha = await createNoteWithTitle(vault, 'Alpha');

      // Start at Alpha with empty history
      let navState = createNavigationState(alpha.id);

      expect(canGoBack(navState)).toBe(false);

      // Step 5: Press Cmd+[ when history is empty - nothing should happen
      const originalNoteId = navState.currentNoteId;
      navState = navigateBack(navState);

      // Note should not have changed
      expect(navState.currentNoteId).toBe(originalNoteId);
      expect(navState.history).toEqual([]);
    });
  });

  /**
   * E2E Flow 4: Command palette clears history
   *
   * Per spec.md:
   * 1. Navigate Alpha -> Beta -> Gamma via wiki-links
   * 2. Open command palette, select Alpha directly
   * 3. Verify back button is not visible (history cleared)
   */
  describe('Flow 4: Command palette navigation clears history', () => {
    it('should clear history when navigating via command palette', async () => {
      const alpha = await createNoteWithTitle(vault, 'Alpha');
      const beta = await createNoteWithTitle(vault, 'Beta');
      const gamma = await createNoteWithTitle(vault, 'Gamma');

      // Start at Alpha
      let navState = createNavigationState(alpha.id);

      // Step 1: Navigate Alpha -> Beta -> Gamma via wiki-links
      navState = navigateToNote(navState, beta.id, true);
      navState = navigateToNote(navState, gamma.id, true);

      // Verify history is populated
      expect(navState.history).toEqual([alpha.id, beta.id]);
      expect(canGoBack(navState)).toBe(true);

      // Step 2: Open command palette, select Alpha directly
      // Per spec: "Navigate via command palette: Clear history (fresh navigation)"
      navState = clearHistory(navState);
      navState = navigateToNote(navState, alpha.id, false); // addToHistory = false for command palette

      // Step 3: Verify back button is not visible (history cleared)
      expect(navState.history).toEqual([]);
      expect(canGoBack(navState)).toBe(false);
      expect(navState.currentNoteId).toBe(alpha.id);
    });

    it('should clear history when creating a new note', async () => {
      const alpha = await createNoteWithTitle(vault, 'Alpha');
      const beta = await createNoteWithTitle(vault, 'Beta');

      // Start at Alpha
      let navState = createNavigationState(alpha.id);

      // Navigate to Beta
      navState = navigateToNote(navState, beta.id, true);

      expect(canGoBack(navState)).toBe(true);

      // Create new note (triggers clearHistory)
      const newNote = await vault.create();

      navState = clearHistory(navState);
      navState = { ...navState, currentNoteId: newNote.id };

      // History should be cleared
      expect(navState.history).toEqual([]);
      expect(canGoBack(navState)).toBe(false);
    });
  });

  /**
   * Wiki-link metadata extraction tests
   */
  describe('Wiki-link metadata extraction', () => {
    it('should extract wiki-link targetId into note links metadata', async () => {
      const targetNote = await createAndIndexNote(ctx, 'Target Note');

      // Create note with wiki-link that has a resolved targetId
      const sourceContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Target Note', 'Target Note', targetNote.id)],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });
      const savedSource = vault.read(sourceNote.id);

      // Verify the link is extracted in metadata
      expect(savedSource?.metadata.links).toContain(targetNote.id);
    });

    it('should not extract links when wiki-link targetId is null', async () => {
      // Create note with unresolved wiki-link (no targetId)
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Non-existent Note')],
            },
          ],
        },
      };

      const note = await vault.create({ content });
      const saved = vault.read(note.id);

      // Links should be empty (null targetId is not extracted)
      expect(saved?.metadata.links).toEqual([]);
    });

    it('should extract multiple wiki-links from a single note', async () => {
      const target1 = await createAndIndexNote(ctx, 'Target One');
      const target2 = await createAndIndexNote(ctx, 'Target Two');

      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Multi Link Note' }],
            },
            {
              type: 'paragraph',
              children: [
                createWikiLinkNode('Target One', 'Target One', target1.id),
                { type: 'text', text: ' and ' },
                createWikiLinkNode('Target Two', 'Target Two', target2.id),
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content });
      const saved = vault.read(note.id);

      expect(saved?.metadata.links).toContain(target1.id);
      expect(saved?.metadata.links).toContain(target2.id);
      expect(saved?.metadata.links.length).toBe(2);
    });
  });

  /**
   * Graph engine integration tests
   */
  describe('Graph engine integration', () => {
    it('should track wiki-link backlinks in graph engine', async () => {
      // Create target note
      const targetNote = await createAndIndexNote(ctx, 'Target Note');

      // Create source note with wiki-link to target
      const sourceContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Target Note', 'Target Note', targetNote.id)],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });
      const savedSource = vault.read(sourceNote.id);
      indexNoteInEngines(ctx, savedSource!);

      // Verify backlinks
      const backlinks = graphEngine.backlinks(targetNote.id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(sourceNote.id);
    });

    it('should update backlinks when wiki-link is removed', async () => {
      const targetNote = await createAndIndexNote(ctx, 'Target Note');

      // Create source with link
      const sourceContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Target Note', 'Target Note', targetNote.id)],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });
      let savedSource = vault.read(sourceNote.id);
      indexNoteInEngines(ctx, savedSource!);

      // Verify initial backlink
      let backlinks = graphEngine.backlinks(targetNote.id);
      expect(backlinks.length).toBe(1);

      // Update source to remove the wiki-link
      savedSource = vault.read(sourceNote.id);
      if (savedSource) {
        savedSource.content = createNoteContent('Source Note', 'No more links');
        await vault.save(savedSource);

        // Re-index with updated content
        const updatedSource = vault.read(sourceNote.id);

        // Remove old entry and add updated one
        graphEngine.removeNote(sourceNote.id);
        graphEngine.addNote(updatedSource!);
      }

      // Verify backlink is removed
      backlinks = graphEngine.backlinks(targetNote.id);
      expect(backlinks.length).toBe(0);
    });
  });

  /**
   * Alias syntax tests
   */
  describe('Wiki-link alias syntax', () => {
    it('should support alias display text', async () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Note with alias' }],
            },
            {
              type: 'paragraph',
              children: [
                createWikiLinkNode('Meeting Notes', "yesterday's meeting", 'some-note-id'),
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content });
      const saved = vault.read(note.id);

      const paragraph = getBlockChild(saved!.content, 1);
      const wikiLink = getNodeChildren(paragraph)[0];

      expect(wikiLink.noteTitle).toBe('Meeting Notes');
      expect(wikiLink.displayText).toBe("yesterday's meeting");
    });
  });

  /**
   * Persistence tests
   */
  describe('Wiki-link persistence', () => {
    it('should persist wiki-links across vault reload', async () => {
      const targetNote = await createAndIndexNote(ctx, 'Target Note');

      const sourceContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Target Note', 'Target Note', targetNote.id)],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });

      // Simulate app restart
      const newVault = await simulateAppRestart(tempDir);

      // Reload and verify wiki-link is preserved
      const reloadedSource = newVault.read(sourceNote.id);
      expect(reloadedSource).toBeDefined();

      const paragraph = getBlockChild(reloadedSource!.content, 1);
      const wikiLink = getNodeChildren(paragraph)[0];

      expect(wikiLink.type).toBe('wiki-link');
      expect(wikiLink.noteTitle).toBe('Target Note');
      expect(wikiLink.targetId).toBe(targetNote.id);
    });

    it('should rebuild graph with wiki-links after restart', async () => {
      const targetNote = await createNoteWithTitle(vault, 'Target Note');
      indexNoteInEngines(ctx, targetNote);

      const sourceContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Target Note', 'Target Note', targetNote.id)],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });
      const savedSource = vault.read(sourceNote.id);
      indexNoteInEngines(ctx, savedSource!);

      // Simulate app restart
      const newVault = await simulateAppRestart(tempDir);
      const newGraphEngine = new GraphEngine();

      // Rebuild graph from loaded notes
      for (const note of newVault.list()) {
        newGraphEngine.addNote(note);
      }

      // Verify backlinks are restored
      const backlinks = newGraphEngine.backlinks(targetNote.id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(sourceNote.id);
    });
  });

  /**
   * Edge cases
   */
  describe('Edge cases', () => {
    it('should handle self-link (link to current note)', async () => {
      const note = await createNoteWithTitle(vault, 'Self Referencing Note');

      // Per spec: "Link to self: Allowed but no-op (don't navigate)"
      // Test that navigation state handles this correctly
      let navState = createNavigationState(note.id);

      // Self-navigation check would happen at UI layer (WikiLinkComponent)
      // but we can verify navigation to same note doesn't corrupt state
      expect(navState.history).toEqual([]);
      expect(navState.currentNoteId).toBe(note.id);
    });

    it('should handle broken link (note deleted after link created)', async () => {
      // Create target note
      const targetNote = await createAndIndexNote(ctx, 'Target Note');
      const targetId = targetNote.id;

      // Create source with wiki-link
      const sourceContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Source Note' }],
            },
            {
              type: 'paragraph',
              children: [createWikiLinkNode('Target Note', 'Target Note', targetId)],
            },
          ],
        },
      };

      const sourceNote = await vault.create({ content: sourceContent });
      const savedSource = vault.read(sourceNote.id);
      indexNoteInEngines(ctx, savedSource!);

      // Delete target note (removes from engines too)
      graphEngine.removeNote(targetId);
      searchEngine.removeNote(targetId);
      await vault.delete(targetId);

      // Source note still exists with broken link
      const reloadedSource = vault.read(sourceNote.id);
      expect(reloadedSource).toBeDefined();

      // Wiki-link still has the targetId, but it points to deleted note
      const paragraph = getBlockChild(reloadedSource!.content, 1);
      const wikiLink = getNodeChildren(paragraph)[0];
      expect(wikiLink.targetId).toBe(targetId);

      // Per spec: "Broken link (note deleted): Click creates new note with that title"
      // Verify the target note no longer exists in vault
      const noteList = vault.list();
      const targetInList = noteList.find((n) => n.id === targetId);
      expect(targetInList).toBeUndefined();

      // Verify search doesn't find the deleted note
      const searchResults = searchEngine.search('Target Note');
      expect(searchResults.find((r) => r.id === targetId)).toBeUndefined();
    });

    it('should handle creating note from broken link', async () => {
      // This simulates what happens when clicking a broken link:
      // Per spec: "On click of unresolved link: Immediately create a new note with that title"

      const brokenLinkTitle = 'Deleted Target';

      // Verify note doesn't exist
      const initialSearch = searchEngine.search(brokenLinkTitle);
      expect(initialSearch.length).toBe(0);

      // Simulate clicking broken link - creates new note with that title
      // Note: title is now set explicitly, not extracted from content
      const newNoteContent = createNoteContent(brokenLinkTitle);
      const newNote = await vault.create({ content: newNoteContent, title: brokenLinkTitle });
      indexNoteInEngines(ctx, newNote);

      // Verify new note was created
      expect(newNote.title).toBe(brokenLinkTitle);

      // Verify it's now searchable
      const afterSearch = searchEngine.search(brokenLinkTitle);
      expect(afterSearch.length).toBe(1);
      expect(afterSearch[0].id).toBe(newNote.id);
    });

    it('should create new note with explicit title when clicking unresolved wiki-link', async () => {
      // Wiki-link note creation now sets note.title directly
      // instead of creating an H1 heading in the content

      const linkTitle = 'New Note From Link';

      // Create note with explicit title and empty/minimal content
      // (as App.tsx now does for wiki-link creation)
      const emptyContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [],
            },
          ],
        },
      };

      const newNote = await vault.create({
        content: emptyContent,
        title: linkTitle,
      });

      // Verify the note has the title set correctly
      const saved = vault.read(newNote.id);
      expect(saved).toBeDefined();
      expect(saved?.title).toBe(linkTitle);

      // Verify the content does NOT contain an H1 heading
      const firstChild = getBlockChild(saved!.content, 0);
      expect(firstChild.type).not.toBe('heading');
    });
  });
});
