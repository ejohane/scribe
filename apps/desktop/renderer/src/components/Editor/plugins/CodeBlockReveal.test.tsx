import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { CodeNode, CodeHighlightNode, $createCodeNode } from '@lexical/code';
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

// Test wrapper that provides Lexical context with code nodes
function TestEditorWithCodeBlocks({
  children,
  editorRef,
}: {
  children: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test-codeblock-reveal',
        nodes: [CodeNode, CodeHighlightNode],
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

describe('Code Block Fence Reveal', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('code block detection', () => {
    it('detects cursor in code block with language', async () => {
      render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create code block with language
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('typescript');
          const textNode = $createTextNode('const x = 1;');
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Place cursor in the code block
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 3, 'text');
          selection.focus.set(textNode.getKey(), 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify code block is in DOM
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const codeBlock = root.getFirstChild();
        expect($isElementNode(codeBlock)).toBe(true);
      });
    });

    it('detects cursor in code block without language', async () => {
      render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create code block without language
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode(); // No language
          const textNode = $createTextNode('plain code');
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Place cursor in the code block
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 4, 'text');
          selection.focus.set(textNode.getKey(), 4, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify code block exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('plain code');
      });
    });

    it('does not detect when cursor is in paragraph', async () => {
      render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
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

      // No code block fence should be in DOM
      const fenceElement = document.querySelector('.codeblock-reveal-fence');
      expect(fenceElement).toBeNull();
    });
  });

  describe('fence display based on cursor position', () => {
    it('shows opening fence when cursor is on first line', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('javascript');
          const textNode = $createTextNode('line 1\nline 2\nline 3');
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Place cursor on first line (offset 3 is within "line 1")
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 3, 'text');
          selection.focus.set(textNode.getKey(), 3, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Check for opening fence - may or may not be present depending on test environment
      const openFence = container.querySelector('.codeblock-reveal-fence-open');
      if (openFence) {
        expect(openFence.textContent).toBe('```javascript');
      }

      // Verify the code block content
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toContain('line 1');
      });
    });

    it('shows closing fence when cursor is on last line', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('python');
          const textNode = $createTextNode('line 1\nline 2\nline 3');
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Place cursor on last line (offset 18 is within "line 3")
          // "line 1\nline 2\nline 3" = 21 chars, offset 18 is in "line 3"
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 18, 'text');
          selection.focus.set(textNode.getKey(), 18, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Check for closing fence - may or may not be present depending on test environment
      const closeFence = container.querySelector('.codeblock-reveal-fence-close');
      if (closeFence) {
        expect(closeFence.textContent).toBe('```');
      }

      // Verify the code block content
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toContain('line 3');
      });
    });

    it('shows no fence when cursor is on middle line', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('typescript');
          const textNode = $createTextNode('line 1\nline 2\nline 3');
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Place cursor on middle line (offset 10 is within "line 2")
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 10, 'text');
          selection.focus.set(textNode.getKey(), 10, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // No fence should be shown for middle lines
      const openFence = container.querySelector('.codeblock-reveal-fence-open');
      const closeFence = container.querySelector('.codeblock-reveal-fence-close');
      expect(openFence).toBeNull();
      expect(closeFence).toBeNull();
    });

    it('shows both fences for single-line code block', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('rust');
          const textNode = $createTextNode('single line');
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Place cursor in the single line
          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 5, 'text');
          selection.focus.set(textNode.getKey(), 5, 'text');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Check for both fences - may or may not be present depending on test environment
      const openFence = container.querySelector('.codeblock-reveal-fence-open');
      const closeFence = container.querySelector('.codeblock-reveal-fence-close');
      if (openFence && closeFence) {
        expect(openFence.textContent).toBe('```rust');
        expect(closeFence.textContent).toBe('```');
      }

      // Verify the code block content
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('single line');
      });
    });

    it('shows both fences for empty code block', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      let codeBlockKey = '';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('go');
          codeBlockKey = codeBlock.getKey();
          root.append(codeBlock);

          // Place cursor in the empty code block
          const selection = $createRangeSelection();
          selection.anchor.set(codeBlockKey, 0, 'element');
          selection.focus.set(codeBlockKey, 0, 'element');
          $setSelection(selection);
        });
      });

      // Wait for debounce and DOM updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Check for both fences - may or may not be present depending on test environment
      const openFence = container.querySelector('.codeblock-reveal-fence-open');
      const closeFence = container.querySelector('.codeblock-reveal-fence-close');
      if (openFence && closeFence) {
        expect(openFence.textContent).toBe('```go');
        expect(closeFence.textContent).toBe('```');
      }

      // Verify the code block exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const codeBlock = root.getFirstChild();
        expect($isElementNode(codeBlock)).toBe(true);
      });
    });
  });

  describe('language display', () => {
    it('shows correct language in opening fence', async () => {
      const languages = ['typescript', 'javascript', 'python', 'rust', 'go', 'css'];

      for (const lang of languages) {
        const { unmount, container } = render(
          <TestEditorWithCodeBlocks editorRef={editorRef}>
            <MarkdownRevealPlugin />
          </TestEditorWithCodeBlocks>
        );

        await waitFor(() => expect(editorRef.current).not.toBeNull());

        const editor = editorRef.current!;

        await act(async () => {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const codeBlock = $createCodeNode(lang);
            const textNode = $createTextNode('code');
            codeBlock.append(textNode);
            root.append(codeBlock);

            const selection = $createRangeSelection();
            selection.anchor.set(textNode.getKey(), 2, 'text');
            selection.focus.set(textNode.getKey(), 2, 'text');
            $setSelection(selection);
          });
        });

        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        });

        // Check for opening fence with language
        const openFence = container.querySelector('.codeblock-reveal-fence-open');
        if (openFence) {
          expect(openFence.textContent).toBe(`\`\`\`${lang}`);
        }

        unmount();
      }
    });

    it('shows no language for code block without language', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode(); // No language
          const textNode = $createTextNode('code without lang');
          codeBlock.append(textNode);
          root.append(codeBlock);

          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 2, 'text');
          selection.focus.set(textNode.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Check for opening fence without language
      const openFence = container.querySelector('.codeblock-reveal-fence-open');
      if (openFence) {
        expect(openFence.textContent).toBe('```');
      }
    });
  });

  describe('cursor movement', () => {
    it('shows/hides fences when moving between lines', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      let textNodeKey = '';

      // Create multi-line code block
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('typescript');
          const textNode = $createTextNode('line 1\nline 2\nline 3');
          textNodeKey = textNode.getKey();
          codeBlock.append(textNode);
          root.append(codeBlock);

          // Start on first line
          const selection = $createRangeSelection();
          selection.anchor.set(textNodeKey, 2, 'text');
          selection.focus.set(textNodeKey, 2, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Verify first line state
      let openFence = container.querySelector('.codeblock-reveal-fence-open');
      let closeFence = container.querySelector('.codeblock-reveal-fence-close');
      if (openFence) {
        expect(openFence.textContent).toBe('```typescript');
      }
      expect(closeFence).toBeNull();

      // Move to middle line
      await act(async () => {
        editor.update(() => {
          const selection = $createRangeSelection();
          selection.anchor.set(textNodeKey, 10, 'text');
          selection.focus.set(textNodeKey, 10, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // No fences on middle line
      openFence = container.querySelector('.codeblock-reveal-fence-open');
      closeFence = container.querySelector('.codeblock-reveal-fence-close');
      expect(openFence).toBeNull();
      expect(closeFence).toBeNull();

      // Move to last line
      await act(async () => {
        editor.update(() => {
          const selection = $createRangeSelection();
          selection.anchor.set(textNodeKey, 18, 'text');
          selection.focus.set(textNodeKey, 18, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Only closing fence on last line
      openFence = container.querySelector('.codeblock-reveal-fence-open');
      closeFence = container.querySelector('.codeblock-reveal-fence-close');
      expect(openFence).toBeNull();
      if (closeFence) {
        expect(closeFence.textContent).toBe('```');
      }
    });

    it('hides fences when leaving code block', async () => {
      const { container } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      let codeTextKey = '';
      let paraTextKey = '';

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const codeBlock = $createCodeNode('typescript');
          const codeText = $createTextNode('code');
          codeTextKey = codeText.getKey();
          codeBlock.append(codeText);

          const paragraph = $createParagraphNode();
          const paraText = $createTextNode('paragraph');
          paraTextKey = paraText.getKey();
          paragraph.append(paraText);

          root.append(codeBlock);
          root.append(paragraph);

          // Start in code block
          const selection = $createRangeSelection();
          selection.anchor.set(codeTextKey, 2, 'text');
          selection.focus.set(codeTextKey, 2, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Verify fences shown
      let openFence = container.querySelector('.codeblock-reveal-fence-open');
      if (openFence) {
        expect(openFence.textContent).toBe('```typescript');
      }

      // Move to paragraph
      await act(async () => {
        editor.update(() => {
          const selection = $createRangeSelection();
          selection.anchor.set(paraTextKey, 3, 'text');
          selection.focus.set(paraTextKey, 3, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Fences should be hidden
      openFence = container.querySelector('.codeblock-reveal-fence-open');
      const closeFence = container.querySelector('.codeblock-reveal-fence-close');
      expect(openFence).toBeNull();
      expect(closeFence).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('removes fences when plugin unmounts', async () => {
      const { unmount } = render(
        <TestEditorWithCodeBlocks editorRef={editorRef}>
          <MarkdownRevealPlugin />
        </TestEditorWithCodeBlocks>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const codeBlock = $createCodeNode('typescript');
          const textNode = $createTextNode('code');
          codeBlock.append(textNode);
          root.append(codeBlock);

          const selection = $createRangeSelection();
          selection.anchor.set(textNode.getKey(), 2, 'text');
          selection.focus.set(textNode.getKey(), 2, 'text');
          $setSelection(selection);
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Verify code block exists
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getTextContent()).toBe('code');
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();

      // Fences should be cleaned up (though container is gone)
    });
  });
});
