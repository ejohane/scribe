/**
 * useTableEscape Tests
 *
 * Unit tests for Escape key behavior in tables:
 * - Escape in table exits table, cursor moves after table
 * - Escape outside table is not handled
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  LexicalEditor,
  KEY_ESCAPE_COMMAND,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import {
  TableNode,
  TableRowNode,
  TableCellNode,
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
  TableCellHeaderStates,
} from '@lexical/table';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { TablePlugin } from '../../TablePlugin';
import { useTableEscape } from '../useTableEscape';
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

// Plugin that only uses the Escape hook
function EscapeOnlyPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useTableEscape(editor);
  return null;
}

// Test wrapper
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
        namespace: 'test',
        nodes: [TableNode, TableRowNode, TableCellNode],
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
      <TablePlugin />
      <EscapeOnlyPlugin />
      {children}
    </LexicalComposer>
  );
}

function $createTable2x2(): TableNode {
  const table = $createTableNode();

  const row1 = $createTableRowNode();
  const cell1a = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell1a.append($createParagraphNode().append($createTextNode('A1')));
  const cell1b = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell1b.append($createParagraphNode().append($createTextNode('B1')));
  row1.append(cell1a, cell1b);

  const row2 = $createTableRowNode();
  const cell2a = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell2a.append($createParagraphNode().append($createTextNode('A2')));
  const cell2b = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell2b.append($createParagraphNode().append($createTextNode('B2')));
  row2.append(cell2a, cell2b);

  table.append(row1, row2);
  return table;
}

function $selectCell(table: TableNode, rowIndex: number, cellIndex: number): void {
  const rows = table.getChildren();
  const row = rows[rowIndex];
  if ($isTableRowNode(row)) {
    const cells = row.getChildren();
    const cell = cells[cellIndex];
    if ($isTableCellNode(cell)) {
      const paragraph = cell.getFirstChild();
      if (paragraph) {
        paragraph.selectEnd();
      }
    }
  }
}

function createKeyboardEvent(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
}

describe('useTableEscape', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Escape in table exits to after table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        const afterParagraph = $createParagraphNode();
        afterParagraph.append($createTextNode('After'));
        root.append(table, afterParagraph);
        $selectCell(table, 0, 0);
      });
    });

    // Verify selection is in table initially
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
    });

    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Verify selection moved to after table
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        // Selection should be in the paragraph after the table
        const parent = anchorNode.getParent();
        if ($isParagraphNode(parent)) {
          expect(parent.getTextContent()).toBe('After');
        } else if ($isParagraphNode(anchorNode)) {
          expect(anchorNode.getTextContent()).toBe('After');
        }
      }
    });
  });

  it('Escape with no element after table creates paragraph', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

    // Verify only table exists initially
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildrenSize()).toBe(1);
      expect($isTableNode(root.getChildren()[0])).toBe(true);
    });

    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Verify paragraph was created after table
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(2);
      expect($isTableNode(children[0])).toBe(true);
      expect($isParagraphNode(children[1])).toBe(true);
    });
  });

  it('Escape outside table is not handled', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Outside'));
        root.append(paragraph);
        paragraph.selectEnd();
      });
    });

    // Dispatch Escape command - hook should NOT handle because we're not in a table
    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Structure should remain unchanged (no table-specific behavior)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);
      expect($isParagraphNode(children[0])).toBe(true);
    });
  });

  it('Escape from any cell in table exits after table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        const afterParagraph = $createParagraphNode();
        afterParagraph.append($createTextNode('After'));
        root.append(table, afterParagraph);
        $selectCell(table, 1, 1); // Last cell (B2)
      });
    });

    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Verify selection moved to after table
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const parent = anchorNode.getParent();
        if ($isParagraphNode(parent)) {
          expect(parent.getTextContent()).toBe('After');
        } else if ($isParagraphNode(anchorNode)) {
          expect(anchorNode.getTextContent()).toBe('After');
        }
      }
    });
  });

  it('Escape preserves table content', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Verify table still exists with original content
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      const table = children[0];
      expect($isTableNode(table)).toBe(true);
      if ($isTableNode(table)) {
        expect(table.getTextContent()).toContain('A1');
        expect(table.getTextContent()).toContain('B1');
        expect(table.getTextContent()).toContain('A2');
        expect(table.getTextContent()).toContain('B2');
      }
    });
  });

  it('Escape command returns true when handled', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

    let commandHandled = false;
    await act(async () => {
      commandHandled = editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    expect(commandHandled).toBe(true);
  });
});
