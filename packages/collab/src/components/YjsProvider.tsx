/**
 * YjsProvider - React context for Yjs document access.
 *
 * Provides Yjs document synchronization to Lexical components by:
 * 1. Joining a document session via CollabClient
 * 2. Exposing the Y.Doc through React context
 * 3. Managing lifecycle (join on mount, leave on unmount)
 * 4. Handling noteId changes with proper cleanup
 *
 * @module
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type FC,
  type ReactNode,
} from 'react';
import type * as Y from 'yjs';
import type { CollabClient, DocumentSession } from '@scribe/client-sdk';

/**
 * Value provided by YjsContext.
 */
export interface YjsContextValue {
  /** The Yjs document for collaborative editing, null while loading */
  doc: Y.Doc | null;
  /** Whether the document is currently loading */
  isLoading: boolean;
  /** Error that occurred during connection/sync, null if successful */
  error: Error | null;
  /** The note ID being edited */
  noteId: string;
}

const YjsContext = createContext<YjsContextValue | null>(null);

/**
 * Props for YjsProvider component.
 */
export interface YjsProviderProps {
  /** The note ID to join and sync */
  noteId: string;
  /** CollabClient instance for WebSocket communication */
  collabClient: CollabClient;
  /** Children to render within the provider */
  children: ReactNode;
}

/**
 * YjsProvider - Provides Yjs document context for collaborative editing.
 *
 * This component manages the lifecycle of a collaborative document session:
 * - Joins the document when mounted
 * - Leaves the document when unmounted
 * - Handles noteId changes by leaving the old document and joining the new one
 *
 * @example
 * ```tsx
 * function NoteEditor({ noteId }: { noteId: string }) {
 *   const { client } = useScribeClient();
 *
 *   return (
 *     <YjsProvider noteId={noteId} collabClient={client.collab}>
 *       <LexicalEditorWithYjs />
 *     </YjsProvider>
 *   );
 * }
 * ```
 */
export const YjsProvider: FC<YjsProviderProps> = ({ noteId, collabClient, children }) => {
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track the current session to handle cleanup during noteId changes
  const sessionRef = useRef<DocumentSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function joinDocument() {
      try {
        setIsLoading(true);
        setError(null);

        const newSession = await collabClient.joinDocument(noteId);

        if (!cancelled) {
          sessionRef.current = newSession;
          setSession(newSession);
        } else {
          // Component unmounted or noteId changed before join completed
          newSession.destroy();
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errorInstance = err instanceof Error ? err : new Error(String(err));
          setError(errorInstance);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    joinDocument();

    return () => {
      cancelled = true;
      // Destroy the session on cleanup (unmount or noteId change)
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }
    };
  }, [noteId, collabClient]);

  const value: YjsContextValue = {
    doc: session?.doc ?? null,
    isLoading,
    error,
    noteId,
  };

  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>;
};

/**
 * Hook to access Yjs context.
 *
 * Returns the current Yjs context value including doc, loading state,
 * and any errors that occurred.
 *
 * @throws Error if used outside of YjsProvider
 *
 * @example
 * ```tsx
 * function LexicalEditorWithYjs() {
 *   const { doc, isLoading, error } = useYjs();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <LexicalComposer>
 *       <LexicalYjsPlugin doc={doc!} />
 *       <RichTextPlugin />
 *     </LexicalComposer>
 *   );
 * }
 * ```
 */
export function useYjs(): YjsContextValue {
  const context = useContext(YjsContext);
  if (!context) {
    throw new Error('useYjs must be used within a YjsProvider');
  }
  return context;
}

/**
 * Hook to access the Yjs document directly.
 *
 * Unlike useYjs(), this hook throws if the document is not available
 * (loading or error state). Use this when you know the doc should be ready.
 *
 * @throws Error if used outside of YjsProvider
 * @throws Error if Y.Doc is still loading
 * @throws Error if Y.Doc is not available
 * @throws The original error if document loading failed
 *
 * @example
 * ```tsx
 * // Use with React Suspense or after checking loading state
 * function CollaborativeEditor() {
 *   const doc = useYjsDoc();
 *   const yText = doc.getText('content');
 *
 *   return <Editor yText={yText} />;
 * }
 * ```
 */
export function useYjsDoc(): Y.Doc {
  const { doc, isLoading, error } = useYjs();

  if (isLoading) {
    throw new Error('Y.Doc is still loading');
  }
  if (error) {
    throw error;
  }
  if (!doc) {
    throw new Error('Y.Doc not available');
  }

  return doc;
}
