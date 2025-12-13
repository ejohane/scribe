/**
 * DeleteBrowsePanel Component
 *
 * Renders the file browser for selecting a note to delete.
 * Similar to FileBrowsePanel but with different click behavior.
 *
 * Uses CommandPaletteContext for shared state (selection, callbacks).
 */

import type { Note, NoteId } from '@scribe/shared';
import { FileTextIcon } from '@scribe/design-system';
import { formatRelativeDate } from '../../../utils/formatRelativeDate';
import { MAX_RECENT_NOTES } from '../config';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { useFuzzySearch, useRecentNotes } from './useFuzzySearch';
import { PaletteItem, PaletteItemList } from './PaletteItem';

export interface DeleteBrowsePanelProps {
  /** All notes in the vault */
  allNotes: Note[];
  /** Whether notes are loading */
  isLoading: boolean;
}

export function DeleteBrowsePanel({ allNotes, isLoading }: DeleteBrowsePanelProps) {
  // Get shared state from context
  const { query, selectedNoteIndex, setSelectedNoteIndex, currentNoteId, onSelectForDelete } =
    useCommandPaletteContext();

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

  return (
    <PaletteItemList
      isLoading={isLoading}
      isEmpty={allNotes.length === 0}
      emptyMessage="No notes to delete"
      hasNoResults={hasNoResults}
      hasNoDisplayedItems={displayedNotes.length === 0}
    >
      {displayedNotes.map((note, index) => (
        <PaletteItem
          key={note.id}
          id={note.id}
          title={note.title}
          description={formatRelativeDate(note.updatedAt)}
          icon={<FileTextIcon />}
          isSelected={index === selectedNoteIndex}
          index={index}
          onMouseEnter={setSelectedNoteIndex}
          onClick={() => onSelectForDelete(note)}
        />
      ))}
    </PaletteItemList>
  );
}

/**
 * Get the displayed notes for keyboard navigation in parent component
 */
export function getDeleteBrowseDisplayedNotes(
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
