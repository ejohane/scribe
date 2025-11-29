/**
 * WikiLinkAutocomplete UI Component
 *
 * Renders the autocomplete popup for wiki-link suggestions.
 * This is a presentational component - keyboard handling is done by WikiLinkPlugin.
 * Styled to match the SlashMenu floating menu design.
 */

import { useEffect, useRef } from 'react';
import type { SearchResult } from '@scribe/shared';
import * as styles from './WikiLinkAutocomplete.css';

export interface WikiLinkAutocompleteProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onClose: () => void;
  isLoading: boolean;
}

export function WikiLinkAutocomplete({
  isOpen,
  query,
  position,
  results,
  selectedIndex,
  onSelect,
  onClose: _onClose,
  isLoading,
}: WikiLinkAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.dropdown}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Note suggestions"
    >
      <div className={styles.listContainer} ref={listRef}>
        {isLoading ? (
          <div className={styles.loading}>Searching...</div>
        ) : results.length === 0 ? (
          <div className={styles.empty}>{query ? 'No matching notes' : 'Type to search notes'}</div>
        ) : (
          results.map((result, index) => (
            <div
              key={result.id}
              ref={index === selectedIndex ? selectedRef : null}
              className={`${styles.item} ${index === selectedIndex ? styles.itemSelected : ''}`}
              onClick={() => onSelect(result)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className={styles.itemIcon}>📄</span>
              <span className={styles.itemText}>{result.title || 'Untitled'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
