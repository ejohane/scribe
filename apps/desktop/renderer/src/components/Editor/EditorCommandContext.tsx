/**
 * EditorCommandContext
 *
 * Provides a React context for cross-component command dispatch to the Lexical editor.
 * This bridges the gap between sibling components (e.g., EditorRoot and ContextPanel)
 * that need to communicate with the editor without props drilling.
 *
 * Architecture:
 * - Two-context pattern: public consumer context + internal setter context
 * - EditorCommandProvider wraps both EditorRoot and ContextPanel
 * - EditorRoot registers its editor instance via useEditorCommandSetter
 * - Other components (e.g., OutlineWidget) dispatch commands via useEditorCommand
 *
 * @example
 * // In EditorRoot (internal)
 * const { setEditor } = useEditorCommandSetter();
 * useEffect(() => {
 *   setEditor(editor);
 *   return () => setEditor(null);
 * }, [editor, setEditor]);
 *
 * @example
 * // In OutlineWidget (external consumer)
 * const { focusNode } = useEditorCommand();
 * const handleClick = (nodeKey: string) => focusNode(nodeKey);
 */

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import type { LexicalEditor } from 'lexical';
import { createLogger } from '@scribe/shared';
import { FOCUS_NODE_COMMAND, type FocusNodePayload } from './plugins/FocusNodePlugin';

const log = createLogger({ prefix: 'EditorCommandContext' });

/**
 * Public API for components that need to dispatch commands to the editor.
 */
export interface EditorCommandContextValue {
  /**
   * Focus and scroll to a specific node in the editor.
   * Used by OutlineWidget to navigate to headings.
   *
   * @param nodeKey - The Lexical node key to focus
   * @param options - Optional fallback identifiers for node location
   */
  focusNode: (nodeKey: string, options?: Omit<FocusNodePayload, 'nodeKey'>) => void;

  /**
   * Whether an editor is currently registered and available for commands.
   */
  hasEditor: boolean;
}

/**
 * Internal API for EditorRoot to register the editor instance.
 */
export interface EditorCommandSetterValue {
  /**
   * Register or unregister the Lexical editor instance.
   * Called by EditorRoot on mount/unmount.
   *
   * @param editor - The Lexical editor instance, or null to unregister
   */
  setEditor: (editor: LexicalEditor | null) => void;
}

const EditorCommandContext = createContext<EditorCommandContextValue | null>(null);
const EditorCommandSetterContext = createContext<EditorCommandSetterValue | null>(null);

interface EditorCommandProviderProps {
  children: ReactNode;
}

/**
 * Provider that enables cross-component command dispatch to the Lexical editor.
 *
 * Should wrap both EditorRoot and ContextPanel (or other components that need
 * to communicate with the editor).
 *
 * @example
 * <EditorCommandProvider>
 *   <EditorRoot noteState={noteState} />
 *   <ContextPanel ... />
 * </EditorCommandProvider>
 */
export function EditorCommandProvider({ children }: EditorCommandProviderProps) {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);

  const focusNode = useCallback(
    (nodeKey: string, options?: Omit<FocusNodePayload, 'nodeKey'>) => {
      if (!editor) {
        log.warn('focusNode called but no editor is available');
        return;
      }

      const payload: FocusNodePayload = {
        nodeKey,
        ...options,
      };

      editor.dispatchCommand(FOCUS_NODE_COMMAND, payload);
    },
    [editor]
  );

  const commandValue = useMemo<EditorCommandContextValue>(
    () => ({
      focusNode,
      hasEditor: editor !== null,
    }),
    [focusNode, editor]
  );

  const setterValue = useMemo<EditorCommandSetterValue>(
    () => ({
      setEditor: (newEditor: LexicalEditor | null) => {
        setEditor(newEditor);
      },
    }),
    [setEditor]
  );

  return (
    <EditorCommandSetterContext.Provider value={setterValue}>
      <EditorCommandContext.Provider value={commandValue}>{children}</EditorCommandContext.Provider>
    </EditorCommandSetterContext.Provider>
  );
}

/**
 * Hook for components that need to dispatch commands to the editor.
 *
 * Must be used within an EditorCommandProvider.
 *
 * @throws Error if used outside of EditorCommandProvider
 *
 * @example
 * function OutlineWidget() {
 *   const { focusNode, hasEditor } = useEditorCommand();
 *
 *   const handleHeadingClick = (nodeKey: string) => {
 *     focusNode(nodeKey);
 *   };
 *
 *   return hasEditor ? <OutlineList onClick={handleHeadingClick} /> : null;
 * }
 */
export function useEditorCommand(): EditorCommandContextValue {
  const context = useContext(EditorCommandContext);
  if (!context) {
    throw new Error('useEditorCommand must be used within an EditorCommandProvider');
  }
  return context;
}

/**
 * Hook for EditorRoot to register the editor instance.
 *
 * This is an internal API - external components should use useEditorCommand instead.
 * Must be used within an EditorCommandProvider.
 *
 * @throws Error if used outside of EditorCommandProvider
 *
 * @example
 * function EditorCommandBridge() {
 *   const [editor] = useLexicalComposerContext();
 *   const { setEditor } = useEditorCommandSetter();
 *
 *   useEffect(() => {
 *     setEditor(editor);
 *     return () => setEditor(null);
 *   }, [editor, setEditor]);
 *
 *   return null;
 * }
 */
export function useEditorCommandSetter(): EditorCommandSetterValue {
  const context = useContext(EditorCommandSetterContext);
  if (!context) {
    throw new Error('useEditorCommandSetter must be used within an EditorCommandProvider');
  }
  return context;
}

/**
 * Optional hook for EditorRoot to register the editor instance.
 *
 * Returns null if used outside of EditorCommandProvider, allowing the
 * EditorCommandBridge to gracefully no-op when no provider is present.
 * This enables EditorRoot to work both with and without the provider.
 *
 * @example
 * function EditorCommandBridge() {
 *   const [editor] = useLexicalComposerContext();
 *   const setter = useOptionalEditorCommandSetter();
 *
 *   useEffect(() => {
 *     if (!setter) return; // No provider, nothing to do
 *     setter.setEditor(editor);
 *     return () => setter.setEditor(null);
 *   }, [editor, setter]);
 *
 *   return null;
 * }
 */
export function useOptionalEditorCommandSetter(): EditorCommandSetterValue | null {
  return useContext(EditorCommandSetterContext);
}
