/**
 * FileBrowsePanel Component
 *
 * Renders the file browser for selecting notes.
 * Shows recent notes when no query, fuzzy search results otherwise.
 *
 * Uses CommandPaletteContext for shared state (selection, callbacks)
 * while maintaining its own data fetching for encapsulation.
 */

import { useCallback, useEffect } from 'react';
import type { Note, NoteId } from '@scribe/shared';
import { getRelativeDateString, isDailyNote, isMeetingNote, isPersonNote } from '@scribe/shared';
import { FileTextIcon, CalendarIcon, UserIcon, PlusIcon } from '@scribe/design-system';
import { MAX_RECENT_NOTES } from '../config';
import { useCommandPaletteContext } from '../CommandPaletteContext';
import { useFuzzySearch, useRecentOpens } from './useFuzzySearch';
import { PaletteItem, PaletteItemList } from './PaletteItem';
import * as styles from '../CommandPalette.css';

/**
 * Returns the appropriate icon component for a note based on its type.
 *
 * Icon mapping:
 * - Regular notes: FileTextIcon (document)
 * - Daily notes: CalendarIcon (calendar for date-based)
 * - Meeting notes: CalendarIcon (calendar for scheduled events)
 * - Person notes: UserIcon (person silhouette)
 */
function getNoteIcon(note: Note): React.ReactNode {
  if (isPersonNote(note)) {
    return <UserIcon />;
  }
  if (isMeetingNote(note) || isDailyNote(note)) {
    return <CalendarIcon />;
  }
  // Default: regular note
  return <FileTextIcon />;
}

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
  const { recentItems: recentNotes, isLoading: recentsLoading } = useRecentOpens({
    allNotes,
    currentNoteId,
    limit: MAX_RECENT_NOTES,
  });

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

  // Determine if we should show the "Create new note" option
  const trimmedQuery = debouncedQuery.trim();
  const shouldShowCreateOption = trimmedQuery !== '' && hasNoResults;

  // Detect if we're in the "no recents yet" state (vault has notes, but none opened recently)
  const hasNoRecentsYet = trimmedQuery === '' && recentNotes.length === 0 && allNotes.length > 0;

  // Handle creating a new note with the query as title
  const handleCreateNote = useCallback(async () => {
    try {
      const newNote = await window.scribe.notes.create();
      const updatedNote = { ...newNote, title: trimmedQuery };
      await window.scribe.notes.save(updatedNote);
      if (onNoteSelect) {
        onNoteSelect(newNote.id);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  }, [trimmedQuery, onNoteSelect, onClose]);

  // Handle keyboard Enter for the create option
  useEffect(() => {
    if (!shouldShowCreateOption) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedNoteIndex === 0) {
        e.preventDefault();
        e.stopPropagation();
        handleCreateNote();
      }
    };

    // Use capture phase to intercept before useKeyboardNavigation
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [shouldShowCreateOption, selectedNoteIndex, handleCreateNote]);

  return (
    <PaletteItemList
      isLoading={isLoading || recentsLoading}
      isEmpty={allNotes.length === 0}
      emptyMessage="No notes yet. Create one with &#8984;N"
      hasNoResults={false}
      hasNoDisplayedItems={
        !shouldShowCreateOption && !hasNoRecentsYet && displayedNotes.length === 0
      }
    >
      {/* Empty recents state (notes exist but none opened recently) */}
      {hasNoRecentsYet && (
        <div className={styles.noResults}>
          <p style={{ marginBottom: '8px' }}>No recently opened items</p>
          <p style={{ opacity: 0.7, fontSize: '12px' }}>
            Open a note and it will appear here for quick access
          </p>
        </div>
      )}
      {/* Show create option when no results */}
      {shouldShowCreateOption && (
        <PaletteItem
          key="create-new-note"
          id="create-new-note"
          title={`Create "${trimmedQuery}"`}
          description="Create a new note with this title"
          icon={<PlusIcon />}
          isSelected={selectedNoteIndex === 0}
          index={0}
          onMouseEnter={setSelectedNoteIndex}
          onClick={handleCreateNote}
        />
      )}
      {displayedNotes.map((note, index) => {
        const adjustedIndex = shouldShowCreateOption ? index + 1 : index;
        return (
          <PaletteItem
            key={note.id}
            id={note.id}
            title={note.title}
            description={getRelativeDateString(note.updatedAt)}
            icon={getNoteIcon(note)}
            isSelected={adjustedIndex === selectedNoteIndex}
            index={adjustedIndex}
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
        );
      })}
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
