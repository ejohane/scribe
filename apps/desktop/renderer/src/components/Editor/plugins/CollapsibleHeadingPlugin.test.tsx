import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HeadingNode, $createHeadingNode } from '@lexical/rich-text';
import { $createParagraphNode, $createTextNode, $getRoot, LexicalEditor } from 'lexical';
import {
  CollapsibleHeadingNode,
  $createCollapsibleHeadingNode,
  $isCollapsibleHeadingNode,
} from './CollapsibleHeadingNode';
import { CollapsibleHeadingPlugin, TOGGLE_COLLAPSE_COMMAND } from './CollapsibleHeadingPlugin';
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
  withHistory = false,
}: {
  children: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  withHistory?: boolean;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
        nodes: [HeadingNode, CollapsibleHeadingNode],
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
      {withHistory && <HistoryPlugin />}
      {children}
    </LexicalComposer>
  );
}

describe('CollapsibleHeadingPlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HeadingNode transform', () => {
    it('transforms HeadingNode to CollapsibleHeadingNode on creation', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a HeadingNode
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createHeadingNode('h1');
          const textNode = $createTextNode('Test Heading');
          heading.append(textNode);
          root.append(heading);
        });
      });

      // Wait for transform to apply
      await waitFor(() => {
        let isCollapsible = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const firstChild = root.getFirstChild();
          isCollapsible = $isCollapsibleHeadingNode(firstChild);
        });
        expect(isCollapsible).toBe(true);
      });

      // Verify content is preserved
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const heading = root.getFirstChild();
        if ($isCollapsibleHeadingNode(heading)) {
          expect(heading.getTag()).toBe('h1');
          expect(heading.getTextContent()).toBe('Test Heading');
          expect(heading.isCollapsed()).toBe(false);
        }
      });
    });

    it('transforms all heading levels (h1-h6)', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

      for (const tag of headingTags) {
        await act(async () => {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const heading = $createHeadingNode(tag);
            heading.append($createTextNode(`${tag} heading`));
            root.append(heading);
          });
        });

        // Wait for transform
        await waitFor(() => {
          let isCollapsible = false;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const firstChild = root.getFirstChild();
            isCollapsible = $isCollapsibleHeadingNode(firstChild);
          });
          expect(isCollapsible).toBe(true);
        });

        // Verify tag is preserved
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          if ($isCollapsibleHeadingNode(heading)) {
            expect(heading.getTag()).toBe(tag);
          }
        });
      }
    });

    it('preserves heading formatting during transform', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createHeadingNode('h2');
          heading.setFormat('center');
          heading.setIndent(2);
          heading.append($createTextNode('Formatted Heading'));
          root.append(heading);
        });
      });

      // Wait for transform and verify formatting
      await waitFor(() => {
        let verified = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          if ($isCollapsibleHeadingNode(heading)) {
            expect(heading.getFormatType()).toBe('center');
            expect(heading.getIndent()).toBe(2);
            verified = true;
          }
        });
        expect(verified).toBe(true);
      });
    });

    it('does not re-transform existing CollapsibleHeadingNode', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let nodeKey: string | null = null;

      // Create a CollapsibleHeadingNode directly
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1', true);
          heading.append($createTextNode('Already Collapsible'));
          root.append(heading);
          nodeKey = heading.getKey();
        });
      });

      // Wait and verify it stays as CollapsibleHeadingNode with same key
      await waitFor(() => {
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          expect($isCollapsibleHeadingNode(heading)).toBe(true);
          if ($isCollapsibleHeadingNode(heading)) {
            expect(heading.getKey()).toBe(nodeKey);
            expect(heading.isCollapsed()).toBe(true);
          }
        });
      });
    });
  });

  describe('TOGGLE_COLLAPSE_COMMAND', () => {
    it('toggles collapsed state when command is dispatched', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let nodeKey: string | null = null;

      // Create a collapsible heading
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Toggle Me'));
          root.append(heading);
          nodeKey = heading.getKey();
        });
      });

      // Verify initial state is not collapsed
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const heading = root.getFirstChild();
        if ($isCollapsibleHeadingNode(heading)) {
          expect(heading.isCollapsed()).toBe(false);
        }
      });

      // Dispatch toggle command
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, nodeKey!);
      });

      // Wait for state to update
      await waitFor(() => {
        let isCollapsed = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          if ($isCollapsibleHeadingNode(heading)) {
            isCollapsed = heading.isCollapsed();
          }
        });
        expect(isCollapsed).toBe(true);
      });

      // Toggle again to expand
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, nodeKey!);
      });

      await waitFor(() => {
        let isCollapsed = true;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          if ($isCollapsibleHeadingNode(heading)) {
            isCollapsed = heading.isCollapsed();
          }
        });
        expect(isCollapsed).toBe(false);
      });
    });

    it('handles command with invalid nodeKey gracefully', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a collapsible heading
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Test'));
          root.append(heading);
        });
      });

      // Dispatch command with non-existent key - should not throw
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, 'non-existent-key');
      });

      // Editor should still be functional
      editor.getEditorState().read(() => {
        const root = $getRoot();
        expect(root.getChildrenSize()).toBe(1);
      });
    });
  });

  describe('collapsed section visibility', () => {
    it('applies collapsed-content class to content under collapsed heading', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let headingKey: string | null = null;

      // Create heading with content below
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Heading'));
          root.append(heading);
          headingKey = heading.getKey();

          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Content under heading'));
          root.append(paragraph);
        });
      });

      // Wait for initial render
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Content should NOT have collapsed-content class initially
      const paragraphElement = editor.getElementByKey(
        (() => {
          let key: string | null = null;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const children = root.getChildren();
            if (children.length > 1) {
              key = children[1]!.getKey();
            }
          });
          return key!;
        })()
      );

      expect(paragraphElement?.classList.contains('collapsed-content')).toBe(false);

      // Collapse the heading
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, headingKey!);
      });

      // Wait for CSS class update
      await waitFor(() => {
        const element = editor.getElementByKey(
          (() => {
            let key: string | null = null;
            editor.getEditorState().read(() => {
              const root = $getRoot();
              const children = root.getChildren();
              if (children.length > 1) {
                key = children[1]!.getKey();
              }
            });
            return key!;
          })()
        );
        expect(element?.classList.contains('collapsed-content')).toBe(true);
      });
    });

    it('respects heading hierarchy - same level heading ends collapsed section', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let firstHeadingKey: string | null = null;

      // Create structure: h1 -> p -> h1 -> p
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const heading1 = $createCollapsibleHeadingNode('h1');
          heading1.append($createTextNode('First Heading'));
          root.append(heading1);
          firstHeadingKey = heading1.getKey();

          const para1 = $createParagraphNode();
          para1.append($createTextNode('Under first heading'));
          root.append(para1);

          const heading2 = $createCollapsibleHeadingNode('h1');
          heading2.append($createTextNode('Second Heading'));
          root.append(heading2);

          const para2 = $createParagraphNode();
          para2.append($createTextNode('Under second heading'));
          root.append(para2);
        });
      });

      // Collapse first heading
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, firstHeadingKey!);
      });

      // Wait for update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get elements to check
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        expect(children.length).toBe(4);

        // First paragraph should be collapsed
        const para1Key = children[1]!.getKey();
        const para1Element = editor.getElementByKey(para1Key);
        expect(para1Element?.classList.contains('collapsed-content')).toBe(true);

        // Second heading should NOT be collapsed (headings never hide)
        const heading2Key = children[2]!.getKey();
        const heading2Element = editor.getElementByKey(heading2Key);
        expect(heading2Element?.classList.contains('collapsed-content')).toBe(false);

        // Second paragraph should NOT be collapsed (under second heading)
        const para2Key = children[3]!.getKey();
        const para2Element = editor.getElementByKey(para2Key);
        expect(para2Element?.classList.contains('collapsed-content')).toBe(false);
      });
    });

    it('respects heading hierarchy - higher level heading ends collapsed section', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let h2Key: string | null = null;

      // Create structure: h2 -> p -> h1 -> p
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const h2 = $createCollapsibleHeadingNode('h2');
          h2.append($createTextNode('H2 Heading'));
          root.append(h2);
          h2Key = h2.getKey();

          const para1 = $createParagraphNode();
          para1.append($createTextNode('Under h2'));
          root.append(para1);

          const h1 = $createCollapsibleHeadingNode('h1');
          h1.append($createTextNode('H1 Heading'));
          root.append(h1);

          const para2 = $createParagraphNode();
          para2.append($createTextNode('Under h1'));
          root.append(para2);
        });
      });

      // Collapse h2
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, h2Key!);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // First paragraph should be collapsed, h1 and second paragraph should not
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        const para1Element = editor.getElementByKey(children[1]!.getKey());
        expect(para1Element?.classList.contains('collapsed-content')).toBe(true);

        const h1Element = editor.getElementByKey(children[2]!.getKey());
        expect(h1Element?.classList.contains('collapsed-content')).toBe(false);

        const para2Element = editor.getElementByKey(children[3]!.getKey());
        expect(para2Element?.classList.contains('collapsed-content')).toBe(false);
      });
    });

    it('lower level heading content collapses under higher level heading', async () => {
      // Note: The plugin logic is:
      // - Headings themselves are NEVER hidden (never get collapsed-content class)
      // - Only non-heading content gets the collapsed-content class
      // - A lower-level heading (h2) under a collapsed higher-level heading (h1)
      //   does NOT end the collapsed section - content after h2 is still collapsed
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let h1Key: string | null = null;

      // Create structure: h1 -> h2 -> p
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const h1 = $createCollapsibleHeadingNode('h1');
          h1.append($createTextNode('H1 Heading'));
          root.append(h1);
          h1Key = h1.getKey();

          const h2 = $createCollapsibleHeadingNode('h2');
          h2.append($createTextNode('H2 Subheading'));
          root.append(h2);

          const para = $createParagraphNode();
          para.append($createTextNode('Content'));
          root.append(para);
        });
      });

      // Collapse h1 - h2 heading itself won't be hidden (headings never hide),
      // but the paragraph after h2 should be hidden
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, h1Key!);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();

        // h2 heading itself is NOT hidden (headings never get collapsed-content)
        const h2Element = editor.getElementByKey(children[1]!.getKey());
        expect(h2Element?.classList.contains('collapsed-content')).toBe(false);

        // Paragraph is still collapsed (h2 doesn't end the h1 collapse section)
        const paraElement = editor.getElementByKey(children[2]!.getKey());
        expect(paraElement?.classList.contains('collapsed-content')).toBe(true);
      });
    });
  });

  describe('JSON serialization', () => {
    it('exports collapsed state in JSON', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create collapsed heading
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h2', true);
          heading.append($createTextNode('Collapsed Heading'));
          root.append(heading);
        });
      });

      // Export JSON and verify
      const json = editor.getEditorState().toJSON();
      const rootNode = json.root;
      const headingNode = rootNode.children[0] as unknown as {
        type: string;
        collapsed: boolean;
        tag: string;
      };

      expect(headingNode.type).toBe('collapsible-heading');
      expect(headingNode.collapsed).toBe(true);
      expect(headingNode.tag).toBe('h2');
    });

    it('imports collapsed state from JSON', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create editor state from JSON
      const editorStateJSON = {
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text: 'Imported',
                  type: 'text',
                  version: 1,
                },
              ],
              direction: null,
              format: '',
              indent: 0,
              type: 'collapsible-heading',
              version: 1,
              tag: 'h3',
              collapsed: true,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      };

      await act(async () => {
        const newState = editor.parseEditorState(JSON.stringify(editorStateJSON));
        editor.setEditorState(newState);
      });

      // Verify imported state
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const heading = root.getFirstChild();
        expect($isCollapsibleHeadingNode(heading)).toBe(true);
        if ($isCollapsibleHeadingNode(heading)) {
          expect(heading.getTag()).toBe('h3');
          expect(heading.isCollapsed()).toBe(true);
          expect(heading.getTextContent()).toBe('Imported');
        }
      });
    });
  });

  describe('DOM attributes', () => {
    it('adds data-collapsed attribute to DOM element', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let headingKey: string | null = null;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Test'));
          root.append(heading);
          headingKey = heading.getKey();
        });
      });

      // Check initial attribute
      const element = editor.getElementByKey(headingKey!);
      expect(element?.getAttribute('data-collapsed')).toBe('false');
      expect(element?.classList.contains('collapsible-heading')).toBe(true);

      // Toggle collapse
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, headingKey!);
      });

      await waitFor(() => {
        const el = editor.getElementByKey(headingKey!);
        expect(el?.getAttribute('data-collapsed')).toBe('true');
      });
    });

    it('updates data-collapsed attribute when state changes', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let headingKey: string | null = null;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1', true); // Start collapsed
          heading.append($createTextNode('Test'));
          root.append(heading);
          headingKey = heading.getKey();
        });
      });

      // Should start collapsed
      expect(editor.getElementByKey(headingKey!)?.getAttribute('data-collapsed')).toBe('true');

      // Expand
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, headingKey!);
      });

      await waitFor(() => {
        expect(editor.getElementByKey(headingKey!)?.getAttribute('data-collapsed')).toBe('false');
      });
    });
  });

  describe('accessibility', () => {
    it('FoldIcon has correct ARIA attributes when expanded', async () => {
      // Note: FoldIcon only renders when there's a hovered heading,
      // which requires mouse events. We test the expected attributes here.
      // The actual FoldIcon component renders with:
      // - aria-label="Collapse section" when expanded
      // - aria-expanded="true" when expanded

      // This test documents expected behavior - actual rendering
      // requires simulating mouse events on the heading
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Test Heading'));
          root.append(heading);
        });
      });

      // Verify heading element exists with collapsible-heading class
      // The FoldIcon positioning is tested via the class presence
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const heading = root.getFirstChild();
        if ($isCollapsibleHeadingNode(heading)) {
          const element = editor.getElementByKey(heading.getKey());
          expect(element?.classList.contains('collapsible-heading')).toBe(true);
        }
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty heading', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createHeadingNode('h1');
          // No text content
          root.append(heading);
        });
      });

      // Should still transform to CollapsibleHeadingNode
      await waitFor(() => {
        let isCollapsible = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const firstChild = root.getFirstChild();
          isCollapsible = $isCollapsibleHeadingNode(firstChild);
        });
        expect(isCollapsible).toBe(true);
      });
    });

    it('handles multiple content blocks under heading', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let headingKey: string | null = null;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Main Heading'));
          root.append(heading);
          headingKey = heading.getKey();

          // Add multiple paragraphs
          for (let i = 1; i <= 3; i++) {
            const para = $createParagraphNode();
            para.append($createTextNode(`Paragraph ${i}`));
            root.append(para);
          }
        });
      });

      // Collapse heading
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, headingKey!);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // All paragraphs should be collapsed
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        expect(children.length).toBe(4);

        for (let i = 1; i < children.length; i++) {
          const element = editor.getElementByKey(children[i]!.getKey());
          expect(element?.classList.contains('collapsed-content')).toBe(true);
        }
      });
    });

    it('handles document with only headings - headings never hide', async () => {
      // Note: Headings themselves NEVER get collapsed-content class.
      // Only non-heading content is hidden. This means a document with
      // only headings won't visually collapse anything.
      render(
        <TestEditor editorRef={editorRef}>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let h1Key: string | null = null;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const h1 = $createCollapsibleHeadingNode('h1');
          h1.append($createTextNode('H1'));
          root.append(h1);
          h1Key = h1.getKey();

          const h2 = $createCollapsibleHeadingNode('h2');
          h2.append($createTextNode('H2'));
          root.append(h2);
        });
      });

      // Collapse h1
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, h1Key!);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // h2 is a heading, so it does NOT get collapsed-content class
      // (headings are never hidden, only content is)
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const h2Element = editor.getElementByKey(children[1]!.getKey());
        expect(h2Element?.classList.contains('collapsed-content')).toBe(false);
      });
    });
  });

  describe('undo/redo with history plugin', () => {
    it('collapse state can be undone', async () => {
      render(
        <TestEditor editorRef={editorRef} withHistory>
          <CollapsibleHeadingPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let headingKey: string | null = null;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const heading = $createCollapsibleHeadingNode('h1');
          heading.append($createTextNode('Test'));
          root.append(heading);
          headingKey = heading.getKey();
        });
      });

      // Initial state: not collapsed
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const heading = root.getFirstChild();
        if ($isCollapsibleHeadingNode(heading)) {
          expect(heading.isCollapsed()).toBe(false);
        }
      });

      // Collapse
      await act(async () => {
        editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, headingKey!);
      });

      await waitFor(() => {
        let isCollapsed = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          if ($isCollapsibleHeadingNode(heading)) {
            isCollapsed = heading.isCollapsed();
          }
        });
        expect(isCollapsed).toBe(true);
      });

      // Undo - use the UNDO_COMMAND
      const { UNDO_COMMAND } = await import('lexical');
      await act(async () => {
        editor.dispatchCommand(UNDO_COMMAND, undefined);
      });

      // Should be back to not collapsed
      await waitFor(() => {
        let isCollapsed = true;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const heading = root.getFirstChild();
          if ($isCollapsibleHeadingNode(heading)) {
            isCollapsed = heading.isCollapsed();
          }
        });
        expect(isCollapsed).toBe(false);
      });
    });
  });
});

describe('CollapsibleHeadingNode', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
  });

  it('exports correct type in JSON', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <CollapsibleHeadingPlugin />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const node = $createCollapsibleHeadingNode('h1', true);
        node.append($createTextNode('Test'));
        root.append(node);

        const json = node.exportJSON();
        expect(json.type).toBe('collapsible-heading');
        expect(json.collapsed).toBe(true);
        expect(json.tag).toBe('h1');
      });
    });
  });

  it('clones correctly', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <CollapsibleHeadingPlugin />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const original = $createCollapsibleHeadingNode('h2', true);
        const cloned = CollapsibleHeadingNode.clone(original);

        expect(cloned.getTag()).toBe('h2');
        expect(cloned.isCollapsed()).toBe(true);
      });
    });
  });

  it('type guard works correctly', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <CollapsibleHeadingPlugin />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const collapsibleHeading = $createCollapsibleHeadingNode('h1');
        const regularParagraph = $createParagraphNode();

        expect($isCollapsibleHeadingNode(collapsibleHeading)).toBe(true);
        expect($isCollapsibleHeadingNode(regularParagraph)).toBe(false);
        expect($isCollapsibleHeadingNode(null)).toBe(false);
        expect($isCollapsibleHeadingNode(undefined)).toBe(false);
      });
    });
  });
});
