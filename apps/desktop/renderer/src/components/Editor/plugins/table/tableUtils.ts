/**
 * Shared utility functions for table keyboard hooks
 */

import {
  $getSelection,
  $isRangeSelection,
  $getNodeByKey,
  $createParagraphNode,
  $setSelection,
  LexicalNode,
} from 'lexical';
import {
  $isTableRowNode,
  $isTableNode,
  $isTableCellNode,
  $getTableCellNodeFromLexicalNode,
  TableCellNode,
  TableNode,
  TableSelection,
  $isTableSelection,
  $createTableSelectionFrom,
} from '@lexical/table';
import { $isListItemNode } from '@lexical/list';

/**
 * Check if the current selection is inside a table cell
 */
export function $isSelectionInTable(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const anchorNode = selection.anchor.getNode();
  const tableCell = $getTableCellNodeFromLexicalNode(anchorNode);
  return tableCell !== null;
}

/**
 * Check if the current selection is inside a list item
 */
export function $isSelectionInList(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  let node: LexicalNode | null = selection.anchor.getNode();
  while (node !== null) {
    if ($isListItemNode(node)) {
      return true;
    }
    node = node.getParent();
  }
  return false;
}

/**
 * Get the table cell containing the current selection
 */
export function $getTableCellFromSelection(): TableCellNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  const anchorNode = selection.anchor.getNode();
  return $getTableCellNodeFromLexicalNode(anchorNode);
}

/**
 * Get the table node from a cell
 */
export function $getTableFromCell(cell: TableCellNode): TableNode | null {
  const row = cell.getParent();
  if (!$isTableRowNode(row)) return null;

  const table = row.getParent();
  if (!$isTableNode(table)) return null;

  return table;
}

/**
 * Check if the cell is the last cell in the last row
 */
export function $isLastCellInTable(cell: TableCellNode): boolean {
  const row = cell.getParent();
  if (!$isTableRowNode(row)) return false;

  const table = row.getParent();
  if (!$isTableNode(table)) return false;

  const rows = table.getChildren();
  const lastRow = rows[rows.length - 1];
  if (row !== lastRow) return false;

  const cells = row.getChildren();
  const lastCell = cells[cells.length - 1];
  return cell === lastCell;
}

/**
 * Check if the cell is the first cell in the table (first cell of first row)
 */
export function $isFirstCellInTable(cell: TableCellNode): boolean {
  const row = cell.getParent();
  if (!$isTableRowNode(row)) return false;

  const table = row.getParent();
  if (!$isTableNode(table)) return false;

  const rows = table.getChildren();
  const firstRow = rows[0];
  if (row !== firstRow) return false;

  const cells = row.getChildren();
  const firstCell = cells[0];
  return cell === firstCell;
}

/**
 * Check if a table is completely empty (no text content in any cell)
 */
export function $isTableEmpty(table: TableNode): boolean {
  const rows = table.getChildren();
  for (const row of rows) {
    if (!$isTableRowNode(row)) continue;
    const cells = row.getChildren();
    for (const cell of cells) {
      if (!$isTableCellNode(cell)) continue;
      const textContent = cell.getTextContent().trim();
      if (textContent.length > 0) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Get the first cell in a table (first cell of first row)
 */
export function $getFirstCell(table: TableNode): TableCellNode | null {
  const rows = table.getChildren();
  if (rows.length === 0) return null;

  const firstRow = rows[0];
  if (!$isTableRowNode(firstRow)) return null;

  const cells = firstRow.getChildren();
  if (cells.length === 0) return null;

  const firstCell = cells[0];
  return $isTableCellNode(firstCell) ? firstCell : null;
}

/**
 * Get the last cell in a table (last cell of last row)
 */
export function $getLastCell(table: TableNode): TableCellNode | null {
  const rows = table.getChildren();
  if (rows.length === 0) return null;

  const lastRow = rows[rows.length - 1];
  if (!$isTableRowNode(lastRow)) return null;

  const cells = lastRow.getChildren();
  if (cells.length === 0) return null;

  const lastCell = cells[cells.length - 1];
  return $isTableCellNode(lastCell) ? lastCell : null;
}

/**
 * Select the entire table by creating a TableSelection from first to last cell
 */
export function $selectEntireTable(table: TableNode): boolean {
  const firstCell = $getFirstCell(table);
  const lastCell = $getLastCell(table);

  if (!firstCell || !lastCell) return false;

  const tableSelection = $createTableSelectionFrom(table, firstCell, lastCell);
  $setSelection(tableSelection);
  return true;
}

/**
 * Get the table node from a TableSelection
 */
export function $getTableFromTableSelection(selection: TableSelection): TableNode | null {
  const tableNode = $getNodeByKey(selection.tableKey);
  return $isTableNode(tableNode) ? tableNode : null;
}

/**
 * Check if the entire table is selected (all cells selected)
 */
export function $isEntireTableSelected(table: TableNode, selection: TableSelection): boolean {
  const shape = selection.getShape();
  const rowCount = table.getChildrenSize();
  const firstRow = table.getChildAtIndex(0);
  if (!$isTableRowNode(firstRow)) return false;
  const colCount = firstRow.getChildrenSize();

  return (
    shape.fromX === 0 &&
    shape.fromY === 0 &&
    shape.toX === colCount - 1 &&
    shape.toY === rowCount - 1
  );
}

/**
 * Move selection to before the table
 */
export function $exitTableBefore(table: TableNode): void {
  const prevSibling = table.getPreviousSibling();
  if (prevSibling) {
    prevSibling.selectEnd();
  } else {
    const paragraph = $createParagraphNode();
    table.insertBefore(paragraph);
    paragraph.select();
  }
}

/**
 * Move selection to after the table
 */
export function $exitTableAfter(table: TableNode): void {
  const nextSibling = table.getNextSibling();
  if (nextSibling) {
    nextSibling.selectStart();
  } else {
    const paragraph = $createParagraphNode();
    table.insertAfter(paragraph);
    paragraph.select();
  }
}

// Re-export $isTableSelection for convenience
export { $isTableSelection };
