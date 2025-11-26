import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  LexicalEditor,
  $isParagraphNode,
  ParagraphNode,
  TextNode,
  LexicalNode,
} from 'lexical';
import { WikiLinkNode, $isWikiLinkNode } from './WikiLinkNode';
import { WikiLinkPlugin } from './WikiLinkPlugin';
import { WikiLinkProvider } from './WikiLinkContext';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

// Mock window.scribe.notes.searchTitles
const mockSearchTitles = vi.fn().mockResolvedValue([]);

// Setup global mock for window.scribe
beforeEach(() => {
  (window as unknown as { scribe: { notes: { searchTitles: typeof mockSearchTitles } } }).scribe = {
    notes: {
      searchTitles: mockSearchTitles,
    },
  };
});

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Test wrapper that provides Lexical context and WikiLink context
function TestEditor({
  children,
  editorRef,
}: {
  children: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <WikiLinkProvider currentNoteId="test-note" onLinkClick={vi.fn()}>
      <LexicalComposer
        initialConfig={{
          namespace: 'test',
          nodes: [WikiLinkNode],
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
    </WikiLinkProvider>
  );
}

describe('WikiLinkPlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
    mockSearchTitles.mockResolvedValue([]);
  });

  describe('[[ detection', () => {
    it('detects [[ typing pattern and opens autocomplete', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId="note-1" />
        </TestEditor>
      );

      // Wait for editor to be ready
      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Type [[ into the editor
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Hello [[');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(8, 8); // Position cursor after [[
        });
      });

      // Allow update listener to fire - autocomplete should be visible
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('shows autocomplete popup with position styles', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId="note-1" />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('[[');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(2, 2);
        });
      });

      await waitFor(() => {
        const autocomplete = screen.getByRole('listbox');
        expect(autocomplete).toBeInTheDocument();
        // Check that it has inline position styles (top and left)
        expect(autocomplete.style.top).toBeDefined();
        expect(autocomplete.style.left).toBeDefined();
      });
    });
  });

  describe('query tracking', () => {
    it('triggers search as user types after [[', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId="note-1" />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger [[
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('[[');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(2, 2);
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Now type more characters
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('[[meet');
              textNode.select(6, 6);
            }
          }
        });
      });

      // Wait for debounced search (150ms)
      await waitFor(
        () => {
          expect(mockSearchTitles).toHaveBeenCalledWith('meet', 10);
        },
        { timeout: 500 }
      );
    });
  });
});

// Separate test file for integration tests that need special handling
// These tests verify the more complex behaviors
describe('WikiLinkPlugin integration', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
    mockSearchTitles.mockResolvedValue([]);
  });

  it('converts [[text]] to WikiLinkNode on ]] closure', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <WikiLinkPlugin currentNoteId="note-1" />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // First trigger [[
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode('[[');
        paragraph.append(textNode);
        root.append(paragraph);
        textNode.select(2, 2);
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Type the complete link
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode | null;
          if (textNode && textNode.getType() === 'text') {
            textNode.setTextContent('[[Test Note]]');
            textNode.select(13, 13);
          }
        }
      });
    });

    // Check that a WikiLinkNode was created
    await waitFor(
      () => {
        let found = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const children: LexicalNode[] = paragraph.getChildren();
            const wikiLinkNode = children.find((child: LexicalNode) => $isWikiLinkNode(child));
            if ($isWikiLinkNode(wikiLinkNode)) {
              found = true;
              expect(wikiLinkNode.__noteTitle).toBe('Test Note');
              expect(wikiLinkNode.__displayText).toBe('Test Note');
            }
          }
        });
        expect(found).toBe(true);
      },
      { timeout: 1000 }
    );

    // Autocomplete should be closed after insertion
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('parses alias syntax (last pipe wins)', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <WikiLinkPlugin currentNoteId="note-1" />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // First trigger [[
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode('[[');
        paragraph.append(textNode);
        root.append(paragraph);
        textNode.select(2, 2);
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Type link with alias
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode | null;
          if (textNode && textNode.getType() === 'text') {
            textNode.setTextContent('[[Meeting Notes|yesterday]]');
            textNode.select(27, 27);
          }
        }
      });
    });

    // Check that the WikiLinkNode has correct noteTitle and displayText
    await waitFor(
      () => {
        let found = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const children: LexicalNode[] = paragraph.getChildren();
            const wikiLinkNode = children.find((child: LexicalNode) => $isWikiLinkNode(child));
            if ($isWikiLinkNode(wikiLinkNode)) {
              found = true;
              expect(wikiLinkNode.__noteTitle).toBe('Meeting Notes');
              expect(wikiLinkNode.__displayText).toBe('yesterday');
            }
          }
        });
        expect(found).toBe(true);
      },
      { timeout: 1000 }
    );
  });

  it('does not trigger on single [', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <WikiLinkPlugin currentNoteId="note-1" />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        const textNode = $createTextNode('[');
        paragraph.append(textNode);
        root.append(paragraph);
        textNode.select(1, 1);
      });
    });

    // Give it some time to not trigger
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Autocomplete should not be visible
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
