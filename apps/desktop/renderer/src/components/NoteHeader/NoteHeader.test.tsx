/**
 * NoteHeader Component Tests
 */

import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NoteHeader } from './NoteHeader';
import type {
  Note,
  RegularNote,
  DailyNote,
  MeetingNote,
  NoteType,
  DailyNoteData,
  MeetingNoteData,
} from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

/** Debounce delay matching the component (keep in sync with NoteHeader.tsx) */
const TITLE_DEBOUNCE_MS = 300;

/**
 * Input type for createMockNote overrides
 */
interface MockNoteOverrides {
  id?: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  type?: NoteType;
  tags?: string[];
  content?: Note['content'];
  metadata?: Partial<Note['metadata']>;
  daily?: DailyNoteData;
  meeting?: MeetingNoteData;
}

/**
 * Create a mock Note object with sensible defaults
 * Properly constructs discriminated union variants based on type
 */
const createMockNote = (overrides: MockNoteOverrides = {}): Note => {
  const baseNote = {
    id: createNoteId(overrides.id ?? 'test-note-1'),
    title: overrides.title ?? 'Test Title',
    createdAt: overrides.createdAt ?? 1701388800000, // Dec 1, 2023 00:00:00 UTC
    updatedAt: overrides.updatedAt ?? 1701388800000,
    tags: overrides.tags ?? ['tag1', 'tag2'],
    content: overrides.content ?? { root: { type: 'root' as const, children: [] } },
    metadata: {
      title: overrides.metadata?.title ?? null,
      tags: overrides.metadata?.tags ?? [],
      links: overrides.metadata?.links ?? [],
      mentions: overrides.metadata?.mentions ?? [],
    },
  };

  // Build proper discriminated union variant based on type
  if (overrides.type === 'daily') {
    return {
      ...baseNote,
      type: 'daily',
      daily: overrides.daily ?? { date: new Date().toISOString().split('T')[0] },
    } as DailyNote;
  }

  if (overrides.type === 'meeting') {
    return {
      ...baseNote,
      type: 'meeting',
      meeting: overrides.meeting ?? {
        date: new Date().toISOString().split('T')[0],
        dailyNoteId: createNoteId(''),
        attendees: [],
      },
    } as MeetingNote;
  }

  if (overrides.type === 'person') {
    return { ...baseNote, type: 'person' };
  }

  if (overrides.type === 'project') {
    return { ...baseNote, type: 'project' };
  }

  if (overrides.type === 'template') {
    return { ...baseNote, type: 'template' };
  }

  if (overrides.type === 'system') {
    return { ...baseNote, type: 'system' };
  }

  // Regular note (no type)
  return baseNote as RegularNote;
};

describe('NoteHeader', () => {
  describe('Title editing', () => {
    it('should display current note.title value', () => {
      const note = createMockNote({ title: 'My Note Title' });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      const titleInput = screen.getByRole('textbox', { name: /note title/i });
      expect(titleInput).toHaveValue('My Note Title');
    });

    it('should show placeholder when title is empty', () => {
      const note = createMockNote({ title: '' });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      const titleInput = screen.getByRole('textbox', { name: /note title/i });
      expect(titleInput).toHaveAttribute('placeholder', 'Untitled');
    });

    it('should sync local title when note prop changes', () => {
      const note1 = createMockNote({ id: createNoteId('note-1'), title: 'First Note' });
      const note2 = createMockNote({ id: createNoteId('note-2'), title: 'Second Note' });

      const { rerender } = render(
        <NoteHeader note={note1} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />
      );

      const titleInput = screen.getByRole('textbox', { name: /note title/i });
      expect(titleInput).toHaveValue('First Note');

      // Switch to a different note
      rerender(<NoteHeader note={note2} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      expect(titleInput).toHaveValue('Second Note');
    });
  });

  describe('Title editing (debounce behavior)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call onTitleChange with debounced value after typing', async () => {
      const onTitleChange = vi.fn();
      const note = createMockNote({ title: '' });
      render(<NoteHeader note={note} onTitleChange={onTitleChange} onTagsChange={vi.fn()} />);

      const titleInput = screen.getByRole('textbox', { name: /note title/i });

      // Use fireEvent for synchronous control with fake timers
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      // Should not have been called yet (still within debounce period)
      expect(onTitleChange).not.toHaveBeenCalled();

      // Advance timers past debounce delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TITLE_DEBOUNCE_MS);
      });

      // Now should be called exactly once with final value
      expect(onTitleChange).toHaveBeenCalledTimes(1);
      expect(onTitleChange).toHaveBeenCalledWith('New Title');
    });

    it('should update input value immediately while debouncing', () => {
      const onTitleChange = vi.fn();
      const note = createMockNote({ title: '' });
      render(<NoteHeader note={note} onTitleChange={onTitleChange} onTagsChange={vi.fn()} />);

      const titleInput = screen.getByRole('textbox', { name: /note title/i });

      // Use fireEvent for synchronous control with fake timers
      fireEvent.change(titleInput, { target: { value: 'Test' } });

      // Input should show the typed value immediately
      expect(titleInput).toHaveValue('Test');

      // But onTitleChange should not have been called yet
      expect(onTitleChange).not.toHaveBeenCalled();
    });

    it('should cancel pending debounce when typing continues', async () => {
      const onTitleChange = vi.fn();
      const note = createMockNote({ title: '' });
      render(<NoteHeader note={note} onTitleChange={onTitleChange} onTagsChange={vi.fn()} />);

      const titleInput = screen.getByRole('textbox', { name: /note title/i });

      // Type first part
      fireEvent.change(titleInput, { target: { value: 'Hello' } });

      // Advance part of the debounce time
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TITLE_DEBOUNCE_MS / 2);
      });

      // Type more (should reset debounce)
      fireEvent.change(titleInput, { target: { value: 'Hello World' } });

      // Advance less than the debounce time
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TITLE_DEBOUNCE_MS / 2);
      });

      // Should still not have been called (debounce was reset)
      expect(onTitleChange).not.toHaveBeenCalled();

      // Complete the debounce period
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TITLE_DEBOUNCE_MS);
      });

      // Now should be called with the complete value
      expect(onTitleChange).toHaveBeenCalledTimes(1);
      expect(onTitleChange).toHaveBeenCalledWith('Hello World');
    });
  });

  describe('Tag removal', () => {
    it('should call onTagsChange with filtered array when remove button clicked', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: ['keep', 'remove', 'also-keep'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const removeButton = screen.getByRole('button', { name: /remove tag remove/i });
      await user.click(removeButton);

      expect(onTagsChange).toHaveBeenCalledWith(['keep', 'also-keep']);
    });

    it('should have correct aria-label for accessibility', () => {
      const note = createMockNote({ tags: ['my-tag'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      const removeButton = screen.getByRole('button', { name: 'Remove tag my-tag' });
      expect(removeButton).toBeInTheDocument();
    });
  });

  describe('Tag addition', () => {
    it('should show input when "+ tag" button clicked', async () => {
      const user = userEvent.setup();
      const note = createMockNote({ tags: [] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      // Initially, tag input should not be visible
      expect(screen.queryByRole('textbox', { name: /new tag name/i })).not.toBeInTheDocument();

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      // Now the input should be visible
      expect(screen.getByRole('textbox', { name: /new tag name/i })).toBeInTheDocument();
    });

    it('should add tag on Enter key', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: ['existing'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      await user.type(tagInput, 'newtag{Enter}');

      expect(onTagsChange).toHaveBeenCalledWith(['existing', 'newtag']);
    });

    it('should add tag on blur', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: ['existing'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      await user.type(tagInput, 'blurtag');

      // Blur the input by clicking elsewhere
      await user.click(document.body);

      expect(onTagsChange).toHaveBeenCalledWith(['existing', 'blurtag']);
    });

    it('should cancel on Escape key', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: ['existing'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      await user.type(tagInput, 'cancelled{Escape}');

      // onTagsChange should NOT have been called
      expect(onTagsChange).not.toHaveBeenCalled();

      // Input should be hidden again, add button should be back
      expect(screen.queryByRole('textbox', { name: /new tag name/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add tag/i })).toBeInTheDocument();
    });

    it('should strip # prefix from input', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: [] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      await user.type(tagInput, '#hashtag{Enter}');

      // Tag should be added without the # prefix
      expect(onTagsChange).toHaveBeenCalledWith(['hashtag']);
    });

    it('should not add duplicate tags', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: ['existing'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      await user.type(tagInput, 'existing{Enter}');

      // onTagsChange should NOT have been called since tag already exists
      expect(onTagsChange).not.toHaveBeenCalled();
    });

    it('should trim whitespace on submission', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: [] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      // Spaces are allowed during input but trimmed on submission
      await user.type(tagInput, '  trimmed  {Enter}');

      // Tag should be trimmed on submission
      expect(onTagsChange).toHaveBeenCalledWith(['trimmed']);
    });

    it('should allow spaces in multi-word tags', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: [] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      // User should be able to type multi-word tags with spaces
      await user.type(tagInput, 'project alpha{Enter}');

      // Tag should preserve internal spaces
      expect(onTagsChange).toHaveBeenCalledWith(['project alpha']);
    });

    it('should not add empty tag', async () => {
      const user = userEvent.setup();
      const onTagsChange = vi.fn();
      const note = createMockNote({ tags: ['existing'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={onTagsChange} />);

      const addButton = screen.getByRole('button', { name: /add tag/i });
      await user.click(addButton);

      const tagInput = screen.getByRole('textbox', { name: /new tag name/i });
      // Press Enter without typing anything
      await user.type(tagInput, '{Enter}');

      expect(onTagsChange).not.toHaveBeenCalled();
    });
  });

  describe('Date display', () => {
    it('should format createdAt timestamp correctly', () => {
      const timestamp = 1701388800000; // Dec 1, 2023 00:00:00 UTC
      const note = createMockNote({ createdAt: timestamp });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      // Calculate expected date string using the same formatting as the component
      const expectedDate = new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });

    it('should handle different timestamps correctly', () => {
      const timestamp = 1721044800000; // July 15, 2024 12:00:00 UTC
      const note = createMockNote({ createdAt: timestamp });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      const expectedDate = new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      expect(screen.getByText(expectedDate)).toBeInTheDocument();
    });

    it('should handle invalid timestamps gracefully', () => {
      // Invalid timestamp - NaN will result in "Invalid Date"
      const note = createMockNote({ createdAt: NaN });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      // When timestamp is NaN, toLocaleDateString returns "Invalid Date"
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });
  });

  describe('Tag display', () => {
    it('should display all tags with # prefix', () => {
      const note = createMockNote({ tags: ['work', 'important', 'todo'] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      expect(screen.getByText(/#work/)).toBeInTheDocument();
      expect(screen.getByText(/#important/)).toBeInTheDocument();
      expect(screen.getByText(/#todo/)).toBeInTheDocument();
    });

    it('should show add tag button when no tags exist', () => {
      const note = createMockNote({ tags: [] });
      render(<NoteHeader note={note} onTitleChange={vi.fn()} onTagsChange={vi.fn()} />);

      expect(screen.getByRole('button', { name: /add tag/i })).toBeInTheDocument();
    });
  });
});
