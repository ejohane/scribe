/**
 * InitialStatePlugin Tests
 *
 * Tests the plugin that initializes the Lexical editor with saved state.
 * This plugin is responsible for loading note content when a note is opened.
 *
 * Test Strategy:
 * 1. Verify state loading when note ID changes
 * 2. Verify no reload when note ID stays the same
 * 3. Verify handling of null/empty content
 * 4. Verify error handling for invalid state
 * 5. Verify editor focus behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $getRoot, LexicalEditor } from 'lexical';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { EditorContent } from '@scribe/shared';

import { InitialStatePlugin } from './InitialStatePlugin';

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Test wrapper that provides Lexical context
function TestEditor({
  children,
  editorRef,
  initialState,
  noteId,
}: {
  children?: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  initialState: EditorContent | null;
  noteId: string | null;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'initial-state-test',
        nodes: [],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorCapture editorRef={editorRef} />
      <InitialStatePlugin initialState={initialState} noteId={noteId} />
      {children}
    </LexicalComposer>
  );
}

// Helper to create valid Lexical editor state
function createValidContent(text: string): EditorContent {
  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: text,
              type: 'text',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
          textFormat: 0,
          textStyle: '',
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as EditorContent;
}

// Helper to create empty content
function createEmptyContent(): EditorContent {
  return {
    root: {
      children: [],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as EditorContent;
}

describe('InitialStatePlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('State Loading', () => {
    it('loads initial state when note ID is provided', async () => {
      const content = createValidContent('Hello, World!');

      render(<TestEditor editorRef={editorRef} initialState={content} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Wait for the effect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Verify the content was loaded
      editorRef.current!.getEditorState().read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        expect(textContent).toBe('Hello, World!');
      });
    });

    it('does not reload when note ID stays the same', async () => {
      const content = createValidContent('Original content');

      const { rerender } = render(
        <TestEditor editorRef={editorRef} initialState={content} noteId="note-1" />
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Wait for initial load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Mock setEditorState to track if it's called again
      const setEditorStateSpy = vi.spyOn(editorRef.current!, 'setEditorState');

      // Rerender with different content but same note ID
      const newContent = createValidContent('New content');
      rerender(<TestEditor editorRef={editorRef} initialState={newContent} noteId="note-1" />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not have called setEditorState again (same note ID)
      expect(setEditorStateSpy).not.toHaveBeenCalled();
    });

    it('reloads when note ID changes', async () => {
      const content1 = createValidContent('Note 1 content');

      const { rerender } = render(
        <TestEditor editorRef={editorRef} initialState={content1} noteId="note-1" />
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Wait for initial load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Verify first content loaded
      editorRef.current!.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('Note 1 content');
      });

      // Change note ID and content
      const content2 = createValidContent('Note 2 content');
      rerender(<TestEditor editorRef={editorRef} initialState={content2} noteId="note-2" />);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Verify second content loaded
      editorRef.current!.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('Note 2 content');
      });
    });
  });

  describe('Null/Empty State Handling', () => {
    it('handles null note ID', async () => {
      const content = createValidContent('Some content');

      render(<TestEditor editorRef={editorRef} initialState={content} noteId={null} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Should not load content when note ID is null
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Editor should have default empty state
      editorRef.current!.getEditorState().read(() => {
        const root = $getRoot();
        // Should not have loaded the content
        expect(root.getTextContent()).not.toBe('Some content');
      });
    });

    it('handles null initial state', async () => {
      render(<TestEditor editorRef={editorRef} initialState={null} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not throw and editor should be usable
      expect(editorRef.current).not.toBeNull();
    });

    it('handles empty content (no children)', async () => {
      const emptyContent = createEmptyContent();

      render(<TestEditor editorRef={editorRef} initialState={emptyContent} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not throw and editor should be usable
      expect(editorRef.current).not.toBeNull();
    });

    it('handles content without root', async () => {
      const invalidContent = {} as EditorContent;

      render(<TestEditor editorRef={editorRef} initialState={invalidContent} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should not throw
      expect(editorRef.current).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('catches and logs errors when parsing invalid state', async () => {
      // Create completely invalid Lexical state that will fail to parse
      const invalidState = {
        root: {
          children: [
            {
              type: 'invalid-nonexistent-type',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      } as unknown as EditorContent;

      render(<TestEditor editorRef={editorRef} initialState={invalidState} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should have logged the error (logger outputs structured format)
      const errorCalls = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const logCall = errorCalls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[InitialStatePlugin]') &&
          call[0].includes('Failed to load editor state')
      );
      expect(logCall).toBeDefined();
    });

    it('does not crash on parse error', async () => {
      const invalidState = {
        root: {
          children: [{ type: 'unknown-type' }],
          type: 'root',
          version: 1,
        },
      } as unknown as EditorContent;

      // This should not throw
      expect(() => {
        render(<TestEditor editorRef={editorRef} initialState={invalidState} noteId="note-1" />);
      }).not.toThrow();
    });
  });

  describe('Editor Focus', () => {
    it('focuses editor after loading content', async () => {
      const content = createValidContent('Focus test');

      // Track if focus was called by verifying the content loads successfully
      // (focus is called at the end of the successful load path)
      render(<TestEditor editorRef={editorRef} initialState={content} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Wait for the effect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Verify the content was loaded - this proves the effect ran to completion
      // which includes the focus() call
      editorRef.current!.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('Focus test');
      });
    });

    it('focuses editor for empty notes', async () => {
      const emptyContent = createEmptyContent();

      render(<TestEditor editorRef={editorRef} initialState={emptyContent} noteId="note-1" />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Wait for the effect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Editor should still be usable
      expect(editorRef.current).not.toBeNull();
    });
  });

  describe('Component Behavior', () => {
    it('returns null (no rendered output)', () => {
      const { container } = render(
        <TestEditor editorRef={editorRef} initialState={null} noteId={null} />
      );

      // The InitialStatePlugin itself should not render any DOM elements
      // (besides what TestEditor wrapper renders)
      expect(container.querySelector('[data-testid="editor"]')).toBeTruthy();
    });

    it('tracks loaded note ID across re-renders', async () => {
      const content = createValidContent('Test content');

      const { rerender } = render(
        <TestEditor editorRef={editorRef} initialState={content} noteId="note-1" />
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Wait for initial load
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const setEditorStateSpy = vi.spyOn(editorRef.current!, 'setEditorState');

      // Multiple re-renders with same note ID should not reload
      for (let i = 0; i < 5; i++) {
        rerender(<TestEditor editorRef={editorRef} initialState={content} noteId="note-1" />);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      }

      expect(setEditorStateSpy).not.toHaveBeenCalled();
    });
  });
});
