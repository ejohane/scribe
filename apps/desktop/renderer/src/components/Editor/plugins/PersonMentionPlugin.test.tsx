/**
 * PersonMentionPlugin Tests
 *
 * Tests for the PersonMentionPlugin component, including error handling scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
} from 'lexical';
import { useEffect } from 'react';

import { createNoteId } from '@scribe/shared';
import { PersonMentionPlugin } from './PersonMentionPlugin';
import { PersonMentionNode } from './PersonMentionNode';
import { PersonMentionProvider } from './PersonMentionContext';

// Mock window.scribe.people API
const mockCreate = vi.fn();
const mockSearch = vi.fn();

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Test wrapper that provides Lexical context and PersonMention context
function TestEditor({
  children,
  editorRef,
  onError,
}: {
  children: React.ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  onError?: (message: string) => void;
}) {
  return (
    <PersonMentionProvider
      currentNoteId={createNoteId('test-note')}
      onMentionClick={vi.fn()}
      onError={onError ?? vi.fn()}
    >
      <LexicalComposer
        initialConfig={{
          namespace: 'test',
          nodes: [PersonMentionNode],
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
    </PersonMentionProvider>
  );
}

describe('PersonMentionPlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    editorRef = { current: null };
    onError = vi.fn();

    // Setup window.scribe mock
    (
      window as unknown as {
        scribe: { people: { create: typeof mockCreate; search: typeof mockSearch } };
      }
    ).scribe = {
      people: {
        create: mockCreate,
        search: mockSearch,
      },
    };

    // Default mock implementations
    mockCreate.mockReset();
    mockSearch.mockReset();
    mockSearch.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('@ trigger detection', () => {
    it('opens autocomplete when @ is typed', async () => {
      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('does not trigger @ in the middle of a word', async () => {
      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          // @ is not preceded by whitespace or start of text
          const textNode = $createTextNode('email@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(6, 6);
        });
      });

      // Allow time for update listener to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Autocomplete should not be visible
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('search error handling', () => {
    it('handles search API errors gracefully and shows empty results', async () => {
      mockSearch.mockRejectedValue(new Error('Search failed'));

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @ to open autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Now type more characters
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@john');
              textNode.select(5, 5);
            }
          }
        });
      });

      // Wait for search to be called and fail
      await waitFor(
        () => {
          expect(mockSearch).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Autocomplete should still be visible with create option
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        // Should show create option when search fails
        expect(screen.getByText(/Create "john"/)).toBeInTheDocument();
      });
    });
  });

  describe('create person error handling', () => {
    it('shows error toast when person creation fails', async () => {
      mockSearch.mockResolvedValue([]);
      mockCreate.mockRejectedValue(new Error('Creation failed'));

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @ to open autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Now type the rest
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@newperson');
              textNode.select(10, 10);
            }
          }
        });
      });

      // Wait for create option to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Create "newperson"/)).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Click the create option
      const createOption = screen.getByText(/Create "newperson"/);
      await act(async () => {
        createOption.click();
      });

      // Wait for error callback to be called
      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith('newperson');
        expect(onError).toHaveBeenCalledWith('Failed to create "newperson"');
      });

      // Autocomplete should be closed after error
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    it('closes autocomplete gracefully when create fails', async () => {
      mockSearch.mockResolvedValue([]);
      mockCreate.mockRejectedValue(new Error('Network error'));

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @ to open autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Now type more
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@test');
              textNode.select(5, 5);
            }
          }
        });
      });

      await waitFor(
        () => {
          expect(screen.getByText(/Create "test"/)).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Click create
      await act(async () => {
        screen.getByText(/Create "test"/).click();
      });

      // Autocomplete should close even on error
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation boundary tests', () => {
    it('ArrowUp at first item stays at first item', async () => {
      mockSearch.mockResolvedValue([
        { id: createNoteId('person-1'), title: 'Alice', snippet: '', score: 1, matches: [] },
        { id: createNoteId('person-2'), title: 'Bob', snippet: '', score: 1, matches: [] },
      ]);

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @ to open autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Now type more characters
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@a');
              textNode.select(2, 2);
            }
          }
        });
      });

      // Wait for results
      await waitFor(
        () => {
          expect(screen.getByText('Alice')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // First item should be selected by default
      const firstOption = screen.getByText('Alice').closest('[role="option"]');
      expect(firstOption).toHaveAttribute('aria-selected', 'true');

      // Press ArrowUp - should stay at first item
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });

      // First item should still be selected
      expect(firstOption).toHaveAttribute('aria-selected', 'true');
    });

    it('ArrowDown at last item stays at last item', async () => {
      mockSearch.mockResolvedValue([
        { id: createNoteId('person-1'), title: 'Alice', snippet: '', score: 1, matches: [] },
        { id: createNoteId('person-2'), title: 'Bob', snippet: '', score: 1, matches: [] },
      ]);

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @ to open autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Now type exact match
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@Alice');
              textNode.select(6, 6);
            }
          }
        });
      });

      // Wait for results
      await waitFor(
        () => {
          expect(screen.getByText('Alice')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Navigate to last item
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });

      // Bob should be selected
      const bobOption = screen.getByText('Bob').closest('[role="option"]');
      expect(bobOption).toHaveAttribute('aria-selected', 'true');

      // Press ArrowDown again - should stay at Bob (last item when exact match exists)
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });

      // Should still be at Bob (no create option since Alice is exact match)
      expect(bobOption).toHaveAttribute('aria-selected', 'true');
    });

    it('ArrowDown selects create option when it is last', async () => {
      mockSearch.mockResolvedValue([
        { id: createNoteId('person-1'), title: 'Alice', snippet: '', score: 1, matches: [] },
      ]);

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @ to open autocomplete
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete to open
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Now type partial match
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@a');
              textNode.select(2, 2);
            }
          }
        });
      });

      // Wait for results and create option
      await waitFor(
        () => {
          expect(screen.getByText('Alice')).toBeInTheDocument();
          expect(screen.getByText(/Create "a"/)).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Navigate down to create option
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });

      // Create option should be selected
      const createOption = screen.getByText(/Create "a"/).closest('[role="option"]');
      expect(createOption).toHaveAttribute('aria-selected', 'true');
    });

    it('Enter on create option triggers onCreate', async () => {
      mockSearch.mockResolvedValue([]);
      mockCreate.mockResolvedValue({
        id: createNoteId('new-person'),
        metadata: { title: 'newname', type: 'person', tags: [], links: [], mentions: [] },
        content: {},
      });

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // First trigger @
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Type query
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = root.getFirstChild() as ParagraphNode | null;
          if ($isParagraphNode(paragraph)) {
            const textNode = paragraph.getFirstChild() as TextNode | null;
            if (textNode && textNode.getType() === 'text') {
              textNode.setTextContent('@newname');
              textNode.select(8, 8);
            }
          }
        });
      });

      // Wait for create option
      await waitFor(
        () => {
          expect(screen.getByText(/Create "newname"/)).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Press Enter to create
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      // Wait for create to be called
      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith('newname');
      });
    });

    it('Enter with empty results and no create option is a no-op', async () => {
      mockSearch.mockResolvedValue([]);

      render(
        <TestEditor editorRef={editorRef} onError={onError}>
          <PersonMentionPlugin currentNoteId={createNoteId('note-1')} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Open autocomplete with empty query (no create option)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('@');
          paragraph.append(textNode);
          root.append(paragraph);
          textNode.select(1, 1);
        });
      });

      // Wait for autocomplete with "No matching people" message
      await waitFor(
        () => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
          expect(screen.getByText('No matching people')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Press Enter - should be no-op (no selection, no creation)
      await act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      // Autocomplete should still be open (Enter was no-op)
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      // onCreate should not have been called
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
