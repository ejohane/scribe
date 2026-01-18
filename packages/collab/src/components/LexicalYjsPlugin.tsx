/**
 * LexicalYjsPlugin - Synchronizes Lexical editor state with a Yjs document.
 *
 * This plugin bridges Lexical and Yjs by:
 * 1. Initializing the editor from Yjs state (if available)
 * 2. Syncing local Lexical changes to Yjs
 * 3. Syncing remote Yjs changes to Lexical
 * 4. Preventing infinite loops via origin tracking
 *
 * MVP Limitations:
 * - Full state sync (not granular CRDT, entire editor state replaced)
 * - Last write wins for concurrent edits
 * - No cursor sync (other users' positions not shown)
 *
 * @module
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { EditorState, LexicalEditor } from 'lexical';
import type * as Y from 'yjs';

/**
 * Props for LexicalYjsPlugin component.
 */
export interface LexicalYjsPluginProps {
  /** The Yjs document to sync with */
  doc: Y.Doc;
  /** Debounce delay in milliseconds for local updates (default: 100) */
  debounceMs?: number;
  /** Key used in Y.Map to store editor state (default: 'editorState') */
  stateKey?: string;
}

/** Transaction origin for local changes */
const LOCAL_ORIGIN = 'lexical-local';

/**
 * LexicalYjsPlugin - Syncs Lexical editor state with Yjs document.
 *
 * This is an MVP implementation using full state replacement.
 * It stores serialized Lexical JSON in a Y.Map under the 'lexical' key.
 *
 * @example
 * ```tsx
 * <LexicalComposer initialConfig={editorConfig}>
 *   <LexicalYjsPlugin doc={yjsDoc} />
 *   <RichTextPlugin
 *     contentEditable={<ContentEditable />}
 *     placeholder={<Placeholder />}
 *   />
 *   <HistoryPlugin />
 * </LexicalComposer>
 * ```
 */
export function LexicalYjsPlugin({
  doc,
  debounceMs = 100,
  stateKey = 'editorState',
}: LexicalYjsPluginProps): null {
  const [editor] = useLexicalComposerContext();

  // Track whether we're applying a remote update to avoid loops
  const isRemoteUpdateRef = useRef(false);

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track last synced state to avoid unnecessary updates
  const lastSyncedStateRef = useRef<string | null>(null);

  /**
   * Sync editor state to Yjs.
   * Uses debouncing to reduce sync frequency.
   */
  const syncToYjs = useCallback(
    (editorState: EditorState) => {
      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const json = JSON.stringify(editorState.toJSON());

        // Skip if state hasn't changed
        if (json === lastSyncedStateRef.current) {
          console.log('[LexicalYjsPlugin] syncToYjs: State unchanged, skipping');
          return;
        }

        console.log('[LexicalYjsPlugin] syncToYjs: Syncing to Yjs');
        lastSyncedStateRef.current = json;

        doc.transact(() => {
          const yContent = doc.getMap('lexical');
          yContent.set(stateKey, json);
          console.log('[LexicalYjsPlugin] syncToYjs: Y.Map.set() called');
        }, LOCAL_ORIGIN);
        console.log('[LexicalYjsPlugin] syncToYjs: Transaction completed');
      }, debounceMs);
    },
    [doc, debounceMs, stateKey]
  );

  /**
   * Apply remote Yjs state to Lexical editor.
   */
  const applyRemoteState = useCallback((editor: LexicalEditor, newStateJson: string) => {
    // Skip if this is the same state we just synced
    if (newStateJson === lastSyncedStateRef.current) {
      return;
    }

    try {
      isRemoteUpdateRef.current = true;
      const state = editor.parseEditorState(newStateJson);
      editor.setEditorState(state);
      lastSyncedStateRef.current = newStateJson;
    } finally {
      isRemoteUpdateRef.current = false;
    }
  }, []);

  useEffect(() => {
    console.log('[LexicalYjsPlugin] useEffect running, doc.guid:', doc.guid);
    const yContent = doc.getMap('lexical');

    // 1. Initialize editor from Yjs state (if available)
    const initialState = yContent.get(stateKey) as string | undefined;
    if (initialState) {
      applyRemoteState(editor, initialState);
    } else {
      // If no initial state in Yjs, sync current editor state to Yjs
      const currentState = editor.getEditorState();
      const json = JSON.stringify(currentState.toJSON());
      lastSyncedStateRef.current = json;
      doc.transact(() => {
        yContent.set(stateKey, json);
      }, LOCAL_ORIGIN);
    }

    // 2. Listen for local Lexical changes → push to Yjs
    const unregisterListener = editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        // Skip if this was a remote update (avoid loops)
        if (isRemoteUpdateRef.current) {
          return;
        }

        // Skip if nothing changed
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
          return;
        }

        syncToYjs(editorState);
      }
    );

    // 3. Listen for Yjs changes → update Lexical
    const observeHandler = (event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
      console.log('[LexicalYjsPlugin] Y.Map observed, origin:', transaction.origin);

      // Skip our own transactions
      if (transaction.origin === LOCAL_ORIGIN) {
        console.log('[LexicalYjsPlugin] Skipping local origin transaction');
        return;
      }

      const newState = yContent.get(stateKey) as string | undefined;
      if (!newState) {
        console.log('[LexicalYjsPlugin] No new state found in Y.Map');
        return;
      }

      console.log('[LexicalYjsPlugin] Applying remote state to Lexical');
      applyRemoteState(editor, newState);
    };

    yContent.observe(observeHandler);

    // Cleanup
    return () => {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      unregisterListener();
      yContent.unobserve(observeHandler);
    };
  }, [editor, doc, stateKey, syncToYjs, applyRemoteState]);

  return null;
}
