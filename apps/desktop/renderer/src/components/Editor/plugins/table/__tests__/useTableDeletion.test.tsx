/**
 * useTableDeletion Tests
 *
 * Unit tests for Backspace/Delete behavior in tables:
 * - Backspace in empty table removes table and exits before
 * - Delete in empty table removes table and exits after
 * - Non-empty tables are not deleted
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isParagraphNode,
  LexicalEditor,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
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
import { useTableDeletion } from '../useTableDeletion';
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

// Plugin that only uses the deletion hook
function DeletionOnlyPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useTableDeletion(editor);
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
      <DeletionOnlyPlugin />
      {children}
    </LexicalComposer>
  );
}

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

describe('useTableDeletion', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('Backspace in empty table removes table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createEmptyTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

    // Verify table exists
    editor.getEditorState().read(() => {
      const root = $getRoot();
      expect($isTableNode(root.getChildren()[0])).toBe(true);
    });

    await act(async () => {
      editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
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

  it('Delete in empty table removes table', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createEmptyTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

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

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
        $selectCell(table, 0, 0);
      });
    });

    // Verify table has content
    let tableTextContent = '';
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        tableTextContent = table.getTextContent();
      }
    });
    expect(tableTextContent).toContain('A1');

    // Try to dispatch Backspace
    try {
      await act(async () => {
        editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
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

  it('Backspace exits before table position', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Before'));
        const table = $createEmptyTable2x2();
        root.append(paragraph, table);
        $selectCell(table, 0, 0);
      });
    });

    await act(async () => {
      editor.dispatchCommand(KEY_BACKSPACE_COMMAND, createKeyboardEvent('Backspace'));
    });

    // Verify table was removed and paragraph remains
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

  it('Delete exits after table position', async () => {
    render(<TestEditor editorRef={editorRef} />);
    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createEmptyTable2x2();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('After'));
        root.append(table, paragraph);
        $selectCell(table, 0, 0);
      });
    });

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
