/**
 * FindReplaceBar Component
 *
 * UI component for in-editor find functionality.
 * Provides search input, match counter, navigation buttons.
 *
 * Keyboard shortcuts:
 * - Enter: Next match
 * - Shift+Enter: Previous match
 * - Escape: Close search bar
 * - Cmd/Ctrl+G: Next match
 * - Cmd/Ctrl+Shift+G: Previous match
 */

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { SearchIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon } from '@scribe/design-system';
import { useFindReplace } from './useFindReplace';
import * as styles from './FindReplaceBar.css';
import clsx from 'clsx';

export interface FindReplaceBarProps {
  /** Called when the search bar should be closed */
  onClose: () => void;
  /** Whether to auto-focus the input on mount */
  autoFocus?: boolean;
}

/**
 * FindReplaceBar - Search UI for the editor
 *
 * Renders a fixed-position search bar with:
 * - Search input with debounced querying
 * - Match counter showing current/total
 * - Navigation buttons for next/previous
 * - Close button
 * - Full keyboard shortcut support
 * - ARIA accessibility features
 */
export function FindReplaceBar({ onClose, autoFocus = true }: FindReplaceBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    query,
    setQuery,
    matchCount,
    activeIndex,
    goToNext,
    goToPrevious,
    clearSearch,
    isSearching,
  } = useFindReplace();

  // Auto-focus input on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  // Handle close with cleanup
  const handleClose = useCallback(() => {
    clearSearch();
    onClose();
  }, [clearSearch, onClose]);

  // Keyboard shortcut handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const isMeta = event.metaKey || event.ctrlKey;

      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
        return;
      }

      // Cmd/Ctrl+G for next, Cmd/Ctrl+Shift+G for previous
      if (isMeta && event.key === 'g') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPrevious();
        } else {
          goToNext();
        }
        return;
      }
    },
    [handleClose, goToNext, goToPrevious]
  );

  // Format match counter text
  const getMatchCountText = (): string => {
    if (isSearching) {
      return 'Searching...';
    }
    if (!query.trim()) {
      return '';
    }
    if (matchCount === 0) {
      return 'No results';
    }
    return `${activeIndex + 1} of ${matchCount}`;
  };

  const matchCountText = getMatchCountText();
  const hasResults = matchCount > 0;
  const showNoResults = query.trim() && matchCount === 0 && !isSearching;

  return (
    <div className={styles.container} role="search" aria-label="Find in document">
      {/* Search icon */}
      <span className={styles.searchIcon} aria-hidden="true">
        <SearchIcon size={16} />
      </span>

      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        aria-label="Search text"
        aria-describedby="match-count"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* Match counter */}
      <span
        id="match-count"
        className={clsx(styles.matchCount, showNoResults && styles.noResults)}
        aria-live="polite"
        aria-atomic="true"
      >
        {matchCountText}
      </span>

      {/* Previous match button */}
      <button
        type="button"
        className={styles.navButton}
        onClick={goToPrevious}
        disabled={!hasResults}
        aria-label="Previous match (Shift+Enter)"
        title="Previous match (Shift+Enter)"
      >
        <ChevronUpIcon size={16} />
      </button>

      {/* Next match button */}
      <button
        type="button"
        className={styles.navButton}
        onClick={goToNext}
        disabled={!hasResults}
        aria-label="Next match (Enter)"
        title="Next match (Enter)"
      >
        <ChevronDownIcon size={16} />
      </button>

      {/* Close button */}
      <button
        type="button"
        className={styles.closeButton}
        onClick={handleClose}
        aria-label="Close search (Escape)"
        title="Close search (Escape)"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
