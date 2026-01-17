/**
 * NoteListPage
 *
 * Displays a list of all notes in a minimal, clean interface.
 */

import { useEffect, useState, type FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribe, useScribeClient } from '../providers/ScribeProvider';
import type { NoteMetadata } from '@scribe/client-sdk';
import './NoteListPage.css';

/**
 * Format date for header display (e.g., "Friday, January 9")
 */
function formatHeaderDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date string for display.
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
 * Get greeting based on time of day
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 18) return 'Good afternoon!';
  return 'Good evening!';
}

// Icons as inline SVGs for simplicity
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const NoteIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * Inner component that renders the note list.
 */
const NoteListContent: FC = () => {
  const client = useScribeClient();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.api.notes.list.query({
        orderBy: 'updated_at',
        orderDir: 'desc',
      });
      setNotes(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [client]);

  const handleCreateNote = async (title?: string) => {
    try {
      const note = await client.api.notes.create.mutate({
        title: title || 'Untitled',
        type: 'note',
      });
      setNewNoteTitle('');
      navigate(`/note/${note.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to create note: ${message}`);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newNoteTitle.trim()) {
      handleCreateNote(newNoteTitle.trim());
    }
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await client.api.notes.delete.mutate(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setExpandedNote(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to delete note: ${message}`);
    }
  };

  const toggleExpand = (noteId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedNote(expandedNote === noteId ? null : noteId);
  };

  const getSummary = () => {
    if (notes.length === 0) return 'No notes yet. Create your first note to get started.';
    const recentCount = notes.filter((n) => {
      const diff = Date.now() - new Date(n.updatedAt).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    }).length;
    if (recentCount === 0)
      return `You have ${notes.length} notes. Take a moment to review or create something new.`;
    return `${getGreeting()} You have ${notes.length} notes, ${recentCount} updated this week.`;
  };

  return (
    <div className="app-container" data-testid="note-list-page">
      <header className="app-header">
        <button className="icon-btn menu-btn" aria-label="Menu">
          <MenuIcon />
        </button>
      </header>

      <main className="main-content">
        <div className="date-header">
          <div className="date-title">
            <span className="status-dot" />
            <h1>{formatHeaderDate()}</h1>
          </div>
          <button className="icon-btn" onClick={loadNotes} aria-label="Refresh" disabled={loading}>
            <RefreshIcon />
          </button>
        </div>

        {loading && (
          <p className="summary" data-testid="loading-state">
            Loading...
          </p>
        )}
        {!loading && <p className="summary">{getSummary()}</p>}

        {error && (
          <div className="error-banner" data-testid="error-state">
            Error: {error.message}
            <button onClick={loadNotes}>Retry</button>
          </div>
        )}

        <div className="items-list" data-testid="note-list">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`item ${expandedNote === note.id ? 'expanded' : ''}`}
              data-testid="note-item"
              onClick={(e) => toggleExpand(note.id, e)}
            >
              <div className="item-row">
                <span className="item-icon">
                  <NoteIcon />
                </span>
                <div className="item-content">
                  <span className="item-title">{note.title}</span>
                  <span className="item-subtitle">{formatDate(note.updatedAt)}</span>
                </div>
                <span className="item-chevron">
                  <ChevronIcon />
                </span>
              </div>

              {expandedNote === note.id && (
                <div className="item-expanded">
                  <p className="item-description">
                    Last modified {formatDate(note.updatedAt)}. Click to edit this note.
                  </p>
                  <div className="item-actions-row">
                    <div className="item-actions">
                      <Link to={`/note/${note.id}`} className="action-btn action-primary">
                        Open
                      </Link>
                      <button
                        className="action-btn action-secondary"
                        onClick={(e) => handleDeleteNote(note.id, e)}
                      >
                        Delete
                      </button>
                    </div>
                    <Link
                      to={`/note/${note.id}`}
                      className="item-external-link"
                      aria-label="Open note"
                    >
                      <ArrowIcon />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!loading && notes.length === 0 && (
          <div className="empty-state" data-testid="empty-state">
            <p>No notes yet</p>
            <button
              onClick={() => handleCreateNote()}
              className="action-btn action-primary"
              data-testid="create-first-note-button"
            >
              Create your first note
            </button>
          </div>
        )}

        <div className="note-input-container">
          <input
            type="text"
            className="note-input"
            placeholder="Add a note or reminder..."
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            onKeyDown={handleInputKeyDown}
            data-testid="create-note-input"
          />
        </div>
      </main>
    </div>
  );
};

/**
 * Home page component that displays the list of notes.
 */
export const NoteListPage: FC = () => {
  const { status, error, isConnected } = useScribe();

  if (status === 'connecting') {
    return (
      <div className="app-container" data-testid="note-list-page">
        <div className="center-message" data-testid="connecting-state">
          <div className="loading-spinner" />
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  if (error || status === 'error') {
    return (
      <div className="app-container" data-testid="note-list-page">
        <div className="center-message" data-testid="connection-error-state">
          <p className="error-text">{error?.message ?? 'Unknown error'}</p>
          <button onClick={() => window.location.reload()} className="action-btn action-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="app-container" data-testid="note-list-page">
        <div className="center-message" data-testid="disconnected-state">
          <p className="error-text">Disconnected</p>
          <button onClick={() => window.location.reload()} className="action-btn action-primary">
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  return <NoteListContent />;
};
