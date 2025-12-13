/**
 * WikiLinkAutocomplete UI Component
 *
 * Renders the autocomplete popup for wiki-link suggestions.
 * This is a presentational component - keyboard handling is done by WikiLinkPlugin.
 * Uses the FloatingMenu design system primitive for consistent styling.
 */

import type { SearchResult } from '@scribe/shared';
import {
  FloatingMenu,
  FloatingMenuItem,
  FloatingMenuEmpty,
  FloatingMenuLoading,
} from '@scribe/design-system';

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
      {isLoading ? (
        <FloatingMenuLoading showSpinner={false}>Searching...</FloatingMenuLoading>
      ) : results.length === 0 ? (
        <FloatingMenuEmpty>
          {query ? 'No matching notes' : 'Type to search notes'}
        </FloatingMenuEmpty>
      ) : (
        results.map((result, index) => (
          <FloatingMenuItem
            key={result.id}
            selected={index === selectedIndex}
            onClick={() => onSelect(result)}
            icon="📄"
          >
            {result.title || 'Untitled'}
          </FloatingMenuItem>
        ))
      )}
    </FloatingMenu>
  );
}
