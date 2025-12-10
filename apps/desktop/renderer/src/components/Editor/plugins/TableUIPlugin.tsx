/**
 * TableUIPlugin
 *
 * Manages hover state detection for tables and renders TableControls
 * for adding/removing rows and columns.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import {
  $isTableNode,
  $isTableRowNode,
  $isTableCellNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $deleteTableColumn__EXPERIMENTAL,
  $deleteTableRow__EXPERIMENTAL,
} from '@lexical/table';
import { TableControls } from '../components/TableControls';

interface TableHoverState {
  tableKey: string;
  tableElement: HTMLTableElement;
  isHovered: boolean;
  hoveredRowIndex: number;
  hoveredColumnIndex: number;
  isHeaderRow: boolean;
  rowCount: number;
  columnCount: number;
}

export function TableUIPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [hoverState, setHoverState] = useState<TableHoverState | null>(null);
  const tableMapRef = useRef<Map<string, HTMLTableElement>>(new Map());

  // Track all tables in the editor
  useEffect(() => {
    const updateTableMap = () => {
      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      const tables = rootElement.querySelectorAll('table');
      const newMap = new Map<string, HTMLTableElement>();

      editor.getEditorState().read(() => {
        tables.forEach((tableEl) => {
          // Find the Lexical node key from the data attribute
          const key = tableEl.getAttribute('data-lexical-node-key');
          if (key) {
            newMap.set(key, tableEl as HTMLTableElement);
          }
        });
      });

      tableMapRef.current = newMap;
    };

    // Update on editor changes
    const removeListener = editor.registerUpdateListener(() => {
      updateTableMap();
    });

    // Initial update
    updateTableMap();

    return removeListener;
  }, [editor]);

  // Handle mouse events for hover detection
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if we're over a table
      const tableEl = target.closest('table') as HTMLTableElement | null;

      if (!tableEl) {
        // Not over any table
        if (hoverState?.isHovered) {
          setHoverState(null);
        }
        return;
      }

      // Get the table key
      const tableKey = tableEl.getAttribute('data-lexical-node-key');
      if (!tableKey) return;

      // Determine which row and column we're hovering
      const cell = target.closest('td, th') as HTMLTableCellElement | null;
      const row = target.closest('tr') as HTMLTableRowElement | null;

      let hoveredRowIndex = -1;
      let hoveredColumnIndex = -1;
      let isHeaderRow = false;

      if (row) {
        const rows = Array.from(tableEl.querySelectorAll('tr'));
        hoveredRowIndex = rows.indexOf(row);
        isHeaderRow = hoveredRowIndex === 0;
      }

      if (cell) {
        const cells = Array.from(row?.querySelectorAll('td, th') ?? []);
        hoveredColumnIndex = cells.indexOf(cell);
      }

      // Count rows and columns
      const rows = tableEl.querySelectorAll('tr');
      const rowCount = rows.length;
      const columnCount = rows[0]?.querySelectorAll('td, th').length ?? 0;

      setHoverState({
        tableKey,
        tableElement: tableEl,
        isHovered: true,
        hoveredRowIndex,
        hoveredColumnIndex,
        isHeaderRow,
        rowCount,
        columnCount,
      });
    };

    const handleMouseLeave = (event: MouseEvent) => {
      // Check if we're leaving the editor entirely or just moving between tables
      const relatedTarget = event.relatedTarget as HTMLElement | null;
      const isLeavingToControls = relatedTarget?.closest('[class*="tableControlsWrapper"]');

      if (!isLeavingToControls) {
        // Give a small delay to allow moving to controls
        setTimeout(() => {
          const isOverTable = document.querySelector('table:hover');
          const isOverControls = document.querySelector('[class*="tableControlsWrapper"]:hover');
          if (!isOverTable && !isOverControls) {
            setHoverState(null);
          }
        }, 50);
      }
    };

    rootElement.addEventListener('mousemove', handleMouseMove);
    rootElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      rootElement.removeEventListener('mousemove', handleMouseMove);
      rootElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [editor, hoverState?.isHovered]);

  // Add column handler
  const handleAddColumn = useCallback(() => {
    if (!hoverState) return;

    editor.update(() => {
      const tableNode = $getNodeByKey(hoverState.tableKey);
      if (!$isTableNode(tableNode)) return;

      // Insert column at the end
      $insertTableColumn__EXPERIMENTAL(false); // false = after current column
    });
  }, [editor, hoverState]);

  // Add row handler
  const handleAddRow = useCallback(() => {
    if (!hoverState) return;

    editor.update(() => {
      const tableNode = $getNodeByKey(hoverState.tableKey);
      if (!$isTableNode(tableNode)) return;

      // Insert row at the end
      $insertTableRow__EXPERIMENTAL(false); // false = after current row
    });
  }, [editor, hoverState]);

  // Remove column handler
  const handleRemoveColumn = useCallback(
    (columnIndex: number) => {
      if (!hoverState || hoverState.columnCount <= 1) return;

      editor.update(() => {
        const tableNode = $getNodeByKey(hoverState.tableKey);
        if (!$isTableNode(tableNode)) return;

        // Select a cell in the column to remove
        const rows = tableNode.getChildren();
        if (rows.length === 0) return;

        const firstRow = rows[0];
        if (!$isTableRowNode(firstRow)) return;

        const cells = firstRow.getChildren();
        if (columnIndex >= cells.length) return;

        const targetCell = cells[columnIndex];
        if (!$isTableCellNode(targetCell)) return;

        // Select the cell first, then delete the column
        targetCell.selectStart();
        $deleteTableColumn__EXPERIMENTAL();
      });
    },
    [editor, hoverState]
  );

  // Remove row handler
  const handleRemoveRow = useCallback(
    (rowIndex: number) => {
      if (!hoverState || rowIndex === 0) return; // Can't remove header row

      editor.update(() => {
        const tableNode = $getNodeByKey(hoverState.tableKey);
        if (!$isTableNode(tableNode)) return;

        const rows = tableNode.getChildren();
        if (rowIndex >= rows.length) return;

        const targetRow = rows[rowIndex];
        if (!$isTableRowNode(targetRow)) return;

        // Select a cell in the row to remove, then delete
        const cells = targetRow.getChildren();
        if (cells.length === 0) return;

        const targetCell = cells[0];
        if (!$isTableCellNode(targetCell)) return;

        targetCell.selectStart();
        $deleteTableRow__EXPERIMENTAL();
      });
    },
    [editor, hoverState]
  );

  // Render controls if a table is hovered
  if (!hoverState) return null;

  return (
    <TableControls
      tableElement={hoverState.tableElement}
      isTableHovered={hoverState.isHovered}
      hoveredRowIndex={hoverState.hoveredRowIndex}
      hoveredColumnIndex={hoverState.hoveredColumnIndex}
      isHeaderRow={hoverState.isHeaderRow}
      rowCount={hoverState.rowCount}
      columnCount={hoverState.columnCount}
      onAddColumn={handleAddColumn}
      onAddRow={handleAddRow}
      onRemoveColumn={handleRemoveColumn}
      onRemoveRow={handleRemoveRow}
    />
  );
}
