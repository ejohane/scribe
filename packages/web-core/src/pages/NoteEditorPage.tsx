/**
 * NoteEditorPage - Minimal note editor page component.
 *
 * Displays a single note for editing with auto-save functionality.
 * Super minimal design - just the editor with an optional menu trigger.
 *
 * @module
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrpc } from '../providers/ScribeProvider';
import type { NoteDocument, EditorContent } from '@scribe/client-sdk';

/** Auto-save debounce delay in milliseconds */
const AUTO_SAVE_DELAY = 1000;

/**
 * Props for NoteEditorPage component.
 */
export interface NoteEditorPageProps {
  /** Custom class name for the container */
  className?: string;
  /** Note ID to load (overrides URL param) */
  noteId?: string;
  /** Render prop for the editor */
  renderEditor?: (
    content: EditorContent,
    onChange: (content: EditorContent) => void
  ) => React.ReactNode;
  /** Render prop for the menu button in upper left */
  renderMenuButton?: () => React.ReactNode;
  /** Callback when note is saved */
  onSave?: (noteId: string, content: EditorContent) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Minimal note editor page component.
 */
export function NoteEditorPage({
  className = '',
  noteId: propNoteId,
  renderEditor,
  renderMenuButton,
  onSave,
  onError,
}: NoteEditorPageProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propNoteId || paramId;
  const navigate = useNavigate();
  const trpc = useTrpc();

  const [note, setNote] = useState<NoteDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<EditorContent | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /** Delay before chrome reappears after typing stops (ms) */
  const TYPING_FADE_DELAY = 1500;

  // Fetch note
  const fetchNote = useCallback(async () => {
    if (!id) {
      setError('No note ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await trpc.notes.get.query(id);
      if (!result) {
        setError('Note not found');
      } else {
        setNote(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load note';
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  }, [id, trpc, onError]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  // Save note content
  const saveNote = useCallback(
    async (content: EditorContent) => {
      if (!id || !note) return;

      setIsSaving(true);
      try {
        await trpc.notes.update.mutate({ id, content });
        onSave?.(id, content);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save';
        onError?.(err instanceof Error ? err : new Error(message));
      } finally {
        setIsSaving(false);
      }
    },
    [id, note, trpc, onSave, onError]
  );

  // Handle content changes with debounced auto-save
  const handleContentChange = useCallback(
    (content: EditorContent) => {
      pendingContentRef.current = content;

      // Track typing state for chrome fade
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, TYPING_FADE_DELAY);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }, AUTO_SAVE_DELAY);
    },
    [saveNote, TYPING_FADE_DELAY]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [saveNote]);

  // Loading state - minimal, just empty space
  if (isLoading) {
    return (
      <div className={className} data-testid="note-editor-page" data-typing={isTyping}>
        {renderMenuButton && (
          <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50 }}>
            {renderMenuButton()}
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error || !note) {
    return (
      <div className={className} data-testid="note-editor-page" data-typing={isTyping}>
        {renderMenuButton && (
          <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50 }}>
            {renderMenuButton()}
          </div>
        )}
        <main data-testid="note-editor-content">
          <div data-testid="error-state" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--foreground)', opacity: 0.4 }}>{error || 'Note not found'}</p>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: '1rem',
                background: 'none',
                border: 'none',
                color: 'var(--foreground)',
                opacity: 0.3,
                cursor: 'pointer',
              }}
              data-testid="back-button"
            >
              Back to notes
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={className} data-testid="note-editor-page" data-typing={isTyping}>
      {/* Menu button - upper left corner */}
      {renderMenuButton && (
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50 }}>
          {renderMenuButton()}
        </div>
      )}

      {/* Saving indicator - very subtle, upper right */}
      {isSaving && (
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
          <span
            style={{ fontSize: '0.75rem', color: 'var(--foreground)', opacity: 0.15 }}
            data-testid="saving-indicator"
          >
            Saving...
          </span>
        </div>
      )}

      {/* Editor - minimal centered layout */}
      <main data-testid="note-editor-content">
        {renderEditor ? (
          renderEditor(note.content, handleContentChange)
        ) : (
          <div
            style={{ color: 'var(--foreground)', opacity: 0.3 }}
            data-testid="no-editor-provided"
          >
            No editor provided
          </div>
        )}
      </main>
    </div>
  );
}
