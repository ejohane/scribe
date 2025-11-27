/**
 * PersonMentionAutocomplete UI Component
 *
 * Renders the autocomplete popup for person mention suggestions.
 * This is a presentational component - keyboard handling is done by PersonMentionPlugin.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { NoteId, SearchResult } from '@scribe/shared';
import * as styles from './PersonMentionAutocomplete.css';

export interface PersonResult {
  id: NoteId;
  name: string;
}

export interface PersonMentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (person: PersonResult) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
  currentNoteId: NoteId | null;
}

export function PersonMentionAutocomplete({
  query,
  position,
  selectedIndex,
  onSelect,
  onCreate,
  onClose: _onClose,
  currentNoteId,
}: PersonMentionAutocompleteProps) {
  const [results, setResults] = useState<PersonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Check if an exact match exists (case-insensitive)
  const hasExactMatch = results.some((r) => r.name.toLowerCase() === query.toLowerCase());

  // Should show create option: query exists and no exact match
  const showCreateOption = query.trim().length > 0 && !hasExactMatch;

  // Search for people when query changes
  const searchPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchResults: SearchResult[] = await window.scribe.people.search(query);
      // Map SearchResult to PersonResult and exclude currentNoteId
      const personResults: PersonResult[] = searchResults
        .filter((r: SearchResult) => r.id !== currentNoteId)
        .map((r: SearchResult) => ({
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

  useEffect(() => {
    searchPeople();
  }, [searchPeople]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleItemClick = (person: PersonResult) => {
    onSelect(person);
  };

  const handleCreateClick = () => {
    onCreate(query.trim());
  };

  // Check if create option is selected
  const isCreateSelected = showCreateOption && selectedIndex === results.length;

  return (
    <div
      className={styles.autocompleteContainer}
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Person suggestions"
      ref={listRef}
    >
      {isLoading ? (
        <div className={styles.emptyState}>Searching...</div>
      ) : results.length === 0 && !showCreateOption ? (
        <div className={styles.emptyState}>No matching people</div>
      ) : (
        <>
          {results.map((person, index) => (
            <div
              key={person.id}
              ref={index === selectedIndex ? selectedRef : null}
              className={`${styles.autocompleteItem} ${
                index === selectedIndex ? styles.autocompleteItemSelected : ''
              }`}
              onClick={() => handleItemClick(person)}
              role="option"
              aria-selected={index === selectedIndex}
            >
              {person.name}
            </div>
          ))}
          {showCreateOption && (
            <div
              ref={isCreateSelected ? selectedRef : null}
              className={`${styles.autocompleteItem} ${styles.createOption} ${
                isCreateSelected ? styles.autocompleteItemSelected : ''
              }`}
              onClick={handleCreateClick}
              role="option"
              aria-selected={isCreateSelected}
            >
              + Create &quot;{query.trim()}&quot;
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Export totalItems count helper for parent component
export function getPersonAutocompleteItemCount(
  resultsCount: number,
  query: string,
  hasExactMatch: boolean
): number {
  const showCreateOption = query.trim().length > 0 && !hasExactMatch;
  return resultsCount + (showCreateOption ? 1 : 0);
}
