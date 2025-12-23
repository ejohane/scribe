/**
 * useFindReplace Hook Tests
 *
 * Unit tests for the useFindReplace hook which provides in-editor
 * find functionality with:
 * - Case-insensitive search
 * - Match highlighting using MarkNode
 * - Navigation between matches with wrap-around
 * - Active match scrolling into view
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $createTextNode, $getRoot, LexicalEditor } from 'lexical';
import { MarkNode } from '@lexical/mark';
import { useEffect, type ReactNode } from 'react';

import { useFindReplace } from './useFindReplace';
import { SEARCH_DEBOUNCE_MS } from './types';

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
  children?: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'find-replace-test',
        nodes: [MarkNode],
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

// Component that uses the hook and exposes its return value
function FindReplaceConsumer({
  stateRef,
}: {
  stateRef: React.MutableRefObject<ReturnType<typeof useFindReplace> | null>;
}) {
  const state = useFindReplace();
  // Update ref on every render
  stateRef.current = state;
  return null;
}

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

// Helper to wait for debounce
const waitForDebounce = () => new Promise((r) => setTimeout(r, SEARCH_DEBOUNCE_MS + 50));

describe('useFindReplace', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;
  let stateRef: React.MutableRefObject<ReturnType<typeof useFindReplace> | null>;

  beforeEach(() => {
    editorRef = { current: null };
    stateRef = { current: null };
    vi.clearAllMocks();

    // Mock scrollIntoView on Element prototype
    if (typeof Element !== 'undefined') {
      Element.prototype.scrollIntoView = mockScrollIntoView;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('returns correct initial state', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(stateRef.current).not.toBeNull());

      expect(stateRef.current?.query).toBe('');
      expect(stateRef.current?.matches).toEqual([]);
      expect(stateRef.current?.matchCount).toBe(0);
      expect(stateRef.current?.activeIndex).toBe(0);
      expect(stateRef.current?.isSearching).toBe(false);
      expect(typeof stateRef.current?.setQuery).toBe('function');
      expect(typeof stateRef.current?.goToNext).toBe('function');
      expect(typeof stateRef.current?.goToPrevious).toBe('function');
      expect(typeof stateRef.current?.clearSearch).toBe('function');
    });
  });

  describe('Search functionality', () => {
    it('finds matches in editor content', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content with searchable text
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Hello world, hello again!'));
          root.append(paragraph);
        });
      });

      // Search for "hello"
      act(() => {
        stateRef.current?.setQuery('hello');
      });

      // Wait for debounce
      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(2);
        },
        { timeout: 2000 }
      );

      expect(stateRef.current?.matches.length).toBe(2);
      expect(stateRef.current?.activeIndex).toBe(0);
    });

    it('performs case-insensitive search', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content with mixed case
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('HELLO World, hello again, HeLLo there!'));
          root.append(paragraph);
        });
      });

      // Search for "hello" (lowercase)
      act(() => {
        stateRef.current?.setQuery('hello');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(3);
        },
        { timeout: 2000 }
      );
    });

    it('returns empty matches for non-existent search term', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Hello world'));
          root.append(paragraph);
        });
      });

      // Search for non-existent term
      act(() => {
        stateRef.current?.setQuery('xyz');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.isSearching).toBe(false);
        },
        { timeout: 2000 }
      );

      expect(stateRef.current?.matchCount).toBe(0);
      expect(stateRef.current?.matches).toEqual([]);
    });

    it('handles empty search query', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(stateRef.current).not.toBeNull());

      // Set empty query
      act(() => {
        stateRef.current?.setQuery('');
      });

      expect(stateRef.current?.matchCount).toBe(0);
      expect(stateRef.current?.isSearching).toBe(false);
    });

    it('handles whitespace-only query', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(stateRef.current).not.toBeNull());

      // Set whitespace query
      act(() => {
        stateRef.current?.setQuery('   ');
      });

      expect(stateRef.current?.matchCount).toBe(0);
      expect(stateRef.current?.isSearching).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('navigates to next match with wrap-around', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content with multiple matches
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('foo bar foo baz foo'));
          root.append(paragraph);
        });
      });

      // Search
      act(() => {
        stateRef.current?.setQuery('foo');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(3);
        },
        { timeout: 2000 }
      );

      expect(stateRef.current?.activeIndex).toBe(0);

      // Go to next
      act(() => {
        stateRef.current?.goToNext();
      });

      await waitFor(() => {
        expect(stateRef.current?.activeIndex).toBe(1);
      });

      // Go to next again
      act(() => {
        stateRef.current?.goToNext();
      });

      await waitFor(() => {
        expect(stateRef.current?.activeIndex).toBe(2);
      });

      // Go to next - should wrap to 0
      act(() => {
        stateRef.current?.goToNext();
      });

      await waitFor(() => {
        expect(stateRef.current?.activeIndex).toBe(0);
      });
    });

    it('navigates to previous match with wrap-around', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content with multiple matches
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('test one test two test three'));
          root.append(paragraph);
        });
      });

      // Search
      act(() => {
        stateRef.current?.setQuery('test');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(3);
        },
        { timeout: 2000 }
      );

      expect(stateRef.current?.activeIndex).toBe(0);

      // Go to previous - should wrap to last
      act(() => {
        stateRef.current?.goToPrevious();
      });

      await waitFor(() => {
        expect(stateRef.current?.activeIndex).toBe(2);
      });

      // Go to previous
      act(() => {
        stateRef.current?.goToPrevious();
      });

      await waitFor(() => {
        expect(stateRef.current?.activeIndex).toBe(1);
      });
    });

    it('does nothing when navigating with no matches', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(stateRef.current).not.toBeNull());

      expect(stateRef.current?.matchCount).toBe(0);
      expect(stateRef.current?.activeIndex).toBe(0);

      // Try to navigate
      act(() => {
        stateRef.current?.goToNext();
      });

      expect(stateRef.current?.activeIndex).toBe(0);

      act(() => {
        stateRef.current?.goToPrevious();
      });

      expect(stateRef.current?.activeIndex).toBe(0);
    });
  });

  describe('Clear search', () => {
    it('clears query and matches', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create content
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('searchable content'));
          root.append(paragraph);
        });
      });

      // Search
      act(() => {
        stateRef.current?.setQuery('searchable');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(1);
        },
        { timeout: 2000 }
      );

      // Clear search
      act(() => {
        stateRef.current?.clearSearch();
      });

      expect(stateRef.current?.query).toBe('');
      expect(stateRef.current?.matches).toEqual([]);
      expect(stateRef.current?.matchCount).toBe(0);
      expect(stateRef.current?.activeIndex).toBe(0);
      expect(stateRef.current?.isSearching).toBe(false);
    });
  });

  describe('Match objects', () => {
    it('includes correct match metadata', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create specific content
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('start test end'));
          root.append(paragraph);
        });
      });

      // Search
      act(() => {
        stateRef.current?.setQuery('test');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(1);
        },
        { timeout: 2000 }
      );

      const match = stateRef.current?.matches[0];
      expect(match).toBeDefined();
      expect(match?.id).toBe('match-0');
      expect(match?.offset).toBe(6); // "start " = 6 chars
      expect(match?.length).toBe(4); // "test" = 4 chars
      expect(match?.text).toBe('test');
    });
  });

  describe('Edge cases', () => {
    it('handles empty editor content', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Clear editor
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      });

      // Search
      act(() => {
        stateRef.current?.setQuery('anything');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.isSearching).toBe(false);
        },
        { timeout: 2000 }
      );

      expect(stateRef.current?.matchCount).toBe(0);
    });

    it('handles multi-paragraph content', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <FindReplaceConsumer stateRef={stateRef} />
        </TestEditor>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(stateRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create multi-paragraph content
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          const p1 = $createParagraphNode();
          p1.append($createTextNode('First paragraph with word'));

          const p2 = $createParagraphNode();
          p2.append($createTextNode('Second paragraph with word'));

          const p3 = $createParagraphNode();
          p3.append($createTextNode('Third has word too'));

          root.append(p1, p2, p3);
        });
      });

      // Search
      act(() => {
        stateRef.current?.setQuery('word');
      });

      await act(async () => {
        await waitForDebounce();
      });

      await waitFor(
        () => {
          expect(stateRef.current?.matchCount).toBe(3);
        },
        { timeout: 2000 }
      );
    });
  });
});

describe('Types exports', () => {
  it('exports SearchMatch type correctly', async () => {
    // Type check - this would fail at compile time if types are wrong
    const match: import('./types').SearchMatch = {
      id: 'test-id',
      offset: 0,
      length: 5,
      text: 'hello',
    };

    expect(match.id).toBe('test-id');
    expect(match.offset).toBe(0);
    expect(match.length).toBe(5);
    expect(match.text).toBe('hello');
  });

  it('exports constants', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(150);
  });
});
