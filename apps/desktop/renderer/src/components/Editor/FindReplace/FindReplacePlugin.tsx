/**
 * FindReplacePlugin - Lexical plugin for in-editor find functionality
 *
 * Responsibilities:
 * 1. Register Cmd/Ctrl+F keyboard shortcut (intercepts browser find)
 * 2. Manage open/close state of the search bar
 * 3. Render FindReplaceBar via portal
 * 4. Return focus to editor on close
 * 5. Cleanup on unmount
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from 'lexical';
import { FindReplaceBar } from './FindReplaceBar';

/**
 * FindReplacePlugin - Provides Cmd/Ctrl+F search functionality
 *
 * This plugin:
 * - Intercepts Cmd/Ctrl+F before the browser can handle it
 * - Opens a search bar for in-document search
 * - Manages the lifecycle of the search UI
 */
export function FindReplacePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [isOpen, setIsOpen] = useState(false);

  // Handle closing the search bar
  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Return focus to editor after closing
    editor.focus();
  }, [editor]);

  // Register Cmd/Ctrl+F keyboard shortcut
  useEffect(() => {
    const removeCommand = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const { key, metaKey, ctrlKey } = event;

        // Check for Cmd+F (Mac) or Ctrl+F (Windows/Linux)
        if (key === 'f' && (metaKey || ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();

          // Toggle search bar
          setIsOpen(true);

          return true; // Command handled
        }

        return false; // Command not handled
      },
      COMMAND_PRIORITY_HIGH // High priority to intercept before browser
    );

    // Cleanup on unmount
    return () => {
      removeCommand();
    };
  }, [editor]);

  // When search bar is closed, ensure focus returns to editor
  useEffect(() => {
    if (!isOpen) {
      // Optional: could add additional cleanup here
    }
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Render FindReplaceBar via portal to document.body for proper z-index
  return createPortal(<FindReplaceBar onClose={handleClose} autoFocus={true} />, document.body);
}
