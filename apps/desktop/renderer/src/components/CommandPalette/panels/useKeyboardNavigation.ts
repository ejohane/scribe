/**
 * useKeyboardNavigation Hook
 *
 * Handles keyboard navigation for CommandPalette modes.
 */

import { useEffect, useRef } from 'react';
import type { Note, NoteId } from '@scribe/shared';
import type { PaletteMode } from '../../../commands/types';

export interface UseKeyboardNavigationOptions {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Current mode */
  mode: PaletteMode;
  /** Displayed notes for file/delete browse */
  displayedNotes: Note[];
  /** Displayed people for person browse */
  displayedPeople: Note[];
  /** Selected index for notes */
  selectedNoteIndex: number;
  /** Setter for selected note index */
  setSelectedNoteIndex: (index: number | ((prev: number) => number)) => void;
  /** Selected index for people */
  selectedPersonIndex: number;
  /** Setter for selected person index */
  setSelectedPersonIndex: (index: number | ((prev: number) => number)) => void;
  /** Callback when a note is selected */
  onNoteSelect?: (noteId: NoteId) => void;
  /** Callback to close the palette */
  onClose: () => void;
  /** Callback to go back to command mode */
  onBackToCommand: () => void;
  /** Callback when selecting a note for deletion */
  onSelectForDelete: (note: Note) => void;
  /** Callback to cancel delete confirmation */
  onDeleteCancel: () => void;
  /** Callback to confirm deletion */
  onDeleteConfirm: () => void;
}

/**
 * Hook for handling keyboard navigation in the command palette
 */
export function useKeyboardNavigation({
  isOpen,
  mode,
  displayedNotes,
  displayedPeople,
  selectedNoteIndex,
  setSelectedNoteIndex,
  selectedPersonIndex,
  setSelectedPersonIndex,
  onNoteSelect,
  onClose,
  onBackToCommand,
  onSelectForDelete,
  onDeleteCancel,
  onDeleteConfirm,
}: UseKeyboardNavigationOptions): void {
  // Refs for stable callbacks
  const onDeleteCancelRef = useRef(onDeleteCancel);
  const onDeleteConfirmRef = useRef(onDeleteConfirm);

  onDeleteCancelRef.current = onDeleteCancel;
  onDeleteConfirmRef.current = onDeleteConfirm;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // File-browse mode
      if (mode === 'file-browse') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.min(prev + 1, displayedNotes.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (onNoteSelect && displayedNotes[selectedNoteIndex]) {
              onNoteSelect(displayedNotes[selectedNoteIndex].id);
              onClose();
            }
            break;
          case 'Escape':
            e.preventDefault();
            onBackToCommand();
            break;
        }
        return;
      }

      // Delete-browse mode
      if (mode === 'delete-browse') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.min(prev + 1, displayedNotes.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedNoteIndex((prev) => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (displayedNotes[selectedNoteIndex]) {
              onSelectForDelete(displayedNotes[selectedNoteIndex]);
            }
            break;
          case 'Escape':
            e.preventDefault();
            onBackToCommand();
            break;
        }
        return;
      }

      // Delete-confirm mode
      if (mode === 'delete-confirm') {
        if (e.key === 'Escape') {
          e.preventDefault();
          onDeleteCancelRef.current();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onDeleteConfirmRef.current();
        }
        return;
      }

      // Person-browse mode
      if (mode === 'person-browse') {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedPersonIndex((prev) => Math.min(prev + 1, displayedPeople.length - 1));
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedPersonIndex((prev) => Math.max(prev - 1, 0));
            break;
          case 'Enter':
            e.preventDefault();
            if (onNoteSelect && displayedPeople[selectedPersonIndex]) {
              onNoteSelect(displayedPeople[selectedPersonIndex].id);
              onClose();
            }
            break;
          case 'Escape':
            e.preventDefault();
            onBackToCommand();
            break;
        }
        return;
      }

      // Command mode - only handle Escape here
      if (mode === 'command' && e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    mode,
    selectedNoteIndex,
    selectedPersonIndex,
    displayedNotes,
    displayedPeople,
    onNoteSelect,
    onClose,
    onBackToCommand,
    onSelectForDelete,
    setSelectedNoteIndex,
    setSelectedPersonIndex,
  ]);
}
