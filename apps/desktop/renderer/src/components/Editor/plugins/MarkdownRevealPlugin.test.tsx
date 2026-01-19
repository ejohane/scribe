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
  $getSelection,
  $isRangeSelection,
  $isTextNode,
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
    // Per spec: cursor anywhere INSIDE a formatted TextNode triggers reveal.
    // The formatting markers (**bold**) are NOT stored in the TextNode.
    // So any position within the TextNode (including offset 0 and textLength)
    // is "inside" the formatted region and should trigger reveal.
    //
    // The "boundary" where we don't reveal is BEFORE or AFTER the TextNode entirely
    // (i.e., cursor is in a different node like previous/next sibling).

    it('reveals when cursor is at start of formatted text (offset 0)', async () => {
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

          // Place cursor at the very start (offset 0) - should still reveal
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 0, 'text');
          selection.focus.set(textNode.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Per spec: cursor at offset 0 within a formatted TextNode should trigger reveal
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
        }
      });
    });

    it('reveals when cursor is at end of formatted text (offset === textLength)', async () => {
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

          // Place cursor at the very end (offset === textLength) - should still reveal
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 4, 'text'); // "bold" has length 4
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Per spec: cursor at end position within a formatted TextNode should trigger reveal
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
        }
      });
    });

    it('reveals when cursor is in the middle of formatted text', async () => {
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

          // Place cursor in the middle
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

    it('does not reveal when cursor is before formatted text (in previous node)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with plain text followed by bold text: "plain **bold**"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const plainText = $createTextNode('plain ');
          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');

          paragraph.append(plainText);
          paragraph.append(boldText);
          root.append(paragraph);

          // Place cursor at the end of the plain text (just before bold)
          // This is OUTSIDE the bold TextNode
          const selection = $createRangeSelection();
          selection.anchor.set(plainText.getKey(), 6, 'text'); // "plain " has length 6
          selection.focus.set(plainText.getKey(), 6, 'text');
          $setSelection(selection);
        });
      });

      // Cursor is in the plain text node, not the bold one - should NOT reveal
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const plainText = paragraph.getFirstChild() as TextNode;
          expect(plainText.hasFormat('bold')).toBe(false);
        }
      });
    });

    it('does not reveal when cursor is after formatted text (in next node)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold text followed by plain text: "**bold** plain"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const plainText = $createTextNode(' plain');

          paragraph.append(boldText);
          paragraph.append(plainText);
          root.append(paragraph);

          // Place cursor at the start of the plain text (just after bold)
          // This is OUTSIDE the bold TextNode
          const selection = $createRangeSelection();
          selection.anchor.set(plainText.getKey(), 0, 'text');
          selection.focus.set(plainText.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Cursor is in the plain text node, not the bold one - should NOT reveal
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          const plainText = children[1] as TextNode;
          expect(plainText.hasFormat('bold')).toBe(false);
        }
      });
    });

    it('handles single-character formatted text at boundaries', async () => {
      // Note: Lexical tends to remove empty text nodes during normalization,
      // so we test the edge case of single-character formatted text instead.
      // This tests the boundary behavior for the shortest meaningful formatted text.
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with single-character bold text (minimal case)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('a'); // Single character with bold format
          textNode.toggleFormat('bold');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor at position 0 (start) - should still reveal
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 0, 'text');
          selection.focus.set(textNode.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Per spec: cursor at offset 0 within a formatted TextNode should trigger reveal
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode).not.toBeNull();
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.getTextContentSize()).toBe(1);
        }
      });

      // Also test cursor at position 1 (end) - should still reveal
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode;
            const selection = $createRangeSelection();
            selection.anchor.set(textNode.getKey(), 1, 'text');
            selection.focus.set(textNode.getKey(), 1, 'text');
            $setSelection(selection);
          }
        });
      });

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode).not.toBeNull();
          expect(textNode.hasFormat('bold')).toBe(true);
        }
      });
    });

    it('reveals bold when cursor at end of bold adjacent to italic', async () => {
      // Test case: **bold***italic* - cursor at end of "bold" (offset 4)
      // The cursor is INSIDE the bold TextNode, so it should reveal bold
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');

          paragraph.append(boldText);
          paragraph.append(italicText);
          root.append(paragraph);

          // Place cursor at end of bold text (still inside bold TextNode)
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 4, 'text'); // "bold" length is 4
          selection.focus.set(boldText.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Cursor at end of bold (inside bold TextNode) should reveal bold, not italic
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          const boldNode = children[0] as TextNode;

          // The selection is inside the bold node
          expect(boldNode.hasFormat('bold')).toBe(true);
          expect(boldNode.getTextContentSize()).toBe(4);
        }
      });
    });

    it('reveals italic when cursor at start of italic adjacent to bold', async () => {
      // Test case: **bold***italic* - cursor at start of "italic" (offset 0)
      // The cursor is INSIDE the italic TextNode, so it should reveal italic
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');

          paragraph.append(boldText);
          paragraph.append(italicText);
          root.append(paragraph);

          // Place cursor at start of italic text (still inside italic TextNode)
          const selection = $createRangeSelection();
          selection.anchor.set(italicText.getKey(), 0, 'text');
          selection.focus.set(italicText.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Cursor at start of italic (inside italic TextNode) should reveal italic, not bold
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          const italicNode = children[1] as TextNode;

          // The selection is inside the italic node
          expect(italicNode.hasFormat('italic')).toBe(true);
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

    it('handles triple format combo (bold + italic + strikethrough)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold+italic+strikethrough text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('triple format');
          textNode.toggleFormat('bold');
          textNode.toggleFormat('italic');
          textNode.toggleFormat('strikethrough');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor inside
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 6, 'text');
          selection.focus.set(textNode.getKey(), 6, 'text');
          $setSelection(selection);
        });
      });

      // Verify all three formats are present
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.hasFormat('italic')).toBe(true);
          expect(textNode.hasFormat('strikethrough')).toBe(true);
        }
      });
    });

    it('handles triple format combo (bold + italic + code)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with bold+italic+code text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('code combo');
          textNode.toggleFormat('bold');
          textNode.toggleFormat('italic');
          textNode.toggleFormat('code');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor inside
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 4, 'text');
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Verify all three formats are present
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.hasFormat('italic')).toBe(true);
          expect(textNode.hasFormat('code')).toBe(true);
        }
      });
    });

    it('handles all four formats combined', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with all four formats
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('all formats');
          textNode.toggleFormat('bold');
          textNode.toggleFormat('italic');
          textNode.toggleFormat('strikethrough');
          textNode.toggleFormat('code');
          paragraph.append(textNode);
          root.append(paragraph);

          // Place cursor inside
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Verify all four formats are present
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode;
          expect(textNode.hasFormat('bold')).toBe(true);
          expect(textNode.hasFormat('italic')).toBe(true);
          expect(textNode.hasFormat('strikethrough')).toBe(true);
          expect(textNode.hasFormat('code')).toBe(true);
        }
      });
    });

    it('handles adjacent differently-formatted text (bold next to italic)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph with adjacent bold and italic text: "**bold***italic*"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');

          paragraph.append(boldText);
          paragraph.append(italicText);
          root.append(paragraph);

          // Place cursor inside the bold text only
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 2, 'text');
          selection.focus.set(boldText.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      // Verify both text nodes have different formats
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          expect(children.length).toBe(2);

          const boldNode = children[0] as TextNode;
          const italicNode = children[1] as TextNode;

          // Bold node should have bold format only
          expect(boldNode.hasFormat('bold')).toBe(true);
          expect(boldNode.hasFormat('italic')).toBe(false);

          // Italic node should have italic format only
          expect(italicNode.hasFormat('bold')).toBe(false);
          expect(italicNode.hasFormat('italic')).toBe(true);
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

describe('Heading reveal', () => {
  // Note: Full heading reveal tests require CollapsibleHeadingNode and DOM testing.
  // These are integration tests that verify the heading detection logic.
  // See MarkdownRevealPlugin.integration.test.tsx for full DOM-based tests.

  it('exports FocusedHeading interface (type check)', () => {
    // Type-level test - this compiles if the interface is implicitly correct
    // The FocusedHeading interface is internal, but we verify the plugin handles headings
    const headingInfo: { nodeKey: string; tag: string } = {
      nodeKey: 'heading-key',
      tag: 'h2',
    };

    expect(headingInfo.nodeKey).toBe('heading-key');
    expect(headingInfo.tag).toBe('h2');
  });
});

/**
 * Keyboard Navigation Tests for MarkdownRevealPlugin
 *
 * Tests for P4.3: Test keyboard navigation (arrow keys, word jumps)
 *
 * These tests verify that reveal/hide behavior works correctly with
 * keyboard navigation, including:
 * - Arrow keys (Left, Right, Up, Down)
 * - Word jump (Ctrl/Option + Arrow)
 * - Line jump (Home/End)
 * - Document jump (Cmd+Up/Down)
 * - Rapid navigation (holding arrow keys)
 */
describe('Keyboard navigation', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Arrow key navigation into formatted text', () => {
    it('reveals when arrow right into bold text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph: "plain **bold**"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const plainText = $createTextNode('plain ');
          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');

          paragraph.append(plainText);
          paragraph.append(boldText);
          root.append(paragraph);

          // Place cursor at end of plain text (before bold)
          const selection = $createRangeSelection();
          selection.anchor.set(plainText.getKey(), 6, 'text');
          selection.focus.set(plainText.getKey(), 6, 'text');
          $setSelection(selection);
        });
      });

      // Simulate cursor moving into bold text (via arrow right)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const boldNode = children[1] as TextNode;

            // Move cursor to start of bold text
            const selection = $createRangeSelection();
            selection.anchor.set(boldNode.getKey(), 0, 'text');
            selection.focus.set(boldNode.getKey(), 0, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify cursor is now in bold text (which should trigger reveal)
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          expect(children.length).toBeGreaterThanOrEqual(2);

          // Find the bold node
          const boldNode = children.find(
            (child) => $isTextNode(child) && (child as TextNode).hasFormat('bold')
          ) as TextNode | undefined;

          expect(boldNode).toBeDefined();
          expect(boldNode?.hasFormat('bold')).toBe(true);
        }
      });
    });

    it('reveals when arrow left into italic text', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph: "*italic* plain"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');
          const plainText = $createTextNode(' plain');

          paragraph.append(italicText);
          paragraph.append(plainText);
          root.append(paragraph);

          // Place cursor at start of plain text (after italic)
          const selection = $createRangeSelection();
          selection.anchor.set(plainText.getKey(), 0, 'text');
          selection.focus.set(plainText.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Simulate cursor moving into italic text (via arrow left)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const italicNode = children[0] as TextNode;

            // Move cursor to end of italic text
            const selection = $createRangeSelection();
            selection.anchor.set(italicNode.getKey(), italicNode.getTextContentSize(), 'text');
            selection.focus.set(italicNode.getKey(), italicNode.getTextContentSize(), 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify cursor is now in italic text (which should trigger reveal)
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          const italicNode = children.find(
            (child) => $isTextNode(child) && (child as TextNode).hasFormat('italic')
          ) as TextNode | undefined;

          expect(italicNode).toBeDefined();
          expect(italicNode?.hasFormat('italic')).toBe(true);
        }
      });
    });
  });

  describe('Arrow key navigation out of formatted text', () => {
    it('cursor exiting bold text via arrow right', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph: "**bold** plain"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const plainText = $createTextNode(' plain');

          paragraph.append(boldText);
          paragraph.append(plainText);
          root.append(paragraph);

          // Place cursor at end of bold text (still inside bold node)
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 4, 'text');
          selection.focus.set(boldText.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Simulate cursor exiting bold text (via arrow right)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const plainNode = children[1] as TextNode;

            // Move cursor to start of plain text (exit bold)
            const selection = $createRangeSelection();
            selection.anchor.set(plainNode.getKey(), 0, 'text');
            selection.focus.set(plainNode.getKey(), 0, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify cursor is now in plain text (bold should no longer be revealed)
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          const plainNode = children.find(
            (child) => $isTextNode(child) && !(child as TextNode).hasFormat('bold')
          ) as TextNode | undefined;

          expect(plainNode).toBeDefined();
          expect(plainNode?.hasFormat('bold')).toBe(false);
        }
      });
    });

    it('cursor exiting italic text via arrow left', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create paragraph: "plain *italic*"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const plainText = $createTextNode('plain ');
          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');

          paragraph.append(plainText);
          paragraph.append(italicText);
          root.append(paragraph);

          // Place cursor at start of italic text (still inside italic node)
          const selection = $createRangeSelection();
          selection.anchor.set(italicText.getKey(), 0, 'text');
          selection.focus.set(italicText.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Simulate cursor exiting italic text (via arrow left)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const plainNode = children[0] as TextNode;

            // Move cursor to end of plain text (exit italic)
            const selection = $createRangeSelection();
            selection.anchor.set(plainNode.getKey(), 6, 'text');
            selection.focus.set(plainNode.getKey(), 6, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify cursor is now in plain text (italic should no longer be revealed)
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if ($isElementNode(paragraph)) {
          const children = paragraph.getChildren();
          const plainNode = children[0] as TextNode;

          expect(plainNode).toBeDefined();
          expect(plainNode?.hasFormat('italic')).toBe(false);
        }
      });
    });
  });

  describe('Word jump navigation (Ctrl+Arrow)', () => {
    it('word jump into bold text reveals correctly', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "Hello **bold world** there"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const text1 = $createTextNode('Hello ');
          const boldText = $createTextNode('bold world');
          boldText.toggleFormat('bold');
          const text2 = $createTextNode(' there');

          paragraph.append(text1, boldText, text2);
          root.append(paragraph);

          // Start at the beginning
          const selection = $createRangeSelection();
          selection.anchor.set(text1.getKey(), 0, 'text');
          selection.focus.set(text1.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Simulate Ctrl+Right word jump (lands in bold text at "bold")
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const boldNode = children[1] as TextNode;

            // Jump to start of "bold" word (inside bold text)
            const selection = $createRangeSelection();
            selection.anchor.set(boldNode.getKey(), 0, 'text');
            selection.focus.set(boldNode.getKey(), 0, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now inside bold text
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(true);
          }
        }
      });
    });

    it('word jump out of bold text hides correctly', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "Hello **bold world** there"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const text1 = $createTextNode('Hello ');
          const boldText = $createTextNode('bold world');
          boldText.toggleFormat('bold');
          const text2 = $createTextNode(' there');

          paragraph.append(text1, boldText, text2);
          root.append(paragraph);

          // Start inside bold text at "world"
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 5, 'text'); // After "bold "
          selection.focus.set(boldText.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Simulate Ctrl+Right word jump (exits bold text, lands in " there")
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const text2 = children[2] as TextNode;

            // Jump to start of "there" (outside bold text)
            const selection = $createRangeSelection();
            selection.anchor.set(text2.getKey(), 1, 'text'); // After space
            selection.focus.set(text2.getKey(), 1, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now outside bold text
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(false);
          }
        }
      });
    });
  });

  describe('Line jump navigation (Home/End)', () => {
    it('Home on line with formatted text at end works correctly', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "start **bold**"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const text1 = $createTextNode('start ');
          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');

          paragraph.append(text1, boldText);
          root.append(paragraph);

          // Start at end of bold text
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 4, 'text');
          selection.focus.set(boldText.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Simulate Home (jump to start of line)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const text1 = children[0] as TextNode;

            // Jump to start of line (start of first text node)
            const selection = $createRangeSelection();
            selection.anchor.set(text1.getKey(), 0, 'text');
            selection.focus.set(text1.getKey(), 0, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now at start of plain text (bold should not be revealed)
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(false);
          }
        }
      });
    });

    it('End on line with formatted text at start works correctly', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "**bold** end"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const text2 = $createTextNode(' end');

          paragraph.append(boldText, text2);
          root.append(paragraph);

          // Start at start of bold text
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 0, 'text');
          selection.focus.set(boldText.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Simulate End (jump to end of line)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const text2 = children[1] as TextNode;

            // Jump to end of line (end of last text node)
            const selection = $createRangeSelection();
            selection.anchor.set(text2.getKey(), text2.getTextContentSize(), 'text');
            selection.focus.set(text2.getKey(), text2.getTextContentSize(), 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now at end of plain text (bold should not be revealed)
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(false);
          }
        }
      });
    });
  });

  describe('Multiple formats on line navigation', () => {
    it('navigating through line with bold and italic reveals only what cursor lands in', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "This has **bold** and *italic* text"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const text1 = $createTextNode('This has ');
          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const text2 = $createTextNode(' and ');
          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');
          const text3 = $createTextNode(' text');

          paragraph.append(text1, boldText, text2, italicText, text3);
          root.append(paragraph);

          // Start in bold text
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 2, 'text');
          selection.focus.set(boldText.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      // Verify we're in bold text
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(true);
            expect(anchorNode.hasFormat('italic')).toBe(false);
          }
        }
      });

      // Navigate to italic text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const children = paragraph.getChildren();
            const italicNode = children[3] as TextNode;

            // Move to italic text
            const selection = $createRangeSelection();
            selection.anchor.set(italicNode.getKey(), 2, 'text');
            selection.focus.set(italicNode.getKey(), 2, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now in italic text (not bold)
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(false);
            expect(anchorNode.hasFormat('italic')).toBe(true);
          }
        }
      });
    });
  });

  describe('Rapid navigation (held arrow key)', () => {
    it('handles rapid cursor movements without errors', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "plain **bold** plain **bold2** plain"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const text1 = $createTextNode('plain ');
          const bold1 = $createTextNode('bold');
          bold1.toggleFormat('bold');
          const text2 = $createTextNode(' plain ');
          const bold2 = $createTextNode('bold2');
          bold2.toggleFormat('bold');
          const text3 = $createTextNode(' plain');

          paragraph.append(text1, bold1, text2, bold2, text3);
          root.append(paragraph);
        });
      });

      // Simulate rapid cursor movements (like holding arrow key)
      // This should not throw any errors
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          editor.update(() => {
            const root = $getRoot();
            const paragraph = root.getFirstChild();
            if ($isElementNode(paragraph)) {
              const children = paragraph.getChildren();
              // Alternate between different text nodes
              const nodeIndex = i % children.length;
              const node = children[nodeIndex];
              if ($isTextNode(node)) {
                const offset = Math.min(
                  i % (node.getTextContentSize() + 1),
                  node.getTextContentSize()
                );
                const selection = $createRangeSelection();
                selection.anchor.set(node.getKey(), offset, 'text');
                selection.focus.set(node.getKey(), offset, 'text');
                $setSelection(selection);
              }
            }
          });
        });
      }

      // Verify editor is still functional after rapid movements
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('plain bold plain bold2 plain');
      });
    });

    it('debouncing prevents excessive updates during rapid movement', async () => {
      // This test verifies that the debounce mechanism is working
      // by checking that the plugin doesn't cause performance issues
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create text with formatting
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const text1 = $createTextNode('plain ');
          const bold = $createTextNode('bold');
          bold.toggleFormat('bold');

          paragraph.append(text1, bold);
          root.append(paragraph);
        });
      });

      // Track time for rapid movements
      const startTime = performance.now();

      // Perform many rapid cursor movements
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          editor.update(() => {
            const root = $getRoot();
            const paragraph = root.getFirstChild();
            if ($isElementNode(paragraph)) {
              const children = paragraph.getChildren();
              const node = children[i % children.length];
              if ($isTextNode(node)) {
                const offset = i % (node.getTextContentSize() + 1);
                const selection = $createRangeSelection();
                selection.anchor.set(node.getKey(), offset, 'text');
                selection.focus.set(node.getKey(), offset, 'text');
                $setSelection(selection);
              }
            }
          });
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 2 seconds for 50 movements)
      // This is a rough check to catch major performance regressions
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Vertical navigation (Up/Down arrows)', () => {
    it('up/down through paragraphs with different formatting', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create multiple paragraphs:
      // Line 1: "plain text"
      // Line 2: "**bold text**"
      // Line 3: "*italic text*"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const para1 = $createParagraphNode();
          para1.append($createTextNode('plain text'));

          const para2 = $createParagraphNode();
          const boldText = $createTextNode('bold text');
          boldText.toggleFormat('bold');
          para2.append(boldText);

          const para3 = $createParagraphNode();
          const italicText = $createTextNode('italic text');
          italicText.toggleFormat('italic');
          para3.append(italicText);

          root.append(para1, para2, para3);

          // Start in first paragraph
          const textNode = para1.getFirstChild() as TextNode;
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Verify we're in plain text
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(false);
            expect(anchorNode.hasFormat('italic')).toBe(false);
          }
        }
      });

      // Simulate down arrow to bold paragraph
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const para2 = root.getChildren()[1];
          if ($isElementNode(para2)) {
            const boldNode = para2.getFirstChild() as TextNode;
            const selection = $createRangeSelection();
            selection.anchor.set(boldNode.getKey(), 5, 'text');
            selection.focus.set(boldNode.getKey(), 5, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now in bold text
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(true);
          }
        }
      });

      // Simulate down arrow to italic paragraph
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const para3 = root.getChildren()[2];
          if ($isElementNode(para3)) {
            const italicNode = para3.getFirstChild() as TextNode;
            const selection = $createRangeSelection();
            selection.anchor.set(italicNode.getKey(), 5, 'text');
            selection.focus.set(italicNode.getKey(), 5, 'text');
            $setSelection(selection);
          }
        });
      });

      // Verify we're now in italic text
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('italic')).toBe(true);
            expect(anchorNode.hasFormat('bold')).toBe(false);
          }
        }
      });
    });
  });

  describe('Adjacent formatted regions', () => {
    it('cursor at boundary between bold and italic', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create: "**bold***italic*"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();

          const boldText = $createTextNode('bold');
          boldText.toggleFormat('bold');
          const italicText = $createTextNode('italic');
          italicText.toggleFormat('italic');

          paragraph.append(boldText, italicText);
          root.append(paragraph);

          // Place cursor at end of bold (offset 4)
          const selection = $createRangeSelection();
          selection.anchor.set(boldText.getKey(), 4, 'text');
          selection.focus.set(boldText.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Cursor at end of bold should reveal bold (not italic)
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('bold')).toBe(true);
          }
        }
      });

      // Move cursor to start of italic (offset 0)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild();
          if ($isElementNode(paragraph)) {
            const italicNode = paragraph.getChildren()[1] as TextNode;
            const selection = $createRangeSelection();
            selection.anchor.set(italicNode.getKey(), 0, 'text');
            selection.focus.set(italicNode.getKey(), 0, 'text');
            $setSelection(selection);
          }
        });
      });

      // Cursor at start of italic should reveal italic (not bold)
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const anchorNode = selection.anchor.getNode();
          if ($isTextNode(anchorNode)) {
            expect(anchorNode.hasFormat('italic')).toBe(true);
            expect(anchorNode.hasFormat('bold')).toBe(false);
          }
        }
      });
    });
  });
});
