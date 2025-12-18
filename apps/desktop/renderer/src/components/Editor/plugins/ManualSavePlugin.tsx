import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_NORMAL, KEY_DOWN_COMMAND } from 'lexical';
import type { EditorContent } from '@scribe/shared';

interface ManualSavePluginProps {
  /** Callback to save editor content */
  onSave: (content: EditorContent) => Promise<void>;
}

/**
 * Plugin to handle manual save via cmd/ctrl+s
 *
 * This bypasses autosave debouncing and immediately saves the current
 * editor state when the user presses cmd/ctrl+s.
 */
export function ManualSavePlugin({ onSave }: ManualSavePluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register command to handle keyboard events
    const removeCommand = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const { key, metaKey, ctrlKey } = event;

        // Check for cmd+s (Mac) or ctrl+s (Windows/Linux)
        if (key === 's' && (metaKey || ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();

          // Get current editor state and save immediately
          editor.getEditorState().read(() => {
            const json = editor.getEditorState().toJSON();
            onSave(json as EditorContent).catch((error) => {
              console.error('Manual save failed:', error);
            });
          });

          return true; // Command handled
        }

        return false; // Command not handled
      },
      COMMAND_PRIORITY_NORMAL
    );

    // Cleanup on unmount
    return () => {
      removeCommand();
    };
  }, [editor, onSave]);

  return null;
}
