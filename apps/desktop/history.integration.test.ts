/**
 * E2E Integration Tests for Navigation History Feature
 *
 * Tests the browser-style navigation history with back/forward buttons:
 * - Flow 11: Wiki-link navigation history (A -> B -> C, back twice, forward once)
 * - Flow 12: Back then forward navigation
 * - Flow 13: Branch history (navigate after back truncates forward)
 * - Flow 14: Sidebar navigation adds to history
 * - Flow 15: Command palette navigation adds to history
 * - Flow 16: Context panel/backlink navigation adds to history
 * - Flow 17: Delete note removes from history
 * - Flow 18: Keyboard shortcuts (Cmd+[ back, Cmd+] forward)
 *
 * Note: These tests use a simulated NavigationHistory class that mirrors
 * the useNavigationHistory hook logic without requiring React/DOM.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import type { NoteId, LexicalState } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createAndIndexNote,
  indexNoteInEngines,
  removeNoteFromEngines,
  createWikiLinkNode,
} from './test-helpers';

/**
 * Simulated navigation history state matching useNavigationHistory hook behavior.
 * This mirrors the dual-pointer model with a stack and currentIndex.
 */
interface NavigationState {
  stack: NoteId[];
  currentIndex: number;
}

/**
 * NavigationHistory class simulating the useNavigationHistory hook.
 *
 * IMPORTANT: This class intentionally duplicates the hook's logic rather than
 * testing the actual React hook directly. This design decision was made because:
 *
 * 1. These are E2E integration tests focused on testing navigation FLOWS
 *    (wiki-links, sidebar, command palette) with real vault/graph operations,
 *    not the hook's React-specific behavior.
 *
 * 2. Testing the real hook would require @testing-library/react-hooks and
 *    DOM dependencies, adding complexity without testing the actual integration
 *    points (IPC, file system, graph engine).
 *
 * 3. The hook itself has separate unit tests that cover React-specific behavior
 *    (effects, refs, flushSync, etc.).
 *
 * This simulation ensures the navigation state model is correct while allowing
 * us to test the broader system integration without React/DOM overhead.
 */
class NavigationHistory {
  private state: NavigationState = {
    stack: [],
    currentIndex: -1,
  };

  private loadNoteCalls: NoteId[] = [];

  get canGoBack(): boolean {
    return this.state.currentIndex > 0;
  }

  get canGoForward(): boolean {
    return this.state.currentIndex < this.state.stack.length - 1;
  }

  get currentNoteId(): NoteId | null {
    if (this.state.currentIndex < 0 || this.state.currentIndex >= this.state.stack.length) {
      return null;
    }
    return this.state.stack[this.state.currentIndex];
  }

  get historyStack(): NoteId[] {
    return [...this.state.stack];
  }

  get historyIndex(): number {
    return this.state.currentIndex;
  }

  /**
   * Navigate to a note, truncating forward history and adding to stack
   * Mirrors navigateToNote from useNavigationHistory
   */
  navigateToNote(noteId: NoteId): void {
    // No-op if navigating to same note
    if (noteId === this.currentNoteId) return;

    // Truncate forward history
    const newStack = this.state.stack.slice(0, this.state.currentIndex + 1);

    // Add new note
    newStack.push(noteId);

    // Update state
    this.state = {
      stack: newStack,
      currentIndex: newStack.length - 1,
    };

    this.loadNoteCalls.push(noteId);
  }

  /**
   * Navigate back to the previous note in history
   * Mirrors navigateBack from useNavigationHistory
   */
  navigateBack(): void {
    if (!this.canGoBack) return;

    const prevNoteId = this.state.stack[this.state.currentIndex - 1];
    this.state = {
      ...this.state,
      currentIndex: this.state.currentIndex - 1,
    };
    this.loadNoteCalls.push(prevNoteId);
  }

  /**
   * Navigate forward to the next note in history
   * Mirrors navigateForward from useNavigationHistory
   */
  navigateForward(): void {
    if (!this.canGoForward) return;

    const nextNoteId = this.state.stack[this.state.currentIndex + 1];
    this.state = {
      ...this.state,
      currentIndex: this.state.currentIndex + 1,
    };
    this.loadNoteCalls.push(nextNoteId);
  }

  /**
   * Remove a note from the history stack (e.g., when note is deleted)
   * Mirrors removeFromHistory from useNavigationHistory
   */
  removeFromHistory(noteId: NoteId): void {
    const newStack: NoteId[] = [];
    let newIndex = this.state.currentIndex;
    let removedBeforeCurrent = 0;

    for (let i = 0; i < this.state.stack.length; i++) {
      if (this.state.stack[i] !== noteId) {
        newStack.push(this.state.stack[i]);
      } else if (i < this.state.currentIndex) {
        removedBeforeCurrent++;
      }
    }

    newIndex = Math.max(0, newIndex - removedBeforeCurrent);
    if (newIndex >= newStack.length) {
      newIndex = newStack.length - 1;
    }

    this.state = { stack: newStack, currentIndex: newIndex };
  }

  /**
   * Clear all navigation history
   */
  clearHistory(): void {
    this.state = { stack: [], currentIndex: -1 };
    this.loadNoteCalls = [];
  }

  /**
   * Get all loadNote calls for verification
   */
  getLoadNoteCalls(): NoteId[] {
    return [...this.loadNoteCalls];
  }

  /**
   * Reset loadNote call history for clean assertions
   */
  resetLoadNoteCalls(): void {
    this.loadNoteCalls = [];
  }
}

describe('Navigation History E2E Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let navHistory: NavigationHistory;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-history-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    navHistory = new NavigationHistory();
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
  ): LexicalState {
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
   * redesign-11: Wiki-link navigation history
   *
   * Per spec:
   * - Open note A, click wiki-link to B, click wiki-link to C
   * - Verify can go back twice to A
   * - Verify forward navigation works after going back
   */
  describe('Flow 11: Wiki-link navigation history', () => {
    it('should track navigation through wiki-links: A -> B -> C', async () => {
      // Create three notes with wiki-links
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Start at note A
      navHistory.navigateToNote(noteA.id);
      expect(navHistory.currentNoteId).toBe(noteA.id);
      expect(navHistory.canGoBack).toBe(false);
      expect(navHistory.canGoForward).toBe(false);

      // Click wiki-link to navigate to B
      navHistory.navigateToNote(noteB.id);
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.canGoBack).toBe(true);
      expect(navHistory.canGoForward).toBe(false);

      // Click wiki-link to navigate to C
      navHistory.navigateToNote(noteC.id);
      expect(navHistory.currentNoteId).toBe(noteC.id);
      expect(navHistory.canGoBack).toBe(true);
      expect(navHistory.canGoForward).toBe(false);

      // History should be [A, B, C] with index at 2
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteC.id]);
      expect(navHistory.historyIndex).toBe(2);
    });

    it('should navigate back twice from C to A', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Go back to B
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.canGoBack).toBe(true);
      expect(navHistory.canGoForward).toBe(true);

      // Go back to A
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
      expect(navHistory.canGoBack).toBe(false);
      expect(navHistory.canGoForward).toBe(true);
    });

    it('should support forward navigation after going back', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Go back twice to A
      navHistory.navigateBack();
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);

      // Go forward to B
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.canGoBack).toBe(true);
      expect(navHistory.canGoForward).toBe(true);

      // Go forward to C
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteC.id);
      expect(navHistory.canGoBack).toBe(true);
      expect(navHistory.canGoForward).toBe(false);
    });
  });

  /**
   * redesign-12: Back then forward navigation
   *
   * Per spec:
   * - Navigate A->B->C
   * - Go back twice (to A)
   * - Go forward once (to B)
   * - Verify correct note is displayed at each step
   */
  describe('Flow 12: Back then forward navigation', () => {
    it('should navigate A->B->C, back to A, forward to B', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Verify at C
      expect(navHistory.currentNoteId).toBe(noteC.id);
      expect(navHistory.historyIndex).toBe(2);

      // Go back twice to A
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);

      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
      expect(navHistory.historyIndex).toBe(0);

      // Go forward once to B
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.historyIndex).toBe(1);

      // Verify can still go forward to C
      expect(navHistory.canGoForward).toBe(true);
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteC.id);
    });

    it('should call loadNote with correct IDs during navigation', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);
      navHistory.resetLoadNoteCalls();

      // Go back to A
      navHistory.navigateBack();
      navHistory.navigateBack();

      // Go forward to B
      navHistory.navigateForward();

      // Verify loadNote was called with correct IDs
      const calls = navHistory.getLoadNoteCalls();
      expect(calls).toEqual([noteB.id, noteA.id, noteB.id]);
    });
  });

  /**
   * redesign-13: Branch history (navigate after back)
   *
   * Per spec:
   * - Navigate A->B->C
   * - Go back to B
   * - Navigate to D (via wiki-link or sidebar)
   * - Verify forward button is disabled (C was truncated)
   * - Verify can go back to B, then to A
   */
  describe('Flow 13: Branch history (navigate after back truncates forward)', () => {
    it('should truncate forward history when navigating to new note after going back', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');
      const noteD = await createAndIndexNote(ctx, 'Note Delta');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Go back to B
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.canGoForward).toBe(true); // Can still go to C

      // Navigate to D (this should truncate C from history)
      navHistory.navigateToNote(noteD.id);

      // Verify forward is now disabled (C was truncated)
      expect(navHistory.canGoForward).toBe(false);
      expect(navHistory.currentNoteId).toBe(noteD.id);

      // History should now be [A, B, D]
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteD.id]);
    });

    it('should still allow back navigation after truncation', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');
      const noteD = await createAndIndexNote(ctx, 'Note Delta');

      // Navigate A -> B -> C, back to B, then to D
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);
      navHistory.navigateBack();
      navHistory.navigateToNote(noteD.id);

      // Verify can go back to B, then to A
      expect(navHistory.canGoBack).toBe(true);

      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);

      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
      expect(navHistory.canGoBack).toBe(false);
    });

    it('should not include truncated note in history after branching', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');
      const noteD = await createAndIndexNote(ctx, 'Note Delta');

      // Navigate A -> B -> C, back to B, then to D
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);
      navHistory.navigateBack();
      navHistory.navigateToNote(noteD.id);

      // C should NOT be in the history stack anymore
      expect(navHistory.historyStack).not.toContain(noteC.id);
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteD.id]);
    });
  });

  /**
   * redesign-14: Sidebar navigation adds to history
   *
   * Per spec:
   * - Open note A
   * - Select note B from sidebar
   * - Verify stack is [A, B] and can go back
   * - Previously sidebar navigation may have cleared history - verify this no longer happens
   */
  describe('Flow 14: Sidebar navigation adds to history', () => {
    it('should add sidebar navigation to history', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');

      // Open note A (initial navigation)
      navHistory.navigateToNote(noteA.id);
      expect(navHistory.currentNoteId).toBe(noteA.id);
      expect(navHistory.canGoBack).toBe(false);

      // Select note B from sidebar (uses same navigateToNote as wiki-links)
      navHistory.navigateToNote(noteB.id);

      // Verify stack is [A, B]
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id]);
      expect(navHistory.currentNoteId).toBe(noteB.id);

      // Verify can go back to A
      expect(navHistory.canGoBack).toBe(true);
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should preserve history when using sidebar navigation', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Build history via wiki-links: A -> B
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);

      // Select note C from sidebar
      navHistory.navigateToNote(noteC.id);

      // History should be preserved: [A, B, C]
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteC.id]);
      expect(navHistory.canGoBack).toBe(true);

      // Can navigate back through entire history
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);

      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should not duplicate when selecting current note from sidebar', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');

      navHistory.navigateToNote(noteA.id);

      // Select same note from sidebar (no-op)
      navHistory.navigateToNote(noteA.id);

      // History should still have only one entry
      expect(navHistory.historyStack).toEqual([noteA.id]);
      expect(navHistory.historyIndex).toBe(0);
    });
  });

  /**
   * redesign-15: Command palette navigation adds to history
   *
   * Per spec:
   * - Open note A
   * - Open note B via Cmd+O command palette
   * - Verify stack is [A, B] and can go back
   * - Previously command palette navigation cleared history - verify this no longer happens
   */
  describe('Flow 15: Command palette navigation adds to history', () => {
    it('should add command palette navigation to history', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');

      // Open note A
      navHistory.navigateToNote(noteA.id);
      expect(navHistory.currentNoteId).toBe(noteA.id);

      // Open note B via Cmd+O command palette (uses same navigateToNote)
      navHistory.navigateToNote(noteB.id);

      // Verify stack is [A, B]
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id]);
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.canGoBack).toBe(true);
    });

    it('should preserve existing history when using command palette', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Build history: A -> B
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);

      // Open note C via command palette
      navHistory.navigateToNote(noteC.id);

      // Full history preserved
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteC.id]);

      // Navigate back through all
      navHistory.navigateBack();
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should allow forward navigation after command palette selection', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Go back to A
      navHistory.navigateBack();
      navHistory.navigateBack();

      // Forward still works
      expect(navHistory.canGoForward).toBe(true);
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteB.id);
    });
  });

  /**
   * redesign-16: Context panel/backlink navigation adds to history
   *
   * Per spec:
   * - Open note A
   * - Click backlink to note B in context panel
   * - Verify stack is [A, B] and can go back
   */
  describe('Flow 16: Context panel/backlink navigation adds to history', () => {
    it('should add backlink navigation to history', async () => {
      // Create notes with backlink relationship
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await vault.create({
        content: createNoteWithWikiLink('Note Beta', 'Note Alpha', noteA.id),
      });
      indexNoteInEngines(ctx, noteB);

      // Start at note A
      navHistory.navigateToNote(noteA.id);

      // Click backlink to navigate to B (context panel uses same navigateToNote)
      navHistory.navigateToNote(noteB.id);

      // Verify stack is [A, B]
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id]);
      expect(navHistory.canGoBack).toBe(true);

      // Can go back to A
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should verify backlinks exist in graph engine', async () => {
      const noteA = await createAndIndexNote(ctx, 'Target Note');
      const noteB = await vault.create({
        content: createNoteWithWikiLink('Source Note', 'Target Note', noteA.id),
      });
      const savedNoteB = vault.read(noteB.id);
      indexNoteInEngines(ctx, savedNoteB!);

      // Verify backlink exists
      const backlinks = graphEngine.backlinks(noteA.id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(noteB.id);
    });

    it('should preserve history when navigating from backlink', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await vault.create({
        content: createNoteWithWikiLink('Note Gamma', 'Note Beta', noteB.id),
      });
      indexNoteInEngines(ctx, noteC);

      // Navigate A -> B
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);

      // Click backlink from B to C (in context panel)
      navHistory.navigateToNote(noteC.id);

      // History should be [A, B, C]
      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteC.id]);
    });
  });

  /**
   * redesign-17: Delete note in history
   *
   * Per spec:
   * - Navigate A->B->C
   * - Delete note B
   * - Verify B is removed from history stack
   * - Verify can still navigate back (now directly A->C)
   */
  describe('Flow 17: Delete note removes from history', () => {
    it('should remove deleted note from history stack', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteC.id]);

      // Delete note B
      await vault.delete(noteB.id);
      removeNoteFromEngines(ctx, noteB.id);
      navHistory.removeFromHistory(noteB.id);

      // Verify B is removed from history
      expect(navHistory.historyStack).not.toContain(noteB.id);
      expect(navHistory.historyStack).toEqual([noteA.id, noteC.id]);
    });

    it('should adjust currentIndex correctly when deleting note before current', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C (currently at C, index 2)
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      expect(navHistory.currentNoteId).toBe(noteC.id);
      expect(navHistory.historyIndex).toBe(2);

      // Delete B (before current position)
      await vault.delete(noteB.id);
      navHistory.removeFromHistory(noteB.id);

      // Current note should still be C, but index adjusted to 1
      expect(navHistory.currentNoteId).toBe(noteC.id);
      expect(navHistory.historyIndex).toBe(1);
      expect(navHistory.historyStack).toEqual([noteA.id, noteC.id]);
    });

    it('should allow back navigation after deleting middle note', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Delete B
      await vault.delete(noteB.id);
      navHistory.removeFromHistory(noteB.id);

      // Should be able to go back directly to A
      expect(navHistory.canGoBack).toBe(true);
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should handle deleting current note', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Go back to B (now current note is B, index 1)
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);
      expect(navHistory.historyIndex).toBe(1);

      // Delete B (the current note)
      await vault.delete(noteB.id);
      navHistory.removeFromHistory(noteB.id);

      // History should be [A, C]
      expect(navHistory.historyStack).toEqual([noteA.id, noteC.id]);
      // Index stays at 1 (clamped to remaining stack size - 1)
      // The removeFromHistory logic doesn't change the index when removing current
      // unless it would be out of bounds. Since we were at index 1 and removed
      // an item at index 1, we stay at index 1 which now points to C.
      expect(navHistory.historyIndex).toBe(1);
      expect(navHistory.currentNoteId).toBe(noteC.id);
    });

    it('should handle deleting all occurrences of a note that appears multiple times', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');

      // Navigate A -> B -> A -> B (visiting same notes multiple times)
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);

      expect(navHistory.historyStack).toEqual([noteA.id, noteB.id, noteA.id, noteB.id]);

      // Delete A
      await vault.delete(noteA.id);
      navHistory.removeFromHistory(noteA.id);

      // All occurrences of A should be removed
      expect(navHistory.historyStack).not.toContain(noteA.id);
      expect(navHistory.historyStack).toEqual([noteB.id, noteB.id]);
    });
  });

  /**
   * redesign-18: Keyboard shortcuts (Cmd+[ back, Cmd+] forward)
   *
   * Per spec:
   * - Navigate A->B->C
   * - Press Cmd+[ to go back (existing)
   * - Verify now on B
   * - Press Cmd+] to go forward (new)
   * - Verify now on C
   *
   * Note: Keyboard handling is tested at unit level in useNavigationHistory.test.ts
   * This test verifies the underlying navigation functions work correctly
   */
  describe('Flow 18: Keyboard shortcuts for navigation', () => {
    it('should support Cmd+[ (back) navigation via navigateBack', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      expect(navHistory.currentNoteId).toBe(noteC.id);

      // Simulate Cmd+[ (calls navigateBack)
      navHistory.navigateBack();

      // Verify now on B
      expect(navHistory.currentNoteId).toBe(noteB.id);
    });

    it('should support Cmd+] (forward) navigation via navigateForward', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C, then back to B
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);
      navHistory.navigateBack();

      expect(navHistory.currentNoteId).toBe(noteB.id);

      // Simulate Cmd+] (calls navigateForward)
      navHistory.navigateForward();

      // Verify now on C
      expect(navHistory.currentNoteId).toBe(noteC.id);
    });

    it('should do nothing when Cmd+[ is pressed at beginning of history', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');

      navHistory.navigateToNote(noteA.id);
      expect(navHistory.canGoBack).toBe(false);

      // Simulate Cmd+[ at start of history
      navHistory.navigateBack();

      // Should still be on A
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should do nothing when Cmd+] is pressed at end of history', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');

      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      expect(navHistory.canGoForward).toBe(false);

      // Simulate Cmd+] at end of history
      navHistory.navigateForward();

      // Should still be on B
      expect(navHistory.currentNoteId).toBe(noteB.id);
    });

    it('should support full keyboard navigation cycle', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');
      const noteC = await createAndIndexNote(ctx, 'Note Gamma');

      // Navigate A -> B -> C
      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);
      navHistory.navigateToNote(noteC.id);

      // Cmd+[ to go back
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteB.id);

      // Cmd+[ again to A
      navHistory.navigateBack();
      expect(navHistory.currentNoteId).toBe(noteA.id);

      // Cmd+] to go forward to B
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteB.id);

      // Cmd+] again to C
      navHistory.navigateForward();
      expect(navHistory.currentNoteId).toBe(noteC.id);

      // Cmd+] should do nothing (at end)
      expect(navHistory.canGoForward).toBe(false);
    });
  });

  /**
   * Additional edge case tests
   */
  describe('Edge cases', () => {
    it('should handle empty history gracefully', () => {
      expect(navHistory.canGoBack).toBe(false);
      expect(navHistory.canGoForward).toBe(false);
      expect(navHistory.currentNoteId).toBeNull();

      // Navigation functions should not throw
      navHistory.navigateBack();
      navHistory.navigateForward();

      expect(navHistory.currentNoteId).toBeNull();
    });

    it('should handle single note in history', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');

      navHistory.navigateToNote(noteA.id);

      expect(navHistory.canGoBack).toBe(false);
      expect(navHistory.canGoForward).toBe(false);
      expect(navHistory.currentNoteId).toBe(noteA.id);
    });

    it('should prevent duplicate consecutive entries', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');

      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteA.id); // Same note again
      navHistory.navigateToNote(noteA.id); // And again

      expect(navHistory.historyStack).toEqual([noteA.id]);
    });

    it('should handle clear history', async () => {
      const noteA = await createAndIndexNote(ctx, 'Note Alpha');
      const noteB = await createAndIndexNote(ctx, 'Note Beta');

      navHistory.navigateToNote(noteA.id);
      navHistory.navigateToNote(noteB.id);

      expect(navHistory.historyStack.length).toBe(2);

      navHistory.clearHistory();

      expect(navHistory.historyStack.length).toBe(0);
      expect(navHistory.canGoBack).toBe(false);
      expect(navHistory.canGoForward).toBe(false);
    });
  });
});
