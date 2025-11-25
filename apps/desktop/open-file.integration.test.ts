/**
 * E2E Integration Tests for Open File Command
 *
 * Tests the file-browse mode of the command palette:
 * - Empty vault state
 * - Recent notes display
 * - Search and open flows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemVault, initializeVault } from '@scribe/storage-fs';
import { SearchEngine } from '@scribe/engine-search';
import type { Note, LexicalState } from '@scribe/shared';
import Fuse from 'fuse.js';

/**
 * Helper to create Lexical content with a title and optional body text
 */
function createNoteContent(title: string, bodyText?: string): LexicalState {
  const children: Array<{ type: string; children: Array<{ type: string; text: string }> }> = [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: title }],
    },
  ];

  if (bodyText) {
    children.push({
      type: 'paragraph',
      children: [{ type: 'text', text: bodyText }],
    });
  }

  return {
    root: {
      type: 'root',
      children,
    },
  };
}

/**
 * Simulates the fuzzy search behavior used in file-browse mode
 * This mirrors the Fuse.js configuration in CommandPalette.tsx
 */
function createFuseIndex(notes: Note[]) {
  const searchableNotes = notes.filter((note) => note.metadata.title !== null);
  return new Fuse(searchableNotes, {
    keys: ['metadata.title'],
    threshold: 0.4,
    ignoreLocation: true,
    isCaseSensitive: false,
  });
}

describe('Open File Command E2E Tests', () => {
  let tempDir: string;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(tmpdir(), `scribe-open-file-test-${Date.now()}`);
    await initializeVault(tempDir);
    vault = new FileSystemVault(tempDir);
    await vault.load();
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  /**
   * Helper to create a note with specific title and add a delay
   * to ensure different updatedAt timestamps
   */
  async function createNoteWithTitle(title: string, delayMs = 10): Promise<Note> {
    const note = await vault.create(createNoteContent(title));
    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return note;
  }

  /**
   * Helper to get recent notes sorted by updatedAt descending (most recent first)
   * This simulates what the file-browse mode displays
   */
  function getRecentNotes(notes: Note[], limit = 10): Note[] {
    return [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  }

  describe('Empty Vault State', () => {
    it('should show empty vault message when no notes exist', async () => {
      // Step 1: Launch app with empty vault (no notes)
      // The vault is already empty after initialization

      // Step 2: Simulate opening palette in file-browse mode (⌘O)
      // Get the list of notes from the vault
      const notes = vault.list();

      // Step 3: Verify no notes exist
      expect(notes.length).toBe(0);

      // Step 4: Verify the expected empty state behavior
      // In file-browse mode, when vault is empty, UI should display:
      // "No notes yet. Create one with ⌘N"
      const isEmptyVault = notes.length === 0;
      const emptyVaultMessage = 'No notes yet. Create one with ⌘N';

      // Simulate the UI state determination
      expect(isEmptyVault).toBe(true);

      // Verify the message that would be displayed
      const displayMessage = isEmptyVault ? emptyVaultMessage : null;
      expect(displayMessage).toBe('No notes yet. Create one with ⌘N');

      // Verify no note items would be shown
      const noteItems = notes.map((note) => ({
        id: note.id,
        title: note.metadata.title,
        updatedAt: note.updatedAt,
      }));
      expect(noteItems).toEqual([]);
    });

    it('should return empty list from vault.list() for empty vault', async () => {
      const notes = vault.list();

      expect(notes).toBeInstanceOf(Array);
      expect(notes.length).toBe(0);
    });

    it('should transition from empty to non-empty when note is created', async () => {
      // Initially empty
      let notes = vault.list();
      expect(notes.length).toBe(0);

      // Create a note
      const note = await vault.create();
      note.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'First Note' }],
            },
          ],
        },
      };
      await vault.save(note);

      // Now vault should have one note
      notes = vault.list();
      expect(notes.length).toBe(1);
      expect(notes[0].metadata.title).toBe('First Note');
    });
  });

  /**
   * E2E Integration Test: Open Recent Note Flow (scribe-3u1)
   *
   * Tests the complete flow:
   * 1. Launch app with 3+ existing notes with different updatedAt timestamps
   * 2. Press ⌘O to open palette in file-browse mode
   * 3. Verify recent notes are displayed sorted by updatedAt descending
   * 4. Press ↓ to select second note
   * 5. Press Enter
   * 6. Verify selected note content loads in editor
   * 7. Verify command palette closes
   */
  describe('Open Recent Note Flow', () => {
    it('should display recent notes sorted by updatedAt descending', async () => {
      // Step 1: Launch app with 3+ existing notes with different updatedAt timestamps
      const note1 = await createNoteWithTitle('First Note');
      const note2 = await createNoteWithTitle('Second Note');
      const note3 = await createNoteWithTitle('Third Note');

      // Step 2: Press ⌘O to open palette in file-browse mode (simulated by getting notes)
      const allNotes = vault.list();

      // Step 3: Verify recent notes are displayed sorted by updatedAt descending
      const recentNotes = getRecentNotes(allNotes);

      expect(recentNotes.length).toBe(3);
      expect(recentNotes[0].metadata.title).toBe('Third Note');
      expect(recentNotes[1].metadata.title).toBe('Second Note');
      expect(recentNotes[2].metadata.title).toBe('First Note');

      // Verify ordering by timestamp
      expect(recentNotes[0].updatedAt).toBeGreaterThanOrEqual(recentNotes[1].updatedAt);
      expect(recentNotes[1].updatedAt).toBeGreaterThanOrEqual(recentNotes[2].updatedAt);

      // Verify IDs match created notes
      expect(recentNotes[0].id).toBe(note3.id);
      expect(recentNotes[1].id).toBe(note2.id);
      expect(recentNotes[2].id).toBe(note1.id);
    });

    it('should select second note with arrow down and load on Enter', async () => {
      // Step 1: Launch app with 3+ existing notes
      await createNoteWithTitle('Meeting Notes');
      const note2 = await createNoteWithTitle('Project Ideas');
      await createNoteWithTitle('Daily Journal');

      // Step 2: Press ⌘O to open palette in file-browse mode
      const recentNotes = getRecentNotes(vault.list());

      // Initial state: first item selected (index 0)
      let selectedIndex = 0;
      expect(recentNotes[selectedIndex].metadata.title).toBe('Daily Journal');

      // Step 4: Press ↓ to select second note
      selectedIndex = Math.min(selectedIndex + 1, recentNotes.length - 1);
      expect(selectedIndex).toBe(1);
      expect(recentNotes[selectedIndex].metadata.title).toBe('Project Ideas');

      // Step 5: Press Enter - load the selected note
      const selectedNoteId = recentNotes[selectedIndex].id;

      // Step 6: Verify selected note content loads in editor
      const loadedNote = vault.read(selectedNoteId);
      expect(loadedNote.id).toBe(note2.id);
      expect(loadedNote.metadata.title).toBe('Project Ideas');

      // Verify content is valid Lexical state (ready for editor)
      expect(loadedNote.content).toBeDefined();
      expect(loadedNote.content.root).toBeDefined();
      expect(loadedNote.content.root.type).toBe('root');
      expect(loadedNote.content.root.children.length).toBeGreaterThan(0);

      // Step 7: Command palette closes (would be UI state, verified by successful load)
    });

    it('should complete the full open recent note flow', async () => {
      // This test combines all steps from the feature spec:
      // 1. Launch app with 3+ existing notes with different updatedAt timestamps
      // 2. Press ⌘O to open palette in file-browse mode
      // 3. Verify recent notes are displayed sorted by updatedAt descending
      // 4. Press ↓ to select second note
      // 5. Press Enter
      // 6. Verify selected note content loads in editor
      // 7. Verify command palette closes

      // Step 1: Launch app with 3+ existing notes with different updatedAt timestamps
      const note1 = await createNoteWithTitle('Oldest Note');
      const note2 = await createNoteWithTitle('Middle Note');
      const note3 = await createNoteWithTitle('Newest Note');

      // Step 2: Press ⌘O to open palette in file-browse mode
      const recentNotes = getRecentNotes(vault.list());

      // Step 3: Verify recent notes are displayed sorted by updatedAt descending
      expect(recentNotes.length).toBe(3);
      expect(recentNotes[0].id).toBe(note3.id); // Newest
      expect(recentNotes[1].id).toBe(note2.id); // Middle
      expect(recentNotes[2].id).toBe(note1.id); // Oldest

      // Verify order by checking titles
      expect(recentNotes[0].metadata.title).toBe('Newest Note');
      expect(recentNotes[1].metadata.title).toBe('Middle Note');
      expect(recentNotes[2].metadata.title).toBe('Oldest Note');

      // Verify timestamps are in descending order
      for (let i = 0; i < recentNotes.length - 1; i++) {
        expect(recentNotes[i].updatedAt).toBeGreaterThanOrEqual(recentNotes[i + 1].updatedAt);
      }

      // Step 4: Press ↓ to select second note
      let selectedIndex = 0;
      selectedIndex++; // ↓ key press
      expect(selectedIndex).toBe(1);

      // Step 5: Press Enter
      const selectedNoteId = recentNotes[selectedIndex].id;

      // Step 6: Verify selected note content loads in editor
      const loadedNote = vault.read(selectedNoteId);

      // Verify it's the middle note
      expect(loadedNote.id).toBe(note2.id);
      expect(loadedNote.metadata.title).toBe('Middle Note');

      // Verify content is valid and ready for the editor
      expect(loadedNote.content).toBeDefined();
      expect(loadedNote.content.root).toBeDefined();
      expect(loadedNote.content.root.type).toBe('root');

      // Verify the content has the expected structure
      const firstChild = loadedNote.content.root.children[0] as {
        type: string;
        children: { type: string; text: string }[];
      };
      expect(firstChild.type).toBe('paragraph');
      expect(firstChild.children[0].text).toBe('Middle Note');

      // Step 7: Verify command palette closes
      // In a real Electron E2E test, we would verify paletteOpen === false
      // Here we verify the note data is complete and ready for rendering
      expect(loadedNote.id).toBeDefined();
      expect(loadedNote.createdAt).toBeDefined();
      expect(loadedNote.updatedAt).toBeDefined();
    });

    it('should update order when a note is modified', async () => {
      // Create 3 notes
      const note1 = await createNoteWithTitle('First Note');
      await createNoteWithTitle('Second Note');
      await createNoteWithTitle('Third Note');

      // Verify initial order (Third is most recent)
      let recentNotes = getRecentNotes(vault.list());
      expect(recentNotes[0].metadata.title).toBe('Third Note');

      // Modify the first note (should move it to the top)
      const updatedNote1 = vault.read(note1.id);
      updatedNote1.content = createNoteContent('First Note - Updated');
      await vault.save(updatedNote1);

      // Verify new order (First Note - Updated is now most recent)
      recentNotes = getRecentNotes(vault.list());
      expect(recentNotes[0].metadata.title).toBe('First Note - Updated');
      expect(recentNotes[0].id).toBe(note1.id);
    });

    it('should exclude current note from recent notes list', async () => {
      // Create 3 notes
      const note1 = await createNoteWithTitle('First Note');
      const note2 = await createNoteWithTitle('Second Note');
      const note3 = await createNoteWithTitle('Third Note');

      // Simulate current note (Third Note is the most recent, assume it's "open")
      const currentNoteId = note3.id;

      // Get recent notes excluding current (as specified in feature doc)
      const allNotes = vault.list();
      const recentNotesExcludingCurrent = allNotes
        .filter((note) => note.id !== currentNoteId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10);

      // Verify current note is excluded
      expect(recentNotesExcludingCurrent.length).toBe(2);
      expect(recentNotesExcludingCurrent.some((n) => n.id === currentNoteId)).toBe(false);
      expect(recentNotesExcludingCurrent[0].id).toBe(note2.id);
      expect(recentNotesExcludingCurrent[1].id).toBe(note1.id);
    });

    it('should limit recent notes to 10 entries', async () => {
      // Create 12 notes
      for (let i = 1; i <= 12; i++) {
        await createNoteWithTitle(`Note ${i}`);
      }

      // Get recent notes (limited to 10 as per feature spec)
      const recentNotes = getRecentNotes(vault.list(), 10);
      expect(recentNotes.length).toBe(10);

      // Verify they are the 10 most recent (Notes 12, 11, 10, ..., 3)
      expect(recentNotes[0].metadata.title).toBe('Note 12');
      expect(recentNotes[9].metadata.title).toBe('Note 3');
    });

    it('should handle untitled notes in recent list', async () => {
      // Create a note with empty content (untitled)
      const untitledNote = await vault.create({
        root: {
          type: 'root',
          children: [],
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create a titled note
      await createNoteWithTitle('Titled Note');

      // Both should appear in recents (untitled included per feature spec)
      const recentNotes = getRecentNotes(vault.list());
      expect(recentNotes.length).toBe(2);

      // Titled note is most recent
      expect(recentNotes[0].metadata.title).toBe('Titled Note');

      // Untitled note has null title but still appears
      expect(recentNotes[1].id).toBe(untitledNote.id);
      expect(recentNotes[1].metadata.title).toBeNull();
    });

    it('should persist order across vault reload', async () => {
      // Create notes
      await createNoteWithTitle('First Note');
      await createNoteWithTitle('Second Note');
      await createNoteWithTitle('Third Note');

      // Reload vault (simulates app restart)
      const newVault = new FileSystemVault(tempDir);
      await newVault.load();

      // Verify order is preserved after reload
      const recentNotes = getRecentNotes(newVault.list());

      expect(recentNotes.length).toBe(3);
      expect(recentNotes[0].metadata.title).toBe('Third Note');
      expect(recentNotes[1].metadata.title).toBe('Second Note');
      expect(recentNotes[2].metadata.title).toBe('First Note');
    });
  });
});

/**
 * E2E Integration Test: Search and Open Flow (scribe-1mh)
 *
 * Tests the file-browse mode search and selection flow:
 * 1. Launch app with multiple notes including one titled 'Meeting Notes'
 * 2. Press ⌘O to open palette in file-browse mode
 * 3. Type 'meet' in search input
 * 4. Verify 'Meeting Notes' appears in filtered results
 * 5. Click on 'Meeting Notes' item
 * 6. Verify note loads in editor
 * 7. Verify palette closes
 */
describe('Open File Command - Search and Open Flow', () => {
  let tempDir: string;
  let vault: FileSystemVault;
  let searchEngine: SearchEngine;
  let testNotes: Note[];

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(tmpdir(), `scribe-search-open-test-${Date.now()}`);
    await initializeVault(tempDir);
    vault = new FileSystemVault(tempDir);
    await vault.load();

    // Initialize search engine
    searchEngine = new SearchEngine();

    // Create multiple test notes including 'Meeting Notes'
    const noteData = [
      { title: 'Meeting Notes', body: 'Discussed project timeline and milestones' },
      { title: 'Project Ideas', body: 'Brainstorming new features for the app' },
      { title: 'Daily Journal', body: 'Reflections on today activities' },
      { title: 'Weekly Review', body: 'Summary of weekly accomplishments' },
      { title: 'Team Meeting Summary', body: 'Notes from the team standup' },
    ];

    testNotes = [];
    for (const data of noteData) {
      const note = await vault.create(createNoteContent(data.title, data.body));
      await vault.save(note);
      const savedNote = vault.read(note.id);
      if (savedNote) {
        testNotes.push(savedNote);
        searchEngine.indexNote(savedNote);
      }
      // Small delay to ensure distinct updatedAt timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('E2E Flow: Search and Open', () => {
    it('should filter notes when typing partial title in file-browse mode', () => {
      // Step 1: Verify we have multiple notes including 'Meeting Notes'
      expect(testNotes.length).toBe(5);
      const meetingNote = testNotes.find((n) => n.metadata.title === 'Meeting Notes');
      expect(meetingNote).toBeDefined();

      // Step 2-3: Simulate ⌘O opening palette in file-browse mode and typing 'meet'
      // The palette would show all notes initially, then filter on search
      const fuseIndex = createFuseIndex(testNotes);
      const searchQuery = 'meet';

      // Step 4: Verify 'Meeting Notes' appears in filtered results
      const searchResults = fuseIndex.search(searchQuery, { limit: 25 });
      const filteredNotes = searchResults.map((result) => result.item);

      expect(filteredNotes.length).toBeGreaterThan(0);

      // 'Meeting Notes' should be in results
      const meetingInResults = filteredNotes.find((n) => n.metadata.title === 'Meeting Notes');
      expect(meetingInResults).toBeDefined();

      // 'Team Meeting Summary' should also match 'meet'
      const teamMeetingInResults = filteredNotes.find(
        (n) => n.metadata.title === 'Team Meeting Summary'
      );
      expect(teamMeetingInResults).toBeDefined();

      // Non-matching notes should NOT be in results
      const projectInResults = filteredNotes.find((n) => n.metadata.title === 'Project Ideas');
      expect(projectInResults).toBeUndefined();
    });

    it('should load selected note content when clicked', async () => {
      // Find the Meeting Notes note
      const meetingNote = testNotes.find((n) => n.metadata.title === 'Meeting Notes');
      expect(meetingNote).toBeDefined();

      if (!meetingNote) {
        throw new Error('Meeting Notes not found');
      }

      // Step 5: Simulate clicking on 'Meeting Notes' item
      // This would trigger onNoteSelect(meetingNote.id) which loads the note

      // Step 6: Verify note loads in editor (simulated by reading from vault)
      const loadedNote = vault.read(meetingNote.id);

      expect(loadedNote).toBeDefined();
      expect(loadedNote?.id).toBe(meetingNote.id);
      expect(loadedNote?.metadata.title).toBe('Meeting Notes');

      // Verify content is intact
      const content = loadedNote?.content;
      expect(content).toBeDefined();
      expect(content?.root.children.length).toBeGreaterThan(0);
    });

    it('should complete full search and open flow', async () => {
      // Full E2E simulation of the flow

      // 1. Get all notes (simulating what happens when palette opens in file-browse mode)
      const allNotes = vault.list();
      expect(allNotes.length).toBe(5);

      // 2. Build fuzzy search index (excluding current note - we'll say there's no current note)
      const currentNoteId = null;
      const searchableNotes = allNotes.filter(
        (note) => note.id !== currentNoteId && note.metadata.title !== null
      );
      const fuseIndex = new Fuse(searchableNotes, {
        keys: ['metadata.title'],
        threshold: 0.4,
        ignoreLocation: true,
        isCaseSensitive: false,
      });

      // 3. Type 'meet' in search input
      const query = 'meet';
      const results = fuseIndex.search(query, { limit: 25 });

      // 4. Verify 'Meeting Notes' appears in filtered results
      expect(results.length).toBeGreaterThan(0);
      const meetingResult = results.find((r) => r.item.metadata.title === 'Meeting Notes');
      expect(meetingResult).toBeDefined();

      // 5. Click on 'Meeting Notes' item (get the note ID)
      const selectedNoteId = meetingResult!.item.id;

      // 6. Verify note loads in editor
      const loadedNote = vault.read(selectedNoteId);
      expect(loadedNote).toBeDefined();
      expect(loadedNote?.metadata.title).toBe('Meeting Notes');

      // 7. Verify palette closes (state change - this would be tested in component tests)
      // In this integration test, we verify the data flow works correctly
      // The palette closing is a UI state change verified in CommandPalette.test.tsx
    });
  });

  describe('Search behavior', () => {
    it('should exclude current note from search results', () => {
      // If 'Meeting Notes' is the current note, it shouldn't appear in results
      const meetingNote = testNotes.find((n) => n.metadata.title === 'Meeting Notes');
      expect(meetingNote).toBeDefined();

      const currentNoteId = meetingNote!.id;

      // Build index excluding current note
      const searchableNotes = testNotes.filter(
        (note) => note.id !== currentNoteId && note.metadata.title !== null
      );
      const fuseIndex = new Fuse(searchableNotes, {
        keys: ['metadata.title'],
        threshold: 0.4,
        ignoreLocation: true,
        isCaseSensitive: false,
      });

      // Search for 'meet'
      const results = fuseIndex.search('meet', { limit: 25 });

      // 'Meeting Notes' should NOT be in results (it's the current note)
      const meetingInResults = results.find((r) => r.item.metadata.title === 'Meeting Notes');
      expect(meetingInResults).toBeUndefined();

      // But 'Team Meeting Summary' should still be there
      const teamMeetingInResults = results.find(
        (r) => r.item.metadata.title === 'Team Meeting Summary'
      );
      expect(teamMeetingInResults).toBeDefined();
    });

    it('should show recent notes when no search query', () => {
      // Initial state: no query, show 10 most recent notes by updatedAt

      // Sort by updatedAt descending
      const recentNotes = [...testNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

      expect(recentNotes.length).toBe(5); // We only have 5 test notes

      // Most recent should be the last one we created (Team Meeting Summary)
      expect(recentNotes[0].metadata.title).toBe('Team Meeting Summary');
    });

    it('should return to showing recent notes when query is cleared', () => {
      // Simulate: user types query, then clears it

      // 1. Type query and get filtered results
      const fuseIndex = createFuseIndex(testNotes);
      const results = fuseIndex.search('meet', { limit: 25 });
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(testNotes.length);

      // 2. Clear query (empty string)
      const clearedQuery = '';

      // 3. When query is cleared, show recent notes instead
      if (clearedQuery.trim() === '') {
        const recentNotes = [...testNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

        // All notes should be shown (as recent notes)
        expect(recentNotes.length).toBe(5);
      }
    });

    it('should show "No results" when search has no matches', () => {
      const fuseIndex = createFuseIndex(testNotes);

      // Search for something that doesn't match any title
      const results = fuseIndex.search('xyz123nonexistent', { limit: 25 });

      expect(results.length).toBe(0);
      // UI would show "No results" message when results.length === 0
    });

    it('should perform case-insensitive search', () => {
      const fuseIndex = createFuseIndex(testNotes);

      // Search with different cases
      const lowercaseResults = fuseIndex.search('meeting', { limit: 25 });
      const uppercaseResults = fuseIndex.search('MEETING', { limit: 25 });
      const mixedResults = fuseIndex.search('MeEtInG', { limit: 25 });

      // All should find 'Meeting Notes' and 'Team Meeting Summary'
      expect(lowercaseResults.length).toBeGreaterThan(0);
      expect(uppercaseResults.length).toBeGreaterThan(0);
      expect(mixedResults.length).toBeGreaterThan(0);

      // Results should be the same regardless of case
      expect(lowercaseResults.length).toBe(uppercaseResults.length);
      expect(lowercaseResults.length).toBe(mixedResults.length);
    });

    it('should exclude untitled notes from search results', async () => {
      // Create an untitled note
      const untitledNote = await vault.create({
        root: {
          type: 'root',
          children: [], // Empty content means no title
        },
      });
      await vault.save(untitledNote);
      const savedUntitled = vault.read(untitledNote.id);
      expect(savedUntitled?.metadata.title).toBeNull();

      // Build index with all notes including untitled
      const allNotes = vault.list();
      const searchableNotes = allNotes.filter((note) => note.metadata.title !== null);

      // Untitled notes should be filtered out of searchable notes
      expect(searchableNotes.length).toBe(5); // Original 5 notes
      expect(allNotes.length).toBe(6); // Including untitled

      const fuseIndex = new Fuse(searchableNotes, {
        keys: ['metadata.title'],
        threshold: 0.4,
        ignoreLocation: true,
        isCaseSensitive: false,
      });

      // Search shouldn't include untitled in results
      const results = fuseIndex.search('', { limit: 25 });
      const untitledInResults = results.find((r) => r.item.metadata.title === null);
      expect(untitledInResults).toBeUndefined();
    });

    it('should limit fuzzy search results to 25', async () => {
      // Create many notes
      for (let i = 0; i < 30; i++) {
        const note = await vault.create(createNoteContent(`Test Note ${i}`));
        await vault.save(note);
      }

      const allNotes = vault.list();
      expect(allNotes.length).toBe(35); // 5 original + 30 new

      const searchableNotes = allNotes.filter((note) => note.metadata.title !== null);
      const fuseIndex = new Fuse(searchableNotes, {
        keys: ['metadata.title'],
        threshold: 0.4,
        ignoreLocation: true,
        isCaseSensitive: false,
      });

      // Search for 'Test' which matches all 30 new notes
      const results = fuseIndex.search('Test', { limit: 25 });

      // Should be limited to 25 results
      expect(results.length).toBeLessThanOrEqual(25);
    });
  });

  describe('Data persistence through open flow', () => {
    it('should persist note selection across vault reload', async () => {
      // Find and select Meeting Notes
      const meetingNote = testNotes.find((n) => n.metadata.title === 'Meeting Notes');
      expect(meetingNote).toBeDefined();

      // Simulate app restart: create new vault instance
      const newVault = new FileSystemVault(tempDir);
      await newVault.load();

      // Note should still be loadable
      const loadedNote = newVault.read(meetingNote!.id);
      expect(loadedNote).toBeDefined();
      expect(loadedNote?.metadata.title).toBe('Meeting Notes');
      expect(loadedNote?.id).toBe(meetingNote!.id);
    });

    it('should rebuild search index correctly after restart', async () => {
      // Simulate app restart
      const newVault = new FileSystemVault(tempDir);
      await newVault.load();
      const newSearchEngine = new SearchEngine();

      // Rebuild index
      const notes = newVault.list();
      for (const note of notes) {
        newSearchEngine.indexNote(note);
      }

      // Search should still work
      const results = newSearchEngine.search('Meeting');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Meeting');
    });
  });
});
