import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHistoryEntries } from './useHistoryEntries';
import { createNoteId, type NoteId, type Note } from '@scribe/shared';

describe('useHistoryEntries', () => {
  let mockNotesList: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  // Helper to create mock notes
  const createMockNote = (id: string, title: string): Note => ({
    id: createNoteId(id),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: { root: { type: 'root', children: [] } },
    metadata: { title: null, tags: [], links: [], mentions: [] },
  });

  beforeEach(() => {
    mockNotesList = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock window.scribe API
    window.scribe = {
      notes: {
        list: mockNotesList,
      },
    } as unknown as typeof window.scribe;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns empty array initially', () => {
      mockNotesList.mockImplementation(() => new Promise(() => {})); // Never resolves

      const historyStack: NoteId[] = [createNoteId('note-1')];
      const { result } = renderHook(() => useHistoryEntries(historyStack, false));

      expect(result.current).toEqual([]);
    });

    it('does not fetch when shouldFetch is false', () => {
      mockNotesList.mockResolvedValue([]);

      const historyStack: NoteId[] = [createNoteId('note-1')];
      renderHook(() => useHistoryEntries(historyStack, false));

      expect(mockNotesList).not.toHaveBeenCalled();
    });
  });

  describe('fetching history entries', () => {
    it('fetches history entries on mount when shouldFetch is true', async () => {
      const mockNotes = [
        createMockNote('note-1', 'Note One'),
        createMockNote('note-2', 'Note Two'),
      ];
      mockNotesList.mockResolvedValue(mockNotes);

      const historyStack: NoteId[] = [createNoteId('note-1'), createNoteId('note-2')];
      const { result } = renderHook(() => useHistoryEntries(historyStack, true));

      await waitFor(() => {
        expect(result.current).toHaveLength(2);
      });

      expect(result.current[0]).toEqual({
        id: createNoteId('note-1'),
        title: 'Note One',
      });
      expect(result.current[1]).toEqual({
        id: createNoteId('note-2'),
        title: 'Note Two',
      });
    });

    it('returns entries in historyStack order', async () => {
      const mockNotes = [
        createMockNote('note-3', 'Third'),
        createMockNote('note-1', 'First'),
        createMockNote('note-2', 'Second'),
      ];
      mockNotesList.mockResolvedValue(mockNotes);

      // Stack order: note-2, note-1, note-3
      const historyStack: NoteId[] = [
        createNoteId('note-2'),
        createNoteId('note-1'),
        createNoteId('note-3'),
      ];
      const { result } = renderHook(() => useHistoryEntries(historyStack, true));

      await waitFor(() => {
        expect(result.current).toHaveLength(3);
      });

      expect(result.current[0].id).toBe('note-2');
      expect(result.current[0].title).toBe('Second');
      expect(result.current[1].id).toBe('note-1');
      expect(result.current[1].title).toBe('First');
      expect(result.current[2].id).toBe('note-3');
      expect(result.current[2].title).toBe('Third');
    });

    it('handles notes not found in the list (undefined title)', async () => {
      const mockNotes = [createMockNote('note-1', 'Note One')];
      mockNotesList.mockResolvedValue(mockNotes);

      // Stack includes a note that doesn't exist in the list
      const historyStack: NoteId[] = [createNoteId('note-1'), createNoteId('note-missing')];
      const { result } = renderHook(() => useHistoryEntries(historyStack, true));

      await waitFor(() => {
        expect(result.current).toHaveLength(2);
      });

      expect(result.current[0].title).toBe('Note One');
      expect(result.current[1].title).toBeUndefined();
    });
  });

  describe('empty history stack', () => {
    it('returns empty array for empty history stack', async () => {
      mockNotesList.mockResolvedValue([]);

      const historyStack: NoteId[] = [];
      const { result } = renderHook(() => useHistoryEntries(historyStack, true));

      // Wait a tick to ensure the hook has processed
      await waitFor(() => {
        expect(result.current).toEqual([]);
      });

      // Should not call list API when stack is empty
      expect(mockNotesList).not.toHaveBeenCalled();
    });

    it('clears entries when history stack becomes empty', async () => {
      const mockNotes = [createMockNote('note-1', 'Note One')];
      mockNotesList.mockResolvedValue(mockNotes);

      const { result, rerender } = renderHook(
        ({ stack, shouldFetch }) => useHistoryEntries(stack, shouldFetch),
        { initialProps: { stack: [createNoteId('note-1')] as NoteId[], shouldFetch: true } }
      );

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
      });

      // Clear the stack
      rerender({ stack: [], shouldFetch: true });

      await waitFor(() => {
        expect(result.current).toEqual([]);
      });
    });
  });

  describe('shouldFetch changes', () => {
    it('fetches when shouldFetch changes to true', async () => {
      const mockNotes = [createMockNote('note-1', 'Note One')];
      mockNotesList.mockResolvedValue(mockNotes);

      const historyStack: NoteId[] = [createNoteId('note-1')];
      const { result, rerender } = renderHook(
        ({ stack, shouldFetch }) => useHistoryEntries(stack, shouldFetch),
        { initialProps: { stack: historyStack, shouldFetch: false } }
      );

      // Should not fetch initially
      expect(mockNotesList).not.toHaveBeenCalled();
      expect(result.current).toEqual([]);

      // Enable fetching
      rerender({ stack: historyStack, shouldFetch: true });

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
      });

      expect(mockNotesList).toHaveBeenCalledTimes(1);
    });

    it('refetches when history stack changes', async () => {
      const mockNotes = [
        createMockNote('note-1', 'Note One'),
        createMockNote('note-2', 'Note Two'),
      ];
      mockNotesList.mockResolvedValue(mockNotes);

      const { result, rerender } = renderHook(
        ({ stack, shouldFetch }) => useHistoryEntries(stack, shouldFetch),
        { initialProps: { stack: [createNoteId('note-1')] as NoteId[], shouldFetch: true } }
      );

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
      });

      // Add another note to the stack
      rerender({ stack: [createNoteId('note-1'), createNoteId('note-2')], shouldFetch: true });

      await waitFor(() => {
        expect(result.current).toHaveLength(2);
      });
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      mockNotesList.mockRejectedValue(new Error('Network error'));

      const historyStack: NoteId[] = [createNoteId('note-1')];
      const { result } = renderHook(() => useHistoryEntries(historyStack, true));

      // Wait for the error to be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch history entries:',
          expect.any(Error)
        );
      });

      // Should still return empty array on error
      expect(result.current).toEqual([]);
    });
  });

  describe('memoization', () => {
    it('does not refetch when irrelevant props change', async () => {
      const mockNotes = [createMockNote('note-1', 'Note One')];
      mockNotesList.mockResolvedValue(mockNotes);

      const historyStack: NoteId[] = [createNoteId('note-1')];
      const { result, rerender } = renderHook(
        ({ stack, shouldFetch }) => useHistoryEntries(stack, shouldFetch),
        { initialProps: { stack: historyStack, shouldFetch: true } }
      );

      await waitFor(() => {
        expect(result.current).toHaveLength(1);
      });

      expect(mockNotesList).toHaveBeenCalledTimes(1);

      // Rerender with same props - should not refetch
      rerender({ stack: historyStack, shouldFetch: true });

      // Still only one call
      expect(mockNotesList).toHaveBeenCalledTimes(1);
    });
  });
});
