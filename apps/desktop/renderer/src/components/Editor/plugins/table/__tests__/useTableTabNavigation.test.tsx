/**
 * useTableTabNavigation Tests
 *
 * Unit tests for Tab/Shift+Tab navigation in tables:
 * - Tab at last cell adds new row
 * - Shift+Tab at first cell exits table before
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  LexicalEditor,
  KEY_TAB_COMMAND,
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
import { useTableTabNavigation } from '../useTableTabNavigation';
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

// Plugin that only uses the Tab navigation hook
function TabNavigationOnlyPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useTableTabNavigation(editor);
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
      <TabNavigationOnlyPlugin />
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

function createKeyboardEvent(key: string, options: { shiftKey?: boolean } = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    shiftKey: options.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
}

describe('useTableTabNavigation', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Tab at last cell creates new row', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 1, 1); // Last cell (B2)
      });
    });

    // Verify 2 rows initially
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        expect(table.getChildren().length).toBe(2);
      }
    });

    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab'));
    });

    // Verify new row was created
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        expect(table.getChildren().length).toBe(3);
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

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Before table'));
        const table = $createTable2x2();
        root.append(paragraph, table);
        $selectCell(table, 0, 0); // First cell (A1)
      });
    });

    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab', { shiftKey: true }));
    });

    // Verify selection moved to before the table
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect($isParagraphNode(children[0])).toBe(true);
      expect($isTableNode(children[1])).toBe(true);
    });
  });

  it('Shift+Tab at first cell with no element before creates paragraph', async () => {
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

    // Verify only table initially
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect(root.getChildren().length).toBe(1);
    });

    await act(async () => {
      editor.dispatchCommand(KEY_TAB_COMMAND, createKeyboardEvent('Tab', { shiftKey: true }));
    });

    // Verify paragraph was created before table
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(2);
      expect($isParagraphNode(children[0])).toBe(true);
      expect($isTableNode(children[1])).toBe(true);
    });
  });
});
