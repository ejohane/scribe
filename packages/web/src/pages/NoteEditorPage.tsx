/**
 * NoteEditorPage
 *
 * Full-screen editor for a single note with auto-save and Yjs collaboration.
 * Loads note from daemon, displays in Lexical editor, and saves changes automatically.
 */

import { useEffect, useState, useCallback, useRef, type FC } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useScribe, useScribeClient } from '../providers/ScribeProvider';
import { ScribeEditor, type EditorContent } from '@scribe/editor';
import { YjsProvider, useYjs, LexicalYjsPlugin } from '@scribe/collab';
import type { NoteDocument } from '@scribe/client-sdk';
import './NoteEditorPage.css';

/** Auto-save debounce delay in milliseconds */
const AUTO_SAVE_DELAY = 1000;

/**
 * Format last saved time for display.
 */
function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Inner component for the editor that has access to Yjs context.
 */
interface EditorWithYjsProps {
  initialContent: EditorContent;
  onChange: (content: EditorContent) => void;
}

const EditorWithYjs: FC<EditorWithYjsProps> = ({ initialContent, onChange }) => {
  const { doc, isLoading, error } = useYjs();

  if (isLoading) {
    return (
      <div className="loading" data-testid="collab-loading">
        Syncing...
      </div>
    );
  }

  if (error) {
    // Fall back to non-collaborative editing when collab fails
    console.warn('Collaboration unavailable:', error);
  }

  return (
    <ScribeEditor
      initialContent={initialContent}
      onChange={onChange}
      yjsDoc={doc ?? undefined}
      YjsPlugin={doc ? LexicalYjsPlugin : undefined}
      autoFocus
    />
  );
};

/**
 * Inner component that renders the note editor content.
 * Assumes the client is connected.
 */
interface NoteEditorContentProps {
  id: string;
}

const NoteEditorContent: FC<NoteEditorContentProps> = ({ id }) => {
  const client = useScribeClient();
  const navigate = useNavigate();
  const [note, setNote] = useState<NoteDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Refs for debouncing auto-save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<EditorContent | null>(null);

  // Load note on mount or when id changes
  useEffect(() => {
    let cancelled = false;

    async function loadNote() {
      try {
        setLoading(true);
        setError(null);
        const result = await client.api.notes.get.query(id);

        if (!cancelled) {
          if (!result) {
            setError(new Error('Note not found'));
          } else {
            setNote(result);
          }
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

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [client, id]);

  // Save function
  const saveNote = useCallback(
    async (content: EditorContent) => {
      if (!note) return;

      try {
        setSaving(true);
        await client.api.notes.update.mutate({
          id,
          content,
        });
        setLastSaved(new Date());
      } catch (err) {
        console.error('Save failed:', err);
      } finally {
        setSaving(false);
      }
    },
    [client, id, note]
  );

  // Debounced auto-save on content change
  const handleChange = useCallback(
    (content: EditorContent) => {
      pendingContentRef.current = content;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }, AUTO_SAVE_DELAY);
    },
    [saveNote]
  );

  // Cleanup timeout on unmount, saving any pending changes
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save any pending changes immediately on unmount
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }
    };
  }, [saveNote]);

  // Update title handler
  const handleTitleChange = async (newTitle: string) => {
    if (!note) return;

    try {
      await client.api.notes.update.mutate({
        id,
        title: newTitle,
      });
      setNote({ ...note, title: newTitle });
    } catch (err) {
      console.error('Title update failed:', err);
    }
  };

  // Delete note handler
  const handleDelete = async () => {
    if (!window.confirm('Delete this note?')) return;

    try {
      await client.api.notes.delete.mutate(id);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Delete failed: ${message}`);
    }
  };

  if (loading) {
    return (
      <div className="note-editor-page" data-testid="note-editor-page">
        <header className="editor-header">
          <Link to="/" className="back-link" data-testid="back-link">
            &larr; Notes
          </Link>
        </header>
        <div className="loading" data-testid="loading-state">
          Loading note...
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="note-editor-page" data-testid="note-editor-page">
        <header className="editor-header">
          <Link to="/" className="back-link" data-testid="back-link">
            &larr; Notes
          </Link>
        </header>
        <div className="error" data-testid="error-state">
          <p>{error?.message ?? 'Note not found'}</p>
          <Link to="/" className="back-btn">
            Back to notes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="note-editor-page" data-testid="note-editor-page">
      <header className="editor-header">
        <Link to="/" className="back-link" data-testid="back-link">
          &larr; Notes
        </Link>

        <input
          type="text"
          className="note-title-input"
          value={note.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          aria-label="Note title"
          data-testid="note-title-input"
        />

        <div className="editor-actions">
          <span className="save-status" data-testid="save-status">
            {saving ? 'Saving...' : lastSaved ? `Saved ${formatSavedTime(lastSaved)}` : ''}
          </span>
          <button onClick={handleDelete} className="delete-btn" data-testid="delete-btn">
            Delete
          </button>
        </div>
      </header>

      <main className="editor-main">
        <YjsProvider noteId={id} collabClient={client.collab}>
          {/* Cast note.content to EditorContent - they are semantically compatible
              but TypeScript sees different type definitions */}
          <EditorWithYjs initialContent={note.content as EditorContent} onChange={handleChange} />
        </YjsProvider>
      </main>
    </div>
  );
};

/**
 * Note editor page component.
 * Handles connection state and renders editor when connected.
 */
export const NoteEditorPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { status, error, isConnected } = useScribe();

  // Show connecting state
  if (status === 'connecting') {
    return (
      <div className="note-editor-page" data-testid="note-editor-page">
        <header className="editor-header">
          <Link to="/" className="back-link" data-testid="back-link">
            &larr; Notes
          </Link>
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
      <div className="note-editor-page" data-testid="note-editor-page">
        <header className="editor-header">
          <Link to="/" className="back-link" data-testid="back-link">
            &larr; Notes
          </Link>
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
      <div className="note-editor-page" data-testid="note-editor-page">
        <header className="editor-header">
          <Link to="/" className="back-link" data-testid="back-link">
            &larr; Notes
          </Link>
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

  // Handle missing id parameter (shouldn't happen with proper routing)
  if (!id) {
    return (
      <div className="note-editor-page" data-testid="note-editor-page">
        <header className="editor-header">
          <Link to="/" className="back-link" data-testid="back-link">
            &larr; Notes
          </Link>
        </header>
        <div className="error" data-testid="error-state">
          <p>No note ID provided</p>
          <Link to="/" className="back-btn">
            Back to notes
          </Link>
        </div>
      </div>
    );
  }

  // Render editor when connected
  return <NoteEditorContent id={id} />;
};
