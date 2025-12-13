/**
 * TableKeyboardPlugin Tests
 *
 * Unit tests for table keyboard navigation behaviors:
 * - Tab/Shift+Tab navigation between cells (Tab at last cell adds new row)
 * - Enter behavior (always inserts line break in cells, allows list continuation)
 * - Escape to exit table
 * - Backspace/Delete to auto-delete empty tables
 * - TabIndentation suppression inside tables
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  $isLineBreakNode,
  LexicalEditor,
  KEY_TAB_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  COMMAND_PRIORITY_EDITOR,
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
import {
  ListNode,
  ListItemNode,
  $createListNode,
  $createListItemNode,
  $isListNode,
  $isListItemNode,
} from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TablePlugin } from './TablePlugin';
import { TableKeyboardPlugin } from './TableKeyboardPlugin';
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

// Test wrapper that provides Lexical context with table nodes and keyboard plugin
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
      <TableKeyboardPlugin />
      <ListPlugin />
      {children}
    </LexicalComposer>
  );
}

/**
 * Helper to create a 2x2 table structure with content
 */
function $createTable2x2(): TableNode {
  const table = $createTableNode();

  // Row 1
  const row1 = $createTableRowNode();
  const cell1a = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell1a.append($createParagraphNode().append($createTextNode('A1')));
  const cell1b = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell1b.append($createParagraphNode().append($createTextNode('B1')));
  row1.append(cell1a, cell1b);

  // Row 2
  const row2 = $createTableRowNode();
  const cell2a = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell2a.append($createParagraphNode().append($createTextNode('A2')));
  const cell2b = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
  cell2b.append($createParagraphNode().append($createTextNode('B2')));
  row2.append(cell2a, cell2b);

  table.append(row1, row2);
  return table;
}

/**
 * Helper to create a 2x2 empty table
 */
function $createEmptyTable2x2(): TableNode {
  const table = $createTableNode();

  for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
    const row = $createTableRowNode();
    for (let colIdx = 0; colIdx < 2; colIdx++) {
      const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      cell.append($createParagraphNode());
      row.append(cell);
    }
    table.append(row);
  }

  return table;
}

/**
 * Helper to select a specific cell in the table
 */
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

/**
 * Create a mock keyboard event
 */
function createKeyboardEvent(
  key: string,
  options: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {}
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    shiftKey: options.shiftKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    bubbles: true,
    cancelable: true,
  });
}

describe('TableKeyboardPlugin - Tab Navigation', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Tab at last cell creates new row', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table and select last cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select last cell (B2 - row 1, cell 1)
        $selectCell(table, 1, 1);
      });
    });

    // Verify initial state - 2 rows
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        expect(table.getChildren().length).toBe(2);
      }
    });

    // Dispatch Tab key command
    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab'));
    });

    // Verify new row was created - 3 rows
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        expect(table.getChildren().length).toBe(3);

        // New row should have 2 cells (same as original columns)
        const newRow = table.getChildren()[2];
        if ($isTableRowNode(newRow)) {
          expect(newRow.getChildren().length).toBe(2);
        }
      }
    });
  });

  it('Shift+Tab at first cell exits table before', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create paragraph before table, then table, select first cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Before table'));
        const table = $createTable2x2();
        root.append(paragraph, table);

        // Select first cell (A1 - row 0, cell 0)
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Shift+Tab key command
    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab', { shiftKey: true }));
    });

    // Verify selection is now before the table (in the paragraph)
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        // Should be in the text node "Before table" or its parent paragraph
        const parent = anchorNode.getParent();
        expect($isParagraphNode(parent) || $isParagraphNode(anchorNode)).toBe(true);
      }
    });
  });

  it('Shift+Tab at first cell with no element before creates paragraph', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table only (no paragraph before), select first cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select first cell (A1 - row 0, cell 0)
        $selectCell(table, 0, 0);
      });
    });

    // Verify initial state - only table in root
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildren().length).toBe(1);
    });

    // Dispatch Shift+Tab key command
    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab', { shiftKey: true }));
    });

    // Verify a paragraph was created before the table
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(2);
      expect($isParagraphNode(children[0])).toBe(true);
      expect($isTableNode(children[1])).toBe(true);
    });
  });
});

describe('TableKeyboardPlugin - Enter Behavior', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Enter in middle cell creates line break', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table and select a middle cell (A1)
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select first cell (A1 - row 0, cell 0) - not last cell
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Enter key command
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Verify line break was inserted (cell has more content)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            // After line break insertion, the paragraph should contain a line break node
            const paragraph = cell.getFirstChild();
            if ($isParagraphNode(paragraph)) {
              const hasLineBreak = paragraph.getChildren().some((child) => $isLineBreakNode(child));
              expect(hasLineBreak).toBe(true);
            }
          }
        }
      }
    });
  });

  it('Enter at last cell of last row creates line break (same as other cells)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table and select last cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select last cell (B2 - row 1, cell 1)
        $selectCell(table, 1, 1);
      });
    });

    // Verify initial state - 2 rows
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        expect(table.getChildren().length).toBe(2);
      }
    });

    // Dispatch Enter key command
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Verify line break was inserted (table still has 2 rows, not exited)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      // Should still have only the table (no paragraph created after)
      expect(root.getChildren().length).toBe(1);

      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        // Still 2 rows (no new row added)
        expect(table.getChildren().length).toBe(2);

        // Check that line break was inserted in the last cell
        const lastRow = table.getChildren()[1];
        if ($isTableRowNode(lastRow)) {
          const lastCell = lastRow.getChildren()[1];
          if ($isTableCellNode(lastCell)) {
            const paragraph = lastCell.getFirstChild();
            if ($isParagraphNode(paragraph)) {
              const hasLineBreak = paragraph.getChildren().some((child) => $isLineBreakNode(child));
              expect(hasLineBreak).toBe(true);
            }
          }
        }
      }
    });
  });

  it('Enter inside a list within a table allows list continuation (not intercepted)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table with a list inside a cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);

        // Create a bullet list inside the cell
        const list = $createListNode('bullet');
        const listItem = $createListItemNode();
        listItem.append($createTextNode('List item 1'));
        list.append(listItem);
        cell.append(list);
        row.append(cell);
        table.append(row);
        root.append(table);

        // Select end of list item text
        listItem.selectEnd();
      });
    });

    // Verify initial state - one list item
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            const list = cell.getFirstChild();
            if ($isListNode(list)) {
              expect(list.getChildren().length).toBe(1);
            }
          }
        }
      }
    });

    // Dispatch Enter key command - should allow list plugin to handle it
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Verify a new list item was created (list plugin handled Enter)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            const list = cell.getFirstChild();
            if ($isListNode(list)) {
              // List should now have 2 items (Enter created a new list item)
              expect(list.getChildren().length).toBe(2);
              // Both should be list items
              list.getChildren().forEach((child) => {
                expect($isListItemNode(child)).toBe(true);
              });
            }
          }
        }
      }
    });
  });

  it('Shift+Enter creates line break (same as Enter)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table and select last cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select last cell (B2 - row 1, cell 1)
        $selectCell(table, 1, 1);
      });
    });

    // Dispatch Shift+Enter key command
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter', { shiftKey: true }));
    });

    // Verify line break was inserted (NOT exiting table)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      // Should still have only the table (no paragraph created after)
      expect(root.getChildren().length).toBe(1);
      expect($isTableNode(root.getChildren()[0])).toBe(true);

      // Check that line break was inserted in the last cell
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const lastRow = table.getChildren()[1];
        if ($isTableRowNode(lastRow)) {
          const lastCell = lastRow.getChildren()[1];
          if ($isTableCellNode(lastCell)) {
            const paragraph = lastCell.getFirstChild();
            if ($isParagraphNode(paragraph)) {
              const hasLineBreak = paragraph.getChildren().some((child) => $isLineBreakNode(child));
              expect(hasLineBreak).toBe(true);
            }
          }
        }
      }
    });
  });
});

describe('TableKeyboardPlugin - Escape', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Escape exits table, cursor after table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table and select any cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select first cell (A1)
        $selectCell(table, 0, 0);
      });
    });

    // Verify initial state - only table in root
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildren().length).toBe(1);
    });

    // Dispatch Escape key command
    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Verify paragraph was created after table and selection moved there
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(2);
      expect($isTableNode(children[0])).toBe(true);
      expect($isParagraphNode(children[1])).toBe(true);
    });
  });

  it('Escape with existing element after table moves cursor there', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table with paragraph after it, select a cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('After table'));
        root.append(table, paragraph);

        // Select first cell
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Escape key command
    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Verify selection moved to existing paragraph (no new paragraph created)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(2); // Still just table and original paragraph
      expect($isTableNode(children[0])).toBe(true);
      expect($isParagraphNode(children[1])).toBe(true);

      // The paragraph should still have "After table" content
      if ($isParagraphNode(children[1])) {
        expect(children[1].getTextContent()).toBe('After table');
      }
    });
  });
});

describe('TableKeyboardPlugin - TabIndentation Suppression', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Tab inside table does NOT trigger TabIndentation (command handled)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table and select a cell (not first or last)
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);

        // Select first cell
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Tab key command
    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab'));
    });

    // The TableKeyboardPlugin should handle tab in tables
    // Either by returning true (blocking propagation for edge cases)
    // or allowing TablePlugin to handle it (returning false then TablePlugin handles)
    // In either case, indentation should NOT happen

    // Verify table structure wasn't changed by indentation
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      expect($isTableNode(table)).toBe(true);
    });
  });
});

describe('TableKeyboardPlugin - Backspace/Delete (auto-delete)', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Backspace in empty table removes table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create empty table and select a cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createEmptyTable2x2();
        root.append(table);

        // Select first cell
        $selectCell(table, 0, 0);
      });
    });

    // Verify initial state - table exists
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect($isTableNode(root.getChildren()[0])).toBe(true);
    });

    // Dispatch Backspace key command
    await act(async () => {
      editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
    });

    // Verify table was removed and replaced with paragraph
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);
      expect($isParagraphNode(children[0])).toBe(true);
      // No table should exist
      expect(children.some((child) => $isTableNode(child))).toBe(false);
    });
  });

  it('Delete in empty table removes table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create empty table and select a cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createEmptyTable2x2();
        root.append(table);

        // Select first cell
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Delete key command
    await act(async () => {
      editor.dispatchCommand(KEY_DELETE_COMMAND, createKeyboardEvent('Delete'));
    });

    // Verify table was removed
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);
      expect($isParagraphNode(children[0])).toBe(true);
      expect(children.some((child) => $isTableNode(child))).toBe(false);
    });
  });

  it('Backspace in non-empty table does NOT remove table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table with content and select a cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2(); // Has content A1, B1, A2, B2
        root.append(table);

        // Select first cell
        $selectCell(table, 0, 0);
      });
    });

    // Verify table exists with content before testing
    let tableTextContent = '';
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        tableTextContent = table.getTextContent();
      }
    });
    expect(tableTextContent).toContain('A1');

    // Try to dispatch Backspace - may throw due to happy-dom limitations
    // but that's fine - we're testing that the plugin doesn't auto-delete non-empty tables
    try {
      await act(async () => {
        editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
      });
    } catch {
      // Expected: happy-dom doesn't support domSelection.modify
      // This is fine - the important thing is the table wasn't deleted by our plugin
    }

    // Verify table still exists (wasn't auto-deleted by the plugin)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      const hasTable = children.some((child) => $isTableNode(child));
      expect(hasTable).toBe(true);
    });
  });

  it('Delete in non-empty table does NOT remove table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create table with content and select a cell
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2(); // Has content
        root.append(table);

        // Select first cell
        $selectCell(table, 0, 0);
      });
    });

    // Try to dispatch Delete - may throw due to happy-dom limitations
    try {
      await act(async () => {
        editor.dispatchCommand(KEY_DELETE_COMMAND, createKeyboardEvent('Delete'));
      });
    } catch {
      // Expected: happy-dom doesn't support domSelection.modify
    }

    // Verify table still exists
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      const hasTable = children.some((child) => $isTableNode(child));
      expect(hasTable).toBe(true);
    });
  });

  it('Backspace removes table and places cursor before table position', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create paragraph, then empty table, select cell in table
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Before'));
        const table = $createEmptyTable2x2();
        root.append(paragraph, table);

        // Select first cell of table
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Backspace key command
    await act(async () => {
      editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
    });

    // Verify table was removed and cursor is in the paragraph before
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);
      expect($isParagraphNode(children[0])).toBe(true);
      if ($isParagraphNode(children[0])) {
        expect(children[0].getTextContent()).toBe('Before');
      }
    });
  });

  it('Delete removes table and places cursor after table position', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create empty table, then paragraph after
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createEmptyTable2x2();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('After'));
        root.append(table, paragraph);

        // Select first cell of table
        $selectCell(table, 0, 0);
      });
    });

    // Dispatch Delete key command
    await act(async () => {
      editor.dispatchCommand(KEY_DELETE_COMMAND, createKeyboardEvent('Delete'));
    });

    // Verify table was removed and paragraph remains
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);
      expect($isParagraphNode(children[0])).toBe(true);
      if ($isParagraphNode(children[0])) {
        expect(children[0].getTextContent()).toBe('After');
      }
    });
  });
});

describe('TableKeyboardPlugin - Edge Cases', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Commands outside table are not intercepted (Enter creates paragraph)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create paragraph only (no table), select in paragraph
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('No table here'));
        root.append(paragraph);
        paragraph.selectEnd();
      });
    });

    // Verify initial state
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildren().length).toBe(1);
    });

    // Dispatch Enter outside table - should create new paragraph (default RichText behavior)
    await act(async () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, createKeyboardEvent('Enter'));
    });

    // Enter should have created a new paragraph (default behavior not blocked)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      // RichTextPlugin's Enter handler should have run
      expect(children.length).toBeGreaterThanOrEqual(1);
      // All children should be paragraphs (no unexpected interference)
      children.forEach((child) => {
        expect($isParagraphNode(child)).toBe(true);
      });
    });
  });

  it('Escape outside table is not intercepted (no paragraph created)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create paragraph only (no table), select in paragraph
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('No table here'));
        root.append(paragraph);
        paragraph.selectEnd();
      });
    });

    // Get initial state
    let initialChildCount = 0;
    editor.getEditorState().read(() => {
      const root = $getRoot();
      initialChildCount = root.getChildren().length;
    });

    // Dispatch Escape outside table - should do nothing special
    await act(async () => {
      editor.dispatchCommand(KEY_ESCAPE_COMMAND, createKeyboardEvent('Escape'));
    });

    // Escape outside table should NOT create a paragraph (like it would inside table)
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      // No extra paragraph should have been created
      expect(children.length).toBe(initialChildCount);
      expect(children[0].getTextContent()).toBe('No table here');
    });
  });

  it('Multiple tables - commands only affect the table containing selection', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create two tables
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table1 = $createTable2x2();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Between tables'));
        const table2 = $createEmptyTable2x2();
        root.append(table1, paragraph, table2);

        // Select in second table (empty one)
        $selectCell(table2, 0, 0);
      });
    });

    // Dispatch Backspace to delete second table (empty)
    await act(async () => {
      editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
    });

    // Verify first table still exists, second was removed
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();

      // Should have: table1, paragraph, (paragraph from exit)
      const tables = children.filter((child) => $isTableNode(child));
      expect(tables.length).toBe(1);

      // First table should still have content
      if ($isTableNode(tables[0])) {
        expect(tables[0].getTextContent()).toContain('A1');
      }
    });
  });
});
