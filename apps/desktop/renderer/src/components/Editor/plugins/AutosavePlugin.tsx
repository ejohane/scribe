import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { EditorContent } from '@scribe/shared';
import { createLogger } from '@scribe/shared';

const log = createLogger({ prefix: 'AutosavePlugin' });

interface AutosavePluginProps {
  /** Callback to save editor content */
  onSave: (content: EditorContent) => Promise<void>;

  /** Debounce delay in milliseconds (default: 1000ms) */
  debounceMs?: number;
}

/**
 * Plugin to automatically save editor content with debouncing
 *
 * Watches for editor state changes and calls the onSave callback
 * after the specified debounce delay. This prevents excessive save
 * operations while typing.
 */
export function AutosavePlugin({ onSave, debounceMs = 1000 }: AutosavePluginProps) {
  const [editor] = useLexicalComposerContext();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    // Register update listener
    const removeUpdateListener = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        // Only save if there are actual changes
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return;
        }

        // Clear any pending save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Schedule a new save
        saveTimeoutRef.current = setTimeout(async () => {
          if (isSavingRef.current) {
            return;
          }

          isSavingRef.current = true;

          try {
            // Serialize the editor state to JSON
            const json = editorState.toJSON();
            await onSave(json as EditorContent);
          } catch (error) {
            log.error('Autosave failed', { error });
          } finally {
            isSavingRef.current = false;
          }
        }, debounceMs);
      }
    );

    // Cleanup on unmount
    return () => {
      removeUpdateListener();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, onSave, debounceMs]);

  return null;
}
