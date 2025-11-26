import { useState, useCallback, useMemo } from 'react';
import type { NoteId } from '@scribe/shared';

interface UseNavigationHistoryReturn {
  /** Stack of previously visited note IDs */
  history: NoteId[];

  /** Whether back navigation is available */
  canGoBack: boolean;

  /** Navigate to a note, optionally adding current to history */
  navigateToNote: (noteId: NoteId, addToHistory?: boolean) => void;

  /** Go back to previous note */
  navigateBack: () => void;

  /** Clear all history (used on fresh navigation) */
  clearHistory: () => void;
}

/**
 * Custom React hook to manage navigation history state
 *
 * Handles:
 * - Tracking previously visited notes in a stack (LIFO)
 * - Back navigation to previous notes
 * - Clearing history on fresh navigation (command palette, new note)
 *
 * Note: History is session-only and does not persist across app restarts
 */
export function useNavigationHistory(
  currentNoteId: NoteId | null,
  loadNote: (id: NoteId) => Promise<void>
): UseNavigationHistoryReturn {
  const [history, setHistory] = useState<NoteId[]>([]);

  const canGoBack = history.length > 0;

  /**
   * Navigate to a note, optionally adding the current note to history
   *
   * @param noteId - The note to navigate to
   * @param addToHistory - Whether to add current note to history (default: true)
   */
  const navigateToNote = useCallback(
    (noteId: NoteId, addToHistory = true) => {
      if (addToHistory && currentNoteId) {
        setHistory((prev) => [...prev, currentNoteId]);
      }
      loadNote(noteId);
    },
    [currentNoteId, loadNote]
  );

  /**
   * Navigate back to the previous note in history
   * Does nothing if history is empty
   */
  const navigateBack = useCallback(() => {
    if (history.length === 0) return;

    const newHistory = [...history];
    const prevNoteId = newHistory.pop()!;
    setHistory(newHistory);
    loadNote(prevNoteId);
  }, [history, loadNote]);

  /**
   * Clear all navigation history
   * Used when navigating via command palette or creating a new note
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Return a memoized object to ensure stable reference for consumers
  return useMemo(
    () => ({
      history,
      canGoBack,
      navigateToNote,
      navigateBack,
      clearHistory,
    }),
    [history, canGoBack, navigateToNote, navigateBack, clearHistory]
  );
}
