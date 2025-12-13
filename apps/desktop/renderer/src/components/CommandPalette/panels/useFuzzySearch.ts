/**
 * useFuzzySearch Hook
 *
 * Shared hook for fuzzy search functionality using Fuse.js.
 * Used by FileBrowsePanel, DeleteBrowsePanel, and PersonBrowsePanel.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { Note, NoteId } from '@scribe/shared';
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
