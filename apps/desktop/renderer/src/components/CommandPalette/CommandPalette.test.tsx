/**
 * CommandPalette Component Tests
 *
 * Tests for the CommandPalette component, covering:
 * - Mode switching behavior (command ↔ file-browse)
 * - file-browse mode initial state behavior and UI rendering
 * - file-browse mode search behavior
 * - keyboard navigation (Arrow up/down, Enter)
 * - click handlers (item clicks, overlay clicks)
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import type { Note } from '@scribe/shared';
import type { Command } from '../../commands/types';

// Helper to create mock notes with specific properties
function createMockNote(overrides: Partial<Note> & { id: string }): Note {
  const now = Date.now();
  // Check if title was explicitly provided in metadata (including null)
  const hasExplicitTitle = overrides.metadata && 'title' in overrides.metadata;
  return {
    id: overrides.id,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    content: overrides.content ?? {
      root: {
        type: 'root',
        children: [],
      },
    },
    metadata: {
      title: hasExplicitTitle ? overrides.metadata!.title : `Note ${overrides.id}`,
      tags: overrides.metadata?.tags ?? [],
      links: overrides.metadata?.links ?? [],
    },
  };
}

// Default mock commands for tests
const mockCommands: Command[] = [
  {
    id: 'new-note',
    title: 'New Note',
    description: 'Create a new note',
    run: vi.fn(),
  },
  {
    id: 'open-note',
    title: 'Open Note',
    description: 'Open an existing note',
    run: vi.fn(),
  },
];

// Base timestamps for creating ordered notes
const BASE_TIME = Date.now();

describe('CommandPalette', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup default window.scribe mock
    (window as any).scribe = {
      notes: {
        list: vi.fn().mockResolvedValue([]),
      },
      search: {
        query: vi.fn().mockResolvedValue([]),
      },
    };
  });

  describe('file-browse mode: initial state (no query)', () => {
    it('shows 10 most recent notes sorted by updatedAt desc', async () => {
      // Create 15 notes with different updatedAt timestamps
      const mockNotes: Note[] = [];
      for (let i = 1; i <= 15; i++) {
        mockNotes.push(
          createMockNote({
            id: `note-${i}`,
            // More recent notes have higher timestamps
            updatedAt: BASE_TIME + i * 1000,
            metadata: { title: `Note ${i}`, tags: [], links: [] },
          })
        );
      }

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
      const currentNoteId = 'current-note';

      const mockNotes: Note[] = [
        createMockNote({
          id: currentNoteId,
          updatedAt: BASE_TIME + 5000, // Most recent
          metadata: { title: 'Current Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'other-note-1',
          updatedAt: BASE_TIME + 4000,
          metadata: { title: 'Other Note 1', tags: [], links: [] },
        }),
        createMockNote({
          id: 'other-note-2',
          updatedAt: BASE_TIME + 3000,
          metadata: { title: 'Other Note 2', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          currentNoteId={currentNoteId}
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
      // Create a promise we can control to simulate loading
      let resolveNotes: (notes: Note[]) => void;
      const notesPromise = new Promise<Note[]>((resolve) => {
        resolveNotes = resolve;
      });

      (window as any).scribe.notes.list = vi.fn().mockReturnValue(notesPromise);

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

      // Resolve the promise
      resolveNotes!([
        createMockNote({
          id: 'note-1',
          metadata: { title: 'Test Note', tags: [], links: [] },
        }),
      ]);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Note should now be visible
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });

    it("shows 'No notes yet. Create one with ⌘N' for empty vault", async () => {
      // Return empty array for notes
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue([]);

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
          metadata: { title: 'Titled Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'untitled-note',
          updatedAt: BASE_TIME + 3000, // More recent
          metadata: { title: null, tags: [], links: [] }, // Untitled
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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

  describe('Mode switching', () => {
    describe('⌘O opens palette in file-browse mode', () => {
      it('opens palette in file-browse mode when initialMode is file-browse', async () => {
        render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Should show "Search notes..." placeholder for file-browse mode
        expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();

        // Should show back button in file-browse mode
        expect(screen.getByLabelText('Back to commands')).toBeInTheDocument();
      });

      it('opens palette in command mode when initialMode is command', async () => {
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
        expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();

        // Should NOT show back button in command mode
        expect(screen.queryByLabelText('Back to commands')).not.toBeInTheDocument();
      });

      it('fetches notes when entering file-browse mode', async () => {
        const mockNotes = [
          createMockNote({ id: 'note-1', metadata: { title: 'First Note', tags: [], links: [] } }),
          createMockNote({ id: 'note-2', metadata: { title: 'Second Note', tags: [], links: [] } }),
        ];
        (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

        render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Wait for notes to be fetched
        await waitFor(() => {
          expect((window as any).scribe.notes.list).toHaveBeenCalled();
        });

        // Notes should be displayed
        await waitFor(() => {
          expect(screen.getByText('First Note')).toBeInTheDocument();
          expect(screen.getByText('Second Note')).toBeInTheDocument();
        });
      });
    });

    describe('Selecting "Open Note" command switches to file-browse mode', () => {
      it('switches to file-browse mode when Open Note command is executed', async () => {
        // This test verifies the command execution flow
        // In the real app, the Open Note command sets the mode to file-browse
        const mockSetMode = vi.fn();
        const openNoteCommand: Command = {
          id: 'open-note',
          title: 'Open Note',
          description: 'Open an existing note',
          run: async () => {
            // Simulate what the real command does
            mockSetMode('file-browse');
          },
        };

        const onCommandSelect = vi.fn(async (cmd: Command) => {
          await cmd.run({
            closePalette: vi.fn(),
            setCurrentNoteId: vi.fn(),
            getCurrentNoteId: () => null,
            saveCurrentNote: vi.fn(),
            createNote: vi.fn(),
          });
        });

        render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={[openNoteCommand]}
            onCommandSelect={onCommandSelect}
            initialMode="command"
          />
        );

        // Click on the Open Note command
        const commandItem = screen.getByText('Open Note');
        fireEvent.click(commandItem);

        // Verify the command was selected and run
        await waitFor(() => {
          expect(onCommandSelect).toHaveBeenCalledWith(openNoteCommand);
          expect(mockSetMode).toHaveBeenCalledWith('file-browse');
        });
      });
    });

    describe('⌘K while in file-browse mode returns to command mode', () => {
      it('mode changes via initialMode prop when App handles ⌘K', async () => {
        // Note: The ⌘K handling to switch modes is done in App.tsx, not in CommandPalette
        // CommandPalette only handles Escape and back button to return to command mode
        // This test verifies the component responds correctly to initialMode changes

        const onClose = vi.fn();
        const { rerender } = render(
          <CommandPalette
            isOpen={true}
            onClose={onClose}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Verify we're in file-browse mode
        expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();

        // Simulate App.tsx behavior: when ⌘K is pressed while in file-browse mode,
        // App.tsx changes initialMode to 'command' and rerenders
        rerender(
          <CommandPalette
            isOpen={true}
            onClose={onClose}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Should now show command mode placeholder
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
        });

        // Palette should still be open (onClose not called)
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    describe('Escape while in file-browse mode returns to command mode (not close)', () => {
      it('pressing Escape in file-browse mode returns to command mode', async () => {
        const onClose = vi.fn();

        render(
          <CommandPalette
            isOpen={true}
            onClose={onClose}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Verify we're in file-browse mode
        expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
        expect(screen.getByLabelText('Back to commands')).toBeInTheDocument();

        // Press Escape
        fireEvent.keyDown(window, { key: 'Escape' });

        // Should return to command mode, not close
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
        });

        // Palette should NOT be closed
        expect(onClose).not.toHaveBeenCalled();

        // Back button should no longer be visible
        expect(screen.queryByLabelText('Back to commands')).not.toBeInTheDocument();
      });

      it('pressing Escape in command mode closes the palette', async () => {
        const onClose = vi.fn();

        render(
          <CommandPalette
            isOpen={true}
            onClose={onClose}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Press Escape
        fireEvent.keyDown(window, { key: 'Escape' });

        // Should close the palette
        expect(onClose).toHaveBeenCalled();
      });

      it('Escape in file-browse mode clears the query', async () => {
        render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Type something in the input
        const input = screen.getByPlaceholderText('Search notes...');
        fireEvent.change(input, { target: { value: 'search query' } });
        expect(input).toHaveValue('search query');

        // Press Escape
        fireEvent.keyDown(window, { key: 'Escape' });

        // Wait for mode switch and verify query is cleared
        await waitFor(() => {
          const commandInput = screen.getByPlaceholderText('Search or run a command...');
          expect(commandInput).toHaveValue('');
        });
      });
    });

    describe('Clicking back button returns to command mode', () => {
      it('clicking back button returns to command mode', async () => {
        const onClose = vi.fn();

        render(
          <CommandPalette
            isOpen={true}
            onClose={onClose}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Verify we're in file-browse mode with back button
        const backButton = screen.getByLabelText('Back to commands');
        expect(backButton).toBeInTheDocument();

        // Click the back button
        fireEvent.click(backButton);

        // Should return to command mode
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
        });

        // Palette should NOT be closed
        expect(onClose).not.toHaveBeenCalled();

        // Back button should no longer be visible
        expect(screen.queryByLabelText('Back to commands')).not.toBeInTheDocument();
      });

      it('clicking back button clears the query', async () => {
        render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Type something in the input
        const input = screen.getByPlaceholderText('Search notes...');
        fireEvent.change(input, { target: { value: 'search query' } });
        expect(input).toHaveValue('search query');

        // Click back button
        const backButton = screen.getByLabelText('Back to commands');
        fireEvent.click(backButton);

        // Wait for mode switch and verify query is cleared
        await waitFor(() => {
          const commandInput = screen.getByPlaceholderText('Search or run a command...');
          expect(commandInput).toHaveValue('');
        });
      });

      it('clicking back button calls onModeChange callback', async () => {
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

        // Click back button
        const backButton = screen.getByLabelText('Back to commands');
        fireEvent.click(backButton);

        // onModeChange should be called with 'command'
        expect(onModeChange).toHaveBeenCalledWith('command');
      });
    });

    describe('onModeChange callback', () => {
      it('Escape in file-browse mode calls onModeChange with command', async () => {
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

        // Press Escape
        fireEvent.keyDown(window, { key: 'Escape' });

        // onModeChange should be called with 'command'
        expect(onModeChange).toHaveBeenCalledWith('command');
      });
    });

    describe('Mode resets to command when palette closes and reopens', () => {
      it('mode resets to command when palette closes', async () => {
        const { rerender } = render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Verify we start in file-browse mode
        expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();

        // Close the palette
        rerender(
          <CommandPalette
            isOpen={false}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Reopen the palette (with initialMode='command' which is the default)
        rerender(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Should be in command mode
        await waitFor(() => {
          expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
        });
      });

      it('query is cleared when palette reopens', async () => {
        const { rerender } = render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Type a query
        const input = screen.getByPlaceholderText('Search or run a command...');
        fireEvent.change(input, { target: { value: 'test query' } });
        expect(input).toHaveValue('test query');

        // Close the palette
        rerender(
          <CommandPalette
            isOpen={false}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Reopen the palette
        rerender(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // Query should be cleared
        await waitFor(() => {
          const newInput = screen.getByPlaceholderText('Search or run a command...');
          expect(newInput).toHaveValue('');
        });
      });

      it('selection index resets when palette reopens', async () => {
        const commands = [
          { id: 'cmd-1', title: 'Command One', run: vi.fn() },
          { id: 'cmd-2', title: 'Command Two', run: vi.fn() },
          { id: 'cmd-3', title: 'Command Three', run: vi.fn() },
        ];

        const { rerender } = render(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={commands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // First item should be selected by default
        await waitFor(() => {
          const items = document.querySelectorAll('.command-palette-item');
          expect(items[0]).toHaveClass('selected');
        });

        // Navigate down twice
        fireEvent.keyDown(window, { key: 'ArrowDown' });
        fireEvent.keyDown(window, { key: 'ArrowDown' });

        // Third item should now be selected
        await waitFor(() => {
          const items = document.querySelectorAll('.command-palette-item');
          expect(items[2]).toHaveClass('selected');
        });

        // Close and reopen
        rerender(
          <CommandPalette
            isOpen={false}
            onClose={vi.fn()}
            commands={commands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        rerender(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={commands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        // First item should be selected again
        await waitFor(() => {
          const items = document.querySelectorAll('.command-palette-item');
          expect(items[0]).toHaveClass('selected');
        });
      });

      it('file-browse note selection index resets when palette reopens', async () => {
        const mockNotes = [
          createMockNote({
            id: 'note-1',
            updatedAt: BASE_TIME + 3000,
            metadata: { title: 'Note One', tags: [], links: [] },
          }),
          createMockNote({
            id: 'note-2',
            updatedAt: BASE_TIME + 2000,
            metadata: { title: 'Note Two', tags: [], links: [] },
          }),
          createMockNote({
            id: 'note-3',
            updatedAt: BASE_TIME + 1000,
            metadata: { title: 'Note Three', tags: [], links: [] },
          }),
        ];
        (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

        const { rerender } = render(
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

        // First item should be selected by default
        let items = document.querySelectorAll('.command-palette-item');
        expect(items[0]).toHaveClass('selected');

        // Navigate down
        fireEvent.keyDown(window, { key: 'ArrowDown' });

        // Second item should now be selected
        items = document.querySelectorAll('.command-palette-item');
        expect(items[1]).toHaveClass('selected');

        // Close and reopen
        rerender(
          <CommandPalette
            isOpen={false}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="command"
          />
        );

        rerender(
          <CommandPalette
            isOpen={true}
            onClose={vi.fn()}
            commands={mockCommands}
            onCommandSelect={vi.fn()}
            initialMode="file-browse"
          />
        );

        // Wait for notes to load again
        await waitFor(() => {
          expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });

        // First item should be selected again
        items = document.querySelectorAll('.command-palette-item');
        expect(items[0]).toHaveClass('selected');
      });
    });
  });

  describe('file-browse mode: keyboard navigation', () => {
    // Create notes sorted by updatedAt desc (most recent first)
    const createSortedNotes = () => [
      createMockNote({
        id: 'note-5',
        updatedAt: BASE_TIME + 5000,
        metadata: { title: 'Note Five', tags: [], links: [] },
      }),
      createMockNote({
        id: 'note-4',
        updatedAt: BASE_TIME + 4000,
        metadata: { title: 'Note Four', tags: [], links: [] },
      }),
      createMockNote({
        id: 'note-3',
        updatedAt: BASE_TIME + 3000,
        metadata: { title: 'Note Three', tags: [], links: [] },
      }),
      createMockNote({
        id: 'note-2',
        updatedAt: BASE_TIME + 2000,
        metadata: { title: 'Note Two', tags: [], links: [] },
      }),
      createMockNote({
        id: 'note-1',
        updatedAt: BASE_TIME + 1000,
        metadata: { title: 'Note One', tags: [], links: [] },
      }),
    ];

    it('Arrow Down highlights next item', async () => {
      const mockNotes = createSortedNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={vi.fn()}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Five')).toBeInTheDocument();
      });

      // Initially first item should be selected (Note Five is most recent)
      const items = document.querySelectorAll('.command-palette-item');
      expect(items[0]).toHaveClass('selected');
      expect(items[1]).not.toHaveClass('selected');

      // Press Arrow Down
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Second item should now be selected
      await waitFor(() => {
        const updatedItems = document.querySelectorAll('.command-palette-item');
        expect(updatedItems[0]).not.toHaveClass('selected');
        expect(updatedItems[1]).toHaveClass('selected');
      });
    });

    it('Arrow Up highlights previous item', async () => {
      const mockNotes = createSortedNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={vi.fn()}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Five')).toBeInTheDocument();
      });

      // Move down twice first
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Third item should be selected
      await waitFor(() => {
        const items = document.querySelectorAll('.command-palette-item');
        expect(items[2]).toHaveClass('selected');
      });

      // Press Arrow Up
      fireEvent.keyDown(window, { key: 'ArrowUp' });

      // Second item should now be selected
      await waitFor(() => {
        const updatedItems = document.querySelectorAll('.command-palette-item');
        expect(updatedItems[1]).toHaveClass('selected');
        expect(updatedItems[2]).not.toHaveClass('selected');
      });
    });

    it('Enter on highlighted item opens note and closes palette', async () => {
      const mockNotes = createSortedNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
        expect(screen.getByText('Note Five')).toBeInTheDocument();
      });

      // Move to second item (Note Four)
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Press Enter to select
      fireEvent.keyDown(window, { key: 'Enter' });

      // onNoteSelect should be called with the second note's ID
      expect(onNoteSelect).toHaveBeenCalledWith('note-4');
      // onClose should be called to close the palette
      expect(onClose).toHaveBeenCalled();
    });

    it('keyboard navigation stops at upper boundary (does not wrap)', async () => {
      const mockNotes = createSortedNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={vi.fn()}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Five')).toBeInTheDocument();
      });

      // Try to go up from the first item (should stay at first)
      fireEvent.keyDown(window, { key: 'ArrowUp' });

      // First item should still be selected
      await waitFor(() => {
        const items = document.querySelectorAll('.command-palette-item');
        expect(items[0]).toHaveClass('selected');
      });
    });

    it('keyboard navigation stops at lower boundary (does not wrap)', async () => {
      const mockNotes = createSortedNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          onNoteSelect={vi.fn()}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Five')).toBeInTheDocument();
      });

      // Move to last item (5 notes, need 4 down presses)
      for (let i = 0; i < 4; i++) {
        fireEvent.keyDown(window, { key: 'ArrowDown' });
      }

      // Last item should be selected
      await waitFor(() => {
        const items = document.querySelectorAll('.command-palette-item');
        expect(items[4]).toHaveClass('selected');
      });

      // Try to go down from the last item (should stay at last)
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Last item should still be selected
      await waitFor(() => {
        const items = document.querySelectorAll('.command-palette-item');
        expect(items[4]).toHaveClass('selected');
      });
    });
  });

  describe('file-browse mode: click behavior', () => {
    const createTestNotes = () => [
      createMockNote({
        id: 'note-3',
        updatedAt: BASE_TIME + 3000,
        metadata: { title: 'Note Three', tags: [], links: [] },
      }),
      createMockNote({
        id: 'note-2',
        updatedAt: BASE_TIME + 2000,
        metadata: { title: 'Note Two', tags: [], links: [] },
      }),
      createMockNote({
        id: 'note-1',
        updatedAt: BASE_TIME + 1000,
        metadata: { title: 'Note One', tags: [], links: [] },
      }),
    ];

    it('clicking note item opens note and closes palette', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
      const noteItems = document.querySelectorAll('.command-palette-item');
      fireEvent.click(noteItems[1]);

      // onNoteSelect should be called with the clicked note's ID
      expect(onNoteSelect).toHaveBeenCalledWith('note-2');
      // onClose should be called
      expect(onClose).toHaveBeenCalled();
    });

    it('clicking outside palette (overlay) closes palette', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
      const overlay = document.querySelector('.command-palette-overlay');
      expect(overlay).toBeTruthy();
      fireEvent.click(overlay!);

      // onClose should be called
      expect(onClose).toHaveBeenCalled();
      // onNoteSelect should NOT be called
      expect(onNoteSelect).not.toHaveBeenCalled();
    });
  });

  describe('file-browse mode: search behavior', () => {
    // Sample notes for search tests
    const createSearchTestNotes = (): Note[] => {
      const now = Date.now();
      return [
        createMockNote({
          id: 'note-1',
          updatedAt: now - 1000,
          metadata: { title: 'Meeting Notes', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-2',
          updatedAt: now - 2000,
          metadata: { title: 'Project Ideas', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-3',
          updatedAt: now - 3000,
          metadata: { title: 'Shopping List', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-4',
          updatedAt: now - 4000,
          metadata: { title: 'Travel Plans', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-5',
          updatedAt: now - 5000,
          metadata: { title: 'Recipe Collection', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-6',
          updatedAt: now - 6000,
          metadata: { title: 'MEETING AGENDA', tags: [], links: [] }, // For case-insensitive test
        }),
        createMockNote({
          id: 'note-7',
          updatedAt: now - 7000,
          metadata: { title: null, tags: [], links: [] }, // Untitled note
        }),
      ];
    };

    // Helper to wait for debounce (real timers)
    const waitForDebounce = () => new Promise((resolve) => setTimeout(resolve, 200)); // 150ms debounce + buffer

    it('typing filters results via fuzzy search', async () => {
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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
          metadata: { title: `Test Note ${i + 1}`, tags: [], links: [] },
        })
      );

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(manyNotes);

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
        const noteItems = document.querySelectorAll('.command-palette-item');
        expect(noteItems.length).toBeLessThanOrEqual(25);
      });
    });

    it("shows 'No results' when query matches nothing", async () => {
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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

      await waitFor(() => {
        expect(screen.getByText('No results')).toBeInTheDocument();
      });
    });

    it('clearing query returns to recent notes view', async () => {
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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
          metadata: { title: 'Test Note One', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-2',
          updatedAt: Date.now() - 2000,
          metadata: { title: null, tags: [], links: [] }, // Untitled
        }),
        createMockNote({
          id: 'note-3',
          updatedAt: Date.now() - 3000,
          metadata: { title: 'Test Note Three', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(notesWithUntitled);

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
      const items = document.querySelectorAll('.command-palette-item');
      expect(items.length).toBe(2);
    });

    it('current note is excluded from search results', async () => {
      const testNotes = [
        createMockNote({
          id: 'current-note',
          updatedAt: Date.now(),
          metadata: { title: 'Current Document', tags: [], links: [] },
        }),
        createMockNote({
          id: 'other-note',
          updatedAt: Date.now() - 1000,
          metadata: { title: 'Other Document', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(testNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={[]}
          onCommandSelect={vi.fn()}
          initialMode="file-browse"
          currentNoteId="current-note"
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

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(createSearchTestNotes());

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

  describe('file-browse mode: UI rendering', () => {
    it('truncates long titles (>50 chars) with ellipsis', async () => {
      const longTitle =
        'This is a very long note title that exceeds fifty characters and should be truncated';
      const mockNotes: Note[] = [
        createMockNote({
          id: 'note-long',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: longTitle, tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
          metadata: { title: shortTitle, tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
          metadata: { title: 'Just Now Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-minutes',
          updatedAt: now - 5 * 60 * 1000, // 5 minutes ago
          metadata: { title: 'Minutes Ago Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-hours',
          updatedAt: now - 3 * 60 * 60 * 1000, // 3 hours ago
          metadata: { title: 'Hours Ago Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-days',
          updatedAt: now - 2 * 24 * 60 * 60 * 1000, // 2 days ago
          metadata: { title: 'Days Ago Note', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
          metadata: { title: 'Old Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'note-very-old',
          updatedAt: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago = Oct 25, 2025
          metadata: { title: 'Very Old Note', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
          metadata: { title: null, tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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

    it("placeholder text is 'Search or run a command...' in command mode", async () => {
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
      expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
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
          metadata: { title: 'Seven Days Ago', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
          metadata: { title: 'Six Days Ago', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

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
});
