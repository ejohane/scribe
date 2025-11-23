import { useState, useEffect, useCallback } from 'react';
import type { Note, NoteId, LexicalState } from '@scribe/shared';

interface UseNoteStateReturn {
  /** Current note being edited (null if none loaded) */
  currentNote: Note | null;

  /** Current note ID */
  currentNoteId: NoteId | null;

  /** Whether a note is currently loading */
  isLoading: boolean;

  /** Error message if load/save failed */
  error: string | null;

  /** Load a note by ID */
  loadNote: (id: NoteId) => Promise<void>;

  /** Save the current note with updated content */
  saveNote: (content: LexicalState) => Promise<void>;

  /** Create and load a new note */
  createNote: () => Promise<void>;
}

/**
 * Custom React hook to manage note state
 *
 * Handles:
 * - Current note ID tracking
 * - Loading note data via preload API
 * - Saving note updates
 * - Creating new notes
 * - Error handling
 */
export function useNoteState(): UseNoteStateReturn {
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<NoteId | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load a note by ID from the engine
   */
  const loadNote = useCallback(async (id: NoteId) => {
    setIsLoading(true);
    setError(null);

    try {
      const note = await window.scribe.notes.read(id);
      setCurrentNote(note);
      setCurrentNoteId(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load note';
      setError(errorMessage);
      console.error('Failed to load note:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save the current note with updated content
   */
  const saveNote = useCallback(
    async (content: LexicalState) => {
      if (!currentNote) {
        setError('No note loaded to save');
        return;
      }

      try {
        // Create updated note with new content
        const updatedNote: Note = {
          ...currentNote,
          content,
          // updatedAt is managed by engine, but we include it for type safety
          updatedAt: Date.now(),
        };

        const result = await window.scribe.notes.save(updatedNote);

        if (result.success) {
          // Reload the note to get the latest engine-generated metadata
          if (currentNoteId) {
            await loadNote(currentNoteId);
          }
        } else {
          setError('Failed to save note');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save note';
        setError(errorMessage);
        console.error('Failed to save note:', err);
      }
    },
    [currentNote, currentNoteId, loadNote]
  );

  /**
   * Create a new note and load it
   */
  const createNote = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newNote = await window.scribe.notes.create();
      setCurrentNote(newNote);
      setCurrentNoteId(newNote.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setError(errorMessage);
      console.error('Failed to create note:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-create a note on mount if none exists
  useEffect(() => {
    if (!currentNoteId && !isLoading) {
      createNote();
    }
  }, [currentNoteId, isLoading, createNote]);

  return {
    currentNote,
    currentNoteId,
    isLoading,
    error,
    loadNote,
    saveNote,
    createNote,
  };
}
