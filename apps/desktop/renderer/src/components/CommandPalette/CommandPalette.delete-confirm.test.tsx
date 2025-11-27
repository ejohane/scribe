/**
 * CommandPalette - Delete Confirm Mode Tests
 *
 * Tests for delete-confirm mode functionality:
 * - Confirmation screen displays correct note title
 * - Long titles are truncated at 30 chars with ellipsis
 * - Cancel button returns to previous mode (returnMode)
 * - Escape key cancels
 * - Enter key triggers confirm
 * - Delete button triggers confirm
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import {
  createMockNote,
  mockCommands,
  setupScribeMock,
  BASE_TIME,
  CSS,
} from './CommandPalette.test-utils';

describe('CommandPalette - Delete Confirm Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupScribeMock();
  });

  const createTestNotes = () => [
    createMockNote({
      id: 'note-1',
      updatedAt: BASE_TIME + 1000,
      metadata: { title: 'Meeting Notes', tags: [], links: [] },
    }),
    createMockNote({
      id: 'note-2',
      updatedAt: BASE_TIME + 2000,
      metadata: { title: 'Project Ideas', tags: [], links: [] },
    }),
  ];

  describe('Confirmation screen display', () => {
    it('displays the correct note title in confirmation screen', async () => {
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
        expect(screen.getByText('Project Ideas')).toBeInTheDocument();
      });

      // Click on a note to enter delete-confirm mode
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Confirmation screen should show the note title
      expect(screen.getByText('Delete "Meeting Notes"?')).toBeInTheDocument();
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('truncates long titles at 30 characters with ellipsis', async () => {
      const longTitle = 'This is a very long note title that exceeds thirty characters';
      const mockNotes = [
        createMockNote({
          id: 'long-note',
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
          initialMode="delete-browse"
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText(/This is a very long note title/)).toBeInTheDocument();
      });

      // Click on the note to enter delete-confirm mode
      const noteItem = document.querySelector(CSS.paletteItem);
      fireEvent.click(noteItem!);

      // Title should be truncated: 30 chars of content + "..." (33 chars total)
      // Expected: 'This is a very long note title...'
      expect(
        screen.getByText(/Delete "This is a very long note title\.\.\."\?/)
      ).toBeInTheDocument();
    });

    it('displays "Untitled" for notes without a title', async () => {
      const mockNotes = [
        createMockNote({
          id: 'untitled-note',
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
          initialMode="delete-browse"
        />
      );

      // Wait for notes to load - the list shows "Untitled" for notes without title
      await waitFor(() => {
        expect(screen.getByText('Untitled')).toBeInTheDocument();
      });

      // Click on the note to enter delete-confirm mode
      const noteItem = document.querySelector(CSS.paletteItem);
      fireEvent.click(noteItem!);

      // Should show "Untitled" in the confirmation
      expect(screen.getByText('Delete "Untitled"?')).toBeInTheDocument();
    });

    it('shows Cancel and Delete buttons', async () => {
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

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Both buttons should be present
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('has correct accessibility attributes', async () => {
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

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Check accessibility attributes
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-confirm-title');
    });
  });

  describe('Cancel behavior', () => {
    it('Cancel button returns to delete-browse mode', async () => {
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

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Should be in delete-confirm mode
      expect(screen.getByText('Delete "Meeting Notes"?')).toBeInTheDocument();

      // Reset mock to track only the cancel action
      onModeChange.mockClear();

      // Click Cancel
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // Should return to delete-browse mode
      expect(onModeChange).toHaveBeenCalledWith('delete-browse');

      // Palette should NOT be closed
      expect(onClose).not.toHaveBeenCalled();

      // Should show delete-browse placeholder
      expect(screen.getByPlaceholderText('Select note to delete...')).toBeInTheDocument();
    });

    it('Escape key cancels and returns to previous mode', async () => {
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

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Should be in delete-confirm mode
      expect(screen.getByText('Delete "Meeting Notes"?')).toBeInTheDocument();

      // Reset mock to track only the cancel action
      onModeChange.mockClear();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      // Should return to delete-browse mode
      expect(onModeChange).toHaveBeenCalledWith('delete-browse');

      // Palette should NOT be closed
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Confirm behavior', () => {
    const createNoteStateMock = (currentNoteId: string | null = null) => ({
      currentNoteId,
      deleteNote: vi.fn().mockResolvedValue(undefined),
      loadNote: vi.fn().mockResolvedValue(undefined),
      createNote: vi.fn().mockResolvedValue(undefined),
    });

    it('Delete button triggers confirmation and closes palette', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onClose = vi.fn();
      const showToast = vi.fn();
      const noteState = createNoteStateMock();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should call deleteNote
      await waitFor(() => {
        expect(noteState.deleteNote).toHaveBeenCalledWith('note-1');
      });

      // Should show success toast
      expect(showToast).toHaveBeenCalledWith('"Meeting Notes" deleted');

      // Should close the palette
      expect(onClose).toHaveBeenCalled();
    });

    it('Enter key triggers confirmation', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onClose = vi.fn();
      const showToast = vi.fn();
      const noteState = createNoteStateMock();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Press Enter
      fireEvent.keyDown(window, { key: 'Enter' });

      // Should call deleteNote
      await waitFor(() => {
        expect(noteState.deleteNote).toHaveBeenCalledWith('note-1');
      });

      // Should close the palette
      expect(onClose).toHaveBeenCalled();
    });

    it('deleting non-current note keeps current note loaded', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onClose = vi.fn();
      const showToast = vi.fn();
      // Current note is note-2, deleting note-1
      const noteState = createNoteStateMock('note-2');

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load and click Meeting Notes (note-1)
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should call deleteNote
      await waitFor(() => {
        expect(noteState.deleteNote).toHaveBeenCalledWith('note-1');
      });

      // Should NOT call loadNote (keep current note)
      expect(noteState.loadNote).not.toHaveBeenCalled();
      expect(noteState.createNote).not.toHaveBeenCalled();
    });

    it('deleting current note opens most recent remaining note', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onClose = vi.fn();
      const showToast = vi.fn();
      // Current note is note-1, deleting note-1
      const noteState = createNoteStateMock('note-1');

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load and click Meeting Notes (note-1)
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should call deleteNote
      await waitFor(() => {
        expect(noteState.deleteNote).toHaveBeenCalledWith('note-1');
      });

      // Should load the most recent remaining note (note-2 has higher updatedAt)
      await waitFor(() => {
        expect(noteState.loadNote).toHaveBeenCalledWith('note-2');
      });
    });

    it('deleting last note creates a new note', async () => {
      const singleNote = [
        createMockNote({
          id: 'only-note',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: 'Only Note', tags: [], links: [] },
        }),
      ];
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(singleNote);

      const onClose = vi.fn();
      const showToast = vi.fn();
      // Current note is only-note
      const noteState = createNoteStateMock('only-note');

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText('Only Note')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Only Note'));

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should call deleteNote
      await waitFor(() => {
        expect(noteState.deleteNote).toHaveBeenCalledWith('only-note');
      });

      // Should create a new note since no notes remain
      await waitFor(() => {
        expect(noteState.createNote).toHaveBeenCalled();
      });
    });

    it('shows success toast with truncated title', async () => {
      const longTitle = 'This is a very long note title that exceeds thirty characters';
      const mockNotes = [
        createMockNote({
          id: 'long-note',
          updatedAt: BASE_TIME + 1000,
          metadata: { title: longTitle, tags: [], links: [] },
        }),
      ];
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const showToast = vi.fn();
      const noteState = createNoteStateMock();

      render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load
      await waitFor(() => {
        expect(screen.getByText(/This is a very long note title/)).toBeInTheDocument();
      });

      // Click on the note
      const noteItem = document.querySelector(CSS.paletteItem);
      fireEvent.click(noteItem!);

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should show truncated title in toast
      await waitFor(() => {
        // truncateTitle(title, 30) keeps 30 chars and adds "..."
        expect(showToast).toHaveBeenCalledWith('"This is a very long note title..." deleted');
      });
    });

    it('shows error toast on deletion failure and stays in delete-browse mode', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onClose = vi.fn();
      const onModeChange = vi.fn();
      const showToast = vi.fn();
      const noteState = createNoteStateMock();
      // Make deleteNote fail
      noteState.deleteNote.mockRejectedValue(new Error('Delete failed'));

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          onModeChange={onModeChange}
          showToast={showToast}
          noteState={noteState}
        />
      );

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Clear mode change mock (it was called when entering delete-confirm)
      onModeChange.mockClear();

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should show error toast
      await waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Failed to delete note', 'error');
      });

      // Should return to delete-browse mode
      expect(onModeChange).toHaveBeenCalledWith('delete-browse');

      // Should NOT close the palette
      expect(onClose).not.toHaveBeenCalled();

      // Should show delete-browse UI
      expect(screen.getByPlaceholderText('Select note to delete...')).toBeInTheDocument();
    });

    it('does nothing if noteState is not provided', async () => {
      const mockNotes = createTestNotes();
      (window as any).scribe.notes.list = vi.fn().mockResolvedValue(mockNotes);

      const onClose = vi.fn();

      render(
        <CommandPalette
          isOpen={true}
          onClose={onClose}
          commands={mockCommands}
          onCommandSelect={vi.fn()}
          initialMode="delete-browse"
          // noteState is intentionally not provided
        />
      );

      // Wait for notes to load and click one
      await waitFor(() => {
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // Should NOT close the palette (nothing happens without noteState)
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Return mode tracking', () => {
    it('returns to delete-browse when entered from delete-browse', async () => {
      const mockNotes = createTestNotes();
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
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      // Click note to enter delete-confirm
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Should transition to delete-confirm
      expect(onModeChange).toHaveBeenCalledWith('delete-confirm');

      // Clear mock
      onModeChange.mockClear();

      // Cancel should return to delete-browse
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onModeChange).toHaveBeenCalledWith('delete-browse');
    });

    it('pressing Enter in delete-browse transitions to delete-confirm', async () => {
      const mockNotes = createTestNotes();
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
        expect(screen.getByText('Project Ideas')).toBeInTheDocument();
      });

      // Press Enter on first highlighted note
      fireEvent.keyDown(window, { key: 'Enter' });

      // Should show confirmation for the first note (Project Ideas - sorted by updatedAt desc)
      expect(screen.getByText('Delete "Project Ideas"?')).toBeInTheDocument();
      expect(onModeChange).toHaveBeenCalledWith('delete-confirm');
    });
  });

  describe('Input visibility', () => {
    it('hides input field when in delete-confirm mode', async () => {
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
        expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      });

      // Input should be visible in delete-browse mode
      expect(screen.getByPlaceholderText('Select note to delete...')).toBeInTheDocument();

      // Click note to enter delete-confirm
      fireEvent.click(screen.getByText('Meeting Notes'));

      // Input should be hidden in delete-confirm mode
      expect(screen.queryByPlaceholderText('Select note to delete...')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});
