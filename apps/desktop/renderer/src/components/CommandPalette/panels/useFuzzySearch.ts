/**
 * useFuzzySearch Hook
 *
 * Shared hook for fuzzy search functionality using Fuse.js.
 * Used by FileBrowsePanel, DeleteBrowsePanel, and PersonBrowsePanel.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import type { Note, NoteId, RecentOpenRecord } from '@scribe/shared';
import { MAX_SEARCH_RESULTS, SEARCH_DEBOUNCE_MS } from '../config';

export interface UseFuzzySearchOptions<T> {
  /** Items to search through */
  items: T[];
  /** Query string to search for */
  query: string;
  /** Keys to search within the items */
  keys: string[];
  /** Optional ID to exclude from results */
  excludeId?: NoteId | null;
  /** Whether the search is enabled (for mode-specific activation) */
  enabled?: boolean;
  /** Fuse.js threshold (0.0 = exact, 1.0 = match anything) */
  threshold?: number;
}

export interface UseFuzzySearchResult<T> {
  /** Debounced query value */
  debouncedQuery: string;
  /** Search results (empty array if no query or query is whitespace) */
  results: T[];
  /** Whether we have no results for a non-empty query */
  hasNoResults: boolean;
}

/**
 * Hook for performing debounced fuzzy search with Fuse.js
 */
export function useFuzzySearch<T extends { id: NoteId; title?: string | null }>({
  items,
  query,
  keys,
  excludeId,
  enabled = true,
  threshold = 0.4,
}: UseFuzzySearchOptions<T>): UseFuzzySearchResult<T> {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);

  // Memoize keys by value to prevent infinite rerenders when callers pass inline arrays
  const keysRef = useRef(keys);
  if (keys.length !== keysRef.current.length || keys.some((k, i) => k !== keysRef.current[i])) {
    keysRef.current = keys;
  }
  const stableKeys = keysRef.current;

  // Build Fuse.js index, excluding specified ID and items without titles
  const fuseIndex = useMemo(() => {
    const searchableItems = items.filter((item) => item.id !== excludeId && item.title);
    return new Fuse(searchableItems, {
      keys: stableKeys,
      threshold,
      ignoreLocation: true,
      isCaseSensitive: false,
    });
  }, [items, excludeId, stableKeys, threshold]);

  // Debounce the query
  useEffect(() => {
    if (!enabled) {
      setDebouncedQuery('');
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, enabled]);

  // Perform fuzzy search when debounced query changes
  useEffect(() => {
    if (!enabled) {
      setResults([]);
      return;
    }

    if (debouncedQuery.trim() === '') {
      setResults([]);
      return;
    }

    const searchResults = fuseIndex.search(debouncedQuery, { limit: MAX_SEARCH_RESULTS });
    setResults(searchResults.map((result) => result.item));
  }, [debouncedQuery, fuseIndex, enabled]);

  const hasNoResults = enabled && debouncedQuery.trim() !== '' && results.length === 0;

  return {
    debouncedQuery,
    results,
    hasNoResults,
  };
}

/**
 * Hook for computing recent notes (for file-browse initial state)
 */
export function useRecentNotes(
  allNotes: Note[],
  currentNoteId: NoteId | null | undefined,
  maxNotes: number
): Note[] {
  return useMemo(
    () =>
      allNotes
        .filter((note) => note.id !== currentNoteId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, maxNotes),
    [allNotes, currentNoteId, maxNotes]
  );
}

interface UseRecentOpensOptions {
  allNotes: Note[];
  currentNoteId?: string | null;
  limit?: number;
}

interface UseRecentOpensResult {
  recentItems: Note[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook to fetch recently opened items across all entity types.
 * Replaces the old useRecentNotes which sorted by updatedAt.
 *
 * @param allNotes - All notes loaded in the vault
 * @param currentNoteId - ID of current note to exclude from results
 * @param limit - Maximum number of items to fetch (default: 10)
 */
export function useRecentOpens({
  allNotes,
  currentNoteId,
  limit = 10,
}: UseRecentOpensOptions): UseRecentOpensResult {
  const [recentRecords, setRecentRecords] = useState<RecentOpenRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch recent open records from backend
  useEffect(() => {
    let cancelled = false;

    async function fetchRecent() {
      try {
        setIsLoading(true);
        setError(null);
        const records = await window.scribe.recentOpens.getRecent(limit);
        if (!cancelled) {
          setRecentRecords(records);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch recent opens'));
          setRecentRecords([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchRecent();
    return () => {
      cancelled = true;
    };
  }, [limit, refreshKey]);

  // Create a lookup map for O(1) note access
  const notesById = useMemo(() => {
    const map = new Map<string, Note>();
    for (const note of allNotes) {
      map.set(note.id, note);
    }
    return map;
  }, [allNotes]);

  // Enrich records with note data, filter orphans and current note
  const recentItems = useMemo(() => {
    return recentRecords
      .map((record) => notesById.get(record.entityId))
      .filter((note): note is Note => {
        return note !== undefined && note.id !== currentNoteId;
      });
  }, [recentRecords, notesById, currentNoteId]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { recentItems, isLoading, error, refresh };
}
