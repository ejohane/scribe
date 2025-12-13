/**
 * PersonBrowsePanel Component
 *
 * Renders the people browser for selecting a person note.
 * Shows all people sorted alphabetically when no query, fuzzy search results otherwise.
 *
 * Uses CommandPaletteContext for shared state (selection, callbacks).
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import type { Note } from '@scribe/shared';
import { Text, UserIcon, CornerDownLeftIcon } from '@scribe/design-system';
import { formatRelativeDate } from '../../../utils/formatRelativeDate';
import * as styles from '../CommandPalette.css';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { truncateTitle } from './utils';
import { useFuzzySearch } from './useFuzzySearch';

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

  // Loading state
  if (isLoading) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        Loading...
      </Text>
    );
  }

  // Empty state - no people created yet
  if (allPeople.length === 0) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        No people yet. Create one with "New Person" command
      </Text>
    );
  }

  // No results from fuzzy search
  if (hasNoResults) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        No results
      </Text>
    );
  }

  // No people to display
  if (displayedPeople.length === 0) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        No results
      </Text>
    );
  }

  // Render people list
  return (
    <>
      {displayedPeople.map((person, index) => {
        const isSelected = index === selectedPersonIndex;
        return (
          <div
            key={person.id}
            className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
            onClick={() => {
              if (onNoteSelect) {
                onNoteSelect(person.id);
                onClose();
              }
            }}
            onMouseEnter={() => setSelectedPersonIndex(index)}
          >
            <span className={styles.itemIcon}>
              <UserIcon />
            </span>
            <div className={styles.itemTextContainer}>
              <Text size="sm" weight="medium" truncate className={styles.itemTitle}>
                {truncateTitle(person.title)}
              </Text>
              <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
                {formatRelativeDate(person.updatedAt)}
              </Text>
            </div>
            <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
              <CornerDownLeftIcon />
            </span>
          </div>
        );
      })}
    </>
  );
}
