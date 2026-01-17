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
import { createNoteId } from '@scribe/shared';
import { WikiLinkNode, $isWikiLinkNode } from './WikiLinkNode';
import { WikiLinkPlugin } from './WikiLinkPlugin';
import { WikiLinkProvider } from './WikiLinkContext';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

// Mock searchNotes function for context
const mockSearchNotes = vi.fn().mockResolvedValue([]);

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
    <WikiLinkProvider
      currentNoteId={createNoteId('test-note')}
      onLinkClick={vi.fn()}
      onError={vi.fn()}
      searchNotes={mockSearchNotes}
    >
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
    mockSearchNotes.mockResolvedValue([]);
  });

  describe('[[ detection', () => {
    it('detects [[ typing pattern and opens autocomplete', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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
          <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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
          <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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
          expect(mockSearchNotes).toHaveBeenCalledWith('meet', 10);
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
    mockSearchNotes.mockResolvedValue([]);
  });

  it('converts [[text]] to WikiLinkNode on ]] closure', async () => {
    render(
      <TestEditor editorRef={editorRef}>
        <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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
        <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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
        <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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

  it('handles rapid typing without race conditions', async () => {
    // This test verifies that the fix for linked-20 works correctly.
    // The bug was that using setTimeout(..., 0) to defer insertion after
    // a read operation could cause stale state issues if the user typed quickly.
    // The fix uses Lexical's command system which captures all necessary data
    // at the moment of detection.
    render(
      <TestEditor editorRef={editorRef}>
        <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Simulate rapid typing: [[First]] followed immediately by more text
    // This pattern would have caused issues with the old setTimeout approach
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

    // Wait for autocomplete to open
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Now rapidly complete the link - this simulates fast typing
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode | null;
          if (textNode && textNode.getType() === 'text') {
            // Complete the link immediately
            textNode.setTextContent('[[Rapid Test]]');
            textNode.select(14, 14);
          }
        }
      });
    });

    // Verify the WikiLinkNode was created with the correct values
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
              // The critical assertion: ensure the correct text was captured
              // despite rapid state changes
              expect(wikiLinkNode.__noteTitle).toBe('Rapid Test');
              expect(wikiLinkNode.__displayText).toBe('Rapid Test');
            }
          }
        });
        expect(found).toBe(true);
      },
      { timeout: 1000 }
    );

    // Autocomplete should be closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // GH-43: Verify cursor position after insertion (no trailing space)
  describe('GH-43: cursor position after insertion', () => {
    it('positions cursor immediately after WikiLinkNode without adding space on ]] closure', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
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
          const textNode = $createTextNode('Hello [[');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(8, 8);
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Type complete link with ]]
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('Hello [[Test Note]]');
              textNode.select(19, 19);
            }
          }
        });
      });

      // Wait for WikiLinkNode to be created
      await waitFor(
        () => {
          let verified = false;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const paragraph = root.getFirstChild() as ParagraphNode | null;
            if ($isParagraphNode(paragraph)) {
              const children: LexicalNode[] = paragraph.getChildren();

              // Should have: TextNode("Hello ") + WikiLinkNode
              // NO trailing TextNode with space
              expect(children.length).toBe(2);

              // First child should be text "Hello "
              const firstChild = children[0];
              expect(firstChild?.getType()).toBe('text');
              expect((firstChild as TextNode).getTextContent()).toBe('Hello ');

              // Second child should be WikiLinkNode
              const lastChild = children[1];
              expect($isWikiLinkNode(lastChild)).toBe(true);

              // Full text should NOT have trailing space
              const fullText = paragraph.getTextContent();
              expect(fullText).toBe('Hello Test Note');
              expect(fullText.endsWith(' ')).toBe(false);

              verified = true;
            }
          });
          expect(verified).toBe(true);
        },
        { timeout: 1000 }
      );

      // Autocomplete should be closed
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('positions cursor immediately after WikiLinkNode without adding space on autocomplete selection', async () => {
      // Mock search to return a result for selection
      mockSearchNotes.mockResolvedValue([
        { id: createNoteId('test-id'), title: 'Test Note', snippet: '', score: 1, matches: [] },
      ]);

      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Step 1: Type [[ to trigger autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Hello [[');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(8, 8);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Step 2: Now append 'te' to the text to simulate typing
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('Hello [[te');
              textNode.select(10, 10);
            }
          }
        });
      });

      // Wait for search to be called (debounced 150ms)
      await waitFor(
        () => {
          expect(mockSearchNotes).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Wait for the option to appear in the autocomplete
      await waitFor(
        () => {
          expect(screen.getByText('Test Note')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Click on the result to select it
      await act(async () => {
        const option = screen.getByText('Test Note');
        option.click();
      });

      // Verify: Check editor content has NO trailing space after WikiLinkNode
      await waitFor(
        () => {
          let verified = false;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const paragraph = root.getFirstChild() as ParagraphNode | null;
            if ($isParagraphNode(paragraph)) {
              const children: LexicalNode[] = paragraph.getChildren();

              // Should have: TextNode("Hello ") + WikiLinkNode
              expect(children.length).toBe(2);

              // Verify no trailing TextNode with just a space
              const lastChild = children[children.length - 1];
              expect($isWikiLinkNode(lastChild)).toBe(true);

              // Full text should NOT have trailing space
              const fullText = paragraph.getTextContent();
              expect(fullText.endsWith(' ')).toBe(false);

              verified = true;
            }
          });
          expect(verified).toBe(true);
        },
        { timeout: 1000 }
      );
    });

    it('allows typing punctuation immediately after WikiLinkNode without extra space', async () => {
      // This is the actual user pain point from GH-43:
      // Users want to type [[note]]. but were getting [[note]] .
      render(
        <TestEditor editorRef={editorRef}>
          <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create a WikiLinkNode by typing [[text]]
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('See [[');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(6, 6);
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Complete the link
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('See [[this note]]');
              textNode.select(17, 17);
            }
          }
        });
      });

      // Wait for WikiLinkNode creation
      await waitFor(
        () => {
          let hasWikiLink = false;
          editor.getEditorState().read(() => {
            const root = $getRoot();
            const paragraph = root.getFirstChild() as ParagraphNode | null;
            if ($isParagraphNode(paragraph)) {
              hasWikiLink = paragraph.getChildren().some((child) => $isWikiLinkNode(child));
            }
          });
          expect(hasWikiLink).toBe(true);
        },
        { timeout: 1000 }
      );

      // After WikiLinkNode is created, the content should NOT have a trailing space
      // This is crucial for allowing users to type punctuation like period, comma
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const fullText = paragraph.getTextContent();
          // The key assertion: no trailing space that would interfere with punctuation
          expect(fullText).toBe('See this note');
          expect(fullText.endsWith(' ')).toBe(false);
        }
      });
    });
  });

  it('handles consecutive wiki links without interference', async () => {
    // Test that creating multiple wiki links in sequence works correctly.
    // This exercises the command system under conditions that would have
    // exposed stale state issues with the setTimeout approach.
    render(
      <TestEditor editorRef={editorRef}>
        <WikiLinkPlugin currentNoteId={createNoteId('note-1')} />
      </TestEditor>
    );

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // First trigger [[ to start tracking
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

    // Wait for autocomplete to open
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Now complete the first link
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const textNode = paragraph.getFirstChild() as TextNode | null;
          if (textNode && textNode.getType() === 'text') {
            textNode.setTextContent('[[First Link]]');
            textNode.select(14, 14);
          }
        }
      });
    });

    // Wait for first link to be created
    await waitFor(
      () => {
        let found = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const children: LexicalNode[] = paragraph.getChildren();
            found = children.some((child: LexicalNode) => $isWikiLinkNode(child));
          }
        });
        expect(found).toBe(true);
      },
      { timeout: 1000 }
    );

    // Autocomplete should be closed after first insertion
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    // Wait a bit for the justInsertedRef flag to reset
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Now add a second wiki link - need to trigger [[ again
    // First, we need to add a text node after the WikiLinkNode
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          // Find the WikiLinkNode and add text after it
          const children = paragraph.getChildren();
          for (const child of children) {
            if ($isWikiLinkNode(child)) {
              // Create a new text node after the WikiLinkNode
              const textNode = $createTextNode(' and [[');
              child.insertAfter(textNode);
              textNode.select(7, 7);
              break;
            }
          }
        }
      });
    });

    // Wait for autocomplete to open again
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Complete the second link by appending ]] to the text
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild() as ParagraphNode | null;
        if ($isParagraphNode(paragraph)) {
          const children = paragraph.getChildren();
          const lastChild = children[children.length - 1];
          if (lastChild && lastChild.getType() === 'text') {
            const textNode = lastChild as TextNode;
            textNode.setTextContent(' and [[Second Link]]');
            textNode.select(20, 20);
          }
        }
      });
    });

    // Verify both wiki links exist with correct values
    await waitFor(
      () => {
        let firstFound = false;
        let secondFound = false;
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const children: LexicalNode[] = paragraph.getChildren();
            for (const child of children) {
              if ($isWikiLinkNode(child)) {
                if (child.__noteTitle === 'First Link') {
                  firstFound = true;
                } else if (child.__noteTitle === 'Second Link') {
                  secondFound = true;
                }
              }
            }
          }
        });
        expect(firstFound).toBe(true);
        expect(secondFound).toBe(true);
      },
      { timeout: 1000 }
    );
  });
});
