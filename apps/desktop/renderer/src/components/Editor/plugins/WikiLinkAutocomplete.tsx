/**
 * WikiLinkAutocomplete UI Component
 *
 * Renders the autocomplete popup for wiki-link suggestions.
 * This is a presentational component - keyboard handling is done by WikiLinkPlugin.
 */

import { useEffect, useRef } from 'react';
import type { SearchResult } from '@scribe/shared';
import './WikiLinkAutocomplete.css';

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
      className="wiki-link-autocomplete"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Note suggestions"
    >
      <div className="wiki-link-autocomplete-list" ref={listRef}>
        {isLoading ? (
          <div className="wiki-link-autocomplete-loading">Searching...</div>
        ) : results.length === 0 ? (
          <div className="wiki-link-autocomplete-empty">
            {query ? 'No matching notes' : 'Type to search notes'}
          </div>
        ) : (
          results.map((result, index) => (
            <div
              key={result.id}
              ref={index === selectedIndex ? selectedRef : null}
              className={`wiki-link-autocomplete-item ${
                index === selectedIndex ? 'wiki-link-autocomplete-item--selected' : ''
              }`}
              onClick={() => onSelect(result)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className="wiki-link-autocomplete-title">{result.title || 'Untitled'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
