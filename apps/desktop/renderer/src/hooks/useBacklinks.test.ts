import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBacklinks } from './useBacklinks';
import { createNoteId, type GraphNode } from '@scribe/shared';

describe('useBacklinks', () => {
  let mockBacklinks: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  // Helper to create mock backlink nodes
  const createMockBacklink = (id: string, title: string): GraphNode => ({
    id: createNoteId(id),
    title,
    tags: [],
  });

  beforeEach(() => {
    mockBacklinks = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock window.scribe API
    window.scribe = {
      graph: {
        backlinks: mockBacklinks,
      },
    } as unknown as typeof window.scribe;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with empty results', () => {
      const { result } = renderHook(() => useBacklinks());

      expect(result.current.results).toEqual([]);
    });

    it('starts with panel hidden', () => {
      const { result } = renderHook(() => useBacklinks());

      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('show function', () => {
    it('makes the panel visible', () => {
      const { result } = renderHook(() => useBacklinks());

      act(() => {
        result.current.show();
      });

      expect(result.current.isVisible).toBe(true);
    });

    it('does not fetch backlinks when show is called', () => {
      const { result } = renderHook(() => useBacklinks());

      act(() => {
        result.current.show();
      });

      expect(mockBacklinks).not.toHaveBeenCalled();
    });
  });

  describe('hide function', () => {
    it('hides the panel', () => {
      const { result } = renderHook(() => useBacklinks());

      // Show first
      act(() => {
        result.current.show();
      });

      expect(result.current.isVisible).toBe(true);

      // Then hide
      act(() => {
        result.current.hide();
      });

      expect(result.current.isVisible).toBe(false);
    });

    it('clears results when hiding', async () => {
      const mockResults = [
        createMockBacklink('link-1', 'Link One'),
        createMockBacklink('link-2', 'Link Two'),
      ];
      mockBacklinks.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useBacklinks());

      // Fetch some backlinks
      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-1'));
      });

      expect(result.current.results).toHaveLength(2);

      // Hide - should clear results
      act(() => {
        result.current.hide();
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('fetchForNote function', () => {
    it('fetches backlinks for a specific note ID', async () => {
      const mockResults = [
        createMockBacklink('link-1', 'Link One'),
        createMockBacklink('link-2', 'Link Two'),
      ];
      mockBacklinks.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useBacklinks());
      const noteId = createNoteId('target-note');

      await act(async () => {
        await result.current.fetchForNote(noteId);
      });

      expect(mockBacklinks).toHaveBeenCalledWith(noteId);
      expect(result.current.results).toEqual(mockResults);
    });

    it('shows the panel after fetching', async () => {
      mockBacklinks.mockResolvedValue([]);

      const { result } = renderHook(() => useBacklinks());

      expect(result.current.isVisible).toBe(false);

      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-1'));
      });

      expect(result.current.isVisible).toBe(true);
    });

    it('returns empty array when note has no backlinks', async () => {
      mockBacklinks.mockResolvedValue([]);

      const { result } = renderHook(() => useBacklinks());

      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-with-no-links'));
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.isVisible).toBe(true);
    });

    it('updates results when note ID changes', async () => {
      const firstResults = [createMockBacklink('link-1', 'Link One')];
      const secondResults = [
        createMockBacklink('link-2', 'Link Two'),
        createMockBacklink('link-3', 'Link Three'),
      ];

      mockBacklinks.mockResolvedValueOnce(firstResults).mockResolvedValueOnce(secondResults);

      const { result } = renderHook(() => useBacklinks());

      // Fetch for first note
      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-1'));
      });

      expect(result.current.results).toEqual(firstResults);

      // Fetch for second note
      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-2'));
      });

      expect(result.current.results).toEqual(secondResults);
    });
  });

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      mockBacklinks.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBacklinks());

      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-1'));
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch backlinks:', expect.any(Error));

      // Results should remain empty on error
      expect(result.current.results).toEqual([]);
    });

    it('does not show panel on error', async () => {
      mockBacklinks.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBacklinks());

      await act(async () => {
        await result.current.fetchForNote(createNoteId('note-1'));
      });

      // Panel should not be visible on error
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('return value stability', () => {
    it('returns memoized object when dependencies do not change', () => {
      const { result, rerender } = renderHook(() => useBacklinks());

      const firstReturn = result.current;

      // Rerender without changes
      rerender();

      // The object reference should be stable due to useMemo
      expect(result.current).toBe(firstReturn);
    });

    it('function references are stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useBacklinks());

      const firstShow = result.current.show;
      const firstHide = result.current.hide;
      const firstFetchForNote = result.current.fetchForNote;

      rerender();

      expect(result.current.show).toBe(firstShow);
      expect(result.current.hide).toBe(firstHide);
      expect(result.current.fetchForNote).toBe(firstFetchForNote);
    });
  });

  describe('edge cases', () => {
    it('handles rapid show/hide cycles', () => {
      const { result } = renderHook(() => useBacklinks());

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.show();
        });
        expect(result.current.isVisible).toBe(true);

        act(() => {
          result.current.hide();
        });
        expect(result.current.isVisible).toBe(false);
      }
    });

    it('handles multiple rapid fetchForNote calls', async () => {
      const results1 = [createMockBacklink('link-1', 'Link 1')];
      const results2 = [createMockBacklink('link-2', 'Link 2')];
      const results3 = [createMockBacklink('link-3', 'Link 3')];

      mockBacklinks
        .mockResolvedValueOnce(results1)
        .mockResolvedValueOnce(results2)
        .mockResolvedValueOnce(results3);

      const { result } = renderHook(() => useBacklinks());

      // Start multiple fetches
      await act(async () => {
        result.current.fetchForNote(createNoteId('note-1'));
        result.current.fetchForNote(createNoteId('note-2'));
        await result.current.fetchForNote(createNoteId('note-3'));
      });

      // The last fetch result should be set
      expect(mockBacklinks).toHaveBeenCalledTimes(3);
    });

    it('handles show/hide during fetch', async () => {
      let resolveBacklinks: (value: GraphNode[]) => void;
      const pendingPromise = new Promise<GraphNode[]>((resolve) => {
        resolveBacklinks = resolve;
      });
      mockBacklinks.mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useBacklinks());

      // Start fetch
      act(() => {
        result.current.fetchForNote(createNoteId('note-1'));
      });

      // Hide while fetch is pending
      act(() => {
        result.current.hide();
      });

      expect(result.current.isVisible).toBe(false);
      expect(result.current.results).toEqual([]);

      // Resolve the fetch
      await act(async () => {
        resolveBacklinks!([createMockBacklink('link-1', 'Link 1')]);
      });

      // After resolution, panel should be visible and have results
      expect(result.current.isVisible).toBe(true);
    });

    it('handles fetching for same note ID multiple times', async () => {
      const mockResults = [createMockBacklink('link-1', 'Link One')];
      mockBacklinks.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useBacklinks());
      const noteId = createNoteId('note-1');

      await act(async () => {
        await result.current.fetchForNote(noteId);
      });

      expect(result.current.results).toEqual(mockResults);

      // Fetch same note again
      await act(async () => {
        await result.current.fetchForNote(noteId);
      });

      expect(mockBacklinks).toHaveBeenCalledTimes(2);
      expect(result.current.results).toEqual(mockResults);
    });
  });
});
