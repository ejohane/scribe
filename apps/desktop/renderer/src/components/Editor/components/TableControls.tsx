/**
 * TableControls
 *
 * UI controls for adding/removing table rows and columns.
 * Rendered as an overlay positioned relative to the table.
 */

import { createPortal } from 'react-dom';
import * as styles from './TableControls.css';

export interface TableControlsProps {
  /** The table element to attach controls to */
  tableElement: HTMLTableElement;
  /** Whether the table is currently hovered */
  isTableHovered: boolean;
  /** Index of the hovered row (-1 if none) */
  hoveredRowIndex: number;
  /** Index of the hovered column (-1 if none) */
  hoveredColumnIndex: number;
  /** Whether the hovered row is the header row */
  isHeaderRow: boolean;
  /** Total number of rows in the table */
  rowCount: number;
  /** Total number of columns in the table */
  columnCount: number;
  /** Callback to add a column */
  onAddColumn: () => void;
  /** Callback to add a row */
  onAddRow: () => void;
  /** Callback to remove a column */
  onRemoveColumn: (columnIndex: number) => void;
  /** Callback to remove a row */
  onRemoveRow: (rowIndex: number) => void;
}

export function TableControls({
  tableElement,
  isTableHovered,
  hoveredRowIndex,
  hoveredColumnIndex,
  // isHeaderRow - unused but kept in interface for future use
  // rowCount - unused but kept in interface for future use
  columnCount,
  onAddColumn,
  onAddRow,
  onRemoveColumn,
  onRemoveRow,
}: TableControlsProps) {
  const tableRect = tableElement.getBoundingClientRect();

  // Don't render anything if table is not hovered
  if (!isTableHovered) {
    return null;
  }

  // Get header row element for positioning add column button
  const headerRow = tableElement.querySelector('tr:first-child');
  const headerRect = headerRow?.getBoundingClientRect();

  // Get the hovered cell for positioning remove buttons
  const getRowElement = (index: number): HTMLTableRowElement | null => {
    return tableElement.querySelector(`tr:nth-child(${index + 1})`);
  };

  const getHeaderCellElement = (index: number): HTMLTableCellElement | null => {
    const headerRow = tableElement.querySelector('tr:first-child');
    return (
      headerRow?.querySelector(`th:nth-child(${index + 1}), td:nth-child(${index + 1})`) ?? null
    );
  };

  // Calculate remove button positions
  const hoveredRow = hoveredRowIndex >= 0 ? getRowElement(hoveredRowIndex) : null;
  const hoveredRowRect = hoveredRow?.getBoundingClientRect();

  const hoveredHeaderCell =
    hoveredColumnIndex >= 0 ? getHeaderCellElement(hoveredColumnIndex) : null;
  const hoveredHeaderCellRect = hoveredHeaderCell?.getBoundingClientRect();

  // Check if we can remove (need at least 1 column, can't remove header row)
  const canRemoveColumn = columnCount > 1;
  const canRemoveRow = hoveredRowIndex > 0; // Can't remove header row (index 0)

  return createPortal(
    <div
      className={styles.tableControlsWrapper}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Add Column Button - right edge of header row */}
      {headerRect && (
        <div
          className={`${styles.addColumnContainer} ${styles.interactive}`}
          style={{
            position: 'fixed',
            top: headerRect.top + headerRect.height / 2,
            left: tableRect.right + 8,
            transform: 'translateY(-50%)',
          }}
        >
          <button
            className={styles.addButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddColumn();
            }}
            title="Add column"
            aria-label="Add column"
          >
            +
          </button>
        </div>
      )}

      {/* Add Row Button - below last row */}
      <div
        className={`${styles.addRowContainer} ${styles.interactive}`}
        style={{
          position: 'fixed',
          top: tableRect.bottom + 8,
          left: tableRect.left + tableRect.width / 2,
          transform: 'translateX(-50%)',
        }}
      >
        <button
          className={styles.addButton}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddRow();
          }}
          title="Add row"
          aria-label="Add row"
        >
          +
        </button>
      </div>

      {/* Remove Column Button - shown when hovering header cell */}
      {hoveredHeaderCellRect && canRemoveColumn && hoveredColumnIndex >= 0 && (
        <div
          className={`${styles.removeColumnContainer} ${styles.interactive}`}
          style={{
            position: 'fixed',
            top: hoveredHeaderCellRect.top - 4,
            left: hoveredHeaderCellRect.right - 4,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <button
            className={styles.removeButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveColumn(hoveredColumnIndex);
            }}
            title="Remove column"
            aria-label="Remove column"
          >
            x
          </button>
        </div>
      )}

      {/* Remove Row Button - shown when hovering data row (not header) */}
      {hoveredRowRect && canRemoveRow && hoveredRowIndex > 0 && (
        <div
          className={`${styles.removeRowContainer} ${styles.interactive}`}
          style={{
            position: 'fixed',
            top: hoveredRowRect.top + hoveredRowRect.height / 2,
            left: tableRect.left - 8,
            transform: 'translateY(-50%)',
          }}
        >
          <button
            className={styles.removeButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveRow(hoveredRowIndex);
            }}
            title="Remove row"
            aria-label="Remove row"
          >
            x
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
