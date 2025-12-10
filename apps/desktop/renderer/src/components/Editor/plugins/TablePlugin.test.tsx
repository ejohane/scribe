/**
 * TablePlugin Tests
 *
 * Unit tests for table node creation, serialization, and row/column operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  LexicalEditor,
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
import { TablePlugin } from './TablePlugin';
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

// Test wrapper that provides Lexical context with table nodes
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
      {children}
    </LexicalComposer>
  );
}

/**
 * Helper to create a standalone editor for node tests
 */
function createTestEditor(): LexicalEditor {
  return createEditor({
    namespace: 'test',
    nodes: [TableNode, TableRowNode, TableCellNode],
    onError: (error) => {
      throw error;
    },
  });
}

/**
 * Helper to create a 2x2 table structure
 */
function $createTable2x2(withHeader = false): TableNode {
  const table = $createTableNode();

  // Row 1 (header if specified)
  const row1 = $createTableRowNode();
  const cell1a = $createTableCellNode(
    withHeader ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS
  );
  cell1a.append($createParagraphNode().append($createTextNode('A1')));
  const cell1b = $createTableCellNode(
    withHeader ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS
  );
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

describe('TableNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  describe('Node Creation', () => {
    it('creates a table node with correct type', async () => {
      await editor.update(() => {
        const table = $createTableNode();
        expect(TableNode.getType()).toBe('table');
        expect($isTableNode(table)).toBe(true);
      });
    });

    it('creates a table row node with correct type', async () => {
      await editor.update(() => {
        const row = $createTableRowNode();
        expect(TableRowNode.getType()).toBe('tablerow');
        expect($isTableRowNode(row)).toBe(true);
      });
    });

    it('creates a table cell node with correct type', async () => {
      await editor.update(() => {
        const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
        expect(TableCellNode.getType()).toBe('tablecell');
        expect($isTableCellNode(cell)).toBe(true);
      });
    });

    it('creates a 2x2 table with correct structure', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const table = $createTable2x2();
        root.append(table);

        // Verify structure
        const rows = table.getChildren();
        expect(rows.length).toBe(2);

        const row1 = rows[0];
        const row2 = rows[1];
        expect($isTableRowNode(row1)).toBe(true);
        expect($isTableRowNode(row2)).toBe(true);

        if ($isTableRowNode(row1)) {
          const cells1 = row1.getChildren();
          expect(cells1.length).toBe(2);
          expect($isTableCellNode(cells1[0])).toBe(true);
          expect($isTableCellNode(cells1[1])).toBe(true);
        }

        if ($isTableRowNode(row2)) {
          const cells2 = row2.getChildren();
          expect(cells2.length).toBe(2);
        }
      });
    });

    it('preserves header row flag', async () => {
      await editor.update(() => {
        const table = $createTable2x2(true);

        const rows = table.getChildren();
        const headerRow = rows[0];

        if ($isTableRowNode(headerRow)) {
          const cells = headerRow.getChildren();
          const headerCell = cells[0];

          if ($isTableCellNode(headerCell)) {
            // Header cells should have ROW header status
            expect(headerCell.getHeaderStyles()).toBe(TableCellHeaderStates.ROW);
          }
        }
      });
    });

    it('creates table cell with paragraph content', async () => {
      await editor.update(() => {
        const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Cell content');
        paragraph.append(text);
        cell.append(paragraph);

        expect(cell.getTextContent()).toBe('Cell content');
      });
    });
  });

  describe('Table Content', () => {
    it('reads text content from all cells', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const table = $createTable2x2();
        root.append(table);
      });

      editor.getEditorState().read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        expect(textContent).toContain('A1');
        expect(textContent).toContain('B1');
        expect(textContent).toContain('A2');
        expect(textContent).toContain('B2');
      });
    });
  });
});

describe('Table JSON Serialization', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  it('exports table to JSON', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);
    });

    const json = editor.getEditorState().toJSON();
    expect(json.root).toBeDefined();

    // Find the table in the JSON structure
    const tableJson = json.root.children.find(
      (child: { type: string }) => child.type === 'table'
    ) as { type: string; children: Array<{ type: string }> } | undefined;
    expect(tableJson).toBeDefined();
    expect(tableJson!.type).toBe('table');

    // Verify rows
    expect(tableJson!.children).toBeDefined();
    expect(tableJson!.children.length).toBe(2);
    expect(tableJson!.children[0].type).toBe('tablerow');
  });

  it('imports table from JSON', async () => {
    // First create a table and export it
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);
    });

    const json = editor.getEditorState().toJSON();

    // Create a new editor and import the JSON
    const newEditor = createTestEditor();
    const newEditorState = newEditor.parseEditorState(JSON.stringify(json));

    newEditorState.read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);

      const table = children[0];
      expect($isTableNode(table)).toBe(true);
    });
  });

  it('round-trip preserves all content and structure', async () => {
    // Create table with specific content
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2(true); // With header
      root.append(table);
    });

    // Export to JSON
    const json = editor.getEditorState().toJSON();
    const jsonString = JSON.stringify(json);

    // Import into new editor
    const newEditor = createTestEditor();
    const newEditorState = newEditor.parseEditorState(jsonString);

    // Verify structure is preserved
    newEditorState.read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      expect($isTableNode(table)).toBe(true);

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        expect(rows.length).toBe(2);

        // Check header row
        const headerRow = rows[0];
        if ($isTableRowNode(headerRow)) {
          const cells = headerRow.getChildren();
          expect(cells.length).toBe(2);

          const headerCell = cells[0];
          if ($isTableCellNode(headerCell)) {
            expect(headerCell.getHeaderStyles()).toBe(TableCellHeaderStates.ROW);
            expect(headerCell.getTextContent()).toBe('A1');
          }
        }

        // Check data row
        const dataRow = rows[1];
        if ($isTableRowNode(dataRow)) {
          const cells = dataRow.getChildren();
          expect(cells.length).toBe(2);

          const dataCell = cells[0];
          if ($isTableCellNode(dataCell)) {
            expect(dataCell.getHeaderStyles()).toBe(TableCellHeaderStates.NO_STATUS);
            expect(dataCell.getTextContent()).toBe('A2');
          }
        }
      }
    });
  });

  it('preserves cell content through serialization', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTableNode();
      const row = $createTableRowNode();
      const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);

      // Add complex content: multiple paragraphs
      const p1 = $createParagraphNode().append($createTextNode('Line 1'));
      const p2 = $createParagraphNode().append($createTextNode('Line 2'));
      cell.append(p1, p2);
      row.append(cell);
      table.append(row);
      root.append(table);
    });

    const json = editor.getEditorState().toJSON();
    const newEditor = createTestEditor();
    const newEditorState = newEditor.parseEditorState(JSON.stringify(json));

    newEditorState.read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];
      if ($isTableNode(table)) {
        const row = table.getChildren()[0];
        if ($isTableRowNode(row)) {
          const cell = row.getChildren()[0];
          if ($isTableCellNode(cell)) {
            const textContent = cell.getTextContent();
            expect(textContent).toContain('Line 1');
            expect(textContent).toContain('Line 2');
          }
        }
      }
    });
  });
});

describe('Row Operations', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  it('adds row with correct cell count', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);
    });

    // Add a new row manually
    await editor.update(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const existingRows = table.getChildren();
        const columnCount = $isTableRowNode(existingRows[0])
          ? existingRows[0].getChildren().length
          : 0;

        // Create new row with same number of cells
        const newRow = $createTableRowNode();
        for (let i = 0; i < columnCount; i++) {
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          cell.append($createParagraphNode());
          newRow.append(cell);
        }
        table.append(newRow);
      }
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        expect(rows.length).toBe(3); // Was 2, now 3

        // Verify the new row has 2 cells
        const newRow = rows[2];
        if ($isTableRowNode(newRow)) {
          expect(newRow.getChildren().length).toBe(2);
        }
      }
    });
  });

  it('removes entire row', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);
    });

    // Remove the second row
    await editor.update(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        const rowToRemove = rows[1]; // Second row
        if ($isTableRowNode(rowToRemove)) {
          rowToRemove.remove();
        }
      }
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        expect(rows.length).toBe(1);

        // Remaining row should be the first one
        const remainingRow = rows[0];
        if ($isTableRowNode(remainingRow)) {
          const cells = remainingRow.getChildren();
          if ($isTableCellNode(cells[0])) {
            expect(cells[0].getTextContent()).toBe('A1');
          }
        }
      }
    });
  });

  it('preserves row integrity when removing', async () => {
    // Create a 3x2 table
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTableNode();

      for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
        const row = $createTableRowNode();
        for (let colIdx = 0; colIdx < 2; colIdx++) {
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          cell.append(
            $createParagraphNode().append($createTextNode(`R${rowIdx + 1}C${colIdx + 1}`))
          );
          row.append(cell);
        }
        table.append(row);
      }
      root.append(table);
    });

    // Remove middle row
    await editor.update(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        const middleRow = rows[1];
        if ($isTableRowNode(middleRow)) {
          middleRow.remove();
        }
      }
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        expect(rows.length).toBe(2);

        // First row should have R1C1, R1C2
        const firstRow = rows[0];
        if ($isTableRowNode(firstRow)) {
          const cells = firstRow.getChildren();
          if ($isTableCellNode(cells[0])) {
            expect(cells[0].getTextContent()).toBe('R1C1');
          }
        }

        // Second row (was third) should have R3C1, R3C2
        const secondRow = rows[1];
        if ($isTableRowNode(secondRow)) {
          const cells = secondRow.getChildren();
          if ($isTableCellNode(cells[0])) {
            expect(cells[0].getTextContent()).toBe('R3C1');
          }
        }
      }
    });
  });
});

describe('Column Operations', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  it('adds column to each row', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);
    });

    // Add a column
    await editor.update(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();

        for (const row of rows) {
          if ($isTableRowNode(row)) {
            const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
            cell.append($createParagraphNode().append($createTextNode('New')));
            row.append(cell);
          }
        }
      }
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();

        // Each row should now have 3 cells
        for (const row of rows) {
          if ($isTableRowNode(row)) {
            expect(row.getChildren().length).toBe(3);
          }
        }
      }
    });
  });

  it('removes column from each row', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);
    });

    // Remove the second column (index 1)
    await editor.update(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        const columnIndex = 1;

        for (const row of rows) {
          if ($isTableRowNode(row)) {
            const cells = row.getChildren();
            const cellToRemove = cells[columnIndex];
            if ($isTableCellNode(cellToRemove)) {
              cellToRemove.remove();
            }
          }
        }
      }
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();

        // Each row should now have 1 cell
        for (const row of rows) {
          if ($isTableRowNode(row)) {
            expect(row.getChildren().length).toBe(1);
          }
        }

        // Remaining cells should be from column A
        const firstRow = rows[0];
        if ($isTableRowNode(firstRow)) {
          const cells = firstRow.getChildren();
          if ($isTableCellNode(cells[0])) {
            expect(cells[0].getTextContent()).toBe('A1');
          }
        }
      }
    });
  });

  it('maintains column alignment across all rows', async () => {
    // Create a 3x3 table
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTableNode();

      for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
        const row = $createTableRowNode();
        for (let colIdx = 0; colIdx < 3; colIdx++) {
          const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
          cell.append($createParagraphNode().append($createTextNode(`${rowIdx}-${colIdx}`)));
          row.append(cell);
        }
        table.append(row);
      }
      root.append(table);
    });

    // Remove middle column (index 1)
    await editor.update(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();

        for (const row of rows) {
          if ($isTableRowNode(row)) {
            const cells = row.getChildren();
            const cellToRemove = cells[1];
            if ($isTableCellNode(cellToRemove)) {
              cellToRemove.remove();
            }
          }
        }
      }
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();

        // Each row should have columns 0 and 2 remaining
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          if ($isTableRowNode(row)) {
            const cells = row.getChildren();
            expect(cells.length).toBe(2);

            if ($isTableCellNode(cells[0])) {
              expect(cells[0].getTextContent()).toBe(`${rowIdx}-0`);
            }
            if ($isTableCellNode(cells[1])) {
              expect(cells[1].getTextContent()).toBe(`${rowIdx}-2`);
            }
          }
        }
      }
    });
  });
});

describe('TablePlugin Integration', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
  });

  it('TablePlugin renders without errors', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    // Editor should be initialized
    expect(editorRef.current).toBeDefined();
  });

  it('editor can create table with TablePlugin active', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    // Create a table in the editor
    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
      });
    });

    // Verify table was created
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      expect(children.length).toBe(1);
      expect($isTableNode(children[0])).toBe(true);
    });
  });

  it('table is rendered as HTML table element', async () => {
    render(<TestEditor editorRef={editorRef} />);

    await waitFor(() => expect(editorRef.current).not.toBeNull());

    const editor = editorRef.current!;

    await act(async () => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTable2x2();
        root.append(table);
      });
    });

    // Wait for DOM to update
    await waitFor(() => {
      const tableElement = document.querySelector('table');
      expect(tableElement).toBeTruthy();
    });

    // Verify table structure in DOM
    const tableElement = document.querySelector('table');
    expect(tableElement).toBeTruthy();

    const rows = tableElement?.querySelectorAll('tr');
    expect(rows?.length).toBe(2);

    const cells = tableElement?.querySelectorAll('td, th');
    expect(cells?.length).toBe(4); // 2x2 = 4 cells
  });
});

describe('Edge Cases', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  it('handles empty table', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTableNode();
      root.append(table);
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      expect($isTableNode(table)).toBe(true);
      if ($isTableNode(table)) {
        expect(table.getChildren().length).toBe(0);
      }
    });
  });

  it('handles table with single cell', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTableNode();
      const row = $createTableRowNode();
      const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      cell.append($createParagraphNode().append($createTextNode('Only cell')));
      row.append(cell);
      table.append(row);
      root.append(table);
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        expect(rows.length).toBe(1);

        if ($isTableRowNode(rows[0])) {
          const cells = rows[0].getChildren();
          expect(cells.length).toBe(1);
          if ($isTableCellNode(cells[0])) {
            expect(cells[0].getTextContent()).toBe('Only cell');
          }
        }
      }
    });
  });

  it('handles table with empty cells', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTableNode();
      const row = $createTableRowNode();
      const cell1 = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      cell1.append($createParagraphNode()); // Empty paragraph
      const cell2 = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      cell2.append($createParagraphNode().append($createTextNode('Has content')));
      row.append(cell1, cell2);
      table.append(row);
      root.append(table);
    });

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const table = root.getChildren()[0];

      if ($isTableNode(table)) {
        const rows = table.getChildren();
        if ($isTableRowNode(rows[0])) {
          const cells = rows[0].getChildren();

          if ($isTableCellNode(cells[0])) {
            expect(cells[0].getTextContent()).toBe('');
          }
          if ($isTableCellNode(cells[1])) {
            expect(cells[1].getTextContent()).toBe('Has content');
          }
        }
      }
    });
  });

  it('can clone table node', async () => {
    await editor.update(() => {
      const root = $getRoot();
      const table = $createTable2x2();
      root.append(table);

      // Clone the table - Lexical's clone preserves the key by design
      const clonedTable = TableNode.clone(table);

      // Verify the clone is a TableNode
      expect($isTableNode(clonedTable)).toBe(true);
      // Lexical's clone method preserves the __key (this is by design)
      expect(clonedTable.__key).toBe(table.__key);
    });
  });
});
