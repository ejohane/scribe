/**
 * PersonMentionAutocomplete
 *
 * Autocomplete popup component for person mentions (@username).
 * Handles search, display, and selection of people in the vault.
 * Uses the FloatingMenu design system primitive for consistent styling.
 */

import { useState, useEffect, useCallback } from 'react';
import type { NoteId } from '@scribe/shared';
import {
  FloatingMenu,
  FloatingMenuItem,
  FloatingMenuEmpty,
  FloatingMenuLoading,
  FloatingMenuAction,
} from '@scribe/design-system';

/**
 * Get initials from a person's name (up to 2 characters)
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
 * Autocomplete component that manages search and reports results
 * back to the plugin for keyboard navigation support.
 */
export function PersonMentionAutocomplete({
  query,
  position,
  selectedIndex,
  onSelect,
  onCreate,
  currentNoteId,
  onResultsChange,
}: PersonMentionAutocompleteProps) {
  const [results, setResults] = useState<PersonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check if an exact match exists (case-insensitive)
  const hasExactMatch = results.some((r) => r.name.toLowerCase() === query.toLowerCase());

  // Should show create option: query exists and no exact match
  const showCreateOption = query.trim().length > 0 && !hasExactMatch;

  // Check if create option is selected
  const isCreateSelected = showCreateOption && selectedIndex === results.length;

  // Search for people when query changes
  const searchPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchResults = await window.scribe.people.search(query);
      // Map SearchResult to PersonResult and exclude currentNoteId
      const personResults: PersonResult[] = searchResults
        .filter((r) => r.id !== currentNoteId)
        .map((r) => ({
          id: r.id,
          name: r.title || 'Untitled',
        }));
      setResults(personResults);
    } catch (error) {
      console.error('Failed to search people:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [query, currentNoteId]);

  // Debounce search to reduce IPC calls during rapid typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPeople();
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [searchPeople]);

  // Notify parent when results change
  useEffect(() => {
    onResultsChange(results, hasExactMatch);
  }, [results, hasExactMatch, onResultsChange]);

  return (
    <FloatingMenu position={position} ariaLabel="Person suggestions" width="sm">
      {isLoading ? (
        <FloatingMenuLoading>Searching...</FloatingMenuLoading>
      ) : results.length === 0 && !showCreateOption ? (
        <FloatingMenuEmpty>No matching people</FloatingMenuEmpty>
      ) : (
        <>
          {results.map((person, index) => (
            <FloatingMenuItem
              key={person.id}
              selected={index === selectedIndex}
              onClick={() => onSelect(person)}
              icon={getInitials(person.name)}
              iconShape="circle"
              iconVariant="accent"
            >
              {person.name}
            </FloatingMenuItem>
          ))}
          {showCreateOption && (
            <FloatingMenuAction
              selected={isCreateSelected}
              onClick={() => onCreate(query.trim())}
              icon="+"
              iconShape="circle"
              iconVariant="muted"
            >
              Create &quot;{query.trim()}&quot;
            </FloatingMenuAction>
          )}
        </>
      )}
    </FloatingMenu>
  );
}
