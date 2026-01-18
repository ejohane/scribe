/**
 * PersonMentionAutocomplete
 *
 * NOTE: People feature temporarily disabled during thin shell refactor.
 * This component is stubbed out until the feature is re-implemented
 * via the daemon service.
 */

import { useEffect } from 'react';
import type { NoteId } from '@scribe/shared';
import { FloatingMenu } from '@scribe/design-system';

import { AutocompleteList } from './AutocompleteList';

/**
 * Represents a person result in the autocomplete dropdown
 */
export interface PersonResult {
  id: NoteId;
  name: string;
}

/**
 * Calculate total items count for keyboard navigation
 *
 * @param resultsCount - Number of search results
 * @param query - Current query string
 * @param hasExactMatch - Whether an exact match exists
 * @returns Total number of selectable items
 */
export function getPersonAutocompleteItemCount(
  resultsCount: number,
  query: string,
  hasExactMatch: boolean
): number {
  const showCreateOption = query.trim().length > 0 && !hasExactMatch;
  return resultsCount + (showCreateOption ? 1 : 0);
}

/**
 * Props for the PersonMentionAutocomplete component
 */
export interface PersonMentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (person: PersonResult) => void;
  onCreate: (name: string) => void;
  currentNoteId: NoteId | null;
  onResultsChange: (results: PersonResult[], hasExactMatch: boolean) => void;
}

/**
 * Stubbed autocomplete component - people feature is temporarily disabled.
 */
export function PersonMentionAutocomplete({
  position,
  onResultsChange,
}: PersonMentionAutocompleteProps) {
  // Report empty results to parent
  useEffect(() => {
    onResultsChange([], false);
  }, [onResultsChange]);

  return (
    <FloatingMenu position={position} ariaLabel="Person suggestions" width="sm">
      <AutocompleteList
        items={[]}
        selectedIndex={0}
        onSelect={() => {}}
        isLoading={false}
        emptyMessage="People feature coming soon"
        renderItem={() => null}
      />
    </FloatingMenu>
  );
}
