/**
 * WikiLinkAutocomplete UI Component
 *
 * Renders the autocomplete popup for wiki-link suggestions.
 * This is a presentational component - keyboard handling is done by WikiLinkPlugin.
 */

import { useEffect, useRef } from 'react';
import type { SearchResult } from '@scribe/shared';
import { Surface, Text } from '@scribe/design-system';
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
    <Surface
      elevation="md"
      radius="md"
      bordered
      className={styles.dropdown}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Note suggestions"
    >
      <div className={styles.listContainer} ref={listRef}>
        {isLoading ? (
          <Text size="sm" color="foregroundMuted" className={styles.loading}>
            Searching...
          </Text>
        ) : results.length === 0 ? (
          <Text size="sm" color="foregroundMuted" className={styles.empty}>
            {query ? 'No matching notes' : 'Type to search notes'}
          </Text>
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
              <Text size="sm" truncate className={styles.title}>
                {result.title || 'Untitled'}
              </Text>
            </div>
          ))
        )}
      </div>
    </Surface>
  );
}
