/**
 * CommandPalette - File Browse Mode Tests
 *
 * Tests for file-browse mode functionality:
 * - Initial state behavior (recent notes, loading, empty vault)
 * - Search behavior (fuzzy search, filtering, debounce)
 * - Click behavior (note selection, overlay clicks)
 * - UI rendering (truncation, dates, placeholders)
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import type { Note } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import {
  createMockNote,
  mockCommands,
  setupScribeMock,
  waitForDebounce,
  BASE_TIME,
  CSS,
  styles,
  setupNotesWithRecentOpens,
} from './CommandPalette.test-utils';

describe('CommandPalette - File Browse Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupScribeMock();
  });

  describe('Initial state (no query)', () => {
    it('shows 10 most recent notes sorted by updatedAt desc', async () => {
      // Create 15 notes with different updatedAt timestamps
      const mockNotes: Note[] = [];
      for (let i = 1; i <= 15; i++) {
        mockNotes.push(
          createMockNote({
            id: `note-${i}`,
            // More recent notes have higher timestamps
            updatedAt: BASE_TIME + i * 1000,
            metadata: { title: `Note ${i}`, tags: [], links: [], mentions: [] },
          })
        );
      }

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show only 10 most recent notes (notes 15 down to 6)
      // Note 15 is the most recent
      for (let i = 15; i >= 6; i--) {
        expect(screen.getByText(`Note ${i}`)).toBeInTheDocument();
      }

      // Notes 1-5 should NOT be visible (they're older)
      for (let i = 1; i <= 5; i++) {
        expect(screen.queryByText(`Note ${i}`)).not.toBeInTheDocument();
      }
    });

    it('excludes current note from list', async () => {
      const currentNoteIdStr = 'current-note';

      const mockNotes: Note[] = [
        createMockNote({
          id: currentNoteIdStr,
          updatedAt: BASE_TIME + 5000, // Most recent
          metadata: { title: 'Current Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'other-note-1',
          updatedAt: BASE_TIME + 4000,
          metadata: { title: 'Other Note 1', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'other-note-2',
          updatedAt: BASE_TIME + 3000,
          metadata: { title: 'Other Note 2', tags: [], links: [], mentions: [] },
        }),
      ];

      // Include all notes in recent opens (filtering of current note happens in component)
      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          currentNoteId={createNoteId(currentNoteIdStr)}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Current note should NOT be in the list
      expect(screen.queryByText('Current Note')).not.toBeInTheDocument();

      // Other notes should be visible
      expect(screen.getByText('Other Note 1')).toBeInTheDocument();
      expect(screen.getByText('Other Note 2')).toBeInTheDocument();
    });

    it("shows 'Loading...' while fetching notes", async () => {
      // Create promises we can control to simulate loading
      let resolveNotes: (notes: Note[]) => void;
      let resolveRecents: (
        records: { entityId: string; entityType: string; openedAt: number }[]
      ) => void;
      const notesPromise = new Promise<Note[]>((resolve) => {
        resolveNotes = resolve;
      });
      const recentsPromise = new Promise<
        { entityId: string; entityType: string; openedAt: number }[]
      >((resolve) => {
        resolveRecents = resolve;
      });

      (window as any).scribe.notes.list = vi.fn().mockReturnValue(notesPromise);
      (window as any).scribe.recentOpens.getRecent = vi.fn().mockReturnValue(recentsPromise);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Should show loading state immediately
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Resolve both promises
      const testNote = createMockNote({
        id: 'note-1',
        metadata: { title: 'Test Note', tags: [], links: [], mentions: [] },
      });
      resolveNotes!([testNote]);
      resolveRecents!([{ entityId: testNote.id, entityType: 'note', openedAt: Date.now() }]);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Note should now be visible
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });

    it("shows 'No notes yet. Create one with ⌘N' for empty vault", async () => {
      // Return empty array for notes
      setupNotesWithRecentOpens([]);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show empty vault message
      // Note: The component uses &#8984; for the ⌘ symbol which renders as the actual character
      expect(screen.getByText('No notes yet. Create one with ⌘N')).toBeInTheDocument();
    });

    it('untitled notes appear in recents list', async () => {
      const mockNotes: Note[] = [
        createMockNote({
          id: 'titled-note',
          updatedAt: BASE_TIME + 2000,
          metadata: { title: 'Titled Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'untitled-note',
          updatedAt: BASE_TIME + 3000, // More recent
          metadata: { title: null, tags: [], links: [], mentions: [] }, // Untitled
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Both notes should be visible in recents
      expect(screen.getByText('Titled Note')).toBeInTheDocument();
      // Untitled notes are displayed as "Untitled" via truncateTitle function
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('Search behavior', () => {
    // Sample notes for search tests
    const createSearchTestNotes = (): Note[] => {
      const now = Date.now();
      return [
        createMockNote({
          id: 'note-1',
          updatedAt: now - 1000,
          metadata: { title: 'Meeting Notes', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-2',
          updatedAt: now - 2000,
          metadata: { title: 'Project Ideas', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-3',
          updatedAt: now - 3000,
          metadata: { title: 'Shopping List', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-4',
          updatedAt: now - 4000,
          metadata: { title: 'Travel Plans', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-5',
          updatedAt: now - 5000,
          metadata: { title: 'Recipe Collection', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-6',
          updatedAt: now - 6000,
          metadata: { title: 'MEETING AGENDA', tags: [], links: [], mentions: [] }, // For case-insensitive test
        }),
        createMockNote({
          id: 'note-7',
          updatedAt: now - 7000,
          metadata: { title: null, tags: [], links: [], mentions: [] }, // Untitled note
        }),
      ];
    };

    it('typing filters results via fuzzy search', async () => {
      setupNotesWithRecentOpens(createSearchTestNotes());

      const onNoteSelect = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          onNoteSelect={onNoteSelect}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Type search query
      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'meet' } });

      // Wait for debounce
      await waitForDebounce();

      // Should show matching notes (Meeting Notes and MEETING AGENDA)
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
        expect(screen.getByText('MEETING AGENDA')).toBeInTheDocument();
      });

      // Should NOT show non-matching notes
      expect(screen.queryByText('Shopping List')).not.toBeInTheDocument();
      expect(screen.queryByText('Travel Plans')).not.toBeInTheDocument();
    });

    it('search is case-insensitive', async () => {
      setupNotesWithRecentOpens(createSearchTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');

      // Test lowercase query matching uppercase title
      fireEvent.change(input, { target: { value: 'agenda' } });

      await waitForDebounce();

      await waitFor(() => {
        expect(screen.getByText('MEETING AGENDA')).toBeInTheDocument();
      });
    });

    it('search is case-insensitive with uppercase query', async () => {
      setupNotesWithRecentOpens(createSearchTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');

      // Test uppercase query matching lowercase title
      fireEvent.change(input, { target: { value: 'SHOPPING' } });

      await waitForDebounce();

      await waitFor(() => {
        expect(screen.getByText('Shopping List')).toBeInTheDocument();
      });
    });

    it('limits search results to max 25', async () => {
      // Create 30 notes that all match "Test"
      const manyNotes = Array.from({ length: 30 }, (_, i) =>
        createMockNote({
          id: `note-${i}`,
          updatedAt: Date.now() - i * 1000,
          metadata: { title: `Test Note ${i + 1}`, tags: [], links: [], mentions: [] },
        })
      );

      setupNotesWithRecentOpens(manyNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'Test' } });

      await waitForDebounce();

      await waitFor(() => {
        // Count the note items displayed
        const noteItems = document.querySelectorAll(CSS.paletteItem);
        expect(noteItems.length).toBeLessThanOrEqual(25);
      });
    });

    it("shows 'Create new note' option when query matches nothing", async () => {
      setupNotesWithRecentOpens(createSearchTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'xyz123nonexistent' } });

      await waitForDebounce();

      // Should show "Create" option instead of "No results"
      await waitFor(() => {
        expect(screen.getByText('Create "xyz123nonexistent"')).toBeInTheDocument();
      });
    });

    it('clearing query returns to recent notes view', async () => {
      setupNotesWithRecentOpens(createSearchTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Initial state: should show recent notes
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();

      const input = screen.getByPlaceholderText('Search notes...');

      // Type a search query
      fireEvent.change(input, { target: { value: 'travel' } });

      await waitForDebounce();

      await waitFor(() => {
        expect(screen.getByText('Travel Plans')).toBeInTheDocument();
        // Other recent notes should be filtered out
        expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
      });

      // Clear the query
      fireEvent.change(input, { target: { value: '' } });

      await waitForDebounce();

      // Should return to showing recent notes
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
        expect(screen.getByText('Project Ideas')).toBeInTheDocument();
      });
    });

    it('untitled notes are excluded from search results', async () => {
      const notesWithUntitled = [
        createMockNote({
          id: 'note-1',
          updatedAt: Date.now() - 1000,
          metadata: { title: 'Test Note One', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-2',
          updatedAt: Date.now() - 2000,
          metadata: { title: null, tags: [], links: [], mentions: [] }, // Untitled
        }),
        createMockNote({
          id: 'note-3',
          updatedAt: Date.now() - 3000,
          metadata: { title: 'Test Note Three', tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(notesWithUntitled);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');
      // Search for "Test" - only titled notes should match
      fireEvent.change(input, { target: { value: 'Test' } });

      await waitForDebounce();

      await waitFor(() => {
        // Should show titled notes matching the query
        expect(screen.getByText('Test Note One')).toBeInTheDocument();
        expect(screen.getByText('Test Note Three')).toBeInTheDocument();
      });

      // Untitled note should not appear in search results
      const items = document.querySelectorAll(CSS.paletteItem);
      expect(items.length).toBe(2);
    });

    it('current note is excluded from search results', async () => {
      const testNotes = [
        createMockNote({
          id: 'current-note',
          updatedAt: Date.now(),
          metadata: { title: 'Current Document', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'other-note',
          updatedAt: Date.now() - 1000,
          metadata: { title: 'Other Document', tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(testNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          currentNoteId={createNoteId('current-note')}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(input, { target: { value: 'Document' } });

      await waitForDebounce();

      await waitFor(() => {
        // Should show other document
        expect(screen.getByText('Other Document')).toBeInTheDocument();
        // Should NOT show current note
        expect(screen.queryByText('Current Document')).not.toBeInTheDocument();
      });
    });

    it('search triggers after debounce (150ms)', async () => {
      vi.useFakeTimers();

      setupNotesWithRecentOpens(createSearchTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load with fake timers
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const input = screen.getByPlaceholderText('Search notes...');

      // Type query
      fireEvent.change(input, { target: { value: 'travel' } });

      // Immediately after typing (before debounce), recent notes should still be visible
      // Run only 50ms worth of timers
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      // Recent notes still showing because debounce hasn't fired
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();

      // Advance past debounce threshold (150ms total)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(110);
      });

      // Now search results should appear
      expect(screen.getByText('Travel Plans')).toBeInTheDocument();
      expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();

      vi.useRealTimers();
    });

    it('performs fuzzy matching via Fuse.js', async () => {
      setupNotesWithRecentOpens(createSearchTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Search notes...');

      // Type a fuzzy query with transposed/missing letters
      fireEvent.change(input, { target: { value: 'recpe' } }); // should match "Recipe"

      await waitForDebounce();

      await waitFor(() => {
        expect(screen.getByText('Recipe Collection')).toBeInTheDocument();
      });
    });
  });

  describe('Click behavior', () => {
    const createTestNotes = () => [
      createMockNote({
        id: 'note-3',
        updatedAt: BASE_TIME + 3000,
        metadata: { title: 'Note Three', tags: [], links: [], mentions: [] },
      }),
      createMockNote({
        id: 'note-2',
        updatedAt: BASE_TIME + 2000,
        metadata: { title: 'Note Two', tags: [], links: [], mentions: [] },
      }),
      createMockNote({
        id: 'note-1',
        updatedAt: BASE_TIME + 1000,
        metadata: { title: 'Note One', tags: [], links: [], mentions: [] },
      }),
    ];

    it('clicking note item opens note and closes palette', async () => {
      const mockNotes = createTestNotes();
      setupNotesWithRecentOpens(mockNotes);

      const onNoteSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={onNoteSelect}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Three')).toBeInTheDocument();
      });

      // Click on the second note item (Note Two)
      const noteItems = document.querySelectorAll(CSS.paletteItem);
      fireEvent.click(noteItems[1]);

      // onNoteSelect should be called with the clicked note's ID
      expect(onNoteSelect).toHaveBeenCalledWith('note-2');
      // onClose should be called
      expect(onClose).toHaveBeenCalled();
    });

    it('clicking outside palette (overlay) closes palette', async () => {
      const mockNotes = createTestNotes();
      setupNotesWithRecentOpens(mockNotes);

      const onNoteSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={onNoteSelect}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Three')).toBeInTheDocument();
      });

      // Click on the overlay (not the palette itself)
      const overlay = document.querySelector(CSS.overlayPositioning);
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);

      // onClose should be called
      expect(onClose).toHaveBeenCalled();
      // onNoteSelect should NOT be called
      expect(onNoteSelect).not.toHaveBeenCalled();
    });
  });

  describe('UI rendering', () => {
    it('truncates long titles (>50 chars) with ellipsis', async () => {
      const longTitle =
        'This is a very long note title that exceeds fifty characters and should be truncated';
      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-long',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: longTitle, tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // The title should be truncated to ~50 chars with ellipsis
      // "This is a very long note title that exceeds fifty" = 50 chars + "..."
      const truncatedTitle = longTitle.slice(0, 50).trimEnd() + '...';
      expect(screen.getByText(truncatedTitle)).toBeInTheDocument();

      // The full title should NOT be in the document
      expect(screen.queryByText(longTitle)).not.toBeInTheDocument();
    });

    it('displays short titles without truncation', async () => {
      const shortTitle = 'Short Title';
      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-short',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: shortTitle, tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Short title should appear without truncation
      expect(screen.getByText(shortTitle)).toBeInTheDocument();
    });

    it('displays date subtext with correct relative format for recent notes', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-just-now',
          updatedAt: now - 30 * 1000, // 30 seconds ago
          metadata: { title: 'Just Now Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-minutes',
          updatedAt: now - 5 * 60 * 1000, // 5 minutes ago
          metadata: { title: 'Minutes Ago Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-hours',
          updatedAt: now - 3 * 60 * 60 * 1000, // 3 hours ago
          metadata: { title: 'Hours Ago Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-days',
          updatedAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
          metadata: { title: 'Days Ago Note', tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load with fake timers
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Check relative date formats
      expect(screen.getByText('Just now')).toBeInTheDocument();
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
      expect(screen.getByText('3 hours ago')).toBeInTheDocument();
      expect(screen.getByText('2 days ago')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('displays date subtext with absolute format for notes >=7 days old', async () => {
      vi.useFakeTimers();
      // Set a fixed "now" date: Nov 24, 2025
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-old',
          updatedAt: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago = Nov 14, 2025
          metadata: { title: 'Old Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-very-old',
          updatedAt: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago = Oct 25, 2025
          metadata: { title: 'Very Old Note', tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load with fake timers
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Check absolute date formats
      expect(screen.getByText('Nov 14, 2025')).toBeInTheDocument();
      expect(screen.getByText('Oct 25, 2025')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it("displays 'Untitled' for notes with null title", async () => {
      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-untitled',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: null, tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Untitled should be displayed
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('back button is only visible in file-browse mode', async () => {
      const { rerender } = render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="command"
        />
      );

      // In command mode, back button should NOT be visible
      expect(screen.queryByLabelText('Back to commands')).not.toBeInTheDocument();

      // Switch to file-browse mode
      rerender(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // In file-browse mode, back button should be visible
      expect(screen.getByLabelText('Back to commands')).toBeInTheDocument();
    });

    it("placeholder text is 'Search notes...' in file-browse mode", async () => {
      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Should show file-browse mode placeholder
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it("placeholder text is 'Search notes or create new...' in command mode", async () => {
      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="command"
        />
      );

      // Should show command mode placeholder
      expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();
    });

    it('displays date subtext for boundary: exactly 7 days ago shows absolute date', async () => {
      vi.useFakeTimers();
      // Set a fixed "now" date: Nov 24, 2025
      const now = new Date('2025-11-24T12:00:00.000Z').getTime();
      vi.setSystemTime(now);

      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-7days',
          updatedAt: now - 7 * 24 * 60 * 60 * 1000, // Exactly 7 days ago = Nov 17, 2025
          metadata: { title: 'Seven Days Ago', tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load with fake timers
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 7 days boundary should show absolute date
      expect(screen.getByText('Nov 17, 2025')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('displays date subtext for boundary: 6 days ago shows relative date', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-6days',
          updatedAt: now - 6 * 24 * 60 * 60 * 1000, // 6 days ago
          metadata: { title: 'Six Days Ago', tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      // Wait for notes to load with fake timers
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // 6 days should still show relative date
      expect(screen.getByText('6 days ago')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Delete icon in file-browse mode', () => {
    const createTestNotes = () => [
      createMockNote({
        id: 'note-1',
        updatedAt: BASE_TIME + 3000,
        metadata: { title: 'Note One', tags: [], links: [], mentions: [] },
      }),
      createMockNote({
        id: 'note-2',
        updatedAt: BASE_TIME + 2000,
        metadata: { title: 'Note Two', tags: [], links: [], mentions: [] },
      }),
      createMockNote({
        id: 'note-3',
        updatedAt: BASE_TIME + 1000,
        metadata: { title: 'Note Three', tags: [], links: [], mentions: [] },
      }),
    ];

    it('delete icon is rendered on each note item', async () => {
      setupNotesWithRecentOpens(createTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Each note should have a delete button
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
      expect(deleteButtons).toHaveLength(3);
    });

    it('delete icon has correct aria-label', async () => {
      setupNotesWithRecentOpens(createTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Check aria-label for accessibility
      expect(screen.getByLabelText('Delete Note One')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete Note Two')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete Note Three')).toBeInTheDocument();
    });

    it('clicking delete icon opens confirmation screen', async () => {
      setupNotesWithRecentOpens(createTestNotes());
      const onModeChange = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onModeChange={onModeChange}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click the delete icon on the first note
      const deleteButton = screen.getByLabelText('Delete Note One');
      fireEvent.click(deleteButton);

      // Should show confirmation screen
      expect(screen.getByText('Delete "Note One"?')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
      expect(onModeChange).toHaveBeenCalledWith('delete-confirm');
    });

    it('clicking delete icon does NOT open note (stopPropagation works)', async () => {
      setupNotesWithRecentOpens(createTestNotes());
      const onNoteSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={onNoteSelect}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click the delete icon
      const deleteButton = screen.getByLabelText('Delete Note One');
      fireEvent.click(deleteButton);

      // onNoteSelect should NOT be called
      expect(onNoteSelect).not.toHaveBeenCalled();
      // onClose should NOT be called
      expect(onClose).not.toHaveBeenCalled();
    });

    it('cancel from confirmation returns to file-browse mode', async () => {
      setupNotesWithRecentOpens(createTestNotes());
      const onModeChange = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onModeChange={onModeChange}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click the delete icon to open confirmation
      const deleteButton = screen.getByLabelText('Delete Note One');
      fireEvent.click(deleteButton);

      // Verify confirmation screen is shown
      expect(screen.getByText('Delete "Note One"?')).toBeInTheDocument();

      // Click Cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Should return to file-browse mode (not delete-browse)
      expect(onModeChange).toHaveBeenLastCalledWith('file-browse');

      // Should show file-browse input placeholder again
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('Escape from confirmation returns to file-browse mode', async () => {
      setupNotesWithRecentOpens(createTestNotes());
      const onModeChange = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onModeChange={onModeChange}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Click the delete icon to open confirmation
      const deleteButton = screen.getByLabelText('Delete Note One');
      fireEvent.click(deleteButton);

      // Verify confirmation screen is shown
      expect(screen.getByText('Delete "Note One"?')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      // Should return to file-browse mode (not delete-browse)
      expect(onModeChange).toHaveBeenLastCalledWith('file-browse');

      // Should show file-browse input placeholder again
      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });

    it('delete icon has correct CSS class for styling', async () => {
      setupNotesWithRecentOpens(createTestNotes());

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Check that delete buttons have the correct CSS class
      const deleteButtons = document.querySelectorAll(CSS.deleteIcon);
      expect(deleteButtons).toHaveLength(3);
    });

    it('delete icon for untitled notes uses fallback aria-label', async () => {
      const notesWithUntitled = [
        createMockNote({
          id: 'note-untitled',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: null, tags: [], links: [], mentions: [] },
        }),
      ];

      setupNotesWithRecentOpens(notesWithUntitled);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should use fallback "note" in aria-label for untitled notes
      expect(screen.getByLabelText('Delete note')).toBeInTheDocument();
    });
  });
});
