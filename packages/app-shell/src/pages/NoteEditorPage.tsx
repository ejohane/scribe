/**
 * NoteEditorPage - Platform-agnostic note editor page component.
 *
 * Displays a single note for editing with auto-save functionality.
 * Uses tRPC via ScribeProvider for data operations and PlatformProvider
 * for platform-specific features like native file dialogs.
 *
 * @module
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrpc } from '../providers/ScribeProvider';
import { useDialogCapabilities, useIsElectron } from '../providers/PlatformProvider';
import type { NoteDocument, EditorContent } from '@scribe/client-sdk';

/** Auto-save debounce delay in milliseconds */
const AUTO_SAVE_DELAY = 1000;

/**
 * Props for NoteEditorPage component.
 */
export interface NoteEditorPageProps {
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
  renderError?: (error: string, onBack: () => void) => React.ReactNode;

  /**
   * Optional render prop for the editor.
   * Receives the note content and a callback for content changes.
   */
  renderEditor?: (
    content: EditorContent,
    onChange: (content: EditorContent) => void
  ) => React.ReactNode;

  /**
   * Optional callback when a note is saved.
   */
  onSave?: (noteId: string, content: EditorContent) => void;

  /**
   * Optional callback when an error occurs.
   */
  onError?: (error: Error) => void;
}

/**
 * Format save time for display.
 */
function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Platform-agnostic note editor page component.
 *
 * Displays a single note with title editing, content editing,
 * and actions like export and delete. Platform-specific features
 * (like native save dialogs) are only available when supported.
 *
 * @example
 * ```tsx
 * // Basic usage (requires custom editor)
 * function App() {
 *   return (
 *     <ScribeProvider daemonUrl="http://localhost:3000">
 *       <PlatformProvider platform="web" capabilities={{}}>
 *         <NoteEditorPage
 *           renderEditor={(content, onChange) => (
 *             <MyEditor initialContent={content} onChange={onChange} />
 *           )}
 *         />
 *       </PlatformProvider>
 *     </ScribeProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom styling and error handling
 * <NoteEditorPage
 *   className="my-editor-styles"
 *   onError={(error) => showToast(error.message)}
 *   renderEditor={(content, onChange) => <Editor content={content} onChange={onChange} />}
 * />
 * ```
 */
export function NoteEditorPage({
  className,
  renderLoading,
  renderError,
  renderEditor,
  onSave,
  onError,
}: NoteEditorPageProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const trpc = useTrpc();
  const dialogCapabilities = useDialogCapabilities();
  const isElectron = useIsElectron();

  // State for note data
  const [note, setNote] = useState<NoteDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for mutations
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-save refs
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<EditorContent | null>(null);

  // Fetch note on mount and when id changes
  const fetchNote = useCallback(async () => {
    if (!id) {
      setError('No note ID provided');
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
      console.error('[NoteEditorPage] Failed to fetch note:', err);
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
        await trpc.notes.update.mutate({
          id,
          content,
        });
        setLastSaved(new Date());
        onSave?.(id, content);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save note';
        setError(message);
        console.error('[NoteEditorPage] Failed to save note:', err);
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

  // Cleanup auto-save timeout and save pending content on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (pendingContentRef.current) {
          saveNote(pendingContentRef.current);
        }
      }
    };
  }, [saveNote]);

  // Update note title
  const handleTitleChange = useCallback(
    async (title: string) => {
      if (!id || !note) return;

      // Optimistic update
      setNote((prev) => (prev ? { ...prev, title } : null));

      try {
        await trpc.notes.update.mutate({
          id,
          title,
        });
      } catch (err) {
        // Revert on error
        setNote((prev) => (prev ? { ...prev, title: note.title } : null));
        const message = err instanceof Error ? err.message : 'Failed to update title';
        setError(message);
        console.error('[NoteEditorPage] Failed to update title:', err);
        onError?.(err instanceof Error ? err : new Error(message));
      }
    },
    [id, note, trpc, onError]
  );

  // Delete note
  const handleDelete = useCallback(async () => {
    if (!id) return;
    if (!window.confirm('Delete this note?')) return;

    setIsDeleting(true);

    try {
      await trpc.notes.delete.mutate(id);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete note';
      setError(message);
      console.error('[NoteEditorPage] Failed to delete note:', err);
      onError?.(err instanceof Error ? err : new Error(message));
      setIsDeleting(false);
    }
  }, [id, trpc, navigate, onError]);

  // Export note to markdown
  const handleExport = useCallback(async () => {
    if (!id) return;

    try {
      const result = await trpc.export.toMarkdown.query({ noteId: id });

      if (dialogCapabilities?.saveFile) {
        // Electron: use native save dialog
        await dialogCapabilities.saveFile(result.markdown, `${note?.title || 'note'}.md`);
      } else {
        // Web: copy to clipboard
        await navigator.clipboard.writeText(result.markdown);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export note';
      setError(message);
      console.error('[NoteEditorPage] Failed to export note:', err);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  }, [id, note, trpc, dialogCapabilities, onError]);

  // Navigate back to list
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Loading state
  if (isLoading) {
    if (renderLoading) {
      return <>{renderLoading()}</>;
    }
    return (
      <div className={className} data-testid="note-editor-page">
        <div data-testid="loading-state">Loading note...</div>
      </div>
    );
  }

  // Error state
  if (error || !note) {
    if (renderError && error) {
      return <>{renderError(error, handleBack)}</>;
    }
    return (
      <div className={className} data-testid="note-editor-page">
        <div data-testid="error-state">
          <p>{error || 'Note not found'}</p>
          <button onClick={handleBack} data-testid="back-button">
            Back to Notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="note-editor-page">
      <header data-testid="note-editor-header">
        <button onClick={handleBack} data-testid="back-button">
          Back
        </button>
        <input
          value={note.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          data-testid="title-input"
        />
        <div data-testid="note-actions">
          {isSaving && <span data-testid="saving-indicator">Saving...</span>}
          {lastSaved && !isSaving && (
            <span data-testid="last-saved">Saved {formatSavedTime(lastSaved)}</span>
          )}
          <button onClick={handleExport} data-testid="export-button">
            {isElectron ? 'Export' : 'Copy as Markdown'}
          </button>
          <button onClick={handleDelete} disabled={isDeleting} data-testid="delete-button">
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </header>

      <main data-testid="note-editor-content">
        {renderEditor ? (
          renderEditor(note.content, handleContentChange)
        ) : (
          <div data-testid="no-editor-provided">
            <p>No editor provided. Use the renderEditor prop to provide an editor component.</p>
            <pre>{JSON.stringify(note.content, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}
