/**
 * useTableSelectAll Tests
 *
 * Unit tests for Cmd/Ctrl+A behavior in tables:
 * - Cmd+A in table selects entire table
 * - Cmd+A outside table is not handled
 * - Cmd+A when table already selected lets default behavior handle it
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  LexicalEditor,
  KEY_DOWN_COMMAND,
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
  $isTableSelection,
} from '@lexical/table';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { TablePlugin } from '../../TablePlugin';
import { useTableSelectAll } from '../useTableSelectAll';
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

// Plugin that only uses the SelectAll hook
function SelectAllOnlyPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useTableSelectAll(editor);
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
      <SelectAllOnlyPlugin />
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

function $createTable3x3(): TableNode {
  const table = $createTableNode();

  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const row = $createTableRowNode();
    for (let colIdx = 0; colIdx < 3; colIdx++) {
      const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      cell.append(
        $createParagraphNode().append(
          $createTextNode(`${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`)
        )
      );
      row.append(cell);
    }
    table.append(row);
  }

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

function createSelectAllEvent(useMeta: boolean = true): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'a',
    metaKey: useMeta, // Cmd on Mac
    ctrlKey: !useMeta, // Ctrl on Windows/Linux
    bubbles: true,
    cancelable: true,
  });
}

function createNonSelectAllEvent(): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'b', // Not 'a'
    metaKey: true,
    bubbles: true,
    cancelable: true,
  });
}

describe('useTableSelectAll', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Cmd+A in table selects entire table', async () => {
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

    // Verify initial selection is in table cell (range selection)
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
    });

    await act(async () => {
      editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    // Verify table selection was created
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
    });
  });

  it('Ctrl+A in table selects entire table (Windows/Linux)', async () => {
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
      editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent(false)); // Use Ctrl
    });

    // Verify table selection was created
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
    });
  });

  it('Cmd+A outside table is not handled', async () => {
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

    let commandHandled = false;
    await act(async () => {
      commandHandled = editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    // The hook should not handle this (returns false)
    expect(commandHandled).toBe(false);

    // Selection should still be range selection, not table selection
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(false);
    });
  });

  it('Non-Cmd+A key in table is not handled', async () => {
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
      commandHandled = editor.dispatchCommand(KEY_DOWN_COMMAND, createNonSelectAllEvent());
    });

    // The hook should not handle Cmd+B
    expect(commandHandled).toBe(false);

    // Selection should still be range selection
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
    });
  });

  it('Cmd+A from any cell selects entire table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable3x3();
        root.append(table);
        $selectCell(table, 1, 1); // Middle cell (B2)
      });
    });

    await act(async () => {
      editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    // Verify table selection was created
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
    });
  });

  it('Cmd+A preserves table content', async () => {
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
      editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    // Verify table content is preserved
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      expect($isTableNode(table)).toBe(true);
      if ($isTableNode(table)) {
        expect(table.getTextContent()).toContain('A1');
        expect(table.getTextContent()).toContain('B1');
        expect(table.getTextContent()).toContain('A2');
        expect(table.getTextContent()).toContain('B2');
      }
    });
  });

  it('Cmd+A returns true when handled in table', async () => {
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
      commandHandled = editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    expect(commandHandled).toBe(true);
  });

  it('Key without meta/ctrl is not handled', async () => {
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

    // Create event with just 'a' key, no modifiers
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      metaKey: false,
      ctrlKey: false,
      bubbles: true,
      cancelable: true,
    });

    let commandHandled = false;
    await act(async () => {
      commandHandled = editor.dispatchCommand(KEY_DOWN_COMMAND, event);
    });

    // The hook should not handle plain 'a' key
    expect(commandHandled).toBe(false);
  });

  it('Cmd+A when already table selection returns false (lets default handle)', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // First, create table and select all
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

    // First Cmd+A - should select table
    await act(async () => {
      editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    // Verify we have table selection
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isTableSelection(selection)).toBe(true);
    });

    // Second Cmd+A - should return false (let default behavior handle it)
    let commandHandled = false;
    await act(async () => {
      commandHandled = editor.dispatchCommand(KEY_DOWN_COMMAND, createSelectAllEvent());
    });

    // When already a table selection, the hook returns false
    expect(commandHandled).toBe(false);
  });
});
