/**
 * FocusNodePlugin Tests
 *
 * Unit tests for FocusNodePlugin which provides node focus/navigation functionality.
 * The plugin handles the FOCUS_NODE_COMMAND and implements a fallback chain:
 * 1. Primary: Find node by exact nodeKey
 * 2. Fallback: Find checklist item with matching textHash
 * 3. Last resort: Find listitem at the specified lineIndex
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  LexicalEditor,
} from 'lexical';
import { ListNode, ListItemNode, $createListNode, $createListItemNode } from '@lexical/list';
import { computeTextHash } from '@scribe/engine-core';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { FocusNodePlugin, FOCUS_NODE_COMMAND, type FocusNodePayload } from './FocusNodePlugin';

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Test wrapper that provides Lexical context with list nodes
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
        namespace: 'focus-node-test',
        nodes: [ListNode, ListItemNode],
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
      <ListPlugin />
      <CheckListPlugin />
      <FocusNodePlugin />
      {children}
    </LexicalComposer>
  );
}

// Mock scrollIntoView since it's not implemented in happy-dom
const mockScrollIntoView = vi.fn();

describe('FocusNodePlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();

    // Mock scrollIntoView on Element prototype
    Element.prototype.scrollIntoView = mockScrollIntoView;

    // Mock console.warn to verify warning messages
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FOCUS_NODE_COMMAND', () => {
    it('exports FOCUS_NODE_COMMAND', () => {
      expect(FOCUS_NODE_COMMAND).toBeDefined();
    });
  });

  describe('Primary strategy: nodeKey lookup', () => {
    it('focuses node by exact nodeKey', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let targetNodeKey: string = '';

      // Create a paragraph with text and capture its key
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Target text');
          paragraph.append(textNode);
          root.append(paragraph);
          targetNodeKey = paragraph.getKey();
        });
      });

      // Dispatch FOCUS_NODE_COMMAND with the nodeKey
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: targetNodeKey,
        });
      });

      // Verify the command was handled (returns true means it was processed)
      // The node should have scrollIntoView called
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('focuses list item node by exact nodeKey', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let targetNodeKey: string = '';

      // Create a checklist and capture list item key
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('check');
          const listItem = $createListItemNode();
          listItem.setChecked(false);
          listItem.append($createTextNode('Task item'));
          list.append(listItem);
          root.append(list);
          targetNodeKey = listItem.getKey();
        });
      });

      // Dispatch FOCUS_NODE_COMMAND
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: targetNodeKey,
        });
      });

      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Fallback strategy: textHash lookup', () => {
    it('finds checklist item by textHash when nodeKey not found', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const taskText = 'Buy groceries';
      const textHash = computeTextHash(taskText);

      // Create a checklist with the task
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('check');
          const listItem = $createListItemNode();
          listItem.setChecked(false);
          listItem.append($createTextNode(taskText));
          list.append(listItem);
          root.append(list);
        });
      });

      // Dispatch with invalid nodeKey but valid textHash
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'invalid-key-that-does-not-exist',
          textHashFallback: textHash,
        });
      });

      // Should find the node via textHash fallback
      expect(mockScrollIntoView).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('finds nested checklist item by textHash', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const targetText = 'Nested task';
      const textHash = computeTextHash(targetText);

      // Create nested list structure
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();

          // Create outer list
          const outerList = $createListNode('check');
          const outerItem = $createListItemNode();
          outerItem.setChecked(false);
          outerItem.append($createTextNode('Outer task'));

          // Create nested list
          const innerList = $createListNode('check');
          const innerItem = $createListItemNode();
          innerItem.setChecked(true);
          innerItem.append($createTextNode(targetText));
          innerList.append(innerItem);

          outerItem.append(innerList);
          outerList.append(outerItem);
          root.append(outerList);
        });
      });

      // Dispatch with textHash for nested item
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'nonexistent-key',
          textHashFallback: textHash,
        });
      });

      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('ignores non-checklist items when searching by textHash', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const taskText = 'Regular list item';
      const textHash = computeTextHash(taskText);

      // Create a regular (non-checklist) list
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('bullet');
          const listItem = $createListItemNode();
          // Note: NOT setting checked - this is a regular bullet list item
          listItem.append($createTextNode(taskText));
          list.append(listItem);
          root.append(list);
        });
      });

      // Dispatch with textHash - should NOT find regular list item
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'nonexistent-key',
          textHashFallback: textHash,
        });
      });

      // Should warn because node wasn't found (regular list items don't have checked value)
      expect(console.warn).toHaveBeenCalledWith(
        'FocusNodePlugin: Could not find node',
        expect.objectContaining({
          nodeKey: 'nonexistent-key',
          textHashFallback: textHash,
        })
      );
    });
  });

  describe('Last resort: lineIndex lookup', () => {
    it('finds list item by lineIndex when other strategies fail', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create multiple list items
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('bullet');

          for (let i = 0; i < 5; i++) {
            const listItem = $createListItemNode();
            listItem.append($createTextNode(`Item ${i}`));
            list.append(listItem);
          }

          root.append(list);
        });
      });

      // Dispatch with lineIndex to find the 3rd item (index 2)
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'nonexistent-key',
          lineIndexFallback: 2,
        });
      });

      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('finds first list item at lineIndex 0', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create list
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('bullet');

          const listItem = $createListItemNode();
          listItem.append($createTextNode('First item'));
          list.append(listItem);

          root.append(list);
        });
      });

      // Dispatch with lineIndex 0
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'nonexistent',
          lineIndexFallback: 0,
        });
      });

      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('handles lineIndex out of bounds gracefully', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create list with only 2 items
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('bullet');

          for (let i = 0; i < 2; i++) {
            const listItem = $createListItemNode();
            listItem.append($createTextNode(`Item ${i}`));
            list.append(listItem);
          }

          root.append(list);
        });
      });

      // Dispatch with lineIndex beyond available items
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'nonexistent',
          lineIndexFallback: 100,
        });
      });

      // Should warn that node wasn't found
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('Fallback chain priority', () => {
    it('uses nodeKey first even when textHash and lineIndex are provided', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let targetNodeKey: string = '';
      const taskText = 'Target task';

      // Create a checklist
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('check');
          const listItem = $createListItemNode();
          listItem.setChecked(false);
          listItem.append($createTextNode(taskText));
          list.append(listItem);
          root.append(list);
          targetNodeKey = listItem.getKey();
        });
      });

      // Dispatch with all three identifiers (nodeKey should take priority)
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: targetNodeKey,
          textHashFallback: computeTextHash('different text'),
          lineIndexFallback: 999,
        });
      });

      // Should succeed using nodeKey (not the incorrect textHash or lineIndex)
      expect(mockScrollIntoView).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('uses textHash when nodeKey fails', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      const taskText = 'Correct task';
      const textHash = computeTextHash(taskText);

      // Create two checklist items
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('check');

          const listItem1 = $createListItemNode();
          listItem1.setChecked(false);
          listItem1.append($createTextNode('Wrong task'));
          list.append(listItem1);

          const listItem2 = $createListItemNode();
          listItem2.setChecked(true);
          listItem2.append($createTextNode(taskText));
          list.append(listItem2);

          root.append(list);
        });
      });

      // Dispatch with invalid nodeKey but valid textHash (should find second item)
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'invalid-key',
          textHashFallback: textHash,
          lineIndexFallback: 0, // Points to wrong item
        });
      });

      // Should find via textHash, not lineIndex
      expect(mockScrollIntoView).toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('uses lineIndex when both nodeKey and textHash fail', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create regular (non-checklist) list items - textHash won't match
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('bullet');

          for (let i = 0; i < 3; i++) {
            const listItem = $createListItemNode();
            listItem.append($createTextNode(`Item ${i}`));
            list.append(listItem);
          }

          root.append(list);
        });
      });

      // Dispatch with all identifiers failing except lineIndex
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'invalid',
          textHashFallback: computeTextHash('nonexistent text'),
          lineIndexFallback: 1,
        });
      });

      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Visual feedback', () => {
    it('adds focus-highlight class and calls scrollIntoView', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let targetNodeKey: string = '';

      // Create a paragraph
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Highlight me'));
          root.append(paragraph);
          targetNodeKey = paragraph.getKey();
        });
      });

      // Dispatch focus command
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: targetNodeKey,
        });
      });

      // Get the DOM element
      const element = editor.getElementByKey(targetNodeKey);
      expect(element).not.toBeNull();
      // Verify highlight class is added initially
      expect(element?.classList.contains('focus-highlight')).toBe(true);
      // Verify scrollIntoView was called with correct options
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    });
  });

  describe('Cursor placement', () => {
    it('sets selection when focusing list item', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;
      let targetNodeKey: string = '';

      // Create a checklist item
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const list = $createListNode('check');
          const listItem = $createListItemNode();
          listItem.setChecked(false);
          listItem.append($createTextNode('Task with cursor'));
          list.append(listItem);
          root.append(list);
          targetNodeKey = listItem.getKey();
        });
      });

      // Dispatch focus command
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: targetNodeKey,
        });
      });

      // Verify scrollIntoView was called (indicating successful focus)
      expect(mockScrollIntoView).toHaveBeenCalled();

      // Verify selection exists after focus
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        // Selection should exist after focusing a list item
        expect(selection).not.toBeNull();
      });
    });
  });

  describe('Error handling', () => {
    it('logs warning when node cannot be found', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create some content first to avoid empty root issues
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Some content'));
          root.append(paragraph);
        });
      });

      // Dispatch with completely invalid payload
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'completely-fake-key',
          textHashFallback: 'invalid-hash',
          lineIndexFallback: 9999,
        });
      });

      expect(console.warn).toHaveBeenCalledWith('FocusNodePlugin: Could not find node', {
        nodeKey: 'completely-fake-key',
        textHashFallback: 'invalid-hash',
        lineIndexFallback: 9999,
      });
    });

    it('does not scroll when node is not found', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Create some content first
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Some content'));
          root.append(paragraph);
        });
      });

      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'nonexistent',
        });
      });

      // scrollIntoView should not have been called since node wasn't found
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('Empty document handling', () => {
    it('handles empty document gracefully', async () => {
      render(<TestEditor editorRef={editorRef} />);

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      const editor = editorRef.current!;

      // Clear the document
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
        });
      });

      // Try to focus a node
      await act(async () => {
        editor.dispatchCommand(FOCUS_NODE_COMMAND, {
          nodeKey: 'some-key',
          lineIndexFallback: 0,
        });
      });

      expect(console.warn).toHaveBeenCalled();
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });
});

describe('FocusNodePayload interface', () => {
  it('allows minimal payload with just nodeKey', () => {
    const payload: FocusNodePayload = {
      nodeKey: 'some-key',
    };
    expect(payload.nodeKey).toBe('some-key');
    expect(payload.lineIndexFallback).toBeUndefined();
    expect(payload.textHashFallback).toBeUndefined();
  });

  it('allows full payload with all fallbacks', () => {
    const payload: FocusNodePayload = {
      nodeKey: 'primary-key',
      lineIndexFallback: 5,
      textHashFallback: 'abc123hash',
    };
    expect(payload.nodeKey).toBe('primary-key');
    expect(payload.lineIndexFallback).toBe(5);
    expect(payload.textHashFallback).toBe('abc123hash');
  });
});
