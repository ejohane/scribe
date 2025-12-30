import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Note, NoteId, EditorContent, NoteType, RecentOpenEntityType } from '@scribe/shared';
import {
  isSystemNoteId,
  getErrorMessage,
  logger,
  isDailyNote,
  isMeetingNote,
  isPersonNote,
} from '@scribe/shared';

const log = logger.child('useNoteState');

/**
 * Determines the entity type for recent opens tracking from a Note object.
 */
function getEntityTypeFromNote(note: Note): RecentOpenEntityType {
  if (isDailyNote(note)) return 'daily';
  if (isMeetingNote(note)) return 'meeting';
  if (isPersonNote(note)) return 'person';
  return 'note';
}

/**
 * Partial note metadata that can be updated via the header UI
 */
interface NoteMetadataUpdate {
  title?: string;
  type?: NoteType | undefined;
  tags?: string[];
}

interface UseNoteStateReturn {
  /** Current note being edited (null if none loaded) */
  currentNote: Note | null;

  /** Current note ID */
  currentNoteId: NoteId | null;

  /** Whether the current note is a system note (e.g., system:tasks) */
  isSystemNote: boolean;

  /** Whether a note is currently loading */
  isLoading: boolean;

  /** Error message if load/save failed */
  error: string | null;

  /** Load a note by ID */
  loadNote: (id: NoteId) => Promise<void>;

  /** Save the current note with updated content */
  saveNote: (content: EditorContent) => Promise<void>;

  /** Update note metadata (title, type, tags) */
  updateMetadata: (updates: NoteMetadataUpdate) => Promise<void>;

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

  // Track the latest note state for rollback purposes in optimistic updates
  // This prevents race conditions where rapid updates would use stale closure values
  const latestNoteRef = useRef<Note | null>(null);

  // Keep the ref in sync with the latest state
  useEffect(() => {
    latestNoteRef.current = currentNote;
  }, [currentNote]);

  /**
   * Load a note by ID from the engine
   * System notes (e.g., system:tasks) are handled specially - they don't load
   * actual content but set the ID for routing purposes
   */
  const loadNote = useCallback(async (id: NoteId) => {
    // Handle system notes specially - no content to load
    if (isSystemNoteId(id)) {
      setCurrentNote(null);
      setCurrentNoteId(id);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const note = await window.scribe.notes.read(id);
      setCurrentNote(note);
      setCurrentNoteId(id);

      // Remember this as the last opened note
      await window.scribe.app.setLastOpenedNote(id);

      // Record the open for recent opens tracking (fire-and-forget)
      const entityType = getEntityTypeFromNote(note);
      window.scribe.recentOpens
        .recordOpen(id, entityType)
        .catch((err) => log.warn('Failed to record recent open', { noteId: id, error: err }));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load note'));
      log.error('Failed to load note', { noteId: id, error: getErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save the current note with updated content
   */
  const saveNote = useCallback(
    async (content: EditorContent) => {
      if (!currentNote) {
        setError('No note loaded to save');
        return;
      }

      setError(null);

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
        setError(getErrorMessage(err, 'Failed to save note'));
        log.error('Failed to save note', { noteId: currentNote?.id, error: getErrorMessage(err) });
      }
    },
    [currentNote]
  );

  /**
   * Update note metadata (title, type, tags) without changing content
   *
   * Uses functional setState and refs to prevent race conditions with rapid updates.
   * The stateBeforeUpdate is captured at call time to enable proper rollback on failure.
   */
  const updateMetadata = useCallback(
    async (updates: NoteMetadataUpdate) => {
      // Capture the current state at call time for rollback
      // We use the ref to get the actual latest state, not a stale closure value
      const stateBeforeUpdate = latestNoteRef.current;

      if (!stateBeforeUpdate) {
        setError('No note loaded to update');
        return;
      }

      setError(null);

      // Use functional setState to ensure we're working with the latest state
      // This is critical for preventing race conditions with rapid updates
      let updatedNote: Note | null = null;

      setCurrentNote((prevNote) => {
        if (!prevNote) return null;

        // We preserve the discriminated union by spreading the previous note
        // and only updating common fields. The type assertion is safe because
        // we're only modifying fields that exist on BaseNote (title, tags, updatedAt)
        // and the type-specific fields (daily, meeting) are preserved via spread.
        updatedNote = {
          ...prevNote,
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.type !== undefined && { type: updates.type }),
          ...(updates.tags !== undefined && { tags: updates.tags }),
          updatedAt: Date.now(),
        } as Note;

        return updatedNote;
      });

      // Wait for the state update to be reflected in the ref
      // The updatedNote was captured during the setState call
      if (!updatedNote) {
        return;
      }

      try {
        // Save to backend
        const result = await window.scribe.notes.save(updatedNote);

        if (!result.success) {
          // Revert on failure - use functional update to only revert if still at our state
          setCurrentNote((prevNote) => {
            // Only revert if the current state is still our optimistic update
            // This prevents reverting changes made by subsequent updates
            if (prevNote && updatedNote && prevNote.updatedAt === updatedNote.updatedAt) {
              return stateBeforeUpdate;
            }
            return prevNote;
          });
          setError('Failed to update note metadata');
        }
      } catch (err) {
        // Revert on error - use functional update to only revert if still at our state
        setCurrentNote((prevNote) => {
          // Only revert if the current state is still our optimistic update
          if (prevNote && updatedNote && prevNote.updatedAt === updatedNote.updatedAt) {
            return stateBeforeUpdate;
          }
          return prevNote;
        });
        setError(getErrorMessage(err, 'Failed to update note metadata'));
        log.error('Failed to update note metadata', {
          noteId: stateBeforeUpdate?.id,
          error: getErrorMessage(err),
        });
      }
    },
    [] // No dependencies needed - we use ref for current state
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

      // Record the open (new notes are always 'note' type initially)
      window.scribe.recentOpens
        .recordOpen(newNote.id, 'note')
        .catch((err) =>
          log.warn('Failed to record recent open', { noteId: newNote.id, error: err })
        );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create note'));
      log.error('Failed to create note', { error: getErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a note by ID
   * System notes cannot be deleted
   */
  const deleteNote = useCallback(
    async (id: NoteId) => {
      // Protect system notes from deletion
      if (isSystemNoteId(id)) {
        const errorMessage = 'System notes cannot be deleted';
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      setError(null);

      try {
        await window.scribe.notes.delete(id);

        // If we deleted the current note, clear it
        if (id === currentNoteId) {
          setCurrentNote(null);
          setCurrentNoteId(null);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to delete note'));
        log.error('Failed to delete note', { noteId: id, error: getErrorMessage(err) });
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
        log.error('Failed to initialize note', { error: getErrorMessage(err) });
        // If loading last note fails, clear error and create a new one
        setError(null);
        await createNote();
      }
    };

    initializeNote();
  }, [currentNoteId, isLoading, loadNote, createNote]);

  // Compute whether current note is a system note
  const isSystemNote = isSystemNoteId(currentNoteId);

  // Return a memoized object to ensure stable reference for consumers
  // This prevents unnecessary effect re-runs in components that depend on noteState
  return useMemo(
    () => ({
      currentNote,
      currentNoteId,
      isSystemNote,
      isLoading,
      error,
      loadNote,
      saveNote,
      updateMetadata,
      createNote,
      deleteNote,
    }),
    [
      currentNote,
      currentNoteId,
      isSystemNote,
      isLoading,
      error,
      loadNote,
      saveNote,
      updateMetadata,
      createNote,
      deleteNote,
    ]
  );
}
