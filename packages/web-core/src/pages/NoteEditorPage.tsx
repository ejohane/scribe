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
import { useQueryClient } from '@tanstack/react-query';
import { useTrpc } from '../providers/ScribeProvider.js';
import { useIsElectron } from '../providers/PlatformProvider.js';
import { CollaborativeEditor, type CollabEditorProps } from '../components/CollaborativeEditor.js';
import type { NoteDocument, EditorContent } from '@scribe/client-sdk';

/**
 * Compare two EditorContent objects for equality.
 * Used to detect if content change is from user edit vs Yjs sync.
 */
function contentEquals(a: EditorContent | null, b: EditorContent | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

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
  /** Whether to enable collaborative editing (default: true) */
  collaborative?: boolean;
  /** Render prop for the editor */
  renderEditor?: (
    content: EditorContent,
    onChange: (content: EditorContent) => void,
    collabProps?: CollabEditorProps
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
  collaborative = true,
  renderEditor,
  renderMenuButton,
  onSave,
  onError,
}: NoteEditorPageProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propNoteId || paramId;
  const navigate = useNavigate();
  const trpc = useTrpc();
  const queryClient = useQueryClient();
  const isElectron = useIsElectron();

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

  /** Track the initial content loaded from tRPC to detect Yjs sync overwrites */
  const initialContentRef = useRef<EditorContent | null>(null);
  /** Track if user has made actual edits (not just Yjs sync) */
  const hasUserEditedRef = useRef(false);

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
        // Track initial content to detect Yjs sync overwrites
        initialContentRef.current = result.content;
        hasUserEditedRef.current = false;

        // Mark note as accessed (fire-and-forget, don't block rendering)
        trpc.notes.markAccessed
          .mutate({ noteId: id })
          .then(() => {
            // Invalidate recent notes cache so palette shows updated order
            queryClient.invalidateQueries({ queryKey: ['notes', 'recentlyAccessed'] });
          })
          .catch((err) => {
            // Non-critical, just log
            console.warn('Failed to mark note as accessed:', err);
          });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load note';
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsLoading(false);
    }
  }, [id, trpc, queryClient, onError]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  // Save note content
  const saveNote = useCallback(
    async (content: EditorContent) => {
      console.log('[NoteEditorPage] saveNote called, id:', id, 'hasNote:', !!note);
      if (!id || !note) return;

      console.log('[NoteEditorPage] Calling trpc.notes.update');
      setIsSaving(true);
      try {
        const result = await trpc.notes.update.mutate({ id, content });
        console.log('[NoteEditorPage] Save SUCCESS, result:', result?.id);
        onSave?.(id, content);
      } catch (err) {
        console.error('[NoteEditorPage] Save FAILED:', err);
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
      console.log('[NoteEditorPage] handleContentChange called');

      // Only consider it a user edit if it MATCHES the initial content from tRPC
      // plus additional characters (user is building on the initial content).
      // If the content is DIFFERENT from initial but we haven't edited yet,
      // it's likely Yjs sync overwriting with stale data.
      const matchesInitial = contentEquals(content, initialContentRef.current);

      // If content matches initial, we're back to the loaded state - not a user edit
      // If content is different from initial AND we already marked user edit, allow save
      // If content is different from initial AND we haven't marked user edit, could be Yjs sync
      if (matchesInitial) {
        console.log('[NoteEditorPage] Content matches initial, not a user edit');
      } else if (hasUserEditedRef.current) {
        console.log('[NoteEditorPage] User has edited, allowing auto-save');
      } else {
        // Content is different from initial but no user edit marked yet
        // This is likely Yjs sync overwriting - DON'T mark as user edit
        console.log(
          '[NoteEditorPage] Content differs from initial but no user edit yet - likely Yjs sync, skipping'
        );
      }

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

      // Only auto-save if user has made edits (not just Yjs sync)
      if (hasUserEditedRef.current) {
        saveTimeoutRef.current = setTimeout(() => {
          if (pendingContentRef.current) {
            saveNote(pendingContentRef.current);
          }
        }, AUTO_SAVE_DELAY);
      } else {
        console.log('[NoteEditorPage] Skipping auto-save (no user edits yet)');
      }
    },
    [saveNote, TYPING_FADE_DELAY]
  );

  // Track user interaction to enable auto-save
  // This is more reliable than content comparison for detecting user edits vs Yjs sync
  const handleUserInteraction = useCallback(() => {
    if (!hasUserEditedRef.current) {
      hasUserEditedRef.current = true;
      console.log('[NoteEditorPage] User interaction detected, enabling auto-save');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Only save on unmount if user has made actual edits
        if (pendingContentRef.current && hasUserEditedRef.current) {
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
        {isElectron && (
          <div
            style={
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '40px',
                WebkitAppRegion: 'drag',
                zIndex: 40,
              } as React.CSSProperties
            }
            data-testid="titlebar-drag-region"
          />
        )}
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
        {isElectron && (
          <div
            style={
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '40px',
                WebkitAppRegion: 'drag',
                zIndex: 40,
              } as React.CSSProperties
            }
            data-testid="titlebar-drag-region"
          />
        )}
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
      {/* Titlebar drag region for Electron - clears macOS traffic lights */}
      {isElectron && (
        <div
          style={
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '40px',
              WebkitAppRegion: 'drag',
              zIndex: 40,
            } as React.CSSProperties
          }
          data-testid="titlebar-drag-region"
        />
      )}
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
      {/* Multiple handlers detect user interaction to enable auto-save (vs Yjs sync) */}
      <main
        data-testid="note-editor-content"
        onKeyDown={handleUserInteraction}
        onPointerDown={handleUserInteraction}
        onFocus={handleUserInteraction}
      >
        {renderEditor ? (
          collaborative && id ? (
            <CollaborativeEditor noteId={id}>
              {(collabProps) => renderEditor(note.content, handleContentChange, collabProps)}
            </CollaborativeEditor>
          ) : (
            renderEditor(note.content, handleContentChange)
          )
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
