/**
 * Hook for managing note loading and autosaving.
 * Handles load/save flow with debounced autosave and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CoreClient } from '@scribe/core-client';
import type { NoteId } from '@scribe/domain-model';

interface UseNoteEditorOptions {
  /** Core client instance */
  coreClient: CoreClient;
  /** Note ID to load */
  noteId?: NoteId;
  /** Autosave debounce delay in milliseconds */
  autosaveDelay?: number;
  /** Callback when save completes */
  onSaveSuccess?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
}

interface UseNoteEditorResult {
  /** Current note content */
  content: string;
  /** Loading state */
  isLoading: boolean;
  /** Saving state */
  isSaving: boolean;
  /** Load error */
  loadError: Error | null;
  /** Save error */
  saveError: Error | null;
  /** Update content (triggers autosave) */
  updateContent: (newContent: string) => void;
  /** Save immediately */
  saveNow: () => Promise<void>;
}

export function useNoteEditor(options: UseNoteEditorOptions): UseNoteEditorResult {
  const { coreClient, noteId, autosaveDelay = 1000, onSaveSuccess, onSaveError } = options;

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const autosaveTimerRef = useRef<number | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const currentNoteIdRef = useRef<NoteId | undefined>(noteId);

  /**
   * Load note content from the core engine.
   */
  const loadNote = useCallback(
    async (id: NoteId) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const noteContent = await coreClient.getNoteContent(id);
        setContent(noteContent);
        pendingContentRef.current = null; // Clear any pending changes
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load note');
        setLoadError(err);
        console.error('Failed to load note:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [coreClient]
  );

  /**
   * Save content to the core engine.
   */
  const saveContent = useCallback(
    async (id: NoteId, contentToSave: string) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        await coreClient.updateNoteContent(id, contentToSave);
        onSaveSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to save note');
        setSaveError(err);
        onSaveError?.(err);
        console.error('Failed to save note:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [coreClient, onSaveSuccess, onSaveError]
  );

  /**
   * Update content with debounced autosave.
   */
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      pendingContentRef.current = newContent;

      if (!noteId) return;

      // Clear existing timer
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      // Set up new autosave timer
      autosaveTimerRef.current = window.setTimeout(() => {
        if (pendingContentRef.current !== null) {
          saveContent(noteId, pendingContentRef.current);
          pendingContentRef.current = null;
        }
      }, autosaveDelay);
    },
    [noteId, autosaveDelay, saveContent]
  );

  /**
   * Save immediately without debouncing.
   */
  const saveNow = useCallback(async () => {
    if (!noteId) return;

    // Clear pending autosave
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const contentToSave = pendingContentRef.current !== null ? pendingContentRef.current : content;
    await saveContent(noteId, contentToSave);
    pendingContentRef.current = null;
  }, [noteId, content, saveContent]);

  /**
   * Load note when noteId changes.
   */
  useEffect(() => {
    if (noteId && noteId !== currentNoteIdRef.current) {
      currentNoteIdRef.current = noteId;
      loadNote(noteId);
    }
  }, [noteId, loadNote]);

  /**
   * Save on unmount if there are pending changes.
   */
  useEffect(() => {
    return () => {
      // Clear autosave timer
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      // Save pending changes on unmount
      if (pendingContentRef.current !== null && currentNoteIdRef.current) {
        // Fire and forget - we're unmounting
        coreClient
          .updateNoteContent(currentNoteIdRef.current, pendingContentRef.current)
          .catch((err) => console.error('Failed to save on unmount:', err));
      }
    };
  }, [coreClient]);

  /**
   * Save on blur (window loses focus).
   */
  useEffect(() => {
    const handleBlur = () => {
      if (pendingContentRef.current !== null && currentNoteIdRef.current) {
        saveContent(currentNoteIdRef.current, pendingContentRef.current);
        pendingContentRef.current = null;
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [saveContent]);

  return {
    content,
    isLoading,
    isSaving,
    loadError,
    saveError,
    updateContent,
    saveNow,
  };
}
