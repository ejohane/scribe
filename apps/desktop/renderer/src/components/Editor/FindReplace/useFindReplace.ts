/**
 * useFindReplace Hook
 *
 * Provides in-editor find functionality with:
 * - Case-insensitive search
 * - Match highlighting using MarkNode
 * - Navigation between matches with wrap-around
 * - Active match scrolling into view
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $setSelection, $createRangeSelection } from 'lexical';
import { $isMarkNode, $unwrapMarkNode, $wrapSelectionInMarkNode, MarkNode } from '@lexical/mark';
import { $rootTextContent, $findTextIntersectionFromCharacters } from '@lexical/text';
import type { FindReplaceState, SearchMatch } from './types';
import { SEARCH_MATCH_ID, SEARCH_MATCH_ACTIVE_ID, SEARCH_DEBOUNCE_MS } from './types';

/**
 * Find all occurrences of a search term in text (case-insensitive)
 */
function findAllMatches(
  text: string,
  searchTerm: string
): Array<{ offset: number; length: number }> {
  if (!searchTerm) return [];

  const matches: Array<{ offset: number; length: number }> = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  let startIndex = 0;

  while (startIndex < lowerText.length) {
    const index = lowerText.indexOf(lowerTerm, startIndex);
    if (index === -1) break;

    matches.push({
      offset: index,
      length: searchTerm.length,
    });
    startIndex = index + 1; // Allow overlapping matches
  }

  return matches;
}

/**
 * Remove all search highlight marks from the editor
 */
function clearAllMarks(editor: ReturnType<typeof useLexicalComposerContext>[0]): void {
  editor.update(
    () => {
      const root = $getRoot();
      const marks = root.getAllTextNodes().flatMap((textNode) => {
        const parent = textNode.getParent();
        if ($isMarkNode(parent)) {
          const ids = parent.getIDs();
          if (ids.includes(SEARCH_MATCH_ID) || ids.includes(SEARCH_MATCH_ACTIVE_ID)) {
            return [parent];
          }
        }
        return [];
      });

      // Unwrap all search marks
      for (const mark of marks) {
        $unwrapMarkNode(mark);
      }
    },
    { discrete: true }
  );
}

/**
 * Hook providing find/replace functionality for the Lexical editor
 */
export function useFindReplace(): FindReplaceState {
  const [editor] = useLexicalComposerContext();
  const [query, setQueryState] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the actual search query (after debounce)
  const [debouncedQuery, setDebouncedQuery] = useState('');

  /**
   * Set query with debouncing
   */
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!newQuery.trim()) {
      // Immediately clear if empty
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(newQuery);
      setIsSearching(false);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  /**
   * Perform the search and apply highlights
   */
  useEffect(() => {
    // Clear existing marks first
    clearAllMarks(editor);

    if (!debouncedQuery.trim()) {
      setMatches([]);
      setActiveIndex(0);
      return;
    }

    editor.update(
      () => {
        const text = $rootTextContent();
        const rawMatches = findAllMatches(text, debouncedQuery);

        if (rawMatches.length === 0) {
          setMatches([]);
          setActiveIndex(0);
          return;
        }

        // Create SearchMatch objects with IDs
        const searchMatches: SearchMatch[] = rawMatches.map((m, i) => ({
          id: `match-${i}`,
          offset: m.offset,
          length: m.length,
          text: text.slice(m.offset, m.offset + m.length),
        }));

        // Apply marks in reverse order to preserve offsets
        for (let i = rawMatches.length - 1; i >= 0; i--) {
          const match = rawMatches[i];
          const matchId = i === 0 ? SEARCH_MATCH_ACTIVE_ID : SEARCH_MATCH_ID;

          // Find the text nodes that intersect with this match
          const startResult = $findTextIntersectionFromCharacters($getRoot(), match.offset);

          if (!startResult) continue;

          const endResult = $findTextIntersectionFromCharacters(
            $getRoot(),
            match.offset + match.length
          );

          if (!endResult) continue;

          // Create a selection for this match
          const selection = $createRangeSelection();
          selection.anchor.set(startResult.node.getKey(), startResult.offset, 'text');
          selection.focus.set(endResult.node.getKey(), endResult.offset, 'text');

          // Apply the selection temporarily
          $setSelection(selection);

          // Wrap in mark node
          $wrapSelectionInMarkNode(selection, selection.isBackward(), matchId);
        }

        // Clear selection after marking
        $setSelection(null);

        setMatches(searchMatches);
        setActiveIndex(0);
      },
      { discrete: true }
    );
  }, [debouncedQuery, editor]);

  /**
   * Navigate to the next match (wraps around)
   */
  const goToNext = useCallback(() => {
    if (matches.length === 0) return;

    const nextIndex = (activeIndex + 1) % matches.length;
    setActiveIndex(nextIndex);

    // Re-apply highlights with new active index
    editor.update(
      () => {
        clearAllMarksInUpdate();

        // Apply marks in reverse order to preserve offsets
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];
          const matchId = i === nextIndex ? SEARCH_MATCH_ACTIVE_ID : SEARCH_MATCH_ID;

          const startResult = $findTextIntersectionFromCharacters($getRoot(), match.offset);
          if (!startResult) continue;

          const endResult = $findTextIntersectionFromCharacters(
            $getRoot(),
            match.offset + match.length
          );
          if (!endResult) continue;

          const selection = $createRangeSelection();
          selection.anchor.set(startResult.node.getKey(), startResult.offset, 'text');
          selection.focus.set(endResult.node.getKey(), endResult.offset, 'text');
          $setSelection(selection);
          $wrapSelectionInMarkNode(selection, selection.isBackward(), matchId);
        }

        $setSelection(null);
      },
      { discrete: true }
    );

    // Scroll into view
    setTimeout(() => {
      const marks = document.querySelectorAll('mark');
      for (const mark of marks) {
        if (mark.getAttribute('data-lexical-mark')?.includes(SEARCH_MATCH_ACTIVE_ID)) {
          mark.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          break;
        }
      }
    }, 50);
  }, [activeIndex, editor, matches]);

  /**
   * Navigate to the previous match (wraps around)
   */
  const goToPrevious = useCallback(() => {
    if (matches.length === 0) return;

    const prevIndex = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(prevIndex);

    // Re-apply highlights with new active index
    editor.update(
      () => {
        clearAllMarksInUpdate();

        // Apply marks in reverse order to preserve offsets
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];
          const matchId = i === prevIndex ? SEARCH_MATCH_ACTIVE_ID : SEARCH_MATCH_ID;

          const startResult = $findTextIntersectionFromCharacters($getRoot(), match.offset);
          if (!startResult) continue;

          const endResult = $findTextIntersectionFromCharacters(
            $getRoot(),
            match.offset + match.length
          );
          if (!endResult) continue;

          const selection = $createRangeSelection();
          selection.anchor.set(startResult.node.getKey(), startResult.offset, 'text');
          selection.focus.set(endResult.node.getKey(), endResult.offset, 'text');
          $setSelection(selection);
          $wrapSelectionInMarkNode(selection, selection.isBackward(), matchId);
        }

        $setSelection(null);
      },
      { discrete: true }
    );

    // Scroll into view
    setTimeout(() => {
      const marks = document.querySelectorAll('mark');
      for (const mark of marks) {
        if (mark.getAttribute('data-lexical-mark')?.includes(SEARCH_MATCH_ACTIVE_ID)) {
          mark.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
          break;
        }
      }
    }, 50);
  }, [activeIndex, editor, matches]);

  /**
   * Clear search and remove all highlights
   */
  const clearSearch = useCallback(() => {
    setQueryState('');
    setDebouncedQuery('');
    setMatches([]);
    setActiveIndex(0);
    setIsSearching(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    clearAllMarks(editor);
  }, [editor]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    query,
    setQuery,
    matches,
    matchCount: matches.length,
    activeIndex,
    goToNext,
    goToPrevious,
    clearSearch,
    isSearching,
  };
}

/**
 * Helper to clear marks within an editor.update() call
 */
function clearAllMarksInUpdate(): void {
  const root = $getRoot();
  const marks: MarkNode[] = [];

  // Collect all search mark nodes
  const traverse = (node: ReturnType<typeof $getRoot>) => {
    const children = node.getChildren();
    for (const child of children) {
      if ($isMarkNode(child)) {
        const ids = child.getIDs();
        if (ids.includes(SEARCH_MATCH_ID) || ids.includes(SEARCH_MATCH_ACTIVE_ID)) {
          marks.push(child);
        }
      }
      if ('getChildren' in child && typeof child.getChildren === 'function') {
        traverse(child as ReturnType<typeof $getRoot>);
      }
    }
  };

  traverse(root);

  // Unwrap all marks
  for (const mark of marks) {
    $unwrapMarkNode(mark);
  }
}
