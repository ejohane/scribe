/**
 * NoteListPage - Platform-agnostic notes list page component.
 *
 * Displays a list of notes with the ability to create, open, and delete notes.
 * Uses tRPC via ScribeProvider for data operations and PlatformProvider
 * for platform-specific features like opening notes in new windows.
 *
 * @module
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrpc } from '../providers/ScribeProvider';
import { usePlatform, useIsElectron, useWindowCapabilities } from '../providers/PlatformProvider';
import type { NoteMetadata } from '@scribe/client-sdk';

/**
 * Props for NoteListPage component.
 */
export interface NoteListPageProps {
  /**
   * Custom class name for the container element.
   */
  className?: string;

  /**
   * Optional render prop for loading state.
   */
  renderLoading?: () => React.ReactNode;

  /**
   * Optional render prop for error state.
   */
  renderError?: (error: string, retry: () => void) => React.ReactNode;

  /**
   * Optional render prop for empty state.
   */
  renderEmpty?: (onCreate: () => void) => React.ReactNode;
}

/**
 * Format a date for display.
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Platform-agnostic notes list page component.
 *
 * Displays notes with create, open, and delete functionality.
 * Platform-specific features (like opening in new windows) are only
 * available when the platform supports them.
 *
 * @example
 * ```tsx
 * // Basic usage
 * function App() {
 *   return (
 *     <ScribeProvider daemonUrl="http://localhost:3000">
 *       <PlatformProvider platform="web" capabilities={{}}>
 *         <NoteListPage />
 *       </PlatformProvider>
 *     </ScribeProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom styling
 * <NoteListPage className="my-custom-styles" />
 * ```
 *
 * @example
 * ```tsx
 * // With custom render props
 * <NoteListPage
 *   renderLoading={() => <MyLoadingSpinner />}
 *   renderError={(error, retry) => <MyErrorView error={error} onRetry={retry} />}
 *   renderEmpty={(onCreate) => <MyEmptyState onCreateNote={onCreate} />}
 * />
 * ```
 */
export function NoteListPage({
  className,
  renderLoading,
  renderError,
  renderEmpty,
}: NoteListPageProps = {}) {
  const trpc = useTrpc();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();
  const isElectron = useIsElectron();
  const windowCapabilities = useWindowCapabilities();

  // State for notes list
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for mutations
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch notes on mount
  const fetchNotes = useCallback(async () => {
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
    fetchNotes();
  }, [fetchNotes]);

  // Create a new note
  const handleCreateNote = useCallback(async () => {
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

  // Open a note in a new window (Electron only)
  const handleOpenInNewWindow = useCallback(
    (id: string) => {
      windowCapabilities?.openNoteInWindow(id);
    },
    [windowCapabilities]
  );

  // Delete a note
  const handleDeleteNote = useCallback(
    async (id: string) => {
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

  // Loading state
  if (isLoading) {
    if (renderLoading) {
      return <>{renderLoading()}</>;
    }
    return (
      <div className={className} data-testid="note-list-page">
        <div data-testid="loading-state">Loading notes...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    if (renderError) {
      return <>{renderError(error, fetchNotes)}</>;
    }
    return (
      <div className={className} data-testid="note-list-page">
        <div data-testid="error-state">
          <p>Error: {error}</p>
          <button onClick={fetchNotes} data-testid="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="note-list-page">
      <header data-testid="note-list-header">
        <h1>Notes</h1>
        <div>
          <button onClick={handleCreateNote} disabled={isCreating} data-testid="create-note-button">
            {isCreating ? 'Creating...' : 'New Note'}
          </button>
          {isElectron && capabilities.window?.openNewWindow && (
            <button
              onClick={() => capabilities.window?.openNewWindow()}
              data-testid="new-window-button"
            >
              New Window
            </button>
          )}
        </div>
      </header>

      {notes.length === 0 ? (
        renderEmpty ? (
          renderEmpty(handleCreateNote)
        ) : (
          <p data-testid="empty-state">No notes yet. Create your first note!</p>
        )
      ) : (
        <ul data-testid="note-list">
          {notes.map((note) => (
            <li key={note.id} data-testid={`note-item-${note.id}`}>
              <button
                onClick={() => handleOpenNote(note.id)}
                disabled={deletingId === note.id}
                data-testid={`note-button-${note.id}`}
              >
                <span data-testid={`note-title-${note.id}`}>{note.title || 'Untitled'}</span>
                <span data-testid={`note-date-${note.id}`}>{formatDate(note.updatedAt)}</span>
              </button>
              <div>
                {windowCapabilities?.openNoteInWindow && (
                  <button
                    onClick={() => handleOpenInNewWindow(note.id)}
                    disabled={deletingId === note.id}
                    title="Open in new window"
                    data-testid={`open-in-window-button-${note.id}`}
                  >
                    Open in Window
                  </button>
                )}
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  disabled={deletingId === note.id}
                  title="Delete note"
                  data-testid={`delete-button-${note.id}`}
                >
                  {deletingId === note.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
