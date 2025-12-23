/**
 * Types for the Find/Replace feature
 */

/**
 * Represents a single match found in the editor
 */
export interface SearchMatch {
  /** Unique identifier for this match (used for MarkNode ID) */
  id: string;
  /** Character offset from start of document */
  offset: number;
  /** Length of the matched text */
  length: number;
  /** The actual matched text content */
  text: string;
}

/**
 * State returned by the useFindReplace hook
 */
export interface FindReplaceState {
  /** Current search query */
  query: string;
  /** Update the search query */
  setQuery: (query: string) => void;
  /** Array of all matches found */
  matches: SearchMatch[];
  /** Total number of matches */
  matchCount: number;
  /** Index of currently active/highlighted match (0-based) */
  activeIndex: number;
  /** Navigate to next match (wraps around) */
  goToNext: () => void;
  /** Navigate to previous match (wraps around) */
  goToPrevious: () => void;
  /** Clear search query and all highlights */
  clearSearch: () => void;
  /** Whether a search is currently in progress */
  isSearching: boolean;
}

/**
 * MarkNode IDs used for highlighting
 */
export const SEARCH_MATCH_ID = 'search-match';
export const SEARCH_MATCH_ACTIVE_ID = 'search-match-active';

/**
 * Debounce delay for search input (ms)
 */
export const SEARCH_DEBOUNCE_MS = 150;
