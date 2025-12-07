import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigationHistory } from './useNavigationHistory';

describe('useNavigationHistory', () => {
  const mockLoadNote = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockLoadNote.mockClear();
  });

  describe('initial state', () => {
    it('canGoBack is false initially', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      expect(result.current.canGoBack).toBe(false);
    });

    it('canGoForward is false initially', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      expect(result.current.canGoForward).toBe(false);
    });

    it('works with null currentNoteId', () => {
      const { result } = renderHook(() => useNavigationHistory(null, mockLoadNote));

      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });

    it('seeds initial note into history when currentNoteId is provided', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Initial note is seeded: [note-1] at index 0
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);

      // Navigate to note-2
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      // Now we have [note-1, note-2] at index 1
      expect(result.current.canGoBack).toBe(true);

      // Go back should return to note-1
      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateBack();
      });
      expect(mockLoadNote).toHaveBeenCalledWith('note-1');
    });

    it('history starts empty when currentNoteId is null', () => {
      const { result } = renderHook(() => useNavigationHistory(null, mockLoadNote));

      // Both should be false since history is empty (no initial note to seed)
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);

      // Attempting to go back/forward should do nothing
      act(() => {
        result.current.navigateBack();
      });
      expect(mockLoadNote).not.toHaveBeenCalled();

      act(() => {
        result.current.navigateForward();
      });
      expect(mockLoadNote).not.toHaveBeenCalled();
    });
  });

  describe('navigateToNote', () => {
    it('loads the target note', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-2');
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('no-op when navigating to the same note', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      act(() => {
        result.current.navigateToNote('note-1');
      });

      expect(mockLoadNote).not.toHaveBeenCalled();
      expect(result.current.canGoBack).toBe(false);
    });

    it('enables canGoBack after first navigation', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Initial note is seeded into history: [note-1] at index 0
      expect(result.current.canGoBack).toBe(false);

      // Navigate to note-2
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      // Now we have [note-1, note-2] at index 1, so canGoBack is true
      expect(result.current.canGoBack).toBe(true);
    });

    it('truncates forward history when navigating from middle of stack', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build up history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Go back twice (to note-2)
      act(() => {
        result.current.navigateBack();
      });
      act(() => {
        result.current.navigateBack();
      });
      rerender({ currentNoteId: 'note-2' });

      expect(result.current.canGoForward).toBe(true);

      // Navigate to note-5 - should truncate note-3 and note-4
      act(() => {
        result.current.navigateToNote('note-5');
      });
      rerender({ currentNoteId: 'note-5' });

      expect(result.current.canGoForward).toBe(false);
      expect(result.current.canGoBack).toBe(true);
    });
  });

  describe('navigateBack', () => {
    it('loads the previous note', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to build history
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      mockLoadNote.mockClear();

      // Navigate back
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('does nothing when canGoBack is false', () => {
      // Start with null so no initial note is seeded
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: null as string | null } }
      );

      // Navigate once to have a single item (starting from null)
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      // Only [note-2] in history, so canGoBack is false
      expect(result.current.canGoBack).toBe(false);

      mockLoadNote.mockClear();

      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).not.toHaveBeenCalled();
    });

    it('enables canGoForward after going back', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to build history
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      expect(result.current.canGoForward).toBe(false);

      // Navigate back
      act(() => {
        result.current.navigateBack();
      });

      expect(result.current.canGoForward).toBe(true);
    });
  });

  describe('navigateForward', () => {
    it('loads the next note', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to build history
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      // Go back
      act(() => {
        result.current.navigateBack();
      });
      rerender({ currentNoteId: 'note-2' });

      mockLoadNote.mockClear();

      // Navigate forward
      act(() => {
        result.current.navigateForward();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-3');
    });

    it('does nothing when canGoForward is false', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate once
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      expect(result.current.canGoForward).toBe(false);

      mockLoadNote.mockClear();

      act(() => {
        result.current.navigateForward();
      });

      expect(mockLoadNote).not.toHaveBeenCalled();
    });

    it('disables canGoForward when at end of history', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Navigate to build history
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      // Go back
      act(() => {
        result.current.navigateBack();
      });

      expect(result.current.canGoForward).toBe(true);

      // Go forward
      act(() => {
        result.current.navigateForward();
      });

      expect(result.current.canGoForward).toBe(false);
    });
  });

  describe('removeFromHistory', () => {
    it('removes a note from history', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Stack is now [note-2, note-3, note-4], index = 2
      // Remove note-3
      act(() => {
        result.current.removeFromHistory('note-3');
      });

      // Stack should be [note-2, note-4], index should still point to note-4
      // Go back should take us to note-2
      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('adjusts currentIndex when removing notes before current position', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Stack is now [note-2, note-3, note-4], index = 2
      // Remove note-2 (before current)
      act(() => {
        result.current.removeFromHistory('note-2');
      });

      // Stack should be [note-3, note-4], index should be 1
      // canGoBack should still be true
      expect(result.current.canGoBack).toBe(true);

      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-3');
    });

    it('handles removing the last item in history', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      // Stack is now [note-2], index = 0
      // Remove note-2
      act(() => {
        result.current.removeFromHistory('note-2');
      });

      // Stack should be empty
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });

    it('removes multiple occurrences of the same note', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history with duplicate: note-2 -> note-3 -> note-2 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Stack is [note-2, note-3, note-2, note-4], index = 3
      // Remove note-2
      act(() => {
        result.current.removeFromHistory('note-2');
      });

      // Stack should be [note-3, note-4], index should be adjusted to 1
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false);

      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-3');
    });

    it('handles removing a note that does not exist in history', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2 -> note-3
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      // Remove a note that doesn't exist
      act(() => {
        result.current.removeFromHistory('note-999');
      });

      // History should be unchanged
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false);

      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('handles removing notes after current position', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Initial note-1 is seeded: [note-1] at index 0
      // Build history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Stack is now [note-1, note-2, note-3, note-4], index = 3
      // Go back to note-2 (index 1)
      act(() => {
        result.current.navigateBack();
      });
      act(() => {
        result.current.navigateBack();
      });
      rerender({ currentNoteId: 'note-2' });

      expect(result.current.canGoForward).toBe(true);
      expect(result.current.canGoBack).toBe(true); // Can go back to note-1

      // Remove note-4 (after current position)
      act(() => {
        result.current.removeFromHistory('note-4');
      });

      // Stack is now [note-1, note-2, note-3], index = 1
      // Can still go forward to note-3
      expect(result.current.canGoForward).toBe(true);
      expect(result.current.canGoBack).toBe(true); // Can still go back to note-1

      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateForward();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-3');
    });

    it('adjusts index when removing current position in the middle', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Go back to note-3 (index 1)
      act(() => {
        result.current.navigateBack();
      });
      rerender({ currentNoteId: 'note-3' });

      // Stack is [note-2, note-3, note-4], index = 1
      // Remove note-3 (current position)
      act(() => {
        result.current.removeFromHistory('note-3');
      });

      // Stack should be [note-2, note-4], index should clamp to 1
      // We should be able to go back to note-2
      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(false);

      mockLoadNote.mockClear();
      act(() => {
        result.current.navigateBack();
      });

      expect(mockLoadNote).toHaveBeenCalledWith('note-2');
    });

    it('handles removing from empty history', () => {
      const { result } = renderHook(() => useNavigationHistory('note-1', mockLoadNote));

      // Try to remove from empty history - should not throw
      act(() => {
        result.current.removeFromHistory('note-1');
      });

      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });
  });

  describe('FIFO eviction', () => {
    it('evicts oldest item when exceeding max history length', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-0' as string | null } }
      );

      // Add 1001 notes to trigger FIFO eviction
      for (let i = 1; i <= 1001; i++) {
        act(() => {
          result.current.navigateToNote(`note-${i}`);
        });
        rerender({ currentNoteId: `note-${i}` });
      }

      // Can still go back (we should have 1000 items now after eviction)
      expect(result.current.canGoBack).toBe(true);

      // Going back repeatedly should eventually reach note-2 (not note-1, which was evicted)
      let backCount = 0;
      while (result.current.canGoBack && backCount < 1010) {
        act(() => {
          result.current.navigateBack();
        });
        backCount++;
      }

      // Should have gone back 999 times (from index 999 to index 0)
      expect(backCount).toBe(999);
      expect(mockLoadNote).toHaveBeenLastCalledWith('note-2');
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

  describe('edge cases', () => {
    describe('single item history', () => {
      it('cannot go back with single item', () => {
        // Start from null so only one item gets added
        const { result, rerender } = renderHook(
          ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
          { initialProps: { currentNoteId: null as string | null } }
        );

        act(() => {
          result.current.navigateToNote('note-2');
        });
        rerender({ currentNoteId: 'note-2' });

        // Only [note-2] in stack
        expect(result.current.canGoBack).toBe(false);
        expect(result.current.canGoForward).toBe(false);
      });

      it('removes single item leaving empty history', () => {
        // Start from null so only one item gets added
        const { result, rerender } = renderHook(
          ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
          { initialProps: { currentNoteId: null as string | null } }
        );

        act(() => {
          result.current.navigateToNote('note-2');
        });
        rerender({ currentNoteId: 'note-2' });

        act(() => {
          result.current.removeFromHistory('note-2');
        });

        expect(result.current.canGoBack).toBe(false);
        expect(result.current.canGoForward).toBe(false);
      });
    });

    describe('boundary operations', () => {
      it('cannot go back at start of history', () => {
        const { result, rerender } = renderHook(
          ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
          { initialProps: { currentNoteId: 'note-1' as string | null } }
        );

        // Initial: [note-1] at index 0
        // Build history
        act(() => {
          result.current.navigateToNote('note-2');
        });
        rerender({ currentNoteId: 'note-2' });

        act(() => {
          result.current.navigateToNote('note-3');
        });
        rerender({ currentNoteId: 'note-3' });

        // Stack is [note-1, note-2, note-3] at index 2
        // Go back to start (note-1)
        act(() => {
          result.current.navigateBack();
        });
        act(() => {
          result.current.navigateBack();
        });

        expect(result.current.canGoBack).toBe(false);

        mockLoadNote.mockClear();

        // Try to go back again - should be no-op
        act(() => {
          result.current.navigateBack();
        });

        expect(mockLoadNote).not.toHaveBeenCalled();
      });

      it('cannot go forward at end of history', () => {
        const { result, rerender } = renderHook(
          ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
          { initialProps: { currentNoteId: 'note-1' as string | null } }
        );

        // Build history
        act(() => {
          result.current.navigateToNote('note-2');
        });
        rerender({ currentNoteId: 'note-2' });

        act(() => {
          result.current.navigateToNote('note-3');
        });
        rerender({ currentNoteId: 'note-3' });

        expect(result.current.canGoForward).toBe(false);

        mockLoadNote.mockClear();

        // Try to go forward - should be no-op
        act(() => {
          result.current.navigateForward();
        });

        expect(mockLoadNote).not.toHaveBeenCalled();
      });

      it('multiple back/forward navigations work correctly', () => {
        const { result, rerender } = renderHook(
          ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
          { initialProps: { currentNoteId: 'note-1' as string | null } }
        );

        // Initial: [note-1] at index 0
        // Build history: note-2 -> note-3 -> note-4 -> note-5
        for (let i = 2; i <= 5; i++) {
          act(() => {
            result.current.navigateToNote(`note-${i}`);
          });
          rerender({ currentNoteId: `note-${i}` });
        }

        // Stack is [note-1, note-2, note-3, note-4, note-5] at index 4
        mockLoadNote.mockClear();

        // Go back 4 times (to note-1)
        for (let i = 0; i < 4; i++) {
          act(() => {
            result.current.navigateBack();
          });
        }

        expect(result.current.canGoBack).toBe(false);
        expect(result.current.canGoForward).toBe(true);
        expect(mockLoadNote).toHaveBeenLastCalledWith('note-1');

        mockLoadNote.mockClear();

        // Go forward 2 times (to note-3)
        for (let i = 0; i < 2; i++) {
          act(() => {
            result.current.navigateForward();
          });
        }

        expect(result.current.canGoBack).toBe(true);
        expect(result.current.canGoForward).toBe(true);
        expect(mockLoadNote).toHaveBeenLastCalledWith('note-3');
      });
    });

    describe('navigating from null currentNoteId', () => {
      it('allows navigation when currentNoteId is null', () => {
        const { result } = renderHook(() => useNavigationHistory(null, mockLoadNote));

        act(() => {
          result.current.navigateToNote('note-1');
        });

        expect(mockLoadNote).toHaveBeenCalledWith('note-1');
      });

      it('builds history correctly starting from null', () => {
        const { result, rerender } = renderHook(
          ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
          { initialProps: { currentNoteId: null as string | null } }
        );

        act(() => {
          result.current.navigateToNote('note-1');
        });
        rerender({ currentNoteId: 'note-1' });

        act(() => {
          result.current.navigateToNote('note-2');
        });
        rerender({ currentNoteId: 'note-2' });

        expect(result.current.canGoBack).toBe(true);
        expect(result.current.canGoForward).toBe(false);

        mockLoadNote.mockClear();
        act(() => {
          result.current.navigateBack();
        });

        expect(mockLoadNote).toHaveBeenCalledWith('note-1');
      });
    });
  });

  describe('clearHistory', () => {
    it('clears all history items', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Verify we have history
      expect(result.current.canGoBack).toBe(true);

      // Clear all history
      act(() => {
        result.current.clearHistory();
      });

      // Verify history is empty
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });

    it('clears history including forward items', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history: note-2 -> note-3 -> note-4
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Go back to have forward items
      act(() => {
        result.current.navigateBack();
      });
      rerender({ currentNoteId: 'note-3' });

      expect(result.current.canGoBack).toBe(true);
      expect(result.current.canGoForward).toBe(true);

      // Clear all history
      act(() => {
        result.current.clearHistory();
      });

      // Both back and forward should be disabled
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });

    it('allows new navigation after clearing history', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      // Clear history
      act(() => {
        result.current.clearHistory();
      });

      mockLoadNote.mockClear();

      // Navigate to a new note
      act(() => {
        result.current.navigateToNote('note-3');
      });
      rerender({ currentNoteId: 'note-3' });

      expect(mockLoadNote).toHaveBeenCalledWith('note-3');

      // After first navigation post-clear, can't go back yet (only one item)
      expect(result.current.canGoBack).toBe(false);

      // Navigate again
      act(() => {
        result.current.navigateToNote('note-4');
      });
      rerender({ currentNoteId: 'note-4' });

      // Now we should be able to go back
      expect(result.current.canGoBack).toBe(true);
    });

    it('is idempotent - calling multiple times has same effect', () => {
      const { result, rerender } = renderHook(
        ({ currentNoteId }) => useNavigationHistory(currentNoteId, mockLoadNote),
        { initialProps: { currentNoteId: 'note-1' as string | null } }
      );

      // Build history
      act(() => {
        result.current.navigateToNote('note-2');
      });
      rerender({ currentNoteId: 'note-2' });

      // Clear multiple times
      act(() => {
        result.current.clearHistory();
        result.current.clearHistory();
        result.current.clearHistory();
      });

      // Should still work correctly
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
    });
  });
});
