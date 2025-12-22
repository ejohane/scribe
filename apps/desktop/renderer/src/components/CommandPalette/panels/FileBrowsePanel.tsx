/**
 * FileBrowsePanel Component
 *
 * Renders the file browser for selecting notes.
 * Shows recent notes when no query, fuzzy search results otherwise.
 *
 * Uses CommandPaletteContext for shared state (selection, callbacks)
 * while maintaining its own data fetching for encapsulation.
 */

import type { Note, NoteId } from '@scribe/shared';
import { getRelativeDateString } from '@scribe/shared';
import { FileTextIcon } from '@scribe/design-system';
import { MAX_RECENT_NOTES } from '../config';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { useFuzzySearch, useRecentNotes } from './useFuzzySearch';
import { PaletteItem, PaletteItemList } from './PaletteItem';

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

  return (
    <PaletteItemList
      isLoading={isLoading}
      isEmpty={allNotes.length === 0}
      emptyMessage="No notes yet. Create one with &#8984;N"
      hasNoResults={hasNoResults}
      hasNoDisplayedItems={displayedNotes.length === 0}
    >
      {displayedNotes.map((note, index) => (
        <PaletteItem
          key={note.id}
          id={note.id}
          title={note.title}
          description={getRelativeDateString(note.updatedAt)}
          icon={<FileTextIcon />}
          isSelected={index === selectedNoteIndex}
          index={index}
          onMouseEnter={setSelectedNoteIndex}
          onClick={() => {
            if (onNoteSelect) {
              onNoteSelect(note.id);
              onClose();
            }
          }}
          deleteButton={{
            onDelete: () => onDeleteNote(note),
            ariaLabel: `Delete ${note.metadata?.title || 'note'}`,
          }}
        />
      ))}
    </PaletteItemList>
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
