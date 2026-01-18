/**
 * CollaborativeEditor - Wrapper that enables collaborative editing.
 *
 * Wraps children with YjsProvider to enable real-time collaborative
 * editing via the Yjs CRDT. Uses the CollabClient from CollabProvider
 * to synchronize with the daemon WebSocket server.
 *
 * @module
 */

import { type FC, type ReactNode } from 'react';
import { YjsProvider, useYjs, LexicalYjsPlugin } from '@scribe/collab';
import type * as Y from 'yjs';
import { useCollab } from '../providers/CollabProvider.js';

/**
 * Props passed to the editor when in collaborative mode.
 */
export interface CollabEditorProps {
  /** The Yjs document for collaborative editing */
  yjsDoc: Y.Doc;
  /** The plugin component that syncs Lexical with Yjs */
  YjsPlugin: FC<{ doc: Y.Doc }>;
}

/**
 * Props for CollaborativeEditor component.
 */
export interface CollaborativeEditorProps {
  /** The note ID to collaborate on */
  noteId: string;
  /** Render function that receives collab props */
  children: (collabProps: CollabEditorProps) => ReactNode;
  /** Fallback content shown while connecting */
  fallback?: ReactNode;
}

/**
 * Inner component that renders children with Yjs doc.
 * Must be inside YjsProvider to access the doc.
 */
function EditorWithYjs({ children }: { children: (collabProps: CollabEditorProps) => ReactNode }) {
  const { doc, isLoading, error, noteId } = useYjs();

  console.log('[EditorWithYjs] State:', {
    isLoading,
    error: error?.message,
    hasDoc: !!doc,
    noteId,
  });

  if (isLoading) {
    return <div style={{ opacity: 0.5 }}>Loading document...</div>;
  }

  if (error) {
    return <div style={{ color: 'red', opacity: 0.7 }}>Collaboration error: {error.message}</div>;
  }

  if (!doc) {
    return <div style={{ opacity: 0.5 }}>Document not available</div>;
  }

  console.log('[EditorWithYjs] Rendering with doc for noteId:', noteId);
  return <>{children({ yjsDoc: doc, YjsPlugin: LexicalYjsPlugin })}</>;
}

/**
 * CollaborativeEditor - Enables collaborative editing for a note.
 *
 * This component:
 * 1. Gets the CollabClient from context
 * 2. Wraps children with YjsProvider for the given noteId
 * 3. Passes the Y.Doc and YjsPlugin to children via render prop
 *
 * @example
 * ```tsx
 * function NoteEditor({ noteId }: { noteId: string }) {
 *   return (
 *     <CollaborativeEditor noteId={noteId}>
 *       {({ yjsDoc, YjsPlugin }) => (
 *         <ScribeEditor
 *           yjsDoc={yjsDoc}
 *           YjsPlugin={YjsPlugin}
 *           onChange={handleChange}
 *         />
 *       )}
 *     </CollaborativeEditor>
 *   );
 * }
 * ```
 */
export const CollaborativeEditor: FC<CollaborativeEditorProps> = ({
  noteId,
  children,
  fallback,
}) => {
  const { collabClient, isConnected, error } = useCollab();

  // Show fallback while connecting
  if (!isConnected || !collabClient) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div style={{ opacity: 0.5 }}>
        {error ? `Connection error: ${error.message}` : 'Connecting to collaboration server...'}
      </div>
    );
  }

  return (
    <YjsProvider noteId={noteId} collabClient={collabClient}>
      <EditorWithYjs>{children}</EditorWithYjs>
    </YjsProvider>
  );
};
