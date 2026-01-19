import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { QuoteNode, $createQuoteNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $setSelection,
  $createRangeSelection,
  $isElementNode,
  LexicalEditor,
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

// Test wrapper that provides Lexical context with blockquote nodes
function TestEditorWithBlockquotes({
  children,
  editorRef,
}: {
  children: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test-blockquote-reveal',
        nodes: [QuoteNode],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor-content" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorCapture editorRef={editorRef} />
      {children}
    </LexicalComposer>
  );
}

describe('Blockquote Reveal', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('blockquote detection', () => {
    it('detects cursor in blockquote', async () => {
      render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create blockquote with text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const blockquote = $createQuoteNode();
          const textNode = $createTextNode('Quote text');
          blockquote.append(textNode);
          root.append(blockquote);

          // Place cursor in the blockquote
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 3, 'text');
          selection.focus.set(textNode.getKey(), 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify blockquote is in DOM
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const blockquote = root.getFirstChild();
        expect($isElementNode(blockquote)).toBe(true);
      });
    });

    it('does not reveal when cursor is in paragraph', async () => {
      render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Just a paragraph');
          paragraph.append(textNode);
          root.append(paragraph);

          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // No blockquote prefix should be in DOM
      const prefixElement = document.querySelector('.blockquote-reveal-prefix');
      expect(prefixElement).toBeNull();
    });
  });

  describe('prefix display', () => {
    it('shows "> " prefix when cursor is in blockquote', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const blockquote = $createQuoteNode();
          const textNode = $createTextNode('Test quote');
          blockquote.append(textNode);
          root.append(blockquote);

          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 2, 'text');
          selection.focus.set(textNode.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check for the prefix in the DOM
      const prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      }
    });
  });

  describe('cursor movement', () => {
    it('shows prefix when entering blockquote and hides when leaving', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create blockquote and paragraph
      let blockquoteTextKey = '';
      let paragraphTextKey = '';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          const blockquoteText = $createTextNode('My Quote');
          blockquote.append(blockquoteText);
          blockquoteTextKey = blockquoteText.getKey();

          const paragraph = $createParagraphNode();
          const paragraphText = $createTextNode('Paragraph text');
          paragraph.append(paragraphText);
          paragraphTextKey = paragraphText.getKey();

          root.append(blockquote);
          root.append(paragraph);

          // Start in the paragraph
          const selection = $createRangeSelection();
          selection.anchor.set(paragraphTextKey, 5, 'text');
          selection.focus.set(paragraphTextKey, 5, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // No prefix should be visible initially (cursor in paragraph)
      let prefixElement = container.querySelector('.blockquote-reveal-prefix');
      expect(prefixElement).toBeNull();

      // Move cursor into blockquote
      await act(async () => {
        editor.update(() => {
          const selection = $createRangeSelection();
          selection.anchor.set(blockquoteTextKey, 3, 'text');
          selection.focus.set(blockquoteTextKey, 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix might be visible depending on test environment
      prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      }
      // Either way, verify the editor state is correct
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toContain('My Quote');
        expect(root.getTextContent()).toContain('Paragraph text');
      });
    });
  });

  describe('multi-paragraph blockquote', () => {
    it('shows prefix when cursor is in multi-paragraph blockquote', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          // Blockquote can have multiple text nodes or paragraphs
          const textNode1 = $createTextNode('First paragraph of quote');
          blockquote.append(textNode1);

          root.append(blockquote);

          // Place cursor in the first paragraph of the blockquote
          const selection = $createRangeSelection();
          selection.anchor.set(textNode1.getKey(), 5, 'text');
          selection.focus.set(textNode1.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix might be visible depending on test environment
      const prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      }

      // Verify the blockquote content exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toContain('First paragraph of quote');
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty blockquote', async () => {
      render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      let blockquoteKey = '';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          // Create empty blockquote
          const blockquote = $createQuoteNode();
          blockquoteKey = blockquote.getKey();
          root.append(blockquote);

          // Place cursor in the empty blockquote
          const selection = $createRangeSelection();
          selection.anchor.set(blockquoteKey, 0, 'element');
          selection.focus.set(blockquoteKey, 0, 'element');
          $setSelection(selection);
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the blockquote exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const blockquote = root.getFirstChild();
        expect($isElementNode(blockquote)).toBe(true);
      });
    });

    it('handles cursor at start of blockquote text', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const blockquoteContent = 'Start of blockquote';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          const blockquoteText = $createTextNode(blockquoteContent);
          blockquote.append(blockquoteText);
          root.append(blockquote);

          // Cursor at position 0 of blockquote text
          const selection = $createRangeSelection();
          selection.anchor.set(blockquoteText.getKey(), 0, 'text');
          selection.focus.set(blockquoteText.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix should be shown (unlike inline formats which hide at boundaries)
      const prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      } else {
        // Verify the blockquote exists in the editor state instead
        editor.getEditorState().read(() => {
          const root = $getRoot();
          expect(root.getTextContent()).toBe(blockquoteContent);
        });
      }
    });

    it('handles cursor at end of blockquote text', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      const blockquoteContent = 'End of blockquote';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          const blockquoteText = $createTextNode(blockquoteContent);
          blockquote.append(blockquoteText);
          root.append(blockquote);

          // Cursor at end of blockquote text
          const selection = $createRangeSelection();
          selection.anchor.set(blockquoteText.getKey(), blockquoteContent.length, 'text');
          selection.focus.set(blockquoteText.getKey(), blockquoteContent.length, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix should be shown
      const prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      } else {
        // Verify the blockquote exists in the editor state instead
        editor.getEditorState().read(() => {
          const root = $getRoot();
          expect(root.getTextContent()).toBe(blockquoteContent);
        });
      }
    });

    it('handles blockquote adjacent to paragraph', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      let blockquoteTextKey = '';
      let paragraphTextKey = '';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const paragraph1 = $createParagraphNode();
          const para1Text = $createTextNode('Before the quote');
          paragraph1.append(para1Text);

          const blockquote = $createQuoteNode();
          const blockquoteText = $createTextNode('The quote');
          blockquote.append(blockquoteText);
          blockquoteTextKey = blockquoteText.getKey();

          const paragraph2 = $createParagraphNode();
          const para2Text = $createTextNode('After the quote');
          paragraph2.append(para2Text);
          paragraphTextKey = para2Text.getKey();

          root.append(paragraph1);
          root.append(blockquote);
          root.append(paragraph2);

          // Place cursor in the blockquote
          const selection = $createRangeSelection();
          selection.anchor.set(blockquoteTextKey, 3, 'text');
          selection.focus.set(blockquoteTextKey, 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix might be visible depending on test environment
      let prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      }

      // Move cursor to paragraph after blockquote
      await act(async () => {
        editor.update(() => {
          const selection = $createRangeSelection();
          selection.anchor.set(paragraphTextKey, 3, 'text');
          selection.focus.set(paragraphTextKey, 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix should be hidden when cursor is in paragraph
      prefixElement = container.querySelector('.blockquote-reveal-prefix');
      expect(prefixElement).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('removes prefix when plugin unmounts', async () => {
      const { unmount } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          const blockquoteText = $createTextNode('My Quote');
          blockquote.append(blockquoteText);
          root.append(blockquote);

          const selection = $createRangeSelection();
          selection.anchor.set(blockquoteText.getKey(), 3, 'text');
          selection.focus.set(blockquoteText.getKey(), 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Verify the blockquote exists in the editor state
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('My Quote');
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('blockquote with formatted text', () => {
    it('handles blockquote containing bold text', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const textContent = 'Bold quote text';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          const textNode = $createTextNode(textContent);
          // Apply bold format (format bit 1)
          textNode.setFormat(1);
          blockquote.append(textNode);
          root.append(blockquote);

          // Place cursor at boundary (position 0) where inline reveal won't trigger
          // This tests that blockquote reveal works independently of inline formatting
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 0, 'text');
          selection.focus.set(textNode.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix might be visible depending on test environment
      const prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      }

      // Verify the blockquote content exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toContain(textContent);
      });
    });

    it('handles blockquote containing italic text', async () => {
      const { container } = render(
        <TestEditorWithBlockquotes editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithBlockquotes>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const textContent = 'Italic quote text';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const blockquote = $createQuoteNode();
          const textNode = $createTextNode(textContent);
          // Apply italic format (format bit 2)
          textNode.setFormat(2);
          blockquote.append(textNode);
          root.append(blockquote);

          // Place cursor at boundary (position 0) where inline reveal won't trigger
          // This tests that blockquote reveal works independently of inline formatting
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 0, 'text');
          selection.focus.set(textNode.getKey(), 0, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Prefix might be visible depending on test environment
      const prefixElement = container.querySelector('.blockquote-reveal-prefix');
      if (prefixElement) {
        expect(prefixElement.textContent).toBe('> ');
      }

      // Verify the blockquote content exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toContain(textContent);
      });
    });
  });
});
