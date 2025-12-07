import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { NoteId } from '@scribe/shared';

const MAX_HISTORY_LENGTH = 1000;

interface NavigationState {
  stack: NoteId[];
  currentIndex: number;
}

interface UseNavigationHistoryReturn {
  /** Whether back navigation is available */
  canGoBack: boolean;

  /** Whether forward navigation is available */
  canGoForward: boolean;

  /** Navigate to a note, adding it to history */
  navigateToNote: (noteId: NoteId) => void;

  /** Go back to previous note */
  navigateBack: () => void;

  /** Go forward to next note */
  navigateForward: () => void;

  /** Remove a deleted note from the history stack */
  removeFromHistory: (noteId: NoteId) => void;

  /** Clear all navigation history (e.g., when starting fresh navigation) */
  clearHistory: () => void;
}

/**
 * Custom React hook to manage navigation history state with dual-pointer model
 *
 * Handles:
 * - Browser-style back/forward navigation with a pointer into a history stack
 * - Truncates forward history when navigating to a new note
 * - FIFO eviction when stack exceeds MAX_HISTORY_LENGTH (1000 items)
 * - Removing deleted notes from history
 *
 * Note: History is session-only and does not persist across app restarts
 */
export function useNavigationHistory(
  currentNoteId: NoteId | null,
  loadNote: (id: NoteId) => Promise<void>
): UseNavigationHistoryReturn {
  const [state, setState] = useState<NavigationState>({
    stack: [],
    currentIndex: -1,
  });

  const canGoBack = state.currentIndex > 0;
  const canGoForward = state.currentIndex < state.stack.length - 1;

  // Track whether we've seeded the initial note to prevent re-seeding
  const hasSeededRef = useRef(false);

  /**
   * Seed the initial note into history when the app first loads.
   * This ensures the first note (loaded via useNoteState) is part of the history stack,
   * allowing proper back navigation after navigating to a second note.
   */
  useEffect(() => {
    // Only seed if:
    // 1. We have a currentNoteId (app has loaded a note)
    // 2. We haven't already seeded
    // 3. The history stack is empty (initial state)
    if (currentNoteId && !hasSeededRef.current && state.stack.length === 0) {
      hasSeededRef.current = true;
      setState({ stack: [currentNoteId], currentIndex: 0 });
    }
  }, [currentNoteId, state.stack.length]);

  /**
   * Navigate to a note, truncating forward history and adding to stack
   * No-op if navigating to the same note
   */
  const navigateToNote = useCallback(
    (noteId: NoteId) => {
      // No-op if navigating to same note
      if (noteId === currentNoteId) return;

      setState((prev) => {
        // Truncate forward history
        const newStack = prev.stack.slice(0, prev.currentIndex + 1);

        // Add new note
        newStack.push(noteId);

        // FIFO eviction if exceeds max
        let newIndex = newStack.length - 1;
        if (newStack.length > MAX_HISTORY_LENGTH) {
          newStack.shift();
          newIndex = newStack.length - 1;
        }

        return { stack: newStack, currentIndex: newIndex };
      });

      loadNote(noteId);
    },
    [currentNoteId, loadNote]
  );

  /**
   * Navigate back to the previous note in history
   * Does nothing if at the beginning of history
   */
  const navigateBack = useCallback(() => {
    if (!canGoBack) return;

    const prevNoteId = state.stack[state.currentIndex - 1];
    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex - 1,
    }));
    loadNote(prevNoteId);
  }, [canGoBack, state, loadNote]);

  /**
   * Navigate forward to the next note in history
   * Does nothing if at the end of history
   */
  const navigateForward = useCallback(() => {
    if (!canGoForward) return;

    const nextNoteId = state.stack[state.currentIndex + 1];
    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
    }));
    loadNote(nextNoteId);
  }, [canGoForward, state, loadNote]);

  /**
   * Remove a note from the history stack (e.g., when note is deleted)
   * Adjusts currentIndex to account for removed items
   */
  const removeFromHistory = useCallback((noteId: NoteId) => {
    setState((prev) => {
      const newStack: NoteId[] = [];
      let newIndex = prev.currentIndex;
      let removedBeforeCurrent = 0;

      for (let i = 0; i < prev.stack.length; i++) {
        if (prev.stack[i] !== noteId) {
          newStack.push(prev.stack[i]);
        } else if (i < prev.currentIndex) {
          removedBeforeCurrent++;
        }
      }

      newIndex = Math.max(0, newIndex - removedBeforeCurrent);
      if (newIndex >= newStack.length) {
        newIndex = newStack.length - 1;
      }

      return { stack: newStack, currentIndex: newIndex };
    });
  }, []);

  /**
   * Clear all navigation history (e.g., when starting fresh navigation)
   * Resets the stack and index to initial empty state
   */
  const clearHistory = useCallback(() => {
    setState({ stack: [], currentIndex: -1 });
  }, []);

  // Return a memoized object to ensure stable reference for consumers
  return useMemo(
    () => ({
      canGoBack,
      canGoForward,
      navigateToNote,
      navigateBack,
      navigateForward,
      removeFromHistory,
      clearHistory,
    }),
    [
      canGoBack,
      canGoForward,
      navigateToNote,
      navigateBack,
      navigateForward,
      removeFromHistory,
      clearHistory,
    ]
  );
}
