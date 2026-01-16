/**
 * NoteListPage
 *
 * Displays a list of all notes and allows navigation to individual notes.
 * Fetches notes from the daemon and displays them in a sortable list.
 */

import { useEffect, useState, type FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribe, useScribeClient } from '../providers/ScribeProvider';
import type { NoteMetadata } from '@scribe/client-sdk';
import './NoteListPage.css';

/**
 * Format a date string for display.
 * Shows relative time for recent dates (Today, Yesterday, N days ago).
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString();
}

/**
 * Inner component that renders the note list.
 * Assumes the client is connected.
 */
const NoteListContent: FC = () => {
  const client = useScribeClient();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch notes on mount
  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      try {
        setLoading(true);
        setError(null);
        const result = await client.api.notes.list.query({
          orderBy: 'updated_at',
          orderDir: 'desc',
        });
        if (!cancelled) {
          setNotes(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNotes();

    return () => {
      cancelled = true;
    };
  }, [client]);

  // Create new note handler
  const handleCreateNote = async () => {
    try {
      const note = await client.api.notes.create.mutate({
        title: 'Untitled',
        type: 'note',
      });
      navigate(`/note/${note.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to create note: ${message}`);
    }
  };

  if (loading) {
    return (
      <div className="note-list-page" data-testid="note-list-page">
        <header className="page-header">
          <h1>Notes</h1>
        </header>
        <div className="loading" data-testid="loading-state">
          Loading notes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="note-list-page" data-testid="note-list-page">
        <header className="page-header">
          <h1>Notes</h1>
        </header>
        <div className="error" data-testid="error-state">
          Error: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="note-list-page" data-testid="note-list-page">
      <header className="page-header">
        <h1>Notes</h1>
        <button onClick={handleCreateNote} className="create-btn" data-testid="create-note-button">
          + New Note
        </button>
      </header>

      {notes.length === 0 ? (
        <div className="empty-state" data-testid="empty-state">
          <p>No notes yet</p>
          <button onClick={handleCreateNote} data-testid="create-first-note-button">
            Create your first note
          </button>
        </div>
      ) : (
        <ul className="note-list" data-testid="note-list">
          {notes.map((note) => (
            <li key={note.id}>
              <Link to={`/note/${note.id}`} className="note-item" data-testid="note-item">
                <span className="note-title">{note.title}</span>
                <span className="note-meta">
                  {note.type} • {formatDate(note.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Home page component that displays the list of notes.
 * Handles connection state and renders content when connected.
 */
export const NoteListPage: FC = () => {
  const { status, error, isConnected } = useScribe();

  // Show connecting state
  if (status === 'connecting') {
    return (
      <div className="note-list-page" data-testid="note-list-page">
        <header className="page-header">
          <h1>Notes</h1>
        </header>
        <div className="loading" data-testid="connecting-state">
          Connecting to daemon...
        </div>
      </div>
    );
  }

  // Show error state
  if (error || status === 'error') {
    return (
      <div className="note-list-page" data-testid="note-list-page">
        <header className="page-header">
          <h1>Notes</h1>
        </header>
        <div className="error" data-testid="connection-error-state">
          Connection error: {error?.message ?? 'Unknown error'}
          <button onClick={() => window.location.reload()} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show disconnected state
  if (!isConnected) {
    return (
      <div className="note-list-page" data-testid="note-list-page">
        <header className="page-header">
          <h1>Notes</h1>
        </header>
        <div className="error" data-testid="disconnected-state">
          Disconnected from daemon
          <button onClick={() => window.location.reload()} className="retry-btn">
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  // Render note list when connected
  return <NoteListContent />;
};
