/**
 * NoteListPage
 *
 * Displays a list of all notes with the ability to create new notes,
 * open existing notes, and delete notes. Uses tRPC for data operations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectron } from '../providers/ElectronProvider';
import type { NoteMetadata } from '@scribe/server-core';
import * as styles from './NoteListPage.css';

export function NoteListPage() {
  const { electron, trpc, isReady } = useElectron();
  const navigate = useNavigate();

  // State for notes list
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for mutations
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch notes on mount and when tRPC becomes ready
  const fetchNotes = useCallback(async () => {
    if (!trpc) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await trpc.notes.list.query({
        limit: 100,
        orderBy: 'updated_at',
        orderDir: 'desc',
      });
      setNotes(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notes';
      setError(message);
      console.error('[NoteListPage] Failed to fetch notes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [trpc]);

  useEffect(() => {
    if (isReady && trpc) {
      fetchNotes();
    }
  }, [isReady, trpc, fetchNotes]);

  // Create a new note
  const handleCreateNote = useCallback(async () => {
    if (!trpc) return;
    setIsCreating(true);

    try {
      const newNote = await trpc.notes.create.mutate({
        title: 'Untitled',
        type: 'note',
      });
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create note';
      setError(message);
      console.error('[NoteListPage] Failed to create note:', err);
    } finally {
      setIsCreating(false);
    }
  }, [trpc, navigate]);

  // Open a note in the current window
  const handleOpenNote = useCallback(
    (id: string) => {
      navigate(`/note/${id}`);
    },
    [navigate]
  );

  // Open a note in a new window
  const handleOpenInNewWindow = useCallback(
    async (id: string) => {
      try {
        await electron.window.openNote(id);
      } catch (err) {
        console.error('[NoteListPage] Failed to open note in new window:', err);
      }
    },
    [electron]
  );

  // Delete a note
  const handleDeleteNote = useCallback(
    async (id: string) => {
      if (!trpc) return;
      if (!window.confirm('Delete this note?')) {
        return;
      }

      setDeletingId(id);

      try {
        await trpc.notes.delete.mutate(id);
        // Remove from local state
        setNotes((prev) => prev.filter((note) => note.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete note';
        setError(message);
        console.error('[NoteListPage] Failed to delete note:', err);
      } finally {
        setDeletingId(null);
      }
    },
    [trpc]
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading notes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button onClick={fetchNotes} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Notes</h1>
        <button onClick={handleCreateNote} disabled={isCreating} className={styles.newButton}>
          {isCreating ? 'Creating...' : 'New Note'}
        </button>
      </header>

      {notes.length === 0 ? (
        <p className={styles.emptyState}>No notes yet. Create your first note!</p>
      ) : (
        <ul className={styles.noteList}>
          {notes.map((note) => (
            <li key={note.id} className={styles.noteItem}>
              <button
                onClick={() => handleOpenNote(note.id)}
                className={styles.noteButton}
                disabled={deletingId === note.id}
              >
                <span className={styles.noteTitle}>{note.title || 'Untitled'}</span>
                <span className={styles.noteDate}>
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </button>
              <div className={styles.noteActions}>
                <button
                  onClick={() => handleOpenInNewWindow(note.id)}
                  className={styles.actionButton}
                  title="Open in new window"
                  disabled={deletingId === note.id}
                >
                  ↗
                </button>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className={styles.actionButton}
                  title="Delete note"
                  disabled={deletingId === note.id}
                >
                  {deletingId === note.id ? '...' : '×'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
