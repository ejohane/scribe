/**
 * CommandPalette - Delete Browse Mode Tests
 *
 * Tests for delete-browse mode functionality:
 * - Mode switching behavior
 * - Placeholder text
 * - Note selection transitions to delete-confirm
 * - Keyboard navigation (Escape, Enter, arrows)
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import {
  createMockNote,
  mockCommands,
  setupScribeMock,
  BASE_TIME,
} from './CommandPalette.test-utils';

describe('CommandPalette - Delete Browse Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupScribeMock();
  });

  describe('Mode switching', () => {
    it('opens in delete-browse mode when initialMode is delete-browse', async () => {
      const mockNotes = [
        createMockNote({
          id: 'note-1',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: 'Test Note', tags: [], links: [] },
        }),
      ];
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
        />
      );

      // Should show delete-browse placeholder
      expect(screen.getByPlaceholderText('Select note to delete...')).toBeInTheDocument();

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });
    });

    it('Escape in delete-browse mode returns to command mode', async () => {
      const mockNotes = [
        createMockNote({
          id: 'note-1',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: 'Test Note', tags: [], links: [] },
        }),
      ];
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onModeChange = vi.fn();
      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          onModeChange={onModeChange}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      // Should notify parent of mode change to command
      expect(onModeChange).toHaveBeenCalledWith('command');

      // Should NOT close the palette
      expect(onClose).not.toHaveBeenCalled();

      // Should now show command mode placeholder
      expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
    });

    it('back button in delete-browse mode returns to command mode', async () => {
      const mockNotes = [
        createMockNote({
          id: 'note-1',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: 'Test Note', tags: [], links: [] },
        }),
      ];
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onModeChange = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          onModeChange={onModeChange}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Test Note')).toBeInTheDocument();
      });

      // Click back button
      const backButton = screen.getByLabelText('Back to commands');
      fireEvent.click(backButton);

      // Should notify parent of mode change to command
      expect(onModeChange).toHaveBeenCalledWith('command');

      // Should show command mode placeholder
      expect(screen.getByPlaceholderText('Search or run a command...')).toBeInTheDocument();
    });
  });

  describe('Placeholder text', () => {
    it("shows 'Select note to delete...' placeholder in delete-browse mode", async () => {
      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
        />
      );

      expect(screen.getByPlaceholderText('Select note to delete...')).toBeInTheDocument();
    });
  });

  describe('Note selection', () => {
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

    it('clicking note transitions to delete-confirm mode', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onModeChange = vi.fn();
      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          onModeChange={onModeChange}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Three')).toBeInTheDocument();
      });

      // Click on a note
      const noteItem = screen.getByText('Note Two');
      fireEvent.click(noteItem);

      // Should transition to delete-confirm mode
      expect(onModeChange).toHaveBeenCalledWith('delete-confirm');

      // Palette should NOT be closed
      expect(onClose).not.toHaveBeenCalled();
    });

    it('pressing Enter on highlighted note transitions to delete-confirm mode', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onModeChange = vi.fn();
      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          onModeChange={onModeChange}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Three')).toBeInTheDocument();
      });

      // Press Enter on the first highlighted note
      fireEvent.keyDown(window, { key: 'Enter' });

      // Should transition to delete-confirm mode
      expect(onModeChange).toHaveBeenCalledWith('delete-confirm');

      // Palette should NOT be closed
      expect(onClose).not.toHaveBeenCalled();
    });

    it('arrow keys navigate the note list', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Note Three')).toBeInTheDocument();
      });

      // Initially first item should be selected
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

      // Press Arrow Up
      fireEvent.keyDown(window, { key: 'ArrowUp' });

      // First item should be selected again
      await waitFor(() => {
        const updatedItems = document.querySelectorAll('.command-palette-item');
        expect(updatedItems[0]).toHaveClass('selected');
        expect(updatedItems[1]).not.toHaveClass('selected');
      });
    });
  });

  describe('Empty vault', () => {
    it("shows 'No notes to delete' for empty vault in delete-browse mode", async () => {
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue([]);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
        />
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show empty vault message specific to delete mode
      expect(screen.getByText('No notes to delete')).toBeInTheDocument();
    });
  });

  describe('Note exclusion', () => {
    it('excludes current note from delete list', async () => {
      const currentNoteId = 'current-note';

      const mockNotes = [
        createMockNote({
          id: currentNoteId,
          updatedAt: BASE_TIME + 5000,
          metadata: { title: 'Current Note', tags: [], links: [] },
        }),
        createMockNote({
          id: 'other-note',
          updatedAt: BASE_TIME + 4000,
          metadata: { title: 'Other Note', tags: [], links: [] },
        }),
      ];

      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          currentNoteId={currentNoteId}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Current note should NOT be in the list
      expect(screen.queryByText('Current Note')).not.toBeInTheDocument();

      // Other note should be visible
      expect(screen.getByText('Other Note')).toBeInTheDocument();
    });
  });
});
