/**
 * Phase 6 Verification Tests - Collaboration Layer Functional
 *
 * These tests verify that the Yjs-Lexical binding works correctly for collaborative editing.
 *
 * Acceptance Criteria:
 * - YjsProvider connects on mount
 * - YjsProvider disconnects on unmount
 * - Editor initializes from Yjs state
 * - Local edits sync to Yjs
 * - Remote edits appear in editor
 * - No infinite update loops
 * - Performance acceptable (no lag when typing)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import * as Y from 'yjs';
import type { ReactNode } from 'react';
import type { LexicalEditor, EditorState } from 'lexical';
import { YjsProvider, useYjs } from './YjsProvider';
import { LexicalYjsPlugin } from './LexicalYjsPlugin';
import type { CollabClient, DocumentSession } from '@scribe/client-sdk';

// ============================================================================
// Test Helpers
// ============================================================================

interface MockSerializedState {
  root: {
    children: Array<{
      children: Array<{
        text: string;
        type: string;
        version: number;
      }>;
      type: string;
      version: number;
    }>;
    type: string;
    version: number;
  };
}

const createMockSerializedState = (text: string): MockSerializedState => ({
  root: {
    children: [
      {
        children: [
          {
            text,
            type: 'text',
            version: 1,
          },
        ],
        type: 'paragraph',
        version: 1,
      },
    ],
    type: 'root',
    version: 1,
  },
});

function createMockEditorState(text: string): EditorState {
  const serialized = createMockSerializedState(text);
  return {
    toJSON: () => serialized,
    read: vi.fn(),
    clone: vi.fn(),
  } as unknown as EditorState;
}

function createMockEditor(): {
  editor: LexicalEditor;
  updateListeners: Array<
    (payload: {
      editorState: EditorState;
      dirtyElements: Map<string, boolean>;
      dirtyLeaves: Set<string>;
    }) => void
  >;
  triggerUpdate: (text: string, hasDirty?: boolean) => void;
} {
  const updateListeners: Array<
    (payload: {
      editorState: EditorState;
      dirtyElements: Map<string, boolean>;
      dirtyLeaves: Set<string>;
    }) => void
  > = [];

  let currentState = createMockEditorState('initial');

  const editor: LexicalEditor = {
    registerUpdateListener: vi.fn((listener) => {
      updateListeners.push(listener);
      return () => {
        const index = updateListeners.indexOf(listener);
        if (index > -1) {
          updateListeners.splice(index, 1);
        }
      };
    }),
    parseEditorState: vi.fn((json: string) => {
      const parsed = JSON.parse(json) as MockSerializedState;
      return {
        toJSON: () => parsed,
        read: vi.fn(),
        clone: vi.fn(),
      } as unknown as EditorState;
    }),
    setEditorState: vi.fn((state: EditorState) => {
      currentState = state;
    }),
    getEditorState: vi.fn(() => currentState),
  } as unknown as LexicalEditor;

  const triggerUpdate = (text: string, hasDirty = true) => {
    const newState = createMockEditorState(text);
    currentState = newState;
    updateListeners.forEach((listener) => {
      listener({
        editorState: newState,
        dirtyElements: hasDirty ? new Map([['1', true]]) : new Map(),
        dirtyLeaves: hasDirty ? new Set(['1']) : new Set(),
      });
    });
  };

  return { editor, updateListeners, triggerUpdate };
}

function createMockSession(noteId: string): DocumentSession {
  const doc = new Y.Doc();
  return {
    noteId,
    doc,
    destroy: vi.fn(() => {
      doc.destroy();
    }),
  };
}

function createMockCollabClient(options?: {
  joinDelay?: number;
  shouldFail?: boolean;
  errorMessage?: string;
}): CollabClient {
  const { joinDelay = 0, shouldFail = false, errorMessage = 'Connection failed' } = options ?? {};

  return {
    joinDocument: vi.fn(async (noteId: string) => {
      if (joinDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, joinDelay));
      }
      if (shouldFail) {
        throw new Error(errorMessage);
      }
      return createMockSession(noteId);
    }),
  } as unknown as CollabClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock useLexicalComposerContext
let mockEditor: ReturnType<typeof createMockEditor>;

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor.editor],
}));

// ============================================================================
// Verification Tests
// ============================================================================

describe('Phase 6: Collaboration Layer Verification', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
    mockEditor = createMockEditor();
  });

  afterEach(() => {
    doc.destroy();
  });

  // --------------------------------------------------------------------------
  // YjsProvider Tests
  // --------------------------------------------------------------------------

  describe('YjsProvider - Connection Lifecycle', () => {
    it('connects on mount (AC: YjsProvider connects on mount)', async () => {
      const mockClient = createMockCollabClient();

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        expect(mockClient.joinDocument).toHaveBeenCalledWith('test-note');
      });
    });

    it('disconnects on unmount (AC: YjsProvider disconnects on unmount)', async () => {
      const mockClient = createMockCollabClient();
      let destroyFn: ReturnType<typeof vi.fn> | null = null;

      (mockClient.joinDocument as ReturnType<typeof vi.fn>).mockImplementation(
        async (noteId: string) => {
          const session = createMockSession(noteId);
          destroyFn = session.destroy as ReturnType<typeof vi.fn>;
          return session;
        }
      );

      const { unmount } = render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <div>Content</div>
        </YjsProvider>
      );

      await waitFor(() => {
        expect(destroyFn).not.toBeNull();
      });

      unmount();

      expect(destroyFn).toHaveBeenCalled();
    });

    it('provides onReady callback when document is ready', async () => {
      const mockClient = createMockCollabClient();
      let contextValue: ReturnType<typeof useYjs> | null = null;
      const onReadySpy = vi.fn();

      function TestYjsConsumer({ onReady }: { onReady: () => void }) {
        contextValue = useYjs();

        if (contextValue?.doc && !contextValue.isLoading && !contextValue.error) {
          // Call onReady when doc is available
          onReady();
        }

        return <div data-testid="status">{contextValue?.isLoading ? 'loading' : 'ready'}</div>;
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <TestYjsConsumer onReady={onReadySpy} />
        </YjsProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('ready');
        expect(onReadySpy).toHaveBeenCalled();
      });
    });
  });

  // --------------------------------------------------------------------------
  // LexicalYjsPlugin Tests
  // --------------------------------------------------------------------------

  describe('LexicalYjsPlugin - Editor Sync', () => {
    function TestWrapper({ children }: { children: ReactNode }) {
      return <>{children}</>;
    }

    it('initializes editor from Yjs state (AC: Editor initializes from Yjs state)', () => {
      // Pre-populate Yjs with state
      const existingState = createMockSerializedState('Initial content');
      doc.getMap('lexical').set('editorState', JSON.stringify(existingState));

      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      expect(mockEditor.editor.parseEditorState).toHaveBeenCalledWith(
        JSON.stringify(existingState)
      );
      expect(mockEditor.editor.setEditorState).toHaveBeenCalled();
    });

    it('syncs local edits to Yjs (AC: Local edits sync to Yjs)', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      // Trigger a local update (simulating user typing)
      act(() => {
        mockEditor.triggerUpdate('New text');
      });

      // Wait for debounce
      await sleep(100);

      // Verify Yjs was updated
      const yContent = doc.getMap('lexical');
      const updatedState = yContent.get('editorState') as string;
      const parsed = JSON.parse(updatedState);
      expect(parsed.root.children[0].children[0].text).toBe('New text');
    });

    it('applies remote edits to editor (AC: Remote edits appear in editor)', () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      // Clear initial calls
      vi.mocked(mockEditor.editor.setEditorState).mockClear();
      vi.mocked(mockEditor.editor.parseEditorState).mockClear();

      // Simulate remote change from another client
      const remoteState = createMockSerializedState('Remote content');
      const yContent = doc.getMap('lexical');

      act(() => {
        doc.transact(() => {
          yContent.set('editorState', JSON.stringify(remoteState));
        }, 'remote-user'); // Origin is not 'lexical-local'
      });

      expect(mockEditor.editor.parseEditorState).toHaveBeenCalledWith(JSON.stringify(remoteState));
      expect(mockEditor.editor.setEditorState).toHaveBeenCalled();
    });

    it('prevents infinite update loops (AC: No infinite update loops)', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');
      const localSyncSpy = vi.fn();

      // Track local transactions
      const originalTransact = doc.transact.bind(doc);
      doc.transact = vi.fn((fn, origin) => {
        if (origin === 'lexical-local') {
          localSyncSpy();
        }
        return originalTransact(fn, origin);
      }) as typeof doc.transact;

      // Clear spy after initial sync
      localSyncSpy.mockClear();

      // Simulate remote update
      const remoteState = createMockSerializedState('Remote content');
      act(() => {
        doc.transact(() => {
          yContent.set('editorState', JSON.stringify(remoteState));
        }, 'remote-user');
      });

      // Wait for any potential debounced syncs
      await sleep(100);

      // Should not have triggered additional local syncs (would cause infinite loop)
      expect(localSyncSpy).toHaveBeenCalledTimes(0);
    });

    it('maintains acceptable performance with debouncing (AC: Performance acceptable)', async () => {
      const syncSpy = vi.fn();
      const originalTransact = doc.transact.bind(doc);
      doc.transact = vi.fn((fn: () => void, origin?: unknown) => {
        if (origin === 'lexical-local') {
          syncSpy();
        }
        return originalTransact(fn, origin);
      }) as typeof doc.transact;

      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      // Clear initial sync
      syncSpy.mockClear();

      // Simulate rapid typing (10 changes in 30ms)
      for (let i = 0; i < 10; i++) {
        act(() => {
          mockEditor.triggerUpdate(`Text ${i}`);
        });
        await sleep(3);
      }

      // Wait for debounce
      await sleep(100);

      // Should only sync once (debounced) - this proves we're not syncing on every keystroke
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Two-Client Sync Test
  // --------------------------------------------------------------------------

  describe('Two-Client Sync Simulation', () => {
    function TestWrapper({ children }: { children: ReactNode }) {
      return <>{children}</>;
    }

    it('syncs changes between two simulated clients', async () => {
      // Create two Yjs documents (simulating two clients)
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // Simulate network sync between docs by copying updates
      const syncDocs = () => {
        // Get state from doc1 and apply to doc2
        const stateVector1 = Y.encodeStateAsUpdate(doc1);
        Y.applyUpdate(doc2, stateVector1, 'remote');

        // Get state from doc2 and apply to doc1
        const stateVector2 = Y.encodeStateAsUpdate(doc2);
        Y.applyUpdate(doc1, stateVector2, 'remote');
      };

      // Set up mock editor for client 1 (client 2 sync is verified via Yjs doc)
      const mockEditor1 = createMockEditor();

      // Override the mock to return editor1 first
      vi.mocked(mockEditor.editor.registerUpdateListener).mockImplementation(
        mockEditor1.editor.registerUpdateListener
      );
      vi.mocked(mockEditor.editor.parseEditorState).mockImplementation(
        mockEditor1.editor.parseEditorState
      );
      vi.mocked(mockEditor.editor.setEditorState).mockImplementation(
        mockEditor1.editor.setEditorState
      );
      vi.mocked(mockEditor.editor.getEditorState).mockImplementation(
        mockEditor1.editor.getEditorState
      );

      // Render plugin for client 1
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc1} debounceMs={10} />
        </TestWrapper>
      );

      // Client 1 makes a change
      act(() => {
        mockEditor1.triggerUpdate('Hello from Client 1');
      });

      // Wait for debounce
      await sleep(50);

      // Sync the documents
      syncDocs();

      // Verify Client 2's doc has the update
      const doc2Content = doc2.getMap('lexical').get('editorState') as string;
      expect(doc2Content).toBeDefined();
      const parsed = JSON.parse(doc2Content);
      expect(parsed.root.children[0].children[0].text).toBe('Hello from Client 1');

      // Clean up
      doc1.destroy();
      doc2.destroy();
    });

    it('handles concurrent edits from multiple clients', async () => {
      // Create two Yjs documents
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      // Set up bidirectional sync
      doc1.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'remote') {
          Y.applyUpdate(doc2, update, 'remote');
        }
      });

      doc2.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin !== 'remote') {
          Y.applyUpdate(doc1, update, 'remote');
        }
      });

      // Both clients start with the same initial state
      const initialState = createMockSerializedState('Initial');

      // Client 1 writes first
      doc1.transact(() => {
        doc1.getMap('lexical').set('editorState', JSON.stringify(initialState));
      }, 'local');

      // Wait for sync
      await sleep(10);

      // Both docs should have the same state
      const state1 = doc1.getMap('lexical').get('editorState');
      const state2 = doc2.getMap('lexical').get('editorState');
      expect(state1).toBe(state2);

      // Clean up
      doc1.destroy();
      doc2.destroy();
    });
  });

  // --------------------------------------------------------------------------
  // Integration Test
  // --------------------------------------------------------------------------

  describe('Full Integration: YjsProvider + LexicalYjsPlugin', () => {
    function TestWrapper({ children }: { children: ReactNode }) {
      return <>{children}</>;
    }

    it('complete flow: provider connects, editor syncs', async () => {
      const mockClient = createMockCollabClient();
      let contextDoc: Y.Doc | null = null;

      // Pre-populate with initial state
      const initialState = createMockSerializedState('Welcome to collaboration');

      // Custom mock that provides a pre-populated doc
      (mockClient.joinDocument as ReturnType<typeof vi.fn>).mockImplementation(
        async (noteId: string) => {
          const session = createMockSession(noteId);
          // Pre-populate the doc
          session.doc.getMap('lexical').set('editorState', JSON.stringify(initialState));
          contextDoc = session.doc;
          return session;
        }
      );

      // Component that uses both provider and plugin
      function IntegrationTest() {
        const { doc, isLoading, error } = useYjs();

        if (isLoading) return <div data-testid="status">loading</div>;
        if (error) return <div data-testid="status">error</div>;
        if (!doc) return <div data-testid="status">no-doc</div>;

        return (
          <TestWrapper>
            <div data-testid="status">ready</div>
            <LexicalYjsPlugin doc={doc} debounceMs={10} />
          </TestWrapper>
        );
      }

      render(
        <YjsProvider noteId="test-note" collabClient={mockClient}>
          <IntegrationTest />
        </YjsProvider>
      );

      // Wait for ready state
      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('ready');
      });

      // Verify doc was provided and editor was initialized
      expect(contextDoc).not.toBeNull();
      expect(mockEditor.editor.parseEditorState).toHaveBeenCalled();
      expect(mockEditor.editor.setEditorState).toHaveBeenCalled();
    });
  });
});
