/**
 * CommandPalette - Keyboard Navigation Tests
 *
 * Tests for keyboard navigation in file-browse mode:
 * - Arrow up/down navigation
 * - Enter key selection
 * - Navigation boundary behavior (no wrapping)
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

describe('CommandPalette - Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupScribeMock();
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
});
