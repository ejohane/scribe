/**
 * PersonMentionAutocomplete
 *
 * Autocomplete popup component for person mentions (@username).
 * Handles search, display, and selection of people in the vault.
 * Styled to match the SlashMenu floating menu design.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NoteId } from '@scribe/shared';
import * as autocompleteStyles from './PersonMentionAutocomplete.css';

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
  const selectedRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div
      className={autocompleteStyles.autocompleteContainer}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Person suggestions"
      ref={listRef}
    >
      {isLoading ? (
        <div className={autocompleteStyles.loadingState}>
          <span className={autocompleteStyles.spinner} />
          Searching...
        </div>
      ) : results.length === 0 && !showCreateOption ? (
        <div className={autocompleteStyles.emptyState}>No matching people</div>
      ) : (
        <>
          {results.map((person, index) => (
            <div
              key={person.id}
              ref={index === selectedIndex ? selectedRef : null}
              className={`${autocompleteStyles.autocompleteItem} ${
                index === selectedIndex ? autocompleteStyles.autocompleteItemSelected : ''
              }`}
              onClick={() => onSelect(person)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <span className={autocompleteStyles.itemIcon}>{getInitials(person.name)}</span>
              <span className={autocompleteStyles.itemText}>{person.name}</span>
            </div>
          ))}
          {showCreateOption && (
            <div
              ref={isCreateSelected ? selectedRef : null}
              className={`${autocompleteStyles.autocompleteItem} ${autocompleteStyles.createOption} ${
                isCreateSelected ? autocompleteStyles.autocompleteItemSelected : ''
              }`}
              onClick={() => onCreate(query.trim())}
              role="option"
              aria-selected={isCreateSelected}
            >
              <span className={autocompleteStyles.createIcon}>+</span>
              <span className={autocompleteStyles.itemText}>Create &quot;{query.trim()}&quot;</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
