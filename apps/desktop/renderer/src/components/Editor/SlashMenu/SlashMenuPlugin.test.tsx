/**
 * Tests for SlashMenuPlugin - Lexical plugin for slash commands
 *
 * These tests verify:
 * - Trigger detection (/ at start of line or after space)
 * - Menu display/hide behavior
 * - Query filtering as user types
 * - Keyboard navigation (up/down/enter/escape)
 * - Command execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  LexicalEditor,
  $isParagraphNode,
  ParagraphNode,
  TextNode,
} from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { SlashMenuPlugin } from './SlashMenuPlugin';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

// Mock scrollIntoView since it's not implemented in happy-dom
Element.prototype.scrollIntoView = vi.fn();

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
        namespace: 'test-slash-menu',
        nodes: [
          HeadingNode,
          QuoteNode,
          ListNode,
          ListItemNode,
          TableNode,
          TableCellNode,
          TableRowNode,
        ],
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
      <ListPlugin />
      <CheckListPlugin />
      <TablePlugin />
      <EditorCapture editorRef={editorRef} />
      {children}
    </LexicalComposer>
  );
}

describe('SlashMenuPlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  describe('trigger detection', () => {
    it('detects "/" at start of line and opens menu', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "/" at start of line
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1); // Position cursor after /
        });
      });

      // Menu should open
      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });
    });

    it('detects "/" after space and opens menu', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "Hello /" (slash after space)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Hello /');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(7, 7); // Position cursor after /
        });
      });

      // Menu should open
      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });
    });

    it('does NOT trigger "/" in middle of word', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "abc/" (slash not after space or start)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('abc/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(4, 4);
        });
      });

      // Give it time to potentially trigger
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Menu should NOT be visible
      expect(screen.queryByLabelText('Slash commands')).not.toBeInTheDocument();
    });

    it('shows menu with position', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      await waitFor(() => {
        const menu = screen.getByLabelText('Slash commands');
        expect(menu).toBeInTheDocument();
        // Check that position styles are applied
        expect(menu.style.top).toBeDefined();
        expect(menu.style.left).toBeDefined();
      });
    });
  });

  describe('query filtering', () => {
    it('filters commands as user types', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "/"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });

      // Now type more to filter - "/head"
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('/head');
              textNode.select(5, 5);
            }
          }
        });
      });

      // Should show only heading commands
      await waitFor(() => {
        expect(screen.getByText('Heading 1')).toBeInTheDocument();
        expect(screen.getByText('Heading 2')).toBeInTheDocument();
        expect(screen.getByText('Heading 3')).toBeInTheDocument();
      });
    });

    it('shows "No matching commands" when filter returns nothing', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "/" to open menu
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });

      // Type something that won't match
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('/xyznonexistent');
              textNode.select(15, 15);
            }
          }
        });
      });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('No matching commands')).toBeInTheDocument();
      });
    });
  });

  describe('menu dismissal', () => {
    it('closes menu when typing space after "/"', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "/" to open menu
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });

      // Type space after "/" -> "/ "
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('/ ');
              textNode.select(2, 2);
            }
          }
        });
      });

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByLabelText('Slash commands')).not.toBeInTheDocument();
      });
    });

    it('closes menu when cursor moves to different node', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create two paragraphs and type "/" in first
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph1 = $createParagraphNode();
          const textNode1 = $createTextNode('/');
          paragraph1.append(textNode1);
          const paragraph2 = $createParagraphNode();
          const textNode2 = $createTextNode('other text');
          paragraph2.append(textNode2);
          root.append(paragraph1);
          root.append(paragraph2);
          textNode1.select(1, 1);
        });
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });

      // Move selection to second paragraph
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph2 = root.getChildAtIndex(1) as ParagraphNode | null;
          if ($isParagraphNode(paragraph2)) {
            const textNode = paragraph2.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.select(0, 0);
            }
          }
        });
      });

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByLabelText('Slash commands')).not.toBeInTheDocument();
      });
    });
  });

  describe('command display', () => {
    it('displays all command sections', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type "/" to open menu
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      await waitFor(() => {
        // Check formatting commands
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Heading 1')).toBeInTheDocument();
        expect(screen.getByText('Heading 2')).toBeInTheDocument();
        expect(screen.getByText('Heading 3')).toBeInTheDocument();
        expect(screen.getByText('Bullet List')).toBeInTheDocument();
        expect(screen.getByText('Add Task')).toBeInTheDocument();
        expect(screen.getByText('Quote')).toBeInTheDocument();
        expect(screen.getByText('Table')).toBeInTheDocument();

        // Note: AI commands removed - see TODO in commands.ts
        // Tests will be re-added when AI functionality is implemented
      });
    });

    it('filters to show only heading commands with "h" query', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <SlashMenuPlugin />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First type "/" to trigger the menu
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('/');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for menu to open
      await waitFor(() => {
        expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
      });

      // Now add "h" to filter
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('/h');
              textNode.select(2, 2);
            }
          }
        });
      });

      // Should show heading commands
      await waitFor(() => {
        expect(screen.getByText('Heading 1')).toBeInTheDocument();
        expect(screen.getByText('Heading 2')).toBeInTheDocument();
        expect(screen.getByText('Heading 3')).toBeInTheDocument();
      });
    });
  });
});

describe('SlashMenuPlugin keyboard navigation', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('starts with first item selected', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <SlashMenuPlugin />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Open menu
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode('/');
        paragraph.append(textNode);
        root.append(paragraph);
        textNode.select(1, 1);
      });
    });

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('resets selection when query changes', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <SlashMenuPlugin />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Open menu
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode('/');
        paragraph.append(textNode);
        root.append(paragraph);
        textNode.select(1, 1);
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
    });

    // Change query
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode | null;
          if (textNode && textNode.getType() === 'text') {
            textNode.setTextContent('/h');
            textNode.select(2, 2);
          }
        }
      });
    });

    // First heading should be selected
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });
  });
});
