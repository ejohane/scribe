/**
 * useInitialNote Hook
 *
 * Handles loading a note from URL query parameters when a new window
 * is opened with a specific note (via context menu or deep link).
 *
 * This enables multi-window support where each window can display
 * a different note based on URL parameters.
 *
 * @module hooks/useInitialNote
 */

import { useEffect } from 'react';
import type { NoteId } from '@scribe/shared';
import { createNoteId, logger } from '@scribe/shared';

const log = logger.child('useInitialNote');

/**
 * Hook that checks for a noteId URL parameter and loads the corresponding note.
 *
 * When a window is opened with ?noteId=<id>, this hook will:
 * 1. Parse the noteId from the URL
 * 2. Load the note via the provided loadNote function
 * 3. Clean up the URL for aesthetics
 *
 * @param loadNote - Function to load a note by ID (typically from useNoteState)
 *
 * @example
 * ```typescript
 * function App() {
 *   const noteState = useNoteState();
 *   useInitialNote(noteState.loadNote);
 *   // ...
 * }
 * ```
 */
export function useInitialNote(loadNote: (id: NoteId) => Promise<void>): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const noteIdParam = params.get('noteId');

    if (noteIdParam) {
      log.info('Loading initial note from URL parameter', { noteId: noteIdParam });

      // Load the requested note
      loadNote(createNoteId(noteIdParam)).catch((err) => {
        log.error('Failed to load initial note', { noteId: noteIdParam, error: err });
        // Note doesn't exist - renderer will show error or fallback
      });

      // Clean URL for aesthetics (optional)
      if (window.history?.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [loadNote]);
}
