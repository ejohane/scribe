/**
 * FindReplace Module
 *
 * Provides in-editor find and replace functionality for the Lexical editor.
 */

export { useFindReplace } from './useFindReplace';
export { FindReplaceBar, type FindReplaceBarProps } from './FindReplaceBar';
export { FindReplacePlugin } from './FindReplacePlugin';
export type { FindReplaceState, SearchMatch } from './types';
export { SEARCH_MATCH_ID, SEARCH_MATCH_ACTIVE_ID, SEARCH_DEBOUNCE_MS } from './types';
export * as findReplaceStyles from './FindReplaceBar.css';
