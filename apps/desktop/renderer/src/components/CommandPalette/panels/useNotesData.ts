/**
 * useNotesData Hook
 *
 * Handles fetching and managing notes data for file-browse and delete-browse modes.
 */

import { useState, useEffect } from 'react';
import type { Note } from '@scribe/shared';

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
          console.error('Failed to fetch notes:', error);
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
  const [allPeople, setAllPeople] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchPeople = async () => {
      setIsLoading(true);
      try {
        const people = await window.scribe.people.list();
        if (!cancelled) setAllPeople(people);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch people:', error);
          setAllPeople([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPeople();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { allNotes: allPeople, isLoading };
}
