/**
 * TableUIPlugin
 *
 * Shows add row/column buttons when hovering over a table.
 * Based on Lexical's official TableHoverActionsPlugin pattern.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import {
  $isTableCellNode,
  $isTableNode,
  $getTableRowIndexFromTableCellNode,
  $getTableColumnIndexFromTableCellNode,
  $insertTableRowAtSelection,
  $insertTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $deleteTableColumnAtSelection,
  TableRowNode,
} from '@lexical/table';
import { $findMatchingParent } from '@lexical/utils';
import { $getNearestNodeFromDOMNode } from 'lexical';
import { createPortal } from 'react-dom';
import * as styles from '../components/TableControls.css';

const BUTTON_SIZE_PX = 24;

export function TableUIPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [showAddRow, setShowAddRow] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showDeleteRow, setShowDeleteRow] = useState(false);
  const [showDeleteColumn, setShowDeleteColumn] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [deleteRowPosition, setDeleteRowPosition] = useState({ top: 0, left: 0 });
  const [deleteColumnPosition, setDeleteColumnPosition] = useState({ top: 0, left: 0 });
  const tableCellRef = useRef<HTMLElement | null>(null);
  const tableRectRef = useRef<DOMRect | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const { clientX, clientY } = event;

      // Check if we're hovering over our buttons - if so, cancel any hide timer
      if (target.closest('[data-table-control]')) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        return;
      }

      // Find the table cell we're hovering
      const tableCellDOM = target.closest('td, th') as HTMLElement | null;

      // Find the table element we're hovering (anywhere in the table)
      const tableDOM = target.closest('table') as HTMLElement | null;

      // If completely outside any table, check if we're near the button area
      if (!tableDOM) {
        // Check if mouse is in the "hover zone" near the table (for reaching buttons)
        const rect = tableRectRef.current;
        if (rect) {
          const HOVER_ZONE = 40; // pixels beyond table edge
          const isNearTable =
            clientX >= rect.left - HOVER_ZONE &&
            clientX <= rect.right + HOVER_ZONE &&
            clientY >= rect.top - HOVER_ZONE &&
            clientY <= rect.bottom + HOVER_ZONE;

          if (isNearTable) {
            // Still near table, don't hide yet
            return;
          }
        }

        // Fully outside, hide buttons
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        setShowAddRow(false);
        setShowAddColumn(false);
        setShowDeleteRow(false);
        setShowDeleteColumn(false);
        return;
      }

      // Cancel any pending hide timer since we're over a table
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      // If inside table but not in a cell (e.g., on border), keep current state
      if (!tableCellDOM) {
        return;
      }

      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      tableCellRef.current = tableCellDOM;

      // Debounce the button show/hide logic
      debounceTimerRef.current = setTimeout(() => {
        const result: {
          shouldShowRow: boolean;
          shouldShowColumn: boolean;
          shouldShowDeleteRow: boolean;
          shouldShowDeleteColumn: boolean;
          tableRect: DOMRect | null;
          cellRect: DOMRect | null;
          rowIndex: number;
          colIndex: number;
          rowCount: number;
          colCount: number;
        } = {
          shouldShowRow: false,
          shouldShowColumn: false,
          shouldShowDeleteRow: false,
          shouldShowDeleteColumn: false,
          tableRect: null,
          cellRect: null,
          rowIndex: -1,
          colIndex: -1,
          rowCount: 0,
          colCount: 0,
        };

        editor.read(() => {
          const maybeTableCell = $getNearestNodeFromDOMNode(tableCellDOM);

          if ($isTableCellNode(maybeTableCell)) {
            const table = $findMatchingParent(maybeTableCell, $isTableNode);
            if (!$isTableNode(table)) {
              return;
            }

            const tableElement = editor.getElementByKey(table.getKey());
            if (!tableElement) {
              return;
            }

            result.tableRect = tableElement.getBoundingClientRect();
            result.cellRect = tableCellDOM.getBoundingClientRect();

            result.rowCount = table.getChildrenSize();
            const firstRow = table.getChildAtIndex(0) as TableRowNode | null;
            result.colCount = firstRow?.getChildrenSize() ?? 0;

            result.rowIndex = $getTableRowIndexFromTableCellNode(maybeTableCell);
            result.colIndex = $getTableColumnIndexFromTableCellNode(maybeTableCell);

            // Show add row button when hovering last row
            if (result.rowIndex === result.rowCount - 1) {
              result.shouldShowRow = true;
            }
            // Show add column button when hovering last column
            if (result.colIndex === result.colCount - 1) {
              result.shouldShowColumn = true;
            }

            // Show delete row button if more than 1 row and not header row
            if (result.rowCount > 1 && result.rowIndex > 0) {
              result.shouldShowDeleteRow = true;
            }
            // Show delete column button if more than 1 column
            if (result.colCount > 1) {
              result.shouldShowDeleteColumn = true;
            }
          }
        });

        const {
          shouldShowRow,
          shouldShowColumn,
          shouldShowDeleteRow,
          shouldShowDeleteColumn,
          tableRect,
          cellRect,
        } = result;

        if (tableRect) {
          // Store the table rect for hover zone calculations
          tableRectRef.current = tableRect;

          if (shouldShowRow) {
            setShowAddColumn(false);
            setShowAddRow(true);
            setPosition({
              top: tableRect.bottom + 4,
              left: tableRect.left + tableRect.width / 2 - BUTTON_SIZE_PX / 2,
              width: tableRect.width,
              height: tableRect.height,
            });
          } else if (shouldShowColumn) {
            setShowAddRow(false);
            setShowAddColumn(true);
            setPosition({
              top: tableRect.top + tableRect.height / 2 - BUTTON_SIZE_PX / 2,
              left: tableRect.right + 4,
              width: tableRect.width,
              height: tableRect.height,
            });
          } else {
            setShowAddRow(false);
            setShowAddColumn(false);
          }

          // Position delete buttons relative to the hovered cell
          if (cellRect) {
            if (shouldShowDeleteRow) {
              setShowDeleteRow(true);
              setDeleteRowPosition({
                top: cellRect.top + cellRect.height / 2 - 9, // 9 = half of 18px button
                left: tableRect.left - 26,
              });
            } else {
              setShowDeleteRow(false);
            }

            if (shouldShowDeleteColumn) {
              setShowDeleteColumn(true);
              setDeleteColumnPosition({
                top: tableRect.top - 26,
                left: cellRect.left + cellRect.width / 2 - 9,
              });
            } else {
              setShowDeleteColumn(false);
            }
          }
        }
      }, 50);
    },
    [editor]
  );

  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    // Listen on document to catch all mouse moves
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [editor, handleMouseMove]);

  const insertRow = useCallback(() => {
    editor.update(() => {
      if (tableCellRef.current) {
        const maybeTableCell = $getNearestNodeFromDOMNode(tableCellRef.current);
        if ($isTableCellNode(maybeTableCell)) {
          maybeTableCell.selectEnd();
          $insertTableRowAtSelection(true);
        }
      }
    });
    setShowAddRow(false);
  }, [editor]);

  const insertColumn = useCallback(() => {
    editor.update(() => {
      if (tableCellRef.current) {
        const maybeTableCell = $getNearestNodeFromDOMNode(tableCellRef.current);
        if ($isTableCellNode(maybeTableCell)) {
          maybeTableCell.selectEnd();
          $insertTableColumnAtSelection(true);
        }
      }
    });
    setShowAddColumn(false);
  }, [editor]);

  const deleteRow = useCallback(() => {
    editor.update(() => {
      if (tableCellRef.current) {
        const maybeTableCell = $getNearestNodeFromDOMNode(tableCellRef.current);
        if ($isTableCellNode(maybeTableCell)) {
          maybeTableCell.selectEnd();
          $deleteTableRowAtSelection();
        }
      }
    });
    setShowDeleteRow(false);
  }, [editor]);

  const deleteColumn = useCallback(() => {
    editor.update(() => {
      if (tableCellRef.current) {
        const maybeTableCell = $getNearestNodeFromDOMNode(tableCellRef.current);
        if ($isTableCellNode(maybeTableCell)) {
          maybeTableCell.selectEnd();
          $deleteTableColumnAtSelection();
        }
      }
    });
    setShowDeleteColumn(false);
  }, [editor]);

  if (!isEditable) {
    return null;
  }

  return createPortal(
    <>
      {showAddRow && (
        <button
          data-table-control="add-row"
          className={styles.addButton}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 100,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            insertRow();
          }}
          title="Add row"
          aria-label="Add row"
        >
          +
        </button>
      )}
      {showAddColumn && (
        <button
          data-table-control="add-column"
          className={styles.addButton}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 100,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            insertColumn();
          }}
          title="Add column"
          aria-label="Add column"
        >
          +
        </button>
      )}
      {showDeleteRow && (
        <button
          data-table-control="delete-row"
          className={styles.removeButton}
          style={{
            position: 'fixed',
            top: deleteRowPosition.top,
            left: deleteRowPosition.left,
            zIndex: 100,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteRow();
          }}
          title="Delete row"
          aria-label="Delete row"
        >
          ×
        </button>
      )}
      {showDeleteColumn && (
        <button
          data-table-control="delete-column"
          className={styles.removeButton}
          style={{
            position: 'fixed',
            top: deleteColumnPosition.top,
            left: deleteColumnPosition.left,
            zIndex: 100,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteColumn();
          }}
          title="Delete column"
          aria-label="Delete column"
        >
          ×
        </button>
      )}
    </>,
    document.body
  );
}
