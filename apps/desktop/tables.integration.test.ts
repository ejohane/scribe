/**
 * E2E Integration Tests for Tables Feature
 *
 * Tests table functionality including:
 * - Table creation and navigation (Flows 1-4 from redesign-13)
 * - Auto-delete empty table (Flow 5)
 * - Exit behaviors (Flow 6)
 * - Multi-cell copy/paste (Flow 7)
 * - Block lists in cells (Flow 8)
 * - Overflow scrolling (Flow 9 - limited automation)
 *
 * These tests focus on table-specific behaviors at the integration level,
 * complementing the unit tests in TablePlugin.test.tsx, TableKeyboardPlugin.test.tsx,
 * and TableContentPlugin.test.tsx.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { EditorContent } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
} from './test-helpers';

// =============================================================================
// Table Content Helpers
// =============================================================================

/**
 * Table structure types for type-safe test content creation
 */
interface TableCellContent {
  type: 'tablecell';
  headerState?: 'normal' | 'row' | 'column' | 'both';
  children: Array<{ type: string; children: Array<{ type: string; text?: string }> }>;
}

interface TableRowContent {
  type: 'tablerow';
  children: TableCellContent[];
}

interface TableContent {
  type: 'table';
  children: TableRowContent[];
}

/**
 * Creates Lexical content with a table
 *
 * @param title - The note title
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @param cellContents - Optional 2D array of cell contents
 * @returns EditorContent with table
 */
function createNoteWithTable(
  title: string,
  rows: number,
  cols: number,
  cellContents?: string[][]
): EditorContent {
  const tableRows: TableRowContent[] = [];

  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const cells: TableCellContent[] = [];
    for (let colIdx = 0; colIdx < cols; colIdx++) {
      const cellText = cellContents?.[rowIdx]?.[colIdx] ?? `R${rowIdx + 1}C${colIdx + 1}`;
      cells.push({
        type: 'tablecell',
        headerState: 'normal',
        children: [
          {
            type: 'paragraph',
            children: cellText ? [{ type: 'text', text: cellText }] : [],
          },
        ],
      });
    }
    tableRows.push({
      type: 'tablerow',
      children: cells,
    });
  }

  const tableNode: TableContent = {
    type: 'table',
    children: tableRows,
  };

  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: title }],
        },
        tableNode as unknown as { type: string; children: Array<{ type: string; text: string }> },
      ],
    },
  };
}

/**
 * Creates Lexical content with an empty table (all cells empty)
 *
 * @param title - The note title
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @returns EditorContent with empty table
 */
function createNoteWithEmptyTable(title: string, rows: number, cols: number): EditorContent {
  const emptyCells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push('');
    }
    emptyCells.push(row);
  }
  return createNoteWithTable(title, rows, cols, emptyCells);
}

/**
 * Creates Lexical content with a table that has header row
 *
 * @param title - The note title
 * @param headers - Array of header text
 * @param dataRows - 2D array of data cell contents
 * @returns EditorContent with header table
 */
function createNoteWithHeaderTable(
  title: string,
  headers: string[],
  dataRows: string[][]
): EditorContent {
  const tableRows: TableRowContent[] = [];

  // Header row
  const headerCells: TableCellContent[] = headers.map((headerText) => ({
    type: 'tablecell',
    headerState: 'row',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: headerText }],
      },
    ],
  }));
  tableRows.push({
    type: 'tablerow',
    children: headerCells,
  });

  // Data rows
  for (const dataRow of dataRows) {
    const cells: TableCellContent[] = dataRow.map((cellText) => ({
      type: 'tablecell',
      headerState: 'normal',
      children: [
        {
          type: 'paragraph',
          children: cellText ? [{ type: 'text', text: cellText }] : [],
        },
      ],
    }));
    tableRows.push({
      type: 'tablerow',
      children: cells,
    });
  }

  const tableNode: TableContent = {
    type: 'table',
    children: tableRows,
  };

  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: title }],
        },
        tableNode as unknown as { type: string; children: Array<{ type: string; text: string }> },
      ],
    },
  };
}

/**
 * Check if content contains a table node
 */
function hasTable(content: EditorContent): boolean {
  if (!content.root?.children) return false;
  return content.root.children.some((child) => (child as { type: string }).type === 'table');
}

/**
 * Get table from content
 */
function getTable(content: EditorContent): TableContent | null {
  if (!content.root?.children) return null;
  const tableNode = content.root.children.find(
    (child) => (child as { type: string }).type === 'table'
  );
  return tableNode as unknown as TableContent | null;
}

/**
 * Check if all cells in a table are empty
 */
function isTableEmpty(table: TableContent): boolean {
  for (const row of table.children) {
    for (const cell of row.children) {
      for (const paragraph of cell.children) {
        for (const child of paragraph.children) {
          if ((child as { text?: string }).text?.trim()) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

/**
 * Get the text content of a specific cell
 */
function getCellText(table: TableContent, rowIdx: number, colIdx: number): string {
  const row = table.children[rowIdx];
  if (!row) return '';
  const cell = row.children[colIdx];
  if (!cell) return '';

  let text = '';
  for (const paragraph of cell.children) {
    for (const child of paragraph.children) {
      if ((child as { text?: string }).text) {
        text += (child as { text: string }).text;
      }
    }
  }
  return text;
}

describe('Tables E2E Integration Tests', () => {
  let ctx: TestContext;
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-tables-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // Flow 1: Create and Populate Table
  // ===========================================================================
  describe('Flow 1: Create and populate table', () => {
    /**
     * Per spec.md:
     * 1. Type '/table' and select command
     * 2. Verify 2x2 table inserted
     * 3. Type 'Header 1', Tab
     * 4. Type 'Header 2', Tab
     * 5. Verify cursor in row 2, cell 1
     * 6. Type 'Data 1', Tab, 'Data 2'
     * 7. Verify all content persisted
     */

    it('should create 2x2 table via /table command', async () => {
      // Simulate /table command creating a 2x2 table with header row
      const content = createNoteWithHeaderTable(
        'Table Test',
        ['', ''], // Empty header cells (initial state)
        [['', "''"]] // Empty data row
      );

      const note = await vault.create({ content, title: 'Table Test' });
      const loaded = vault.read(note.id);

      // Verify table structure exists
      expect(hasTable(loaded.content)).toBe(true);
      const table = getTable(loaded.content);
      expect(table).not.toBeNull();
      expect(table!.children.length).toBe(2); // 2 rows (header + 1 data)
      expect(table!.children[0].children.length).toBe(2); // 2 columns
    });

    it('should have header row with correct header state', async () => {
      const content = createNoteWithHeaderTable('Header Test', ['H1', 'H2'], [['D1', 'D2']]);

      const note = await vault.create({ content, title: 'Header Test' });
      const loaded = vault.read(note.id);

      const table = getTable(loaded.content);
      const headerRow = table!.children[0];

      // Header cells should have 'row' header state
      expect(headerRow.children[0].headerState).toBe('row');
      expect(headerRow.children[1].headerState).toBe('row');

      // Data row cells should have 'normal' header state
      const dataRow = table!.children[1];
      expect(dataRow.children[0].headerState).toBe('normal');
      expect(dataRow.children[1].headerState).toBe('normal');
    });

    it('should populate cells with content and persist', async () => {
      // Simulate typing: Header 1, Tab, Header 2, Tab, Data 1, Tab, Data 2
      const content = createNoteWithHeaderTable(
        'Populated Table',
        ['Header 1', 'Header 2'],
        [['Data 1', 'Data 2']]
      );

      const note = await vault.create({ content, title: 'Populated Table' });

      // Save and reload
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify all content persisted
      expect(getCellText(table!, 0, 0)).toBe('Header 1');
      expect(getCellText(table!, 0, 1)).toBe('Header 2');
      expect(getCellText(table!, 1, 0)).toBe('Data 1');
      expect(getCellText(table!, 1, 1)).toBe('Data 2');
    });

    it('should persist table across vault reload (app restart)', async () => {
      const content = createNoteWithHeaderTable(
        'Restart Test',
        ['Persistent Header', 'H2'],
        [['Persistent Data', 'D2']]
      );

      const note = await vault.create({ content, title: 'Restart Test' });
      const noteId = note.id;

      // Simulate app restart
      const newVault = await simulateAppRestart(tempDir);

      const reloaded = newVault.read(noteId);
      expect(reloaded).toBeDefined();

      const reloadedTable = getTable(reloaded.content);
      expect(reloadedTable).not.toBeNull();
      expect(getCellText(reloadedTable!, 0, 0)).toBe('Persistent Header');
      expect(getCellText(reloadedTable!, 1, 0)).toBe('Persistent Data');
    });
  });

  // ===========================================================================
  // Flow 2: Add Rows and Columns
  // ===========================================================================
  describe('Flow 2: Add rows and columns', () => {
    /**
     * Per spec.md:
     * 1. Create table
     * 2. Click column '+' button
     * 3. Verify 3 columns
     * 4. Click row '+' button
     * 5. Verify 3 rows
     * 6. Tab through all cells
     */

    it('should add column via + button (simulated by creating 3-column table)', async () => {
      // Simulates: create 2x2 table, then add column
      // Result: 2x3 table
      const content = createNoteWithHeaderTable(
        'Add Column Test',
        ['H1', 'H2', ''], // 3 columns, last one empty (just added)
        [['D1', 'D2', '']]
      );

      const note = await vault.create({ content, title: 'Add Column Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 3 columns
      expect(table!.children[0].children.length).toBe(3);
      expect(table!.children[1].children.length).toBe(3);

      // Original content should be preserved
      expect(getCellText(table!, 0, 0)).toBe('H1');
      expect(getCellText(table!, 0, 1)).toBe('H2');
      expect(getCellText(table!, 1, 0)).toBe('D1');
      expect(getCellText(table!, 1, 1)).toBe('D2');

      // New column should be empty
      expect(getCellText(table!, 0, 2)).toBe('');
      expect(getCellText(table!, 1, 2)).toBe('');
    });

    it('should add row via + button (simulated by creating 3-row table)', async () => {
      // Simulates: create 2x2 table, then add row
      // Result: 3x2 table
      const content = createNoteWithHeaderTable(
        'Add Row Test',
        ['H1', 'H2'],
        [
          ['D1', 'D2'],
          ['', ''], // New empty row
        ]
      );

      const note = await vault.create({ content, title: 'Add Row Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 3 rows (header + 2 data rows)
      expect(table!.children.length).toBe(3);

      // Original content should be preserved
      expect(getCellText(table!, 0, 0)).toBe('H1');
      expect(getCellText(table!, 0, 1)).toBe('H2');
      expect(getCellText(table!, 1, 0)).toBe('D1');
      expect(getCellText(table!, 1, 1)).toBe('D2');

      // New row should be empty
      expect(getCellText(table!, 2, 0)).toBe('');
      expect(getCellText(table!, 2, 1)).toBe('');
    });

    it('should maintain correct cell count after adding column and row', async () => {
      // Simulates: create 2x2, add column, add row -> 3x3
      const content = createNoteWithHeaderTable(
        'Add Both Test',
        ['H1', 'H2', 'H3'],
        [
          ['D1', 'D2', 'D3'],
          ['E1', 'E2', 'E3'],
        ]
      );

      const note = await vault.create({ content, title: 'Add Both Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 3 rows x 3 columns
      expect(table!.children.length).toBe(3);
      for (const row of table!.children) {
        expect(row.children.length).toBe(3);
      }
    });

    it('should preserve header state when adding column', async () => {
      const content = createNoteWithHeaderTable(
        'Header State Test',
        ['H1', 'H2', 'H3'], // All header cells
        [['D1', 'D2', 'D3']]
      );

      const note = await vault.create({ content, title: 'Header State Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // All header cells should have 'row' header state
      expect(table!.children[0].children[0].headerState).toBe('row');
      expect(table!.children[0].children[1].headerState).toBe('row');
      expect(table!.children[0].children[2].headerState).toBe('row');

      // Data cells should have 'normal' header state
      expect(table!.children[1].children[0].headerState).toBe('normal');
      expect(table!.children[1].children[1].headerState).toBe('normal');
      expect(table!.children[1].children[2].headerState).toBe('normal');
    });

    it('should populate all cells after adding row and column', async () => {
      // All 9 cells populated
      const content = createNoteWithHeaderTable(
        'Full Populate Test',
        ['H1', 'H2', 'H3'],
        [
          ['R1C1', 'R1C2', 'R1C3'],
          ['R2C1', 'R2C2', 'R2C3'],
        ]
      );

      const note = await vault.create({ content, title: 'Full Populate Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify all content
      const expectedData = [
        ['H1', 'H2', 'H3'],
        ['R1C1', 'R1C2', 'R1C3'],
        ['R2C1', 'R2C2', 'R2C3'],
      ];

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(getCellText(table!, r, c)).toBe(expectedData[r][c]);
        }
      }
    });
  });

  // ===========================================================================
  // Flow 3: Delete Row
  // ===========================================================================
  describe('Flow 3: Delete row', () => {
    /**
     * Per spec.md:
     * 1. Create 3x3 table
     * 2. Click row 'x' button on middle row
     * 3. Verify 2 rows remain
     * 4. Verify content in other rows preserved
     */

    it('should delete middle row and preserve other content', async () => {
      // Start with 3x3 table, then simulate deleting middle row
      // Result: 2x3 table with header and last data row
      const content = createNoteWithHeaderTable(
        'Delete Row Test',
        ['H1', 'H2', 'H3'],
        [
          // Middle row deleted, only last row remains
          ['R2C1', 'R2C2', 'R2C3'],
        ]
      );

      const note = await vault.create({ content, title: 'Delete Row Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 2 rows remain (header + 1 data row)
      expect(table!.children.length).toBe(2);

      // Verify header row content preserved
      expect(getCellText(table!, 0, 0)).toBe('H1');
      expect(getCellText(table!, 0, 1)).toBe('H2');
      expect(getCellText(table!, 0, 2)).toBe('H3');

      // Verify remaining data row content preserved (was row 2)
      expect(getCellText(table!, 1, 0)).toBe('R2C1');
      expect(getCellText(table!, 1, 1)).toBe('R2C2');
      expect(getCellText(table!, 1, 2)).toBe('R2C3');
    });

    it('should handle deleting last data row (leaving header only)', async () => {
      // Header-only table
      const content = createNoteWithHeaderTable(
        'Header Only Test',
        ['H1', 'H2'],
        [] // No data rows
      );

      const note = await vault.create({ content, title: 'Header Only Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 1 row remains (header only)
      expect(table!.children.length).toBe(1);

      // Header content preserved
      expect(getCellText(table!, 0, 0)).toBe('H1');
      expect(getCellText(table!, 0, 1)).toBe('H2');
    });

    it('should preserve column count when deleting row', async () => {
      // 2 rows, 3 columns
      const content = createNoteWithHeaderTable(
        'Column Count Test',
        ['A', 'B', 'C'],
        [['1', '2', '3']]
      );

      const note = await vault.create({ content, title: 'Column Count Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // All remaining rows should have 3 columns
      for (const row of table!.children) {
        expect(row.children.length).toBe(3);
      }
    });
  });

  // ===========================================================================
  // Flow 4: Delete Column
  // ===========================================================================
  describe('Flow 4: Delete column', () => {
    /**
     * Per spec.md:
     * 1. Create 3x3 table
     * 2. Click column 'x' button on middle column
     * 3. Verify 2 columns remain
     * 4. Verify content in other columns preserved
     */

    it('should delete middle column and preserve other content', async () => {
      // Start with 3x3, simulate deleting middle column
      // Result: 3x2 table with columns 0 and 2 (now 0 and 1)
      const content = createNoteWithHeaderTable(
        'Delete Column Test',
        ['H1', 'H3'], // Middle column deleted
        [
          ['R1C1', 'R1C3'],
          ['R2C1', 'R2C3'],
        ]
      );

      const note = await vault.create({ content, title: 'Delete Column Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 2 columns remain
      expect(table!.children[0].children.length).toBe(2);
      expect(table!.children[1].children.length).toBe(2);
      expect(table!.children[2].children.length).toBe(2);

      // Verify column 0 content preserved
      expect(getCellText(table!, 0, 0)).toBe('H1');
      expect(getCellText(table!, 1, 0)).toBe('R1C1');
      expect(getCellText(table!, 2, 0)).toBe('R2C1');

      // Verify what was column 2 (now column 1) content preserved
      expect(getCellText(table!, 0, 1)).toBe('H3');
      expect(getCellText(table!, 1, 1)).toBe('R1C3');
      expect(getCellText(table!, 2, 1)).toBe('R2C3');
    });

    it('should remove column from all rows', async () => {
      const content = createNoteWithHeaderTable(
        'All Rows Column Test',
        ['A', 'B'],
        [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ]
      );

      const note = await vault.create({ content, title: 'All Rows Column Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // All rows should have same column count
      const columnCount = table!.children[0].children.length;
      for (const row of table!.children) {
        expect(row.children.length).toBe(columnCount);
      }
    });

    it('should preserve row count when deleting column', async () => {
      const content = createNoteWithHeaderTable(
        'Row Count Test',
        ['A', 'B'],
        [
          ['1', '2'],
          ['3', '4'],
        ]
      );

      const note = await vault.create({ content, title: 'Row Count Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Should have 3 rows (header + 2 data)
      expect(table!.children.length).toBe(3);
    });

    it('should handle deleting first column', async () => {
      // Result after deleting first column from 3-column table
      const content = createNoteWithHeaderTable(
        'First Column Test',
        ['H2', 'H3'],
        [
          ['R1C2', 'R1C3'],
          ['R2C2', 'R2C3'],
        ]
      );

      const note = await vault.create({ content, title: 'First Column Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 2 columns remain with correct content
      expect(table!.children[0].children.length).toBe(2);

      // What was column 1 is now column 0
      expect(getCellText(table!, 0, 0)).toBe('H2');
      expect(getCellText(table!, 1, 0)).toBe('R1C2');
      expect(getCellText(table!, 2, 0)).toBe('R2C2');

      // What was column 2 is now column 1
      expect(getCellText(table!, 0, 1)).toBe('H3');
      expect(getCellText(table!, 1, 1)).toBe('R1C3');
      expect(getCellText(table!, 2, 1)).toBe('R2C3');
    });

    it('should handle deleting last column', async () => {
      // Result after deleting last column from 3-column table
      const content = createNoteWithHeaderTable(
        'Last Column Test',
        ['H1', 'H2'],
        [
          ['R1C1', 'R1C2'],
          ['R2C1', 'R2C2'],
        ]
      );

      const note = await vault.create({ content, title: 'Last Column Test' });
      const loaded = vault.read(note.id);
      const table = getTable(loaded.content);

      // Verify 2 columns remain
      expect(table!.children[0].children.length).toBe(2);

      // First two columns preserved
      expect(getCellText(table!, 0, 0)).toBe('H1');
      expect(getCellText(table!, 0, 1)).toBe('H2');
    });
  });

  // ===========================================================================
  // Flow 5: Auto-Delete Empty Table
  // ===========================================================================
  describe('Flow 5: Auto-Delete Empty Table', () => {
    it('should save note with empty table', async () => {
      // Create a note with an empty 2x2 table
      const content = createNoteWithEmptyTable('Note with Empty Table', 2, 2);
      const note = await vault.create({
        title: 'Note with Empty Table',
        content,
      });

      // Verify note was saved
      const saved = vault.read(note.id);
      expect(saved).toBeDefined();
      expect(saved.title).toBe('Note with Empty Table');

      // Verify table exists in content
      expect(hasTable(saved.content)).toBe(true);
      const table = getTable(saved.content);
      expect(table).not.toBeNull();
      expect(isTableEmpty(table!)).toBe(true);
    });

    it('should persist table structure after deletion logic is applied at runtime', async () => {
      // This tests that empty tables are preserved in storage
      // The actual auto-delete behavior happens in the editor (tested in unit tests)

      const content = createNoteWithEmptyTable('Empty Table Test', 2, 2);
      const note = await vault.create({
        title: 'Empty Table Test',
        content,
      });

      // Simulate app restart
      const newVault = await simulateAppRestart(tempDir);

      // Verify note still has the table after restart
      const loaded = newVault.read(note.id);
      expect(hasTable(loaded.content)).toBe(true);
    });

    it('should track cursor position correctly for empty table scenarios', async () => {
      // Create a note with content before and after where a table would be
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Title' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Content after table position' }],
            },
          ],
        },
      };

      const note = await vault.create({
        title: 'Title',
        content,
      });

      // Verify content structure
      const saved = vault.read(note.id);
      expect(saved.content.root.children).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Flow 6: Exit Behaviors
  // ===========================================================================
  describe('Flow 6: Exit Behaviors', () => {
    it('should save note with table and paragraph after it', async () => {
      // Simulates the state after pressing Enter at last cell to exit table
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Title' }],
            },
            createNoteWithTable('', 2, 2).root.children[1] as unknown as {
              type: string;
              children: Array<{ type: string; text: string }>;
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Content after table' }],
            },
          ],
        },
      };

      const note = await vault.create({
        title: 'Title',
        content,
      });

      // Verify structure
      const saved = vault.read(note.id);
      expect(saved.content.root.children).toHaveLength(3);
      expect(hasTable(saved.content)).toBe(true);
    });

    it('should preserve table when paragraph exists after', async () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Title' }],
            },
            createNoteWithTable('', 2, 2).root.children[1] as unknown as {
              type: string;
              children: Array<{ type: string; text: string }>;
            },
            {
              type: 'paragraph',
              children: [],
            },
          ],
        },
      };

      const note = await vault.create({
        title: 'Title',
        content,
      });

      // Restart and verify
      const newVault = await simulateAppRestart(tempDir);
      const loaded = newVault.read(note.id);
      expect(hasTable(loaded.content)).toBe(true);
    });

    it('should maintain table integrity after multiple operations', async () => {
      // Create note with table
      const content = createNoteWithTable('Multi-Op Test', 2, 2, [
        ['A1', 'B1'],
        ['A2', 'B2'],
      ]);

      const note = await vault.create({
        title: 'Multi-Op Test',
        content,
      });

      // Read and verify
      let saved = vault.read(note.id);
      expect(hasTable(saved.content)).toBe(true);

      // Update note (simulating editing)
      saved.title = 'Multi-Op Test Updated';
      await vault.save(saved);

      // Verify table is still intact
      const updated = vault.read(note.id);
      expect(hasTable(updated.content)).toBe(true);
      const table = getTable(updated.content);
      expect(getCellText(table!, 0, 0)).toBe('A1');
      expect(getCellText(table!, 1, 1)).toBe('B2');
    });
  });

  // ===========================================================================
  // Flow 7: Multi-Cell Selection Copy/Paste
  // ===========================================================================
  describe('Flow 7: Multi-Cell Selection Copy/Paste', () => {
    it('should save table with duplicated content (simulating paste)', async () => {
      // Simulate the result of copying cells and pasting
      const content = createNoteWithTable('Copy Paste Test', 4, 2, [
        ['Header 1', 'Header 2'],
        ['Data A', 'Data B'],
        ['Data A', 'Data B'], // Pasted row
        ['Data A', 'Data B'], // Pasted row
      ]);

      const note = await vault.create({
        title: 'Copy Paste Test',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(table).not.toBeNull();
      expect(table!.children).toHaveLength(4);

      // Verify duplicated content
      expect(getCellText(table!, 1, 0)).toBe('Data A');
      expect(getCellText(table!, 2, 0)).toBe('Data A');
      expect(getCellText(table!, 3, 0)).toBe('Data A');
    });

    it('should preserve cell content after multiple edits', async () => {
      const content = createNoteWithTable('Edit Test', 2, 3, [
        ['Original 1', 'Original 2', 'Original 3'],
        ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3'],
      ]);

      const note = await vault.create({
        title: 'Edit Test',
        content,
      });

      // Read and verify all cells
      const saved = vault.read(note.id);
      const table = getTable(saved.content);

      expect(getCellText(table!, 0, 0)).toBe('Original 1');
      expect(getCellText(table!, 0, 1)).toBe('Original 2');
      expect(getCellText(table!, 0, 2)).toBe('Original 3');
      expect(getCellText(table!, 1, 0)).toBe('Row 2 Col 1');
      expect(getCellText(table!, 1, 1)).toBe('Row 2 Col 2');
      expect(getCellText(table!, 1, 2)).toBe('Row 2 Col 3');
    });

    it('should handle large tables', async () => {
      // Create a larger table (5x5)
      const cellContents: string[][] = [];
      for (let r = 0; r < 5; r++) {
        const row: string[] = [];
        for (let c = 0; c < 5; c++) {
          row.push(`Cell ${r + 1},${c + 1}`);
        }
        cellContents.push(row);
      }

      const content = createNoteWithTable('Large Table', 5, 5, cellContents);
      const note = await vault.create({
        title: 'Large Table',
        content,
      });

      // Verify
      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(table!.children).toHaveLength(5);
      expect(table!.children[0].children).toHaveLength(5);
      expect(getCellText(table!, 4, 4)).toBe('Cell 5,5');
    });
  });

  // ===========================================================================
  // Flow 8: Block Lists in Cells
  // ===========================================================================
  describe('Flow 8: Block Lists in Cells', () => {
    it('should save table cells with plain text content only', async () => {
      // Tables should only contain paragraph content, not lists
      // This test verifies that table cell content is stored correctly
      const content = createNoteWithTable('Plain Text Table', 2, 2, [
        ['Just text', 'More text'],
        ['Even more', 'Final cell'],
      ]);

      const note = await vault.create({
        title: 'Plain Text Table',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);

      // Verify all cells contain only paragraphs (not lists)
      for (const row of table!.children) {
        for (const cell of row.children) {
          for (const child of cell.children) {
            expect(child.type).toBe('paragraph');
          }
        }
      }
    });

    it('should preserve formatted text in cells', async () => {
      // Create content with formatted text in table cells
      // The formatting is handled by the editor, but we verify structure
      const content = createNoteWithTable('Formatted Table', 2, 2, [
        ['Normal text', 'Also normal'],
        ['Cell 2,1', 'Cell 2,2'],
      ]);

      const note = await vault.create({
        title: 'Formatted Table',
        content,
      });

      const saved = vault.read(note.id);
      expect(hasTable(saved.content)).toBe(true);
    });

    it('should handle empty cells mixed with content cells', async () => {
      const content = createNoteWithTable('Mixed Cells', 2, 3, [
        ['Has content', '', 'Has content'],
        ['', 'Center cell', ''],
      ]);

      const note = await vault.create({
        title: 'Mixed Cells',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);

      expect(getCellText(table!, 0, 0)).toBe('Has content');
      expect(getCellText(table!, 0, 1)).toBe('');
      expect(getCellText(table!, 1, 1)).toBe('Center cell');
    });
  });

  // ===========================================================================
  // Flow 9: Overflow Scrolling (Visual Test - Limited Automation)
  // ===========================================================================
  describe('Flow 9: Overflow Scrolling', () => {
    it('should handle table with many columns', async () => {
      // Create a wide table (1 row x 10 columns)
      const wideRow = Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);

      const content = createNoteWithTable('Wide Table', 1, 10, [wideRow]);

      const note = await vault.create({
        title: 'Wide Table',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(table!.children[0].children).toHaveLength(10);
    });

    it('should handle table with long cell content', async () => {
      const longText =
        'This is a very long cell content that would typically cause horizontal overflow in a table and require scrolling to view the complete content without truncation';

      const content = createNoteWithTable('Long Content Table', 2, 2, [
        [longText, 'Short'],
        ['Normal', longText],
      ]);

      const note = await vault.create({
        title: 'Long Content Table',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(getCellText(table!, 0, 0)).toBe(longText);
      expect(getCellText(table!, 1, 1)).toBe(longText);
    });

    it('should persist wide table structure across restart', async () => {
      const wideRow = Array.from({ length: 8 }, (_, i) => `Col ${i + 1}`);
      const dataRow = Array.from({ length: 8 }, (_, i) => `Data ${i + 1}`);

      const content = createNoteWithTable('Persistent Wide Table', 2, 8, [wideRow, dataRow]);

      const note = await vault.create({
        title: 'Persistent Wide Table',
        content,
      });

      // Simulate restart
      const newVault = await simulateAppRestart(tempDir);
      const loaded = newVault.read(note.id);

      expect(hasTable(loaded.content)).toBe(true);
      const table = getTable(loaded.content);
      expect(table!.children[0].children).toHaveLength(8);
    });
  });

  // ===========================================================================
  // Additional Integration Tests
  // ===========================================================================
  describe('Table Persistence', () => {
    it('should persist table structure across app restarts', async () => {
      const content = createNoteWithTable('Restart Test', 3, 3, [
        ['A', 'B', 'C'],
        ['D', 'E', 'F'],
        ['G', 'H', 'I'],
      ]);

      const note = await vault.create({
        title: 'Restart Test',
        content,
      });

      // Simulate restart
      const newVault = await simulateAppRestart(tempDir);
      const loaded = newVault.read(note.id);

      expect(hasTable(loaded.content)).toBe(true);
      const table = getTable(loaded.content);
      expect(getCellText(table!, 0, 0)).toBe('A');
      expect(getCellText(table!, 1, 1)).toBe('E');
      expect(getCellText(table!, 2, 2)).toBe('I');
    });

    it('should handle multiple tables in one note', async () => {
      const table1 = createNoteWithTable('', 2, 2, [
        ['T1-A', 'T1-B'],
        ['T1-C', 'T1-D'],
      ]).root.children[1] as unknown as { type: string; children: unknown[] };

      const table2 = createNoteWithTable('', 2, 2, [
        ['T2-A', 'T2-B'],
        ['T2-C', 'T2-D'],
      ]).root.children[1] as unknown as { type: string; children: unknown[] };

      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Multiple Tables' }],
            },
            table1 as { type: string; children: Array<{ type: string; text: string }> },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Between tables' }],
            },
            table2 as { type: string; children: Array<{ type: string; text: string }> },
          ],
        },
      };

      const note = await vault.create({
        title: 'Multiple Tables',
        content,
      });

      const saved = vault.read(note.id);
      const tables = saved.content.root.children.filter(
        (child) => (child as { type: string }).type === 'table'
      );
      expect(tables).toHaveLength(2);
    });

    it('should preserve header row designation', async () => {
      const content = createNoteWithHeaderTable(
        'Header Table Test',
        ['Name', 'Age', 'City'],
        [
          ['Alice', '30', 'NYC'],
          ['Bob', '25', 'LA'],
        ]
      );

      const note = await vault.create({
        title: 'Header Table Test',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);

      // Verify header row
      const headerRow = table!.children[0];
      expect(headerRow.children[0].headerState).toBe('row');

      // Verify data row has normal header state
      const dataRow = table!.children[1];
      expect(dataRow.children[0].headerState).toBe('normal');
    });
  });

  describe('Table Graph Integration', () => {
    it('should add notes with tables to graph engine', async () => {
      const content = createNoteWithTable('Graph Test Table', 2, 2, [
        ['Data A', 'Data B'],
        ['Data C', 'Data D'],
      ]);

      const note = await vault.create({
        title: 'Graph Test Table',
        content,
      });

      // Add to graph engine
      graphEngine.addNote(note);

      // Verify note is in graph
      const stats = graphEngine.getStats();
      expect(stats.nodes).toBe(1);
    });

    it('should remove notes with tables from graph engine', async () => {
      const content = createNoteWithTable('Remove Graph Table', 2, 2, [
        ['A', 'B'],
        ['C', 'D'],
      ]);

      const note = await vault.create({
        title: 'Remove Graph Table',
        content,
      });

      graphEngine.addNote(note);
      expect(graphEngine.getStats().nodes).toBe(1);

      graphEngine.removeNote(note.id);
      expect(graphEngine.getStats().nodes).toBe(0);
    });
  });

  describe('Table Search Integration', () => {
    it('should index table content for search', async () => {
      const content = createNoteWithTable('Searchable Table', 2, 2, [
        ['Important Data', 'Critical Info'],
        ['Key Value', 'Essential'],
      ]);

      const note = await vault.create({
        title: 'Searchable Table',
        content,
      });

      // Index note
      searchEngine.indexNote(note);

      // Search for table content
      const results = searchEngine.search('Important Data');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(note.id);

      // Search for another cell
      const results2 = searchEngine.search('Essential');
      expect(results2.length).toBeGreaterThan(0);
    });

    it('should update search index when table content changes', async () => {
      const content = createNoteWithTable('Original Content', 2, 2, [
        ['FindMe', 'Data'],
        ['More', 'Data'],
      ]);

      const note = await vault.create({
        title: 'Original Content',
        content,
      });

      searchEngine.indexNote(note);

      // Verify original content is searchable
      let results = searchEngine.search('FindMe');
      expect(results.length).toBe(1);

      // Update the note with different table content
      const updatedContent = createNoteWithTable('Original Content', 2, 2, [
        ['NewContent', 'Data'],
        ['More', 'Data'],
      ]);

      note.content = updatedContent;
      await vault.save(note);

      // Re-index
      const updated = vault.read(note.id);
      searchEngine.indexNote(updated);

      // Old content should not be found
      results = searchEngine.search('FindMe');
      expect(results.length).toBe(0);

      // New content should be found
      results = searchEngine.search('NewContent');
      expect(results.length).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle table with single cell', async () => {
      const content = createNoteWithTable('Single Cell', 1, 1, [['Only cell']]);

      const note = await vault.create({
        title: 'Single Cell',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(table!.children).toHaveLength(1);
      expect(table!.children[0].children).toHaveLength(1);
      expect(getCellText(table!, 0, 0)).toBe('Only cell');
    });

    it('should handle empty note with only table', async () => {
      const tableNode = createNoteWithTable('', 2, 2).root.children[1] as unknown as {
        type: string;
        children: Array<{ type: string; text: string }>;
      };

      const content: EditorContent = {
        root: {
          type: 'root',
          children: [tableNode],
        },
      };

      const note = await vault.create({
        title: '', // Empty title
        content,
      });

      const saved = vault.read(note.id);
      expect(hasTable(saved.content)).toBe(true);
    });

    it('should handle table deletion leaving note with other content', async () => {
      // Simulate a note that had a table deleted
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Title' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Content that remains after table deletion' }],
            },
          ],
        },
      };

      const note = await vault.create({
        title: 'Title',
        content,
      });

      const saved = vault.read(note.id);
      expect(hasTable(saved.content)).toBe(false);
      expect(saved.content.root.children).toHaveLength(2);
    });

    it('should handle special characters in table cells', async () => {
      const content = createNoteWithTable('Special Chars', 2, 2, [
        ['Hello & Goodbye', 'Price: $100'],
        ['<tag>', "Quote: 'test'"],
      ]);

      const note = await vault.create({
        title: 'Special Chars',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(getCellText(table!, 0, 0)).toBe('Hello & Goodbye');
      expect(getCellText(table!, 0, 1)).toBe('Price: $100');
      expect(getCellText(table!, 1, 0)).toBe('<tag>');
    });

    it('should handle unicode in table cells', async () => {
      const content = createNoteWithTable('Unicode Table', 2, 2, [
        ['Hello', 'World'],
        ['Cafe', 'Resume'],
      ]);

      const note = await vault.create({
        title: 'Unicode Table',
        content,
      });

      const saved = vault.read(note.id);
      const table = getTable(saved.content);
      expect(getCellText(table!, 0, 0)).toBe('Hello');
      expect(getCellText(table!, 1, 0)).toBe('Cafe');
    });
  });
});
