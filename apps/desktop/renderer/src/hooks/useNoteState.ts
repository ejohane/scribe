import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

  /** Delete a note by ID */
  deleteNote: (id: NoteId) => Promise<void>;
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

  // Track whether initialization has been attempted to prevent infinite loop
  // if both loadNote and createNote fail
  const hasInitialized = useRef(false);

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

      // Remember this as the last opened note
      await window.scribe.app.setLastOpenedNote(id);
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
          // Update local state without reloading to avoid focus loss
          // The engine has the latest metadata, but we don't need to reload
          // the entire note just to update metadata during autosave
          setCurrentNote(updatedNote);
        } else {
          setError('Failed to save note');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save note';
        setError(errorMessage);
        console.error('Failed to save note:', err);
      }
    },
    [currentNote]
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

      // Remember this as the last opened note
      await window.scribe.app.setLastOpenedNote(newNote.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setError(errorMessage);
      console.error('Failed to create note:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a note by ID
   */
  const deleteNote = useCallback(
    async (id: NoteId) => {
      try {
        await window.scribe.notes.delete(id);

        // If we deleted the current note, clear it
        if (id === currentNoteId) {
          setCurrentNote(null);
          setCurrentNoteId(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete note';
        setError(errorMessage);
        console.error('Failed to delete note:', err);
        throw err; // Re-throw so caller can handle (e.g., show error toast)
      }
    },
    [currentNoteId]
  );

  // On mount, try to load the last opened note, or create a new one
  useEffect(() => {
    const initializeNote = async () => {
      // Prevent infinite loop if both loadNote and createNote fail:
      // Without this guard, when both fail, currentNoteId stays null and
      // isLoading becomes false, causing the effect to re-run endlessly
      if (hasInitialized.current) return;
      if (currentNoteId || isLoading) return;

      hasInitialized.current = true;

      try {
        // Try to get the last opened note
        const lastNoteId = await window.scribe.app.getLastOpenedNote();
        if (lastNoteId) {
          await loadNote(lastNoteId);
        } else {
          await createNote();
        }
      } catch (err) {
        console.error('Failed to initialize note:', err);
        // If loading last note fails, clear error and create a new one
        setError(null);
        await createNote();
      }
    };

    initializeNote();
  }, [currentNoteId, isLoading, loadNote, createNote]);

  // Return a memoized object to ensure stable reference for consumers
  // This prevents unnecessary effect re-runs in components that depend on noteState
  return useMemo(
    () => ({
      currentNote,
      currentNoteId,
      isLoading,
      error,
      loadNote,
      saveNote,
      createNote,
      deleteNote,
    }),
    [currentNote, currentNoteId, isLoading, error, loadNote, saveNote, createNote, deleteNote]
  );
}
