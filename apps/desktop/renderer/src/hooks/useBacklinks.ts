import { useState, useCallback, useMemo } from 'react';
import type { GraphNode, NoteId } from '@scribe/shared';

interface UseBacklinksReturn {
  /** Backlink results for the current note */
  results: GraphNode[];
  /** Whether the backlinks panel is visible */
  isVisible: boolean;
  /** Show the backlinks panel */
  show: () => void;
  /** Hide the backlinks panel and clear results */
  hide: () => void;
  /** Fetch backlinks for a specific note */
  fetchForNote: (noteId: NoteId) => Promise<void>;
}

/**
 * Custom hook for managing backlinks panel state
 *
 * Provides:
 * - Backlink results storage
 * - Visibility toggle
 * - Fetch backlinks for a note via IPC
 */
export function useBacklinks(): UseBacklinksReturn {
  const [results, setResults] = useState<GraphNode[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const show = useCallback(() => {
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
    setResults([]);
  }, []);

  const fetchForNote = useCallback(async (noteId: NoteId) => {
    try {
      const backlinks = await window.scribe.graph.backlinks(noteId);
      setResults(backlinks);
      setIsVisible(true);
    } catch (error) {
      console.error('Failed to fetch backlinks:', error);
    }
  }, []);

  return useMemo(
    () => ({
      results,
      isVisible,
      show,
      hide,
      fetchForNote,
    }),
    [results, isVisible, show, hide, fetchForNote]
  );
}
