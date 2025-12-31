/**
 * useDeepLink Hook
 *
 * Subscribes to deep link events and triggers navigation/actions
 * based on the received scribe:// URLs.
 *
 * @module hooks/useDeepLink
 */

import { useEffect, useCallback } from 'react';
import type { DeepLinkAction, NoteId } from '@scribe/shared';

export interface UseDeepLinkOptions {
  /**
   * Navigate to a specific note by ID.
   */
  navigateToNote: (noteId: NoteId) => void;

  /**
   * Navigate to a daily note for a specific date.
   * If no date is provided, navigates to today's daily note.
   */
  navigateToDaily: (date?: Date) => Promise<void>;

  /**
   * Open the command palette in search mode with a query.
   */
  openSearch: (query: string) => void;

  /**
   * Show a toast notification for errors.
   */
  showError: (message: string) => void;
}

/**
 * Hook that subscribes to deep link events and handles navigation.
 *
 * Supported deep link patterns:
 * - scribe://note/{noteId} - Navigate to specific note
 * - scribe://daily - Open today's daily note
 * - scribe://daily/{YYYY-MM-DD} - Open daily note for specific date
 * - scribe://search?q={query} - Open search with query
 *
 * @param options - Callbacks for handling different deep link actions
 */
export function useDeepLink(options: UseDeepLinkOptions): void {
  const { navigateToNote, navigateToDaily, openSearch, showError } = options;

  const handleDeepLink = useCallback(
    async (action: DeepLinkAction) => {
      console.log('[DeepLink] Received action:', action);

      switch (action.type) {
        case 'note':
          // Navigate to the specified note
          navigateToNote(action.noteId as NoteId);
          break;

        case 'daily':
          // Navigate to daily note (today or specific date)
          try {
            if (action.date) {
              // Parse the date string (YYYY-MM-DD format)
              const [year, month, day] = action.date.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              await navigateToDaily(date);
            } else {
              await navigateToDaily();
            }
          } catch (error) {
            console.error('[DeepLink] Failed to navigate to daily note:', error);
            showError('Failed to open daily note');
          }
          break;

        case 'search':
          // Open search with the provided query
          openSearch(action.query);
          break;

        case 'unknown':
          console.warn('[DeepLink] Unknown deep link URL:', action.url);
          showError(`Unknown deep link: ${action.url}`);
          break;
      }
    },
    [navigateToNote, navigateToDaily, openSearch, showError]
  );

  useEffect(() => {
    // Subscribe to deep link events from the main process
    const unsubscribe = window.scribe.deepLink.onDeepLink(handleDeepLink);

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [handleDeepLink]);
}
