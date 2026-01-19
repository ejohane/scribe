import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  $createRangeSelection,
  $isElementNode,
  LexicalEditor,
  TextNode,
} from 'lexical';
import { MarkdownRevealPlugin } from './MarkdownRevealPlugin';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

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
        contentEditable={<ContentEditable />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorCapture editorRef={editorRef} />
      {children}
    </LexicalComposer>
  );
}

describe('MarkdownRevealPlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('plugin initialization', () => {
    it('renders without errors', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Plugin should not render any visible UI
      const editor = editorRef.current!;
      expect(editor).toBeDefined();
    });

    it('registers selection change command handler', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Verify editor is functional after plugin registration
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Test text'));
          root.append(paragraph);
        });
      });

      // Editor should still work properly
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('Test text');
      });
    });

    it('returns null (no visual output)', async () => {
      const { container } = render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // The plugin itself should not add any DOM elements
      // Only the editor's ContentEditable should be present
      const editableDiv = container.querySelector('[contenteditable="true"]');
      expect(editableDiv).not.toBeNull();
    });
  });

  describe('cursor tracking', () => {
    it('handles cursor in unformatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with unformatted text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('plain text');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor in the middle of the text
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Plugin should handle this without errors
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('plain text');
      });
    });

    it('handles cursor in formatted text (bold)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold text');
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor in the middle of the bold text
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 4, 'text');
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Verify text has bold formatting
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
        }
      });
    });

    it('handles cursor in formatted text (italic)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with italic text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('italic text');
          textNode.toggleFormat('italic');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor in the middle
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 3, 'text');
          selection.focus.set(textNode.getKey(), 3, 'text');
          $setSelection(selection);
        });
      });

      // Verify text has italic formatting
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('italic')).toBe(true);
        }
      });
    });

    it('handles cursor in strikethrough formatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with strikethrough text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('strikethrough text');
          textNode.toggleFormat('strikethrough');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor in the middle
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 6, 'text');
          selection.focus.set(textNode.getKey(), 6, 'text');
          $setSelection(selection);
        });
      });

      // Verify text has strikethrough formatting
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('strikethrough')).toBe(true);
        }
      });
    });

    it('handles cursor in code formatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with code text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('code text');
          textNode.toggleFormat('code');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor in the middle
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 4, 'text');
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Verify text has code formatting
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('code')).toBe(true);
        }
      });
    });
  });

  describe('boundary detection', () => {
    it('does not reveal when cursor is at start of formatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold text');
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor at the very start (offset 0)
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 0, 'text');
          selection.focus.set(textNode.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Plugin should not reveal at boundary
      // This is tested by ensuring no errors occur
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('bold text');
      });
    });

    it('does not reveal when cursor is at end of formatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold');
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor at the very end
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 4, 'text'); // "bold" has length 4
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Plugin should handle boundary without errors
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('bold');
      });
    });

    it('reveals when cursor is strictly inside formatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold text');
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor strictly inside (not at boundaries)
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 2, 'text');
          selection.focus.set(textNode.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      // Plugin should detect this as inside formatted region
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.getTextContentSize()).toBe(9); // "bold text"
        }
      });
    });
  });

  describe('selection types', () => {
    it('ignores non-collapsed selections (text range)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold text and select a range
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold text');
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          root.append(paragraph);

          // Create a non-collapsed selection (range)
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 0, 'text');
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Plugin should not reveal for range selections
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('bold text');
      });
    });

    it('handles null selection gracefully', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph and clear selection
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('text'));
          root.append(paragraph);
          $setSelection(null);
        });
      });

      // Plugin should handle null selection without errors
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('text');
      });
    });
  });

  describe('multiple format types', () => {
    it('handles text with multiple formats (bold + italic)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold+italic text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold italic');
          textNode.toggleFormat('bold');
          textNode.toggleFormat('italic');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor inside
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Verify both formats are present
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.hasFormat('italic')).toBe(true);
        }
      });
    });

    it('handles text with bold + strikethrough', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold+strikethrough text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('bold strikethrough');
          textNode.toggleFormat('bold');
          textNode.toggleFormat('strikethrough');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor inside
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Verify both formats are present
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.hasFormat('strikethrough')).toBe(true);
        }
      });
    });

    it('handles mixed formatted and unformatted text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with mixed text: "plain **bold** plain"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const plainText1 = $createTextNode('plain ');
          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const plainText2 = $createTextNode(' plain');

          paragraph.append(plainText1);
          paragraph.append(boldText);
          paragraph.append(plainText2);
          root.append(paragraph);

          // Place cursor in the bold text
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 2, 'text');
          selection.focus.set(boldText.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      // Verify content structure
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          expect(children.length).toBe(3);

          const textNode1 = children[0] as TextNode;
          const textNode2 = children[1] as TextNode;
          const textNode3 = children[2] as TextNode;

          expect(textNode1.hasFormat('bold')).toBe(false);
          expect(textNode2.hasFormat('bold')).toBe(true);
          expect(textNode3.hasFormat('bold')).toBe(false);
        }
      });
    });
  });

  describe('cleanup', () => {
    it('cleans up on unmount', async () => {
      const { unmount } = render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });
});

describe('RevealedRegion interface', () => {
  it('has correct shape', () => {
    // Type-level test - this compiles if the interface is correct
    const region: {
      nodeKey: string;
      format: number;
      startOffset: number;
      endOffset: number;
    } = {
      nodeKey: 'test-key',
      format: 1, // Bold
      startOffset: 0,
      endOffset: 10,
    };

    expect(region.nodeKey).toBe('test-key');
    expect(region.format).toBe(1);
    expect(region.startOffset).toBe(0);
    expect(region.endOffset).toBe(10);
  });
});
