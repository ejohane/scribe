/**
 * Tests for LexicalYjsPlugin component
 *
 * These tests verify:
 * - Editor initializes from Yjs state
 * - Local changes sync to Yjs
 * - Remote changes update editor
 * - No infinite loops (origin tracking)
 * - Debouncing prevents excessive updates
 * - Clean unmount (listeners removed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import * as Y from 'yjs';
import type { ReactNode } from 'react';
import type { LexicalEditor, EditorState } from 'lexical';
import { LexicalYjsPlugin } from './LexicalYjsPlugin';

// Mock serialized editor state for testing (using plain object to avoid strict type issues)
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

// Create a mock editor state
function createMockEditorState(text: string): EditorState {
  const serialized = createMockSerializedState(text);
  return {
    toJSON: () => serialized,
    read: vi.fn(),
    clone: vi.fn(),
  } as unknown as EditorState;
}

// Create a mock Lexical editor
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

// Mock useLexicalComposerContext
let mockEditor: ReturnType<typeof createMockEditor>;

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [mockEditor.editor],
}));

// Wrapper component for testing
function TestWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Helper to wait for debounce
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('LexicalYjsPlugin', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
    mockEditor = createMockEditor();
  });

  afterEach(() => {
    doc.destroy();
  });

  describe('initialization from Yjs state', () => {
    it('initializes editor from existing Yjs state', () => {
      // Pre-populate Yjs with state
      const existingState = createMockSerializedState('existing content');
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

    it('syncs current editor state to Yjs if no existing state', () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');
      const storedState = yContent.get('editorState') as string;
      expect(storedState).toBeDefined();
      expect(JSON.parse(storedState)).toEqual(mockEditor.editor.getEditorState().toJSON());
    });

    it('uses custom stateKey when provided', () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} stateKey="customState" />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');
      expect(yContent.get('customState')).toBeDefined();
      expect(yContent.get('editorState')).toBeUndefined();
    });
  });

  describe('local changes sync to Yjs', () => {
    it('syncs local editor changes to Yjs after debounce', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      // Trigger a local update
      act(() => {
        mockEditor.triggerUpdate('updated content');
      });

      // Wait for debounce
      await sleep(100);

      // Now should be synced
      const yContent = doc.getMap('lexical');
      const updatedState = yContent.get('editorState') as string;
      const parsed = JSON.parse(updatedState);
      expect(parsed.root.children[0].children[0].text).toBe('updated content');
    });

    it('does not sync when no dirty elements or leaves', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');
      const initialState = yContent.get('editorState') as string;

      // Trigger update with no dirty elements
      act(() => {
        mockEditor.triggerUpdate('no change', false);
      });

      await sleep(100);

      // State should remain unchanged
      expect(yContent.get('editorState')).toBe(initialState);
    });

    it('debounces multiple rapid changes', async () => {
      const syncSpy = vi.fn();
      const originalTransact = doc.transact.bind(doc);
      doc.transact = vi.fn((fn: () => void, origin?: unknown) => {
        syncSpy();
        return originalTransact(fn, origin);
      }) as typeof doc.transact;

      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      // Initial sync on mount (for initial state)
      expect(syncSpy).toHaveBeenCalledTimes(1);
      syncSpy.mockClear();

      // Rapid changes
      act(() => {
        mockEditor.triggerUpdate('change 1');
        mockEditor.triggerUpdate('change 2');
        mockEditor.triggerUpdate('change 3');
      });

      // Wait for debounce
      await sleep(100);

      // Should only sync once (debounced)
      expect(syncSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('remote changes update editor', () => {
    it('updates editor when remote changes arrive', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      // Clear initial calls
      vi.mocked(mockEditor.editor.setEditorState).mockClear();
      vi.mocked(mockEditor.editor.parseEditorState).mockClear();

      // Simulate remote change (different origin)
      const remoteState = createMockSerializedState('remote content');
      const yContent = doc.getMap('lexical');

      act(() => {
        doc.transact(() => {
          yContent.set('editorState', JSON.stringify(remoteState));
        }, 'remote-user');
      });

      expect(mockEditor.editor.parseEditorState).toHaveBeenCalledWith(JSON.stringify(remoteState));
      expect(mockEditor.editor.setEditorState).toHaveBeenCalled();
    });

    it('does not update editor for local transactions', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      // Clear initial calls
      vi.mocked(mockEditor.editor.setEditorState).mockClear();
      vi.mocked(mockEditor.editor.parseEditorState).mockClear();

      // Simulate local transaction (should be ignored by observer)
      const localState = createMockSerializedState('local content');
      const yContent = doc.getMap('lexical');

      act(() => {
        doc.transact(() => {
          yContent.set('editorState', JSON.stringify(localState));
        }, 'lexical-local');
      });

      // Should not update editor (local origin)
      expect(mockEditor.editor.setEditorState).not.toHaveBeenCalled();
    });
  });

  describe('infinite loop prevention', () => {
    it('does not sync back to Yjs when applying remote state', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={50} />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');
      const syncSpy = vi.fn();

      // Track transactions
      const originalTransact = doc.transact.bind(doc);
      doc.transact = vi.fn((fn, origin) => {
        if (origin === 'lexical-local') {
          syncSpy();
        }
        return originalTransact(fn, origin);
      }) as typeof doc.transact;

      // Clear spy after initial sync
      syncSpy.mockClear();

      // Simulate remote update
      const remoteState = createMockSerializedState('remote');
      act(() => {
        doc.transact(() => {
          yContent.set('editorState', JSON.stringify(remoteState));
        }, 'remote-user');
      });

      // Wait for any potential debounced syncs
      await sleep(100);

      // Should not have triggered additional local syncs
      expect(syncSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('unmount cleanup', () => {
    it('removes update listener on unmount', () => {
      const { unmount } = render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      expect(mockEditor.updateListeners.length).toBe(1);

      unmount();

      expect(mockEditor.updateListeners.length).toBe(0);
    });

    it('clears debounce timer on unmount', async () => {
      const { unmount } = render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={1000} />
        </TestWrapper>
      );

      // Trigger an update that starts debounce timer
      act(() => {
        mockEditor.triggerUpdate('pending update');
      });

      // Unmount before debounce completes - should not throw
      unmount();

      // Wait to make sure no errors occur
      await sleep(50);
    });
  });

  describe('configuration options', () => {
    it('uses custom debounce delay', async () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} debounceMs={200} />
        </TestWrapper>
      );

      act(() => {
        mockEditor.triggerUpdate('new content');
      });

      // Should not sync after 100ms
      await sleep(100);
      const yContent = doc.getMap('lexical');
      const earlyState = yContent.get('editorState') as string;
      const earlyParsed = JSON.parse(earlyState);
      // The initial state text
      expect(earlyParsed.root.children[0].children[0].text).toBe('initial');

      // Should sync after 200ms
      await sleep(150);
      const finalState = yContent.get('editorState') as string;
      const parsed = JSON.parse(finalState);
      expect(parsed.root.children[0].children[0].text).toBe('new content');
    });

    it('uses custom state key', () => {
      const customKey = 'myCustomEditorState';

      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} stateKey={customKey} />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');
      expect(yContent.get(customKey)).toBeDefined();
      expect(yContent.get('editorState')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty Yjs updates gracefully', () => {
      render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      const yContent = doc.getMap('lexical');

      // Clear the state
      act(() => {
        doc.transact(() => {
          yContent.delete('editorState');
        }, 'remote');
      });

      // Should not throw
      expect(mockEditor.editor.setEditorState).toBeDefined();
    });

    it('handles doc changes without errors', () => {
      const doc2 = new Y.Doc();

      const { rerender } = render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      // Change doc prop (this would trigger useEffect cleanup and re-run)
      rerender(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc2} />
        </TestWrapper>
      );

      // Should set up listeners on new doc
      const yContent2 = doc2.getMap('lexical');
      expect(yContent2.get('editorState')).toBeDefined();

      doc2.destroy();
    });
  });

  describe('returns null', () => {
    it('returns null (renders nothing)', () => {
      const { container } = render(
        <TestWrapper>
          <LexicalYjsPlugin doc={doc} />
        </TestWrapper>
      );

      expect(container.innerHTML).toBe('');
    });
  });
});
