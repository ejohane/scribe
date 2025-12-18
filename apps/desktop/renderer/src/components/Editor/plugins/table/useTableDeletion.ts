/**
 * useTableDeletion
 *
 * Handles Backspace and Delete keys in tables:
 * - Deletes table when entire table is selected
 * - Deletes table when table is completely empty
 * - Backspace exits before table, Delete exits after table
 */

import { useEffect } from 'react';
import {
  $getSelection,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  COMMAND_PRIORITY_HIGH,
  LexicalEditor,
} from 'lexical';
import {
  $isSelectionInTable,
  $getTableCellFromSelection,
  $getTableFromCell,
  $isTableEmpty,
  $exitTableBefore,
  $exitTableAfter,
  $isTableSelection,
  $getTableFromTableSelection,
  $isEntireTableSelected,
} from './tableUtils';
import type { TableSelection } from '@lexical/table';

type ExitDirection = 'before' | 'after';

function $exitTable(exitDirection: ExitDirection, table: ReturnType<typeof $getTableFromCell>) {
  if (!table) return;
  exitDirection === 'before' ? $exitTableBefore(table) : $exitTableAfter(table);
}

/** Handle table deletion for both Backspace and Delete keys */
function handleTableDeletion(event: KeyboardEvent, exitDirection: ExitDirection): boolean {
  const selection = $getSelection();

  // Handle TableSelection - delete entire table if all cells selected
  if ($isTableSelection(selection)) {
    const table = $getTableFromTableSelection(selection as TableSelection);
    if (table && $isEntireTableSelected(table, selection as TableSelection)) {
      event.preventDefault();
      $exitTable(exitDirection, table);
      table.remove();
      return true;
    }
    return false; // Let Lexical handle partial table selection
  }

  // Handle RangeSelection inside a table cell
  if (!$isSelectionInTable()) return false;

  const cell = $getTableCellFromSelection();
  if (!cell) return false;

  const table = $getTableFromCell(cell);
  if (!table || !$isTableEmpty(table)) return false;

  // Table is empty, delete it
  event.preventDefault();
  $exitTable(exitDirection, table);
  table.remove();
  return true;
}

export function useTableDeletion(editor: LexicalEditor): void {
  useEffect(() => {
    const removeBackspaceCommand = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event: KeyboardEvent) => handleTableDeletion(event, 'before'),
      COMMAND_PRIORITY_HIGH
    );

    const removeDeleteCommand = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event: KeyboardEvent) => handleTableDeletion(event, 'after'),
      COMMAND_PRIORITY_HIGH
    );

    return () => {
      removeBackspaceCommand();
      removeDeleteCommand();
    };
  }, [editor]);
}
