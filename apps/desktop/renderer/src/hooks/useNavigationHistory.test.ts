import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigationHistory } from './useNavigationHistory';

describe('useNavigationHistory', () => {
  const mockLoadNote = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockLoadNote.mockClear();
  });

  describe('initial state', () => {
    it('starts with empty history', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      expect(result.current.history).toEqual([]);
    });

    it('canGoBack is false initially', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      expect(result.current.canGoBack).toBe(false);
    });
  });

  describe('navigateToNote', () => {
    it('adds current note to history when addToHistory=true', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-2', true);
      });

      expect(result.current.history).toEqual(['note-1']);
      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('adds current note to history by default (addToHistory defaults to true)', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-2');
      });

      expect(result.current.history).toEqual(['note-1']);
      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('does not add to history when addToHistory=false', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-2', false);
      });

      expect(result.current.history).toEqual([]);
      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('does not add null currentNoteId to history', () => {
      const { result } = renderHook(() => useNavigationHistory(null, mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-2', true);
      });

      expect(result.current.history).toEqual([]);
      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('builds up history stack with multiple navigations', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to note-2
      act(() => {
        result.current.navigateToNote('note-2', true);
      });
      rerender({ currentNoteId: 'note-2' });

      // Navigate to note-3
      act(() => {
        result.current.navigateToNote('note-3', true);
      });
      rerender({ currentNoteId: 'note-3' });

      // Navigate to note-4
      act(() => {
        result.current.navigateToNote('note-4', true);
      });

      expect(result.current.history).toEqual(['note-1', 'note-2', 'note-3']);
    });
  });

  describe('navigateBack', () => {
    it('pops last item from history and loads it', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to note-2
      act(() => {
        result.current.navigateToNote('note-2', true);
      });

      // Simulate note-2 being loaded (update currentNoteId)
      rerender({ currentNoteId: 'note-2' });

      // Navigate back
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenLastCalledWith('note-1');
      expect(result.current.history).toEqual([]);
    });

    it('does nothing when history is empty', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      mockLoadNote.mockClear();

      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).not.toHaveBeenCalled();
      expect(result.current.history).toEqual([]);
    });

    it('canGoBack updates after pop', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to note-2
      act(() => {
        result.current.navigateToNote('note-2', true);
      });
      rerender({ currentNoteId: 'note-2' });

      expect(result.current.canGoBack).toBe(true);

      // Navigate back
      act(() => {
        result.current.navigateBack();
      });

      expect(result.current.canGoBack).toBe(false);
    });

    it('pops items in LIFO order', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build up history: note-1 -> note-2 -> note-3
      act(() => {
        result.current.navigateToNote('note-2', true);
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3', true);
      });
      rerender({ currentNoteId: 'note-3' });

      // History should be ['note-1', 'note-2']
      expect(result.current.history).toEqual(['note-1', 'note-2']);

      // Navigate back - should go to note-2
      act(() => {
        result.current.navigateBack();
      });
      expect(mockLoadNote).toHaveBeenLastCalledWith('note-2');
      expect(result.current.history).toEqual(['note-1']);

      // Navigate back again - should go to note-1
      act(() => {
        result.current.navigateBack();
      });
      expect(mockLoadNote).toHaveBeenLastCalledWith('note-1');
      expect(result.current.history).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('empties the history array', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Add some history
      act(() => {
        result.current.navigateToNote('note-2', true);
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3', true);
      });

      expect(result.current.history.length).toBeGreaterThan(0);

      // Clear it
      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.history).toEqual([]);
    });

    it('canGoBack becomes false after clearing', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      // Add some history
      act(() => {
        result.current.navigateToNote('note-2', true);
      });

      expect(result.current.canGoBack).toBe(true);

      // Clear it
      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.canGoBack).toBe(false);
    });

    it('does nothing when history is already empty', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      expect(result.current.history).toEqual([]);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.history).toEqual([]);
      expect(result.current.canGoBack).toBe(false);
    });
  });

  describe('canGoBack', () => {
    it('returns true when history has items', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-2', true);
      });

      expect(result.current.canGoBack).toBe(true);
    });

    it('returns false when history is empty', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      expect(result.current.canGoBack).toBe(false);
    });

    it('updates reactively when history changes', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Initially false
      expect(result.current.canGoBack).toBe(false);

      // Add to history
      act(() => {
        result.current.navigateToNote('note-2', true);
      });
      expect(result.current.canGoBack).toBe(true);

      rerender({ currentNoteId: 'note-2' });

      // Add more to history
      act(() => {
        result.current.navigateToNote('note-3', true);
      });
      expect(result.current.canGoBack).toBe(true);

      rerender({ currentNoteId: 'note-3' });

      // Go back
      act(() => {
        result.current.navigateBack();
      });
      expect(result.current.canGoBack).toBe(true); // Still has note-1

      // Go back again
      act(() => {
        result.current.navigateBack();
      });
      expect(result.current.canGoBack).toBe(false); // Now empty
    });
  });

  describe('return value stability', () => {
    it('returns memoized object when dependencies do not change', () => {
      const { result, rerender } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      const firstReturn = result.current;

      // Rerender without changes
      rerender();

      // The object reference should be stable due to useMemo
      expect(result.current).toBe(firstReturn);
    });
  });
});
