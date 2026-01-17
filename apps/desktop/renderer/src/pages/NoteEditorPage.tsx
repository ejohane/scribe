/**
 * NoteEditorPage
 *
 * Displays a single note for editing. Uses tRPC for data operations
 * and the existing EditorRoot component for rich text editing.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useElectron } from '../providers/ElectronProvider';
import { EditorRoot } from '../components/Editor/EditorRoot';
import { WikiLinkProvider } from '../components/Editor/plugins/WikiLinkContext';
import { PersonMentionProvider } from '../components/Editor/plugins/PersonMentionContext';
import { EditorCommandProvider } from '../components/Editor/EditorCommandContext';
import type { NoteDocument, EditorContent as ServerEditorContent } from '@scribe/server-core';
import type { NoteId, Note, EditorContent, SearchResult } from '@scribe/shared';
import * as styles from './NoteEditorPage.css';

/**
 * Convert server NoteDocument to the Note type expected by EditorRoot.
 * Maps 'note' type to undefined (regular note) for type compatibility.
 *
 * Note: We use type assertions here because server-core and shared have
 * slightly different EditorContent types (LexicalNode[] vs EditorNode[]).
 * The runtime structure is identical.
 */
function toNote(doc: NoteDocument): Note {
  // Map 'note' type to undefined (regular note) for the Note discriminated union
  const noteType = doc.type === 'note' ? undefined : (doc.type as Note['type']);

  return {
    id: doc.id as NoteId,
    title: doc.title,
    type: noteType,
    // Cast content - server-core and shared types are structurally compatible
    content: doc.content as unknown as EditorContent,
    tags: [], // Not in NoteDocument, default to empty
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
    createdAt: new Date(doc.createdAt).getTime(),
    updatedAt: new Date(doc.updatedAt).getTime(),
  } as Note;
}

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trpc, isReady } = useElectron();

  // State for note data
  const [note, setNote] = useState<NoteDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for mutations
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch note on mount, id change, and when tRPC becomes ready
  const fetchNote = useCallback(async () => {
    if (!id) {
      setError('No note ID provided');
      setIsLoading(false);
      return;
    }

    if (!trpc) return;

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
    } finally {
      setIsLoading(false);
    }
  }, [id, trpc]);

  useEffect(() => {
    if (isReady && trpc) {
      fetchNote();
    }
  }, [isReady, trpc, fetchNote]);

  // Save note content
  const handleSave = useCallback(
    async (content: EditorContent) => {
      if (!id || !note || !trpc) return;

      setIsSaving(true);

      try {
        await trpc.notes.update.mutate({
          id,
          content,
        });

        // Update local state with new content
        // Cast content to server type - structurally compatible
        setNote((prev) =>
          prev
            ? {
                ...prev,
                content: content as unknown as ServerEditorContent,
                updatedAt: new Date().toISOString(),
              }
            : null
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save note';
        setError(message);
        console.error('[NoteEditorPage] Failed to save note:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [id, note, trpc]
  );

  // Update note title
  const handleTitleChange = useCallback(
    async (title: string) => {
      if (!id || !note || !trpc) return;

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
      }
    },
    [id, note, trpc]
  );

  // Delete note
  const handleDelete = useCallback(async () => {
    if (!id || !trpc) return;
    if (!window.confirm('Delete this note?')) return;

    setIsDeleting(true);

    try {
      await trpc.notes.delete.mutate(id);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete note';
      setError(message);
      console.error('[NoteEditorPage] Failed to delete note:', err);
      setIsDeleting(false);
    }
  }, [id, trpc, navigate]);

  // Export note to markdown
  const handleExport = useCallback(async () => {
    if (!id || !trpc) return;

    try {
      const result = await trpc.export.toMarkdown.query({ noteId: id });
      await navigator.clipboard.writeText(result.markdown);
      // Could show a toast notification here
      console.log('[NoteEditorPage] Copied markdown to clipboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export note';
      setError(message);
      console.error('[NoteEditorPage] Failed to export note:', err);
    }
  }, [id, trpc]);

  // Navigate back to list
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Handle wiki-link clicks
  const handleWikiLinkClick = useCallback(
    async (_noteTitle: string, targetId: NoteId | null) => {
      if (targetId) {
        navigate(`/note/${targetId}`);
      }
    },
    [navigate]
  );

  // Search notes for wiki-link autocomplete
  const handleSearchNotes = useCallback(
    async (query: string, limit: number): Promise<SearchResult[]> => {
      if (!trpc) return [];
      try {
        const results = await trpc.search.query.query({
          text: query,
          options: { limit },
        });
        // Map search results to SearchResult format expected by WikiLinkPlugin
        return results.map((r) => ({
          id: r.note.id as NoteId,
          title: r.note.title,
          snippet: r.snippet,
          score: r.score,
          // Map matchedIn to matches format
          matches: r.matchedIn.map((location) => ({
            field: location as 'title' | 'tags' | 'content',
            positions: [], // Positions not provided by server-core search
          })),
        }));
      } catch (err) {
        console.error('[NoteEditorPage] Search failed:', err);
        return [];
      }
    },
    [trpc]
  );

  // Handle person mention clicks
  const handlePersonMentionClick = useCallback(
    async (personId: NoteId) => {
      navigate(`/note/${personId}`);
    },
    [navigate]
  );

  // Stub implementations for unused UseNoteStateReturn properties
  const loadNote = useCallback(
    async (noteId: NoteId) => {
      navigate(`/note/${noteId}`);
    },
    [navigate]
  );

  const createNote = useCallback(async () => {
    // Handled by NoteListPage
  }, []);

  const deleteNote = useCallback(async (_noteId: NoteId) => {
    // Handled by handleDelete
  }, []);

  const updateMetadata = useCallback(async () => {
    // Title changes handled by handleTitleChange
  }, []);

  // Create noteState object for EditorRoot
  const noteState = useMemo(
    () => ({
      currentNote: note ? toNote(note) : null,
      currentNoteId: (id as NoteId) || null,
      isSystemNote: false,
      isLoading,
      error,
      saveNote: handleSave,
      loadNote,
      createNote,
      deleteNote,
      updateMetadata,
    }),
    [note, id, isLoading, error, handleSave, loadNote, createNote, deleteNote, updateMetadata]
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading note...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button onClick={handleBack} className={styles.backButton}>
            Back to Notes
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Note not found</p>
          <button onClick={handleBack} className={styles.backButton}>
            Back to Notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back
        </button>
        <input
          value={note.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Note title"
          className={styles.titleInput}
        />
        <div className={styles.actions}>
          {isSaving && <span className={styles.savingIndicator}>Saving...</span>}
          <button onClick={handleExport} className={styles.actionButton} title="Copy as Markdown">
            Export
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={styles.deleteButton}
            title="Delete note"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </header>

      <EditorCommandProvider>
        <WikiLinkProvider
          currentNoteId={id as NoteId}
          onLinkClick={handleWikiLinkClick}
          onError={(msg) => setError(msg)}
          searchNotes={handleSearchNotes}
        >
          <PersonMentionProvider
            currentNoteId={id as NoteId}
            onMentionClick={handlePersonMentionClick}
            onError={(msg) => setError(msg)}
          >
            <div className={styles.editorWrapper}>
              <EditorRoot noteState={noteState} />
            </div>
          </PersonMentionProvider>
        </WikiLinkProvider>
      </EditorCommandProvider>
    </div>
  );
}
