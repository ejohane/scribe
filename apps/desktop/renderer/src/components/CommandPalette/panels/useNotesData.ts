/**
 * useNotesData Hook
 *
 * Handles fetching and managing notes data for file-browse and delete-browse modes.
 */

import { useState, useEffect } from 'react';
import type { Note } from '@scribe/shared';
import { createLogger } from '@scribe/shared';

const log = createLogger({ prefix: 'useNotesData' });

export interface UseNotesDataOptions {
  /** Whether notes fetching is enabled */
  enabled: boolean;
}

export interface UseNotesDataResult {
  /** All fetched notes */
  allNotes: Note[];
  /** Whether notes are currently loading */
  isLoading: boolean;
}

/**
 * Hook for fetching notes data
 */
export function useNotesData({ enabled }: UseNotesDataOptions): UseNotesDataResult {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchNotes = async () => {
      setIsLoading(true);
      try {
        const notes = await window.scribe.notes.list();
        if (!cancelled) setAllNotes(notes);
      } catch (error) {
        if (!cancelled) {
          log.error('Failed to fetch notes', { error });
          setAllNotes([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchNotes();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { allNotes, isLoading };
}

/**
 * Hook for fetching people data
 */
export function usePeopleData({ enabled }: UseNotesDataOptions): UseNotesDataResult {
  const [allPeople] = useState<Note[]>([]);
  const [isLoading] = useState(false);

  // People feature temporarily disabled during refactor
  // The list will be empty until the feature is re-implemented as a plugin
  useEffect(() => {
    if (!enabled) return;
    // No-op: people.list() is no longer available
  }, [enabled]);

  return { allNotes: allPeople, isLoading };
}
