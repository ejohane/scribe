/**
 * PersonBrowsePanel Component
 *
 * Renders the people browser for selecting a person note.
 * Shows all people sorted alphabetically when no query, fuzzy search results otherwise.
 *
 * Uses CommandPaletteContext for shared state (selection, callbacks).
 */

import { useMemo } from 'react';
import type { Note } from '@scribe/shared';
import { getRelativeDateString } from '@scribe/shared';
import { UserIcon } from '@scribe/design-system';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { useFuzzySearch } from './useFuzzySearch';
import { PaletteItem, PaletteItemList } from './PaletteItem';

export interface PersonBrowsePanelProps {
  /** All people in the vault */
  allPeople: Note[];
  /** Whether people are loading */
  isLoading: boolean;
}

export function PersonBrowsePanel({ allPeople, isLoading }: PersonBrowsePanelProps) {
  // Get shared state from context
  const { query, selectedPersonIndex, setSelectedPersonIndex, onNoteSelect, onClose } =
    useCommandPaletteContext();

  // Fuzzy search for people
  const {
    debouncedQuery,
    results: fuzzyPeopleResults,
    hasNoResults,
  } = useFuzzySearch({
    items: allPeople,
    query,
    keys: ['title'],
    enabled: true,
  });

  // Determine which people to display
  // When no query, show all people sorted by name; when query exists, show fuzzy results
  const displayedPeople = useMemo(() => {
    if (debouncedQuery.trim() === '') {
      return [...allPeople].sort((a, b) => {
        const titleA = a.title ?? '';
        const titleB = b.title ?? '';
        return titleA.localeCompare(titleB);
      });
    }
    return fuzzyPeopleResults;
  }, [debouncedQuery, allPeople, fuzzyPeopleResults]);

  return (
    <PaletteItemList
      isLoading={isLoading}
      isEmpty={allPeople.length === 0}
      emptyMessage='No people yet. Create one with "New Person" command'
      hasNoResults={hasNoResults}
      hasNoDisplayedItems={displayedPeople.length === 0}
    >
      {displayedPeople.map((person, index) => (
        <PaletteItem
          key={person.id}
          id={person.id}
          title={person.title}
          description={getRelativeDateString(person.updatedAt)}
          icon={<UserIcon />}
          isSelected={index === selectedPersonIndex}
          index={index}
          onMouseEnter={setSelectedPersonIndex}
          onClick={() => {
            if (onNoteSelect) {
              onNoteSelect(person.id);
              onClose();
            }
          }}
        />
      ))}
    </PaletteItemList>
  );
}
