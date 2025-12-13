/**
 * FileBrowsePanel Component
 *
 * Renders the file browser for selecting notes.
 * Shows recent notes when no query, fuzzy search results otherwise.
 *
 * Uses CommandPaletteContext for shared state (selection, callbacks)
 * while maintaining its own data fetching for encapsulation.
 */

import clsx from 'clsx';
import type { Note, NoteId } from '@scribe/shared';
import { Text, Icon, FileTextIcon, CornerDownLeftIcon, CloseIcon } from '@scribe/design-system';
import { formatRelativeDate } from '../../../utils/formatRelativeDate';
import * as styles from '../CommandPalette.css';
import { MAX_RECENT_NOTES } from '../config';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { truncateTitle } from './utils';
import { useFuzzySearch, useRecentNotes } from './useFuzzySearch';

export interface FileBrowsePanelProps {
  /** All notes in the vault */
  allNotes: Note[];
  /** Whether notes are loading */
  isLoading: boolean;
}

export function FileBrowsePanel({ allNotes, isLoading }: FileBrowsePanelProps) {
  // Get shared state from context
  const {
    query,
    selectedNoteIndex,
    setSelectedNoteIndex,
    currentNoteId,
    onNoteSelect,
    onClose,
    onDeleteNote,
  } = useCommandPaletteContext();

  // Get recent notes for empty query state
  const recentNotes = useRecentNotes(allNotes, currentNoteId, MAX_RECENT_NOTES);

  // Fuzzy search for notes
  const {
    debouncedQuery,
    results: fuzzySearchResults,
    hasNoResults,
  } = useFuzzySearch({
    items: allNotes,
    query,
    keys: ['title'],
    excludeId: currentNoteId,
    enabled: true,
  });

  // Determine which notes to display
  const displayedNotes = debouncedQuery.trim() === '' ? recentNotes : fuzzySearchResults;

  // Loading state
  if (isLoading) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        Loading...
      </Text>
    );
  }

  // Empty vault state
  if (allNotes.length === 0) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        No notes yet. Create one with &#8984;N
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

  // No notes to display (all filtered out - e.g., only current note exists)
  if (displayedNotes.length === 0) {
    return (
      <Text color="foregroundMuted" className={styles.noResults}>
        No results
      </Text>
    );
  }

  // Render notes (either recent or fuzzy search results)
  return (
    <>
      {displayedNotes.map((note, index) => {
        const isSelected = index === selectedNoteIndex;
        return (
          <div
            key={note.id}
            className={clsx(styles.paletteItem, isSelected && styles.paletteItemSelected)}
            onClick={() => {
              if (onNoteSelect) {
                onNoteSelect(note.id);
                onClose();
              }
            }}
            onMouseEnter={() => setSelectedNoteIndex(index)}
          >
            <span className={styles.itemIcon}>
              <FileTextIcon />
            </span>
            <div className={styles.itemTextContainer}>
              <Text size="sm" weight="medium" truncate className={styles.itemTitle}>
                {truncateTitle(note.title)}
              </Text>
              <Text size="xs" color="foregroundMuted" className={styles.itemDescription}>
                {formatRelativeDate(note.updatedAt)}
              </Text>
            </div>
            <span className={clsx(styles.enterHint, isSelected && styles.enterHintVisible)}>
              <CornerDownLeftIcon />
            </span>
            <button
              className={styles.deleteIcon}
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering note open
                onDeleteNote(note);
              }}
              aria-label={`Delete ${note.metadata?.title || 'note'}`}
              type="button"
            >
              <Icon size="sm" color="foregroundMuted">
                <CloseIcon className={styles.deleteIconSvg} />
              </Icon>
            </button>
          </div>
        );
      })}
    </>
  );
}

/**
 * Get the displayed notes for keyboard navigation in parent component
 */
export function getFileBrowseDisplayedNotes(
  allNotes: Note[],
  currentNoteId: NoteId | null | undefined,
  debouncedQuery: string,
  fuzzySearchResults: Note[]
): Note[] {
  if (debouncedQuery.trim() === '') {
    return allNotes
      .filter((note) => note.id !== currentNoteId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RECENT_NOTES);
  }
  return fuzzySearchResults;
}
