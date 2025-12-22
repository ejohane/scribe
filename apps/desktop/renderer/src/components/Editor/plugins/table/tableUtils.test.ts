/**
 * Unit tests for tableUtils
 *
 * Tests the Lexical utility functions used by table keyboard hooks.
 * Uses createEditor to set up a minimal Lexical environment with table nodes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEditor,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $setSelection,
  $getSelection,
  LexicalEditor,
  ParagraphNode,
} from 'lexical';
import {
  TableNode,
  TableRowNode,
  TableCellNode,
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  TableCellHeaderStates,
} from '@lexical/table';
import { ListNode, ListItemNode, $createListNode, $createListItemNode } from '@lexical/list';

import {
  $isSelectionInTable,
  $isSelectionInList,
  $getTableCellFromSelection,
  $getTableFromCell,
  $isLastCellInTable,
  $isFirstCellInTable,
  $isTableEmpty,
  $getFirstCell,
  $getLastCell,
  $exitTableBefore,
  $exitTableAfter,
} from './tableUtils';

/**
 * Create a Lexical editor with table and list nodes registered
 */
function createTestEditor(): LexicalEditor {
  return createEditor({
    namespace: 'test',
    nodes: [TableNode, TableRowNode, TableCellNode, ListNode, ListItemNode, ParagraphNode],
    onError: (error) => {
      throw error;
    },
  });
}

/**
 * Create a 2x2 table with optional content
 */
function $createTestTable(cellTexts?: string[][]): TableNode {
  const table = $createTableNode();
  const texts = cellTexts ?? [
    ['A1', 'B1'],
    ['A2', 'B2'],
  ];

  for (const rowTexts of texts) {
    const row = $createTableRowNode();
    for (const text of rowTexts) {
      const cell = $createTableCellNode(TableCellHeaderStates.NO_STATUS);
      const paragraph = $createParagraphNode();
      if (text) {
        paragraph.append($createTextNode(text));
      }
      cell.append(paragraph);
      row.append(cell);
    }
    table.append(row);
  }

  return table;
}

/**
 * Create an empty table (all cells have empty paragraphs)
 */
function $createEmptyTable(): TableNode {
  return $createTestTable([
    ['', ''],
    ['', ''],
  ]);
}

/**
 * Create a list with items
 */
function $createTestList(items: string[]): ListNode {
  const list = $createListNode('bullet');
  for (const text of items) {
    const item = $createListItemNode();
    item.append($createTextNode(text));
    list.append(item);
  }
  return list;
}

/**
 * Get a specific cell from a table by row and column index
 */
function $getCellAt(table: TableNode, rowIndex: number, colIndex: number): TableCellNode | null {
  const rows = table.getChildren();
  if (rowIndex >= rows.length) return null;
  const row = rows[rowIndex] as TableRowNode;
  const cells = row.getChildren();
  if (colIndex >= cells.length) return null;
  return cells[colIndex] as TableCellNode;
}

describe('tableUtils', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  // ============================================================================
  // Selection Detection
  // ============================================================================
  describe('$isSelectionInTable', () => {
    it('returns true when selection is inside a table cell', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);

        // Select inside first cell
        const firstCell = $getCellAt(table, 0, 0)!;
        const paragraph = firstCell.getFirstChild()!;
        paragraph.selectEnd();
      });

      await editor.update(() => {
        expect($isSelectionInTable()).toBe(true);
      });
    });

    it('returns false when selection is outside table', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Outside'));
        root.append(paragraph);
        paragraph.selectEnd();
      });

      await editor.update(() => {
        expect($isSelectionInTable()).toBe(false);
      });
    });

    it('returns false when there is no selection', async () => {
      await editor.update(() => {
        const root = $getRoot();
        root.append($createTestTable());
        $setSelection(null);
      });

      await editor.update(() => {
        expect($isSelectionInTable()).toBe(false);
      });
    });
  });

  describe('$isSelectionInList', () => {
    it('returns true when selection is inside a list item', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const list = $createTestList(['Item 1', 'Item 2']);
        root.append(list);

        // Select inside first item
        const firstItem = list.getFirstChild()!;
        firstItem.selectEnd();
      });

      await editor.update(() => {
        expect($isSelectionInList()).toBe(true);
      });
    });

    it('returns false when selection is outside list', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Outside'));
        root.append(paragraph);
        paragraph.selectEnd();
      });

      await editor.update(() => {
        expect($isSelectionInList()).toBe(false);
      });
    });

    it('returns false when selection is in table (not list)', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);

        const firstCell = $getCellAt(table, 0, 0)!;
        firstCell.selectEnd();
      });

      await editor.update(() => {
        expect($isSelectionInList()).toBe(false);
      });
    });
  });

  // ============================================================================
  // Cell/Table Retrieval
  // ============================================================================
  describe('$getTableCellFromSelection', () => {
    it('returns cell when selection is inside table', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);

        const cell = $getCellAt(table, 0, 0)!;
        cell.selectEnd();
      });

      await editor.update(() => {
        const cell = $getTableCellFromSelection();
        expect(cell).not.toBeNull();
      });
    });

    it('returns null when selection is outside table', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Outside'));
        root.append(paragraph);
        paragraph.selectEnd();
      });

      await editor.update(() => {
        expect($getTableCellFromSelection()).toBeNull();
      });
    });
  });

  describe('$getTableFromCell', () => {
    it('returns table from a valid cell', async () => {
      let capturedTable: TableNode | null = null;
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedTable = table;
        capturedCell = $getCellAt(table, 0, 0);
      });

      await editor.update(() => {
        if (capturedCell) {
          const result = $getTableFromCell(capturedCell);
          expect(result).toBe(capturedTable);
        }
      });
    });
  });

  // ============================================================================
  // Boundary Cell Detection
  // ============================================================================
  describe('$isFirstCellInTable', () => {
    it('returns true for first cell (0,0)', async () => {
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedCell = $getCellAt(table, 0, 0);
      });

      await editor.update(() => {
        if (capturedCell) {
          expect($isFirstCellInTable(capturedCell)).toBe(true);
        }
      });
    });

    it('returns false for non-first cell', async () => {
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedCell = $getCellAt(table, 0, 1); // Second column
      });

      await editor.update(() => {
        if (capturedCell) {
          expect($isFirstCellInTable(capturedCell)).toBe(false);
        }
      });
    });

    it('returns false for cell in second row', async () => {
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedCell = $getCellAt(table, 1, 0); // Second row, first column
      });

      await editor.update(() => {
        if (capturedCell) {
          expect($isFirstCellInTable(capturedCell)).toBe(false);
        }
      });
    });
  });

  describe('$isLastCellInTable', () => {
    it('returns true for last cell', async () => {
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable(); // 2x2 table
        root.append(table);
        capturedCell = $getCellAt(table, 1, 1); // Last cell
      });

      await editor.update(() => {
        if (capturedCell) {
          expect($isLastCellInTable(capturedCell)).toBe(true);
        }
      });
    });

    it('returns false for first cell', async () => {
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedCell = $getCellAt(table, 0, 0);
      });

      await editor.update(() => {
        if (capturedCell) {
          expect($isLastCellInTable(capturedCell)).toBe(false);
        }
      });
    });

    it('returns false for last cell in first row', async () => {
      let capturedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedCell = $getCellAt(table, 0, 1); // First row, last column
      });

      await editor.update(() => {
        if (capturedCell) {
          expect($isLastCellInTable(capturedCell)).toBe(false);
        }
      });
    });
  });

  // ============================================================================
  // First/Last Cell Retrieval
  // ============================================================================
  describe('$getFirstCell', () => {
    it('returns first cell of table', async () => {
      let capturedTable: TableNode | null = null;
      let expectedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedTable = table;
        expectedCell = $getCellAt(table, 0, 0);
      });

      await editor.update(() => {
        if (capturedTable) {
          const result = $getFirstCell(capturedTable);
          expect(result).toBe(expectedCell);
        }
      });
    });
  });

  describe('$getLastCell', () => {
    it('returns last cell of table', async () => {
      let capturedTable: TableNode | null = null;
      let expectedCell: TableCellNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        root.append(table);
        capturedTable = table;
        expectedCell = $getCellAt(table, 1, 1); // Last cell of 2x2
      });

      await editor.update(() => {
        if (capturedTable) {
          const result = $getLastCell(capturedTable);
          expect(result).toBe(expectedCell);
        }
      });
    });
  });

  // ============================================================================
  // Empty Table Detection
  // ============================================================================
  describe('$isTableEmpty', () => {
    it('returns true for empty table', async () => {
      let capturedTable: TableNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createEmptyTable();
        root.append(table);
        capturedTable = table;
      });

      await editor.update(() => {
        if (capturedTable) {
          expect($isTableEmpty(capturedTable)).toBe(true);
        }
      });
    });

    it('returns false for table with content', async () => {
      let capturedTable: TableNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable([
          ['Some text', ''],
          ['', ''],
        ]);
        root.append(table);
        capturedTable = table;
      });

      await editor.update(() => {
        if (capturedTable) {
          expect($isTableEmpty(capturedTable)).toBe(false);
        }
      });
    });

    it('returns true for table with only whitespace', async () => {
      let capturedTable: TableNode | null = null;

      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable([
          ['   ', '  '],
          ['\t', '\n'],
        ]);
        root.append(table);
        capturedTable = table;
      });

      await editor.update(() => {
        if (capturedTable) {
          expect($isTableEmpty(capturedTable)).toBe(true);
        }
      });
    });
  });

  // ============================================================================
  // Exit Table Functions
  // ============================================================================
  describe('$exitTableBefore', () => {
    it('selects previous sibling if exists', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('Before'));
        const table = $createTestTable();
        root.append(paragraph);
        root.append(table);

        $exitTableBefore(table);
      });

      await editor.update(() => {
        const selection = $getSelection();
        expect(selection).not.toBeNull();
        // Selection should be at end of paragraph before table
      });
    });

    it('creates paragraph before table if no previous sibling', async () => {
      await editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTestTable();
        root.append(table);

        $exitTableBefore(table);
      });

      await editor.update(() => {
        const root = $getRoot();
        const firstChild = root.getFirstChild();
        // First child should now be a paragraph (created by exitTableBefore)
        expect(firstChild?.getType()).toBe('paragraph');
      });
    });
  });

  describe('$exitTableAfter', () => {
    it('selects next sibling if exists', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const table = $createTestTable();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('After'));
        root.append(table);
        root.append(paragraph);

        $exitTableAfter(table);
      });

      await editor.update(() => {
        const selection = $getSelection();
        expect(selection).not.toBeNull();
        // Selection should be at start of paragraph after table
      });
    });

    it('creates paragraph after table if no next sibling', async () => {
      await editor.update(() => {
        const root = $getRoot();
        root.clear();
        const table = $createTestTable();
        root.append(table);

        $exitTableAfter(table);
      });

      await editor.update(() => {
        const root = $getRoot();
        const lastChild = root.getLastChild();
        // Last child should now be a paragraph (created by exitTableAfter)
        expect(lastChild?.getType()).toBe('paragraph');
      });
    });
  });
});
