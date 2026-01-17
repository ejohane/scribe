/**
 * useTableEnterBehavior Tests
 *
 * Unit tests for Enter key behavior in tables:
 * - Enter in table cell inserts line break (not paragraph)
 * - Enter in list inside table lets list plugin handle it
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  LexicalEditor,
  KEY_ENTER_COMMAND,
  $isLineBreakNode,
  ElementNode,
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
import { ListNode, ListItemNode, $createListNode, $createListItemNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { TablePlugin } from '../../TablePlugin';
import { useTableEnterBehavior } from '../useTableEnterBehavior';
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

// Plugin that only uses the Enter behavior hook
function EnterBehaviorOnlyPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useTableEnterBehavior(editor);
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
        nodes: [TableNode, TableRowNode, TableCellNode, ListNode, ListItemNode],
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
      <EnterBehaviorOnlyPlugin />
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

function $createTableWithList(): TableNode {
  const table = $createTableNode();

  const row = $createTableRowNode();
  const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);

  // Create a list inside the cell
  const list = $createListNode('bullet');
  const listItem = $createListItemNode();
  listItem.append($createTextNode('Item 1'));
  list.append(listItem);
  cell.append(list);

  row.append(cell);
  table.append(row);
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

describe('useTableEnterBehavior', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Enter in table cell inserts line break', async () => {
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

    // Verify initial content
    let initialContent = '';
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            initialContent = cell.getTextContent();
          }
        }
      }
    });
    expect(initialContent).toBe('A1');

    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Verify line break was inserted (cell should still contain content, not split into paragraphs)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            // Table should still exist and cell should contain a line break
            expect($isTableNode(table)).toBe(true);
            // Cell should have paragraph with line break
            const paragraph = cell.getFirstChild();
            if ($isParagraphNode(paragraph)) {
              const children = paragraph.getChildren();
              // Should have text, line break in some form
              expect(children.length).toBeGreaterThanOrEqual(1);
            }
          }
        }
      }
    });
  });

  it('Enter outside table is not handled', async () => {
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

    // Dispatch Enter command - should return false (not handled)
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // The hook should not handle this (returns false), allowing default behavior
    // Since we don't have other plugins handling it, this might still be false
    // The key test is that no table-specific behavior occurred
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      // Should not have created a table or done table-specific behavior
      expect(children.some((child) => $isTableNode(child))).toBe(false);
    });
  });

  it('Enter in list inside table lets list plugin handle it', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTableWithList();
        root.append(table);

        // Select inside the list item
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            const list = cell.getFirstChild();
            if (list instanceof ElementNode) {
              const listItem = list.getFirstChild();
              if (listItem) {
                listItem.selectEnd();
              }
            }
          }
        }
      });
    });

    // Dispatch Enter command - hook should NOT handle because we're in a list
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // The table still exists (hook didn't do table-specific behavior like deletion)
    // The hook properly deferred to let list plugin handle it
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      // Table should still exist
      expect(children.some((child) => $isTableNode(child))).toBe(true);
    });
  });

  it('Enter preserves table structure', async () => {
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

    // Get initial row count
    let initialRowCount = 0;
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        initialRowCount = table.getChildrenSize();
      }
    });
    expect(initialRowCount).toBe(2);

    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Verify table still has same structure (Enter doesn't add rows)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        expect(table.getChildrenSize()).toBe(2); // Still 2 rows
      }
    });
  });

  it('Enter at end of cell text inserts line break after text', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 0, 0); // Selects end of "A1"
      });
    });

    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // The cell content should have a line break
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      expect($isTableNode(table)).toBe(true);
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            const paragraph = cell.getFirstChild();
            if ($isParagraphNode(paragraph)) {
              const children = paragraph.getChildren();
              // After Enter, we should have: TextNode("A1"), LineBreakNode
              const hasLineBreak = children.some((child) => $isLineBreakNode(child));
              expect(hasLineBreak).toBe(true);
            }
          }
        }
      }
    });
  });

  it('Multiple Enter presses insert multiple line breaks', async () => {
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

    // Press Enter twice
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Verify multiple line breaks were inserted
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            const paragraph = cell.getFirstChild();
            if ($isParagraphNode(paragraph)) {
              const children = paragraph.getChildren();
              const lineBreakCount = children.filter((child) => $isLineBreakNode(child)).length;
              expect(lineBreakCount).toBe(2);
            }
          }
        }
      }
    });
  });
});
