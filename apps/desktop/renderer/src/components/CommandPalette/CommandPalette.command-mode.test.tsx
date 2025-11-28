/**
 * CommandPalette - Command Mode Tests
 *
 * Tests for mode switching behavior between command and file-browse modes:
 * - Opening in different modes
 * - Switching modes via commands, props, Escape, and back button
 * - Mode reset behavior when palette closes/reopens
 * - onModeChange callback behavior
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import type { Command } from '../../commands/types';
import {
  createMockNote,
  mockCommands,
  setupScribeMock,
  BASE_TIME,
  CSS,
  styles,
} from './CommandPalette.test-utils';

describe('CommandPalette - Mode Switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupScribeMock();
  });

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
      expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();

      // Should NOT show back button in command mode
      expect(screen.queryByLabelText('Back to commands')).not.toBeInTheDocument();
    });

    it('fetches notes when entering file-browse mode', async () => {
      const mockNotes = [
        createMockNote({
          id: 'note-1',
          metadata: { title: 'First Note', tags: [], links: [], mentions: [] },
        }),
        createMockNote({
          id: 'note-2',
          metadata: { title: 'Second Note', tags: [], links: [], mentions: [] },
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
          promptInput: vi.fn(),
          navigateToNote: vi.fn(),
          setPaletteMode: vi.fn(),
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
        expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();
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
        expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();
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
        const commandInput = screen.getByPlaceholderText('Search notes or create new...');
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
        expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();
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
        const commandInput = screen.getByPlaceholderText('Search notes or create new...');
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
        expect(screen.getByPlaceholderText('Search notes or create new...')).toBeInTheDocument();
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
      const input = screen.getByPlaceholderText('Search notes or create new...');
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
        const newInput = screen.getByPlaceholderText('Search notes or create new...');
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
        const items = document.querySelectorAll(CSS.paletteItem);
        expect(items[0]).toHaveClass(styles.paletteItemSelected);
      });

      // Navigate down twice
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Third item should now be selected
      await waitFor(() => {
        const items = document.querySelectorAll(CSS.paletteItem);
        expect(items[2]).toHaveClass(styles.paletteItemSelected);
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
        const items = document.querySelectorAll(CSS.paletteItem);
        expect(items[0]).toHaveClass(styles.paletteItemSelected);
      });
    });

    it('file-browse note selection index resets when palette reopens', async () => {
      const mockNotes = [
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
      let items = document.querySelectorAll(CSS.paletteItem);
      expect(items[0]).toHaveClass(styles.paletteItemSelected);

      // Navigate down
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      // Second item should now be selected
      items = document.querySelectorAll(CSS.paletteItem);
      expect(items[1]).toHaveClass(styles.paletteItemSelected);

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
      items = document.querySelectorAll(CSS.paletteItem);
      expect(items[0]).toHaveClass(styles.paletteItemSelected);
    });
  });
});
