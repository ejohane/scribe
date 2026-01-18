/**
 * NoteListPage - Minimal notes list component.
 *
 * Displays a clean list of notes with the ability to create, open, and delete notes.
 * Designed to be used inside a sidebar/sheet component.
 *
 * @module
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrpc } from '../providers/ScribeProvider';
import type { NoteMetadata } from '@scribe/client-sdk';

/**
 * Props for NoteListPage component.
 */
export interface NoteListPageProps {
  /** Custom class name for the container */
  className?: string;
  /** Callback when a note is selected */
  onNoteSelect?: (id: string) => void;
  /** Currently selected note ID */
  selectedNoteId?: string;
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
 * Minimal notes list component.
 */
export function NoteListPage({ className = '', onNoteSelect, selectedNoteId }: NoteListPageProps) {
  const trpc = useTrpc();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.notes.list.query({
        limit: 100,
        orderBy: 'updated_at',
        orderDir: 'desc',
      });
      setNotes(result);
    } catch (err) {
      console.error('[NoteListPage] Failed to fetch notes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [trpc]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = useCallback(async () => {
    setIsCreating(true);
    try {
      const newNote = await trpc.notes.create.mutate({
        title: 'Untitled',
        type: 'note',
      });
      if (onNoteSelect) {
        onNoteSelect(newNote.id);
      } else {
        navigate(`/note/${newNote.id}`);
      }
    } catch (err) {
      console.error('[NoteListPage] Failed to create note:', err);
    } finally {
      setIsCreating(false);
    }
  }, [trpc, navigate, onNoteSelect]);

  const handleOpenNote = useCallback(
    (id: string) => {
      if (onNoteSelect) {
        onNoteSelect(id);
      } else {
        navigate(`/note/${id}`);
      }
    },
    [navigate, onNoteSelect]
  );

  const handleDeleteNote = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!window.confirm('Delete this note?')) return;

      setDeletingId(id);
      try {
        await trpc.notes.delete.mutate(id);
        setNotes((prev) => prev.filter((note) => note.id !== id));
      } catch (err) {
        console.error('[NoteListPage] Failed to delete note:', err);
      } finally {
        setDeletingId(null);
      }
    },
    [trpc]
  );

  return (
    <div className={`flex flex-col h-full ${className}`} data-testid="note-list-page">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h1 className="text-sm font-medium text-foreground/70">Notes</h1>
        <button
          onClick={handleCreateNote}
          disabled={isCreating}
          className="text-xs text-foreground/50 hover:text-foreground transition-colors disabled:opacity-50"
          data-testid="create-note-button"
        >
          {isCreating ? '...' : '+ New'}
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-foreground/40" data-testid="loading-state">
            Loading...
          </div>
        ) : notes.length === 0 ? (
          <div className="p-4 text-sm text-foreground/40" data-testid="empty-state">
            No notes yet
          </div>
        ) : (
          <ul className="divide-y divide-border/30" data-testid="note-list">
            {notes.map((note) => (
              <li key={note.id} data-testid={`note-item-${note.id}`}>
                <button
                  onClick={() => handleOpenNote(note.id)}
                  disabled={deletingId === note.id}
                  className={`w-full text-left p-4 hover:bg-accent/50 transition-colors group ${
                    selectedNoteId === note.id ? 'bg-accent/30' : ''
                  }`}
                  data-testid={`note-button-${note.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm text-foreground truncate flex-1"
                      data-testid={`note-title-${note.id}`}
                    >
                      {note.title || 'Untitled'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteNote(e, note.id)}
                      disabled={deletingId === note.id}
                      className="opacity-0 group-hover:opacity-100 text-xs text-foreground/30 hover:text-destructive transition-all ml-2"
                      data-testid={`delete-button-${note.id}`}
                    >
                      {deletingId === note.id ? '...' : 'x'}
                    </button>
                  </div>
                  <span
                    className="text-xs text-foreground/30 mt-0.5 block"
                    data-testid={`note-date-${note.id}`}
                  >
                    {formatDate(note.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
