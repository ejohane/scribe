import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { EditorContent } from '@scribe/shared';
import { createLogger } from '@scribe/shared';
import type { SerializedEditorState } from 'lexical';

const log = createLogger({ prefix: 'InitialStatePlugin' });

interface InitialStatePluginProps {
  /** Initial editor state to load */
  initialState: EditorContent | null;
  /** Note ID to track when we should reload */
  noteId: string | null;
}

/**
 * Plugin to initialize the editor with saved Lexical state
 *
 * This loads the note content into the editor when a note is first loaded.
 * Only reloads when the note ID changes, not on every render.
 */
export function InitialStatePlugin({ initialState, noteId }: InitialStatePluginProps) {
  const [editor] = useLexicalComposerContext();
  const loadedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only load if we have a new note
    if (!noteId || loadedNoteIdRef.current === noteId) {
      return;
    }

    // Skip if no content or empty content
    if (!initialState || !initialState.root || initialState.root.children.length === 0) {
      loadedNoteIdRef.current = noteId;
      // Focus editor for new/empty notes
      editor.focus();
      return;
    }

    // Parse the Lexical JSON state and set it in the editor
    try {
      const editorState = editor.parseEditorState(initialState as SerializedEditorState);
      editor.setEditorState(editorState);
      loadedNoteIdRef.current = noteId;
      // Focus editor after loading content
      editor.focus();
    } catch (error) {
      log.error('Failed to load editor state', { noteId, error });
    }
  }, [editor, initialState, noteId]);

  return null;
}
