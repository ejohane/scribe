/**
 * WikiLinkAutocomplete UI Component
 *
 * Renders the autocomplete popup for wiki-link suggestions.
 * This is a presentational component - keyboard handling is done by WikiLinkPlugin.
 * Uses the shared AutocompleteList component for consistent rendering patterns.
 */

import type { SearchResult } from '@scribe/shared';
import { FloatingMenu, FloatingMenuItem } from '@scribe/design-system';
import { AutocompleteList } from './AutocompleteList';

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
  if (!isOpen) return null;

  return (
    <FloatingMenu position={position} ariaLabel="Note suggestions">
      <AutocompleteList
        items={results}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        isLoading={isLoading}
        showLoadingSpinner={false}
        loadingMessage="Searching..."
        emptyMessage={query ? 'No matching notes' : 'Type to search notes'}
        renderItem={(result, isSelected) => (
          <FloatingMenuItem
            key={result.id}
            selected={isSelected}
            onClick={() => onSelect(result)}
            icon="📄"
          >
            {result.title || 'Untitled'}
          </FloatingMenuItem>
        )}
      />
    </FloatingMenu>
  );
}
