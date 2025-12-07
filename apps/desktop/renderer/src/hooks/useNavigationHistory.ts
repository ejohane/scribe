import { useReducer, useCallback, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { NoteId } from '@scribe/shared';

const MAX_HISTORY_LENGTH = 1000;

interface NavigationState {
  stack: NoteId[];
  currentIndex: number;
}

/** Action types for the navigation reducer */
type NavigationAction =
  | { type: 'NAVIGATE'; noteId: NoteId }
  | { type: 'BACK' }
  | { type: 'FORWARD' }
  | { type: 'REMOVE'; noteId: NoteId }
  | { type: 'CLEAR' }
  | { type: 'SEED'; noteId: NoteId };

/**
 * Pure reducer function for navigation state transitions.
 * All state logic is centralized here for testability and explicitness.
 */
function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'NAVIGATE': {
      // Truncate forward history
      const newStack = state.stack.slice(0, state.currentIndex + 1);
      // Add new note
      newStack.push(action.noteId);
      // FIFO eviction if exceeds max
      let newIndex = newStack.length - 1;
      if (newStack.length > MAX_HISTORY_LENGTH) {
        newStack.shift();
        newIndex = newStack.length - 1;
      }
      return { stack: newStack, currentIndex: newIndex };
    }

    case 'BACK': {
      if (state.currentIndex <= 0) return state;
      return { ...state, currentIndex: state.currentIndex - 1 };
    }

    case 'FORWARD': {
      if (state.currentIndex >= state.stack.length - 1) return state;
      return { ...state, currentIndex: state.currentIndex + 1 };
    }

    case 'REMOVE': {
      const newStack: NoteId[] = [];
      let newIndex = state.currentIndex;
      let removedBeforeCurrent = 0;

      for (let i = 0; i < state.stack.length; i++) {
        if (state.stack[i] !== action.noteId) {
          newStack.push(state.stack[i]);
        } else {
          if (i < state.currentIndex) {
            removedBeforeCurrent++;
          }
        }
      }

      newIndex = Math.max(0, newIndex - removedBeforeCurrent);
      if (newIndex >= newStack.length) {
        newIndex = newStack.length - 1;
      }

      return { stack: newStack, currentIndex: newIndex };
    }

    case 'CLEAR': {
      return { stack: [], currentIndex: -1 };
    }

    case 'SEED': {
      return { stack: [action.noteId], currentIndex: 0 };
    }
  }
}

interface UseNavigationHistoryReturn {
  /** Whether back navigation is available */
  canGoBack: boolean;

  /** Whether forward navigation is available */
  canGoForward: boolean;

  /** The full navigation history stack. Used by Sidebar to display navigation history with note titles. */
  historyStack: NoteId[];

  /** Current position in the history stack. Used by Sidebar to highlight the current position in history display. */
  currentIndex: number;

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
  const [state, dispatch] = useReducer(navigationReducer, {
    stack: [],
    currentIndex: -1,
  });

  const canGoBack = state.currentIndex > 0;
  const canGoForward = state.currentIndex < state.stack.length - 1;

  // Track whether we've seeded the initial note to prevent re-seeding
  const hasSeededRef = useRef(false);

  // Ref to store current state for use in callbacks that need fresh state
  // This is needed because flushSync + dispatch doesn't provide state access like setState callback
  const stateRef = useRef(state);
  stateRef.current = state;

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
      dispatch({ type: 'SEED', noteId: currentNoteId });
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

      dispatch({ type: 'NAVIGATE', noteId });
      loadNote(noteId);
    },
    [currentNoteId, loadNote]
  );

  /**
   * Navigate back to the previous note in history
   * Does nothing if at the beginning of history
   */
  const navigateBack = useCallback(() => {
    // Check if we can go back before dispatching
    const currentState = stateRef.current;
    if (currentState.currentIndex <= 0) return;

    // Get the note to load before state changes
    const noteToLoad = currentState.stack[currentState.currentIndex - 1];

    // Use flushSync to ensure dispatch completes synchronously
    // This prevents stale closure issues with rapid successive calls
    flushSync(() => {
      dispatch({ type: 'BACK' });
    });

    // loadNote is called after dispatch
    loadNote(noteToLoad);
  }, [loadNote]);

  /**
   * Navigate forward to the next note in history
   * Does nothing if at the end of history
   */
  const navigateForward = useCallback(() => {
    // Check if we can go forward before dispatching
    const currentState = stateRef.current;
    if (currentState.currentIndex >= currentState.stack.length - 1) return;

    // Get the note to load before state changes
    const noteToLoad = currentState.stack[currentState.currentIndex + 1];

    // Use flushSync to ensure dispatch completes synchronously
    // This prevents stale closure issues with rapid successive calls
    flushSync(() => {
      dispatch({ type: 'FORWARD' });
    });

    // loadNote is called after dispatch
    loadNote(noteToLoad);
  }, [loadNote]);

  /**
   * Remove a note from the history stack (e.g., when note is deleted)
   * Adjusts currentIndex to account for removed items.
   * If the current note is removed, navigates to the note at the new current position.
   */
  const removeFromHistory = useCallback(
    (noteId: NoteId) => {
      const currentState = stateRef.current;

      // Determine if current note is being removed and what the new state will be
      let removedCurrentNote = false;
      let newIndex = currentState.currentIndex;
      let removedBeforeCurrent = 0;
      const newStack: NoteId[] = [];

      for (let i = 0; i < currentState.stack.length; i++) {
        if (currentState.stack[i] !== noteId) {
          newStack.push(currentState.stack[i]);
        } else {
          if (i < currentState.currentIndex) {
            removedBeforeCurrent++;
          } else if (i === currentState.currentIndex) {
            removedCurrentNote = true;
          }
        }
      }

      newIndex = Math.max(0, newIndex - removedBeforeCurrent);
      if (newIndex >= newStack.length) {
        newIndex = newStack.length - 1;
      }

      // Use flushSync to ensure dispatch completes synchronously
      flushSync(() => {
        dispatch({ type: 'REMOVE', noteId });
      });

      // If the current note was removed and there are remaining notes,
      // navigate to the note at the new current position
      if (removedCurrentNote && newStack.length > 0) {
        loadNote(newStack[newIndex]);
      }
    },
    [loadNote]
  );

  /**
   * Clear all navigation history (e.g., when starting fresh navigation)
   * Resets the stack and index to initial empty state.
   * Note: Does not reset hasSeededRef so the initial note won't be re-seeded
   */
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  // Return a memoized object to ensure stable reference for consumers
  return useMemo(
    () => ({
      canGoBack,
      canGoForward,
      historyStack: state.stack,
      currentIndex: state.currentIndex,
      navigateToNote,
      navigateBack,
      navigateForward,
      removeFromHistory,
      clearHistory,
    }),
    [
      canGoBack,
      canGoForward,
      state.stack,
      state.currentIndex,
      navigateToNote,
      navigateBack,
      navigateForward,
      removeFromHistory,
      clearHistory,
    ]
  );
}
