/**
 * SlashCommandContext
 *
 * React context for slash command execution. Provides editor instance,
 * client, and toast notifications to slash command handlers.
 *
 * @module
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { LexicalEditor, LexicalNode } from 'lexical';
import { $getSelection, $isRangeSelection } from 'lexical';

/**
 * Context for slash command execution.
 * Passed to plugin slash command handlers when they execute.
 */
export interface SlashCommandContext {
  /** The Lexical editor instance */
  editor: LexicalEditor;

  /** Insert text at the current cursor position */
  insertText: (text: string) => void;

  /** Insert a Lexical node at the current cursor position */
  insertNode: (node: LexicalNode) => void;

  /** Show a toast notification */
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;

  /** Close the slash menu */
  close: () => void;

  /** Current note ID (if editing a note) */
  noteId?: string;
}

/**
 * Configuration for the SlashCommandProvider.
 */
export interface SlashCommandProviderConfig {
  /** The Lexical editor instance */
  editor: LexicalEditor;
  /** Function to show toast notifications */
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  /** Function to close the slash menu */
  closeMenu: () => void;
  /** Current note ID */
  noteId?: string;
}

/**
 * React context for slash command execution context.
 */
const SlashCommandReactContext = createContext<SlashCommandContext | null>(null);

/**
 * Props for the SlashCommandProvider component.
 */
export interface SlashCommandProviderProps {
  /** Configuration for the slash command context */
  config: SlashCommandProviderConfig;
  /** Child components */
  children: ReactNode;
}

/**
 * Create helper functions for editor manipulation.
 */
function createInsertText(editor: LexicalEditor) {
  return (text: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
  };
}

function createInsertNode(editor: LexicalEditor) {
  return (node: LexicalNode) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([node]);
      }
    });
  };
}

/**
 * Provider component that supplies slash command context.
 *
 * Wraps slash menu components to provide editor access and utilities
 * to plugin command handlers.
 *
 * @example
 * ```tsx
 * <SlashCommandProvider
 *   config={{
 *     editor,
 *     showToast,
 *     closeMenu: handleClose,
 *     noteId: currentNote?.id,
 *   }}
 * >
 *   <SlashMenu />
 * </SlashCommandProvider>
 * ```
 */
export function SlashCommandProvider({ config, children }: SlashCommandProviderProps) {
  const context: SlashCommandContext = {
    editor: config.editor,
    insertText: createInsertText(config.editor),
    insertNode: createInsertNode(config.editor),
    toast: (message, type = 'info') => {
      // Map 'info' to 'success' since our toast system only supports success/error
      const toastType = type === 'error' ? 'error' : 'success';
      config.showToast(message, toastType);
    },
    close: config.closeMenu,
    noteId: config.noteId,
  };

  return (
    <SlashCommandReactContext.Provider value={context}>
      {children}
    </SlashCommandReactContext.Provider>
  );
}

/**
 * Hook to access the slash command context.
 *
 * Must be used within a SlashCommandProvider.
 *
 * @throws Error if used outside of SlashCommandProvider
 *
 * @example
 * ```tsx
 * function PluginCommandItem({ handler }) {
 *   const ctx = useSlashCommandContext();
 *
 *   const handleClick = async () => {
 *     try {
 *       await handler.execute({ ...ctx });
 *     } catch (error) {
 *       ctx.toast('Command failed', 'error');
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>...</button>;
 * }
 * ```
 */
export function useSlashCommandContext(): SlashCommandContext {
  const context = useContext(SlashCommandReactContext);

  if (!context) {
    throw new Error('useSlashCommandContext must be used within a SlashCommandProvider');
  }

  return context;
}
