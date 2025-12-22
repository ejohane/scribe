import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $createTextNode, $getRoot, LexicalEditor } from 'lexical';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ManualSavePlugin } from './ManualSavePlugin';

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
}: {
  children: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
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
      {children}
    </LexicalComposer>
  );
}

describe('ManualSavePlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;
  let mockOnSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    editorRef = { current: null };
    mockOnSave = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to dispatch a keyboard event to the editor.
   */
  function dispatchKeyDown(
    editor: LexicalEditor,
    key: string,
    options: { metaKey?: boolean; ctrlKey?: boolean } = {}
  ) {
    const event = new KeyboardEvent('keydown', {
      key,
      metaKey: options.metaKey ?? false,
      ctrlKey: options.ctrlKey ?? false,
      bubbles: true,
      cancelable: true,
    });

    // Dispatch the event through the editor's root element
    const rootElement = editor.getRootElement();
    if (rootElement) {
      rootElement.dispatchEvent(event);
    }
  }

  describe('Cmd+S triggers save (Mac)', () => {
    it('calls onSave when Cmd+S is pressed', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Add some content first
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Hello world');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Trigger Cmd+S
      await act(async () => {
        dispatchKeyDown(editor, 's', { metaKey: true });
      });

      // onSave should be called immediately (no debounce)
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          root: expect.any(Object),
        })
      );
    });
  });

  describe('Ctrl+S triggers save (Windows/Linux)', () => {
    it('calls onSave when Ctrl+S is pressed', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Add some content first
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Hello world');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Trigger Ctrl+S
      await act(async () => {
        dispatchKeyDown(editor, 's', { ctrlKey: true });
      });

      // onSave should be called immediately
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('handles save errors', () => {
    it('logs error when save fails but does not crash', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const saveError = new Error('Manual save failed');
      mockOnSave.mockRejectedValueOnce(saveError);

      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Add some content
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Error test');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Trigger Cmd+S
      await act(async () => {
        dispatchKeyDown(editor, 's', { metaKey: true });
      });

      // Wait for the async error handling (logger outputs structured format)
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
        expect(logOutput).toContain('ERROR');
        expect(logOutput).toContain('[ManualSavePlugin]');
        expect(logOutput).toContain('Manual save failed');
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('does not trigger on other keys', () => {
    it('ignores regular S key without modifier', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Trigger just S key (no modifier)
      await act(async () => {
        dispatchKeyDown(editor, 's', {});
      });

      // onSave should not be called
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('ignores Cmd+other keys', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Trigger Cmd+A (select all, different key)
      await act(async () => {
        dispatchKeyDown(editor, 'a', { metaKey: true });
      });

      // onSave should not be called
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('cleanup on unmount', () => {
    it('removes command listener on unmount', async () => {
      const { unmount } = render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Unmount the component
      unmount();

      // Trigger Cmd+S after unmount (on the editor that still exists)
      // This should not cause any errors or call onSave
      await act(async () => {
        dispatchKeyDown(editor, 's', { metaKey: true });
      });

      // onSave should not be called since plugin was unmounted
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('saves current editor state', () => {
    it('saves the content that exists at the time of Cmd+S', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Add specific content
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Specific content to save');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Trigger Cmd+S
      await act(async () => {
        dispatchKeyDown(editor, 's', { metaKey: true });
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });

      // Verify the content was serialized correctly
      const savedContent = mockOnSave.mock.calls[0][0];
      expect(savedContent.root.children).toHaveLength(1);
      expect(savedContent.root.children[0].children[0].text).toBe('Specific content to save');
    });
  });

  describe('prevents default browser save dialog', () => {
    it('calls preventDefault on the event', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <ManualSavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      const editor = editorRef.current!;

      // Create event with spy on preventDefault
      const event = new KeyboardEvent('keydown', {
        key: 's',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      await act(async () => {
        const rootElement = editor.getRootElement();
        if (rootElement) {
          rootElement.dispatchEvent(event);
        }
      });

      // Wait for the save to be triggered
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // Verify event methods were called
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });
});
